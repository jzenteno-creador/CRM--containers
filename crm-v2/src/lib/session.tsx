"use client";

// Contexto de sesión (M2 §12): la identidad autoritativa del caller se resuelve
// SIEMPRE vía la RPC crm.perfil() — jamás user_metadata para autorización (§14.7).
// user_metadata.nombre se usa exclusivamente como texto de display en el shell.
// Si la RPC falla (ej: schema `crm` aún no expuesto en la Data API) el contexto
// expone `perfilError` para que los guards muestren ErrorState + retry, nunca
// una pantalla rota.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

export type Rol = "operador" | "supervisor" | "administrador";
export type EstadoCuenta = "pendiente_aprobacion" | "activo" | "rechazado" | "suspendido";

export const ROL_LABELS: Record<Rol, string> = {
  operador: "Operador",
  supervisor: "Supervisor",
  administrador: "Administrador",
};

/** Espejo de la RPC crm.perfil() (§14.2) — única fuente de rol/estado en el front. */
export type Perfil = {
  usuario_id: string;
  rol: Rol | null;
  planta_asignada_id: string | null;
  estado: EstadoCuenta;
};

export type SessionStatus = "loading" | "signedOut" | "signedIn";

type SessionContextValue = {
  status: SessionStatus;
  /** Email de la sesión de auth (solo display). */
  email: string | null;
  /** Nombre de user_metadata (SOLO display — §14.7: la autorización vive en `perfil`). */
  displayName: string | null;
  /** Identidad autoritativa; null mientras se resuelve o si la RPC falló. */
  perfil: Perfil | null;
  /** Mensaje operativo si la RPC perfil() falló. */
  perfilError: string | null;
  refreshPerfil: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession requiere <SessionProvider> en el árbol (lo monta el layout raíz).");
  }
  return ctx;
}

/** Traducción del error PostgREST/red de perfil() a texto operativo en español. */
function perfilErrorMessage(message: string, code?: string): string {
  if (code === "PGRST106" || /schema must be one of/i.test(message)) {
    return "La API de datos todavía no expone el schema del CRM (Data API → exposed schemas). Avisá a administración y reintentá.";
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "No hay conexión con el servidor. Verificá tu red y reintentá.";
  }
  return `No se pudo resolver tu perfil: ${message}`;
}

type PerfilRow = {
  usuario_id: string | null;
  rol: Rol | null;
  planta_asignada_id: string | null;
  estado: EstadoCuenta | null;
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [perfilError, setPerfilError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  const refreshPerfil = useCallback(async () => {
    const supabase = getSupabase();
    setPerfilError(null);
    const { data, error } = await supabase.rpc("perfil");
    if (error) {
      setPerfil(null);
      setPerfilError(perfilErrorMessage(error.message, error.code));
      return;
    }
    const row = data as PerfilRow | null;
    if (!row?.usuario_id || !row.estado) {
      // Sin fila en crm.usuarios: el trigger handle_new_user no corrió — caso anómalo.
      setPerfil(null);
      setPerfilError("Tu cuenta no está registrada en el CRM. Contactá a administración de SSB.");
      return;
    }
    setPerfil({
      usuario_id: row.usuario_id,
      rol: row.rol,
      planta_asignada_id: row.planta_asignada_id,
      estado: row.estado,
    });
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        userIdRef.current = null;
        setPerfil(null);
        setPerfilError(null);
        setStatus("signedOut");
        return;
      }
      if (event === "PASSWORD_RECOVERY") {
        // B8.1 (M5): el link de recovery generado desde el Dashboard redirige al Site URL
        // raíz y la sesión temporal entraba como login normal — el usuario quedaba adentro
        // sin cambiar la clave (bug del handoff 2026-07-13). Se fuerza SIEMPRE el form de
        // cambio; replace() para no dejar la ruta intermedia en el historial. Los tokens del
        // hash ya fueron consumidos por el SDK: la sesión temporal sobrevive a la navegación.
        setStatus("signedIn");
        userIdRef.current = nextSession.user.id;
        if (window.location.pathname !== "/auth/actualizar-password") {
          window.location.replace("/auth/actualizar-password");
        }
        return;
      }
      setStatus("signedIn");
      const changedUser = userIdRef.current !== nextSession.user.id;
      userIdRef.current = nextSession.user.id;
      if (changedUser || event === "SIGNED_IN") {
        // setTimeout: no bloquear el lock interno de GoTrue con llamadas dentro del callback
        window.setTimeout(() => {
          void (async () => {
            // Auto-reparación best-effort de la fila espejo (migración 016): si el
            // trigger de signup cayó en su catch defensivo, el usuario quedó sin fila
            // en crm.usuarios ("muerto"). sync_mi_usuario() la recrea desde auth.users
            // antes de leer el perfil. Si falla (schema aún sin exponer, red), se
            // ignora: perfil() degrada como ya lo hace.
            try {
              await getSupabase().rpc("sync_mi_usuario");
            } catch {
              // best-effort: la auto-reparación nunca corta el flujo de sesión
            }
            await refreshPerfil();
          })();
        }, 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshPerfil]);

  const signOut = useCallback(async () => {
    // Ante error de red igual se limpia la sesión local; el estado lo actualiza
    // el evento SIGNED_OUT del listener.
    await getSupabase().auth.signOut();
  }, []);

  const value = useMemo<SessionContextValue>(() => {
    const meta = session?.user.user_metadata as { nombre?: unknown } | undefined;
    const metaNombre = typeof meta?.nombre === "string" && meta.nombre.trim() !== "" ? meta.nombre.trim() : null;
    const email = session?.user.email ?? null;
    return {
      status,
      email,
      displayName: metaNombre ?? (email ? email.split("@")[0] : null),
      perfil,
      perfilError,
      refreshPerfil,
      signOut,
    };
  }, [status, session, perfil, perfilError, refreshPerfil, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
