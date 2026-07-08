"use client";

// Reset de contraseña — paso 2: destino del link de recuperación de Supabase Auth.
// El cliente consume los tokens del hash (detectSessionInUrl) → sesión temporal →
// formulario de contraseña nueva (updateUser). Link vencido/ya usado → GoTrue
// vuelve con error en el fragment: se muestra la explicación + volver a pedir.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import type { AuthError } from "@supabase/supabase-js";
import { Button } from "@/components/fd/button";
import { CardIcon } from "@/components/fd/card-icon";
import { Field, Input } from "@/components/fd/fields";
import { FormAlert } from "@/components/fd/form-alert";
import { GateFrame } from "@/components/fd/gate-frame";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

const MIN_PASSWORD = 8;

function updateErrorMessage(error: AuthError): string {
  if (error.code === "same_password") return "La contraseña nueva no puede ser igual a la anterior.";
  if (error.code === "weak_password") return "La contraseña es demasiado débil: usá más caracteres o combiná letras y números.";
  if (error.code === "over_request_rate_limit") return "Demasiados intentos. Esperá un momento y volvé a probar.";
  if (/failed to fetch|networkerror|load failed/i.test(error.message)) {
    return "No hay conexión con el servidor. Verificá tu red y reintentá.";
  }
  return `No se pudo actualizar la contraseña: ${error.message}`;
}

/** Error que GoTrue devuelve en el fragment/query cuando el link no sirve.
 *  La URL no cambia después del load: se lee como store externo inmutable
 *  (useSyncExternalStore) — los strings comparan por valor, snapshot estable. */
function readLinkError(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const desc = hash.get("error_description") ?? query.get("error_description");
  const code = hash.get("error_code") ?? query.get("error_code");
  if (!desc && !code) return null;
  if (code === "otp_expired" || /expired/i.test(desc ?? "")) {
    return "El link venció o ya fue usado. Pedí uno nuevo desde «Recuperar contraseña».";
  }
  return desc ?? "El link no es válido. Pedí uno nuevo desde «Recuperar contraseña».";
}

const subscribeNoop = () => () => {};
const linkErrorServerSnapshot = () => null;

export default function ActualizarPasswordPage() {
  const router = useRouter();
  const { status } = useSession();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [touched, setTouched] = useState<{ password?: boolean; repeat?: boolean }>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const linkError = useSyncExternalStore(subscribeNoop, readLinkError, linkErrorServerSnapshot);

  const passwordError =
    (touched.password || submitted) && password.length < MIN_PASSWORD
      ? `mínimo ${MIN_PASSWORD} caracteres`
      : null;
  const repeatError = (touched.repeat || submitted) && repeat !== password ? "las contraseñas no coinciden" : null;
  const valid = password.length >= MIN_PASSWORD && repeat === password;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid || submitting) return;
    setSubmitting(true);
    setAuthError(null);
    const { error } = await getSupabase().auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setAuthError(updateErrorMessage(error));
      return;
    }
    setDone(true);
  };

  // link vencido/inválido (GoTrue volvió con error y sin sesión)
  if (linkError && status !== "signedIn") {
    return (
      <GateFrame>
        <div className="gate-card">
          <CardIcon
            icon="ti-link-off"
            color="var(--color-status-red)"
            tint="var(--color-red-tint)"
            line="var(--color-red-line)"
          />
          <h1 className="fd-display" style={{ fontSize: 17, margin: "4px 0 0", color: "var(--color-text-primary)" }}>
            El link no sirvió
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.6, margin: 0, maxWidth: 340 }}>
            {linkError}
          </p>
          <div style={{ marginTop: 10, width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
            <Link href="/recuperar" style={{ width: "100%" }}>
              <Button variant="primary" icon="ti-key" style={{ width: "100%", padding: 10 }}>
                Pedir un link nuevo
              </Button>
            </Link>
            <Link href="/login" style={{ fontSize: 12 }}>
              ← Volver al ingreso
            </Link>
          </div>
        </div>
      </GateFrame>
    );
  }

  if (status === "loading") {
    return (
      <GateFrame>
        <div className="gate-card" aria-busy="true" aria-label="verificando el link de recuperación">
          <SkeletonBlock width={52} height={52} style={{ borderRadius: "50%" }} />
          <SkeletonBlock width="55%" height={14} delay={150} />
          <SkeletonBlock width="80%" delay={300} />
        </div>
      </GateFrame>
    );
  }

  // sin sesión y sin error explícito: entraron directo, sin link de recuperación
  if (status === "signedOut") {
    return (
      <GateFrame>
        <div className="gate-card">
          <CardIcon
            icon="ti-key"
            color="var(--color-status-amber)"
            tint="var(--color-amber-tint)"
            line="var(--color-amber-line)"
          />
          <h1 className="fd-display" style={{ fontSize: 17, margin: "4px 0 0", color: "var(--color-text-primary)" }}>
            Falta el link de recuperación
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.6, margin: 0, maxWidth: 340 }}>
            Esta pantalla se abre desde el link que te llega por correo al pedir «Recuperar contraseña». Pedilo desde ahí
            y entrá con el botón del mail.
          </p>
          <div style={{ marginTop: 10, width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
            <Link href="/recuperar" style={{ width: "100%" }}>
              <Button variant="primary" icon="ti-key" style={{ width: "100%", padding: 10 }}>
                Recuperar contraseña
              </Button>
            </Link>
            <Link href="/login" style={{ fontSize: 12 }}>
              ← Volver al ingreso
            </Link>
          </div>
        </div>
      </GateFrame>
    );
  }

  if (done) {
    return (
      <GateFrame>
        <div className="gate-card">
          <CardIcon
            icon="ti-circle-check"
            color="var(--color-status-green)"
            tint="var(--color-green-tint)"
            line="var(--color-green-line)"
          />
          <h1 className="fd-display" style={{ fontSize: 17, margin: "4px 0 0", color: "var(--color-text-primary)" }}>
            Contraseña actualizada
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.6, margin: 0, maxWidth: 340 }}>
            Ya podés usar tu contraseña nueva. Tu sesión quedó iniciada en este navegador.
          </p>
          <div style={{ marginTop: 10, width: "100%" }}>
            <Button
              variant="primary"
              icon="ti-arrow-right"
              onClick={() => router.replace("/inicio")}
              style={{ width: "100%", padding: 10 }}
            >
              Entrar al CRM
            </Button>
          </div>
        </div>
      </GateFrame>
    );
  }

  return (
    <GateFrame>
      <div className="gate-card">
        <CardIcon
          icon="ti-lock-cog"
          color="var(--color-accent-500)"
          tint="var(--color-accent-tint)"
          line="var(--color-accent-line)"
        />
        <h1 className="fd-display" style={{ fontSize: 17, margin: "4px 0 0", color: "var(--color-text-primary)" }}>
          Contraseña nueva
        </h1>
        <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.6, margin: 0, maxWidth: 340 }}>
          Elegí la contraseña con la que vas a entrar de ahora en más.
        </p>
        <form
          onSubmit={onSubmit}
          noValidate
          style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14, marginTop: 8, textAlign: "left" }}
        >
          <Field label="contraseña nueva" htmlFor="new-password" error={passwordError} hint={`mínimo ${MIN_PASSWORD} caracteres`}>
            <Input
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              error={passwordError}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            />
          </Field>
          <Field label="repetir contraseña" htmlFor="repeat-password" error={repeatError}>
            <Input
              id="repeat-password"
              name="repeat-password"
              type="password"
              autoComplete="new-password"
              value={repeat}
              error={repeatError}
              onChange={(e) => setRepeat(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, repeat: true }))}
            />
          </Field>
          {authError && <FormAlert>{authError}</FormAlert>}
          <Button type="submit" variant="primary" loading={submitting} style={{ padding: 11, fontSize: 13 }}>
            Guardar contraseña
          </Button>
        </form>
      </div>
    </GateFrame>
  );
}
