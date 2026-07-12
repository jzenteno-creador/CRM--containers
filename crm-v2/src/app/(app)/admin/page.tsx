"use client";

// Hub Admin (M9): tablero de entrada a las 5 secciones de administración.
// De M2 a M9 esta ruta era un redirect a /admin/solicitudes; ahora es el índice.
// Guard admin (patrón solicitudes §14.7): rol SIEMPRE desde perfil() vía contexto
// de sesión, skeleton mientras resuelve, redirect a /inicio si no corresponde.
// El shell ya oculta la solapa a no-admins, pero cada ruta admin repite el guard —
// el enforcement real de datos es RLS.

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageHeader } from "@/components/fd/page-header";
import { QuickLink } from "@/components/fd/quick-link";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { useSession } from "@/lib/session";

const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

export default function AdminHubPage() {
  const router = useRouter();
  const { perfil } = useSession();
  const isAdmin = perfil?.rol === "administrador";

  // solo admin (§7): el resto vuelve al inicio. RLS protege los datos igual.
  useEffect(() => {
    if (perfil && !isAdmin) router.replace("/inicio");
  }, [perfil, isAdmin, router]);

  if (!isAdmin) {
    // perfil aún sin resolver (o guard redirigiendo): skeleton con la misma grilla
    return (
      <>
        <PageHeader title="Administración" />
        <div style={GRID} aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} height={74} delay={i * 150} style={{ borderRadius: "var(--radius-input)" }} />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Administración" />
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.55 }}>
        Gestión del sistema, exclusiva del rol administrador. Los permisos reales se aplican en la base de datos
        (RLS): esconder una pantalla nunca es la seguridad.
      </p>
      <nav aria-label="secciones de administración" style={GRID}>
        <QuickLink href="/admin/solicitudes" icon="ti-user-check" title="Solicitudes de acceso">
          Aprobá, rechazá y suspendé cuentas del CRM.
        </QuickLink>
        <QuickLink href="/admin/navieras" icon="ti-ship" title="Navieras">
          Alta y edición de líneas navieras y su detention en origen.
        </QuickLink>
        <QuickLink href="/admin/tarifas" icon="ti-receipt-2" title="Tarifas de freetime">
          Días libres y USD/día por naviera, con historial versionado.
        </QuickLink>
        <QuickLink href="/admin/plantas" icon="ti-building-factory-2" title="Plantas">
          Listado de plantas operativas (solo lectura).
        </QuickLink>
        <QuickLink href="/admin/configuracion" icon="ti-settings" title="Configuración">
          Umbral del semáforo amarillo de freetime.
        </QuickLink>
      </nav>
    </>
  );
}
