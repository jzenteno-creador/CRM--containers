"use client";

// Compuerta de aprobación (§12.2/§12.3/§12.5): autenticado pero no activo.
// El estado de ESTA pantalla se resuelve vía la RPC crm.mi_estado_cuenta()
// (migración 012): devuelve UNA fila { estado_cuenta, rechazo_motivo } de la
// fila PROPIA del caller — única superficie que un no-activo puede leer
// (§14.3) y la que trae el motivo de rechazo que exige §12.3.
// Si la RPC falla (ej: schema `crm` aún sin exponer en la Data API) se
// degrada al comportamiento previo: estado desde el contexto de sesión
// (perfil()) con texto genérico, o ErrorState + retry si perfil() también
// falló. El acceso cero a datos lo garantiza RLS (§14.3), no esta pantalla.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/fd/button";
import { ErrorState } from "@/components/fd/error-state";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { useSession, type EstadoCuenta } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";

type EstadoGate = Exclude<EstadoCuenta, "activo">;

/** Espejo de la RPC crm.mi_estado_cuenta() (migración 012). */
type EstadoCuentaRow = {
  estado_cuenta: EstadoCuenta | null;
  rechazo_motivo: string | null;
};

type GateState =
  | { kind: "loading" }
  | { kind: "resolved"; estado: EstadoCuenta; motivo: string | null }
  /** La RPC falló — se degrada al estado del contexto de sesión (perfil()). */
  | { kind: "fallback" };

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
  const [gate, setGate] = useState<GateState>({ kind: "loading" });

  // Sin setState previo al await: el estado inicial ya es "loading" y el reset
  // de los retries vive en su event handler (react-hooks/set-state-in-effect).
  const loadEstadoCuenta = useCallback(async () => {
    const { data, error } = await getSupabase().rpc("mi_estado_cuenta");
    if (error) {
      setGate({ kind: "fallback" });
      return;
    }
    const row = data as EstadoCuentaRow | null;
    const motivo =
      typeof row?.rechazo_motivo === "string" && row.rechazo_motivo.trim() !== ""
        ? row.rechazo_motivo.trim()
        : null;
    // Ambos campos null (sin fila en crm.usuarios) ⇒ pendiente genérico.
    setGate({ kind: "resolved", estado: row?.estado_cuenta ?? "pendiente_aprobacion", motivo });
  }, []);

  useEffect(() => {
    if (status !== "signedIn") return;
    // IIFE async: los setState de loadEstadoCuenta() quedan detrás del await (set-state-in-effect)
    void (async () => {
      await loadEstadoCuenta();
    })();
  }, [status, loadEstadoCuenta]);

  // Refetch al recuperar foco (mismo criterio que solicitudes): si el admin aprobó
  // con esta tab abierta, la card se entera sola — el copy promete "no hacer nada más".
  useEffect(() => {
    if (status !== "signedIn") return;
    const onFocus = () => void loadEstadoCuenta();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [status, loadEstadoCuenta]);

  useEffect(() => {
    if (status === "signedOut") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    const activo =
      (gate.kind === "resolved" && gate.estado === "activo") || perfil?.estado === "activo";
    if (activo) router.replace("/inicio");
  }, [gate, perfil, router]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.replace("/login");
  };

  // Estado efectivo de la card: mi_estado_cuenta() manda; si falló, perfil().
  let estadoGate: EstadoGate | null = null;
  let motivo: string | null = null;
  if (gate.kind === "resolved" && gate.estado !== "activo") {
    estadoGate = gate.estado;
    motivo = gate.estado === "rechazado" ? gate.motivo : null;
  } else if (gate.kind === "fallback" && perfil && perfil.estado !== "activo") {
    estadoGate = perfil.estado;
  }

  if (status === "signedIn" && gate.kind === "fallback" && perfilError) {
    return (
      <GateFrame>
        <div className="gate-card">
          <ErrorState
            title="No pudimos resolver el estado de tu cuenta"
            detail={perfilError}
            onRetry={() => {
              setGate({ kind: "loading" });
              void refreshPerfil();
              void loadEstadoCuenta();
            }}
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

  if (status !== "signedIn" || !estadoGate) {
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

  const ui = ESTADO_UI[estadoGate];
  const body =
    estadoGate === "rechazado" && motivo
      ? "Un administrador rechazó tu solicitud de acceso. Este es el motivo que indicó:"
      : ui.body;

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
          {body}
        </p>
        {motivo && (
          <blockquote
            style={{
              margin: 0,
              width: "100%",
              textAlign: "left",
              padding: "12px 14px",
              borderRadius: "var(--radius-input)",
              background: ui.tint,
              border: `1px solid ${ui.line}`,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: ui.color,
              }}
            >
              Motivo indicado por administración
            </span>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                lineHeight: 1.6,
                color: "var(--color-text-primary)",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {motivo}
            </p>
          </blockquote>
        )}
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
