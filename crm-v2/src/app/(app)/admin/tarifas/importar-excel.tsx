"use client";

// Importador de tarifas de freetime desde Excel/CSV (Admin → Tarifas, pestaña Origen).
//
// POR QUÉ: cargar la tarifa de una naviera hoy es SQL a mano de un desarrollador. La
// propuesta al cliente promete 2 semanas de CONFIGURACIÓN para el piloto, no de
// desarrollo — este importador es lo que hace cierta esa promesa.
//
// Escribe SOLO vía crm_nueva_version_freetime, fila por fila, SECUENCIAL (no Promise.all:
// son escrituras de plata y el orden importa — dos filas de la MISMA combinación
// naviera+país+régimen+hub deben cerrarse/abrirse en el orden del archivo). Mismos
// parámetros y mismos defaults que OrigenVersionModal en modo alta (page.tsx) — este
// módulo NO reimplementa la lógica de versionado, solo arma el payload y llama la RPC
// (ver AGENTS.md "regla de escritura a la DB": freetime_origin es RPC-only).
//
// Gating: el botón que abre este modal vive en OrigenPanel, que solo se renderiza si
// TarifasPage ya resolvió isAdmin (mismo gate que "Nueva tarifa") — no hay chequeo propio
// acá, la RPC además valida rol server-side (defensa en profundidad, igual que el resto
// de la página).
//
// Alcance: SOLO Origen. El brief pedía "Destino si queda natural" — freetime_destino no
// tiene régimen (los 3 contadores de días conviven en una sola fila) y varios campos
// obligatorios de acá (regimen/tipo) no aplican allá, así que duplicar este módulo para
// destino con su propia matriz de validación es un segundo desarrollo, no una extensión
// de una tarde. Queda documentado como pendiente explícito, no un olvido.
//
// Columnas NO cubiertas por el importador (a propósito, fuera del synonym-map pedido):
// carga peligrosa (siempre false — mismo default que el modal; la operación no la
// diferencia, decisión de John 2026-08-01) y freetime/tarifa reefer (siempre null — no
// están en la lista de encabezados aceptados). Agregarlas es una columna + 3 líneas acá.

import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { DataTable, type Column } from "@/components/fd/data-table";
import { ProgressBar } from "@/components/fd/freetime-meter";
import { FormAlert } from "@/components/fd/form-alert";
import { Modal } from "@/components/fd/modal";
import { fmtFechaDia, fmtUSDTarifa, hoyAR, ymdADate } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";

type Naviera = { id: string; nombre: string };
type Pais = { id: string; nombre: string; activo: boolean };

const MAX_ROWS = 500;
// mismo criterio defensivo que FETCH_CAP de page.tsx — cap del snapshot de vigentes que
// se usa para detectar "esto ya existe y lo vas a reemplazar" durante la previsualización.
const VIGENTES_CAP = 1000;

/* ---------- normalización de encabezados y valores (case/acentos-insensitive) ---------- */

function normKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Sinónimos EXACTOS del brief — case/acentos-insensitive vía normKey (así "Días Libres",
// "dias_libres" y "FREE TIME" caen todos en el mismo canónico).
const HEADER_SYNONYMS: Record<string, string> = {
  naviera: "naviera",
  pais: "pais",
  dias_libres: "dias_libres",
  free_time: "dias_libres",
  freetime: "dias_libres",
  tarifa: "tarifa",
  tarifa_usd_dia: "tarifa",
  usd_dia: "tarifa",
  vigente_desde: "vigente_desde",
  desde: "vigente_desde",
  regimen: "regimen",
  tipo: "tipo",
  convencion_conteo: "convencion_conteo",
  convencion: "convencion_conteo",
  hub: "hub",
  nota: "nota",
  notas: "nota",
  cobra_detention_origen: "cobra_detention_origen",
  cobra_detention: "cobra_detention_origen",
  cobra: "cobra_detention_origen",
};

// Bloquean el procesamiento ANTES de leer una sola fila si falta el encabezado — son los
// únicos parámetros de la RPC sin default utilizable (p_tipo/p_peligrosa sí tienen default
// de UI, ver arriba). Etiqueta humana para el mensaje de error.
const REQUIRED_CANONICAL: { key: string; label: string }[] = [
  { key: "naviera", label: "naviera" },
  { key: "dias_libres", label: "días libres (dias_libres / días libres / free time)" },
  { key: "tarifa", label: "tarifa (tarifa / tarifa_usd_dia / usd/día)" },
  { key: "vigente_desde", label: "vigente desde (vigente_desde / desde)" },
];

const REGIMEN_LABELS: Record<string, string> = { vacios: "vacíos", cargados: "cargados", sin_uso: "sin uso" };
const TIPOS = ["Detention", "Demurrage", "Combined"] as const;

function rawDisplay(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function parseNumber(v: unknown): number | null {
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
function parseFecha(v: unknown, XLSX: typeof import("xlsx")): string | null {
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
function parseBool(v: unknown): { ok: boolean; value: boolean | null } {
  if (v == null || v === "") return { ok: true, value: null };
  if (typeof v === "boolean") return { ok: true, value: v };
  const s = normKey(String(v));
  if (TRUE_WORDS.has(s)) return { ok: true, value: true };
  if (FALSE_WORDS.has(s)) return { ok: true, value: false };
  return { ok: false, value: null };
}

function resolveByName<T extends { id: string; nombre: string }>(list: T[], name: string): T | null {
  const n = normKey(name);
  return list.find((x) => normKey(x.nombre) === n) ?? null;
}

/* ---------- fila parseada + validación ---------- */

type ImportStatus = "ok" | "warning" | "error";

type ParsedRow = {
  excelRow: number;
  navieraRaw: string;
  navieraId: string | null;
  paisRaw: string;
  paisId: string | null;
  paisNombre: string;
  regimen: string;
  hub: string | null;
  diasLibresRaw: string;
  diasLibres: number | null;
  tarifaRaw: string;
  tarifa: number | null;
  tipo: string;
  convencion: string | null;
  cobra: boolean | null;
  nota: string | null;
  vigenteDesdeRaw: string;
  vigenteDesde: string | null;
  previousVigenteId: string | null;
  status: ImportStatus;
  message: string | null;
};

type VigenteSnap = { id: string; diasLibres: number; tarifaUsdDia: number; tipo: string; vigenteDesde: string };

function buildHeaderMap(headerRow: string[]): { map: Map<string, string>; missing: { key: string; label: string }[] } {
  const map = new Map<string, string>();
  const found = new Set<string>();
  for (const h of headerRow) {
    const canon = HEADER_SYNONYMS[normKey(h)];
    if (canon) {
      map.set(h, canon);
      found.add(canon);
    }
  }
  const missing = REQUIRED_CANONICAL.filter((f) => !found.has(f.key));
  return { map, missing };
}

function getCanon(row: Record<string, unknown>, headerMap: Map<string, string>, canon: string): unknown {
  for (const [orig, c] of headerMap) {
    if (c !== canon) continue;
    const v = row[orig];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

function parseRows(
  dataRows: Record<string, unknown>[],
  headerMap: Map<string, string>,
  navieras: Naviera[],
  paisesActivos: Pais[],
  vigMap: Map<string, VigenteSnap>,
  XLSX: typeof import("xlsx"),
): ParsedRow[] {
  return dataRows.map((raw, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const navieraRaw = rawDisplay(getCanon(raw, headerMap, "naviera"));
    const naviera = navieraRaw ? resolveByName(navieras, navieraRaw) : null;
    if (!navieraRaw) errors.push("falta la naviera");
    else if (!naviera) errors.push(`naviera no encontrada: "${navieraRaw}"`);

    const paisRawInput = getCanon(raw, headerMap, "pais");
    const paisRaw = rawDisplay(paisRawInput) || "ARGENTINA";
    const pais = resolveByName(paisesActivos, paisRaw);
    if (!pais) errors.push(`país inválido o inactivo: "${paisRaw}"`);

    const hubRaw = rawDisplay(getCanon(raw, headerMap, "hub"));
    const hub = hubRaw === "" ? null : hubRaw;

    const diasLibresInput = getCanon(raw, headerMap, "dias_libres");
    const diasLibresRaw = rawDisplay(diasLibresInput);
    const diasLibres = parseNumber(diasLibresInput);
    if (diasLibresInput === undefined) errors.push("falta días libres");
    else if (diasLibres == null || !Number.isInteger(diasLibres) || diasLibres < 0)
      errors.push(`días libres inválidos: "${diasLibresRaw}" (entero ≥ 0)`);

    const tarifaInput = getCanon(raw, headerMap, "tarifa");
    const tarifaRaw = rawDisplay(tarifaInput);
    const tarifa = parseNumber(tarifaInput);
    if (tarifaInput === undefined) errors.push("falta la tarifa");
    else if (tarifa == null || tarifa < 0) errors.push(`tarifa inválida: "${tarifaRaw}" (número ≥ 0)`);

    const desdeInput = getCanon(raw, headerMap, "vigente_desde");
    const vigenteDesdeRaw = rawDisplay(desdeInput);
    const vigenteDesde = desdeInput === undefined ? null : parseFecha(desdeInput, XLSX);
    if (desdeInput === undefined) errors.push("falta la fecha de vigencia (vigente_desde)");
    else if (!vigenteDesde) errors.push(`fecha de vigencia ilegible: "${vigenteDesdeRaw}" (usá AAAA-MM-DD o DD/MM/AAAA)`);

    const regimenInput = rawDisplay(getCanon(raw, headerMap, "regimen"));
    let regimen = "vacios";
    if (regimenInput !== "") {
      const norm = normKey(regimenInput);
      if (!(norm in REGIMEN_LABELS)) {
        errors.push(`régimen no soportado: "${regimenInput}" (válidos: vacíos, cargados, sin uso)`);
      } else {
        regimen = norm;
        if (norm !== "vacios") {
          warnings.push(
            `régimen "${REGIMEN_LABELS[norm]}" — el motor de costeo usa 'vacíos' fijo, se va a guardar pero NINGÚN cálculo la va a leer`,
          );
        }
      }
    }

    const tipoInput = rawDisplay(getCanon(raw, headerMap, "tipo"));
    let tipo = "Detention";
    if (tipoInput !== "") {
      const match = TIPOS.find((t) => normKey(t) === normKey(tipoInput));
      if (!match) errors.push(`tipo inválido: "${tipoInput}" (válidos: Detention, Demurrage, Combined)`);
      else tipo = match;
    }

    const convencionInput = rawDisplay(getCanon(raw, headerMap, "convencion_conteo"));
    let convencion: string | null = null;
    if (convencionInput !== "") {
      const norm = normKey(convencionInput);
      if (norm === "retiro_dia_1" || norm === "dia_1") convencion = "retiro_dia_1";
      else if (norm === "retiro_dia_0" || norm === "dia_0") convencion = "retiro_dia_0";
      else errors.push(`convención de conteo inválida: "${convencionInput}" (válidos: retiro_dia_1, retiro_dia_0)`);
    }

    const cobraInput = getCanon(raw, headerMap, "cobra_detention_origen");
    const cobraRes = parseBool(cobraInput);
    if (!cobraRes.ok) errors.push(`valor inválido en cobra_detention_origen: "${rawDisplay(cobraInput)}" (usá sí/no)`);

    const notaRaw = rawDisplay(getCanon(raw, headerMap, "nota"));
    const nota = notaRaw === "" ? null : notaRaw;

    let previousVigenteId: string | null = null;
    if (naviera && pais && vigenteDesde && errors.length === 0) {
      const key = `${naviera.id}|${regimen}|${pais.id}|${hub ?? ""}`;
      const prev = vigMap.get(key);
      if (prev) {
        previousVigenteId = prev.id;
        if (vigenteDesde <= prev.vigenteDesde) {
          errors.push(
            `la vigencia nueva (${fmtFechaDia(vigenteDesde)}) debe ser posterior a la vigente actual de esta combinación (${fmtFechaDia(prev.vigenteDesde)})`,
          );
        } else {
          warnings.push(
            `ya existe una versión vigente desde ${fmtFechaDia(prev.vigenteDesde)} — ${prev.diasLibres} días libres, ${fmtUSDTarifa(prev.tarifaUsdDia)}/día, ${prev.tipo}. Esta importación la va a CERRAR y reemplazar.`,
          );
        }
      }
      // Simula el efecto atómico de la RPC (cierra + abre) para que filas duplicadas del
      // MISMO archivo se comparen contra lo que la fila anterior dejaría vigente, no
      // contra el snapshot inicial de la DB.
      if (diasLibres != null && tarifa != null && (!prev || vigenteDesde > prev.vigenteDesde)) {
        vigMap.set(key, { id: prev?.id ?? "pendiente", diasLibres, tarifaUsdDia: tarifa, tipo, vigenteDesde });
      }
    }

    const status: ImportStatus = errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ok";
    const message = [...errors, ...warnings].join(" — ") || null;

    return {
      excelRow: i + 2, // fila 1 = encabezados
      navieraRaw,
      navieraId: naviera?.id ?? null,
      paisRaw,
      paisId: pais?.id ?? null,
      paisNombre: pais?.nombre ?? paisRaw,
      regimen,
      hub,
      diasLibresRaw,
      diasLibres,
      tarifaRaw,
      tarifa,
      tipo,
      convencion,
      cobra: cobraRes.value,
      nota,
      vigenteDesdeRaw,
      vigenteDesde,
      previousVigenteId,
      status,
      message,
    };
  });
}

/* ---------- plantilla de ejemplo ---------- */

async function descargarPlantilla(navieras: Naviera[]) {
  const XLSX = await import("xlsx");
  const n1 = navieras[0]?.nombre ?? "MAERSK";
  const n2 = navieras[1]?.nombre ?? "HAPAG LLOYD";
  const hoy = ymdADate(hoyAR());
  const aoa: (string | number | Date)[][] = [
    [
      "naviera",
      "pais",
      "regimen",
      "tipo",
      "dias_libres",
      "tarifa_usd_dia",
      "hub",
      "convencion_conteo",
      "cobra_detention_origen",
      "vigente_desde",
      "nota",
    ],
    [n1, "ARGENTINA", "vacios", "Detention", 14, 2.5, "", "retiro_dia_1", "true", hoy, "ejemplo — reemplazar por datos reales"],
    [n2, "ARGENTINA", "vacios", "Detention", 10, 3.1, "", "retiro_dia_1", "true", hoy, ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "tarifas_origen");
  XLSX.writeFile(wb, "plantilla_tarifas_origen.xlsx", { cellDates: true });
}

/* ---------- resultado de la importación ---------- */

type ImportOutcome = { row: ParsedRow; ok: boolean; sinCambios: boolean; error: string | null };

function buildReporteTexto(outcomes: ImportOutcome[]): string {
  const ok = outcomes.filter((o) => o.ok && !o.sinCambios);
  const sinCambios = outcomes.filter((o) => o.ok && o.sinCambios);
  const fallidas = outcomes.filter((o) => !o.ok);
  const lineas: string[] = [];
  lineas.push(`Importación de tarifas de origen — ${new Date().toLocaleString("es-AR")}`);
  lineas.push(`Procesadas: ${outcomes.length} · OK: ${ok.length} · sin cambios: ${sinCambios.length} · fallidas: ${fallidas.length}`);
  lineas.push("");
  if (ok.length > 0) {
    lineas.push(`✔ Importadas (${ok.length}):`);
    for (const o of ok) {
      lineas.push(
        `  fila ${o.row.excelRow} — ${o.row.navieraRaw} · ${o.row.paisNombre}${o.row.hub ? ` (${o.row.hub})` : ""} · vigente desde ${fmtFechaDia(o.row.vigenteDesde)}`,
      );
    }
    lineas.push("");
  }
  if (sinCambios.length > 0) {
    lineas.push(`= Sin cambios — la versión vigente ya tenía estos valores (${sinCambios.length}):`);
    for (const o of sinCambios) {
      lineas.push(`  fila ${o.row.excelRow} — ${o.row.navieraRaw} · ${o.row.paisNombre}${o.row.hub ? ` (${o.row.hub})` : ""}`);
    }
    lineas.push("");
  }
  if (fallidas.length > 0) {
    lineas.push(`✘ Fallidas (${fallidas.length}):`);
    for (const o of fallidas) {
      lineas.push(`  fila ${o.row.excelRow} — ${o.row.navieraRaw} · ${o.row.paisNombre}: ${o.error}`);
    }
  }
  return lineas.join("\n");
}

/* ---------- componente principal ---------- */

type Step = "cargar" | "preview" | "importando" | "resultado";

export function ImportarTarifasOrigenModal({
  paises,
  navieras,
  onClose,
  onDone,
}: {
  paises: Pais[];
  navieras: Naviera[];
  onClose: () => void;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const paisesActivos = useMemo(() => paises.filter((p) => p.activo), [paises]);

  const [step, setStep] = useState<Step>("cargar");
  const [fileName, setFileName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [outcomes, setOutcomes] = useState<ImportOutcome[] | null>(null);
  const busy = loading || step === "importando";

  const counts = useMemo(() => {
    const r = rows ?? [];
    return {
      ok: r.filter((x) => x.status === "ok").length,
      warning: r.filter((x) => x.status === "warning").length,
      error: r.filter((x) => x.status === "error").length,
    };
  }, [rows]);

  const procesables = counts.ok + counts.warning;

  const handleFile = async (file: File) => {
    setLoadError(null);
    setLoading(true);
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error("El archivo no tiene ninguna hoja.");
      const ws = wb.Sheets[sheetName];
      const headerRow = ((XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })[0] as unknown[]) ?? []).map((h) =>
        String(h ?? "").trim(),
      );
      if (headerRow.length === 0) throw new Error("No se pudo leer la fila de encabezados (primera hoja vacía).");
      const { map: headerMap, missing } = buildHeaderMap(headerRow);
      if (missing.length > 0) {
        throw new Error(
          `Faltan columnas obligatorias: ${missing.map((m) => m.label).join(", ")}. Revisá los encabezados de la primera hoja (o descargá la plantilla).`,
        );
      }
      const dataRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", blankrows: false });
      if (dataRows.length === 0) throw new Error("El archivo no tiene filas de datos debajo del encabezado.");
      if (dataRows.length > MAX_ROWS) {
        throw new Error(
          `El archivo tiene ${dataRows.length} filas — el importador soporta hasta ${MAX_ROWS} por vez. Dividilo en lotes más chicos.`,
        );
      }

      // snapshot de vigentes actuales (cruza combinación naviera+régimen+país+hub) para
      // detectar en la previsualización qué filas van a CERRAR una versión existente.
      const { data: vigentes, error: vigError } = await getSupabase()
        .from("freetime_origin")
        .select("id, naviera_id, pais_id, hub, regimen, dias_libres, tarifa_usd_dia, tipo, vigente_desde")
        .is("vigente_hasta", null)
        .limit(VIGENTES_CAP);
      if (vigError) throw new Error(`No se pudo leer el estado actual de tarifas: ${vigError.message}`);

      const vigMap = new Map<string, VigenteSnap>();
      for (const v of (vigentes ?? []) as {
        id: string;
        naviera_id: string;
        pais_id: string;
        hub: string | null;
        regimen: string;
        dias_libres: number;
        tarifa_usd_dia: number;
        tipo: string;
        vigente_desde: string;
      }[]) {
        const key = `${v.naviera_id}|${v.regimen}|${v.pais_id}|${v.hub ?? ""}`;
        vigMap.set(key, { id: v.id, diasLibres: v.dias_libres, tarifaUsdDia: v.tarifa_usd_dia, tipo: v.tipo, vigenteDesde: v.vigente_desde });
      }

      const parsed = parseRows(dataRows, headerMap, navieras, paisesActivos, vigMap, XLSX);
      setRows(parsed);
      setStep("preview");
    } catch (e) {
      // Vuelve siempre al paso 1: si el error ocurre al re-cargar desde el preview ("Cargar
      // otro archivo"), el aviso tiene que quedar visible — el paso 1 es el único que lo
      // renderiza — y la tabla vieja no debe seguir mostrándose como si fuera válida.
      setStep("cargar");
      setRows(null);
      setLoadError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    if (!rows) return;
    const toProcess = rows.filter((r) => r.status !== "error");
    setStep("importando");
    setProgress({ done: 0, total: toProcess.length });
    const supabase = getSupabase();
    const results: ImportOutcome[] = [];
    // SECUENCIAL a propósito: son escrituras de plata y el orden del archivo importa
    // (dos filas de la misma combinación deben cerrarse/abrirse en orden).
    for (const row of toProcess) {
      const { data, error } = await supabase.rpc("crm_nueva_version_freetime", {
        p_naviera: row.navieraId,
        p_dias: row.diasLibres,
        p_peligrosa: false,
        p_tipo: row.tipo,
        p_tarifa: row.tarifa,
        p_desde: row.vigenteDesde,
        p_regimen: row.regimen,
        p_convencion: row.convencion,
        p_cobra: row.cobra,
        p_pais: row.paisNombre,
        p_hub: row.hub,
        p_freetime_reefer: null,
        p_tarifa_reefer_usd_dia: null,
        p_nota: row.nota,
      });
      if (error) {
        results.push({ row, ok: false, sinCambios: false, error: error.message });
      } else {
        const newId = data as string | null;
        results.push({ row, ok: true, sinCambios: newId !== null && newId === row.previousVigenteId, error: null });
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setOutcomes(results);
    setStep("resultado");
  };

  const columns: Column<ParsedRow>[] = [
    { key: "fila", header: "fila", numeric: true, render: (r) => r.excelRow, sortValue: (r) => r.excelRow, width: "56px" },
    {
      key: "naviera",
      header: "naviera",
      render: (r) => <span style={{ fontWeight: 600 }}>{r.navieraRaw || "—"}</span>,
      sortValue: (r) => r.navieraRaw,
    },
    { key: "pais", header: "país", render: (r) => `${r.paisRaw}${r.hub ? ` (${r.hub})` : ""}`, sortValue: (r) => r.paisRaw },
    { key: "regimen", header: "régimen", render: (r) => REGIMEN_LABELS[r.regimen] ?? r.regimen, hideOnMobile: true },
    { key: "tipo", header: "tipo", render: (r) => r.tipo, hideOnMobile: true },
    {
      key: "dias",
      header: "días libres",
      numeric: true,
      render: (r) => (r.diasLibres != null ? r.diasLibres : <span style={{ color: "var(--color-status-red)" }}>{r.diasLibresRaw || "—"}</span>),
      sortValue: (r) => r.diasLibres,
    },
    {
      key: "tarifa",
      header: "tarifa",
      numeric: true,
      render: (r) => (r.tarifa != null ? fmtUSDTarifa(r.tarifa) : <span style={{ color: "var(--color-status-red)" }}>{r.tarifaRaw || "—"}</span>),
      sortValue: (r) => r.tarifa,
    },
    {
      key: "desde",
      header: "vigente desde",
      render: (r) => (r.vigenteDesde ? fmtFechaDia(r.vigenteDesde) : <span style={{ color: "var(--color-status-red)" }}>{r.vigenteDesdeRaw || "—"}</span>),
      sortValue: (r) => r.vigenteDesde,
    },
  ];

  const reporteTexto = outcomes ? buildReporteTexto(outcomes) : "";
  const anyOk = outcomes ? outcomes.some((o) => o.ok) : false;

  // Cerrar desde "resultado" (X, backdrop o el botón) SIEMPRE refresca — ya hubo escritura.
  // Cerrar antes (cargar/preview) es un cancel puro: nada se escribió todavía.
  const handleCancel = () => {
    if (busy) return;
    if (step === "resultado") {
      onDone();
      return;
    }
    onClose();
  };
  const handleFinish = () => onDone();

  const titulo =
    step === "cargar"
      ? "Importar tarifas de origen — 1. Cargar archivo"
      : step === "preview"
        ? "Importar tarifas de origen — 2. Revisar y validar"
        : step === "importando"
          ? "Importar tarifas de origen — 3. Importando…"
          : "Importar tarifas de origen — 3. Resultado";

  return (
    <Modal open onClose={handleCancel} title={titulo} width={860} closeOnBackdrop={!busy}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {step === "cargar" && (
          <>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              Subí un .xlsx o .csv con una tarifa por fila. La primera hoja se lee tal cual — encabezados flexibles
              (mayúsculas/minúsculas y acentos no importan). Columnas obligatorias:{" "}
              <strong>naviera, días libres, tarifa y vigente desde</strong>. El resto (país, régimen, tipo, hub,
              convención de conteo, cobra detention, nota) es opcional y usa los mismos valores por defecto que el
              alta manual.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="primary" icon="ti-file-spreadsheet" loading={loading} onClick={() => inputRef.current?.click()}>
                Elegir archivo
              </Button>
              <Button variant="ghost" icon="ti-download" onClick={() => void descargarPlantilla(navieras)} disabled={loading}>
                Descargar plantilla
              </Button>
              {fileName && !loading && <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{fileName}</span>}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleFile(file);
              }}
            />
            {loadError && <FormAlert>{loadError}</FormAlert>}
          </>
        )}

        {(step === "preview" || step === "importando") && rows && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Badge tone="verde" icon="ti-circle-check" mono>
                {counts.ok} listas
              </Badge>
              <Badge tone="amarillo" icon="ti-alert-triangle" mono>
                {counts.warning} con advertencia
              </Badge>
              <Badge tone="rojo" icon="ti-x" mono>
                {counts.error} con error
              </Badge>
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--color-text-muted)" }}>{fileName}</span>
            </div>

            {counts.error === rows.length && (
              <FormAlert>Todas las filas tienen error — no hay nada para importar. Corregí el archivo y volvé a cargarlo.</FormAlert>
            )}

            {step === "importando" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <ProgressBar
                  pct={progress.total > 0 ? (progress.done / progress.total) * 100 : 0}
                  tone="ok"
                  minWidth={0}
                  ariaLabel="progreso de importación"
                />
                <span className="mono" style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
                  {progress.done}/{progress.total} filas procesadas — no cierres esta ventana
                </span>
              </div>
            )}

            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => String(r.excelRow)}
              validation={(r) => ({ type: r.status, message: r.message ?? undefined })}
              pageSize={20}
              maxHeight={420}
              defaultSort={{ key: "fila", dir: "asc" }}
            />
          </>
        )}

        {step === "resultado" && outcomes && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge tone="verde" icon="ti-circle-check" mono>
                {outcomes.filter((o) => o.ok && !o.sinCambios).length} importadas
              </Badge>
              <Badge tone="neutro" mono>
                {outcomes.filter((o) => o.ok && o.sinCambios).length} sin cambios
              </Badge>
              <Badge tone="rojo" icon="ti-x" mono>
                {outcomes.filter((o) => !o.ok).length} fallidas
              </Badge>
            </div>
            <textarea
              readOnly
              value={reporteTexto}
              rows={14}
              className="mono"
              style={{
                width: "100%",
                resize: "vertical",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "var(--radius-input)",
                padding: "10px 12px",
                fontSize: 11.5,
                lineHeight: 1.6,
                color: "var(--color-text-secondary)",
              }}
              onFocus={(e) => e.currentTarget.select()}
            />
            <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-faint)" }}>
              El texto de arriba está seleccionado al enfocar el cuadro — Ctrl/Cmd+C para copiarlo completo.
            </p>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          {step === "cargar" && (
            <Button variant="ghost" onClick={handleCancel}>
              Cancelar
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button variant="ghost" icon="ti-file-spreadsheet" onClick={() => inputRef.current?.click()}>
                Cargar otro archivo
              </Button>
              <Button variant="primary" icon="ti-upload" disabled={procesables === 0} onClick={() => void runImport()}>
                Importar {procesables} fila{procesables === 1 ? "" : "s"}
              </Button>
            </>
          )}
          {step === "resultado" && (
            <Button variant="primary" onClick={handleFinish}>
              {anyOk ? "Listo — actualizar tabla" : "Cerrar"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
