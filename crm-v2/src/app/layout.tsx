import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { PwaRegister, UpdateAlert } from "@/components/pwa-register";
import { SessionProvider } from "@/lib/session";
import "./globals.css";
// Subset propio de Tabler (scripts/subset-tabler.mjs): 122 íconos / 23 KB
// self-hosted — reemplaza el CDN de jsdelivr (825 KB, bloqueante, rompía CSP)
import "./tabler-subset.css";

// Tipografía Flight Deck: Archivo variable (display/UI, eje wdth para el stretch 115-120%)
// + JetBrains Mono (TODO número, ID, timestamp — siempre tabular-nums). Patrón v1 probado.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "CRM Detention · SSB",
  description: "CRM de detention de contenedores — SSB International",
  // Capa PWA/Android (2026-08-02): manifest + íconos de instalación.
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "CRM SSB", statusBarStyle: "black-translucent" },
};

export const viewport = {
  themeColor: "#0a0c10",
  // Sin viewport-fit=cover, env(safe-area-inset-*) vale 0 y todo el CSS de safe-areas
  // (bottombar, aviso de versión) queda inerte en teléfonos con gesture bar/notch.
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${archivo.variable} ${jetbrains.variable}`}>
      <body>
        {/* Sesión global (M2): también las páginas públicas la consumen
            (login/registro redirigen si ya hay sesión; el callback de
            confirmación depende de detectSessionInUrl del cliente). */}
        <SessionProvider>{children}</SessionProvider>
        <PwaRegister />
        <UpdateAlert />
      </body>
    </html>
  );
}
