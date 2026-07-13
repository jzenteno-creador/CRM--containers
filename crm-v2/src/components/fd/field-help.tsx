"use client";

// FieldHelp (M4 B3-B): ícono "?" chico junto al label de un campo. On-hover / on-focus
// abre un panel flotante con el copy del tooltip (nivel='campo' de crm.ayuda_contenido),
// interpolado con crm_ayuda_valores(naviera) y renderizado con <Markdown>.
//
// - Los NÚMEROS de negocio NUNCA se hardcodean: salen del RPC vía interpolarAyuda.
// - Degradación (024 sin aplicar / RPC caída / sin copy publicado para la clave):
//   el componente NO renderiza nada. Nunca crashea.
// - Lecturas cacheadas a nivel módulo: el copy se deduplica por clave y los valores por
//   naviera, así una pantalla con muchos FieldHelp dispara pocas llamadas reales.
// - Accesible: panel con role="tooltip" + id (useId); el botón lo referencia con
//   aria-describedby mientras está abierto (el botón es el elemento focusable que
//   FieldHelp posee — está desacoplado del input del formulario, que solo le pasa la
//   clave y la naviera). Cierra on-blur / mouse-leave / Escape.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { interpolarAyuda, type AyudaValores } from "@/lib/ayuda";
import { Markdown } from "./markdown";

type CopyRow = { titulo: string; contenido_md: string };

// ---- caches a nivel módulo (deduplican la red entre instancias) ----
const copyCache = new Map<string, Promise<CopyRow | null>>();
const valoresCache = new Map<string, Promise<AyudaValores | null>>();

function fetchCopy(clave: string): Promise<CopyRow | null> {
  let p = copyCache.get(clave);
  if (!p) {
    p = (async () => {
      try {
        const { data, error } = await getSupabase()
          .from("ayuda_contenido")
          .select("titulo, contenido_md")
          .eq("nivel", "campo")
          .eq("clave", clave)
          .eq("publicado", true)
          .maybeSingle();
        if (error) return null;
        return (data as CopyRow | null) ?? null;
      } catch {
        return null; // 024 sin aplicar / red: degrada a "sin tooltip"
      }
    })();
    copyCache.set(clave, p);
  }
  return p;
}

function fetchValores(naviera?: string): Promise<AyudaValores | null> {
  const key = naviera ?? "";
  let p = valoresCache.get(key);
  if (!p) {
    p = (async () => {
      try {
        const args = naviera ? { p_naviera: naviera } : {};
        const { data, error } = await getSupabase().rpc("crm_ayuda_valores", args);
        if (error) return null;
        return (data as AyudaValores | null) ?? null;
      } catch {
        return null;
      }
    })();
    valoresCache.set(key, p);
  }
  return p;
}

export function FieldHelp({ fieldKey, naviera }: { fieldKey: string; naviera?: string }) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);

  // undefined = cargando · null = sin copy (no renderiza) · objeto = poblado
  const [copy, setCopy] = useState<CopyRow | null | undefined>(undefined);
  const [valores, setValores] = useState<AyudaValores | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  // lecturas en paralelo, cacheadas. setState siempre después del await.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [c, v] = await Promise.all([fetchCopy(fieldKey), fetchValores(naviera)]);
      if (!alive) return;
      setCopy(c);
      setValores(v);
    })();
    return () => {
      alive = false;
    };
  }, [fieldKey, naviera]);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    // pequeño delay: permite mover el mouse del ícono al panel sin que se cierre
    closeTimer.current = window.setTimeout(() => setOpen(false), 110);
  }, [cancelClose]);

  const openHelp = useCallback(() => {
    cancelClose();
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const PANEL_W = 320;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - PANEL_W - 8));
    const top = r.bottom + 6;
    setCoords({ top, left, maxHeight: Math.max(120, window.innerHeight - top - 12) });
    setOpen(true);
  }, [cancelClose]);

  // Escape + cerrar al hacer scroll/resize (el panel es fixed: evita que quede colgado)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScrollResize = () => setOpen(false);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [open]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  // sin copy publicado (o 024 sin aplicar / RPC caída) → no se muestra nada
  if (copy === undefined || copy === null) return null;

  const texto = interpolarAyuda(copy.contenido_md, valores);

  return (
    <span style={{ display: "inline-flex", lineHeight: 0 }} onMouseEnter={openHelp} onMouseLeave={scheduleClose}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Ayuda: ${copy.titulo}`}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onFocus={openHelp}
        onBlur={scheduleClose}
        onClick={() => (open ? setOpen(false) : openHelp())}
        className="hover:[color:var(--color-accent-500)!important]"
        style={{
          minHeight: 0,
          width: 16,
          height: 16,
          padding: 0,
          display: "inline-grid",
          placeItems: "center",
          border: "none",
          background: "transparent",
          color: "var(--color-text-faint)",
          cursor: "help",
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        <i className="ti ti-help-circle" aria-hidden />
      </button>

      {open && coords && (
        <div
          id={tooltipId}
          role="tooltip"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{
            position: "fixed",
            top: coords.top,
            left: coords.left,
            zIndex: 120,
            width: "min(320px, calc(100vw - 16px))",
            maxHeight: coords.maxHeight,
            overflowY: "auto",
            whiteSpace: "normal",
            background: "var(--color-surface-1)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "var(--radius-input, 9px)",
            boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
            padding: "11px 13px",
            animation: "fd-panel-in 140ms var(--ease-out-expo)",
          }}
        >
          <div
            className="fd-display fd-display-sm"
            style={{ color: "var(--color-text-secondary)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}
          >
            <i className="ti ti-help-circle" aria-hidden style={{ color: "var(--color-accent-500)", fontSize: 14 }} />
            {copy.titulo}
          </div>
          <Markdown source={texto} />
        </div>
      )}
    </span>
  );
}
