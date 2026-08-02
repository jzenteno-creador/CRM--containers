// Página de "sin conexión" de la PWA (2026-08-02). El service worker navega acá cuando
// no hay red — NUNCA sirve una vista vieja del sistema: plata desactualizada presentada
// como actual es peor que un aviso honesto.
export const metadata = { title: "Sin conexión · CRM SSB" };

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div>
        <div style={{ fontSize: 42, marginBottom: 12 }}>📡</div>
        <h1 className="fd-display" style={{ fontSize: 22, margin: "0 0 8px" }}>
          Sin conexión
        </h1>
        <p style={{ color: "var(--color-text-secondary)", maxWidth: 360, margin: "0 auto" }}>
          El CRM necesita internet para mostrar datos reales — no te va a mostrar
          información vieja como si fuera actual. Reintentá cuando vuelva la señal.
        </p>
      </div>
    </main>
  );
}
