"use client";

// Shell Flight Deck: rail izquierdo 60px (desktop ≥900px) + header 58px + bottom-bar (mobile).
// El logout llega como server action desde el layout (server component).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "./session-context";
import { CommandPalette } from "./fd/command-palette";

const TABS = [
  { href: "/inicio", label: "Inicio", icon: "ti-layout-dashboard" },
  { href: "/ingreso", label: "Ingreso", icon: "ti-login-2" },
  { href: "/egreso", label: "Egreso", icon: "ti-logout-2" },
  { href: "/contenedores", label: "Contenedores", icon: "ti-list-details" },
  { href: "/historial", label: "Historial", icon: "ti-history" },
  { href: "/alertas", label: "Alertas", icon: "ti-bell" },
  { href: "/incidencias", label: "Incidencias", icon: "ti-alert-triangle" },
  { href: "/admin", label: "Admin", icon: "ti-settings", adminOnly: true },
];

/** Reloj en hora AR (mono). Client-only: renderiza vacío hasta el mount para no romper hidratación. */
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

export function FdChrome({
  scope,
  logout,
  children,
}: {
  scope: string;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const session = useSession();

  const tabs = TABS.filter((t) => !t.adminOnly || session.rol === "administrador");
  const activa = tabs.find((t) => pathname.startsWith(t.href));

  return (
    <div className="fd-shell">
      <CommandPalette />
      {/* rail desktop */}
      <aside className="fd-rail">
        <span className="dot-logo fd-rail-logo" title="SSB · DETENTION">
          S
        </span>
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={pathname.startsWith(t.href) ? "active" : ""}
            aria-label={t.label}
          >
            <i className={`ti ${t.icon}`} aria-hidden />
            <span className="fd-tip">{t.label}</span>
          </Link>
        ))}
        <span className="fd-rail-spacer" />
        <span className="fd-avatar" title={`${session.nombre} · ${session.rol}`}>
          {session.nombre.slice(0, 1).toUpperCase()}
        </span>
      </aside>

      <div className="fd-main">
        <header className="fd-header">
          <span className="fd-title fd-display">{activa?.label ?? "SSB·DETENTION"}</span>
          {pathname.startsWith("/inicio") && (
            <span className="fd-live">
              <i aria-hidden /> EN VIVO
            </span>
          )}
          <span style={{ flex: 1 }} />
          <span className="chip hide-sm">
            <i className="ti ti-map-pin" aria-hidden /> {scope}
          </span>
          <span className="chip hide-sm">
            <i className="ti ti-user" aria-hidden /> {session.nombre} · {session.rol}
          </span>
          <button
            type="button"
            className="fd-kbd"
            title="Buscar (⌘K)"
            onClick={() => window.dispatchEvent(new CustomEvent("fd-palette"))}
          >
            <i className="ti ti-search" aria-hidden />
            <kbd className="hide-sm">⌘K</kbd>
          </button>
          <ClockAR />
          <form action={logout}>
            <button type="submit" title="Cerrar sesión">
              <i className="ti ti-logout" aria-hidden /> <span className="hide-sm">salir</span>
            </button>
          </form>
        </header>
        <main className="fd-content">{children}</main>
      </div>

      {/* bottom-bar mobile: una línea con scroll horizontal, touch ≥44px */}
      <nav className="fd-bottombar">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={pathname.startsWith(t.href) ? "active" : ""}
          >
            <i className={`ti ${t.icon}`} aria-hidden />
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
