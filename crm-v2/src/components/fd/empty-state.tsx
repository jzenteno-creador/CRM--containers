// EmptyState instructivo (§15.3): cada listado vacío explica QUÉ aparece acá y DESDE
// DÓNDE llega (ej: "No hay pendientes de terminal. Los contenedores que salen de planta
// aparecen acá hasta confirmar su ingreso a terminal, que corta el freetime.").

export function EmptyState({
  icon = "ti-inbox",
  title,
  children,
  action,
  className = "",
}: {
  icon?: string;
  title: string;
  /** Cuerpo instructivo obligatorio: qué aparece acá y desde dónde. */
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
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
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border-strong)",
          color: "var(--color-text-muted)",
          fontSize: 20,
        }}
      >
        <i className={`ti ${icon}`} />
      </span>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-text-primary)" }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", maxWidth: 420, lineHeight: 1.55 }}>
        {children}
      </div>
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
