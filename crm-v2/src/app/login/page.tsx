"use client";

// Login (§12, wireado en M2): signInWithPassword + errores claros (credenciales,
// email sin confirmar, rate limit). Con sesión ya activa redirige a /inicio y el
// gate decide (activo → app / no activo → espera). Links reales a /registro y
// /recuperar (reset de contraseña).

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

function loginErrorMessage(error: AuthError): string {
  if (error.code === "invalid_credentials") return "Correo o contraseña incorrectos.";
  if (error.code === "email_not_confirmed") {
    return "Tu correo todavía no está confirmado. Buscá el mail de confirmación (revisá spam) y tocá el link antes de ingresar.";
  }
  if (error.code === "over_request_rate_limit") return "Demasiados intentos. Esperá un momento y volvé a probar.";
  if (/failed to fetch|networkerror|load failed/i.test(error.message)) {
    return "No hay conexión con el servidor. Verificá tu red y reintentá.";
  }
  return `No se pudo iniciar sesión: ${error.message}`;
}

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Ya logueado → afuera del login (el gate resuelve espera vs app)
  useEffect(() => {
    if (status === "signedIn") router.replace("/inicio");
  }, [status, router]);

  const emailError =
    (touched.email || submitted) && email.trim() === ""
      ? "ingresá tu correo"
      : (touched.email || submitted) && !EMAIL_RE.test(email.trim())
        ? "correo inválido"
        : null;
  const passwordError = (touched.password || submitted) && password === "" ? "ingresá tu contraseña" : null;
  const valid = EMAIL_RE.test(email.trim()) && password !== "";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid || submitting) return;
    setSubmitting(true);
    setAuthError(null);
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setAuthError(loginErrorMessage(error));
      setSubmitting(false);
      return;
    }
    // submitting queda en true: bloquea el doble-submit mientras navega
    router.replace("/inicio");
  };

  return (
    <div className="login-grid">
      <AuthBrandPanel />

      <div className="login-form">
        <div style={{ width: "100%", maxWidth: 340 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px", fontFamily: "var(--font-display)" }}>
            Ingresar
          </h2>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "0 0 24px" }}>
            Acceso operativo · SSB International
          </p>
          <form onSubmit={onSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
            <Field label="contraseña" htmlFor="password" error={passwordError}>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                error={passwordError}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              />
            </Field>
            {authError && <FormAlert>{authError}</FormAlert>}
            <Button type="submit" variant="primary" loading={submitting} style={{ padding: 11, fontSize: 13 }}>
              Ingresar
            </Button>
          </form>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              marginTop: 18,
              fontSize: 12,
            }}
          >
            <Link href="/recuperar">¿Olvidaste tu contraseña?</Link>
            <Link href="/registro">Crear cuenta</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
