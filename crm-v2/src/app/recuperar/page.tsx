"use client";

// Reset de contraseña — paso 1 (§12 "Olvidé mi contraseña"): pide el correo y
// dispara resetPasswordForEmail con redirect a /auth/actualizar-password.
// La respuesta es deliberadamente neutra ("si existe una cuenta...") para no
// revelar qué correos están registrados.

import Link from "next/link";
import { useState } from "react";
import type { AuthError } from "@supabase/supabase-js";
import { Button } from "@/components/fd/button";
import { Field, Input } from "@/components/fd/fields";
import { getSupabase } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resetErrorMessage(error: AuthError): string {
  if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return "Demasiados intentos. Esperá un minuto y volvé a probar.";
  }
  if (/failed to fetch|networkerror|load failed/i.test(error.message)) {
    return "No hay conexión con el servidor. Verificá tu red y reintentá.";
  }
  return `No se pudo enviar el correo: ${error.message}`;
}

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const emailError =
    (touched || submitted) && email.trim() === ""
      ? "ingresá tu correo"
      : (touched || submitted) && !EMAIL_RE.test(email.trim())
        ? "correo inválido"
        : null;
  const valid = EMAIL_RE.test(email.trim());

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid || submitting) return;
    setSubmitting(true);
    setAuthError(null);
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/actualizar-password`,
    });
    setSubmitting(false);
    if (error) {
      setAuthError(resetErrorMessage(error));
      return;
    }
    setSentTo(email.trim());
  };

  return (
    <div className="gate-page">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className="dot-logo">S</span>
        <span className="wordmark">
          SSB<b>·</b>INTERNATIONAL
        </span>
      </div>

      <div className="gate-card">
        <span
          aria-hidden
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "var(--color-accent-tint)",
            border: "1px solid var(--color-accent-line)",
            color: "var(--color-accent-500)",
            fontSize: 24,
          }}
        >
          <i className={`ti ${sentTo ? "ti-mail-forward" : "ti-key"}`} />
        </span>

        {sentTo ? (
          <>
            <h1 className="fd-display" style={{ fontSize: 17, margin: "4px 0 0", color: "var(--color-text-primary)" }}>
              Revisá tu correo
            </h1>
            <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.6, margin: 0, maxWidth: 340 }}>
              Si existe una cuenta para <span className="mono" style={{ color: "var(--color-text-secondary)" }}>{sentTo}</span>,
              te enviamos un link para crear una contraseña nueva. El link vence: usalo apenas llegue (y revisá spam si no aparece).
            </p>
            <div style={{ marginTop: 10, width: "100%" }}>
              <Link href="/login" style={{ fontSize: 12 }}>
                ← Volver al ingreso
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="fd-display" style={{ fontSize: 17, margin: "4px 0 0", color: "var(--color-text-primary)" }}>
              Recuperar contraseña
            </h1>
            <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.6, margin: 0, maxWidth: 340 }}>
              Ingresá el correo con el que te registraste y te mandamos un link para crear una contraseña nueva.
            </p>
            <form
              onSubmit={onSubmit}
              noValidate
              style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14, marginTop: 8, textAlign: "left" }}
            >
              <Field label="correo" htmlFor="reset-email" error={emailError}>
                <Input
                  id="reset-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  error={emailError}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched(true)}
                />
              </Field>
              {authError && (
                <div
                  role="alert"
                  style={{
                    fontSize: 12,
                    color: "var(--color-status-red)",
                    background: "var(--color-red-tint)",
                    border: "1px solid var(--color-red-line)",
                    borderRadius: "var(--radius-input)",
                    padding: "8px 12px",
                    lineHeight: 1.5,
                  }}
                >
                  {authError}
                </div>
              )}
              <Button type="submit" variant="primary" loading={submitting} style={{ padding: 11, fontSize: 13 }}>
                Enviar link de recuperación
              </Button>
            </form>
            <Link href="/login" style={{ fontSize: 12, marginTop: 6 }}>
              ← Volver al ingreso
            </Link>
          </>
        )}
      </div>

      <span className="mono" style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
        CRM DETENTION · v2
      </span>
    </div>
  );
}
