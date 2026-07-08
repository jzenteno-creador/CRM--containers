"use client";

// Command palette ⌘K (spec artboard 2e): modal 640px top 72px, apertura scale(.98)→1
// + fade 200ms out-expo. ↑↓ navega, ↵ abre, ESC cierra. Se abre con ⌘K/Ctrl+K o el
// evento window "fd-palette" (botón del header).
// M0 = shell SIN datasource: la búsqueda se inyecta por prop `search` (la conectan
// M5/M6 contra vista_alertas + operaciones cerradas); sin prop muestra solo Acciones.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ContainerNumber } from "@/components/container-number";
import { Kbd } from "./kbd";
import type { EstadoSemaforo } from "./status-badge";

const MAX_SEL_RESET = 0;

export type PaletteResult = {
  id: string;
  /** Encabezado del grupo (ej: "Contenedores", "Cerradas"). */
  group: string;
  /** Si viene, se renderiza con <ContainerNumber>. */
  numeroContenedor?: string;
  title?: string;
  /** Metadata secundaria: "MAERSK · BAHIA · en planta · 3 d restantes". */
  meta?: string;
  semaforo?: EstadoSemaforo;
  href: string;
};

export type PaletteAction = { id: string; label: string; icon: string; href: string; kbd?: string };

const DEFAULT_ACTIONS: PaletteAction[] = [
  { id: "ingreso", label: "Registrar tanda de retiro", icon: "ti-login-2", href: "/ingreso", kbd: "I" },
  { id: "egreso", label: "Registrar egreso / devolución", icon: "ti-logout-2", href: "/egreso", kbd: "E" },
  { id: "alertas", label: "Ver alertas de freetime", icon: "ti-bell", href: "/alertas", kbd: "A" },
];

const DOT: Record<EstadoSemaforo, string> = {
  verde: "var(--color-status-green)",
  amarillo: "var(--color-status-amber)",
  rojo: "var(--color-status-red)",
  neutro: "var(--color-text-muted)",
};

export function CommandPalette({
  search,
  actions = DEFAULT_ACTIONS,
}: {
  /** Datasource inyectado (M5/M6). Sin él, la palette ofrece solo acciones. */
  search?: (term: string) => Promise<PaletteResult[]>;
  actions?: PaletteAction[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PaletteResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sel, setSel] = useState(MAX_SEL_RESET);
  const inputRef = useRef<HTMLInputElement>(null);

  // apertura: ⌘K / Ctrl+K global + evento fd-palette (botón del header)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    const onEvent = () => setIsOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("fd-palette", onEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("fd-palette", onEvent);
    };
  }, []);

  // el reset se hace al CERRAR, así abrir siempre encuentra estado limpio y el
  // effect solo sincroniza con el DOM (focus) — regla react-hooks/set-state-in-effect
  const close = useCallback(() => {
    setIsOpen(false);
    setQ("");
    setResults([]);
    setSel(MAX_SEL_RESET);
    setSearching(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // búsqueda debounced 250ms sobre el datasource inyectado
  useEffect(() => {
    if (!isOpen || !search) return;
    const term = q.trim().replace(/[,()]/g, " ").trim();
    const t = setTimeout(async () => {
      if (!term) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const rs = await search(term);
        setResults(rs);
      } catch {
        setResults([]);
      }
      setSel(0);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, isOpen, search]);

  const items = results.length + actions.length;

  const openItem = useCallback(
    (idx: number) => {
      const href = idx < results.length ? results[idx].href : actions[idx - results.length].href;
      router.push(href);
      close();
    },
    [results, actions, router, close],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(items - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter" && items > 0) {
      e.preventDefault();
      openItem(sel);
    }
  };

  if (!isOpen) return null;

  // agrupa resultados preservando el orden de aparición
  const groups: { name: string; fromIndex: number; items: PaletteResult[] }[] = [];
  results.forEach((r, i) => {
    const g = groups.find((x) => x.name === r.group);
    if (g) g.items.push(r);
    else groups.push({ name: r.group, fromIndex: i, items: [r] });
  });

  const rowStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    minHeight: 0,
    textAlign: "left",
    padding: "9px 16px",
    border: "none",
    borderLeft: active ? "2px solid var(--color-accent-500)" : "2px solid transparent",
    borderRadius: 0,
    background: active ? "var(--color-surface-selected)" : "transparent",
    fontSize: 12.5,
    color: "var(--color-text-secondary)",
  });

  return (
    <div
      onClick={close}
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
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "var(--radius-palette)",
          boxShadow: "var(--shadow-palette)",
          overflow: "hidden",
          animation: "fd-palette-in 200ms var(--ease-out-expo)",
        }}
      >
        {/* input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          <i className="ti ti-search" aria-hidden style={{ color: "var(--color-text-muted)", fontSize: 16 }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="buscar contenedor… (MSKU, TCNU, …)"
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: 14,
              padding: 0,
              boxShadow: "none",
            }}
          />
          <Kbd>ESC</Kbd>
        </div>

        {/* resultados agrupados */}
        {search ? (
          (groups.length > 0 || searching || q.trim()) && (
            <div style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
              {searching && (
                <div style={{ padding: "10px 16px", fontSize: 12.5, color: "var(--color-text-muted)" }}>buscando…</div>
              )}
              {!searching && q.trim() && results.length === 0 && (
                <div style={{ padding: "10px 16px", fontSize: 12.5, color: "var(--color-text-muted)" }}>
                  sin resultados para “{q.trim()}”
                </div>
              )}
              {groups.map((g) => (
                <div key={g.name} style={{ padding: "8px 0" }}>
                  <div className="fd-label" style={{ padding: "4px 16px 6px" }}>
                    {g.name}
                  </div>
                  {g.items.map((r, j) => {
                    const i = g.fromIndex + j;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => openItem(i)}
                        onMouseEnter={() => setSel(i)}
                        style={rowStyle(sel === i)}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            flexShrink: 0,
                            background: DOT[r.semaforo ?? "neutro"],
                            boxShadow: r.semaforo === "rojo" ? "var(--shadow-glow-red-soft)" : undefined,
                          }}
                        />
                        {r.numeroContenedor ? (
                          <ContainerNumber value={r.numeroContenedor} />
                        ) : (
                          <span style={{ color: "var(--color-text-primary)" }}>{r.title}</span>
                        )}
                        {r.meta && (
                          <span
                            style={{
                              color: "var(--color-text-muted)",
                              flex: 1,
                              minWidth: 0,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {r.meta}
                          </span>
                        )}
                        {sel === i && (
                          <span className="mono" style={{ fontSize: 10.5, color: "var(--color-text-muted)", flexShrink: 0, marginLeft: "auto" }}>
                            ↵ abrir
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )
        ) : (
          q.trim() !== "" && (
            <div
              style={{
                padding: "10px 16px",
                fontSize: 12,
                color: "var(--color-text-faint)",
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              la búsqueda de contenedores se conecta con el módulo de operaciones (M5)
            </div>
          )
        )}

        {/* grupo acciones */}
        <div style={{ padding: "8px 0" }}>
          <div className="fd-label" style={{ padding: "4px 16px 6px" }}>
            Acciones
          </div>
          {actions.map((a, j) => {
            const i = results.length + j;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => openItem(i)}
                onMouseEnter={() => setSel(i)}
                style={rowStyle(sel === i)}
              >
                <i className={`ti ${a.icon}`} aria-hidden style={{ color: "var(--color-text-muted)", fontSize: 15 }} />
                <span style={{ flex: 1 }}>{a.label}</span>
                {a.kbd && <Kbd>{a.kbd}</Kbd>}
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
            borderTop: "1px solid var(--color-border-subtle)",
            fontSize: 10.5,
            color: "var(--color-text-muted)",
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
