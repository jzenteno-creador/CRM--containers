"use client";

// BarChart + TrendLine (design system M0 — consumidos por el dashboard M7 §9).
// SVG propio con tokens Flight Deck, SIN librería: evita estética ajena y decisión
// ad-hoc en M7. Barras verticales con valor mono arriba; línea con área tenue y
// último punto enfatizado.

export type ChartDatum = { label: string; value: number };

const W = 600;

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export function BarChart({
  data,
  height = 200,
  color = "var(--color-accent-500)",
  formatValue = (v: number) => v.toLocaleString("es-AR"),
  className = "",
  ariaLabel = "gráfico de barras",
}: {
  data: ChartDatum[];
  height?: number;
  color?: string | ((d: ChartDatum, i: number) => string);
  formatValue?: (v: number) => string;
  className?: string;
  ariaLabel?: string;
}) {
  const H = height;
  const padTop = 22;
  const padBottom = 24;
  const plotH = H - padTop - padBottom;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const n = Math.max(data.length, 1);
  const slot = W / n;
  const barW = Math.min(46, slot * 0.55);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{ display: "block" }}
    >
      {/* guías horizontales sutiles */}
      {[0.5, 1].map((f) => (
        <line
          key={f}
          x1={0}
          x2={W}
          y1={padTop + plotH * (1 - f)}
          y2={padTop + plotH * (1 - f)}
          stroke="var(--color-border-subtle)"
          strokeDasharray="2 4"
        />
      ))}
      {/* baseline */}
      <line x1={0} x2={W} y1={padTop + plotH} y2={padTop + plotH} stroke="var(--color-border-strong)" />
      {data.map((d, i) => {
        const h = max > 0 ? (d.value / max) * plotH : 0;
        const x = i * slot + (slot - barW) / 2;
        const y = padTop + plotH - h;
        const fill = typeof color === "function" ? color(d, i) : color;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={Math.max(h, 1)} rx={3} fill={fill} opacity={0.85} />
            <text
              x={x + barW / 2}
              y={y - 6}
              textAnchor="middle"
              style={{
                fill: "var(--color-text-secondary)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatValue(d.value)}
            </text>
            <text
              x={x + barW / 2}
              y={padTop + plotH + 16}
              textAnchor="middle"
              style={{ fill: "var(--color-text-label)", fontSize: 10.5, letterSpacing: "0.04em" }}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function TrendLine({
  data,
  height = 200,
  color = "var(--color-accent-500)",
  formatValue = (v: number) => v.toLocaleString("es-AR"),
  className = "",
  ariaLabel = "gráfico de tendencia",
}: {
  data: ChartDatum[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
  className?: string;
  ariaLabel?: string;
}) {
  const H = height;
  const padTop = 22;
  const padBottom = 24;
  const padX = 24;
  const plotH = H - padTop - padBottom;
  const plotW = W - padX * 2;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const n = data.length;

  const px = (i: number) => padX + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const py = (v: number) => padTop + plotH - (max > 0 ? (v / max) * plotH : 0);

  const points = data.map((d, i) => `${px(i)},${py(d.value)}`).join(" ");
  const area = n > 0 ? `${px(0)},${padTop + plotH} ${points} ${px(n - 1)},${padTop + plotH}` : "";
  const lastPoint = n > 0 ? data[n - 1] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{ display: "block" }}
    >
      {[0.5, 1].map((f) => (
        <line
          key={f}
          x1={0}
          x2={W}
          y1={padTop + plotH * (1 - f)}
          y2={padTop + plotH * (1 - f)}
          stroke="var(--color-border-subtle)"
          strokeDasharray="2 4"
        />
      ))}
      <line x1={0} x2={W} y1={padTop + plotH} y2={padTop + plotH} stroke="var(--color-border-strong)" />
      {n > 1 && <polygon points={area} fill={color} opacity={0.07} />}
      {n > 1 && (
        <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {data.map((d, i) => (
        <circle
          key={d.label}
          cx={px(i)}
          cy={py(d.value)}
          r={i === n - 1 ? 4 : 2.5}
          fill={i === n - 1 ? color : "var(--color-bg-base)"}
          stroke={color}
          strokeWidth={1.5}
        />
      ))}
      {data.map((d, i) => (
        <text
          key={d.label}
          x={px(i)}
          y={padTop + plotH + 16}
          textAnchor="middle"
          style={{ fill: "var(--color-text-label)", fontSize: 10.5, letterSpacing: "0.04em" }}
        >
          {d.label}
        </text>
      ))}
      {lastPoint && (
        <text
          x={px(n - 1)}
          y={py(lastPoint.value) - 10}
          textAnchor="middle"
          style={{
            fill: "var(--color-text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatValue(lastPoint.value)}
        </text>
      )}
    </svg>
  );
}
