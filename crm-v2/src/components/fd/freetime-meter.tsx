"use client";

// ProgressBar / FreetimeMeter (design system M0 — consumen M6 alertas y M7 flota).
// Componente con estilos propios encapsulados — namespace React, CERO clases globales
// genéricas (lección v1 2026-07-03: el fill con clase `ok` colisionó con el banner
// global .ok y quedó invisible en prod). El fill va en flujo normal, NUNCA absoluto
// (dentro de celdas de tabla el absoluto se corría fuera del track).

export type MeterTone = "ok" | "warn" | "over" | "neutro";

const FILL: Record<MeterTone, string> = {
  ok: "var(--color-status-green)",
  warn: "var(--color-status-amber)",
  over: "var(--color-status-red)",
  neutro: "var(--color-text-muted)",
};

export function ProgressBar({
  pct,
  tone = "ok",
  height = 7,
  minWidth = 64,
  className = "",
  ariaLabel,
}: {
  pct: number;
  tone?: MeterTone;
  height?: number;
  minWidth?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <span
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className={className}
      style={{
        display: "block",
        height,
        minWidth,
        background: "var(--color-bg-base)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "block",
          height,
          width: `${clamped}%`,
          margin: 0,
          padding: 0,
          borderRadius: 4,
          background: FILL[tone],
          transition: "width 250ms var(--ease-out-expo), background 250ms var(--ease-out-expo)",
        }}
      />
    </span>
  );
}

/** Semáforo del modelo → tono del meter. */
export function semaforoToTone(estado: "verde" | "amarillo" | "rojo" | "neutro"): MeterTone {
  if (estado === "rojo") return "over";
  if (estado === "amarillo") return "warn";
  if (estado === "neutro") return "neutro";
  return "ok";
}

/** Medidor de freetime consumido: barra + label mono "usados/libres d" opcional. */
export function FreetimeMeter({
  diasUsados,
  diasLibres,
  showLabel = false,
  className = "",
}: {
  diasUsados: number;
  /** null = naviera sin freetime vigente → tono neutro (Decisión 7). */
  diasLibres: number | null;
  showLabel?: boolean;
  className?: string;
}) {
  const noTariff = diasLibres == null || diasLibres <= 0;
  const pct = noTariff ? 100 : (diasUsados / diasLibres) * 100;
  const tone: MeterTone = noTariff ? "neutro" : pct >= 100 ? "over" : pct >= 70 ? "warn" : "ok";
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <ProgressBar
        pct={noTariff ? 100 : pct}
        tone={tone}
        ariaLabel={noTariff ? "sin freetime vigente" : `${diasUsados} de ${diasLibres} días de freetime`}
        className="grow"
      />
      {showLabel && (
        <span className="mono" style={{ fontSize: 11, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
          {noTariff ? "s/tarifa" : `${diasUsados}/${diasLibres} d`}
        </span>
      )}
    </span>
  );
}
