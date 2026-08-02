// Utilidades GENUINAMENTE compartidas entre los importadores de Excel de tarifas
// (origen y destino) — normalización de encabezados/valores, parseo de números y
// fechas, resolución de nombres. Cero acoplamiento al modelo de datos: no conocen
// columnas, RPCs ni reglas de validación de ninguno de los dos importadores.
//
// Lo específico de cada modelo (columnas del Excel, defaults, validación cruzada,
// simulación del efecto atómico de la RPC, texto de reporte, columnas de preview)
// vive en cada importador — importar-excel.tsx (origen, RPC crm_nueva_version_freetime)
// e importar-excel-destino.tsx (destino, RPC crm_nueva_version_freetime_destino) — a
// propósito: forzar un shell genérico de 3 pasos hubiera acoplado dos modelos que
// difieren en régimen/tipo (origen) vs. tres contadores nullable + tri-estado
// (destino), sin ahorrar líneas reales.

export const MAX_ROWS = 500;
// mismo criterio defensivo que FETCH_CAP de page.tsx — cap del snapshot de vigentes
// que se usa para detectar "esto ya existe y lo vas a reemplazar" durante el preview.
export const VIGENTES_CAP = 1000;

/* ---------- normalización de encabezados y valores (case/acentos-insensitive) ---------- */

export function normKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function rawDisplay(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

export function parseNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (s === "") return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 'YYYY-MM-DD' desde Date/serial de Excel/string ISO/string DD-MM-YYYY. null = ilegible. */
export function parseFecha(v: unknown, XLSX: typeof import("xlsx")): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "number") {
    const parsed = XLSX.SSF?.parse_date_code?.(v);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (m) {
    const [, d, mo, yRaw] = m;
    const y = yRaw.length === 2 ? (Number(yRaw) < 50 ? "20" : "19") + yRaw : yRaw;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

const TRUE_WORDS = new Set(["true", "si", "sí", "yes", "verdadero", "1", "x"]);
const FALSE_WORDS = new Set(["false", "no", "0"]);

/** null en `value` = celda vacía (no provisto → la RPC hereda/usa su default). */
export function parseBool(v: unknown): { ok: boolean; value: boolean | null } {
  if (v == null || v === "") return { ok: true, value: null };
  if (typeof v === "boolean") return { ok: true, value: v };
  const s = normKey(String(v));
  if (TRUE_WORDS.has(s)) return { ok: true, value: true };
  if (FALSE_WORDS.has(s)) return { ok: true, value: false };
  return { ok: false, value: null };
}

export function resolveByName<T extends { id: string; nombre: string }>(list: T[], name: string): T | null {
  const n = normKey(name);
  return list.find((x) => normKey(x.nombre) === n) ?? null;
}
