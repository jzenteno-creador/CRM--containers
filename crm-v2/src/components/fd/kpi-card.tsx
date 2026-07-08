"use client";

// KpiCard (spec artboard 2a/2f): label micro uppercase → valor mono 42px tabular con
// count-up → sub-label. Variante crítica tiñe el valor #FF8A83 + gradiente rojo 5%.

import { useCountUp } from "./use-count-up";

type Props = {
  label: string;
  value: number;
  sub?: string;
  critical?: boolean;
  amber?: boolean;
  prefix?: string;
  suffix?: string;
};

export function KpiCard({ label, value, sub, critical = false, amber = false, prefix, suffix }: Props) {
  const animated = useCountUp(value);
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
      }}
    >
      <div className="fd-label">{label}</div>
      <div
        className="mono"
        style={{
          fontSize: "clamp(26px, 3vw, 42px)",
          fontWeight: critical ? 700 : 600,
          color,
          lineHeight: 1.15,
          marginTop: 6,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {prefix}
        {animated.toLocaleString("es-AR")}
        {suffix}
      </div>
      {sub && (
        <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}
