"use client";

// HelpPanel (§15.1): panel lateral del "?" contextual por solapa — qué es la solapa,
// qué completa cada campo, flujo en 3-5 pasos. El contenido llega de `ayuda_contenido`
// (M10); en M0 el shell lo abre con contenido placeholder.

import { useEffect } from "react";

export function HelpPanel({
  open,
  onClose,
  titulo,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  /** Nombre de la solapa (ej: "INGRESO"). */
  titulo: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(4,5,7,0.35)" }}
    >
      <aside
        role="dialog"
        aria-label={`ayuda: ${titulo}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(380px, 100vw)",
          background: "var(--color-surface-1)",
          borderLeft: "1px solid var(--color-border-strong)",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          animation: "fd-panel-in 200ms var(--ease-out-expo)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "14px 18px",
            borderBottom: "1px solid var(--color-border-subtle)",
            flexShrink: 0,
          }}
        >
          <i className="ti ti-help-circle" aria-hidden style={{ color: "var(--color-accent-500)", fontSize: 17 }} />
          <span className="fd-display fd-display-sm" style={{ color: "var(--color-text-secondary)" }}>
            Ayuda · {titulo}
          </span>
          <button
            type="button"
            aria-label="cerrar ayuda"
            onClick={onClose}
            style={{
              minHeight: 0,
              marginLeft: "auto",
              width: 26,
              height: 26,
              padding: 0,
              display: "inline-grid",
              placeItems: "center",
              border: "none",
              background: "transparent",
              color: "var(--color-text-muted)",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            <i className="ti ti-x" aria-hidden />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: "12px 18px",
              borderTop: "1px solid var(--color-border-subtle)",
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}
