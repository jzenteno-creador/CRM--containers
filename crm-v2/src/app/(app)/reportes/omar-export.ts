// B7 — Excel formato Omar: réplica EXACTA del Excel manual de stock de contenedores que
// Omar Pérez arma a mano los martes y jueves. Criterio de aceptación (brief B7): Omar puede
// comparar este archivo contra el suyo SIN traducir columnas — headers, orden y hojas fijos.
//
// EL FRONT NO CALCULA. Este módulo es fetch + merge + formato de presentación, cero
// aritmética de negocio:
// - Los números (estadía, días libres, días restantes, tarifa, costo neto/proyectado,
//   estado_semaforo) salen YA CALCULADOS de `crm.vista_alertas` (idéntica fuente que usa
//   /alertas y el export configurable de esta misma pantalla). Se traen una sola vez, sin
//   filtro de estado (la vista ya excluye cerradas/anuladas) — es SIEMPRE el stock completo
//   abierto, nunca la tabla filtrada por el usuario en el panel de arriba.
// - El resto de los campos (tipo, reforzado, retiro de, booking, carga, observaciones,
//   producto) son READ directo de `operaciones` + `contenedores` + `vista_carga_actual`,
//   igual que el resto de /reportes.
//
// Dos derivaciones de PRESENTACIÓN (no hay columna equivalente en la vista, pero tampoco
// se inventa una regla de negocio nueva — ver comentarios puntuales más abajo):
//   1. Fecha de vencimiento = fecha_retiro + (dias_libres − 1) días corridos.
//   2. Demora (días) = exceso sobre el freetime = max(0, −dias_restantes).
// Ambas están validadas empíricamente contra la vista viva (ver comentario en
// `addDiasYMD`/`buildOmarRows`) y quedan documentadas como candidatas a moverse a
// `vista_alertas` en una migración futura (033+) si el negocio las considera cálculo, no
// presentación.
//
// Bucketing de las 3 hojas de detalle: en vez de re-leer `configuracion.umbral_alerta_amarillo`
// y recalcular "0 <= dias_restantes <= umbral" en el cliente (duplicaría lógica de negocio que
// YA vive en la vista), se usa directamente `estado_semaforo` — la vista aplica ESE MISMO
// umbral para decidir rojo/amarillo/verde/neutro (ver crm.vista_alertas, migración 019). Mismo
// resultado, cero regla de negocio nueva en el front.

import { fechaAR, hoyAR } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";

// Mismo tamaño de lote que el resto de /reportes (acota el largo de la URL del .in()).
const IN_CHUNK = 200;

// Mismo valor que el FETCH_CAP de page.tsx (cap de seguridad del export configurable) — se
// duplica en vez de importarse para no crear un ciclo page.tsx ↔ omar-export.ts (page.tsx
// ya importa `generarExcelOmar` de este archivo). Si se cambia acá, cambiar también allá.
const OMAR_FETCH_CAP = 1000;

// ── 1. stock abierto (vista_alertas, SIN filtros — siempre completo) ───────────────────

type Semaforo = "verde" | "amarillo" | "rojo" | "neutro";

type StockAbiertoRow = {
  operacion_id: string;
  numero_contenedor: string;
  naviera: string | null;
  planta_actual: string | null;
  fecha_retiro: string;
  dias_estadia: number | null;
  dias_libres: number | null;
  dias_restantes: number | null;
  tarifa_usd_dia: number | null;
  costo_neto: number | null;
  estado_semaforo: Semaforo;
};

const STOCK_SELECT =
  "operacion_id, numero_contenedor, naviera, planta_actual, fecha_retiro, " +
  "dias_estadia, dias_libres, dias_restantes, tarifa_usd_dia, costo_neto, estado_semaforo";

/**
 * Trae TODO el stock abierto (vista_alertas ya excluye cerrado/anulada — no se agrega
 * ningún .eq de estado). Cap de seguridad = OMAR_FETCH_CAP: se pide OMAR_FETCH_CAP+1 para
 * detectar si se tocó el cap sin una query de count aparte. Orden por urgencia
 * (dias_restantes ascendente — Postgres ya deja los NULL al final en ASC) para que, si el
 * cap se toca, las operaciones más vencidas queden adentro.
 */
async function fetchStockAbierto(): Promise<{ rows: StockAbiertoRow[]; capped: boolean }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vista_alertas")
    .select(STOCK_SELECT)
    .order("dias_restantes", { ascending: true })
    .limit(OMAR_FETCH_CAP + 1);
  if (error) throw new Error(error.message);
  const all = (data as unknown as StockAbiertoRow[]) ?? [];
  const capped = all.length > OMAR_FETCH_CAP;
  return { rows: capped ? all.slice(0, OMAR_FETCH_CAP) : all, capped };
}

// ── 2. detalle (operaciones + contenedor + depósito) ────────────────────────────────────

type DetalleRow = {
  id: string;
  retiro_de: string | null;
  booking_retiro: string | null;
  booking_asignado: string | null;
  estado_carga: string;
  observaciones: string | null;
  contenedor: { tipo: string; reforzado_estado: string } | null;
  deposito: { nombre: string } | null;
};

// contenedor con !inner: toda operación tiene contenedor (FK not null) → no descarta filas,
// mismo patrón que SELECT_BASE de page.tsx.
const DETALLE_SELECT =
  "id, retiro_de, booking_retiro, booking_asignado, estado_carga, observaciones, " +
  "contenedor:contenedores!inner(tipo, reforzado_estado), " +
  "deposito:depositos!retiro_de_id(nombre)";

async function fetchDetalleOperaciones(ids: string[]): Promise<Map<string, DetalleRow>> {
  const map = new Map<string, DetalleRow>();
  if (ids.length === 0) return map;
  const supabase = getSupabase();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK));
  const results = await Promise.all(
    chunks.map((c) => supabase.from("operaciones").select(DETALLE_SELECT).in("id", c)),
  );
  // A diferencia de fetchViewNumbers de page.tsx (tolerante), acá un error de query SÍ
  // interrumpe: el reporte de Omar es un documento de control — generarlo incompleto sin
  // avisar sería peor que no generarlo (rompe la confianza de "comparar sin traducir").
  for (const res of results) {
    if (res.error) throw new Error(res.error.message);
    for (const row of (res.data as unknown as DetalleRow[]) ?? []) map.set(row.id, row);
  }
  return map;
}

// ── 3. carga vigente (vista_carga_actual) — mismo patrón que fetchCargaActual de page.tsx ──

type CargaActualRow = {
  operacion_id: string;
  lineas: { gmid: string; descripcion: string }[];
};

async function fetchCargaActualOmar(ids: string[]): Promise<Map<string, CargaActualRow>> {
  const map = new Map<string, CargaActualRow>();
  if (ids.length === 0) return map;
  const supabase = getSupabase();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK));
  const results = await Promise.all(
    chunks.map((c) =>
      supabase.from("vista_carga_actual").select("operacion_id, lineas").in("operacion_id", c),
    ),
  );
  for (const res of results) {
    if (res.error) throw new Error(res.error.message);
    for (const row of (res.data as unknown as CargaActualRow[]) ?? []) map.set(row.operacion_id, row);
  }
  return map;
}

// ── mapeos de presentación (vocabulario del Excel de Omar: TODO MAYÚSCULAS, tal cual
// su archivo — no reusa los labels de las badges de pantalla) ───────────────────────────

// Vocabulario EXACTO del archivo real de Omar (CONTROL DE VACIOS 2025-2026, verificado
// 2026-07-18 hoja por hoja): la columna 9 es una CATEGORIA, no un semaforo del sistema.
const ALERTA_LABEL: Record<Semaforo, string> = {
  rojo: "VENCIDO",
  amarillo: "PROXIMO A VENCER",
  verde: "VENCE > 5 DÍAS",
  neutro: "SIN TARIFA",
};

const REFORZADO_LABEL: Record<string, string> = {
  confirmado_reforzado: "REFORZADO",
  confirmado_no_reforzado: "NO REFORZADO",
  pendiente_validacion: "PENDIENTE",
  discrepancia: "DISCREPANCIA",
};

const LLENO_VACIO_LABEL: Record<string, string> = {
  lleno: "LLENO",
  vacio: "VACIO",
};

// ── aritmética de fecha PURA (sin Date local, sin timezone) sobre strings 'YYYY-MM-DD' ──
// mismo motivo que fmtFechaDia en lib/format.ts: parsear "YYYY-MM-DD" con `new Date(...)`
// local pisa el día en TZ negativos. Acá se opera solo con componentes UTC (nunca se
// compara contra "ahora" ni se cruza un huso horario real, así que Date.UTC es seguro).
function addDiasYMD(ymd: string, dias: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + dias * 86_400_000);
  const yy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// ── merge + derivación ──────────────────────────────────────────────────────────────────

type OmarRow = {
  contenedor: string;
  naviera: string;
  retiroDe: string;
  planta: string;
  tipo: string;
  reforzado: string;
  /** 'YYYY-MM-DD' — se convierte a celda de FECHA real al armar la hoja (como Omar). */
  fechaRetiroYmd: string;
  fechaVencimientoYmd: string | null;
  alerta: string;
  booking: string;
  estadiaDias: number | "";
  diasLibres: number | "";
  demoraDias: number | "";
  valorUnit: number | "";
  costoUsd: number | "";
  llenoVacio: string;
  producto: string;
  gmid: string;
  observaciones: string;
  // no van al Excel — solo para bucketizar en las 3 hojas de detalle:
  semaforo: Semaforo;
  estadoCarga: string;
};

function buildOmarRows(
  stock: StockAbiertoRow[],
  detalle: Map<string, DetalleRow>,
  carga: Map<string, CargaActualRow>,
): OmarRow[] {
  return stock.map((s) => {
    const d = detalle.get(s.operacion_id);
    const c = carga.get(s.operacion_id);

    const fechaRetiroYmd = fechaAR(s.fecha_retiro);
    // Fecha de vencimiento = fecha_retiro + (dias_libres − 1) días. Validado empíricamente
    // el 2026-07-14 contra crm.vista_alertas en vivo (proyecto cctuowthpnstvdgjuomq):
    //   TCNU2488857 — fecha_retiro=2026-07-01, dias_libres=14 → vencimiento=2026-07-14;
    //     hoy=2026-07-14 ⇒ vencimiento−hoy=0 == dias_restantes (0) ✓
    //   MRSU6960432 — fecha_retiro=2026-06-20, dias_libres=14 → vencimiento=2026-07-03;
    //     hoy=2026-07-14 ⇒ vencimiento−hoy=−11 == dias_restantes (−11) ✓
    // (8/8 filas de la muestra calzaron exacto). La convención vigente en freetime_origin es
    // 100% 'retiro_dia_1' (única fila distinct en prod a esa fecha) — si en el futuro entra
    // una convención distinta, esta derivación de presentación debe revisarse o moverse a la
    // view (033+), porque el −1 es específico de 'retiro_dia_1'.
    const fechaVencimientoYmd = s.dias_libres != null ? addDiasYMD(fechaRetiroYmd, s.dias_libres - 1) : null;

    // Demora = exceso sobre el freetime. dias_restantes YA es (dias_libres − dias_transcurridos)
    // calculado por la vista; acá solo se invierte el signo y se floorea en 0 — ninguna regla
    // de negocio nueva, es la misma resta que arma costo_bruto en la vista, expuesta como días.
    const demora = s.dias_restantes == null ? null : Math.max(0, -s.dias_restantes);

    const tipo = d?.contenedor?.tipo ?? "";
    const reforzadoEstado = d?.contenedor?.reforzado_estado ?? "";
    const estadoCarga = d?.estado_carga ?? "";

    // BOOKING DE RETIRO de Omar viene slasheado (retiro/asignado/roleos) — se replica el
    // patrón con lo que el sistema tiene: retiro + asignado cuando difieren.
    const bookings = [d?.booking_retiro, d?.booking_asignado]
      .filter((b): b is string => !!b)
      .filter((b, i, arr) => arr.indexOf(b) === i)
      .join("/");

    return {
      contenedor: s.numero_contenedor,
      naviera: s.naviera ?? "",
      // RETIRO DE en MAYÚSCULAS como el Excel de Omar (fidelidad total, John 2026-07-19):
      // texto crudo primero (los strings exactos de Omar en los datos cargados), catálogo
      // como fallback; toUpperCase cubre ops futuras creadas desde la app ("Terminal 4").
      retiroDe: (d?.retiro_de ?? d?.deposito?.nombre ?? "").toUpperCase(),
      planta: s.planta_actual ?? "",
      tipo,
      reforzado: REFORZADO_LABEL[reforzadoEstado] ?? reforzadoEstado,
      fechaRetiroYmd,
      fechaVencimientoYmd,
      alerta: ALERTA_LABEL[s.estado_semaforo],
      booking: bookings,
      estadiaDias: s.dias_estadia ?? "",
      diasLibres: s.dias_libres ?? "",
      demoraDias: demora ?? "",
      valorUnit: s.tarifa_usd_dia ?? "",
      costoUsd: s.costo_neto ?? "",
      llenoVacio: LLENO_VACIO_LABEL[estadoCarga] ?? estadoCarga,
      producto: c && c.lineas.length > 0 ? c.lineas.map((l) => l.descripcion).join(" / ") : "",
      gmid: c && c.lineas.length > 0 ? c.lineas.map((l) => l.gmid).join("/") : "",
      observaciones: d?.observaciones ?? "",
      semaforo: s.estado_semaforo,
      estadoCarga,
    };
  });
}

// Bucketing de las 4 hojas — condiciones EXACTAS del brief B7, expresadas contra
// estado_semaforo (ver comentario de cabecera del archivo sobre por qué no se recalcula
// el umbral acá).
function bucketize(rows: OmarRow[]) {
  return {
    general: rows,
    vencidos: rows.filter((r) => r.semaforo === "rojo"),
    proximos: rows.filter((r) => r.semaforo === "amarillo"),
    vacios: rows.filter((r) => r.semaforo === "verde" && r.estadoCarga === "vacio"),
  };
}

// ── armado del Excel (headers EXACTOS del brief B7 — Omar compara sin traducir) ─────────

// Headers EXACTOS del archivo REAL de Omar (CONTROL DE VACIOS DOW-SSB 2025-2026,
// verificado hoja por hoja el 2026-07-18) — incluidas SUS inconsistencias, porque la
// fidelidad es literal: espacios finales en "CONTENEDORES " / "RETIRO DE " /
// "DIAS LIBRES ", col 9 "VENCIDOS" en GENERAL/VENCIDOS pero "ALERTA DE DIAS A VENCER"
// en PROXIMOS/VACIOS, col 15 "COSTOS usd" salvo PROXIMOS que dice "COSTOS", y col 17
// "PRODUCT" solo en GENERAL. NO "corregir" nada de esto: Omar compara sin traducir.
function headersDe(hoja: "general" | "vencidos" | "proximos" | "vacios"): string[] {
  const col9 = hoja === "general" || hoja === "vencidos" ? "VENCIDOS" : "ALERTA DE DIAS A VENCER";
  const col15 = hoja === "proximos" ? "COSTOS" : "COSTOS usd";
  const col17 = hoja === "general" ? "PRODUCT" : "PRODUCTO";
  return [
    "CONTENEDORES ",
    "NAVIERA",
    "RETIRO DE ",
    "PLANTA",
    "TIPO",
    "REFORZADO",
    "FECHA DE RETIRO",
    "FECHA DE VENCIMIENTO",
    col9,
    "BOOKING DE RETIRO",
    "ESTADIA",
    "DIAS LIBRES ",
    "DEMORA",
    "VALOR UNIT",
    col15,
    "LLENOS",
    col17,
    "GMID",
    "OBSERVACIONES",
  ];
}

/** 'YYYY-MM-DD' → Date con componentes LOCALES — NO Date.UTC. El write path de SheetJS
 * (t:'d' con cellDates) interpreta el Date como hora LOCAL y le resta
 * getTimezoneOffset() al serializar: con componentes UTC, en TZ negativas (AR, donde
 * corre todo usuario real) TODAS las fechas del archivo quedaban un día atrás (P1 del
 * review 2026-07-18, verificado contra el XML crudo de xlsx 0.18.5). Con componentes
 * locales el archivo lleva la medianoche exacta del día pedido en cualquier TZ. */
function ymdADate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toExcelAoa(r: OmarRow): (string | number | Date)[] {
  return [
    r.contenedor,
    r.naviera,
    r.retiroDe,
    r.planta,
    r.tipo,
    r.reforzado,
    ymdADate(r.fechaRetiroYmd),
    r.fechaVencimientoYmd ? ymdADate(r.fechaVencimientoYmd) : "",
    r.alerta,
    r.booking,
    r.estadiaDias,
    r.diasLibres,
    r.demoraDias,
    r.valorUnit,
    r.costoUsd,
    r.llenoVacio,
    r.producto,
    r.gmid,
    r.observaciones,
  ];
}

export type OmarResult =
  | { kind: "empty" }
  | {
      kind: "ok";
      counts: { general: number; vencidos: number; proximos: number; vacios: number };
      capped: boolean;
    };

/**
 * Orquesta el fetch fresco (SIEMPRE el stock completo, nunca la tabla filtrada de arriba),
 * arma las 4 hojas y dispara la descarga. Tira si algo falla — el caller (page.tsx) lo
 * traduce a toast de error + estado de reintento. No genera archivo si no hay operaciones
 * abiertas (kind: "empty").
 */
export async function generarExcelOmar(): Promise<OmarResult> {
  const { rows: stock, capped } = await fetchStockAbierto();
  if (stock.length === 0) return { kind: "empty" };

  const ids = stock.map((s) => s.operacion_id);
  const [detalle, carga] = await Promise.all([fetchDetalleOperaciones(ids), fetchCargaActualOmar(ids)]);

  const rows = buildOmarRows(stock, detalle, carga);
  const { general, vencidos, proximos, vacios } = bucketize(rows);

  // dynamic import: SheetJS solo se descarga al generar (mismo patrón que handleExport).
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  // Nombres de hoja EXACTOS del archivo de Omar — incluido el espacio final de "GENERAL "
  const sheets: [string, "general" | "vencidos" | "proximos" | "vacios", OmarRow[]][] = [
    ["GENERAL ", "general", general],
    ["VENCIDOS", "vencidos", vencidos],
    ["PROXIMOS A VENCER", "proximos", proximos],
    ["VACIOS A VENCER > A 5 DÍAS", "vacios", vacios],
  ];
  for (const [nombre, clave, filas] of sheets) {
    // Layout de Omar: fila 1 = "FECHA ACTUAL" + fecha (celda de fecha), fila 2 = headers
    const aoa: (string | number | Date)[][] = [
      ["FECHA ACTUAL", ymdADate(hoyAR())],
      headersDe(clave),
      ...filas.map(toExcelAoa),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  }
  XLSX.writeFile(wb, `stock_contenedores_${hoyAR()}.xlsx`, { cellDates: true });

  return {
    kind: "ok",
    counts: { general: general.length, vencidos: vencidos.length, proximos: proximos.length, vacios: vacios.length },
    capped,
  };
}
