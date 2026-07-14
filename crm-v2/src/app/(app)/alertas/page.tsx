"use client";

// Alertas (M6): panel de vencimiento de freetime sobre crm.vista_alertas.
// LA VIEW YA CALCULA TODO (días, costos, semáforo, umbral amarillo aplicado adentro,
// filtro estado NOT IN cerrado/anulada, RLS scopea por planta) — acá NO se recalcula
// nada: solo formateo (fmtUSD/fmtFecha), conteo de filas para los counters y filtro
// de presentación por semáforo sobre lo ya traído.
// - Semáforo de 4 estados (contrato real de la view): verde | amarillo | rojo | neutro.
//   `neutro` = sin tarifa vigente / la naviera no cobra detention en origen.
// - `costo_proyectado` puede ser NULL (sin tarifa) → "USD —", NUNCA 0. Si `sin_cargo`,
//   badge "sin cargo" en lugar del monto.
// - Leyenda del umbral: lectura TOLERANTE de `configuracion` (si falla por RLS u otra
//   razón se oculta en silencio — el semáforo no depende de eso, viene de la view).
// Patrón de página del repo (espejo de /contenedores): load() callback, refetch al
// recuperar foco, 4 estados en la tabla, paginación client-side con cap de fetch.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { ContainerNumber } from "@/components/container-number";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { Field, Select } from "@/components/fd/fields";
import { PageHeader } from "@/components/fd/page-header";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { StatusBadge, type EstadoSemaforo } from "@/components/fd/status-badge";
import { fmtFecha, fmtFechaDia, fmtUSD } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { EstadoOperacionBadge } from "../contenedores/estado-operacion";

// Fila de crm.vista_bookings_saldo (028, M5 B3) — solo las columnas que usa la
// sección "Bookings por rolear" de abajo.
type BookingRolearRow = {
  booking_id: string;
  numero: string;
  naviera: string;
  etd: string;
  dias_a_etd: number;
  contenedores_en_planta: number;
  estado_semaforo: EstadoSemaforo;
};

/**
 * Sección secundaria (M5 B3): bookings de retiro rojo/amarillo con contenedores en
 * planta — el mismo control que Omar hacía a mano cada viernes. Widget tolerante:
 * si la vista falla (RLS, red, o el entorno todavía no tiene la 028) se oculta en
 * silencio, igual que la campana de notificaciones — no bloquea ni ensucia Alertas,
 * que sigue siendo la pantalla de freetime de contenedores. "Sin ninguna" también
 * se oculta entera (sin ruido), por eso NO usa el <EmptyState> estándar de la tabla.
 */
function BookingsPorRolearSection() {
  const router = useRouter();
  const [rows, setRows] = useState<BookingRolearRow[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error } = await getSupabase()
        .from("vista_bookings_saldo")
        .select("booking_id, numero, naviera, etd, dias_a_etd, contenedores_en_planta, estado_semaforo")
        .in("estado_semaforo", ["rojo", "amarillo"])
        .order("dias_a_etd", { ascending: true })
        .limit(50);
      setRows(error ? null : (data as unknown as BookingRolearRow[]));
      setLoaded(true);
    })();
  }, []);

  if (!loaded) {
    return (
      <div className="fd-panel" style={{ marginBottom: 16 }} aria-busy="true" aria-label="cargando bookings por rolear">
        <SkeletonBlock width={200} height={13} />
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <SkeletonBlock height={30} delay={80} />
          <SkeletonBlock height={30} delay={160} />
        </div>
      </div>
    );
  }
  if (!rows || rows.length === 0) return null;

  const bookingCols: Column<BookingRolearRow>[] = [
    {
      key: "semaforo",
      header: "semáforo",
      width: "110px",
      render: (r) => <StatusBadge estado={r.estado_semaforo}>{r.estado_semaforo === "rojo" ? "vencido" : "por vencer"}</StatusBadge>,
      sortValue: (r) => (r.estado_semaforo === "rojo" ? 0 : 1),
    },
    {
      key: "numero",
      header: "booking",
      render: (r) => (
        <span className="mono" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
          {r.numero}
        </span>
      ),
      sortValue: (r) => r.numero,
    },
    { key: "naviera", header: "naviera", render: (r) => r.naviera, sortValue: (r) => r.naviera },
    { key: "etd", header: "ETD", numeric: true, render: (r) => fmtFechaDia(r.etd), sortValue: (r) => r.etd },
    { key: "dias", header: "días a ETD", numeric: true, render: (r) => r.dias_a_etd, sortValue: (r) => r.dias_a_etd, width: "95px" },
    {
      key: "en_planta",
      header: "en planta",
      numeric: true,
      render: (r) => r.contenedores_en_planta,
      sortValue: (r) => r.contenedores_en_planta,
      width: "90px",
    },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span className="fd-display fd-display-sm" style={{ color: "var(--color-text-secondary)" }}>
          <i className="ti ti-anchor" aria-hidden style={{ marginRight: 6, color: "var(--color-accent-500)" }} />
          Bookings por rolear
        </span>
        <span className="mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          {rows.length}
        </span>
      </div>
      <DataTable
        columns={bookingCols}
        rows={rows}
        rowKey={(r) => r.booking_id}
        semaforo={(r) => r.estado_semaforo}
        maxHeight={220}
        onRowClick={(r) => router.push(`/bookings?semaforo=${r.estado_semaforo}`)}
      />
    </div>
  );
}

// Fila de crm.vista_stock_prefijos_restringidos (B6, migración 031) — solo las columnas
// que usa la sección "Prefijos restringidos en stock" de abajo.
type PrefijoStockRow = {
  operacion_id: string;
  numero_contenedor: string;
  prefijo: string;
  naviera: string | null;
  planta: string | null;
  fecha_retiro: string;
};

/**
 * Sección secundaria (B6): el barrido retroactivo del "Dow container screen" — stock ya
 * cargado cuyo prefijo pasó a restringido DESPUÉS del retiro, sin que nadie lo note entre
 * las actualizaciones de julio y diciembre. Mismo patrón tolerante que
 * BookingsPorRolearSection: si la view falla o no hay filas, la sección se oculta entera
 * (sin ruido) — el detalle completo con alta/edición del catálogo vive en /prefijos.
 */
function PrefijosRestringidosSection() {
  const router = useRouter();
  const [rows, setRows] = useState<PrefijoStockRow[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error } = await getSupabase()
        .from("vista_stock_prefijos_restringidos")
        .select("operacion_id, numero_contenedor, prefijo, naviera, planta, fecha_retiro")
        .order("fecha_retiro", { ascending: false })
        .limit(50);
      setRows(error ? null : (data as unknown as PrefijoStockRow[]));
      setLoaded(true);
    })();
  }, []);

  if (!loaded) {
    return (
      <div className="fd-panel" style={{ marginBottom: 16 }} aria-busy="true" aria-label="cargando prefijos restringidos en stock">
        <SkeletonBlock width={220} height={13} />
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <SkeletonBlock height={30} delay={80} />
          <SkeletonBlock height={30} delay={160} />
        </div>
      </div>
    );
  }
  if (!rows || rows.length === 0) return null;

  const prefijoCols: Column<PrefijoStockRow>[] = [
    {
      key: "contenedor",
      header: "contenedor",
      render: (r) => <ContainerNumber value={r.numero_contenedor} />,
      sortValue: (r) => r.numero_contenedor,
    },
    {
      key: "prefijo",
      header: "prefijo",
      render: (r) => <span className="mono">{r.prefijo}</span>,
      sortValue: (r) => r.prefijo,
      width: "80px",
    },
    { key: "naviera", header: "naviera", render: (r) => r.naviera ?? "—", sortValue: (r) => r.naviera },
    { key: "planta", header: "planta", render: (r) => r.planta ?? "—", sortValue: (r) => r.planta, hideOnMobile: true },
    {
      key: "fecha_retiro",
      header: "fecha retiro",
      numeric: true,
      render: (r) => fmtFecha(r.fecha_retiro),
      sortValue: (r) => r.fecha_retiro,
      hideOnMobile: true,
    },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span className="fd-display fd-display-sm" style={{ color: "var(--color-text-secondary)" }}>
          <i className="ti ti-forbid-2" aria-hidden style={{ marginRight: 6, color: "var(--color-accent-500)" }} />
          Prefijos restringidos en stock
        </span>
        <span className="mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          {rows.length}
        </span>
      </div>
      <DataTable
        columns={prefijoCols}
        rows={rows}
        rowKey={(r) => r.operacion_id}
        semaforo={() => "rojo"}
        maxHeight={220}
        onRowClick={() => router.push("/prefijos")}
      />
    </div>
  );
}

// Contrato real de crm.vista_alertas (pg_get_viewdef 2026-07-12, plan-m6):
// nombres TEXT ya resueltos (planta_actual/naviera), números ya calculados en DB.
type AlertaRow = {
  operacion_id: string;
  contenedor_id: string;
  numero_contenedor: string;
  planta_actual: string | null;
  naviera: string | null;
  estado: string;
  fecha_retiro: string;
  sin_cargo: boolean;
  dias_transcurridos: number;
  dias_libres: number | null;
  dias_restantes: number | null;
  tarifa_usd_dia: number | null;
  costo_proyectado: number | null;
  estado_semaforo: EstadoSemaforo;
};

type SemaforoFilter = "todos" | EstadoSemaforo;

// Labels únicos del semáforo de alertas (badge + counters + filtro usan el mismo mapa).
const SEMAFORO_LABEL: Record<EstadoSemaforo, string> = {
  rojo: "vencido",
  amarillo: "por vencer",
  verde: "en freetime",
  neutro: "sin tarifa",
};

// Orden de severidad para el sort de la columna semáforo (presentación, no negocio).
const SEMAFORO_RANK: Record<EstadoSemaforo, number> = { rojo: 0, amarillo: 1, verde: 2, neutro: 3 };

const SEMAFOROS: EstadoSemaforo[] = ["rojo", "amarillo", "verde", "neutro"];

const FILTROS: { value: SemaforoFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "rojo", label: "Vencidos (rojo)" },
  { value: "amarillo", label: "Por vencer (amarillo)" },
  { value: "verde", label: "En freetime (verde)" },
  { value: "neutro", label: "Sin tarifa (neutro)" },
];

// Counters: label pluralizable por tono (conteo de filas, no cálculo de negocio).
const COUNTER_LABEL: Record<EstadoSemaforo, (n: number) => string> = {
  rojo: (n) => `${n} vencido${n === 1 ? "" : "s"}`,
  amarillo: (n) => `${n} por vencer`,
  verde: (n) => `${n} en freetime`,
  neutro: (n) => `${n} sin tarifa`,
};

// cap de fetch (patrón planilla /contenedores): la paginación visible es client-side.
const FETCH_CAP = 500;

// color del valor "días restantes" según el semáforo de la view (presentación pura,
// mismo patrón que la tabla demo de /design).
const RESTANTES_COLOR: Record<EstadoSemaforo, string> = {
  rojo: "var(--color-status-red)",
  amarillo: "var(--color-status-amber)",
  verde: "var(--color-status-green)",
  neutro: "var(--color-text-muted)",
};

function DiasRestantes({ row }: { row: AlertaRow }) {
  if (row.dias_restantes == null) return <span style={{ color: "var(--color-text-faint)" }}>—</span>;
  // signo − tipográfico para negativos: formateo de display, el número viene de la view
  const display = row.dias_restantes < 0 ? `−${Math.abs(row.dias_restantes)}` : String(row.dias_restantes);
  return <span style={{ color: RESTANTES_COLOR[row.estado_semaforo], fontWeight: 600 }}>{display}</span>;
}

function CostoProyectado({ row }: { row: AlertaRow }) {
  // sin_cargo: la operación no genera detention (la view ya devuelve costo 0) → badge
  if (row.sin_cargo) return <Badge tone="neutro">sin cargo</Badge>;
  // NULL = sin tarifa vigente / naviera no cobra → "USD —", NUNCA 0
  if (row.costo_proyectado == null) return <span style={{ color: "var(--color-text-faint)" }}>{fmtUSD(null)}</span>;
  if (row.costo_proyectado > 0) return <span className="fd-usd">{fmtUSD(row.costo_proyectado)}</span>;
  return <span style={{ color: "var(--color-text-faint)" }}>{fmtUSD(row.costo_proyectado)}</span>;
}

const SEMAFORO_QUERY_VALUES: SemaforoFilter[] = ["rojo", "amarillo", "verde", "neutro"];

function parseSemaforoParam(v: string | null): SemaforoFilter | null {
  return v !== null && (SEMAFORO_QUERY_VALUES as string[]).includes(v) ? (v as SemaforoFilter) : null;
}

function AlertasPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ?semaforo= inicializa el filtro (llega de la campana §13: alertas→/alertas?semaforo=rojo)
  const semaforoParam = parseSemaforoParam(searchParams.get("semaforo"));
  const [filtro, setFiltro] = useState<SemaforoFilter>(semaforoParam ?? "todos");

  // si el param CAMBIA con la página ya montada (click en la campana estando en
  // /alertas), se re-aplica al filtro. Ajuste DURANTE el render (patrón React
  // "adjusting state when props change") — no un efecto (regla set-state-in-effect).
  const [lastParam, setLastParam] = useState(semaforoParam);
  if (semaforoParam !== lastParam) {
    setLastParam(semaforoParam);
    if (semaforoParam) setFiltro(semaforoParam);
  }

  const [rows, setRows] = useState<AlertaRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // umbral amarillo (solo para la leyenda): null = no disponible → leyenda oculta
  const [umbral, setUmbral] = useState<number | null>(null);
  // anti-carrera: descarta respuestas que llegan después de un load más nuevo
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const rid = ++reqIdRef.current;
    const supabase = getSupabase();
    const [alertas, config] = await Promise.all([
      supabase
        .from("vista_alertas")
        .select("*")
        .order("dias_restantes", { ascending: true, nullsFirst: false })
        .limit(FETCH_CAP),
      // TOLERANTE: si falla (RLS del operador u otra razón) solo se oculta la leyenda
      supabase.from("configuracion").select("valor").eq("clave", "umbral_alerta_amarillo").maybeSingle(),
    ]);
    if (rid !== reqIdRef.current) return; // llegó tarde: hay otro load en vuelo

    if (alertas.error) {
      setRows(null);
      setLoadError(alertas.error.message);
    } else {
      setLoadError(null);
      setRows(alertas.data as unknown as AlertaRow[]);
    }

    // valor es jsonb: en la DB real la clave guarda el objeto {"dias": 3} (la view hace
    // valor->>'dias') — si viene objeto se desanida `dias`; también se aceptan número o
    // string numérica directos. Cualquier otra forma → sin leyenda (tolerante).
    const valor: unknown = config.error ? null : config.data?.valor;
    const crudo: unknown =
      valor !== null && typeof valor === "object" && !Array.isArray(valor)
        ? (valor as { dias?: unknown }).dias
        : valor;
    const n =
      typeof crudo === "number" ? crudo : typeof crudo === "string" && /^\d+$/.test(crudo) ? Number(crudo) : null;
    setUmbral(n);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // refetch al recuperar foco (mismo criterio que /ingreso, /egreso, /contenedores)
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const loading = rows === null && !loadError;

  // conteo de filas por semáforo (display) + filtro de presentación client-side
  const counts: Record<EstadoSemaforo, number> = { rojo: 0, amarillo: 0, verde: 0, neutro: 0 };
  for (const r of rows ?? []) counts[r.estado_semaforo] += 1;
  const visibles = filtro === "todos" ? (rows ?? []) : (rows ?? []).filter((r) => r.estado_semaforo === filtro);

  const cols: Column<AlertaRow>[] = [
    {
      key: "semaforo",
      header: "semáforo",
      render: (r) => <StatusBadge estado={r.estado_semaforo}>{SEMAFORO_LABEL[r.estado_semaforo]}</StatusBadge>,
      sortValue: (r) => SEMAFORO_RANK[r.estado_semaforo],
      width: "120px",
    },
    {
      key: "contenedor",
      header: "contenedor",
      render: (r) => <ContainerNumber value={r.numero_contenedor} />,
      sortValue: (r) => r.numero_contenedor,
      width: "140px",
    },
    {
      key: "naviera",
      header: "naviera",
      render: (r) => r.naviera ?? "—",
      sortValue: (r) => r.naviera,
    },
    {
      key: "planta",
      header: "planta",
      render: (r) => r.planta_actual ?? "—",
      sortValue: (r) => r.planta_actual,
    },
    {
      key: "estado",
      header: "estado",
      render: (r) => <EstadoOperacionBadge estado={r.estado} />,
      sortValue: (r) => r.estado,
      hideOnMobile: true,
    },
    {
      key: "fecha_retiro",
      header: "fecha retiro",
      numeric: true,
      render: (r) => fmtFecha(r.fecha_retiro),
      sortValue: (r) => r.fecha_retiro,
      hideOnMobile: true,
    },
    {
      key: "dias_transcurridos",
      header: "días transc.",
      numeric: true,
      render: (r) => r.dias_transcurridos,
      sortValue: (r) => r.dias_transcurridos,
      hideOnMobile: true,
      width: "90px",
    },
    {
      key: "dias_libres",
      header: "días libres",
      numeric: true,
      render: (r) => (r.dias_libres == null ? <span style={{ color: "var(--color-text-faint)" }}>—</span> : r.dias_libres),
      sortValue: (r) => r.dias_libres,
      hideOnMobile: true,
      width: "90px",
    },
    {
      key: "dias_restantes",
      header: "días restantes",
      numeric: true,
      render: (r) => <DiasRestantes row={r} />,
      sortValue: (r) => r.dias_restantes,
      width: "105px",
    },
    {
      key: "tarifa_usd_dia",
      header: "tarifa USD/día",
      numeric: true,
      render: (r) =>
        r.tarifa_usd_dia == null ? (
          <span style={{ color: "var(--color-text-faint)" }}>{fmtUSD(null)}</span>
        ) : (
          fmtUSD(r.tarifa_usd_dia)
        ),
      sortValue: (r) => r.tarifa_usd_dia,
      hideOnMobile: true,
      width: "105px",
    },
    {
      key: "costo_proyectado",
      header: "costo proy.",
      numeric: true,
      render: (r) => <CostoProyectado row={r} />,
      sortValue: (r) => r.costo_proyectado,
      width: "110px",
    },
  ];

  const filtroLabel = FILTROS.find((f) => f.value === filtro)!.label;

  return (
    <>
      <PageHeader
        title="Alertas"
        counters={
          rows != null ? (
            <>
              {SEMAFOROS.filter((s) => counts[s] > 0).map((s) => (
                <Badge key={s} tone={s} mono>
                  {COUNTER_LABEL[s](counts[s])}
                </Badge>
              ))}
              {rows.length >= FETCH_CAP && (
                <Badge tone="amarillo" icon="ti-alert-triangle">
                  se muestran las primeras {FETCH_CAP}
                </Badge>
              )}
            </>
          ) : undefined
        }
        action={
          <Button variant="ghost" icon="ti-refresh" onClick={() => void load()} disabled={loading}>
            Actualizar
          </Button>
        }
      />

      {/* Bookings por rolear (M5 B3) — se oculta entera si no hay ninguno o si la
          vista falla (widget secundario, tolerante — ver JSDoc del componente). */}
      <BookingsPorRolearSection />

      {/* Prefijos restringidos en stock (B6) — mismo patrón tolerante, DESPUÉS de
          bookings (ver JSDoc del componente). */}
      <PrefijosRestringidosSection />

      {/* filtro de presentación por semáforo + leyenda del umbral (si está disponible) */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginBottom: 12 }}>
        <Field label="semáforo" htmlFor="alertas-filtro">
          <Select
            id="alertas-filtro"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as SemaforoFilter)}
            style={{ minWidth: 200 }}
          >
            {FILTROS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
        {umbral != null && (
          <p style={{ margin: "0 0 8px", fontSize: 11.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            rojo = freetime vencido · amarillo = quedan ≤ {umbral} día{umbral === 1 ? "" : "s"} (umbral configurable en
            Admin) · verde = dentro del freetime · sin tarifa = la naviera no cobra detention o falta tarifa vigente
          </p>
        )}
      </div>

      <DataTable
        columns={cols}
        rows={visibles}
        rowKey={(r) => r.operacion_id}
        semaforo={(r) => r.estado_semaforo}
        loading={loading}
        skeletonRows={8}
        pageSize={15}
        maxHeight={560}
        defaultSort={{ key: "dias_restantes", dir: "asc" }}
        onRowClick={(r) => router.push(`/contenedores/${r.contenedor_id}`)}
        errorState={
          loadError ? (
            <ErrorState title="No se pudieron cargar las alertas" detail={loadError} onRetry={() => void load()} />
          ) : undefined
        }
        emptyState={
          filtro !== "todos" && (rows?.length ?? 0) > 0 ? (
            <EmptyState icon="ti-filter" title={`Sin alertas en «${filtroLabel.toLowerCase()}»`}>
              Hay {rows!.length} operaci{rows!.length === 1 ? "ón" : "ones"} en seguimiento, pero ninguna con este
              semáforo. Cambiá el filtro a <strong>Todos</strong> para ver la lista completa.
            </EmptyState>
          ) : (
            <EmptyState icon="ti-bell" title="No hay operaciones en seguimiento">
              Acá aparece cada contenedor con ciclo abierto (retirado y todavía sin devolver ni embarcar), con sus días
              de freetime y el costo proyectado de detention — semáforo verde/amarillo/rojo según el umbral configurable
              en <strong>Admin</strong>. Los ciclos se crean desde la solapa <strong>Ingreso</strong>; al cerrarse desde{" "}
              <strong>Egreso</strong> salen de esta lista.
            </EmptyState>
          )
        }
      />
    </>
  );
}

// useSearchParams exige un límite de Suspense en build estático (Next 16 — ver AGENTS.md);
// el fallback repite el esqueleto de la propia tabla, nunca un spinner de página.
export default function AlertasPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Alertas" />
          <DataTable columns={[]} rows={[]} rowKey={() => ""} loading skeletonRows={8} maxHeight={560} />
        </>
      }
    >
      <AlertasPageContent />
    </Suspense>
  );
}
