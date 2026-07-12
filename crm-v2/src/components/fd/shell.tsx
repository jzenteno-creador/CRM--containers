"use client";

// Shell Flight Deck (plan 1.4): rail izquierdo fijo 60px (desktop ≥900px) con íconos
// Tabler + tooltip + ítem activo cyan; bottom-nav en móvil. Header 58px: título
// contextual, búsqueda global (placeholder — wiring M5), campana con badge
// (placeholder — wiring M6), "?" contextual (contenido M10), reloj mono y menú de
// usuario con sesión real (M2): nombre/correo/rol + logout. La solapa Admin solo
// aparece para rol administrador (§8) — RLS sigue siendo la compuerta real.
// En móvil el header colapsa a título + campana + menú (búsqueda y "?" van al menú).

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ROL_LABELS, useSession } from "@/lib/session";
import { CommandPalette } from "./command-palette";
import { Dropdown, Popover } from "./dropdown";
import { HelpPanel } from "./help-panel";
import { Markdown } from "./markdown";

// Solapas §8 — Admin se filtra por rol (abajo, en FdShell).
// `built`: la ruta existe hoy. Las no construidas (llegan con M3+) se renderizan
// deshabilitadas — sin <Link>, así Next no las prefetchea (evita el 404 en red) ni
// navega al click (evita el 404 en pantalla). Al construir cada módulo, poné true.
const TABS = [
  { href: "/inicio", label: "Inicio", icon: "ti-layout-dashboard", built: true },
  { href: "/ingreso", label: "Ingreso", icon: "ti-login-2", built: false },
  { href: "/egreso", label: "Egreso", icon: "ti-logout-2", built: false },
  { href: "/contenedores", label: "Contenedores", icon: "ti-list-details", built: false },
  { href: "/alertas", label: "Alertas", icon: "ti-bell", built: false },
  { href: "/incidencias", label: "Incidencias", icon: "ti-alert-triangle", built: false },
  { href: "/admin", label: "Admin", icon: "ti-settings", built: true },
  { href: "/ayuda", label: "Ayuda", icon: "ti-help-circle", built: false },
];

const SOON_TIP = "Próximamente (M3)";

const HELP_PLACEHOLDER = `El contenido de ayuda de cada solapa se edita desde **Admin** sobre \`ayuda_contenido\` (llega con M10) y cubre:

- qué es esta solapa,
- qué completa cada campo,
- el flujo de trabajo en 3-5 pasos.

> Mientras tanto: el banco completo de consultas va a vivir en la solapa **Ayuda**.`;

/** Reloj en hora AR (mono). Client-only: renderiza placeholder hasta el mount. */
function ClockAR() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="fd-clock mono" suppressHydrationWarning>
      {time ?? "--:--:--"}
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

/** Iniciales para el avatar (display): 2 letras del nombre, fallback correo. */
function initialsOf(name: string | null, email: string | null): string {
  const source = (name ?? "").trim() || email || "";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase() || "—";
}

export function FdShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { displayName, email, perfil, signOut } = useSession();
  const [helpOpen, setHelpOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // §8: Admin solo para administradores (el rol viene de perfil(), no de metadata)
  const tabs = TABS.filter((t) => t.href !== "/admin" || perfil?.rol === "administrador");

  const activeTab = tabs.find((t) => pathname.startsWith(t.href));
  const title = activeTab?.label ?? "SSB·DETENTION";

  const openSearch = () => window.dispatchEvent(new CustomEvent("fd-palette"));

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    router.replace("/login");
  };

  return (
    <div className="fd-shell">
      <CommandPalette />
      <HelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={title}
        footer={
          <Link href="/ayuda" onClick={() => setHelpOpen(false)}>
            Ver el banco completo de consultas →
          </Link>
        }
      >
        <Markdown source={HELP_PLACEHOLDER} />
      </HelpPanel>

      {/* rail desktop */}
      <aside className="fd-rail">
        <span className="dot-logo fd-rail-logo" title="SSB · DETENTION">
          S
        </span>
        {tabs.map((t) =>
          t.built ? (
            <Link key={t.href} href={t.href} className={pathname.startsWith(t.href) ? "active" : ""} aria-label={t.label}>
              <i className={`ti ${t.icon}`} aria-hidden />
              <span className="fd-tip">{t.label}</span>
            </Link>
          ) : (
            <span key={t.href} className="fd-soon" aria-disabled="true" aria-label={`${t.label} — ${SOON_TIP}`}>
              <i className={`ti ${t.icon}`} aria-hidden />
              <span className="fd-tip">
                {t.label} · {SOON_TIP}
              </span>
            </span>
          ),
        )}
        <span className="fd-rail-spacer" />
      </aside>

      <div className="fd-main">
        <header className="fd-header">
          <span className="fd-title fd-display">{title}</span>
          {pathname.startsWith("/inicio") && (
            <span className="fd-live hide-md">
              <i aria-hidden /> EN VIVO
            </span>
          )}
          <span style={{ flex: 1 }} />

          {/* búsqueda global — desktop (móvil: dentro del menú) */}
          <button type="button" className="fd-kbd hide-md" title="Buscar (⌘K)" onClick={openSearch}>
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
            onClick={() => setHelpOpen(true)}
          >
            <i className="ti ti-help-circle" aria-hidden />
          </button>

          <ClockAR />

          {/* menú de usuario — sesión real (M2): identidad de perfil() + logout */}
          <Dropdown
            align="right"
            width={230}
            header={
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-text-primary)" }}>
                  {displayName ?? "—"}
                </div>
                {email && (
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--color-text-faint)", marginTop: 2 }}>
                    {email}
                  </div>
                )}
                {perfil?.rol && (
                  <div style={{ fontSize: 11, color: "var(--color-accent-500)", marginTop: 4 }}>
                    {ROL_LABELS[perfil.rol]}
                  </div>
                )}
              </div>
            }
            items={[
              { id: "buscar", label: "Buscar (⌘K)", icon: "ti-search", onSelect: openSearch },
              { id: "ayuda", label: "Ayuda de esta solapa", icon: "ti-help-circle", onSelect: () => setHelpOpen(true) },
              {
                id: "logout",
                label: signingOut ? "Cerrando sesión…" : "Cerrar sesión",
                icon: "ti-logout",
                danger: true,
                disabled: signingOut,
                divider: true,
                onSelect: () => void handleSignOut(),
              },
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
                <span className="fd-avatar">{initialsOf(displayName, email)}</span>
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
        {tabs.map((t) =>
          t.built ? (
            <Link key={t.href} href={t.href} className={pathname.startsWith(t.href) ? "active" : ""}>
              <i className={`ti ${t.icon}`} aria-hidden />
              {t.label}
            </Link>
          ) : (
            <span key={t.href} className="fd-soon" aria-disabled="true" title={SOON_TIP}>
              <i className={`ti ${t.icon}`} aria-hidden />
              {t.label}
            </span>
          ),
        )}
      </nav>
    </div>
  );
}
