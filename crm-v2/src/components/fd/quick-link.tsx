// QuickLink (design system): card de acceso rápido a otra solapa — ícono tonal cyan,
// título display y descripción de una línea (qué se hace en el destino). Nace con los
// accesos rápidos del dashboard (§8); el hover vive en `.fd-quick-link` (globals.css)
// con los tokens de motion fast 150ms.

import Link from "next/link";

export function QuickLink({
  href,
  icon,
  title,
  children,
}: {
  href: string;
  /** Clase de ícono Tabler, ej "ti-login-2". */
  icon: string;
  title: string;
  /** Descripción de UNA línea: qué se hace en la solapa destino. */
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="fd-quick-link">
      <span className="fd-quick-link-icon" aria-hidden>
        <i className={`ti ${icon}`} />
      </span>
      <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span className="fd-quick-link-title">{title}</span>
        <span className="fd-quick-link-desc">{children}</span>
      </span>
      <i className="ti ti-chevron-right fd-quick-link-chevron" aria-hidden />
    </Link>
  );
}
