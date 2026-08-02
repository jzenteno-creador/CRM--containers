"use client";

// Gate de sesión del área operativa (M2 §12): sin sesión → /login; con sesión pero
// estado ≠ activo → /espera-aprobacion; activo → renderiza el shell. La compuerta
// real de datos es RLS (§14.3) — esto es el ruteo visual encima.
// Mientras se resuelve sesión/perfil: skeleton shimmer (nunca spinner). Si la RPC
// perfil() falla (ej: Data API sin exponer `crm`): ErrorState con retry + logout.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/fd/button";
import { BootSplash } from "@/components/fd/boot-splash";
import { ErrorState } from "@/components/fd/error-state";
import { GateFrame } from "@/components/fd/gate-frame";
import { useSession } from "@/lib/session";

// Garantía de escena del boot-splash: la sesión suele resolver en 200-800ms; el
// splash corre EN PARALELO y se mantiene un mínimo para que la secuencia de
// marca se lea completa (contenedor dibujándose + wordmark). No es tiempo
// agregado en cargas lentas: es max(carga, MIN_BOOT_MS).
const MIN_BOOT_MS = 1400;

export function AppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, perfil, perfilError, refreshPerfil, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [bootListo, setBootListo] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setBootListo(true), MIN_BOOT_MS);
    return () => window.clearTimeout(t);
  }, []);

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
      <GateFrame>
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
      </GateFrame>
    );
  }

  if (status === "signedIn" && perfil?.estado === "activo" && bootListo) {
    return <>{children}</>;
  }

  // loading, garantía de escena del boot, signedOut o estado ≠ activo (redirigiendo)
  return <BootSplash />;
}
