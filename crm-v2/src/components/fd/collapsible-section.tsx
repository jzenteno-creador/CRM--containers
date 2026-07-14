"use client";

// CollapsibleSection (design system — nuevo en M5 B2/Importación): cabecera clickeable
// (chevron + ícono + título + contador) que colapsa/expande su contenido. Pensado para
// pantallas con varios grupos de pendientes (ej. Importación §6.4: 4 grupos por estado)
// que de otro modo saturan la pantalla — "colapsable si la página queda larga" (§ del
// brief de Importación). Motion: solo el chevron rota (150ms fast, ease-out-expo); el
// contenido no anima al expandir/colapsar (suele ser una <DataTable> con su propio
// shimmer/stagger — animar dos veces sería ruido, no señal, contra §8 "motion solo si
// cambió un dato o una vista").
// Uncontrolled: el estado abierto/cerrado vive en el propio componente (defaultOpen fija
// el arranque). Si un consumidor futuro necesita controlarlo desde afuera, se agrega
// open/onToggle sin romper este contrato (defaultOpen sigue funcionando sin ellos).

import { useState } from "react";

export function CollapsibleSection({
  title,
  icon,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon?: string;
  /** Contador junto al título (mono, sutil) — null/undefined lo oculta. */
  count?: number | null;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 18 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="hover:[color:var(--color-text-primary)!important]"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "6px 2px",
          minHeight: 0,
          border: "none",
          background: "transparent",
          textAlign: "left",
          cursor: "pointer",
          color: "var(--color-text-secondary)",
        }}
      >
        <i
          className="ti ti-chevron-right"
          aria-hidden
          style={{
            fontSize: 14,
            color: "var(--color-text-faint)",
            transition: "transform 150ms var(--ease-out-expo)",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        />
        {icon && <i className={`ti ${icon}`} aria-hidden style={{ color: "var(--color-accent-500)", fontSize: 15 }} />}
        <span className="fd-display fd-display-sm" style={{ color: "inherit" }}>
          {title}
        </span>
        {count != null && (
          <span className="mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            {count}
          </span>
        )}
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}
