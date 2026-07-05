"use client";

// Login institucional (guía crm-detention-diseno): panel de marca + form.
// Logos reales SSB/Dow en el footer (.logo-slot) desde /public/logos/.

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <div className="login-grid">
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
            Retiro, tránsito, carga y devolución de la exportación de polietileno desde Bahía
            Blanca — con el freetime de cada naviera bajo control.
          </p>
        </div>
        <div className="login-foot">
          <span>Operado por</span>
          <img src="/logos/ssb-white.svg" alt="SSB International" className="logo-slot" />
          <span>·</span>
          <span>en asociación con</span>
          <img src="/logos/dow.png" alt="Dow" className="logo-slot" />
        </div>
      </div>

      <div className="login-form">
        <div style={{ width: "100%", maxWidth: 340 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px" }}>Ingresar</h2>
          <p className="note" style={{ marginTop: 0, marginBottom: 24 }}>
            Acceso operativo · SSB International
          </p>
          <form action={formAction} className="f" style={{ gap: 12 }}>
            <div className="f">
              <label htmlFor="email">correo</label>
              <input id="email" name="email" type="email" autoComplete="username" required />
            </div>
            <div className="f">
              <label htmlFor="password">contraseña</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {state?.error && <div className="err">{state.error}</div>}
            <button type="submit" className="btn-primary" disabled={pending} style={{ padding: 11 }}>
              {pending ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
