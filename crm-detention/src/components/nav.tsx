"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "./session-context";

const TABS = [
  { href: "/inicio", label: "Inicio", icon: "ti-layout-dashboard" },
  { href: "/ingreso", label: "Ingreso", icon: "ti-login-2" },
  { href: "/egreso", label: "Egreso", icon: "ti-logout-2" },
  { href: "/contenedores", label: "Contenedores", icon: "ti-list-details" },
  { href: "/alertas", label: "Alertas", icon: "ti-bell" },
  { href: "/incidencias", label: "Incidencias", icon: "ti-alert-triangle" },
  { href: "/admin", label: "Admin", icon: "ti-settings", adminOnly: true },
];

export function CrmNav() {
  const pathname = usePathname();
  const session = useSession();

  return (
    <nav className="crm-nav">
      {TABS.filter((t) => !t.adminOnly || session.rol === "administrador").map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={pathname.startsWith(t.href) ? "active" : ""}
        >
          <i className={`ti ${t.icon}`} aria-hidden /> {t.label}
        </Link>
      ))}
    </nav>
  );
}
