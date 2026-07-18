import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extraerSigla, type SiglaExtraida } from "@/lib/iso6346";
import { BUCKET_SCAN } from "@/lib/scan-comprobantes";

// POST /api/vision/scan — PoC escaneo de sigla (modo prueba, 2026-07-18).
// Primer endpoint server-side de crm-v2: existe SOLO porque la API key de Roboflow no
// puede viajar al browser. Recibe la foto en base64, corre el workflow de OCR hosted
// (equivalente HTTP de client.run_workflow del SDK), extrae y valida la sigla ISO 6346,
// y guarda el registro de prueba en crm.scan_pruebas COMO EL USUARIO: el access token
// de la sesión viaja en Authorization y se reenvía a PostgREST → RLS aplica igual que
// en el cliente (la auth de esta app vive en localStorage, no hay cookie que leer acá).
// Sin service role en ningún lado.

export const maxDuration = 30; // el workflow serverless de Roboflow puede tardar varios segundos

const WORKSPACE = process.env.ROBOFLOW_WORKSPACE ?? "jzs-workspace";
const WORKFLOW_ID = process.env.ROBOFLOW_WORKFLOW_ID ?? "easyocr-demo";
const API_URL = process.env.ROBOFLOW_API_URL ?? "https://serverless.roboflow.com";
// el front ya reduce a ≤1280px; este cinturón corta ANTES del límite de request de
// Vercel (~4.5 MB) para que el usuario reciba el 413 propio con mensaje, no el de Vercel
const MAX_BASE64 = 4_000_000;
// strings gigantes del JSON crudo (imágenes anotadas en base64) se podan de la respuesta
const MAX_STRING_RAW = 10_000;
// anti-duplicado del modo vivo: misma sigla registrada hace <5 min (GLOBAL, entre
// usuarios: un contenedor físico = un registro) no se re-inserta
const DEDUP_MS = 5 * 60_000;

type Fragmento = { texto: string; confianza: number | null; x: number | null; y: number | null };

/** Junta todos los valores bajo `key` en cualquier nivel del JSON del workflow — el
 * shape exacto depende de los bloques configurados, así que no se asume anidamiento. */
function recolectar(obj: unknown, key: string, out: unknown[]): void {
  if (Array.isArray(obj)) {
    for (const item of obj) recolectar(item, key, out);
    return;
  }
  if (obj !== null && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === key) out.push(v);
      recolectar(v, key, out);
    }
  }
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** recognized_text (string o string[]) + fragmentos de text_detections.predictions
 * (class = texto leído, x/y = posición, confidence). */
function extraerTextos(raw: unknown): { textos: string[]; fragmentos: Fragmento[] } {
  const recs: unknown[] = [];
  recolectar(raw, "recognized_text", recs);
  const textos: string[] = [];
  for (const r of recs) {
    if (typeof r === "string") textos.push(r);
    else if (Array.isArray(r)) for (const s of r) if (typeof s === "string") textos.push(s);
  }

  const predArrays: unknown[] = [];
  recolectar(raw, "predictions", predArrays);
  const fragmentos: Fragmento[] = [];
  for (const arr of predArrays) {
    if (!Array.isArray(arr)) continue;
    for (const p of arr) {
      if (p === null || typeof p !== "object") continue;
      const o = p as Record<string, unknown>;
      if (typeof o.class !== "string") continue;
      fragmentos.push({
        texto: o.class,
        confianza: num(o.confidence),
        x: num(o.x),
        y: num(o.y),
      });
    }
  }
  return { textos, fragmentos };
}

/** Candidatos para la extracción: el texto completo + joins de fragmentos en orden de
 * API y en orden de lectura (filas por y con tolerancia, después x) — la sigla suele
 * venir partida en 2-3 fragmentos contiguos. */
function armarCandidatos(textos: string[], fragmentos: Fragmento[]): string[] {
  const porLectura = [...fragmentos].sort((a, b) => {
    const ay = a.y ?? 0;
    const by = b.y ?? 0;
    if (Math.abs(ay - by) > 20) return ay - by;
    return (a.x ?? 0) - (b.x ?? 0);
  });
  return [
    ...textos,
    textos.join(" "),
    fragmentos.map((f) => f.texto).join(" "),
    porLectura.map((f) => f.texto).join(" "),
  ];
}

/** Copia del JSON crudo apta para respuesta: strings enormes (imágenes base64 de los
 * bloques de visualización) se reemplazan por un marcador — el debug de John necesita
 * los textos y las coordenadas, no megas de base64. */
function podarRaw(obj: unknown): unknown {
  if (typeof obj === "string") {
    return obj.length > MAX_STRING_RAW ? `[string de ${obj.length} chars omitido]` : obj;
  }
  if (Array.isArray(obj)) return obj.map(podarRaw);
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) out[k] = podarRaw(v);
    return out;
  }
  return obj;
}

/** Primera imagen anotada que devuelva el workflow (si el bloque de visualización
 * está), como data URL para mostrar la región marcada en el front. */
function buscarImagenAnotada(raw: unknown): string | null {
  const candidatos: unknown[] = [];
  for (const key of ["output_image", "visualization", "annotated_image", "bounding_box_visualization"]) {
    recolectar(raw, key, candidatos);
  }
  for (const c of candidatos) {
    const s =
      typeof c === "string"
        ? c
        : c !== null && typeof c === "object" && typeof (c as Record<string, unknown>).value === "string"
          ? ((c as Record<string, unknown>).value as string)
          : null;
    if (!s || s.length < 100) continue;
    if (s.startsWith("data:image/")) return s;
    if (s.startsWith("/9j/")) return `data:image/jpeg;base64,${s}`;
    if (s.startsWith("iVBOR")) return `data:image/png;base64,${s}`;
  }
  return null;
}

function respError(status: number, error: string, detalle: string) {
  return NextResponse.json({ ok: false as const, error, detalle }, { status });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return respError(401, "sin_autenticacion", "Falta el token de sesión — iniciá sesión de nuevo.");
  }

  // Cliente por-request con el Bearer del usuario: primero valida el token, después
  // inserta (mismo cliente). Sin service role en ningún lado.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      db: { schema: "crm" },
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  // VALIDEZ del token, no solo presencia (P1 del review 2026-07-18): sin este check,
  // cualquier request de internet con "Bearer basura" corría el workflow pago de
  // Roboflow con nuestra key. Nada avanza sin un usuario real.
  const { data: userData, error: userError } = await supabase.auth.getUser(
    authHeader.slice("Bearer ".length),
  );
  if (userError || !userData?.user) {
    return respError(401, "sin_autenticacion", "Token de sesión inválido o vencido — volvé a iniciar sesión.");
  }

  const apiKey = process.env.ROBOFLOW_API_KEY;
  if (!apiKey) {
    return respError(
      503,
      "sin_configurar",
      "Falta ROBOFLOW_API_KEY en el entorno del server — el escaneo queda deshabilitado hasta configurarla.",
    );
  }

  let imagen: string;
  let modo: "manual" | "vivo";
  try {
    const body = (await req.json()) as { imageBase64?: unknown; modo?: unknown };
    if (typeof body.imageBase64 !== "string" || body.imageBase64.length === 0) {
      return respError(400, "payload", "Falta imageBase64 en el cuerpo del request.");
    }
    imagen = body.imageBase64.replace(/^data:image\/\w+;base64,/, "");
    if (imagen.length > MAX_BASE64) {
      return respError(413, "payload", "La imagen supera el límite (~4.5 MB) — reducila antes de enviar.");
    }
    modo = body.modo === "vivo" ? "vivo" : "manual";
  } catch {
    return respError(400, "payload", "Cuerpo del request inválido (se espera JSON).");
  }

  // Workflow hosted de Roboflow — equivalente HTTP de client.run_workflow(workspace, id, images)
  let raw: unknown;
  try {
    const rfRes = await fetch(`${API_URL}/infer/workflows/${WORKSPACE}/${WORKFLOW_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        inputs: { image: { type: "base64", value: imagen } },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!rfRes.ok) {
      const texto = (await rfRes.text()).slice(0, 500).replaceAll(apiKey, "[redactada]");
      return respError(502, "roboflow", `Roboflow respondió ${rfRes.status}: ${texto}`);
    }
    raw = await rfRes.json();
    // simetría con los caminos de error: si Roboflow ecoara la key en algún campo del
    // JSON (shape declarado desconocido), muere acá antes de llegar al cliente
    raw = JSON.parse(JSON.stringify(raw).replaceAll(apiKey, "[redactada]"));
  } catch (e) {
    const detalle = (e instanceof Error ? e.message : "error de red").replaceAll(apiKey, "[redactada]");
    return respError(502, "roboflow", `No se pudo llamar al workflow: ${detalle}`);
  }

  const { textos, fragmentos } = extraerTextos(raw);
  const sigla: SiglaExtraida | null = extraerSigla(armarCandidatos(textos, fragmentos));
  const confianzas = fragmentos.map((f) => f.confianza).filter((c): c is number => c !== null);
  const confianza =
    confianzas.length > 0 ? confianzas.reduce((a, b) => a + b, 0) / confianzas.length : null;

  // ---- Registro (como el usuario: mismo cliente per-request, RLS decide) ----
  // vivo: SOLO verde + dedup 5 min global. manual: siempre inserta (acción deliberada,
  // sin dedup), con foto solo si la sigla es verde. usuario_id lo pone el default
  // auth.uid() de la tabla.
  const esVivo = modo === "vivo";
  let registrado = false;
  let motivoNoRegistro: "digito_invalido" | "sin_sigla" | "duplicado" | null = null;
  let errorRegistro: string | null = null;
  let imagenPath: string | null = null;

  if (esVivo && !sigla?.valido) {
    motivoNoRegistro = sigla ? "digito_invalido" : "sin_sigla";
  } else {
    if (esVivo && sigla?.valido) {
      const desde = new Date(Date.now() - DEDUP_MS).toISOString();
      const { data: dup, error: dupError } = await supabase
        .from("scan_pruebas")
        .select("id")
        .eq("sigla_leida", sigla.sigla)
        .gte("created_at", desde)
        .limit(1);
      if (dupError) {
        // sin chequeo confiable NO se inserta — el dedup también protege de flood
        errorRegistro = `No se pudo chequear duplicados: ${dupError.message}`;
      } else if (dup && dup.length > 0) {
        motivoNoRegistro = "duplicado";
      }
    }

    if (!motivoNoRegistro && !errorRegistro) {
      // la foto sube ANTES del insert: scan_pruebas no tiene policy de UPDATE (a
      // propósito), así que imagen_url viaja en el INSERT o no viaja nunca
      if (sigla?.valido) {
        const path = `${userData.user.id}/${Date.now()}-${sigla.sigla}.jpg`;
        const up = await supabase.storage
          .from(BUCKET_SCAN)
          .upload(path, Buffer.from(imagen, "base64"), {
            contentType: "image/jpeg",
            upsert: false,
          });
        if (up.error) {
          // el registro no se pierde por la foto — queda sin comprobante y se avisa
          errorRegistro = `Foto no subida: ${up.error.message}`;
        } else {
          imagenPath = path;
        }
      }
      const { error: dbError } = await supabase.from("scan_pruebas").insert({
        sigla_leida: sigla?.sigla ?? null,
        check_digit_valido: sigla?.valido ?? null,
        confianza,
        modelo_usado: WORKFLOW_ID,
        imagen_url: imagenPath,
      });
      if (dbError) {
        // la fila no existe: el comprobante recién subido no debe quedar huérfano en el
        // bucket (ningún wipe lo encontraría — derivan paths de las filas)
        if (imagenPath) {
          await supabase.storage.from(BUCKET_SCAN).remove([imagenPath]);
          imagenPath = null;
        }
        errorRegistro = errorRegistro ? `${errorRegistro} · ${dbError.message}` : dbError.message;
      } else {
        registrado = true;
      }
    }
  }

  return NextResponse.json({
    ok: true as const,
    modo,
    sigla,
    confianza,
    recognizedText: textos.join(" · ") || null,
    fragmentos,
    imagenAnotada: buscarImagenAnotada(raw),
    registrado,
    motivoNoRegistro,
    errorRegistro,
    imagenPath,
    raw: podarRaw(raw),
  });
}
