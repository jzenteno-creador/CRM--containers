"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="crm-card" style={{ width: 380, maxWidth: "100%" }}>
        <div className="crm-brand" style={{ fontSize: 16, marginBottom: 4 }}>
          <i className="ti ti-box" aria-hidden /> CRM Detention · SSB
        </div>
        <p className="note" style={{ marginTop: 0, marginBottom: 14 }}>
          Control de detention de contenedores — Bahía Blanca
        </p>
        <form action={formAction} className="f" style={{ gap: 10 }}>
          <div className="f">
            <label htmlFor="email">email</label>
            <input id="email" name="email" type="email" autoComplete="username" required />
          </div>
          <div className="f">
            <label htmlFor="password">contraseña</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {state?.error && <div className="err">{state.error}</div>}
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
        <div className="note" style={{ marginTop: 14 }}>
          <div style={{ marginBottom: 4 }}>usuarios demo:</div>
          <div className="mono">admin@ssb.demo · admin123</div>
          <div className="mono">supervisor@ssb.demo · super123</div>
          <div className="mono">operador@ssb.demo · opera123</div>
        </div>
      </div>
    </div>
  );
}
