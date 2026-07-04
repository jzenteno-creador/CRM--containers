"use client";

// Command palette ⌘K (spec artboard 2e): modal 640px top 72px, apertura scale(.98)→1
// + fade 200ms out-expo. Busca operaciones ABIERTAS en vista_alertas (trae semáforo y
// metadata en una sola query; las cerradas se consultan en /historial). ↑↓ navega,
// ↵ abre, ESC cierra. Atajos de acción I/E/A. Se abre con ⌘K/Ctrl+K o evento fd-palette.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/session-context";
import { ContainerNumber } from "@/components/container-number";
import { ESTADO_LABELS } from "@/lib/format";
import type { VistaAlerta } from "@/lib/types";

const MAX_RESULTADOS = 8;

type Accion = { id: string; label: string; icon: string; href: string; kbd: string };

const ACCIONES: Accion[] = [
  { id: "ingreso", label: "Registrar tanda de retiro", icon: "ti-login-2", href: "/ingreso", kbd: "I" },
  { id: "egreso", label: "Registrar egreso / devolución", icon: "ti-logout-2", href: "/egreso", kbd: "E" },
  { id: "alertas", label: "Ver alertas de freetime", icon: "ti-bell", href: "/alertas", kbd: "A" },
];

const DOT: Record<string, string> = {
  verde: "var(--text-success)",
  amarillo: "var(--text-warning)",
  rojo: "var(--text-danger)",
  neutro: "var(--text-muted)",
};

export function CommandPalette() {
  const router = useRouter();
  const session = useSession();
  const [abierta, setAbierta] = useState(false);
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<VistaAlerta[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // apertura: ⌘K / Ctrl+K global + evento fd-palette (botón del header)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierta((v) => !v);
      }
    };
    const onEvento = () => setAbierta(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("fd-palette", onEvento);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("fd-palette", onEvento);
    };
  }, []);

  // el reset se hace al CERRAR (cerrar()), así abrir siempre encuentra estado limpio y el
  // effect solo sincroniza con el DOM (focus) — regla react-hooks/set-state-in-effect
  const cerrar = useCallback(() => {
    setAbierta(false);
    setQ("");
    setResultados([]);
    setSel(0);
    setBuscando(false);
  }, []);

  useEffect(() => {
    if (abierta) {
      // focus después del mount del modal
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [abierta]);

  // búsqueda debounced 250ms sobre vista_alertas (solo operaciones abiertas).
  // Todos los setState quedan dentro del timeout (regla react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!abierta) return;
    const term = q.trim().replace(/[,()]/g, " ").trim();
    const t = setTimeout(async () => {
      if (!term) {
        setResultados([]);
        setBuscando(false);
        return;
      }
      setBuscando(true);
      let qy = supabase
        .from("vista_alertas")
        .select("*")
        .ilike("numero_contenedor", `%${term}%`)
        .order("dias_restantes", { ascending: true, nullsFirst: false })
        .limit(MAX_RESULTADOS);
      if (session.rol === "operador" && session.plantaNombre) {
        qy = qy.eq("planta_actual", session.plantaNombre);
      }
      const { data, error } = await qy;
      if (!error) setResultados((data ?? []) as VistaAlerta[]);
      setSel(0);
      setBuscando(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, abierta, session.rol, session.plantaNombre]);

  const items = resultados.length + ACCIONES.length;

  const abrir = useCallback(
    (idx: number) => {
      if (idx < resultados.length) {
        router.push(`/contenedores/${resultados[idx].operacion_id}`);
      } else {
        router.push(ACCIONES[idx - resultados.length].href);
      }
      cerrar();
    },
    [resultados, router, cerrar],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") cerrar();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(items - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter" && items > 0) {
      e.preventDefault();
      abrir(sel);
    }
  };

  if (!abierta) return null;

  return (
    <div
      onClick={cerrar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(4,5,7,0.55)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        role="dialog"
        aria-label="búsqueda global"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        style={{
          width: "min(640px, calc(100vw - 24px))",
          margin: "72px auto 0",
          background: "var(--surface-1)",
          border: "1px solid var(--border-strong)",
          borderRadius: 14,
          boxShadow: "var(--shadow-palette)",
          overflow: "hidden",
          animation: "fd-palette-in 200ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <i className="ti ti-search" aria-hidden style={{ color: "var(--text-muted)", fontSize: 16 }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="buscar contenedor abierto… (MSKU, TCNU, …)"
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: 14,
              padding: 0,
              boxShadow: "none",
            }}
          />
          <kbd
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--text-muted)",
              border: "1px solid var(--border-strong)",
              borderRadius: 4,
              padding: "2px 6px",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* grupo contenedores */}
        {(resultados.length > 0 || buscando || q.trim()) && (
          <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <div className="fd-label" style={{ padding: "4px 16px 6px" }}>
              Contenedores
            </div>
            {buscando && (
              <div style={{ padding: "8px 16px", fontSize: 12.5, color: "var(--text-muted)" }}>buscando…</div>
            )}
            {!buscando && q.trim() && resultados.length === 0 && (
              <div style={{ padding: "8px 16px", fontSize: 12.5, color: "var(--text-muted)" }}>
                sin operaciones abiertas para “{q.trim()}” — las cerradas están en Historial
              </div>
            )}
            {resultados.map((r, i) => (
              <button
                key={r.operacion_id}
                type="button"
                onClick={() => abrir(i)}
                onMouseEnter={() => setSel(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 16px",
                  border: "none",
                  borderLeft: sel === i ? "2px solid var(--text-accent)" : "2px solid transparent",
                  borderRadius: 0,
                  background: sel === i ? "var(--surface-3)" : "transparent",
                  fontSize: 12.5,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: DOT[r.estado_semaforo] ?? DOT.neutro,
                    boxShadow: r.estado_semaforo === "rojo" ? "var(--shadow-glow-red-soft)" : undefined,
                  }}
                />
                <ContainerNumber value={r.numero_contenedor} />
                <span style={{ color: "var(--text-muted)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.naviera} · {r.planta_actual ?? "—"} · {ESTADO_LABELS[r.estado] ?? r.estado}
                  {r.dias_restantes != null && ` · ${r.dias_restantes} d restantes`}
                </span>
                {sel === i && (
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", flexShrink: 0 }}>
                    ↵ abrir
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* grupo acciones */}
        <div style={{ padding: "8px 0" }}>
          <div className="fd-label" style={{ padding: "4px 16px 6px" }}>
            Acciones
          </div>
          {ACCIONES.map((a, j) => {
            const i = resultados.length + j;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => abrir(i)}
                onMouseEnter={() => setSel(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 16px",
                  border: "none",
                  borderLeft: sel === i ? "2px solid var(--text-accent)" : "2px solid transparent",
                  borderRadius: 0,
                  background: sel === i ? "var(--surface-3)" : "transparent",
                  fontSize: 12.5,
                }}
              >
                <i className={`ti ${a.icon}`} aria-hidden style={{ color: "var(--text-muted)", fontSize: 15 }} />
                <span style={{ flex: 1 }}>{a.label}</span>
                <kbd
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: 4,
                    padding: "1px 6px",
                  }}
                >
                  {a.kbd}
                </kbd>
              </button>
            );
          })}
        </div>

        {/* footer hints */}
        <div
          style={{
            display: "flex",
            gap: 14,
            padding: "8px 16px",
            borderTop: "1px solid var(--border)",
            fontSize: 10.5,
            color: "var(--text-muted)",
          }}
        >
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>esc cerrar</span>
        </div>
      </div>
    </div>
  );
}
