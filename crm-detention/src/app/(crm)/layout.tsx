import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SessionProvider } from "@/components/session-context";
import { FdChrome } from "@/components/nav";
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
    <SessionProvider session={session}>
      <FdChrome scope={scope} logout={logout}>
        {children}
      </FdChrome>
    </SessionProvider>
  );
}
