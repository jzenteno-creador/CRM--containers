"use client";

// StatusBadge (spec artboard 2f): chip tonal — texto color pleno, bg 8-10%, border 30-35%.
// Mapea estado_semaforo del modelo (verde|amarillo|rojo) + neutro (cerrado / sin cargo).
// SOLO el rojo lleva dot pulsante (2s) + glow.

type EstadoSemaforo = "verde" | "amarillo" | "rojo" | "neutro";

/** Conversión única semáforo → color de token (la usan también RadialTimer y los meters). */
export function semaforoAColor(estado: EstadoSemaforo): "green" | "amber" | "red" {
  if (estado === "rojo") return "red";
  if (estado === "amarillo") return "amber";
  return "green";
}

const ESTILOS: Record<EstadoSemaforo, { color: string; bg: string; border: string }> = {
  verde: { color: "var(--text-success)", bg: "var(--bg-success)", border: "var(--border-success)" },
  amarillo: { color: "var(--text-warning)", bg: "var(--bg-warning)", border: "var(--border-warning)" },
  rojo: { color: "var(--text-danger)", bg: "var(--bg-danger)", border: "var(--border-danger)" },
  neutro: { color: "var(--text-muted)", bg: "var(--surface-1)", border: "var(--border-strong)" },
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
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
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
            background: "var(--text-danger)",
            boxShadow: "var(--shadow-glow-red-soft)",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
