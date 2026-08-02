// Versión del build vivo (capa PWA/Android, 2026-08-02). El cliente instalado (TWA en
// el teléfono, pestaña que quedó abierta) consulta esto al volver a primer plano y cada
// 15 minutos; si difiere de su propio NEXT_PUBLIC_BUILD_ID, muestra el aviso de
// actualización. Sin auth a propósito: no expone nada más que un identificador opaco.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { id: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    { headers: { "cache-control": "no-store" } },
  );
}
