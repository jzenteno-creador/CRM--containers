// Service worker MÍNIMO del CRM Detention (capa PWA/Android, 2026-08-02).
//
// Filosofía deliberada: este sistema muestra plata y alertas EN VIVO — cachear páginas
// o datos sería servir información vieja como si fuera actual, que es exactamente el
// problema que el CRM vino a resolver. Por eso:
//   · NAVEGACIÓN: red siempre; si no hay red, página /offline (nunca una vista vieja).
//   · ESTÁTICOS PROPIOS (íconos, logos, manifest): cache-first — no cambian y hacen
//     que la app abra instantánea.
//   · TODO LO DEMÁS (API, Supabase, chunks JS): pasa directo a la red, sin tocar.
const CACHE = "crm-ssb-v1";
const ESTATICOS = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/logos/ssb-white.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESTATICOS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase/CDN: ni tocarlos

  // Navegación: red o /offline — jamás una página cacheada.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline")));
    return;
  }

  // Estáticos conocidos: cache-first.
  if (ESTATICOS.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
  }
});
