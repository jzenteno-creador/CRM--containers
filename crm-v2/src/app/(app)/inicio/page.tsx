"use client";

// Inicio (M8): dashboard de KPIs sobre las views de la migración 018 —
// crm.vista_kpi_resumen (SIEMPRE 1 fila → .single()), vista_kpi_costo_naviera y
// vista_kpi_tendencia_mensual. LA DB YA CALCULÓ TODO (costos, counts, promedio,
// serie mensual con generate_series): acá NO se suma, resta ni promedia nada —
// solo Number() sobre los numeric que PostgREST serializa como string, formateo
// (fmtUSD/fmtUSDCompact), truncado a top 8 para las barras y labels de mes cortos.
// Patrón de página del repo (espejo de /alertas): load() con anti-carrera, refetch
// al recuperar foco, contrato de 4 estados (skeleton / error+retry / vacío / poblado).
// Decisión de balance del estado vacío (documentada): los KpiCards SIEMPRE se
// renderizan (en cero si no hay datos) y el vacío instructivo reemplaza SOLO la zona
// de charts — así la pantalla enseña qué números va a haber sin inventar un gráfico
// plano engañoso. Cada chart además tiene su propio empty inline para el caso mixto
// (ej: hay abiertas pero ningún cierre todavía).

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/fd/button";
import { BarChart, TrendLine, type ChartDatum } from "@/components/fd/charts";
import { CollapsibleSection } from "@/components/fd/collapsible-section";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { KpiCard } from "@/components/fd/kpi-card";
import { PageHeader } from "@/components/fd/page-header";
import { QuickLink } from "@/components/fd/quick-link";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { useAutoRefresh } from "@/components/fd/use-auto-refresh";
import { fmtUSD, fmtUSDCompact } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";

// Contrato real de las views 018 (verificado en vivo): los numeric llegan como STRING
// por la serialización JSON de PostgREST; los counts pueden llegar como number.
// `NumLike` tolera ambos y se normaliza con Number() (parseo, no cálculo).
type NumLike = string | number | null;

type ResumenRow = {
  costo_mes: NumLike;
  costo_ytd: NumLike;
  costo_abierto_proyectado: NumLike;
  en_riesgo_rojo: NumLike;
  en_riesgo_amarillo: NumLike;
  stock_vacios: NumLike;
  demora_promedio_dias: NumLike;
};

// Contrato real de crm.vista_kpi_resumen_impo (migración 032, bloque H) — espejo mínimo
// del resumen EXPO, sin stock_vacios/demora_promedio_dias (no modelados para importación).
type ResumenImpoRow = {
  costo_mes: NumLike;
  costo_ytd: NumLike;
  costo_abierto_proyectado: NumLike;
  en_riesgo_rojo: NumLike;
  en_riesgo_amarillo: NumLike;
  abiertas_total: NumLike;
};

type CostoNavieraRow = {
  naviera: string | null;
  costo_realizado_ytd: NumLike;
  costo_proyectado_abierto: NumLike;
  costo_total: NumLike;
};

type TendenciaRow = {
  mes: string; // date "YYYY-MM-01" (día 1 del mes AR)
  costo_realizado: NumLike;
  cerradas: NumLike;
};

// Contrato real de crm.vista_kpi_piloto_mensual (migración 040, auditoría 2026-07-31
// Bloque 3): los 3 KPIs del piloto Dow que faltaban además de costo/naviera (018) —
// % dentro del free time, estadía/demora (promedio + mediana) y trazabilidad, por mes
// de devolución. mes = date "YYYY-MM-01", mismo formato que TendenciaRow.mes.
type PilotoMensualRow = {
  mes: string;
  cerradas: NumLike;
  dentro_freetime: NumLike;
  pct_dentro_freetime: NumLike;
  estadia_promedio: NumLike;
  estadia_mediana: NumLike;
  demora_promedio: NumLike;
  demora_mediana: NumLike;
  trazados_sin_cargo: NumLike;
  costo_neto_mes: NumLike;
};

type DashboardData = {
  resumen: ResumenRow;
  // null = vista_kpi_resumen_impo falló (tolerante — no tumba el dashboard, los KPIs de
  // importación quedan en cero, igual que "sin datos" para el resto de la pantalla).
  resumenImpo: ResumenImpoRow | null;
  porNaviera: CostoNavieraRow[];
  tendencia: TendenciaRow[];
};

/** Normalización de numeric-como-string de PostgREST. null → 0 (COALESCE de display). */
const toNum = (v: NumLike): number => (v == null ? 0 : Number(v));

// Labels de mes cortos es-AR para la tendencia (indexado por "MM" del date de la view —
// evita parsear el date por timezone: el mes AR ya viene resuelto de la DB).
const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Top de barras del BarChart (presentación: la view ya ordena por costo_total desc).
const TOP_NAVIERAS = 8;

/** Trunca el nombre de naviera para el eje del BarChart (slot ~75px con 8 barras). */
function truncLabel(s: string): string {
  return s.length > 12 ? s.slice(0, 11).trimEnd() + "…" : s;
}

/**
 * Mes 'YYYY-MM-01' (date de vista_kpi_piloto_mensual) → 'jul 2026' es-AR, SIN pasar por
 * Date: new Date("YYYY-MM-01") parsea UTC medianoche y en AR (UTC-3) retrocede al mes
 * anterior — mismo motivo por el que MES_CORTO de arriba indexa directo el "MM" del
 * string en vez de parsear la fecha (y el mismo bug que fmtFechaDia documenta en
 * lib/format.ts para columnas DATE).
 */
function fmtMesAnio(ymd: string): string {
  const mm = Number(ymd.slice(5, 7));
  return `${MES_CORTO[mm - 1] ?? ymd.slice(5, 7)} ${ymd.slice(0, 4)}`;
}

/** Días con 1 decimal es-AR (estadía/demora del piloto — la view ya redondea a 1). */
function fmtDias(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Porcentaje con 1 decimal es-AR + símbolo (pct_dentro_freetime de la view). */
function fmtPct(v: NumLike): string {
  return fmtDias(toNum(v)) + "%";
}

// Grillas compartidas entre skeleton y contenido real (cero layout shift).
// KPI: min 210px por celda — con el valor escalando por container query (15cqw en
// KpiCard) el content-box de ~174px aloja hasta 11 chars mono sin pisar la vecina.
const KPI_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: "var(--radius-panel)",
  overflow: "hidden",
  background: "var(--color-surface-1)",
};

const CHARTS_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16,
  marginTop: 16,
};

function DashboardSkeleton() {
  return (
    <div aria-hidden>
      <div style={KPI_GRID}>
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} style={{ padding: "14px 18px" }}>
            <SkeletonBlock width={92} height={10} delay={i * 150} />
            <SkeletonBlock width={124} height={34} delay={i * 150} style={{ marginTop: 10 }} />
            <SkeletonBlock width={70} height={9} delay={i * 150} style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>
      <div style={CHARTS_GRID}>
        {[0, 1].map((i) => (
          <section key={i} className="fd-panel">
            <div className="fd-panel-title">
              <SkeletonBlock width={150} height={11} delay={i * 150} />
            </div>
            <div className="fd-panel-body">
              <SkeletonBlock width="100%" height={200} delay={i * 150} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function DashboardContent({ data, onPrimeraTanda }: { data: DashboardData; onPrimeraTanda: () => void }) {
  const r = data.resumen;
  const costoMes = toNum(r.costo_mes);
  const costoYtd = toNum(r.costo_ytd);
  const proyectado = toNum(r.costo_abierto_proyectado);
  const stock = toNum(r.stock_vacios);
  // demora conserva el null de la view (sin cerradas YTD) — se muestra 0,0 con sub explicativo
  const demora = r.demora_promedio_dias == null ? null : Number(r.demora_promedio_dias);

  // IMPO (migración 032, bloque H) — null si vista_kpi_resumen_impo falló (tolerante,
  // ver DashboardData): degrada a cero, no tumba el resto del dashboard.
  const ri = data.resumenImpo;
  const proyectadoImpo = ri ? toNum(ri.costo_abierto_proyectado) : 0;
  // "en riesgo" combinado EXPO+IMPO (§ Inicio, M5 B2): suma presentacional de dos counts
  // ya calculados por cada view — mismo tipo de operación que "Total combinado" de costo,
  // no un cálculo de negocio nuevo.
  const rojo = toNum(r.en_riesgo_rojo) + (ri ? toNum(ri.en_riesgo_rojo) : 0);
  const amarillo = toNum(r.en_riesgo_amarillo) + (ri ? toNum(ri.en_riesgo_amarillo) : 0);
  const totalCombinado = proyectado + proyectadoImpo;

  // Costo realizado combinado EXPO+IMPO (P1-F, auditoría 2026-07-31): mismo patrón
  // presentacional que "total combinado" de arriba — suma de dos numeric ya calculados
  // por cada view, el desglose solo se muestra si impo > 0 (todavía no opera).
  const costoMesImpo = ri ? toNum(ri.costo_mes) : 0;
  const costoYtdImpo = ri ? toNum(ri.costo_ytd) : 0;
  const costoMesTotal = costoMes + costoMesImpo;
  const costoYtdTotal = costoYtd + costoYtdImpo;

  // Datos de charts: filtro >0 y top 8 son presentación; los montos vienen de la DB.
  // (EXPO-only: no hay vista de "por naviera" ni "tendencia mensual" para importación.)
  const barData: ChartDatum[] = data.porNaviera
    .filter((row) => toNum(row.costo_total) > 0)
    .slice(0, TOP_NAVIERAS)
    .map((row) => ({ label: truncLabel(row.naviera ?? "—"), value: toNum(row.costo_total) }));

  const trendData: ChartDatum[] = data.tendencia.map((row) => ({
    label: MES_CORTO[Number(row.mes.slice(5, 7)) - 1] ?? row.mes.slice(5, 7),
    value: toNum(row.costo_realizado),
  }));

  // ¿Hay señal en la tendencia? (cerradas>0 con costo 0 — ej. todo sin cargo — ES dato)
  const hayTendencia = data.tendencia.some((row) => toNum(row.costo_realizado) > 0 || toNum(row.cerradas) > 0);
  const resumenEnCero =
    costoMesTotal === 0 &&
    costoYtdTotal === 0 &&
    proyectado === 0 &&
    proyectadoImpo === 0 &&
    rojo === 0 &&
    amarillo === 0 &&
    stock === 0 &&
    demora == null;
  const sinDatos = resumenEnCero && barData.length === 0 && !hayTendencia;

  return (
    <>
      {/* KPIs — siempre visibles, también en cero (decisión de balance del vacío) */}
      <div style={KPI_GRID}>
        <KpiCard
          label="costo · mes"
          value={costoMesTotal}
          prefix="USD "
          sub={
            costoMesImpo > 0
              ? `expo ${fmtUSDCompact(costoMes)} · impo ${fmtUSDCompact(costoMesImpo)}`
              : "cerradas este mes"
          }
        />
        <KpiCard
          label="costo · ytd"
          value={costoYtdTotal}
          prefix="USD "
          sub={
            costoYtdImpo > 0
              ? `expo ${fmtUSDCompact(costoYtd)} · impo ${fmtUSDCompact(costoYtdImpo)}`
              : "cerradas en el año"
          }
        />
        <KpiCard
          label="proyectado abierto"
          value={proyectado}
          prefix="USD "
          amber={proyectado > 0}
          sub="expo · si nada se devuelve hoy"
        />
        <KpiCard
          label="detention impo (proyectado)"
          value={proyectadoImpo}
          prefix="USD "
          amber={proyectadoImpo > 0}
          sub="si nada se devuelve hoy"
        />
        <KpiCard
          label="total combinado"
          value={totalCombinado}
          prefix="USD "
          amber={totalCombinado > 0}
          sub="expo + impo"
        />
        <KpiCard label="en riesgo · rojo" value={rojo} critical={rojo > 0} sub="freetime vencido · expo + impo" />
        <KpiCard label="en riesgo · amarillo" value={amarillo} amber={amarillo > 0} sub="por vencer · expo + impo" />
        <KpiCard label="stock de vacíos" value={stock} sub="ciclos abiertos hoy" />
        <KpiCard
          label="demora promedio"
          value={demora ?? 0}
          decimals={1}
          suffix=" días"
          sub={demora == null ? "sin cerradas en el año" : "cerradas del año"}
        />
      </div>

      {sinDatos ? (
        // Vacío instructivo global: reemplaza SOLO la zona de charts (los KPIs quedan en 0)
        <section className="fd-panel" style={{ marginTop: 16 }}>
          <EmptyState
            icon="ti-layout-dashboard"
            title="Todavía no hay datos para el dashboard"
            action={
              <Button variant="primary" icon="ti-login-2" onClick={onPrimeraTanda}>
                Cargar la primera tanda
              </Button>
            }
          >
            Los KPIs de arriba arrancan en cero. Este tablero se alimenta de los ciclos de contenedores: los
            retiros de exportación se cargan desde <strong>Ingreso</strong> y se cierran desde{" "}
            <strong>Egreso</strong>; los ciclos de importación, desde <strong>Importación</strong>. Con el primer
            ciclo vas a ver acá el costo proyectado, el riesgo por semáforo y la tendencia mensual.
          </EmptyState>
        </section>
      ) : (
        <div style={CHARTS_GRID}>
          <section className="fd-panel">
            <div className="fd-panel-title">
              <i className="ti ti-chart-bar" aria-hidden style={{ color: "var(--color-accent-500)" }} />
              Costo por naviera
              <span className="fd-count">USD · ytd + abierto</span>
            </div>
            <div className="fd-panel-body">
              {barData.length > 0 ? (
                <BarChart
                  data={barData}
                  color="var(--color-status-red-soft)"
                  formatValue={fmtUSDCompact}
                  ariaLabel="costo de detention por naviera"
                />
              ) : (
                <EmptyState icon="ti-chart-bar" title="Sin costos por naviera todavía">
                  Acá se compara el costo de detention por naviera: lo realizado en el año más lo proyectado de
                  los ciclos abiertos. Aparece apenas haya un ciclo con tarifa vigente — se cargan desde{" "}
                  <strong>Ingreso</strong> y se cierran desde <strong>Egreso</strong>.
                </EmptyState>
              )}
            </div>
          </section>
          <section className="fd-panel">
            <div className="fd-panel-title">
              <i className="ti ti-chart-line" aria-hidden style={{ color: "var(--color-accent-500)" }} />
              Tendencia mensual
              <span className="fd-count">USD · 12 meses</span>
            </div>
            <div className="fd-panel-body">
              {hayTendencia ? (
                <TrendLine
                  data={trendData}
                  formatValue={fmtUSDCompact}
                  ariaLabel="tendencia mensual de costo realizado"
                />
              ) : (
                <EmptyState icon="ti-chart-line" title="Sin cierres en los últimos 12 meses">
                  La línea muestra el costo realizado por mes (ciclos cerrados por devolución o embarque). Se
                  dibuja con el primer cierre registrado desde <strong>Egreso</strong>.
                </EmptyState>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// KPIs del piloto (auditoría 2026-07-31, Bloque 3): los 4 KPIs comprometidos con Dow
// con medición mensual — el de costo por naviera ya vive en "Costo por naviera" de
// arriba (018); acá van los otros 3 sobre vista_kpi_piloto_mensual (040): % dentro
// del free time, estadía/demora (promedio + mediana) y cerradas del mes.
// Tri-estado PROPIO (undefined=carga · null=error · []=vacío · array=poblado),
// INDEPENDIENTE del contrato data/loadError del resto de la página — mismo patrón
// que /vision/escanear (rows: T[] | null | undefined): esta sección puede mostrar
// datos aunque vista_kpi_resumen falle, y viceversa (tolerancia mutua entre las dos
// fuentes, sin acoplar sus cargas).
// ---------------------------------------------------------------------------

const PILOTO_COLUMNS: Column<PilotoMensualRow>[] = [
  { key: "mes", header: "mes", render: (r) => fmtMesAnio(r.mes), sortValue: (r) => r.mes, width: "90px" },
  {
    key: "cerradas",
    header: "cerradas",
    numeric: true,
    render: (r) => toNum(r.cerradas),
    sortValue: (r) => toNum(r.cerradas),
    width: "85px",
  },
  {
    key: "pct_dentro_freetime",
    header: "% dentro",
    numeric: true,
    render: (r) => fmtPct(r.pct_dentro_freetime),
    sortValue: (r) => toNum(r.pct_dentro_freetime),
    width: "90px",
  },
  {
    key: "estadia_promedio",
    header: "estadía x̄",
    numeric: true,
    render: (r) => fmtDias(toNum(r.estadia_promedio)),
    sortValue: (r) => toNum(r.estadia_promedio),
    width: "95px",
  },
  {
    key: "demora_promedio",
    header: "demora x̄",
    numeric: true,
    render: (r) => fmtDias(toNum(r.demora_promedio)),
    sortValue: (r) => toNum(r.demora_promedio),
    width: "95px",
  },
  {
    key: "costo_neto_mes",
    header: "costo neto",
    numeric: true,
    render: (r) => <span className="fd-usd">{fmtUSD(toNum(r.costo_neto_mes))}</span>,
    sortValue: (r) => toNum(r.costo_neto_mes),
    width: "110px",
  },
];

/** Skeleton de las 4 KpiCards del piloto — misma grilla que DashboardSkeleton, 4 celdas. */
function PilotoKpiSkeleton() {
  return (
    <div style={{ ...KPI_GRID, marginBottom: 16 }} aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} style={{ padding: "14px 18px" }}>
          <SkeletonBlock width={92} height={10} delay={i * 150} />
          <SkeletonBlock width={100} height={30} delay={i * 150} style={{ marginTop: 10 }} />
          <SkeletonBlock width={70} height={9} delay={i * 150} style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

function PilotoSection({
  piloto,
  onRetry,
}: {
  piloto: PilotoMensualRow[] | null | undefined;
  onRetry: () => void;
}) {
  // La view ya llega ordenada desc por mes (load() pide .limit(13)); la tabla muestra
  // los últimos 12 y las KpiCards toman el más reciente de esos 12 — el 13º fetcheado
  // es margen defensivo, nunca se lo muestra.
  const ultimos12 = (piloto ?? []).slice(0, 12);
  const latest = ultimos12[0] ?? null;

  return (
    <CollapsibleSection title="KPIs del piloto" icon="ti-flag-check" count={piloto == null ? null : ultimos12.length}>
      <p style={{ fontSize: 11.5, color: "var(--color-text-muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Los 4 KPIs comprometidos con Dow — medidos sobre operaciones cerradas por mes de devolución.
      </p>

      {piloto === undefined ? (
        <PilotoKpiSkeleton />
      ) : (
        latest && (
          <div style={{ ...KPI_GRID, marginBottom: 16 }}>
            <KpiCard
              label="% dentro del free time"
              value={toNum(latest.pct_dentro_freetime)}
              suffix="%"
              decimals={1}
              sub={`${toNum(latest.dentro_freetime)} de ${toNum(latest.cerradas)} cerradas · ${fmtMesAnio(latest.mes)}`}
            />
            <KpiCard
              label="estadía promedio"
              value={toNum(latest.estadia_promedio)}
              suffix=" días"
              decimals={1}
              sub={`mediana ${fmtDias(toNum(latest.estadia_mediana))} días`}
            />
            <KpiCard
              label="demora promedio"
              value={toNum(latest.demora_promedio)}
              suffix=" días"
              decimals={1}
              sub={`mediana ${fmtDias(toNum(latest.demora_mediana))} días`}
            />
            <KpiCard label="cerradas del mes" value={toNum(latest.cerradas)} sub={fmtMesAnio(latest.mes)} />
          </div>
        )
      )}

      <div className="fd-panel">
        <div className="fd-panel-title">
          <i className="ti ti-table" aria-hidden style={{ color: "var(--color-accent-500)" }} />
          Últimos 12 meses
          <span className="fd-count">mes de devolución</span>
        </div>
        <div className="fd-panel-body">
          <DataTable<PilotoMensualRow>
            columns={PILOTO_COLUMNS}
            rows={ultimos12}
            rowKey={(r) => r.mes}
            loading={piloto === undefined}
            defaultSort={{ key: "mes", dir: "desc" }}
            maxHeight={360}
            emptyState={
              <EmptyState icon="ti-flag-check" title="Sin cierres del piloto todavía">
                Estos KPIs se calculan sobre operaciones de exportación cerradas por devolución. Aparecen apenas
                haya el primer cierre registrado desde <strong>Egreso</strong>.
              </EmptyState>
            }
            errorState={
              piloto === null ? (
                <ErrorState
                  title="No se pudieron cargar los KPIs del piloto"
                  detail="Revisá la conexión o reintentá."
                  onRetry={onRetry}
                />
              ) : undefined
            }
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}

export default function InicioPage() {
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // KPIs del piloto: tri-estado propio (undefined=carga · null=error · array=poblado),
  // independiente de data/loadError — ver comentario de PilotoSection.
  const [piloto, setPiloto] = useState<PilotoMensualRow[] | null | undefined>(undefined);
  // anti-carrera: descarta respuestas que llegan después de un load más nuevo
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const rid = ++reqIdRef.current;
    const supabase = getSupabase();
    const [resumen, resumenImpo, porNaviera, tendencia, pilotoRes] = await Promise.all([
      supabase.from("vista_kpi_resumen").select("*").single(),
      // TOLERANTE (M5 B2): si falla, el dashboard sigue con los KPIs de importación en
      // cero — no tumba el resto (mismo criterio que vista_alertas_impo en /alertas).
      supabase.from("vista_kpi_resumen_impo").select("*").single(),
      supabase.from("vista_kpi_costo_naviera").select("*").order("costo_total", { ascending: false }),
      supabase.from("vista_kpi_tendencia_mensual").select("*").order("mes", { ascending: true }),
      // KPIs del piloto (040) — 13 para dar margen defensivo a la tabla de 12 meses.
      supabase.from("vista_kpi_piloto_mensual").select("*").order("mes", { ascending: false }).limit(13),
    ]);
    if (rid !== reqIdRef.current) return; // llegó tarde: hay otro load en vuelo

    // TOLERANTE (mismo criterio que resumenImpo): se resuelve ANTES del early-return de
    // abajo para que un fallo en vista_kpi_resumen no tumbe la sección del piloto.
    setPiloto(pilotoRes.error ? null : ((pilotoRes.data ?? []) as unknown as PilotoMensualRow[]));

    const error = resumen.error ?? porNaviera.error ?? tendencia.error;
    if (error) {
      setData(null);
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    setData({
      resumen: resumen.data as unknown as ResumenRow,
      resumenImpo: resumenImpo.error ? null : (resumenImpo.data as unknown as ResumenImpoRow),
      porNaviera: (porNaviera.data ?? []) as unknown as CostoNavieraRow[],
      tendencia: (tendencia.data ?? []) as unknown as TendenciaRow[],
    });
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // refetch al recuperar foco (mismo criterio que /ingreso, /egreso, /contenedores, /alertas)
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  // auto-refresco cada 60s (P2, auditoría 2026-07-31): este dashboard es el que respalda
  // el badge "EN VIVO" del header (shell.tsx) — sin esto quedaba stale horas en un
  // monitor de pared. Mismo patrón que la campana de notificaciones: se pausa solo con
  // la pestaña oculta (ver useAutoRefresh).
  useAutoRefresh(load, 60_000);

  const loading = data === null && !loadError;

  return (
    <>
      <PageHeader
        title="Inicio"
        action={
          <Button variant="ghost" icon="ti-refresh" onClick={() => void load()} disabled={loading}>
            Actualizar
          </Button>
        }
      />

      {loadError ? (
        <div className="fd-panel">
          <ErrorState title="No se pudo cargar el dashboard" detail={loadError} onRetry={() => void load()} />
        </div>
      ) : loading ? (
        <DashboardSkeleton />
      ) : (
        <DashboardContent data={data!} onPrimeraTanda={() => router.push("/ingreso")} />
      )}

      {/* KPIs del piloto (auditoría 2026-07-31, Bloque 3) — tri-estado propio, no
          gateado por loadError/loading del resto del dashboard (ver PilotoSection). */}
      <div style={{ marginTop: 20 }}>
        <PilotoSection piloto={piloto} onRetry={() => void load()} />
      </div>

      {/* Accesos rápidos §8 — navegación estática, visible en los 4 estados */}
      <div className="fd-label" style={{ margin: "20px 0 8px" }}>
        accesos rápidos
      </div>
      <nav
        aria-label="accesos rápidos"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}
      >
        <QuickLink href="/ingreso" icon="ti-login-2" title="Ingreso">
          Cargá una tanda de retiro y confirmá llegadas a planta.
        </QuickLink>
        <QuickLink href="/egreso" icon="ti-logout-2" title="Egreso">
          Registrá salidas de planta y cierres en terminal.
        </QuickLink>
        <QuickLink href="/alertas" icon="ti-bell" title="Alertas">
          Semáforo de freetime y costo proyectado por contenedor.
        </QuickLink>
        <QuickLink href="/contenedores" icon="ti-list-details" title="Contenedores">
          Planilla global con la ficha y el historial de cada equipo.
        </QuickLink>
      </nav>
    </>
  );
}
