import { FdShell } from "@/components/fd/shell";
import { ToastProvider } from "@/components/fd/toast";

// Layout del área operativa: shell Flight Deck + provider de toasts.
// El gate de sesión/rol llega en M2 — acá solo vive el chrome.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <FdShell>{children}</FdShell>
    </ToastProvider>
  );
}
