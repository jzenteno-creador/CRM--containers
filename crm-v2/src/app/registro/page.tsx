"use client";

// Registro abierto (§12.1): nombre + email + password con validación en vivo →
// supabase.auth.signUp con data.nombre (lo lee crm.handle_new_user) y
// emailRedirectTo a /auth/callback. Post-signup: portada "revisá tu correo"
// (instructiva, misma calidad que el login) con reenvío del mail.
// El warning de dominio (§12.4) vive en el panel de solicitudes del admin —
// acá NO se bloquea ningún dominio: el gate es la aprobación humana.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AuthError } from "@supabase/supabase-js";
import { AuthBrandPanel } from "@/components/auth/brand-panel";
import { Button } from "@/components/fd/button";
import { Field, Input } from "@/components/fd/fields";
import { FormAlert } from "@/components/fd/form-alert";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function signupErrorMessage(error: AuthError): string {
  if (error.code === "user_already_exists" || error.code === "email_exists") {
    return "Ya existe una cuenta con ese correo. Iniciá sesión o recuperá tu contraseña.";
  }
  if (error.code === "weak_password") {
    return "La contraseña es demasiado débil: usá más caracteres o combiná letras y números.";
  }
  if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return "Demasiados intentos. Esperá un minuto y volvé a probar.";
  }
  if (/failed to fetch|networkerror|load failed/i.test(error.message)) {
    return "No hay conexión con el servidor. Verificá tu red y reintentá.";
  }
  return `No se pudo crear la cuenta: ${error.message}`;
}

/** Portada post-signup: qué llegó, qué tocar y qué pasa después (§12.1→§12.2). */
function CheckInboxView({ email }: { email: string }) {
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const resend = async () => {
    if (resending) return;
    setResending(true);
    setResendMsg(null);
    setResendError(null);
    const { error } = await getSupabase().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setResending(false);
    if (error) {
      setResendError(
        error.code === "over_email_send_rate_limit"
          ? "Hay que esperar un minuto entre reenvíos."
          : `No se pudo reenviar: ${error.message}`,
      );
      return;
    }
    setResendMsg("Listo — te reenviamos el correo de confirmación.");
  };

  const steps: Array<{ icon: string; text: React.ReactNode }> = [
    {
      icon: "ti-mail-opened",
      text: (
        <>
          Abrí el correo que te mandamos a{" "}
          <span className="mono" style={{ color: "var(--color-text-secondary)" }}>
            {email}
          </span>{" "}
          (si no aparece, revisá spam).
        </>
      ),
    },
    { icon: "ti-click", text: <>Tocá el botón de confirmación — te trae de vuelta al CRM.</> },
    {
      icon: "ti-user-check",
      text: <>Tu solicitud queda pendiente: un administrador te asigna rol y planta, y ahí ya podés operar.</>,
    },
  ];

  return (
    <div style={{ width: "100%", maxWidth: 380 }}>
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
          marginBottom: 16,
        }}
      >
        <i className="ti ti-mail-forward" />
      </span>
      <h2 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px", fontFamily: "var(--font-display)" }}>
        Revisá tu correo
      </h2>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "0 0 20px" }}>
        Tu cuenta se creó — falta confirmar el correo.
      </p>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        {steps.map((s, i) => (
          <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span
              aria-hidden
              style={{
                width: 30,
                height: 30,
                flexShrink: 0,
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border-strong)",
                color: "var(--color-accent-500)",
                fontSize: 15,
              }}
            >
              <i className={`ti ${s.icon}`} />
            </span>
            <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.55, paddingTop: 2 }}>
              {s.text}
            </span>
          </li>
        ))}
      </ol>
      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
        <Button variant="ghost" icon="ti-send" loading={resending} onClick={() => void resend()} style={{ padding: 10 }}>
          Reenviar el correo
        </Button>
        {resendMsg && (
          <span role="status" style={{ fontSize: 11.5, color: "var(--color-status-green)" }}>
            {resendMsg}
          </span>
        )}
        {resendError && (
          <span role="alert" style={{ fontSize: 11.5, color: "var(--color-status-red)" }}>
            {resendError}
          </span>
        )}
        <Link href="/login" style={{ fontSize: 12 }}>
          ← Volver al ingreso
        </Link>
      </div>
    </div>
  );
}

export default function RegistroPage() {
  const router = useRouter();
  const { status } = useSession();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<{ nombre?: boolean; email?: boolean; password?: boolean }>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Ya logueado → afuera (el gate resuelve espera vs app). No aplica cuando el
  // signup quedó pendiente de confirmación (ahí no hay sesión todavía).
  useEffect(() => {
    if (status === "signedIn" && !sentTo) router.replace("/inicio");
  }, [status, sentTo, router]);

  const nombreError =
    (touched.nombre || submitted) && nombre.trim().length < 2 ? "ingresá tu nombre y apellido" : null;
  const emailError =
    (touched.email || submitted) && email.trim() === ""
      ? "ingresá tu correo"
      : (touched.email || submitted) && !EMAIL_RE.test(email.trim())
        ? "correo inválido"
        : null;
  const passwordError =
    (touched.password || submitted) && password.length < MIN_PASSWORD ? `mínimo ${MIN_PASSWORD} caracteres` : null;
  const valid = nombre.trim().length >= 2 && EMAIL_RE.test(email.trim()) && password.length >= MIN_PASSWORD;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid || submitting) return;
    setSubmitting(true);
    setAuthError(null);
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { nombre: nombre.trim() }, // lo lee crm.handle_new_user (§12.1)
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setSubmitting(false);
    if (error) {
      setAuthError(signupErrorMessage(error));
      return;
    }
    // Con confirmación ON, GoTrue ofusca el "correo ya registrado" devolviendo
    // un user sin identities — se trata como cuenta existente, no como éxito.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setAuthError("Ya existe una cuenta con ese correo. Iniciá sesión o recuperá tu contraseña.");
      return;
    }
    if (data.session) {
      // confirmación de email OFF (no esperado en este proyecto): sesión directa
      router.replace("/inicio");
      return;
    }
    setSentTo(email.trim());
  };

  return (
    <div className="login-grid">
      <AuthBrandPanel />

      <div className="login-form">
        {sentTo ? (
          <CheckInboxView email={sentTo} />
        ) : (
          <div style={{ width: "100%", maxWidth: 340 }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px", fontFamily: "var(--font-display)" }}>
              Crear cuenta
            </h2>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "0 0 24px" }}>
              Registro abierto — tu acceso lo aprueba administración.
            </p>
            <form onSubmit={onSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="nombre y apellido" htmlFor="nombre" error={nombreError}>
                <Input
                  id="nombre"
                  name="nombre"
                  type="text"
                  autoComplete="name"
                  value={nombre}
                  error={nombreError}
                  onChange={(e) => setNombre(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, nombre: true }))}
                />
              </Field>
              <Field label="correo" htmlFor="email" error={emailError}>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  error={emailError}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                />
              </Field>
              <Field label="contraseña" htmlFor="password" error={passwordError} hint={`mínimo ${MIN_PASSWORD} caracteres`}>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  error={passwordError}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                />
              </Field>
              {authError && <FormAlert>{authError}</FormAlert>}
              <Button type="submit" variant="primary" loading={submitting} style={{ padding: 11, fontSize: 13 }}>
                Crear cuenta
              </Button>
            </form>
            <div style={{ marginTop: 18, fontSize: 12 }}>
              ¿Ya tenés cuenta? <Link href="/login">Ingresar</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
