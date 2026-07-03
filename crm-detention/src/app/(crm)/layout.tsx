import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SessionProvider } from "@/components/session-context";
import { CrmNav } from "@/components/nav";
import { logout } from "@/app/login/actions";

export default async function CrmLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) redirect("/login");

  const scope =
    session.rol === "operador" && session.plantaNombre
      ? `planta: ${session.plantaNombre}`
      : "todas las plantas";

  return (
    <div className="crm-wrap">
      <div className="crm-top">
        <div className="crm-brand">
          <i className="ti ti-box" aria-hidden /> CRM Detention · SSB
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="chip">
            <i className="ti ti-map-pin" aria-hidden /> {scope}
          </span>
          <span className="chip">
            <i className="ti ti-user" aria-hidden /> {session.nombre} · {session.rol}
          </span>
          <form action={logout}>
            <button type="submit" title="Cerrar sesión">
              <i className="ti ti-logout" aria-hidden /> salir
            </button>
          </form>
        </div>
      </div>
      <SessionProvider session={session}>
        <CrmNav />
        <main className="crm-screen">{children}</main>
      </SessionProvider>
    </div>
  );
}
