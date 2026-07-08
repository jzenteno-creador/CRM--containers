"use client";

// Toast system (design system M0): provider + useToast; éxito/error/info; auto-dismiss
// (error dura más); apilable abajo a la derecha. Cubre feedback transitorio de
// mutaciones — los errores de página/panel van con <ErrorState>.

import { createContext, useCallback, useContext, useRef, useState } from "react";

export type ToastTipo = "exito" | "error" | "info";

type ToastItem = {
  id: number;
  tipo: ToastTipo;
  titulo: string;
  detalle?: string;
};

type ToastFn = (t: { tipo: ToastTipo; titulo: string; detalle?: string }) => void;

const ToastContext = createContext<ToastFn | null>(null);

export function useToast(): ToastFn {
  const fn = useContext(ToastContext);
  if (!fn) {
    throw new Error("useToast requiere <ToastProvider> en el árbol (lo monta el layout del shell).");
  }
  return fn;
}

const UI: Record<ToastTipo, { icon: string; color: string; border: string }> = {
  exito: { icon: "ti-circle-check", color: "var(--color-status-green)", border: "var(--color-green-line)" },
  error: { icon: "ti-alert-circle", color: "var(--color-status-red)", border: "var(--color-red-line)" },
  info: { icon: "ti-info-circle", color: "var(--color-accent-500)", border: "var(--color-accent-line)" },
};

const DURACION: Record<ToastTipo, number> = { exito: 4200, info: 4200, error: 6500 };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const quitar = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback<ToastFn>(
    ({ tipo, titulo, detalle }) => {
      const id = nextId.current++;
      setItems((xs) => [...xs, { id, tipo, titulo, detalle }]);
      window.setTimeout(() => quitar(id), DURACION[tipo]);
    },
    [quitar],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* stack apilable */}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 120,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: "min(360px, calc(100vw - 32px))",
        }}
      >
        {items.map((t) => {
          const ui = UI[t.tipo];
          return (
            <div
              key={t.id}
              role="status"
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                padding: "10px 12px",
                background: "var(--color-surface-1)",
                border: "1px solid var(--color-border-strong)",
                borderLeft: `2px solid ${ui.color}`,
                borderRadius: "var(--radius-input)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                animation: "fd-toast-in 200ms var(--ease-out-expo)",
              }}
            >
              <i className={`ti ${ui.icon}`} aria-hidden style={{ color: ui.color, fontSize: 16, marginTop: 1 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-text-primary)" }}>{t.titulo}</div>
                {t.detalle && (
                  <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginTop: 2 }}>{t.detalle}</div>
                )}
              </div>
              <button
                type="button"
                aria-label="cerrar aviso"
                onClick={() => quitar(t.id)}
                style={{
                  minHeight: 0,
                  marginLeft: "auto",
                  width: 20,
                  height: 20,
                  padding: 0,
                  display: "inline-grid",
                  placeItems: "center",
                  border: "none",
                  background: "transparent",
                  color: "var(--color-text-faint)",
                  fontSize: 13,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                <i className="ti ti-x" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
