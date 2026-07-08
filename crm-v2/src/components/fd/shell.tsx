"use client";

// Shell Flight Deck (plan 1.4): rail izquierdo fijo 60px (desktop ≥900px) con íconos
// Tabler + tooltip + ítem activo cyan; bottom-nav en móvil. Header 58px: título
// contextual, búsqueda global (placeholder — wiring M5), campana con badge
// (placeholder — wiring M6), "?" contextual (contenido M10), reloj mono y menú de
// usuario con el Dropdown del sistema (sesión real en M2).
// En móvil el header colapsa a título + campana + menú (búsqueda y "?" van al menú).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CommandPalette } from "./command-palette";
import { Dropdown, Popover } from "./dropdown";
import { HelpPanel } from "./help-panel";
import { Markdown } from "./markdown";

// Solapas §8 — Admin se gatea por rol en M2 (en M0 no hay sesión: se muestran todas)
const TABS = [
  { href: "/inicio", label: "Inicio", icon: "ti-layout-dashboard" },
  { href: "/ingreso", label: "Ingreso", icon: "ti-login-2" },
  { href: "/egreso", label: "Egreso", icon: "ti-logout-2" },
  { href: "/contenedores", label: "Contenedores", icon: "ti-list-details" },
  { href: "/alertas", label: "Alertas", icon: "ti-bell" },
  { href: "/incidencias", label: "Incidencias", icon: "ti-alert-triangle" },
  { href: "/admin", label: "Admin", icon: "ti-settings" },
  { href: "/ayuda", label: "Ayuda", icon: "ti-help-circle" },
];

const AYUDA_PLACEHOLDER = `El contenido de ayuda de cada solapa se edita desde **Admin** sobre \`ayuda_contenido\` (llega con M10) y cubre:

- qué es esta solapa,
- qué completa cada campo,
- el flujo de trabajo en 3-5 pasos.

> Mientras tanto: el banco completo de consultas va a vivir en la solapa **Ayuda**.`;

/** Reloj en hora AR (mono). Client-only: renderiza placeholder hasta el mount. */
function ClockAR() {
  const [hora, setHora] = useState<string | null>(null);
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const tick = () => setHora(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="fd-clock mono" suppressHydrationWarning>
      {hora ?? "--:--:--"}
    </span>
  );
}

/** Campana de notificaciones — placeholder M0; get_pendientes() la conecta en M6. */
function NotificationBell() {
  return (
    <Popover
      align="right"
      width={280}
      trigger={(p) => (
        <button type="button" className="fd-iconbtn" title="Notificaciones" aria-label="notificaciones" onClick={p.toggle} aria-expanded={p["aria-expanded"]} aria-controls={p["aria-controls"]}>
          <i className="ti ti-bell" aria-hidden />
        </button>
      )}
    >
      <div style={{ padding: "14px 16px" }}>
        <div className="fd-label" style={{ marginBottom: 8 }}>
          Notificaciones
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.55 }}>
          Los pendientes por rol (ingresos, terminal, alertas, solicitudes de acceso) se conectan con{" "}
          <span className="mono">get_pendientes()</span> en M6.
        </p>
      </div>
    </Popover>
  );
}

export function FdShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [ayudaAbierta, setAyudaAbierta] = useState(false);

  const activa = TABS.find((t) => pathname.startsWith(t.href));
  const titulo = activa?.label ?? "SSB·DETENTION";

  const abrirBusqueda = () => window.dispatchEvent(new CustomEvent("fd-palette"));

  return (
    <div className="fd-shell">
      <CommandPalette />
      <HelpPanel
        open={ayudaAbierta}
        onClose={() => setAyudaAbierta(false)}
        titulo={titulo}
        footer={
          <Link href="/ayuda" onClick={() => setAyudaAbierta(false)}>
            Ver el banco completo de consultas →
          </Link>
        }
      >
        <Markdown source={AYUDA_PLACEHOLDER} />
      </HelpPanel>

      {/* rail desktop */}
      <aside className="fd-rail">
        <span className="dot-logo fd-rail-logo" title="SSB · DETENTION">
          S
        </span>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={pathname.startsWith(t.href) ? "active" : ""} aria-label={t.label}>
            <i className={`ti ${t.icon}`} aria-hidden />
            <span className="fd-tip">{t.label}</span>
          </Link>
        ))}
        <span className="fd-rail-spacer" />
      </aside>

      <div className="fd-main">
        <header className="fd-header">
          <span className="fd-title fd-display">{titulo}</span>
          {pathname.startsWith("/inicio") && (
            <span className="fd-live hide-md">
              <i aria-hidden /> EN VIVO
            </span>
          )}
          <span style={{ flex: 1 }} />

          {/* búsqueda global — desktop (móvil: dentro del menú) */}
          <button type="button" className="fd-kbd hide-md" title="Buscar (⌘K)" onClick={abrirBusqueda}>
            <i className="ti ti-search" aria-hidden />
            <kbd
              className="mono"
              style={{
                fontSize: 10.5,
                color: "var(--color-text-muted)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: 4,
                padding: "1px 5px",
              }}
            >
              ⌘K
            </kbd>
          </button>

          <NotificationBell />

          {/* "?" contextual — desktop (móvil: dentro del menú) */}
          <button
            type="button"
            className="fd-iconbtn hide-md"
            title="Ayuda de esta solapa"
            aria-label="ayuda de esta solapa"
            onClick={() => setAyudaAbierta(true)}
          >
            <i className="ti ti-help-circle" aria-hidden />
          </button>

          <ClockAR />

          {/* menú de usuario (Dropdown del sistema) — sesión real en M2 */}
          <Dropdown
            align="right"
            width={220}
            header={
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-text-primary)" }}>Sin sesión</div>
                <div style={{ fontSize: 11, color: "var(--color-text-faint)", marginTop: 2 }}>
                  el login se conecta en M2
                </div>
              </div>
            }
            items={[
              { id: "buscar", label: "Buscar (⌘K)", icon: "ti-search", onSelect: abrirBusqueda },
              { id: "ayuda", label: "Ayuda de esta solapa", icon: "ti-help-circle", onSelect: () => setAyudaAbierta(true) },
              { id: "logout", label: "Cerrar sesión", icon: "ti-logout", disabled: true, divider: true },
            ]}
            trigger={(p) => (
              <button
                type="button"
                title="Menú de usuario"
                aria-label="menú de usuario"
                onClick={p.toggle}
                aria-expanded={p["aria-expanded"]}
                aria-controls={p["aria-controls"]}
                style={{ border: "none", background: "transparent", padding: 0, minHeight: 0, display: "inline-flex" }}
              >
                <span className="fd-avatar">—</span>
              </button>
            )}
          />
        </header>

        {/* re-key por ruta: view transition 250ms sin cortes secos */}
        <main key={pathname} className="fd-content fd-view">
          {children}
        </main>
      </div>

      {/* bottom-nav móvil: una línea con scroll horizontal, touch ≥44px */}
      <nav className="fd-bottombar">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={pathname.startsWith(t.href) ? "active" : ""}>
            <i className={`ti ${t.icon}`} aria-hidden />
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
