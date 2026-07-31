"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { DesignClient } from "./design-client";

// Ruta dev-only (plan 1.6, Decisión 5): grilla con TODOS los componentes del design
// system en TODOS sus estados (equivalente al artboard 2f). Herramienta del review de
// M0, de la consistencia inter-módulos y de la pasada visual final pre-CP3. No linkeada.
// Gate (fix P3 de auditoría, 2026-07-31): el único gate previo era AppGate (cuenta
// "activo") — cualquier operador/supervisor activo podía entrar tipeando la URL. Ahora
// entra por NEXT_PUBLIC_SHOW_DESIGN=1 (bypass total, para el review sin depender de rol)
// O el perfil resuelto es administrador. Guard admin (mismo patrón que
// admin/plantas|configuracion|ayuda §14.7): blanco mientras se resuelve el perfil +
// router.replace("/inicio") si no corresponde — RLS/RPC siguen siendo la compuerta real
// de datos, esto es solo UX de ruta.
export default function DesignPage() {
  const router = useRouter();
  const { perfil } = useSession();

  const flagOn = process.env.NEXT_PUBLIC_SHOW_DESIGN === "1";
  const isAdmin = perfil?.rol === "administrador";
  const allowed = flagOn || isAdmin;

  useEffect(() => {
    if (!flagOn && perfil && !isAdmin) router.replace("/inicio");
  }, [flagOn, perfil, isAdmin, router]);

  if (!allowed) return null;
  return <DesignClient />;
}
