// Piezas de cámara COMPARTIDAS entre la solapa /vision (detección COCO en vivo) y
// /vision/escanear (modo En vivo del escaneo de sigla). Extraídas de vision-client
// (2026-07-18) para no reimplementar los gotchas: constraints `ideal` (desktop sin
// trasera cae a la webcam en vez de fallar), detección del lado REAL que entregó el
// track, y el mapeo de errores de getUserMedia. Los LOOPS no viven acá — cada consumer
// tiene el suyo (rAF de inferencia vs setTimeout de escaneo), con su propio contador
// de generación.

export type Facing = "environment" | "user";
export type ErrorCamara = { titulo: string; detalle: string };

export const ERRORES_CAMARA: Record<string, ErrorCamara> = {
  noSoportado: {
    titulo: "Cámara no disponible en este navegador",
    detalle:
      "El navegador no expone acceso a cámara. Fuera de HTTPS (o localhost) los navegadores la deshabilitan por completo — entrá por la URL https del deploy.",
  },
  permiso: {
    titulo: "Permiso de cámara denegado",
    detalle:
      "Habilitá el acceso a la cámara para este sitio (candado en la barra de dirección) y reintentá.",
  },
  sinCamara: {
    titulo: "No se encontró cámara",
    detalle: "El dispositivo no tiene cámara disponible o la está usando otra aplicación.",
  },
};

export function soportaCamara(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function errorDeCamara(e: unknown): ErrorCamara {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return ERRORES_CAMARA.permiso;
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError")
    return ERRORES_CAMARA.sinCamara;
  return {
    titulo: "No se pudo iniciar la cámara",
    detalle: e instanceof Error ? e.message : "Error desconocido al abrir la cámara.",
  };
}

/** Abre la cámara pedida. `ideal` en vez de `exact`: en desktop "trasera" resuelve a la
 * única webcam en vez de fallar. `facingReal` sale del track cuando el dispositivo lo
 * reporta (celulares) — chip y espejado siguen la realidad, no lo pedido. Lanza el error
 * crudo de getUserMedia: el caller lo mapea con errorDeCamara(). */
export async function abrirCamara(
  target: Facing,
): Promise<{ stream: MediaStream; facingReal: Facing }> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: target },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });
  const ajustes = stream.getVideoTracks()[0]?.getSettings();
  const facingReal: Facing =
    ajustes?.facingMode === "user" || ajustes?.facingMode === "environment"
      ? ajustes.facingMode
      : target;
  return { stream, facingReal };
}

/** Frame actual del <video> como JPEG base64 (sin prefijo data URL), reducido a
 * ≤maxLado px — mismo tamaño que exige el endpoint de escaneo. Null si el video
 * todavía no tiene frame o el canvas no está disponible. */
export function capturarFrame(video: HTMLVideoElement, maxLado = 1280): string | null {
  if (video.videoWidth === 0 || video.readyState < 2) return null;
  const escala = Math.min(1, maxLado / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * escala);
  canvas.height = Math.round(video.videoHeight * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85).replace(/^data:image\/\w+;base64,/, "");
}
