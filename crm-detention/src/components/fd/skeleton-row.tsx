"use client";

// SkeletonRow (spec): shimmer 1.4s con stagger 150ms, MISMA grilla que la fila real
// (cero layout shift). Nunca spinners.

const SKEL: React.CSSProperties = {
  height: 12,
  borderRadius: 4,
  background:
    "linear-gradient(90deg, var(--surface-2) 25%, var(--border-subtle, #151a21) 50%, var(--surface-2) 75%)",
  backgroundSize: "200px 100%",
  animation: "fd-shimmer 1.4s linear infinite",
};

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
        borderBottom: "1px solid var(--border)",
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
            <td key={c}>
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
