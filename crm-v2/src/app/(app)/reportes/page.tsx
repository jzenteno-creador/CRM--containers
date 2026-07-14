"use client";

// Reportes (M4 B4): sección de reporting con export a Excel (SheetJS).
//
// EL FRONT NO CALCULA. Esta pantalla es un READ + merge, cero aritmética de negocio:
// - Campos descriptivos (contenedor, naviera, planta, depósito, estado, tipo de cierre,
//   fechas, bookings, orden, shp) salen de `operaciones` + embeds de PostgREST.
// - Los TRES números del waiver (bruto/absorbido/neto) + días de estadía + días libres
//   + tarifa USD/día YA VIENEN CALCULADOS de las views: `vista_alertas` (operaciones
//   ABIERTAS) y `vista_kpi_costos_cerradas` (CERRADAS). Se traen por operacion_id y se
//   MERGEAN por clave contra la fila base. Copiar un número de una view no es un cálculo;
//   un join por id en el front tampoco. NUNCA se recalcula el costo acá.
// - Scope por rol: NO se re-filtra por rol en el front — la RLS de `operaciones` y de las
//   views ya scopea (el operador solo ve su planta). Ver comentario en load().

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { ComboboxCreatable, type ComboboxOption } from "@/components/fd/combobox-creatable";
import { ContainerNumber } from "@/components/container-number";
import { DataTable, type Column } from "@/components/fd/data-table";
import { Checkbox, DateField, Field, Select } from "@/components/fd/fields";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { PageHeader } from "@/components/fd/page-header";
import { useToast } from "@/components/fd/toast";
import {
  ESTADO_LABELS,
  TIPO_CIERRE_LABELS,
  fechaAR,
  fmtFecha,
  fmtFechaDia,
  fmtUSD,
  fmtUSDTarifa,
  hoyAR,
} from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { ESTADO_CARGA_LABELS, EstadoCargaBadge, EstadoOperacionBadge } from "../contenedores/estado-operacion";
import { generarExcelOmar, type OmarResult } from "./omar-export";

// ── contratos de datos ──────────────────────────────────────────────────────

// operaciones + embeds (READ). retiro_de es el snapshot de texto congelado (023);
// deposito es el nombre vivo vía FK retiro_de_id — se usa el vivo con fallback al snapshot.
type BaseRow = {
  id: string;
  estado: string;
  // informativo (M5-029, D3): lleno/vacío — NO afecta tarifa ni freetime.
  estado_carga: string;
  tipo_cierre: string;
  fecha_retiro: string;
  fecha_egreso_planta: string | null;
  fecha_devolucion: string | null;
  retiro_de: string | null;
  booking_retiro: string | null;
  booking_asignado: string | null;
  orden: string | null;
  shp: string | null;
  contenedor: { numero_contenedor: string; naviera: { nombre: string } | null } | null;
  planta_actual: { nombre: string } | null;
  deposito: { nombre: string } | null;
};

// Columnas de números YA CALCULADAS por las views (idénticas en ambas). Una operación
// aparece en EXACTAMENTE una view (abierta → vista_alertas · cerrada → vista_kpi), nunca
// en las dos: por eso el merge por operacion_id no colisiona.
type ViewNums = {
  operacion_id: string;
  costo_bruto: number | null;
  costo_absorbido: number | null;
  costo_neto: number | null;
  dias_estadia: number | null;
  dias_libres: number | null;
  tarifa_usd_dia: number | null;
  waiver_dias: number | null;
};

// Fila del reporte: base aplanada + números mergeados de la view.
type ReportRow = {
  operacion_id: string;
  numero_contenedor: string;
  naviera: string | null;
  planta: string | null;
  deposito: string | null;
  estado: string;
  estado_carga: string;
  /** "GMID (bolsas); GMID (bolsas)…" desde vista_carga_actual — null si no hay líneas vigentes. */
  productos_gmid: string | null;
  tipo_cierre: string;
  fecha_retiro: string;
  fecha_egreso_planta: string | null;
  fecha_devolucion: string | null;
  booking_retiro: string | null;
  booking_asignado: string | null;
  orden: string | null;
  shp: string | null;
  dias_estadia: number | null;
  dias_libres: number | null;
  tarifa_usd_dia: number | null;
  costo_bruto: number | null;
  costo_absorbido: number | null;
  costo_neto: number | null;
  waiver_dias: number | null;
};

type Catalogo = { id: string; nombre: string };

// contenedor embebido con !inner (todo op tiene contenedor → no descarta filas) para que
// el filtro por contenedor.naviera_id recorte las filas raíz, no solo el embed.
const SELECT_BASE =
  "id, estado, estado_carga, tipo_cierre, fecha_retiro, fecha_egreso_planta, fecha_devolucion, retiro_de, " +
  "booking_retiro, booking_asignado, orden, shp, " +
  "contenedor:contenedores!inner(numero_contenedor, naviera:navieras(nombre)), " +
  "planta_actual:plantas(nombre), deposito:depositos!retiro_de_id(nombre)";

const VIEW_NUM_COLS =
  "operacion_id, costo_bruto, costo_absorbido, costo_neto, dias_estadia, dias_libres, tarifa_usd_dia, waiver_dias";

// cap del fetch (patrón /contenedores, /alertas): si se toca, un badge lo avisa y se
// refina con los filtros. La paginación del preview es client-side (DataTable).
// omar-export.ts (B7) define su propio OMAR_FETCH_CAP con el mismo valor — no se importa
// desde acá para no crear un ciclo page.tsx ↔ omar-export.ts.
const FETCH_CAP = 1000;

// lotes para el .in() de operacion_id contra las views: acota el largo de la URL (GET).
const IN_CHUNK = 200;

// ── selector de columnas ────────────────────────────────────────────────────

type ColKey =
  | "contenedor" | "naviera" | "planta" | "deposito" | "estado" | "tipo_cierre"
  | "fecha_retiro" | "fecha_egreso_planta" | "fecha_devolucion"
  | "dias_estadia" | "dias_libres" | "tarifa_usd_dia"
  | "costo_bruto" | "costo_absorbido" | "costo_neto" | "waiver_dias"
  | "booking_retiro" | "booking_asignado" | "orden" | "shp"
  | "estado_carga" | "productos_gmid";

// `base` = descriptivo (tablas base) · `view` = número ya calculado por las views.
type ColGroup = "base" | "view";

type ColDef = {
  key: ColKey;
  /** header corto de la tabla de preview (la grilla lo pasa a mayúsculas). */
  th: string;
  /** encabezado completo de la columna en el Excel. */
  label: string;
  group: ColGroup;
  numeric?: boolean;
  hideOnMobile?: boolean;
  sortValue: (r: ReportRow) => string | number | null;
  preview: (r: ReportRow) => React.ReactNode;
  /** valor para el Excel: SIN aritmética — fechas formateadas, montos como número crudo. */
  excel: (r: ReportRow) => string | number;
};

const emDash = <span style={{ color: "var(--color-text-faint)" }}>—</span>;

function textCol(
  key: ColKey,
  th: string,
  label: string,
  get: (r: ReportRow) => string | null,
  opts?: { mono?: boolean; hideOnMobile?: boolean },
): ColDef {
  return {
    key, th, label, group: "base", hideOnMobile: opts?.hideOnMobile,
    sortValue: (r) => get(r),
    preview: (r) => {
      const v = get(r);
      if (!v) return emDash;
      return opts?.mono ? <span className="mono">{v}</span> : v;
    },
    excel: (r) => get(r) ?? "",
  };
}

// fecha: la columna es timestamptz → se pasa a día calendario AR (fechaAR) y se formatea
// DD/MM/YY con fmtFechaDia. El orden usa el ISO crudo (lexicográfico = cronológico).
function dateCol(key: ColKey, th: string, label: string, get: (r: ReportRow) => string | null): ColDef {
  return {
    key, th, label, group: "base", numeric: true, hideOnMobile: true,
    sortValue: (r) => get(r),
    preview: (r) => {
      const v = get(r);
      return v ? fmtFecha(v) : emDash;
    },
    excel: (r) => {
      const v = get(r);
      return v ? fmtFechaDia(fechaAR(v)) : "";
    },
  };
}

// monto: preview formateado (USD); Excel exporta el NÚMERO crudo (o "" si null) — el
// número ya viene calculado de la view, acá solo se copia.
function moneyCol(
  key: ColKey,
  th: string,
  label: string,
  get: (r: ReportRow) => number | null,
  opts?: { tarifa?: boolean; group?: ColGroup },
): ColDef {
  return {
    key, th, label, group: opts?.group ?? "view", numeric: true,
    sortValue: (r) => get(r),
    preview: (r) => {
      const v = get(r);
      if (v == null) return emDash;
      return <span className="fd-usd">{opts?.tarifa ? fmtUSDTarifa(v) : fmtUSD(v)}</span>;
    },
    excel: (r) => get(r) ?? "",
  };
}

function numCol(
  key: ColKey,
  th: string,
  label: string,
  get: (r: ReportRow) => number | null,
): ColDef {
  return {
    key, th, label, group: "view", numeric: true,
    sortValue: (r) => get(r),
    preview: (r) => {
      const v = get(r);
      return v == null ? emDash : v;
    },
    excel: (r) => get(r) ?? "",
  };
}

// Orden canónico del reporte (tabla + Excel). Descriptivas primero, números después,
// referencias (bookings/orden/shp) al final.
const COLS: ColDef[] = [
  {
    key: "contenedor", th: "contenedor", label: "Contenedor", group: "base",
    sortValue: (r) => r.numero_contenedor,
    preview: (r) => (r.numero_contenedor ? <ContainerNumber value={r.numero_contenedor} /> : emDash),
    excel: (r) => r.numero_contenedor ?? "",
  },
  textCol("naviera", "naviera", "Naviera", (r) => r.naviera, { hideOnMobile: true }),
  textCol("planta", "planta", "Planta", (r) => r.planta),
  textCol("deposito", "depósito", "Depósito", (r) => r.deposito, { hideOnMobile: true }),
  {
    key: "estado", th: "estado", label: "Estado", group: "base",
    sortValue: (r) => r.estado,
    preview: (r) => <EstadoOperacionBadge estado={r.estado} />,
    excel: (r) => ESTADO_LABELS[r.estado] ?? r.estado,
  },
  {
    key: "tipo_cierre", th: "tipo cierre", label: "Tipo de cierre", group: "base", hideOnMobile: true,
    sortValue: (r) => r.tipo_cierre,
    preview: (r) => TIPO_CIERRE_LABELS[r.tipo_cierre] ?? r.tipo_cierre,
    excel: (r) => TIPO_CIERRE_LABELS[r.tipo_cierre] ?? r.tipo_cierre,
  },
  {
    // M5-029, D3 informativo — deshabilitada por default (ver DEFAULT_HIDDEN) para no
    // ensanchar el reporte existente.
    key: "estado_carga", th: "carga", label: "Estado de carga", group: "base", hideOnMobile: true,
    sortValue: (r) => r.estado_carga,
    preview: (r) => <EstadoCargaBadge estadoCarga={r.estado_carga} />,
    excel: (r) => ESTADO_CARGA_LABELS[r.estado_carga] ?? r.estado_carga,
  },
  dateCol("fecha_retiro", "f. retiro", "Fecha de retiro", (r) => r.fecha_retiro),
  dateCol("fecha_egreso_planta", "f. egreso", "Fecha de egreso de planta", (r) => r.fecha_egreso_planta),
  dateCol("fecha_devolucion", "f. devol.", "Fecha de devolución", (r) => r.fecha_devolucion),
  numCol("dias_estadia", "estadía", "Días de estadía", (r) => r.dias_estadia),
  numCol("dias_libres", "días libres", "Días libres", (r) => r.dias_libres),
  moneyCol("tarifa_usd_dia", "tarifa/día", "Tarifa USD/día", (r) => r.tarifa_usd_dia, { tarifa: true }),
  moneyCol("costo_bruto", "bruto", "Costo bruto (USD)", (r) => r.costo_bruto),
  moneyCol("costo_absorbido", "absorbido", "Costo absorbido (USD)", (r) => r.costo_absorbido),
  moneyCol("costo_neto", "neto", "Costo neto (USD)", (r) => r.costo_neto),
  numCol("waiver_dias", "waiver", "Waiver (días)", (r) => r.waiver_dias),
  textCol("booking_retiro", "book. retiro", "Booking de retiro", (r) => r.booking_retiro, { mono: true, hideOnMobile: true }),
  textCol("booking_asignado", "book. asig.", "Booking asignado", (r) => r.booking_asignado, { mono: true, hideOnMobile: true }),
  textCol("orden", "orden", "Orden", (r) => r.orden, { mono: true, hideOnMobile: true }),
  textCol("shp", "shp", "SHP", (r) => r.shp, { mono: true, hideOnMobile: true }),
  // M5-029, D3 informativo — deshabilitada por default (ver DEFAULT_HIDDEN).
  textCol("productos_gmid", "productos (gmid)", "Productos (GMID)", (r) => r.productos_gmid, { hideOnMobile: true }),
];

// columnas nuevas de 029 que arrancan DESACTIVADAS (no ensanchar el reporte existente) —
// el usuario las tilda desde el selector si las necesita.
const DEFAULT_HIDDEN: ColKey[] = ["estado_carga", "productos_gmid"];

const ALL_KEYS = COLS.map((c) => c.key);

const ESTADO_FILTER: { value: string; label: string }[] = [
  { value: "", label: "Todos los estados" },
  { value: "en_transito_a_planta", label: ESTADO_LABELS.en_transito_a_planta },
  { value: "en_planta", label: ESTADO_LABELS.en_planta },
  { value: "en_transito_a_terminal", label: ESTADO_LABELS.en_transito_a_terminal },
  { value: "cerrado", label: ESTADO_LABELS.cerrado },
  { value: "anulada", label: ESTADO_LABELS.anulada },
];

const TIPO_CIERRE_FILTER: { value: string; label: string }[] = [
  { value: "", label: "Todos los cierres" },
  { value: "embarcado", label: TIPO_CIERRE_LABELS.embarcado },
  { value: "devuelto_vacio", label: TIPO_CIERRE_LABELS.devuelto_vacio },
  { value: "pendiente", label: TIPO_CIERRE_LABELS.pendiente },
];

// ── carga de números desde las views (chunked .in por largo de URL) ─────────
async function fetchViewNumbers(ids: string[]): Promise<Map<string, ViewNums>> {
  const map = new Map<string, ViewNums>();
  if (ids.length === 0) return map;
  const supabase = getSupabase();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK));
  const queries = chunks.flatMap((c) => [
    supabase.from("vista_alertas").select(VIEW_NUM_COLS).in("operacion_id", c),
    supabase.from("vista_kpi_costos_cerradas").select(VIEW_NUM_COLS).in("operacion_id", c),
  ]);
  const results = await Promise.all(queries);
  for (const res of results) {
    if (res.error || !res.data) continue; // tolerante: sin números para ese lote → "—"
    for (const row of res.data as unknown as ViewNums[]) map.set(row.operacion_id, row);
  }
  return map;
}

// Carga vigente por operación (M5-029, informativo D3) — MISMO patrón de chunked .in()
// que fetchViewNumbers de arriba: copia literal de crm.vista_carga_actual, cero cálculo.
// La view solo trae filas con al menos una línea vigente (vacío → sin fila, no error).
type CargaActualNums = {
  operacion_id: string;
  lineas: { gmid: string; descripcion: string; cantidad_bolsas: number; lote: string | null }[];
  total_bolsas: number;
};

async function fetchCargaActual(ids: string[]): Promise<Map<string, CargaActualNums>> {
  const map = new Map<string, CargaActualNums>();
  if (ids.length === 0) return map;
  const supabase = getSupabase();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK));
  const results = await Promise.all(
    chunks.map((c) => supabase.from("vista_carga_actual").select("operacion_id, lineas, total_bolsas").in("operacion_id", c)),
  );
  for (const res of results) {
    if (res.error || !res.data) continue; // tolerante: sin líneas para ese lote → "—"
    for (const row of res.data as unknown as CargaActualNums[]) map.set(row.operacion_id, row);
  }
  return map;
}

export default function ReportesPage() {
  const toast = useToast();

  // catálogos (una vez)
  const [navieras, setNavieras] = useState<Catalogo[]>([]);
  const [plantas, setPlantas] = useState<Catalogo[]>([]);
  const [depositos, setDepositos] = useState<Catalogo[]>([]);

  // filtros (disparan load)
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [navieraId, setNavieraId] = useState("");
  const [plantaId, setPlantaId] = useState("");
  const [depositoId, setDepositoId] = useState("");
  const [estado, setEstado] = useState("");
  const [tipoCierre, setTipoCierre] = useState("");

  // selección de columnas (solo afecta preview + export, NO dispara load) — las de 029
  // arrancan desactivadas (DEFAULT_HIDDEN) para no ensanchar el reporte existente.
  const [selected, setSelected] = useState<Set<ColKey>>(
    () => new Set(ALL_KEYS.filter((k) => !DEFAULT_HIDDEN.includes(k))),
  );

  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const reqIdRef = useRef(0);

  // B7 — Excel formato Omar: acción independiente del export configurable de arriba.
  // Fetch fresco propio (omar-export.ts), nunca reusa `rows` (que está filtrado).
  const [omarBusy, setOmarBusy] = useState(false);
  const [omarError, setOmarError] = useState<string | null>(null);
  const [omarResult, setOmarResult] = useState<OmarResult | null>(null);

  // catálogos para los combobox de filtro — tolerante (si falla, el combo queda solo con "Todas")
  useEffect(() => {
    void (async () => {
      const supabase = getSupabase();
      const [nav, pl, dep] = await Promise.all([
        supabase.from("navieras").select("id, nombre").order("nombre"),
        supabase.from("plantas").select("id, nombre").order("nombre"),
        supabase.from("depositos").select("id, nombre").eq("activo", true).order("nombre"),
      ]);
      if (!nav.error && nav.data) setNavieras(nav.data as Catalogo[]);
      if (!pl.error && pl.data) setPlantas(pl.data as Catalogo[]);
      if (!dep.error && dep.data) setDepositos(dep.data as Catalogo[]);
    })();
  }, []);

  const load = useCallback(async () => {
    const rid = ++reqIdRef.current;
    const supabase = getSupabase();

    // NO se re-filtra por rol acá: la RLS de operaciones ya scopea (operador = su planta),
    // y las views heredan ese scope. Estos son filtros de presentación del usuario.
    let q = supabase.from("operaciones").select(SELECT_BASE);
    if (desde) q = q.gte("fecha_retiro", `${desde}T00:00:00-03:00`); // límite del día AR
    if (hasta) q = q.lte("fecha_retiro", `${hasta}T23:59:59-03:00`); // fin del día AR (inclusive)
    if (navieraId) q = q.eq("contenedor.naviera_id", navieraId); // filtro sobre el embed !inner
    if (plantaId) q = q.eq("planta_actual_id", plantaId);
    if (depositoId) q = q.eq("retiro_de_id", depositoId);
    if (estado) q = q.eq("estado", estado);
    if (tipoCierre) q = q.eq("tipo_cierre", tipoCierre);

    const { data, error } = await q.order("fecha_retiro", { ascending: false }).limit(FETCH_CAP);

    if (rid !== reqIdRef.current) return; // llegó tarde: hay otro load en vuelo

    if (error) {
      setRows(null);
      setLoadError(error.message);
      return;
    }

    const base = (data as unknown as BaseRow[]) ?? [];
    // números YA CALCULADOS (views) + carga vigente (029) — ambos merge por operacion_id,
    // nunca recalculados; en paralelo, mismo patrón chunked .in() los dos.
    const [nums, cargas] = await Promise.all([
      fetchViewNumbers(base.map((b) => b.id)),
      fetchCargaActual(base.map((b) => b.id)),
    ]);
    if (rid !== reqIdRef.current) return;

    const merged: ReportRow[] = base.map((b) => {
      const n = nums.get(b.id);
      const carga = cargas.get(b.id);
      return {
        operacion_id: b.id,
        numero_contenedor: b.contenedor?.numero_contenedor ?? "",
        naviera: b.contenedor?.naviera?.nombre ?? null,
        planta: b.planta_actual?.nombre ?? null,
        deposito: b.deposito?.nombre ?? b.retiro_de ?? null, // vivo, fallback al snapshot
        estado: b.estado,
        estado_carga: b.estado_carga,
        productos_gmid:
          carga && carga.lineas.length > 0
            ? carga.lineas.map((l) => `${l.gmid} (${l.cantidad_bolsas})`).join("; ")
            : null,
        tipo_cierre: b.tipo_cierre,
        fecha_retiro: b.fecha_retiro,
        fecha_egreso_planta: b.fecha_egreso_planta,
        fecha_devolucion: b.fecha_devolucion,
        booking_retiro: b.booking_retiro,
        booking_asignado: b.booking_asignado,
        orden: b.orden,
        shp: b.shp,
        dias_estadia: n?.dias_estadia ?? null,
        dias_libres: n?.dias_libres ?? null,
        tarifa_usd_dia: n?.tarifa_usd_dia ?? null,
        costo_bruto: n?.costo_bruto ?? null,
        costo_absorbido: n?.costo_absorbido ?? null,
        costo_neto: n?.costo_neto ?? null,
        waiver_dias: n?.waiver_dias ?? null,
      };
    });

    setLoadError(null);
    setRows(merged);
  }, [desde, hasta, navieraId, plantaId, depositoId, estado, tipoCierre]);

  // load reactivo al cambiar cualquier filtro (mismo patrón que /contenedores, /alertas):
  // las filas previas quedan visibles hasta que resuelve el nuevo load (sin flash de skeleton).
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const loading = rows === null && !loadError;

  const navieraOptions = useMemo<ComboboxOption[]>(
    () => [{ id: "", label: "Todas las navieras" }, ...navieras.map((n) => ({ id: n.id, label: n.nombre }))],
    [navieras],
  );
  const plantaOptions = useMemo<ComboboxOption[]>(
    () => [{ id: "", label: "Todas las plantas" }, ...plantas.map((p) => ({ id: p.id, label: p.nombre }))],
    [plantas],
  );
  const depositoOptions = useMemo<ComboboxOption[]>(
    () => [{ id: "", label: "Todos los depósitos" }, ...depositos.map((d) => ({ id: d.id, label: d.nombre }))],
    [depositos],
  );

  const selectedCols = useMemo(() => COLS.filter((c) => selected.has(c.key)), [selected]);

  const previewColumns: Column<ReportRow>[] = selectedCols.map((c) => ({
    key: c.key,
    header: c.th,
    numeric: c.numeric,
    hideOnMobile: c.hideOnMobile,
    sortValue: c.sortValue,
    render: c.preview,
  }));

  const toggleCol = (key: ColKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filtrosActivos = Boolean(
    desde || hasta || navieraId || plantaId || depositoId || estado || tipoCierre,
  );

  const limpiarFiltros = () => {
    setDesde("");
    setHasta("");
    setNavieraId("");
    setPlantaId("");
    setDepositoId("");
    setEstado("");
    setTipoCierre("");
  };

  const handleExport = async () => {
    if (!rows || rows.length === 0 || selectedCols.length === 0 || exporting) return;
    setExporting(true);
    try {
      // dynamic import: SheetJS solo se descarga al exportar (fuera del bundle inicial)
      const XLSX = await import("xlsx");
      const header = selectedCols.map((c) => c.label);
      const data = rows.map((r) => {
        const o: Record<string, string | number> = {};
        for (const c of selectedCols) o[c.label] = c.excel(r);
        return o;
      });
      const ws = XLSX.utils.json_to_sheet(data, { header });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reporte");
      XLSX.writeFile(wb, `reporte_${hoyAR()}.xlsx`);
      toast({
        type: "exito",
        title: "Reporte exportado",
        detail: `${rows.length} fila${rows.length === 1 ? "" : "s"} · ${selectedCols.length} columna${selectedCols.length === 1 ? "" : "s"}.`,
      });
    } catch {
      toast({ type: "error", title: "No se pudo generar el Excel", detail: "Reintentá en un momento." });
    } finally {
      setExporting(false);
    }
  };

  // B7: doble-submit imposible (guard omarBusy) — mismo patrón que handleExport/exporting.
  const handleGenerarOmar = async () => {
    if (omarBusy) return;
    setOmarBusy(true);
    setOmarError(null);
    try {
      const res = await generarExcelOmar();
      if (res.kind === "empty") {
        setOmarResult(null);
        toast({
          type: "info",
          title: "No hay operaciones abiertas",
          detail: "El stock está en cero — no se generó ningún archivo.",
        });
        return;
      }
      setOmarResult(res);
      const { general, vencidos, proximos, vacios } = res.counts;
      toast({
        type: "exito",
        title: "Excel de Omar generado",
        detail: `General: ${general} · Vencidos: ${vencidos} · Próx. a vencer: ${proximos} · Vacíos a vencer: ${vacios}${
          res.capped ? ` · se tomaron las primeras ${FETCH_CAP} operaciones` : ""
        }.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido.";
      setOmarError(msg);
      toast({ type: "error", title: "No se pudo generar el Excel de Omar", detail: msg });
    } finally {
      setOmarBusy(false);
    }
  };

  const baseCols = COLS.filter((c) => c.group === "base");
  const viewCols = COLS.filter((c) => c.group === "view");

  return (
    <>
      <PageHeader
        title="Reportes"
        counters={
          rows != null ? (
            <>
              <Badge tone="neutro" mono icon="ti-report-analytics">
                {rows.length} fila{rows.length === 1 ? "" : "s"}
              </Badge>
              {rows.length >= FETCH_CAP && (
                <Badge tone="amarillo" icon="ti-alert-triangle">
                  se exportan las primeras {FETCH_CAP} — refiná con los filtros
                </Badge>
              )}
            </>
          ) : undefined
        }
        action={
          <Button
            variant="primary"
            icon="ti-file-spreadsheet"
            onClick={() => void handleExport()}
            loading={exporting}
            disabled={!rows || rows.length === 0 || selectedCols.length === 0}
          >
            Exportar a Excel
          </Button>
        }
      />

      {/* ── B7: Excel formato Omar — acción fija, independiente de los filtros de abajo ── */}
      <div className="fd-panel" style={{ marginBottom: 16 }}>
        <div className="fd-panel-title">
          <i className="ti ti-table" aria-hidden style={{ fontSize: 15 }} /> Reporte de stock (formato Omar)
        </div>
        <div className="fd-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.55, maxWidth: 640 }}>
            Réplica exacta del Excel semanal de control de stock que arma Omar a mano los martes y jueves. Genera un
            archivo con 4 hojas (General, Vencidos, Próximos a vencer, Vacíos a vencer) con TODO el stock de
            operaciones abiertas del sistema — no usa los filtros de abajo, siempre trae el total.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Button
              variant="ghost"
              icon="ti-table"
              loading={omarBusy}
              disabled={omarBusy}
              onClick={() => void handleGenerarOmar()}
            >
              Excel formato Omar
            </Button>
            {omarResult && omarResult.kind === "ok" && (
              <>
                <Badge tone="neutro" mono icon="ti-list-details">
                  General {omarResult.counts.general}
                </Badge>
                <Badge tone="rojo" mono icon="ti-alert-triangle">
                  Vencidos {omarResult.counts.vencidos}
                </Badge>
                <Badge tone="amarillo" mono icon="ti-clock">
                  Próx. a vencer {omarResult.counts.proximos}
                </Badge>
                <Badge tone="verde" mono icon="ti-box-off">
                  Vacíos a vencer {omarResult.counts.vacios}
                </Badge>
                {omarResult.capped && (
                  <Badge tone="amarillo" icon="ti-alert-triangle">
                    se tomaron las primeras {FETCH_CAP} operaciones — hay más stock abierto del que entra en el cap
                  </Badge>
                )}
              </>
            )}
          </div>
          {omarError && (
            <ErrorState
              title="No se pudo generar el Excel de Omar"
              detail={omarError}
              onRetry={() => void handleGenerarOmar()}
            />
          )}
          {!omarResult && !omarError && !omarBusy && (
            <EmptyState icon="ti-table-off" title="Todavía no generaste este Excel">
              Al hacer clic se arma el archivo con el stock completo de operaciones abiertas, en el mismo formato que
              el Excel manual de Omar. Se genera bajo demanda — el envío automático queda para una próxima iteración.
            </EmptyState>
          )}
        </div>
      </div>

      {/* ── filtros ── */}
      <div className="fd-panel">
        <div className="fd-panel-title">
          <i className="ti ti-filter" aria-hidden style={{ fontSize: 15 }} /> Filtros
          {filtrosActivos && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="hover:[color:var(--color-text-primary)!important]"
              style={{
                marginLeft: "auto", minHeight: 0, padding: "2px 8px", fontSize: 11.5,
                border: "none", background: "transparent", color: "var(--color-text-muted)",
                textDecoration: "underline",
              }}
            >
              limpiar filtros
            </button>
          )}
        </div>
        <div
          className="fd-panel-body"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}
        >
          <Field label="retiro desde" htmlFor="rep-desde">
            <DateField id="rep-desde" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
          </Field>
          <Field label="retiro hasta" htmlFor="rep-hasta">
            <DateField id="rep-hasta" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
          </Field>
          <Field label="naviera" htmlFor="rep-naviera">
            <ComboboxCreatable
              id="rep-naviera"
              options={navieraOptions}
              value={navieraId}
              onChange={setNavieraId}
              placeholder="Todas las navieras"
            />
          </Field>
          <Field label="planta" htmlFor="rep-planta">
            <ComboboxCreatable
              id="rep-planta"
              options={plantaOptions}
              value={plantaId}
              onChange={setPlantaId}
              placeholder="Todas las plantas"
            />
          </Field>
          <Field label="depósito" htmlFor="rep-deposito">
            <ComboboxCreatable
              id="rep-deposito"
              options={depositoOptions}
              value={depositoId}
              onChange={setDepositoId}
              placeholder="Todos los depósitos"
            />
          </Field>
          <Field label="estado" htmlFor="rep-estado">
            <Select id="rep-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
              {ESTADO_FILTER.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="tipo de cierre" htmlFor="rep-cierre">
            <Select id="rep-cierre" value={tipoCierre} onChange={(e) => setTipoCierre(e.target.value)}>
              {TIPO_CIERRE_FILTER.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      {/* ── selector de columnas ── */}
      <div className="fd-panel">
        <div className="fd-panel-title">
          <i className="ti ti-columns" aria-hidden style={{ fontSize: 15 }} /> Columnas a exportar
          <span className="fd-count">{selectedCols.length}/{COLS.length}</span>
        </div>
        <div className="fd-panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" icon="ti-checks" onClick={() => setSelected(new Set(ALL_KEYS))} style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}>
              Todas
            </Button>
            <Button variant="ghost" icon="ti-square-off" onClick={() => setSelected(new Set())} style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}>
              Ninguna
            </Button>
          </div>

          <ColumnGroup title="Descriptivas — de las tablas base" cols={baseCols} selected={selected} onToggle={toggleCol} />
          <ColumnGroup
            title="Costos y días — ya calculados por las views"
            cols={viewCols}
            selected={selected}
            onToggle={toggleCol}
          />
        </div>
      </div>

      {/* ── preview + export ── */}
      <div style={{ marginTop: 16 }}>
        {selectedCols.length === 0 ? (
          <div className="fd-panel">
            <EmptyState icon="ti-columns-off" title="No hay columnas seleccionadas">
              Tildá al menos una columna arriba para ver el preview y habilitar la exportación a Excel.
            </EmptyState>
          </div>
        ) : (
          <DataTable
            columns={previewColumns}
            rows={rows ?? []}
            rowKey={(r) => r.operacion_id}
            loading={loading}
            skeletonRows={8}
            pageSize={15}
            maxHeight={560}
            defaultSort={{ key: "fecha_retiro", dir: "desc" }}
            errorState={
              loadError ? (
                <ErrorState title="No se pudo generar el reporte" detail={loadError} onRetry={() => void load()} />
              ) : undefined
            }
            emptyState={
              <EmptyState icon="ti-report-search" title="Sin resultados para estos filtros">
                Ajustá el rango de fechas o los filtros de naviera, planta, depósito, estado y tipo de cierre. El reporte
                combina los datos de cada operación con sus costos de detention (bruto, absorbido y neto), tal como los
                calcula el sistema — acá solo se muestran y se exportan.
              </EmptyState>
            }
          />
        )}
      </div>
    </>
  );
}

// Grupo de checkboxes del selector de columnas.
function ColumnGroup({
  title,
  cols,
  selected,
  onToggle,
}: {
  title: string;
  cols: ColDef[];
  selected: Set<ColKey>;
  onToggle: (key: ColKey) => void;
}) {
  return (
    <div>
      <div className="fd-label" style={{ marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px 14px" }}>
        {cols.map((c) => (
          <Checkbox
            key={c.key}
            id={`col-${c.key}`}
            checked={selected.has(c.key)}
            onChange={() => onToggle(c.key)}
            label={c.label}
          />
        ))}
      </div>
    </div>
  );
}
