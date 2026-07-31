"use client";

// Reportes · Importación (P1-F, auditoría 2026-07-31): dataset de IMPORTACIÓN para el
// módulo de Reportes, espejo mínimo del dataset EXPO de reportes/page.tsx — mismo patrón
// de merge (base descriptivo de `operaciones_impo` + números YA CALCULADOS de las views
// `vista_alertas_impo` [abiertas] y `vista_kpi_costos_cerradas_impo` [cerradas], merge por
// operacion_impo_id — una operación aparece en EXACTAMENTE una view, nunca en las dos,
// mismo invariante documentado en page.tsx para EXPO). EL FRONT NO CALCULA acá tampoco:
// `costo` es costo_proyectado (abierta) o costo_realizado (cerrada), copiado literal según
// cuál view trajo la fila — nunca las dos sumadas, nunca recalculado.
//
// Extraído a archivo propio (en vez de vivir inline en page.tsx) porque el dataset EXPO ya
// tiene ~850 líneas de columnas/filtros/export — mismo criterio que omar-export.ts, que ya
// define sus propias constantes (OMAR_FETCH_CAP) para no crear un ciclo con page.tsx.
// Self-contained: catálogo de navieras, filtros, selector de columnas y export a Excel
// propios. La única acción PRIMARIA de la pantalla (PageHeader, §14 del design system)
// sigue siendo la de EXPO — esta sección expone su propio botón de export en una cabecera
// local, no dentro de <PageHeader> (que solo admite una acción por pantalla).
//
// Numeric-como-string de PostgREST (contrato documentado en inicio/page.tsx): tarifa,
// exceso y costo pueden llegar como string — se normalizan acá con toNumOrNull() antes de
// entrar al ReportRowImpo, nunca se usan crudos.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { ComboboxCreatable, type ComboboxOption } from "@/components/fd/combobox-creatable";
import { ContainerNumber } from "@/components/container-number";
import { DataTable, type Column } from "@/components/fd/data-table";
import { Checkbox, DateField, Field } from "@/components/fd/fields";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { useToast } from "@/components/fd/toast";
import { ESTADO_IMPO_LABELS, fechaAR, fmtFecha, fmtFechaDia, fmtUSD, fmtUSDTarifa, hoyAR } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { EstadoImpoBadge } from "../importacion/estado-impo";

// ── contratos de datos ──────────────────────────────────────────────────────

// operaciones_impo + embeds (READ). orden!inner: toda operación impo tiene orden → no
// descarta filas, necesario para que el filtro por orden.naviera_id/fecha_arribo_terminal
// recorte las filas raíz (mismo criterio que contenedor:contenedores!inner en EXPO).
type BaseRowImpo = {
  id: string;
  estado: string;
  fecha_retiro_terminal: string | null;
  fecha_devolucion: string | null;
  orden: {
    numero_orden: string;
    fecha_arribo_terminal: string;
    naviera: { nombre: string } | null;
    planta_destino: { nombre: string } | null;
  } | null;
  contenedor: { numero_contenedor: string } | null;
};

// numeric-como-string posible (PostgREST) — se normaliza en normalizeViewNumsImpo().
type RawNum = string | number | null;

// Campos comunes a las dos views del motor destino (bloque G, migración 032). El costo
// difiere de nombre según el origen (costo_proyectado / costo_realizado) — se resuelve
// aparte y se guarda ya unificado en ViewNumsImpo.costo.
type ViewNumsImpoRawBase = {
  operacion_impo_id: string;
  modo_reloj: string | null;
  dias_demurrage_transcurridos: RawNum;
  dias_detention_transcurridos: RawNum;
  dias_combined_transcurridos: RawNum;
  dias_libres_demurrage: RawNum;
  dias_libres_detention: RawNum;
  dias_libres_combined: RawNum;
  tarifa_dry_usd_dia: RawNum;
  exceso_total: RawNum;
};
type AbiertaNumsImpoRaw = ViewNumsImpoRawBase & { costo_proyectado: RawNum };
type CerradaNumsImpoRaw = ViewNumsImpoRawBase & { costo_realizado: RawNum };

// Números YA CALCULADOS, normalizados (post Number()).
type ViewNumsImpo = {
  operacion_impo_id: string;
  modo_reloj: string | null;
  dias_demurrage_transcurridos: number | null;
  dias_detention_transcurridos: number | null;
  dias_combined_transcurridos: number | null;
  dias_libres_demurrage: number | null;
  dias_libres_detention: number | null;
  dias_libres_combined: number | null;
  tarifa_dry_usd_dia: number | null;
  exceso_total: number | null;
  costo: number | null;
};

// Fila del reporte: base aplanada + números mergeados de la view.
type ReportRowImpo = {
  operacion_impo_id: string;
  numero_orden: string;
  numero_contenedor: string;
  naviera: string | null;
  planta: string | null;
  estado: string;
  fecha_arribo_terminal: string;
  fecha_retiro_terminal: string | null;
  fecha_devolucion: string | null;
  modo_reloj: string | null;
  dias_demurrage_transcurridos: number | null;
  dias_detention_transcurridos: number | null;
  dias_combined_transcurridos: number | null;
  dias_libres_demurrage: number | null;
  dias_libres_detention: number | null;
  dias_libres_combined: number | null;
  tarifa_dry_usd_dia: number | null;
  exceso_total: number | null;
  costo: number | null;
};

type Catalogo = { id: string; nombre: string };

const SELECT_BASE_IMPO =
  "id, estado, fecha_retiro_terminal, fecha_devolucion, " +
  "orden:ordenes_impo!inner(numero_orden, fecha_arribo_terminal, naviera:navieras(nombre), planta_destino:plantas(nombre)), " +
  "contenedor:contenedores(numero_contenedor)";

const VIEW_NUM_COLS_ABIERTAS_IMPO =
  "operacion_impo_id, modo_reloj, dias_demurrage_transcurridos, dias_detention_transcurridos, " +
  "dias_combined_transcurridos, dias_libres_demurrage, dias_libres_detention, dias_libres_combined, " +
  "tarifa_dry_usd_dia, exceso_total, costo_proyectado";

const VIEW_NUM_COLS_CERRADAS_IMPO =
  "operacion_impo_id, modo_reloj, dias_demurrage_transcurridos, dias_detention_transcurridos, " +
  "dias_combined_transcurridos, dias_libres_demurrage, dias_libres_detention, dias_libres_combined, " +
  "tarifa_dry_usd_dia, exceso_total, costo_realizado";

// cap del fetch — mismo valor que FETCH_CAP de page.tsx (no se importa para no crear un
// ciclo page.tsx ↔ impo-section.tsx, mismo criterio ya documentado en omar-export.ts).
const IMPO_FETCH_CAP = 1000;

// lotes para el .in() de operacion_impo_id contra las views (acota el largo de la URL).
const IMPO_IN_CHUNK = 200;

const toNumOrNull = (v: RawNum): number | null => (v == null ? null : Number(v));

function normalizeViewNumsImpo(row: ViewNumsImpoRawBase, costo: RawNum): ViewNumsImpo {
  return {
    operacion_impo_id: row.operacion_impo_id,
    modo_reloj: row.modo_reloj,
    dias_demurrage_transcurridos: toNumOrNull(row.dias_demurrage_transcurridos),
    dias_detention_transcurridos: toNumOrNull(row.dias_detention_transcurridos),
    dias_combined_transcurridos: toNumOrNull(row.dias_combined_transcurridos),
    dias_libres_demurrage: toNumOrNull(row.dias_libres_demurrage),
    dias_libres_detention: toNumOrNull(row.dias_libres_detention),
    dias_libres_combined: toNumOrNull(row.dias_libres_combined),
    tarifa_dry_usd_dia: toNumOrNull(row.tarifa_dry_usd_dia),
    exceso_total: toNumOrNull(row.exceso_total),
    costo: toNumOrNull(costo),
  };
}

// ── selector de columnas ────────────────────────────────────────────────────

type ColKeyImpo =
  | "numero_orden" | "numero_contenedor" | "naviera" | "planta" | "estado"
  | "fecha_arribo_terminal" | "fecha_retiro_terminal" | "fecha_devolucion"
  | "modo_reloj" | "dias_libres_combined" | "dias_libres_demurrage" | "dias_libres_detention"
  | "dias_combined_transcurridos" | "dias_demurrage_transcurridos" | "dias_detention_transcurridos"
  | "tarifa_dry_usd_dia" | "exceso_total" | "costo";

type ColDefImpo = {
  key: ColKeyImpo;
  /** header corto de la tabla de preview (la grilla lo pasa a mayúsculas). */
  th: string;
  /** encabezado completo de la columna en el Excel. */
  label: string;
  numeric?: boolean;
  hideOnMobile?: boolean;
  sortValue: (r: ReportRowImpo) => string | number | null;
  preview: (r: ReportRowImpo) => React.ReactNode;
  /** valor para el Excel: SIN aritmética — fechas formateadas como texto plano (mismo
   *  patrón EXISTENTE de dateCol() en page.tsx), montos como número crudo. */
  excel: (r: ReportRowImpo) => string | number;
};

const emDash = <span style={{ color: "var(--color-text-faint)" }}>—</span>;

function textColImpo(
  key: ColKeyImpo,
  th: string,
  label: string,
  get: (r: ReportRowImpo) => string | null,
  opts?: { hideOnMobile?: boolean },
): ColDefImpo {
  return {
    key, th, label, hideOnMobile: opts?.hideOnMobile,
    sortValue: (r) => get(r),
    preview: (r) => get(r) ?? emDash,
    excel: (r) => get(r) ?? "",
  };
}

function dateColImpo(
  key: ColKeyImpo,
  th: string,
  label: string,
  get: (r: ReportRowImpo) => string | null,
): ColDefImpo {
  return {
    key, th, label, numeric: true, hideOnMobile: true,
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

function moneyColImpo(
  key: ColKeyImpo,
  th: string,
  label: string,
  get: (r: ReportRowImpo) => number | null,
  opts?: { tarifa?: boolean },
): ColDefImpo {
  return {
    key, th, label, numeric: true,
    sortValue: (r) => get(r),
    preview: (r) => {
      const v = get(r);
      if (v == null) return emDash;
      return <span className="fd-usd">{opts?.tarifa ? fmtUSDTarifa(v) : fmtUSD(v)}</span>;
    },
    excel: (r) => get(r) ?? "",
  };
}

function numColImpo(
  key: ColKeyImpo,
  th: string,
  label: string,
  get: (r: ReportRowImpo) => number | null,
): ColDefImpo {
  return {
    key, th, label, numeric: true,
    sortValue: (r) => get(r),
    preview: (r) => {
      const v = get(r);
      return v == null ? emDash : v;
    },
    excel: (r) => get(r) ?? "",
  };
}

// Orden canónico: descriptivas primero, granulares de reloj (split) después (ocultas por
// default), costo/exceso/tarifa al final visibles.
const COLS_IMPO: ColDefImpo[] = [
  textColImpo("numero_orden", "orden", "Orden", (r) => r.numero_orden),
  {
    key: "numero_contenedor", th: "contenedor", label: "Contenedor",
    sortValue: (r) => r.numero_contenedor,
    preview: (r) => (r.numero_contenedor ? <ContainerNumber value={r.numero_contenedor} /> : emDash),
    excel: (r) => r.numero_contenedor ?? "",
  },
  textColImpo("naviera", "naviera", "Naviera", (r) => r.naviera, { hideOnMobile: true }),
  textColImpo("planta", "planta", "Planta", (r) => r.planta),
  {
    key: "estado", th: "estado", label: "Estado",
    sortValue: (r) => r.estado,
    preview: (r) => <EstadoImpoBadge estado={r.estado} />,
    excel: (r) => ESTADO_IMPO_LABELS[r.estado] ?? r.estado,
  },
  dateColImpo("fecha_arribo_terminal", "f. arribo", "Fecha de arribo a terminal", (r) => r.fecha_arribo_terminal),
  dateColImpo("fecha_retiro_terminal", "f. retiro term.", "Fecha de retiro de terminal", (r) => r.fecha_retiro_terminal),
  dateColImpo("fecha_devolucion", "f. devol.", "Fecha de devolución", (r) => r.fecha_devolucion),
  textColImpo("modo_reloj", "reloj", "Modo de reloj", (r) => r.modo_reloj, { hideOnMobile: true }),
  numColImpo("dias_libres_combined", "d. libres (comb.)", "Días libres (combinado)", (r) => r.dias_libres_combined),
  numColImpo("dias_libres_demurrage", "d. libres (demur.)", "Días libres (demurrage)", (r) => r.dias_libres_demurrage),
  numColImpo("dias_libres_detention", "d. libres (deten.)", "Días libres (detention)", (r) => r.dias_libres_detention),
  numColImpo(
    "dias_combined_transcurridos",
    "d. transc. (comb.)",
    "Días transcurridos (combinado)",
    (r) => r.dias_combined_transcurridos,
  ),
  numColImpo(
    "dias_demurrage_transcurridos",
    "d. transc. (demur.)",
    "Días transcurridos (demurrage)",
    (r) => r.dias_demurrage_transcurridos,
  ),
  numColImpo(
    "dias_detention_transcurridos",
    "d. transc. (deten.)",
    "Días transcurridos (detention)",
    (r) => r.dias_detention_transcurridos,
  ),
  moneyColImpo("tarifa_dry_usd_dia", "tarifa/día", "Tarifa USD/día", (r) => r.tarifa_dry_usd_dia, { tarifa: true }),
  numColImpo("exceso_total", "exceso", "Exceso total (días)", (r) => r.exceso_total),
  moneyColImpo("costo", "costo", "Costo de detention/demurrage (USD)", (r) => r.costo),
];

// columnas granulares del reloj split que arrancan DESACTIVADAS (no ensanchar el reporte
// por default) — mismo criterio que DEFAULT_HIDDEN de page.tsx (EXPO).
const DEFAULT_HIDDEN_IMPO: ColKeyImpo[] = [
  "modo_reloj",
  "dias_libres_combined", "dias_libres_demurrage", "dias_libres_detention",
  "dias_combined_transcurridos", "dias_demurrage_transcurridos", "dias_detention_transcurridos",
];

const ALL_KEYS_IMPO = COLS_IMPO.map((c) => c.key);

// ── carga de números desde las views (chunked .in por largo de URL) ────────
async function fetchViewNumbersImpo(ids: string[]): Promise<Map<string, ViewNumsImpo>> {
  const map = new Map<string, ViewNumsImpo>();
  if (ids.length === 0) return map;
  const supabase = getSupabase();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IMPO_IN_CHUNK) chunks.push(ids.slice(i, i + IMPO_IN_CHUNK));

  const [abiertasResults, cerradasResults] = await Promise.all([
    Promise.all(
      chunks.map((c) =>
        supabase.from("vista_alertas_impo").select(VIEW_NUM_COLS_ABIERTAS_IMPO).in("operacion_impo_id", c),
      ),
    ),
    Promise.all(
      chunks.map((c) =>
        supabase
          .from("vista_kpi_costos_cerradas_impo")
          .select(VIEW_NUM_COLS_CERRADAS_IMPO)
          .in("operacion_impo_id", c),
      ),
    ),
  ]);

  for (const res of abiertasResults) {
    if (res.error || !res.data) continue; // tolerante: sin números para ese lote → "—"
    for (const row of res.data as unknown as AbiertaNumsImpoRaw[]) {
      map.set(row.operacion_impo_id, normalizeViewNumsImpo(row, row.costo_proyectado));
    }
  }
  // Una operación aparece en EXACTAMENTE una view (abierta → vista_alertas_impo · cerrada →
  // vista_kpi_costos_cerradas_impo), nunca en las dos — el segundo set() nunca pisa una
  // fila que ya puso el primero (mismo invariante que EXPO, ver comentario en page.tsx).
  for (const res of cerradasResults) {
    if (res.error || !res.data) continue;
    for (const row of res.data as unknown as CerradaNumsImpoRaw[]) {
      map.set(row.operacion_impo_id, normalizeViewNumsImpo(row, row.costo_realizado));
    }
  }
  return map;
}

// ── componente ───────────────────────────────────────────────────────────

export function ImpoSection() {
  const toast = useToast();

  const [navieras, setNavieras] = useState<Catalogo[]>([]);

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [navieraId, setNavieraId] = useState("");

  const [selected, setSelected] = useState<Set<ColKeyImpo>>(
    () => new Set(ALL_KEYS_IMPO.filter((k) => !DEFAULT_HIDDEN_IMPO.includes(k))),
  );

  const [rows, setRows] = useState<ReportRowImpo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const reqIdRef = useRef(0);

  // catálogo de navieras para el combobox de filtro — tolerante (si falla, el combo queda
  // solo con "Todas").
  useEffect(() => {
    void (async () => {
      const { data, error } = await getSupabase().from("navieras").select("id, nombre").order("nombre");
      if (!error && data) setNavieras(data as Catalogo[]);
    })();
  }, []);

  const load = useCallback(async () => {
    const rid = ++reqIdRef.current;
    const supabase = getSupabase();

    // NO se re-filtra por rol acá: la RLS de operaciones_impo ya scopea (mismo criterio
    // que EXPO en page.tsx). Filtros mínimos: rango de arribo (única fecha SIEMPRE presente,
    // abierta o cerrada — equivalente a fecha_retiro en EXPO) + naviera.
    let q = supabase.from("operaciones_impo").select(SELECT_BASE_IMPO);
    if (desde) q = q.gte("orden.fecha_arribo_terminal", `${desde}T00:00:00-03:00`);
    if (hasta) q = q.lte("orden.fecha_arribo_terminal", `${hasta}T23:59:59-03:00`);
    if (navieraId) q = q.eq("orden.naviera_id", navieraId);

    const { data, error } = await q.order("created_at", { ascending: false }).limit(IMPO_FETCH_CAP);

    if (rid !== reqIdRef.current) return; // llegó tarde: hay otro load en vuelo

    if (error) {
      setRows(null);
      setLoadError(error.message);
      return;
    }

    const base = (data as unknown as BaseRowImpo[]) ?? [];
    const nums = await fetchViewNumbersImpo(base.map((b) => b.id));
    if (rid !== reqIdRef.current) return;

    const merged: ReportRowImpo[] = base.map((b) => {
      const n = nums.get(b.id);
      return {
        operacion_impo_id: b.id,
        numero_orden: b.orden?.numero_orden ?? "",
        numero_contenedor: b.contenedor?.numero_contenedor ?? "",
        naviera: b.orden?.naviera?.nombre ?? null,
        planta: b.orden?.planta_destino?.nombre ?? null,
        estado: b.estado,
        fecha_arribo_terminal: b.orden?.fecha_arribo_terminal ?? "",
        fecha_retiro_terminal: b.fecha_retiro_terminal,
        fecha_devolucion: b.fecha_devolucion,
        modo_reloj: n?.modo_reloj ?? null,
        dias_demurrage_transcurridos: n?.dias_demurrage_transcurridos ?? null,
        dias_detention_transcurridos: n?.dias_detention_transcurridos ?? null,
        dias_combined_transcurridos: n?.dias_combined_transcurridos ?? null,
        dias_libres_demurrage: n?.dias_libres_demurrage ?? null,
        dias_libres_detention: n?.dias_libres_detention ?? null,
        dias_libres_combined: n?.dias_libres_combined ?? null,
        tarifa_dry_usd_dia: n?.tarifa_dry_usd_dia ?? null,
        exceso_total: n?.exceso_total ?? null,
        costo: n?.costo ?? null,
      };
    });

    setLoadError(null);
    setRows(merged);
  }, [desde, hasta, navieraId]);

  // load reactivo al cambiar cualquier filtro (mismo patrón que page.tsx/EXPO).
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

  const selectedCols = useMemo(() => COLS_IMPO.filter((c) => selected.has(c.key)), [selected]);

  const previewColumns: Column<ReportRowImpo>[] = selectedCols.map((c) => ({
    key: c.key,
    header: c.th,
    numeric: c.numeric,
    hideOnMobile: c.hideOnMobile,
    sortValue: c.sortValue,
    render: c.preview,
  }));

  const toggleCol = (key: ColKeyImpo) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filtrosActivos = Boolean(desde || hasta || navieraId);

  const limpiarFiltros = () => {
    setDesde("");
    setHasta("");
    setNavieraId("");
  };

  const handleExport = async () => {
    if (!rows || rows.length === 0 || selectedCols.length === 0 || exporting) return;
    setExporting(true);
    try {
      // dynamic import: SheetJS solo se descarga al exportar (mismo patrón que EXPO).
      const XLSX = await import("xlsx");
      const header = selectedCols.map((c) => c.label);
      const data = rows.map((r) => {
        const o: Record<string, string | number> = {};
        for (const c of selectedCols) o[c.label] = c.excel(r);
        return o;
      });
      const ws = XLSX.utils.json_to_sheet(data, { header });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Importación");
      XLSX.writeFile(wb, `reporte_importacion_${hoyAR()}.xlsx`);
      toast({
        type: "exito",
        title: "Reporte de importación exportado",
        detail: `${rows.length} fila${rows.length === 1 ? "" : "s"} · ${selectedCols.length} columna${selectedCols.length === 1 ? "" : "s"}.`,
      });
    } catch {
      toast({ type: "error", title: "No se pudo generar el Excel", detail: "Reintentá en un momento." });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      {/* ── acción local de esta sección: la PRIMARIA de la pantalla (§14 design system,
          "UNA acción por pantalla") sigue siendo la de EXPO en <PageHeader> — acá solo se
          cuenta y se exporta el dataset de importación ── */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        {rows != null && (
          <>
            <Badge tone="neutro" mono icon="ti-ship">
              {rows.length} fila{rows.length === 1 ? "" : "s"}
            </Badge>
            {rows.length >= IMPO_FETCH_CAP && (
              <Badge tone="amarillo" icon="ti-alert-triangle">
                se exportan las primeras {IMPO_FETCH_CAP} — refiná con los filtros
              </Badge>
            )}
          </>
        )}
        <div style={{ marginLeft: "auto" }}>
          <Button
            variant="primary"
            icon="ti-file-spreadsheet"
            onClick={() => void handleExport()}
            loading={exporting}
            disabled={!rows || rows.length === 0 || selectedCols.length === 0}
          >
            Exportar a Excel
          </Button>
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
          <Field label="arribo desde" htmlFor="rep-impo-desde">
            <DateField
              id="rep-impo-desde"
              value={desde}
              max={hasta || undefined}
              onChange={(e) => setDesde(e.target.value)}
            />
          </Field>
          <Field label="arribo hasta" htmlFor="rep-impo-hasta">
            <DateField
              id="rep-impo-hasta"
              value={hasta}
              min={desde || undefined}
              onChange={(e) => setHasta(e.target.value)}
            />
          </Field>
          <Field label="naviera" htmlFor="rep-impo-naviera">
            <ComboboxCreatable
              id="rep-impo-naviera"
              options={navieraOptions}
              value={navieraId}
              onChange={setNavieraId}
              placeholder="Todas las navieras"
            />
          </Field>
        </div>
      </div>

      {/* ── selector de columnas ── */}
      <div className="fd-panel">
        <div className="fd-panel-title">
          <i className="ti ti-columns" aria-hidden style={{ fontSize: 15 }} /> Columnas a exportar
          <span className="fd-count">
            {selectedCols.length}/{COLS_IMPO.length}
          </span>
        </div>
        <div className="fd-panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="ghost"
              icon="ti-checks"
              onClick={() => setSelected(new Set(ALL_KEYS_IMPO))}
              style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}
            >
              Todas
            </Button>
            <Button
              variant="ghost"
              icon="ti-square-off"
              onClick={() => setSelected(new Set())}
              style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}
            >
              Ninguna
            </Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px 14px" }}>
            {COLS_IMPO.map((c) => (
              <Checkbox
                key={c.key}
                id={`col-impo-${c.key}`}
                checked={selected.has(c.key)}
                onChange={() => toggleCol(c.key)}
                label={c.label}
              />
            ))}
          </div>
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
            rowKey={(r) => r.operacion_impo_id}
            loading={loading}
            skeletonRows={8}
            pageSize={15}
            maxHeight={560}
            defaultSort={{ key: "fecha_arribo_terminal", dir: "desc" }}
            errorState={
              loadError ? (
                <ErrorState title="No se pudo generar el reporte" detail={loadError} onRetry={() => void load()} />
              ) : undefined
            }
            emptyState={
              <EmptyState icon="ti-report-search" title="Sin resultados para estos filtros">
                Ajustá el rango de arribo o la naviera. El reporte combina las operaciones de importación abiertas y
                cerradas con sus días transcurridos, exceso y costo de detention/demurrage tal como los calcula el
                sistema — acá solo se muestran y se exportan.
              </EmptyState>
            }
          />
        )}
      </div>
    </>
  );
}
