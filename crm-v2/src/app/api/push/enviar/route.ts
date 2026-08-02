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
import webpush from "web-push";

export const dynamic = "force-dynamic";

type Suscripcion = { endpoint: string; p256dh: string; auth: string };
type Cuerpo = {
  titulo?: string;
  cuerpo?: string;
  url?: string;
  suscripciones?: Suscripcion[];
};

export async function POST(req: Request) {
  const secreto = process.env.PUSH_ENDPOINT_SECRET;
  if (!secreto || req.headers.get("x-push-secret") !== secreto) {
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
  const subs = Array.isArray(body.suscripciones) ? body.suscripciones : [];
  if (subs.length === 0) {
    return Response.json({ enviadas: 0, fallidas: 0, muertas: [] });
  }

  const payload = JSON.stringify({
    titulo: body.titulo ?? "CRM Detention",
    cuerpo: body.cuerpo ?? "",
    url: body.url ?? "/alertas",
  });

  const muertas: string[] = [];
  let enviadas = 0;
  let fallidas = 0;

  await Promise.all(
    subs.map(async (s) => {
      if (!s?.endpoint || !s?.p256dh || !s?.auth) {
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
