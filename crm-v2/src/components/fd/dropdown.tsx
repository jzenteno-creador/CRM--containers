"use client";

// Dropdown / Popover + Tooltip (design system M0 — menú de usuario del shell, filtros
// M5, campana M6). Posicionamiento relativo al trigger, cierre por ESC y click-fuera,
// apertura 200ms out-expo. El tooltip del rail es CSS puro (.fd-tip); este Tooltip
// cubre el resto de la UI.

import { useEffect, useId, useRef, useState } from "react";

export type DropdownItem = {
  id: string;
  label: React.ReactNode;
  icon?: string;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Separador visual arriba del ítem. */
  divider?: boolean;
};

/** Popover genérico: trigger + panel posicionado; children libres. */
export function Popover({
  trigger,
  align = "right",
  width = 220,
  children,
  open: openProp,
  onOpenChange,
  panelClassName = "",
}: {
  trigger: (props: { open: boolean; toggle: () => void; "aria-expanded": boolean; "aria-controls": string }) => React.ReactNode;
  align?: "left" | "right";
  width?: number | string;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  panelClassName?: string;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };
  const rootRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <span ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      {trigger({ open, toggle: () => setOpen(!open), "aria-expanded": open, "aria-controls": panelId })}
      {open && (
        <div
          id={panelId}
          className={panelClassName}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            [align]: 0,
            zIndex: 90,
            minWidth: width,
            background: "var(--color-surface-1)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "var(--radius-input)",
            boxShadow: "var(--shadow-palette)",
            animation: "fd-palette-in 200ms var(--ease-out-expo)",
            overflow: "hidden",
          }}
        >
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </span>
  );
}

/** Dropdown de menú: lista de ítems accionables (menú de usuario, acciones de fila). */
export function Dropdown({
  trigger,
  items,
  align = "right",
  width = 200,
  header,
}: {
  trigger: (props: { open: boolean; toggle: () => void; "aria-expanded": boolean; "aria-controls": string }) => React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  width?: number;
  /** Bloque fijo arriba de los ítems (ej: nombre + rol del usuario). */
  header?: React.ReactNode;
}) {
  return (
    <Popover trigger={trigger} align={align} width={width}>
      {(close) => (
        <div role="menu" style={{ padding: "6px 0" }}>
          {header && (
            <div style={{ padding: "8px 14px 10px", borderBottom: "1px solid var(--color-border-subtle)", marginBottom: 6 }}>
              {header}
            </div>
          )}
          {items.map((it) => (
            <div key={it.id}>
              {it.divider && (
                <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "6px 0" }} />
              )}
              <button
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  close();
                  it.onSelect?.();
                }}
                className="hover:[background:var(--color-surface-2)!important]"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  width: "100%",
                  minHeight: 0,
                  textAlign: "left",
                  padding: "8px 14px",
                  border: "none",
                  borderRadius: 0,
                  background: "transparent",
                  fontSize: 12.5,
                  color: it.danger ? "var(--color-status-red)" : "var(--color-text-secondary)",
                }}
              >
                {it.icon && <i className={`ti ${it.icon}`} aria-hidden style={{ fontSize: 15, flexShrink: 0 }} />}
                {it.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </Popover>
  );
}

/** Tooltip liviano por hover/focus. */
export function Tooltip({
  label,
  side = "top",
  children,
}: {
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const pos: React.CSSProperties =
    side === "top"
      ? { bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" }
      : side === "bottom"
        ? { top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" }
        : side === "left"
          ? { right: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" }
          : { left: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" };
  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            ...pos,
            zIndex: 95,
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "var(--radius-chip)",
            padding: "4px 9px",
            fontSize: 11.5,
            color: "var(--color-text-primary)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            animation: "fd-palette-in 150ms var(--ease-out-expo)",
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
