"use client";

// Modal (spec 2e como referencia visual): radius 14, shadow palette, backdrop blur,
// focus trap, ESC cierra, apertura scale .98→1 200ms out-expo.
// ConfirmDialog encima de Modal para confirmaciones (anular, rechazar, etc.).

import { useCallback, useEffect, useRef } from "react";
import { Button } from "./button";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  width = 520,
  children,
  footer,
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // focus trap: entra al abrir, Tab cicla adentro, al cerrar vuelve al disparador
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      prevFocusRef.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      onClick={closeOnBackdrop ? onClose : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(4,5,7,0.55)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "72px 12px 24px",
        overflowY: "auto",
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        style={{
          width: `min(${width}px, 100%)`,
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "var(--radius-palette)",
          boxShadow: "var(--shadow-palette)",
          overflow: "hidden",
          animation: "fd-palette-in 200ms var(--ease-out-expo)",
          outline: "none",
        }}
      >
        {title && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "13px 18px",
              borderBottom: "1px solid var(--color-border-subtle)",
            }}
          >
            <span className="fd-display fd-display-sm" style={{ color: "var(--color-text-secondary)" }}>
              {title}
            </span>
            <button
              type="button"
              aria-label="cerrar"
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
        )}
        <div style={{ padding: "16px 18px" }}>{children}</div>
        {footer && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              padding: "12px 18px",
              borderTop: "1px solid var(--color-border-subtle)",
              background: "var(--color-surface-2)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Confirmación con UNA acción primaria (o danger). `loading` bloquea doble-submit. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: React.ReactNode;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onCancel}
      title={title}
      width={440}
      closeOnBackdrop={!loading}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>{message}</div>
    </Modal>
  );
}
