"use client";

// Compuerta de aprobación (§12.2/§12.5, wireada en M2): autenticado pero no activo.
// Muestra el ESTADO REAL desde la RPC perfil() (pendiente / rechazado / suspendido)
// + logout. El acceso cero a datos lo garantiza RLS (§14.3), no esta pantalla.
// Nota: el motivo del rechazo vive en crm.usuarios.rechazo_motivo, que un usuario
// no-activo NO puede leer (§14.3) y perfil() no expone — se muestra un mensaje
// genérico hasta que el schema-builder lo agregue a la superficie, si se decide.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/fd/button";
import { ErrorState } from "@/components/fd/error-state";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { useSession, type EstadoCuenta } from "@/lib/session";

type EstadoGate = Exclude<EstadoCuenta, "activo">;

const ESTADO_UI: Record<
  EstadoGate,
  { icon: string; chip: string; title: string; body: string; color: string; tint: string; line: string }
> = {
  pendiente_aprobacion: {
    icon: "ti-hourglass-high",
    chip: "Pendiente de aprobación",
    title: "Tu cuenta espera aprobación",
    body: "Un administrador tiene que aprobar tu solicitud y asignarte rol y planta. Vas a poder entrar al sistema apenas te aprueben — no hace falta que hagas nada más.",
    color: "var(--color-status-amber)",
    tint: "var(--color-amber-tint)",
    line: "var(--color-amber-line)",
  },
  rechazado: {
    icon: "ti-user-x",
    chip: "Solicitud rechazada",
    title: "Tu solicitud fue rechazada",
    body: "Un administrador rechazó tu solicitud de acceso. Si creés que es un error o necesitás conocer el motivo, contactá a administración de SSB.",
    color: "var(--color-status-red)",
    tint: "var(--color-red-tint)",
    line: "var(--color-red-line)",
  },
  suspendido: {
    icon: "ti-lock",
    chip: "Cuenta suspendida",
    title: "Tu cuenta está suspendida",
    body: "Administración suspendió tu acceso al CRM. Tu historial se conserva: si te reactivan, volvés a entrar con las mismas credenciales.",
    color: "var(--color-status-amber)",
    tint: "var(--color-amber-tint)",
    line: "var(--color-amber-line)",
  },
};

function GateFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="gate-page">
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

export default function EsperaAprobacionPage() {
  const router = useRouter();
  const { status, email, perfil, perfilError, refreshPerfil, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (status === "signedOut") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (perfil?.estado === "activo") router.replace("/inicio");
  }, [perfil, router]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.replace("/login");
  };

  if (status === "signedIn" && perfilError) {
    return (
      <GateFrame>
        <div className="gate-card">
          <ErrorState
            title="No pudimos resolver el estado de tu cuenta"
            detail={perfilError}
            onRetry={() => void refreshPerfil()}
          />
          <Button
            variant="ghost"
            icon="ti-logout"
            loading={signingOut}
            onClick={() => void handleSignOut()}
            style={{ width: "100%", padding: 10 }}
          >
            Cerrar sesión
          </Button>
        </div>
      </GateFrame>
    );
  }

  if (status !== "signedIn" || !perfil || perfil.estado === "activo") {
    return (
      <GateFrame>
        <div className="gate-card" aria-busy="true" aria-label="cargando estado de la cuenta">
          <SkeletonBlock width={52} height={52} style={{ borderRadius: "50%" }} />
          <SkeletonBlock width="50%" height={14} delay={150} />
          <SkeletonBlock width="85%" delay={300} />
          <SkeletonBlock width="75%" delay={450} />
        </div>
      </GateFrame>
    );
  }

  const ui = ESTADO_UI[perfil.estado];

  return (
    <GateFrame>
      <div className="gate-card">
        <span
          aria-hidden
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: ui.tint,
            border: `1px solid ${ui.line}`,
            color: ui.color,
            fontSize: 24,
          }}
        >
          <i className={`ti ${ui.icon}`} />
        </span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.13em",
            textTransform: "uppercase",
            padding: "3px 10px",
            borderRadius: "var(--radius-chip)",
            color: ui.color,
            background: ui.tint,
            border: `1px solid ${ui.line}`,
          }}
        >
          {ui.chip}
        </span>
        <h1
          className="fd-display"
          style={{ fontSize: 17, margin: "4px 0 0", color: "var(--color-text-primary)" }}
        >
          {ui.title}
        </h1>
        {email && (
          <span className="mono" style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
            {email}
          </span>
        )}
        <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.6, margin: 0, maxWidth: 340 }}>
          {ui.body}
        </p>
        <div style={{ marginTop: 10, width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <Button
            variant="ghost"
            icon="ti-logout"
            loading={signingOut}
            onClick={() => void handleSignOut()}
            style={{ width: "100%", padding: 10 }}
          >
            Cerrar sesión
          </Button>
          <span style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
            ¿Consultas? Escribí a administración de SSB.
          </span>
        </div>
      </div>
    </GateFrame>
  );
}
