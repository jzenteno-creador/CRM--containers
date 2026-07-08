// Panel institucional del split de auth (login/registro): marca, blurb y logos
// SSB/Dow (patrón v1). Extraído del login M0 para reusarlo en /registro (M2)
// sin duplicar la portada.

export function AuthBrandPanel() {
  return (
    <div className="login-brand">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className="dot-logo">S</span>
        <span className="wordmark">
          SSB<b>·</b>INTERNATIONAL
        </span>
      </div>
      <div style={{ maxWidth: 460 }}>
        <div className="login-eyebrow">Detention · Origen</div>
        <h1 className="login-h1">Control de contenedores en detention.</h1>
        <p className="login-blurb">
          Retiro, tránsito, carga y devolución de la exportación de polietileno desde Bahía Blanca — con el
          freetime de cada naviera bajo control.
        </p>
      </div>
      <div className="login-foot">
        <span>Operado por</span>
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático de marca, sin optimización */}
        <img src="/logos/ssb-white.svg" alt="SSB International" className="logo-slot" />
        <span>·</span>
        <span>en asociación con</span>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo estático de marca */}
        <img src="/logos/dow.png" alt="Dow" className="logo-slot" />
      </div>
    </div>
  );
}
