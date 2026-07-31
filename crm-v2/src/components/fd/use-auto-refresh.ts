"use client";

// Auto-refresco genérico (P2, auditoría 2026-07-31 — pantallas "EN VIVO" sin respaldo):
// mismo patrón que la campana de notificaciones (shell.tsx, NotificationBell) —
// setInterval + chequeo de document.visibilityState para NO refetchear con la pestaña
// oculta, cleanup siempre en unmount. No dispara al montar: el caller sigue siendo
// dueño de su propio load() inicial (mismo criterio que la campana, que separa el
// efecto de montaje del efecto de intervalo).
//
// Lo consumen /inicio y /alertas — las dos pantallas pensadas para quedar abiertas en
// un monitor de pared, donde un fetch-solo-al-montar deja los números stale por horas.

import { useEffect } from "react";

export function useAutoRefresh(fn: () => void, ms: number): void {
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fn();
    }, ms);
    return () => clearInterval(id);
  }, [fn, ms]);
}
