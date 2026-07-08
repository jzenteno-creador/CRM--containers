"use client";

// Gate de sesión del área operativa (M2 §12): sin sesión → /login; con sesión pero
// estado ≠ activo → /espera-aprobacion; activo → renderiza el shell. La compuerta
// real de datos es RLS (§14.3) — esto es el ruteo visual encima.
// Mientras se resuelve sesión/perfil: skeleton shimmer (nunca spinner). Si la RPC
// perfil() falla (ej: Data API sin exponer `crm`): ErrorState con retry + logout.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/fd/button";
import { ErrorState } from "@/components/fd/error-state";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { useSession } from "@/lib/session";

/** Skeleton a pantalla completa con la atmósfera del gate (misma familia que .gate-page). */
function GateSkeleton() {
  return (
    <div className="gate-page">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className="dot-logo">S</span>
        <span className="wordmark">
          SSB<b>·</b>INTERNATIONAL
        </span>
      </div>
      <div className="gate-card" aria-busy="true" aria-label="cargando sesión">
        <SkeletonBlock width={44} height={44} style={{ borderRadius: "50%" }} />
        <SkeletonBlock width="55%" height={14} delay={150} />
        <SkeletonBlock width="80%" delay={300} />
        <SkeletonBlock width="70%" delay={450} />
      </div>
      <span className="mono" style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
        CRM DETENTION · v2
      </span>
    </div>
  );
}

export function AppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, perfil, perfilError, refreshPerfil, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (status === "signedOut") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (perfil && perfil.estado !== "activo") router.replace("/espera-aprobacion");
  }, [perfil, router]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.replace("/login");
  };

  if (status === "signedIn" && perfilError) {
    return (
      <div className="gate-page">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="dot-logo">S</span>
          <span className="wordmark">
            SSB<b>·</b>INTERNATIONAL
          </span>
        </div>
        <div className="gate-card">
          <ErrorState
            title="No pudimos resolver tu perfil"
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
        <span className="mono" style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
          CRM DETENTION · v2
        </span>
      </div>
    );
  }

  if (status === "signedIn" && perfil?.estado === "activo") {
    return <>{children}</>;
  }

  // loading, signedOut (mientras redirige) o estado ≠ activo (mientras redirige)
  return <GateSkeleton />;
}
