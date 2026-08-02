"use client";

// Store compartido de crm.get_pendientes() (pasada mobile 2026-08-02): la campana del
// header Y el badge de Alertas del bottom-bar muestran los mismos contadores — un solo
// poller a nivel módulo alimenta a todos los suscriptores, sin duplicar RPCs.
// Semántica idéntica a la que tenía NotificationBell: carga al montar, refresh en
// focus/visibilitychange→visible y cada 60s SOLO con la pestaña visible; si la RPC
// falla, data=null en silencio.
import { useSyncExternalStore } from "react";
import { getSupabase } from "@/lib/supabase";

/** Espejo de crm.get_pendientes() — jsonb de CONTADORES, ya scopeado por rol en la DB
 * (reforzados_pendientes solo sup+, solicitudes_acceso solo admin: si la clave no
 * viene, esa línea no se muestra — no hace falta repetir el gate acá). */
export type Pendientes = {
  pendientes_ingreso: number;
  pendientes_devolucion: number;
  alertas: { amarillo: number; rojo: number };
  reforzados_pendientes?: number;
  solicitudes_acceso?: number;
};

export type PendientesState = { data: Pendientes | null; loaded: boolean };

let state: PendientesState = { data: null, loaded: false };
const listeners = new Set<() => void>();
let interval: number | null = null;
let cargando = false;

async function load() {
  if (cargando) return;
  cargando = true;
  try {
    const { data, error } = await getSupabase().rpc("get_pendientes");
    state = error
      ? { data: null, loaded: true } // en silencio: sin toast — solo se cae a "sin datos"
      : { data: data as Pendientes, loaded: true };
  } catch {
    state = { data: null, loaded: true };
  } finally {
    cargando = false;
  }
  listeners.forEach((l) => l());
}

function onFocus() {
  void load();
}
function onVisibility() {
  if (document.visibilityState === "visible") void load();
}

function start() {
  void load();
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibility);
  interval = window.setInterval(() => {
    if (document.visibilityState === "visible") void load();
  }, 60_000);
}

function stop() {
  window.removeEventListener("focus", onFocus);
  document.removeEventListener("visibilitychange", onVisibility);
  if (interval !== null) window.clearInterval(interval);
  interval = null;
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

const getSnapshot = () => state;
const SERVER_SNAPSHOT: PendientesState = { data: null, loaded: false };
const getServerSnapshot = () => SERVER_SNAPSHOT;

/** Contadores de pendientes compartidos. Mientras haya ≥1 componente suscripto, el
 * poller corre una sola vez para todos. */
export function usePendientes(): PendientesState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
