"use client";

// Registro del service worker de la PWA (2026-08-02). Client component mínimo montado
// desde el layout raíz. Silencioso a propósito: si el navegador no soporta SW o el
// registro falla, la web sigue funcionando exactamente igual — la PWA es una capa
// opcional, nunca una dependencia.
import { useEffect } from "react";

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
