"use client";

// StatusBadge (spec artboard 2f): chip tonal — texto color pleno, bg 8-10%, border 30-35%.
// Mapea estado_semaforo del modelo (verde|amarillo|rojo) + neutro (cerrado / sin freetime
// vigente — Decisión 7). SOLO el rojo lleva dot pulsante (2s) + glow.

export type EstadoSemaforo = "verde" | "amarillo" | "rojo" | "neutro";

/** Conversión única semáforo → color de token (la usan también RadialTimer y los meters). */
export function semaforoAColor(estado: EstadoSemaforo): "green" | "amber" | "red" {
  if (estado === "rojo") return "red";
  if (estado === "amarillo") return "amber";
  return "green";
}

const ESTILOS: Record<EstadoSemaforo, { color: string; bg: string; border: string }> = {
  verde: { color: "var(--color-status-green)", bg: "var(--color-green-tint)", border: "var(--color-green-line)" },
  amarillo: { color: "var(--color-status-amber)", bg: "var(--color-amber-tint)", border: "var(--color-amber-line)" },
  rojo: { color: "var(--color-status-red)", bg: "var(--color-red-tint)", border: "var(--color-red-line)" },
  neutro: { color: "var(--color-text-muted)", bg: "var(--color-surface-1)", border: "var(--color-border-strong)" },
};

export function StatusBadge({
  estado,
  children,
  className = "",
}: {
  estado: EstadoSemaforo;
  children: React.ReactNode;
  className?: string;
}) {
  const s = ESTILOS[estado];
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: "var(--radius-chip)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
        transition: "color 250ms var(--ease-out-expo), background 250ms var(--ease-out-expo), border-color 250ms var(--ease-out-expo)",
      }}
    >
      {estado === "rojo" && (
        <i
          className="fd-dot-pulse"
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--color-status-red)",
            boxShadow: "var(--shadow-glow-red-soft)",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
