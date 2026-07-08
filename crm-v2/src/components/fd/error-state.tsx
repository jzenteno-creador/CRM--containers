"use client";

// ErrorState (design system M0): estado de error de página/panel — mensaje + botón
// retry cyan, misma familia visual que EmptyState. Los errores transitorios de
// mutación van por Toast; esto cubre datos que no cargaron.

import { Button } from "./button";

export function ErrorState({
  title = "No se pudieron cargar los datos",
  detail,
  onRetry,
  retryLabel = "Reintentar",
  className = "",
}: {
  title?: string;
  detail?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 10,
        padding: "36px 24px",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: "var(--color-red-tint)",
          border: "1px solid var(--color-red-line)",
          color: "var(--color-status-red)",
          fontSize: 20,
        }}
      >
        <i className="ti ti-alert-triangle" />
      </span>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-text-primary)" }}>{title}</div>
      {detail && (
        <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", maxWidth: 420, lineHeight: 1.55 }}>
          {detail}
        </div>
      )}
      {onRetry && (
        <Button variant="primary" icon="ti-refresh" onClick={onRetry} style={{ marginTop: 4 }}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
