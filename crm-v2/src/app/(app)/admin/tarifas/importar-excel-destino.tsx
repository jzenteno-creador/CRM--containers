"use client";

// Importador de tarifas de freetime desde Excel/CSV (Admin → Tarifas, pestaña Destino).
// Espejo de importar-excel.tsx (Origen) para freetime_destino — MISMO flujo de 3 pasos,
// MISMO enfoque de simulación del efecto atómico de la RPC, pero con la matriz de
// validación propia del modelo de destino (ver migración 026_multiregion_freetime.sql):
//
//   - freetime_destino NO tiene régimen (freetime_origin sí) — acá no hay ese campo.
//   - Tres contadores de días NULLABLE en vez de uno: dias_combined, dias_demurrage,
//     dias_detention. El motor (vista_alertas_impo, migración 039) decide el modo así:
//       split    si dias_demurrage Y dias_detention están cargados Y (demurrage+detention) > 0
//       combined en cualquier otro caso (incluida la fila que no cargó nada)
//     El preview simula esa misma regla para avisar de dos problemas que la RPC NO
//     rechaza (son válidos a nivel de columna, solo inútiles a nivel de negocio):
//       (a) los tres contadores en null → tarifa "inerte" (el motor nunca va a calcular)
//       (b) combined Y split cargados a la vez → ambigüedad (el motor usa split y
//           el valor de combined queda guardado pero NUNCA se lee)
//   - aplica_carga_peligrosa es NULLABLE (tri-estado: sin dato / true / false), a
//     diferencia de origen que es boolean NOT NULL con default false. Acá "" = sin dato.
//   - Tarifas: tarifa_dry_usd_dia y tarifa_reefer_usd_dia (origen solo tiene una tarifa
//     "dry" + la reefer opcional con los mismos nombres).
//
// Escribe SOLO vía crm_nueva_version_freetime_destino, fila por fila, SECUENCIAL (no
// Promise.all: son escrituras de plata y el orden importa — dos filas de la MISMA
// combinación naviera+país+hub deben cerrarse/abrirse en el orden del archivo). Mismos
// parámetros y mismos defaults que DestinoVersionModal en modo alta (page.tsx) — este
// módulo NO reimplementa la lógica de versionado, solo arma el payload y llama la RPC
// (ver AGENTS.md "regla de escritura a la DB": freetime_destino es RPC-only).
//
// A diferencia de crm_nueva_version_freetime (origen), crm_nueva_version_freetime_destino
// NO tiene lógica de herencia de convención desde la versión anterior — p_convencion es
// NOT NULL a nivel de validación de la función (rechaza NULL explícito, aunque el SQL
// declare DEFAULT 'retiro_dia_1' — el default de Postgres solo aplica si el parámetro se
// OMITE, no si se manda NULL). Por eso acá "convencion" SIEMPRE resuelve a un string
// concreto ("retiro_dia_1" si el Excel no trae la columna), nunca null.
//
// Gating: el botón que abre este modal vive en DestinoPanel, que solo se renderiza si
// TarifasPage ya resolvió isAdmin (mismo gate que "Nueva tarifa") — no hay chequeo propio
// acá, la RPC además valida rol server-side (defensa en profundidad, igual que el resto
// de la página).
//
// Lo genuinamente común con el importador de origen (normalización de encabezados/
// valores, parseo de números/fechas, resolución de nombre→id) vive en
// importar-excel-shared.ts — ver ese archivo para el porqué de no compartir más.

import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { DataTable, type Column } from "@/components/fd/data-table";
import { ProgressBar } from "@/components/fd/freetime-meter";
import { FormAlert } from "@/components/fd/form-alert";
import { Modal } from "@/components/fd/modal";
import { fmtFechaDia, fmtUSDTarifa, hoyAR, ymdADate } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import {
  MAX_ROWS,
  VIGENTES_CAP,
  normKey,
  parseBool,
  parseFecha,
  parseNumber,
  rawDisplay,
  resolveByName,
} from "./importar-excel-shared";

type Naviera = { id: string; nombre: string };
type Pais = { id: string; nombre: string; activo: boolean };

// Sinónimos EXACTOS del brief — case/acentos-insensitive vía normKey.
const HEADER_SYNONYMS: Record<string, string> = {
  naviera: "naviera",
  pais: "pais",
  hub: "hub",
  dias_combined: "dias_combined",
  combined: "dias_combined",
  dias_demurrage: "dias_demurrage",
  demurrage: "dias_demurrage",
  dias_detention: "dias_detention",
  detention: "dias_detention",
  tarifa_dry: "tarifa_dry",
  tarifa: "tarifa_dry",
  tarifa_dry_usd_dia: "tarifa_dry",
  usd_dia: "tarifa_dry",
  tarifa_reefer: "tarifa_reefer",
  tarifa_reefer_usd_dia: "tarifa_reefer",
  freetime_reefer: "freetime_reefer",
  vigente_desde: "vigente_desde",
  desde: "vigente_desde",
  convencion_conteo: "convencion_conteo",
  convencion: "convencion_conteo",
  carga_peligrosa: "carga_peligrosa",
  peligrosa: "carga_peligrosa",
  nota: "nota",
  notas: "nota",
};

// Bloquean el procesamiento ANTES de leer una sola fila si falta el encabezado. A
// diferencia de origen, acá SOLO naviera y vigente_desde son obligatorios — los tres
// contadores de días y las tarifas son NULLABLE en freetime_destino (una fila puede
// cargar únicamente combined, únicamente split, o ninguno todavía — el preview lo
// marca con advertencia, no con error, ver computeModo más abajo).
const REQUIRED_CANONICAL: { key: string; label: string }[] = [
  { key: "naviera", label: "naviera" },
  { key: "vigente_desde", label: "vigente desde (vigente_desde / desde)" },
];

/* ---------- modo del reloj (split/combined/ambiguo/inerte) — espejo de vista_alertas_impo ---------- */

type Modo = "combined" | "split" | "ambiguo" | "inerte";

function computeModo(diasCombined: number | null, diasDemurrage: number | null, diasDetention: number | null): Modo {
  const isSplit = diasDemurrage != null && diasDetention != null && diasDemurrage + diasDetention > 0;
  const isCombinedLoaded = diasCombined != null;
  if (isSplit && isCombinedLoaded) return "ambiguo";
  if (isSplit) return "split";
  if (isCombinedLoaded) return "combined";
  return "inerte";
}

const MODO_BADGE: Record<Modo, { tone: "verde" | "amarillo" | "rojo"; label: string }> = {
  combined: { tone: "verde", label: "combined" },
  split: { tone: "verde", label: "split" },
  ambiguo: { tone: "amarillo", label: "ambiguo" },
  inerte: { tone: "rojo", label: "inerte" },
};

/* ---------- fila parseada + validación ---------- */

type ImportStatus = "ok" | "warning" | "error";

type ParsedRow = {
  excelRow: number;
  navieraRaw: string;
  navieraId: string | null;
  paisRaw: string;
  paisId: string | null;
  paisNombre: string;
  hub: string | null;
  diasCombinedRaw: string;
  diasCombined: number | null;
  diasDemurrageRaw: string;
  diasDemurrage: number | null;
  diasDetentionRaw: string;
  diasDetention: number | null;
  tarifaDryRaw: string;
  tarifaDry: number | null;
  tarifaReeferRaw: string;
  tarifaReefer: number | null;
  freetimeReeferRaw: string;
  freetimeReefer: number | null;
  peligrosa: boolean | null;
  convencion: string;
  nota: string | null;
  vigenteDesdeRaw: string;
  vigenteDesde: string | null;
  modo: Modo;
  previousVigenteId: string | null;
  status: ImportStatus;
  message: string | null;
};

type VigenteSnap = {
  id: string;
  diasCombined: number | null;
  diasDemurrage: number | null;
  diasDetention: number | null;
  tarifaDry: number | null;
  vigenteDesde: string;
};

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
  const intErr = (label: string, raw: string, n: number | null) =>
    raw !== "" && (n == null || !Number.isInteger(n) || n < 0) ? `${label} inválido: "${raw}" (entero ≥ 0)` : null;
  const numErr = (label: string, raw: string, n: number | null) =>
    raw !== "" && (n == null || n < 0) ? `${label} inválida: "${raw}" (número ≥ 0)` : null;

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

    const diasCombinedInput = getCanon(raw, headerMap, "dias_combined");
    const diasCombinedRaw = rawDisplay(diasCombinedInput);
    const diasCombined = parseNumber(diasCombinedInput);
    const eCombined = intErr("días combined", diasCombinedRaw, diasCombined);
    if (eCombined) errors.push(eCombined);

    const diasDemurrageInput = getCanon(raw, headerMap, "dias_demurrage");
    const diasDemurrageRaw = rawDisplay(diasDemurrageInput);
    const diasDemurrage = parseNumber(diasDemurrageInput);
    const eDemurrage = intErr("días demurrage", diasDemurrageRaw, diasDemurrage);
    if (eDemurrage) errors.push(eDemurrage);

    const diasDetentionInput = getCanon(raw, headerMap, "dias_detention");
    const diasDetentionRaw = rawDisplay(diasDetentionInput);
    const diasDetention = parseNumber(diasDetentionInput);
    const eDetention = intErr("días detention", diasDetentionRaw, diasDetention);
    if (eDetention) errors.push(eDetention);

    const tarifaDryInput = getCanon(raw, headerMap, "tarifa_dry");
    const tarifaDryRaw = rawDisplay(tarifaDryInput);
    const tarifaDry = parseNumber(tarifaDryInput);
    const eTarifaDry = numErr("tarifa dry", tarifaDryRaw, tarifaDry);
    if (eTarifaDry) errors.push(eTarifaDry);

    const tarifaReeferInput = getCanon(raw, headerMap, "tarifa_reefer");
    const tarifaReeferRaw = rawDisplay(tarifaReeferInput);
    const tarifaReefer = parseNumber(tarifaReeferInput);
    const eTarifaReefer = numErr("tarifa reefer", tarifaReeferRaw, tarifaReefer);
    if (eTarifaReefer) errors.push(eTarifaReefer);

    const freetimeReeferInput = getCanon(raw, headerMap, "freetime_reefer");
    const freetimeReeferRaw = rawDisplay(freetimeReeferInput);
    const freetimeReefer = parseNumber(freetimeReeferInput);
    const eFreetimeReefer = intErr("freetime reefer", freetimeReeferRaw, freetimeReefer);
    if (eFreetimeReefer) errors.push(eFreetimeReefer);

    const desdeInput = getCanon(raw, headerMap, "vigente_desde");
    const vigenteDesdeRaw = rawDisplay(desdeInput);
    const vigenteDesde = desdeInput === undefined ? null : parseFecha(desdeInput, XLSX);
    if (desdeInput === undefined) errors.push("falta la fecha de vigencia (vigente_desde)");
    else if (!vigenteDesde) errors.push(`fecha de vigencia ilegible: "${vigenteDesdeRaw}" (usá AAAA-MM-DD o DD/MM/AAAA)`);

    const convencionInput = rawDisplay(getCanon(raw, headerMap, "convencion_conteo"));
    let convencion = "retiro_dia_1";
    if (convencionInput !== "") {
      const norm = normKey(convencionInput);
      if (norm === "retiro_dia_1" || norm === "dia_1") convencion = "retiro_dia_1";
      else if (norm === "retiro_dia_0" || norm === "dia_0") convencion = "retiro_dia_0";
      else errors.push(`convención de conteo inválida: "${convencionInput}" (válidos: retiro_dia_1, retiro_dia_0)`);
    }

    const peligrosaInput = getCanon(raw, headerMap, "carga_peligrosa");
    const peligrosaRes = parseBool(peligrosaInput);
    if (!peligrosaRes.ok) errors.push(`valor inválido en carga_peligrosa: "${rawDisplay(peligrosaInput)}" (usá sí/no, o dejalo vacío)`);

    const notaRaw = rawDisplay(getCanon(raw, headerMap, "nota"));
    const nota = notaRaw === "" ? null : notaRaw;

    const modo = computeModo(diasCombined, diasDemurrage, diasDetention);
    if (modo === "inerte") {
      warnings.push(
        "no carga combined ni demurrage+detention — la tarifa queda inerte, el motor de costeo no va a calcular nada para esta combinación hasta que cargues al menos uno de los dos modos",
      );
    } else if (modo === "ambiguo") {
      warnings.push(
        `cargaste combined (${diasCombined} días) Y demurrage+detention (${diasDemurrage}+${diasDetention} días) a la vez — el motor arranca en modo split automáticamente cuando demurrage y detention están cargados y suman > 0, así que combined se va a guardar pero NINGÚN cálculo lo va a leer`,
      );
    } else if (tarifaDry == null) {
      warnings.push(
        `días de ${modo} cargados pero falta tarifa_dry_usd_dia — sin tarifa el motor no calcula costo para esta combinación aunque los días estén completos`,
      );
    }

    let previousVigenteId: string | null = null;
    if (naviera && pais && vigenteDesde && errors.length === 0) {
      const key = `${naviera.id}|${pais.id}|${hub ?? ""}`;
      const prev = vigMap.get(key);
      if (prev) {
        previousVigenteId = prev.id;
        if (vigenteDesde <= prev.vigenteDesde) {
          errors.push(
            `la vigencia nueva (${fmtFechaDia(vigenteDesde)}) debe ser posterior a la vigente actual de esta combinación (${fmtFechaDia(prev.vigenteDesde)})`,
          );
        } else {
          warnings.push(
            `ya existe una versión vigente desde ${fmtFechaDia(prev.vigenteDesde)} — combined ${prev.diasCombined ?? "—"} / demurrage ${prev.diasDemurrage ?? "—"} / detention ${prev.diasDetention ?? "—"}, ${fmtUSDTarifa(prev.tarifaDry)}/día. Esta importación la va a CERRAR y reemplazar.`,
          );
        }
      }
      // Simula el efecto atómico de la RPC (cierra + abre) para que filas duplicadas del
      // MISMO archivo se comparen contra lo que la fila anterior dejaría vigente, no
      // contra el snapshot inicial de la DB. A diferencia de origen, acá NO se exige
      // diasCombined/tarifa != null: una fila "inerte" (los tres contadores en null) es
      // una versión válida que igual cierra la anterior — el warning ya avisó del hecho.
      // (!prev || vigenteDesde > prev.vigenteDesde) ya excluye el caso de error de arriba:
      // si vigenteDesde <= prev.vigenteDesde la condición da false y el snapshot no se toca.
      if (!prev || vigenteDesde > prev.vigenteDesde) {
        vigMap.set(key, { id: prev?.id ?? "pendiente", diasCombined, diasDemurrage, diasDetention, tarifaDry, vigenteDesde });
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
      hub,
      diasCombinedRaw,
      diasCombined,
      diasDemurrageRaw,
      diasDemurrage,
      diasDetentionRaw,
      diasDetention,
      tarifaDryRaw,
      tarifaDry,
      tarifaReeferRaw,
      tarifaReefer,
      freetimeReeferRaw,
      freetimeReefer,
      peligrosa: peligrosaRes.value,
      convencion,
      nota,
      vigenteDesdeRaw,
      vigenteDesde,
      modo,
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
      "hub",
      "dias_combined",
      "dias_demurrage",
      "dias_detention",
      "tarifa_dry",
      "tarifa_reefer",
      "freetime_reefer",
      "convencion_conteo",
      "carga_peligrosa",
      "vigente_desde",
      "nota",
    ],
    // ejemplo 1: modo combined — un solo contador, demurrage/detention vacíos.
    [n1, "ARGENTINA", "", 21, "", "", 4.2, 6.5, 5, "retiro_dia_1", "true", hoy, "ejemplo combined — reemplazar por datos reales"],
    // ejemplo 2: modo split — demurrage + detention cargados, combined vacío.
    [n2, "ARGENTINA", "", "", 7, 14, 3.8, "", "", "retiro_dia_1", "", hoy, "ejemplo split — demurrage 7 + detention 14"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "tarifas_destino");
  XLSX.writeFile(wb, "plantilla_tarifas_destino.xlsx", { cellDates: true });
}

/* ---------- resultado de la importación ---------- */

type ImportOutcome = { row: ParsedRow; ok: boolean; sinCambios: boolean; error: string | null };

function buildReporteTexto(outcomes: ImportOutcome[]): string {
  const ok = outcomes.filter((o) => o.ok && !o.sinCambios);
  const sinCambios = outcomes.filter((o) => o.ok && o.sinCambios);
  const fallidas = outcomes.filter((o) => !o.ok);
  const lineas: string[] = [];
  lineas.push(`Importación de tarifas de destino — ${new Date().toLocaleString("es-AR")}`);
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

export function ImportarTarifasDestinoModal({
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

      // snapshot de vigentes actuales (cruza combinación naviera+país+hub — sin régimen,
      // freetime_destino no lo tiene) para detectar en la previsualización qué filas van a
      // CERRAR una versión existente.
      const { data: vigentes, error: vigError } = await getSupabase()
        .from("freetime_destino")
        .select("id, naviera_id, pais_id, hub, dias_combined, dias_demurrage, dias_detention, tarifa_dry_usd_dia, vigente_desde")
        .is("vigente_hasta", null)
        .limit(VIGENTES_CAP);
      if (vigError) throw new Error(`No se pudo leer el estado actual de tarifas: ${vigError.message}`);

      const vigMap = new Map<string, VigenteSnap>();
      for (const v of (vigentes ?? []) as {
        id: string;
        naviera_id: string;
        pais_id: string;
        hub: string | null;
        dias_combined: number | null;
        dias_demurrage: number | null;
        dias_detention: number | null;
        tarifa_dry_usd_dia: number | null;
        vigente_desde: string;
      }[]) {
        const key = `${v.naviera_id}|${v.pais_id}|${v.hub ?? ""}`;
        vigMap.set(key, {
          id: v.id,
          diasCombined: v.dias_combined,
          diasDemurrage: v.dias_demurrage,
          diasDetention: v.dias_detention,
          tarifaDry: v.tarifa_dry_usd_dia,
          vigenteDesde: v.vigente_desde,
        });
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
      const { data, error } = await supabase.rpc("crm_nueva_version_freetime_destino", {
        p_naviera: row.navieraId,
        p_pais: row.paisNombre,
        p_desde: row.vigenteDesde,
        p_hub: row.hub,
        p_dias_combined: row.diasCombined,
        p_dias_demurrage: row.diasDemurrage,
        p_dias_detention: row.diasDetention,
        p_peligrosa: row.peligrosa,
        p_tarifa_dry_usd_dia: row.tarifaDry,
        p_tarifa_reefer_usd_dia: row.tarifaReefer,
        p_freetime_reefer: row.freetimeReefer,
        p_convencion: row.convencion,
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
    {
      key: "combined",
      header: "combined",
      numeric: true,
      render: (r) => (r.diasCombinedRaw === "" ? <span style={{ color: "var(--color-text-faint)" }}>—</span> : (r.diasCombined ?? <span style={{ color: "var(--color-status-red)" }}>{r.diasCombinedRaw}</span>)),
      sortValue: (r) => r.diasCombined,
      hideOnMobile: true,
    },
    {
      key: "demurrage",
      header: "demurrage",
      numeric: true,
      render: (r) => (r.diasDemurrageRaw === "" ? <span style={{ color: "var(--color-text-faint)" }}>—</span> : (r.diasDemurrage ?? <span style={{ color: "var(--color-status-red)" }}>{r.diasDemurrageRaw}</span>)),
      sortValue: (r) => r.diasDemurrage,
      hideOnMobile: true,
    },
    {
      key: "detention",
      header: "detention",
      numeric: true,
      render: (r) => (r.diasDetentionRaw === "" ? <span style={{ color: "var(--color-text-faint)" }}>—</span> : (r.diasDetention ?? <span style={{ color: "var(--color-status-red)" }}>{r.diasDetentionRaw}</span>)),
      sortValue: (r) => r.diasDetention,
      hideOnMobile: true,
    },
    {
      key: "modo",
      header: "modo",
      render: (r) => (
        <Badge tone={MODO_BADGE[r.modo].tone} mono>
          {MODO_BADGE[r.modo].label}
        </Badge>
      ),
      sortValue: (r) => r.modo,
    },
    {
      key: "tarifa",
      header: "tarifa dry",
      numeric: true,
      render: (r) => (r.tarifaDryRaw === "" ? <span style={{ color: "var(--color-text-faint)" }}>—</span> : (r.tarifaDry != null ? fmtUSDTarifa(r.tarifaDry) : <span style={{ color: "var(--color-status-red)" }}>{r.tarifaDryRaw}</span>)),
      sortValue: (r) => r.tarifaDry,
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
      ? "Importar tarifas de destino — 1. Cargar archivo"
      : step === "preview"
        ? "Importar tarifas de destino — 2. Revisar y validar"
        : step === "importando"
          ? "Importar tarifas de destino — 3. Importando…"
          : "Importar tarifas de destino — 3. Resultado";

  return (
    <Modal open onClose={handleCancel} title={titulo} width={920} closeOnBackdrop={!busy}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {step === "cargar" && (
          <>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              Subí un .xlsx o .csv con una tarifa por fila. La primera hoja se lee tal cual — encabezados flexibles
              (mayúsculas/minúsculas y acentos no importan). Columnas obligatorias: <strong>naviera y vigente desde</strong>. El
              resto (país, hub, días combined/demurrage/detention, tarifas dry/reefer, freetime reefer, convención de
              conteo, carga peligrosa, nota) es opcional y usa los mismos valores por defecto que el alta manual.
            </p>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
              El motor arranca en modo <strong>split</strong> cuando demurrage y detention están cargados y suman más de
              0 días; si no, usa <strong>combined</strong>. Cargar los dos modos a la vez no rompe la importación, pero
              el preview lo marca como ambiguo — solo split se va a leer.
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
