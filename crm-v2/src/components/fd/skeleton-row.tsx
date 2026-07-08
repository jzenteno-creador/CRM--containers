"use client";

// SkeletonRow (spec): shimmer 1.4s con stagger 150ms, MISMA grilla que la fila real
// (cero layout shift). Nunca spinners.

const SKEL: React.CSSProperties = {
  height: 12,
  borderRadius: 4,
  background:
    "linear-gradient(90deg, var(--color-surface-2) 25%, var(--color-border-subtle) 50%, var(--color-surface-2) 75%)",
  backgroundSize: "200px 100%",
  animation: "fd-shimmer 1.4s linear infinite",
};

/** Bloque shimmer suelto (gates de sesión, cards, formularios) — mismo token que las filas. */
export function SkeletonBlock({
  width = "100%",
  height = 12,
  delay = 0,
  style,
}: {
  width?: number | string;
  height?: number | string;
  /** Stagger en ms (spec motion: 150ms entre bloques). */
  delay?: number;
  style?: React.CSSProperties;
}) {
  return <span aria-hidden style={{ ...SKEL, display: "block", width, height, animationDelay: `${delay}ms`, ...style }} />;
}

/** Fila skeleton en grilla CSS (para las tablas grid Flight Deck). */
export function SkeletonRow({
  cols,
  index = 0,
  height = 40,
}: {
  cols: string;
  index?: number;
  height?: number;
}) {
  const n = cols.trim().split(/\s+/).length;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        gap: 12,
        alignItems: "center",
        height,
        padding: "0 16px",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
      aria-hidden
    >
      {Array.from({ length: n }, (_, i) => (
        <span key={i} style={{ ...SKEL, animationDelay: `${index * 150}ms`, width: i === 0 ? "60%" : "80%" }} />
      ))}
    </div>
  );
}

/** Skeleton para <tbody> de tablas HTML clásicas (misma cantidad de columnas). */
export function SkeletonRowsTable({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} aria-hidden>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} style={{ padding: "10px 12px", borderBottom: "1px solid var(--color-border-subtle)" }}>
              <span
                style={{ ...SKEL, display: "block", animationDelay: `${r * 150}ms`, width: c === 0 ? "70%" : "85%" }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
