import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "@/lib/session";
import "./globals.css";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${archivo.variable} ${jetbrains.variable}`}>
      <head>
        {/* Íconos Tabler outline (mismo canal que v1 en producción) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.7.0/dist/tabler-icons.min.css"
        />
      </head>
      <body>
        {/* Sesión global (M2): también las páginas públicas la consumen
            (login/registro redirigen si ya hay sesión; el callback de
            confirmación depende de detectSessionInUrl del cliente). */}
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
