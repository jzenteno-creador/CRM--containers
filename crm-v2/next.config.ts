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
  // Headers de seguridad (auditoría 2026-08-02). La CSP corre en MODO REPORTE
  // (observa sin bloquear): el subset self-hosted de Tabler eliminó jsdelivr,
  // así que la allowlist ya es solo self + Supabase. Tras un período sin
  // violaciones en consola → promover a Content-Security-Policy real.
  async headers() {
    return [
      {
        // Texturas de la portada 3D del login: contenido versionado por nombre de
        // archivo, se cachea para siempre — el ~1 MB se paga una vez por dispositivo.
        // (El SW no cachea /3d a propósito: su filosofía es solo estáticos de marca.)
        source: "/3d/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'", // runtime inline de Next (sin infra de nonces)
              "style-src 'self' 'unsafe-inline'", // estilos inline del design system
              "img-src 'self' data: blob: https://cctuowthpnstvdgjuomq.supabase.co",
              "font-src 'self'",
              "connect-src 'self' https://cctuowthpnstvdgjuomq.supabase.co wss://cctuowthpnstvdgjuomq.supabase.co",
              "worker-src 'self' blob:", // tf.js (visión) puede usar workers blob
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
