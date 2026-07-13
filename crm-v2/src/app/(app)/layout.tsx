import { cookies } from "next/headers";
import { AppGate } from "@/components/app-gate";
import { FdShell, type SidebarState } from "@/components/fd/shell";
import { ToastProvider } from "@/components/fd/toast";

// Layout del área operativa: gate de sesión (M2) + shell Flight Deck + toasts.
// El shell recién se monta con perfil activo resuelto — así las solapas por rol
// no "flashean" antes de conocer el rol.
//
// Rail colapsable (M4 B4): la cookie fd_sidebar se lee EN EL SERVER (Next 16: cookies()
// es async) y se pasa al shell como estado inicial, para que el rail nazca en el ancho
// correcto sin flash. Leer la cookie opta la ruta a render dinámico — es lo esperado en
// pantallas autenticadas per-usuario. Default 'collapsed' = el ancho histórico (solo
// íconos): nadie ve su UI cambiar de ancho sin haberlo pedido.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const initialSidebar: SidebarState =
    cookieStore.get("fd_sidebar")?.value === "expanded" ? "expanded" : "collapsed";

  return (
    <ToastProvider>
      <AppGate>
        <FdShell initialSidebar={initialSidebar}>{children}</FdShell>
      </AppGate>
    </ToastProvider>
  );
}
