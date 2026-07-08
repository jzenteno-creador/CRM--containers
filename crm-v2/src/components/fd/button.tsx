"use client";

// Button (design system M0): primario cyan (texto ink oscuro), ghost, danger.
// `loading` = spinner interno + disabled → doble-submit imposible por construcción.

type Variant = "primary" | "ghost" | "danger";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  /** Clase de ícono Tabler opcional, ej "ti-plus". */
  icon?: string;
};

const BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  fontWeight: 600,
  whiteSpace: "nowrap",
  transition:
    "background 150ms var(--ease-out-expo), border-color 150ms var(--ease-out-expo), color 150ms var(--ease-out-expo)",
};

const VARIANTS: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "var(--color-accent-500)",
    color: "var(--color-accent-ink)",
    borderColor: "transparent",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-text-secondary)",
    borderColor: "var(--color-border-strong)",
  },
  danger: {
    background: "var(--color-red-tint)",
    color: "var(--color-status-red)",
    borderColor: "var(--color-red-line)",
  },
};

// hover por clase (las utilidades de Tailwind ganan sobre el button:hover global)
const HOVER: Record<Variant, string> = {
  primary: "hover:[background:var(--color-accent-hover)!important]",
  ghost: "hover:[background:var(--color-surface-2)!important] hover:[color:var(--color-text-primary)!important]",
  danger: "hover:[background:rgba(248,81,73,0.16)!important]",
};

export function Button({
  variant = "ghost",
  loading = false,
  icon,
  disabled,
  children,
  className = "",
  style,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${HOVER[variant]} ${className}`}
      style={{ ...BASE, ...VARIANTS[variant], ...style }}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          style={{
            width: 12,
            height: 12,
            flexShrink: 0,
            borderRadius: "50%",
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            animation: "fd-spin 700ms linear infinite",
          }}
        />
      ) : (
        icon && <i className={`ti ${icon}`} aria-hidden style={{ fontSize: 15 }} />
      )}
      {children}
    </button>
  );
}
