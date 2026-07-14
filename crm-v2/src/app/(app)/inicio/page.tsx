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
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { KpiCard } from "@/components/fd/kpi-card";
import { PageHeader } from "@/components/fd/page-header";
import { QuickLink } from "@/components/fd/quick-link";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { fmtUSDCompact } from "@/lib/format";
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
    costoMes === 0 &&
    costoYtd === 0 &&
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
        <KpiCard label="costo · mes" value={costoMes} prefix="USD " sub="cerradas este mes" />
        <KpiCard label="costo · ytd" value={costoYtd} prefix="USD " sub="cerradas en el año" />
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

export default function InicioPage() {
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // anti-carrera: descarta respuestas que llegan después de un load más nuevo
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const rid = ++reqIdRef.current;
    const supabase = getSupabase();
    const [resumen, resumenImpo, porNaviera, tendencia] = await Promise.all([
      supabase.from("vista_kpi_resumen").select("*").single(),
      // TOLERANTE (M5 B2): si falla, el dashboard sigue con los KPIs de importación en
      // cero — no tumba el resto (mismo criterio que vista_alertas_impo en /alertas).
      supabase.from("vista_kpi_resumen_impo").select("*").single(),
      supabase.from("vista_kpi_costo_naviera").select("*").order("costo_total", { ascending: false }),
      supabase.from("vista_kpi_tendencia_mensual").select("*").order("mes", { ascending: true }),
    ]);
    if (rid !== reqIdRef.current) return; // llegó tarde: hay otro load en vuelo

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
