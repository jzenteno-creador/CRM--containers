"use client";

// Callback de confirmación de email (§12.1): destino del emailRedirectTo del
// signup. El cliente consume los tokens del hash (detectSessionInUrl) → sesión →
// se rutea por estado real: activo → /inicio, resto → /espera-aprobacion.
// Link vencido/ya usado → GoTrue vuelve con error en el fragment: se explica
// y se ofrece volver al ingreso (donde el error "email sin confirmar" guía).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useEffect } from "react";
import { Button } from "@/components/fd/button";
import { CardIcon } from "@/components/fd/card-icon";
import { ErrorState } from "@/components/fd/error-state";
import { GateFrame } from "@/components/fd/gate-frame";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { useSession } from "@/lib/session";

/** Error del fragment/query de GoTrue — URL inmutable post-load (store externo). */
function readLinkError(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const desc = hash.get("error_description") ?? query.get("error_description");
  const code = hash.get("error_code") ?? query.get("error_code");
  if (!desc && !code) return null;
  if (code === "otp_expired" || /expired/i.test(desc ?? "")) {
    return "El link de confirmación venció o ya fue usado. Probá ingresar: si tu correo sigue sin confirmar, registrate de nuevo o pedí el reenvío.";
  }
  return desc ?? "El link de confirmación no es válido.";
}

const subscribeNoop = () => () => {};
const linkErrorServerSnapshot = () => null;

export default function AuthCallbackPage() {
  const router = useRouter();
  const { status, perfil, perfilError, refreshPerfil } = useSession();
  const linkError = useSyncExternalStore(subscribeNoop, readLinkError, linkErrorServerSnapshot);

  // sesión confirmada + perfil resuelto → ruteo por estado real (§12.2)
  useEffect(() => {
    if (status === "signedIn" && perfil) {
      router.replace(perfil.estado === "activo" ? "/inicio" : "/espera-aprobacion");
    }
  }, [status, perfil, router]);

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
            <Link href="/login" style={{ width: "100%" }}>
              <Button variant="primary" icon="ti-login-2" style={{ width: "100%", padding: 10 }}>
                Ir al ingreso
              </Button>
            </Link>
            <Link href="/registro" style={{ fontSize: 12 }}>
              Crear la cuenta de nuevo
            </Link>
          </div>
        </div>
      </GateFrame>
    );
  }

  // entraron sin tokens (URL directa): no hay nada que confirmar acá
  if (status === "signedOut") {
    return (
      <GateFrame>
        <div className="gate-card">
          <CardIcon
            icon="ti-mail-question"
            color="var(--color-status-amber)"
            tint="var(--color-amber-tint)"
            line="var(--color-amber-line)"
          />
          <h1 className="fd-display" style={{ fontSize: 17, margin: "4px 0 0", color: "var(--color-text-primary)" }}>
            Nada que confirmar
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.6, margin: 0, maxWidth: 340 }}>
            Esta pantalla se abre desde el link de confirmación que llega por correo al crear una cuenta.
          </p>
          <div style={{ marginTop: 10, width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
            <Link href="/login" style={{ width: "100%" }}>
              <Button variant="primary" icon="ti-login-2" style={{ width: "100%", padding: 10 }}>
                Ir al ingreso
              </Button>
            </Link>
            <Link href="/registro" style={{ fontSize: 12 }}>
              Crear cuenta
            </Link>
          </div>
        </div>
      </GateFrame>
    );
  }

  // sesión OK pero la RPC perfil() falló (ej: Data API sin exponer crm)
  if (status === "signedIn" && perfilError) {
    return (
      <GateFrame>
        <div className="gate-card">
          <ErrorState
            title="Correo confirmado, pero no pudimos resolver tu perfil"
            detail={perfilError}
            onRetry={() => void refreshPerfil()}
          />
          <Link href="/login" style={{ fontSize: 12 }}>
            ← Volver al ingreso
          </Link>
        </div>
      </GateFrame>
    );
  }

  // confirmando: esperando la sesión del hash o el perfil
  return (
    <GateFrame>
      <div className="gate-card" aria-busy="true" aria-label="confirmando tu cuenta">
        <SkeletonBlock width={52} height={52} style={{ borderRadius: "50%" }} />
        <SkeletonBlock width="55%" height={14} delay={150} />
        <SkeletonBlock width="80%" delay={300} />
        <span style={{ fontSize: 11.5, color: "var(--color-text-faint)" }}>Confirmando tu cuenta…</span>
      </div>
    </GateFrame>
  );
}
