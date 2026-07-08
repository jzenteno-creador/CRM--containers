// PageHeader (patrón de página M0): título display-lg + contadores + UNA acción
// primaria por pantalla. Cada página que lo usa entrega el contrato de 4 estados
// (carga skeleton / vacío instructivo / error con retry / poblado) — el reviewer
// lo gatea por pantalla; el patrón completo está demostrado en /design.

export function PageHeader({
  title,
  counters,
  action,
  className = "",
}: {
  title: string;
  /** Contadores/chips contextuales (Badge mono, StatusBadge, texto muted). */
  counters?: React.ReactNode;
  /** UNA acción primaria clara (Button variant="primary"). */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 10,
        marginBottom: 16,
      }}
    >
      <h2
        className="fd-display fd-display-lg"
        style={{ margin: 0, color: "var(--color-text-primary)" }}
      >
        {title}
      </h2>
      {counters && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{counters}</div>}
      {action && <div style={{ marginLeft: "auto" }}>{action}</div>}
    </div>
  );
}
