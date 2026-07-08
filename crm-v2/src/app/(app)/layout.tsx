import { AppGate } from "@/components/app-gate";
import { FdShell } from "@/components/fd/shell";
import { ToastProvider } from "@/components/fd/toast";

// Layout del área operativa: gate de sesión (M2) + shell Flight Deck + toasts.
// El shell recién se monta con perfil activo resuelto — así las solapas por rol
// no "flashean" antes de conocer el rol.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AppGate>
        <FdShell>{children}</FdShell>
      </AppGate>
    </ToastProvider>
  );
}
