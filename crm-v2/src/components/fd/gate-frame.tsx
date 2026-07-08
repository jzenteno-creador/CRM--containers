// GateFrame (design system): marco de las pantallas de compuerta (gate) — dot-logo
// "S" + wordmark SSB·INTERNATIONAL arriba y footer "CRM DETENTION · v2" abajo, sobre
// la atmósfera .gate-page. Extraído del markup repetido en espera-aprobacion,
// auth/callback, auth/actualizar-password, recuperar y app-gate (consolidación #11).
// `style` sólo lo usa /design para enmarcar un preview; en producción va sin estilo
// y el render es idéntico al original.

export function GateFrame({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="gate-page" style={style}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className="dot-logo">S</span>
        <span className="wordmark">
          SSB<b>·</b>INTERNATIONAL
        </span>
      </div>
      {children}
      <span className="mono" style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
        CRM DETENTION · v2
      </span>
    </div>
  );
}
