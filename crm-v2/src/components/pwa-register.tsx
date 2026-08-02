"use client";

// Capa PWA del cliente (2026-08-02): registro del service worker + aviso de versión
// nueva. Client components mínimos montados desde el layout raíz. Silenciosos a
// propósito: si el navegador no soporta SW o los checks fallan, la web sigue
// funcionando exactamente igual — la PWA es una capa opcional, nunca una dependencia.
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* sin SW la app funciona igual — degradación silenciosa deliberada */
      });
    }
  }, []);
  return null;
}

// ── Notificaciones push (2026-08-02) ────────────────────────────────────────────
// El resumen diario de alertas llega como notificación de Android. Suscripción:
// permiso → pushManager.subscribe(VAPID pública) → crm_push_subscribe (RPC).
// El menú de usuario del shell ofrece activar/desactivar; la confirmación es una
// notificación LOCAL inmediata (no pasa por el server: prueba permiso + display).

export type EstadoPush = "activas" | "inactivas" | "no-soportado";

function base64UrlToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function estadoPush(): Promise<EstadoPush> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "no-soportado";
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub ? "activas" : "inactivas";
  } catch {
    return "no-soportado";
  }
}

export async function activarPush(): Promise<{ ok: boolean; motivo?: string }> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return { ok: false, motivo: "Este navegador no soporta notificaciones." };
    }
    const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!clave) return { ok: false, motivo: "Falta configuración del servidor (VAPID)." };

    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") {
      return { ok: false, motivo: "El permiso quedó denegado — se habilita desde Ajustes → Notificaciones." };
    }

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(clave) as BufferSource,
    });
    const json = sub.toJSON();
    const { error } = await getSupabase().rpc("crm_push_subscribe", {
      p_endpoint: sub.endpoint,
      p_p256dh: json.keys?.p256dh ?? "",
      p_auth: json.keys?.auth ?? "",
      p_user_agent: navigator.userAgent.slice(0, 300),
    });
    if (error) {
      await sub.unsubscribe(); // no dejar una suscripción huérfana que nadie conoce
      return { ok: false, motivo: "No se pudo guardar la suscripción en el sistema." };
    }

    void reg.showNotification("Notificaciones activadas ✅", {
      body: "Así van a llegar las alertas del CRM en este dispositivo.",
      icon: "/icons/icon-192.png",
      tag: "crm-bienvenida",
    });
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Error inesperado al activar las notificaciones." };
  }
}

export async function desactivarPush(): Promise<{ ok: boolean; motivo?: string }> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return { ok: true }; // ya estaba desactivado
    // primero la DB (mientras el JWT sigue vivo), después el navegador
    await getSupabase().rpc("crm_push_unsubscribe", { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
    return { ok: true };
  } catch {
    return { ok: false, motivo: "Error inesperado al desactivar." };
  }
}

// ── Aviso de actualización ──────────────────────────────────────────────────────
// Problema que resuelve: la app instalada (TWA) puede quedar días viva en recientes
// corriendo un bundle viejo — la navegación es network-first, pero nadie navega si la
// app quedó abierta en la misma pantalla. Este componente compara el BUILD_ID propio
// (inlineado en el bundle) contra /api/version al volver a primer plano y cada 15 min,
// y si difieren muestra un aviso persistente con el botón de actualizar.

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const PRIMER_CHECK_MS = 30 * 1000; // no competir con el arranque de la app
const DESCARTADA_KEY = "crm-update-descartada"; // sessionStorage: versión ya descartada

export function UpdateAlert() {
  const [visible, setVisible] = useState(false);
  const [versionNueva, setVersionNueva] = useState<string | null>(null);
  const miVersion = process.env.NEXT_PUBLIC_BUILD_ID;

  useEffect(() => {
    if (!miVersion || miVersion === "dev") return; // en dev no hay deploys que avisar
    let activo = true;

    const check = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return;
        const j: { id?: string } = await r.json();
        if (!activo || !j.id || j.id === miVersion) return;
        if (sessionStorage.getItem(DESCARTADA_KEY) === j.id) return;
        setVersionNueva(j.id);
        setVisible(true);
      } catch {
        /* sin red o server caído: el aviso no es crítico */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };

    document.addEventListener("visibilitychange", onVisible);
    const primero = window.setTimeout(check, PRIMER_CHECK_MS);
    const intervalo = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      activo = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(primero);
      window.clearInterval(intervalo);
    };
  }, [miVersion]);

  if (!visible) return null;

  const actualizar = () => {
    // El SW también se refresca en el camino; la navegación es network-first así que
    // el reload trae el bundle nuevo sí o sí.
    navigator.serviceWorker
      ?.getRegistration()
      .then((r) => r?.update())
      .catch(() => {})
      .finally(() => window.location.reload());
  };

  const descartar = () => {
    if (versionNueva) sessionStorage.setItem(DESCARTADA_KEY, versionNueva);
    setVisible(false);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        zIndex: 130, // por encima del stack de toasts (120)
        width: "min(440px, calc(100vw - 24px))",
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "12px 14px",
        background: "var(--color-surface-1)",
        border: "1px solid var(--color-border-strong)",
        borderLeft: "2px solid var(--color-accent-500)",
        borderRadius: "var(--radius-input)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
        animation: "fd-toast-in 200ms var(--ease-out-expo)",
      }}
    >
      <i
        className="ti ti-refresh-dot"
        aria-hidden
        style={{ color: "var(--color-accent-500)", fontSize: 18, flexShrink: 0 }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
          Nueva versión disponible
        </div>
        <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginTop: 2 }}>
          El sistema se actualizó — tocá para tener lo último.
        </div>
      </div>
      <button
        type="button"
        onClick={actualizar}
        style={{
          flexShrink: 0,
          padding: "8px 14px",
          minHeight: 36, // objetivo táctil cómodo en el teléfono
          border: "1px solid var(--color-accent-line)",
          borderRadius: "var(--radius-input)",
          background: "var(--color-accent-tint)",
          color: "var(--color-accent-500)",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Actualizar
      </button>
      <button
        type="button"
        aria-label="descartar aviso de actualización"
        onClick={descartar}
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          padding: 0,
          display: "inline-grid",
          placeItems: "center",
          border: "none",
          background: "transparent",
          color: "var(--color-text-faint)",
          fontSize: 14,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        <i className="ti ti-x" aria-hidden />
      </button>
    </div>
  );
}
