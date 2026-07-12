// Fuente de verdad ÚNICA de qué rutas de la app existen hoy. La consultan el
// sidebar (shell), el command palette (⌘K) y cualquier navegación imperativa —
// nadie duplica el estado `built`. Al construir un módulo (M3+), poné su ruta en
// `true` acá y se reactiva en todos lados a la vez (solapa clickeable, acción del
// palette navegable, link del footer de ayuda vivo).
export const ROUTE_BUILT: Record<string, boolean> = {
  "/inicio": true,
  "/ingreso": true,
  "/egreso": false,
  "/contenedores": false,
  "/alertas": false,
  "/incidencias": false,
  "/admin": true,
  "/ayuda": false,
};

/**
 * ¿La ruta está construida? Match por primer segmento
 * (`/admin/solicitudes` → `/admin`). Las rutas no listadas (login, callback,
 * espera-aprobacion, recuperar, …) se consideran navegables por defecto: son
 * parte del shell de auth, no módulos gateados por milestone.
 */
export function isRouteBuilt(href: string): boolean {
  const seg = "/" + (href.split("/")[1] ?? "");
  return ROUTE_BUILT[seg] ?? true;
}
