// Compresión de fotos client-side antes de subir a Storage (fix P1 de auditoría,
// 2026-07-31): una foto de celu sin tocar pesa 8-15MB y el bucket `crm-incidencias` no
// tiene file_size_limit — el Storage free tier (1GB) se llena rápido con el alta de
// incidencias (alta-form.tsx). Mismo criterio de re-encode que capturarFrame() de
// /vision/camara.ts (canvas → JPEG 0.85), pero con un lado máximo mayor (1600px en vez
// de 1280px) porque acá la foto es evidencia de un reclamo — no un frame de escaneo, hay
// más margen para conservar detalle legible (números de serie, daños chicos).

/** Bajo este tamaño no vale la pena recomprimir: ya es chica y en un formato apto para
 * subir tal cual — recomprimir algo que ya pesa poco no ahorra nada, solo agrega
 * latencia y una pérdida de calidad innecesaria. */
const SKIP_BYTES = 500 * 1024;
const MAX_LADO = 1600;
const JPEG_QUALITY = 0.85;

function esFormatoLiviano(tipo: string): boolean {
  return tipo === "image/jpeg" || tipo === "image/png";
}

/** Comprime una foto para subir. Si ya es ≤500KB y jpeg/png, la devuelve tal cual (mismo
 * File, sin recodificar). Si no, la reduce al lado mayor ≤1600px y la re-codifica JPEG
 * calidad 0.85 vía canvas. Puede rechazar la promesa si el navegador no logra
 * decodificar/re-codificar la imagen (formato raro, canvas tainted, etc.) — el caller
 * decide el fallback (subir el original sin comprimir: degradación, no bloqueo). */
export async function comprimirImagen(file: File): Promise<Blob> {
  if (file.size <= SKIP_BYTES && esFormatoLiviano(file.type)) return file;

  const bitmap = await createImageBitmap(file);
  try {
    const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.max(1, Math.round(bitmap.width * escala));
    const alto = Math.max(1, Math.round(bitmap.height * escala));

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d no disponible en este navegador");
    ctx.drawImage(bitmap, 0, 0, ancho, alto);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) throw new Error("el navegador no pudo re-codificar la imagen");
    return blob;
  } finally {
    bitmap.close();
  }
}
