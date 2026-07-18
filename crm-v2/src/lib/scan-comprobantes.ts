// Bucket PRIVADO de fotos-comprobante del PoC de escaneo (migración 036) — servido
// SIEMPRE por signed URLs, patrón crm-incidencias (009). `crm.scan_pruebas.imagen_url`
// guarda el PATH dentro del bucket (`<usuario_id>/<archivo>`), nunca una URL.
import { getSupabase } from "./supabase";

export const BUCKET_SCAN = "crm-scan-comprobantes";

/** TTL de las signed URLs de la galería (1 h, mismo valor que incidencias). */
export const SIGNED_URL_TTL = 3600;

/** Borra TODOS los registros de prueba propios: fotos del bucket PRIMERO, filas después
 * (si el Storage falla, las filas quedan y se puede reintentar — al revés quedarían
 * fotos huérfanas invisibles). Rutina ÚNICA para los dos botones de wipe (escanear y
 * registros): un wipe que borre filas sin fotos es la regresión que cazó el review.
 * Devuelve null si salió bien, o el mensaje de error para mostrar. */
export async function limpiarRegistrosPropios(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return "Sesión vencida — volvé a iniciar sesión.";

  const { data: propios, error: qError } = await getSupabase()
    .from("scan_pruebas")
    .select("imagen_url")
    .eq("usuario_id", uid)
    .not("imagen_url", "is", null);
  if (qError) return "No se pudieron listar tus registros — reintentá.";

  const paths = ((propios as { imagen_url: string | null }[]) ?? [])
    .map((r) => r.imagen_url)
    .filter((p): p is string => !!p);
  for (let i = 0; i < paths.length; i += 100) {
    const { error: rmError } = await getSupabase()
      .storage.from(BUCKET_SCAN)
      .remove(paths.slice(i, i + 100));
    if (rmError) return `No se pudieron borrar las fotos: ${rmError.message}`;
  }

  const { error: delError } = await getSupabase()
    .from("scan_pruebas")
    .delete()
    .eq("usuario_id", uid);
  if (delError) return "Fotos borradas pero las filas no — reintentá.";
  return null;
}
