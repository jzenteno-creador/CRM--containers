// Envío de Web Push (2026-08-02). Lo llama el workflow n8n del resumen diario:
// n8n lee crm.push_suscripciones con service_role y POSTea acá las suscripciones
// + el mensaje; este endpoint solo hace la criptografía VAPID (la llave privada
// vive en el env de Vercel, nunca en n8n ni en la DB).
//
// Auth: header x-push-secret contra PUSH_ENDPOINT_SECRET (secreto compartido con
// la credencial de n8n). Sin secreto válido → 401 sin detalle.
//
// Respuesta: { enviadas, fallidas, muertas: [endpoint…] } — "muertas" son
// suscripciones vencidas (404/410) que n8n borra de la tabla (tiene DELETE).
import { createHash, timingSafeEqual } from "node:crypto";
import webpush from "web-push";

export const dynamic = "force-dynamic";

type Suscripcion = { endpoint: string; p256dh: string; auth: string };
type Cuerpo = {
  titulo?: string;
  cuerpo?: string;
  url?: string;
  suscripciones?: Suscripcion[];
};

// Anti-SSRF (auditoría 2026-08-02): el endpoint viene en última instancia de
// crm_push_subscribe (cualquier cuenta activa) — sin allowlist, un usuario podría
// registrar una URL interna y este server le haría POST ciego. Defensa en DOS capas:
// el CHECK de la migración 047 en la tabla + esta revalidación acá (el route no
// confía en lo que la tabla contenga).
const PUSH_SERVICES = [
  "https://fcm.googleapis.com/",
  "https://updates.push.services.mozilla.com/",
  "https://web.push.apple.com/",
];
function esPushServiceValido(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== "https:") return false;
    if (PUSH_SERVICES.some((p) => endpoint.startsWith(p))) return true;
    return u.hostname.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}

// contra saturación si el secreto se filtrara: tope duro de trabajo por request
const MAX_SUSCRIPCIONES = 500;

const sha256 = (s: string) => createHash("sha256").update(s).digest();

export async function POST(req: Request) {
  const secreto = process.env.PUSH_ENDPOINT_SECRET;
  const recibido = req.headers.get("x-push-secret");
  // comparación constant-time (hasheados a longitud fija — timingSafeEqual lo exige)
  if (!secreto || !recibido || !timingSafeEqual(sha256(secreto), sha256(recibido))) {
    return Response.json({ error: "no_autorizado" }, { status: 401 });
  }

  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:jzenteno@ssbint.com";
  if (!publica || !privada) {
    return Response.json({ error: "vapid_no_configurado" }, { status: 500 });
  }
  webpush.setVapidDetails(subject, publica, privada);

  let body: Cuerpo;
  try {
    body = (await req.json()) as Cuerpo;
  } catch {
    return Response.json({ error: "json_invalido" }, { status: 400 });
  }
  const subs = (Array.isArray(body.suscripciones) ? body.suscripciones : []).slice(
    0,
    MAX_SUSCRIPCIONES,
  );
  if (subs.length === 0) {
    return Response.json({ enviadas: 0, fallidas: 0, muertas: [] });
  }

  // la URL de destino solo puede ser un path propio (el sw.js también lo revalida)
  const urlDestino =
    typeof body.url === "string" && body.url.startsWith("/") && !body.url.startsWith("//")
      ? body.url.slice(0, 200)
      : "/alertas";
  const payload = JSON.stringify({
    titulo: (body.titulo ?? "CRM Detention").slice(0, 120),
    cuerpo: (body.cuerpo ?? "").slice(0, 300),
    url: urlDestino,
  });

  const muertas: string[] = [];
  let enviadas = 0;
  let fallidas = 0;

  await Promise.all(
    subs.map(async (s) => {
      if (!s?.endpoint || !s?.p256dh || !s?.auth || !esPushServiceValido(s.endpoint)) {
        fallidas++;
        return;
      }
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 12 * 60 * 60 }, // si el teléfono está apagado, expira sola en 12h
        );
        enviadas++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          muertas.push(s.endpoint); // suscripción vencida → n8n la borra
        } else {
          fallidas++;
        }
      }
    }),
  );

  return Response.json({ enviadas, fallidas, muertas });
}
