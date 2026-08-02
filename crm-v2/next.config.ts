import type { NextConfig } from "next";

// Sello de versión del build (capa PWA/Android, 2026-08-02): en Vercel con git usa el
// sha del commit; en deploys por CLI cae al timestamp del build. Se evalúa UNA vez por
// build y queda inlineado en el bundle del cliente Y del server — /api/version devuelve
// el del server vivo, el cliente compara contra el suyo y así detecta deploys nuevos.
// OJO: en deploys por CLI Vercel define VERCEL_GIT_COMMIT_SHA como STRING VACÍO (no
// undefined) — por eso el fallback es con truthiness, no con ??. Medido 2026-08-02.
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
};

export default nextConfig;
