"use client";

// KpiCard (spec artboard 2a/2f): label micro uppercase → valor mono hasta 42px tabular
// con count-up → sub-label. Variante crítica tiñe el valor #FF8A83 + gradiente rojo 5%.
// El valor escala con el ancho de SU celda (container query, cqw) — no con el viewport:
// con `3vw` un valor largo ("USD 6.475") desbordaba la celda y pisaba a la card vecina
// en grillas densas (auditoría visual M8). 15cqw + piso 18px garantiza ~11 chars mono
// (0.6em/char) dentro del content-box de la celda para los minmax que usa el repo.

import { useCountUp } from "./use-count-up";

type Props = {
  label: string;
  value: number;
  sub?: string;
  critical?: boolean;
  amber?: boolean;
  prefix?: string;
  suffix?: string;
  /** Decimales fijos del valor (default 0 = entero, comportamiento histórico). */
  decimals?: number;
};

export function KpiCard({
  label,
  value,
  sub,
  critical = false,
  amber = false,
  prefix,
  suffix,
  decimals = 0,
}: Props) {
  const animated = useCountUp(value, 1300, decimals);
  const color = critical
    ? "var(--color-status-red-soft)"
    : amber
      ? "var(--color-status-amber)"
      : "var(--color-text-primary)";
  return (
    <div
      style={{
        padding: "14px 18px",
        background: critical
          ? "linear-gradient(180deg, rgba(248,81,73,0.05), transparent 70%)"
          : undefined,
        minWidth: 0,
        containerType: "inline-size",
      }}
    >
      <div className="fd-label">{label}</div>
      <div
        className="mono"
        style={{
          fontSize: "clamp(18px, 15cqw, 42px)",
          fontWeight: critical ? 700 : 600,
          color,
          lineHeight: 1.15,
          marginTop: 6,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {prefix}
        {animated.toLocaleString("es-AR", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
        {suffix}
      </div>
      {sub && (
        <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}
