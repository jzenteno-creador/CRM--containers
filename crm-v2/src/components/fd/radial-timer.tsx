"use client";

// RadialTimer (spec artboard 2f): SVG 36x36, r=15.9155 (circunferencia 100),
// stroke-dasharray "pct 100-pct", rotate(-90). Anima el dasharray al montar
// (800ms out-expo). Rojo al 100%: sin linecap + drop-shadow glow.

import { useEffect, useState } from "react";

const STROKE = { green: "#34D399", amber: "#F0B849", red: "#F85149" } as const;

type Props = {
  pct: number;
  color: keyof typeof STROKE;
  size?: number;
  label?: string;
  sublabel?: string;
  className?: string;
};

export function RadialTimer({ pct, color, size = 44, label, sublabel, className }: Props) {
  const clamped = Math.max(0, Math.min(100, pct));
  const [dash, setDash] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDash(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);
  const critical = color === "red" && clamped >= 100;
  return (
    <svg
      viewBox="0 0 36 36"
      width={size}
      height={size}
      role="img"
      aria-label={label ?? `${Math.round(clamped)}%`}
      className={className}
      style={critical ? { filter: "drop-shadow(0 0 4px rgba(248,81,73,0.5))" } : undefined}
    >
      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--color-border-strong)" strokeWidth="3" />
      <circle
        cx="18"
        cy="18"
        r="15.9155"
        fill="none"
        stroke={STROKE[color]}
        strokeWidth="3"
        strokeDasharray={`${dash} ${100 - dash}`}
        strokeLinecap={critical ? "butt" : "round"}
        transform="rotate(-90 18 18)"
        style={{ transition: "stroke-dasharray 800ms cubic-bezier(0.16,1,0.3,1)" }}
      />
      {label && (
        <text
          x="18"
          y={sublabel ? "16.5" : "20.5"}
          textAnchor="middle"
          style={{
            fill: "var(--color-text-primary)",
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            fontSize: "7.5px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {label}
        </text>
      )}
      {sublabel && (
        <text
          x="18"
          y="24.5"
          textAnchor="middle"
          style={{
            fill: "var(--color-text-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: "4.5px",
          }}
        >
          {sublabel}
        </text>
      )}
    </svg>
  );
}
