"use client";

// Badge/Chip tonal (spec 2f: texto pleno, bg 8-10%, border 30-35%) + chip de filtro
// removible (planilla 2b: filtros activos cyan con ×).

export type BadgeTone = "accent" | "verde" | "amarillo" | "rojo" | "neutro";

const TONOS: Record<BadgeTone, { color: string; bg: string; border: string }> = {
  accent: { color: "var(--color-accent-500)", bg: "var(--color-accent-tint)", border: "var(--color-accent-line)" },
  verde: { color: "var(--color-status-green)", bg: "var(--color-green-tint)", border: "var(--color-green-line)" },
  amarillo: { color: "var(--color-status-amber)", bg: "var(--color-amber-tint)", border: "var(--color-amber-line)" },
  rojo: { color: "var(--color-status-red)", bg: "var(--color-red-tint)", border: "var(--color-red-line)" },
  neutro: { color: "var(--color-text-secondary)", bg: "var(--color-surface-1)", border: "var(--color-border-strong)" },
};

export function Badge({
  tone = "neutro",
  icon,
  mono = false,
  children,
  className = "",
}: {
  tone?: BadgeTone;
  icon?: string;
  /** Números/counts en JetBrains Mono tabular. */
  mono?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const t = TONOS[tone];
  return (
    <span
      className={`${mono ? "mono " : ""}${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: "var(--radius-chip)",
        fontSize: 11.5,
        color: t.color,
        background: t.bg,
        border: `1px solid ${t.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {icon && <i className={`ti ${icon}`} aria-hidden style={{ fontSize: 13 }} />}
      {children}
    </span>
  );
}

/** Chip de filtro activo removible (cyan). El × quita el filtro. */
export function FilterChip({
  label,
  onRemove,
  className = "",
}: {
  label: React.ReactNode;
  onRemove: () => void;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 5px 3px 9px",
        borderRadius: "var(--radius-chip)",
        fontSize: 11.5,
        color: "var(--color-accent-500)",
        background: "var(--color-accent-tint)",
        border: "1px solid var(--color-accent-line)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      <button
        type="button"
        aria-label="quitar filtro"
        onClick={onRemove}
        className="hover:[background:rgba(34,211,238,0.18)!important]"
        style={{
          minHeight: 0,
          width: 16,
          height: 16,
          padding: 0,
          border: "none",
          borderRadius: 4,
          background: "transparent",
          color: "inherit",
          display: "inline-grid",
          placeItems: "center",
          fontSize: 12,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </span>
  );
}
