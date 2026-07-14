"use client";

// Contenedores (M5): planilla de operaciones — una fila = un ciclo (retiro→devolución),
// con el contenedor embebido — + búsqueda global server-side.
// - Filtro de estado: abiertas (default) / todas / cerradas / anuladas.
// - Búsqueda con debounce 300ms y mínimo 2 caracteres, SIEMPRE en el servidor (ilike
//   sobre índices trigram): PostgREST no permite OR entre columna raíz y embebida en
//   una sola query → dos queries en paralelo (root: orden/bookings; foreign: número de
//   contenedor con embed !inner) mergeadas por id. Merge/dedup es mecánico, no negocio.
// - Fila clickeable → ficha /contenedores/{contenedor.id}.
// Patrón de página del repo (espejo de /ingreso, /egreso): load() callback, refetch al
// recuperar foco, 4 estados en la tabla. RLS scopea por planta — acá no se re-filtra.
// CERO cálculo de negocio: días/costos/semáforos llegan recién con las views de M6.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { ContainerNumber } from "@/components/container-number";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { Field, Input, Select } from "@/components/fd/fields";
import { PageHeader } from "@/components/fd/page-header";
import { fmtFecha } from "@/lib/format";
import { normalizarNumero } from "@/lib/iso6346";
import { getSupabase } from "@/lib/supabase";
import { EstadoCargaBadge, EstadoOperacionBadge } from "./estado-operacion";

type ContenedorEmbed = {
  id: string;
  numero_contenedor: string;
  tipo: string;
  reforzado_estado: string;
  naviera: { nombre: string } | null;
};

type PlanillaRow = {
  id: string;
  estado: string;
  // informativo (M5-029, D3): lleno/vacío — NO afecta tarifa ni freetime.
  estado_carga: string;
  fecha_retiro: string;
  booking_retiro: string | null;
  orden: string | null;
  booking_asignado: string | null;
  contenedor: ContenedorEmbed | null;
  planta_actual: { nombre: string } | null;
};

type EstadoFilter = "abiertas" | "todas" | "cerradas" | "anuladas";

const FILTROS: { value: EstadoFilter; label: string }[] = [
  { value: "abiertas", label: "Abiertas (en circulación)" },
  { value: "todas", label: "Todas" },
  { value: "cerradas", label: "Cerradas" },
  { value: "anuladas", label: "Anuladas" },
];

const ESTADOS_ABIERTOS = ["en_transito_a_planta", "en_planta", "en_transito_a_terminal"];

// cap de fetch: la paginación visible es client-side (DataTable); si se toca el cap,
// el contador lo avisa y la búsqueda refina server-side.
const FETCH_CAP = 500;

// !inner en el embed: obligatorio para que el filtro ilike sobre la columna embebida
// (numero_contenedor) filtre las filas raíz, no solo el embed.
const SELECT_PLANILLA =
  "id, estado, estado_carga, fecha_retiro, booking_retiro, orden, booking_asignado, contenedor:contenedores!inner(id, numero_contenedor, tipo, reforzado_estado, naviera:navieras(nombre)), planta_actual:plantas(nombre)";

function basePlanillaQuery(filtro: EstadoFilter) {
  let q = getSupabase().from("operaciones").select(SELECT_PLANILLA);
  if (filtro === "abiertas") q = q.in("estado", ESTADOS_ABIERTOS);
  else if (filtro === "cerradas") q = q.eq("estado", "cerrado");
  else if (filtro === "anuladas") q = q.eq("estado", "anulada");
  return q;
}

const EMPTY_COPY: Record<EstadoFilter, { title: string; body: React.ReactNode }> = {
  abiertas: {
    title: "No hay operaciones abiertas",
    body: (
      <>
        La planilla muestra una fila por ciclo de contenedor: desde el retiro en depósito hasta la devolución o el
        embarque. Los ciclos se crean desde la solapa <strong>Ingreso</strong> con una tanda de retiro — apenas cargues
        una, sus contenedores aparecen acá y podés abrir la ficha de cada uno con un click.
      </>
    ),
  },
  todas: {
    title: "Todavía no hay operaciones",
    body: (
      <>
        Acá aparece cada ciclo de contenedor del sistema, abierto o cerrado. Los ciclos se crean desde la solapa{" "}
        <strong>Ingreso</strong> con una tanda de retiro.
      </>
    ),
  },
  cerradas: {
    title: "No hay operaciones cerradas",
    body: (
      <>
        Una operación se cierra al confirmar la devolución del vacío o la llegada a terminal desde la solapa{" "}
        <strong>Egreso</strong> — ese cierre corta el freetime. Las cerradas quedan listadas acá como historial.
      </>
    ),
  },
  anuladas: {
    title: "No hay operaciones anuladas",
    body: (
      <>
        Una operación anulada es un ciclo cargado por error que un supervisor o administrador dio de baja con motivo
        (desde la ficha del contenedor). Queda acá como registro, fuera de la planilla de abiertas.
      </>
    ),
  },
};

export default function ContenedoresPage() {
  const router = useRouter();

  const [filtro, setFiltro] = useState<EstadoFilter>("abiertas");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [rows, setRows] = useState<PlanillaRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // anti-carrera del debounce: si una respuesta llega después de que se disparó otra
  // búsqueda, se descarta (mecánico — evita pisar resultados nuevos con viejos).
  const reqIdRef = useRef(0);

  // debounce 300ms: el término efectivo (search) va detrás del input crudo
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  // término saneado para la gramática or=() de PostgREST (coma/paréntesis/comillas la
  // rompen) — remover caracteres es saneo de sintaxis, no lógica de negocio.
  const sane = search.trim().replace(/[,()"'\\*]/g, "");
  const searchActive = sane.length >= 2;

  const load = useCallback(async () => {
    const rid = ++reqIdRef.current;
    let nextRows: PlanillaRow[] | null = null;
    let nextError: string | null = null;

    if (!searchActive) {
      const { data, error } = await basePlanillaQuery(filtro)
        .order("fecha_retiro", { ascending: false })
        .limit(FETCH_CAP);
      if (error) nextError = error.message;
      else nextRows = data as unknown as PlanillaRow[];
    } else {
      // dos queries en paralelo (root + foreign), ambas con el filtro de estado activo
      const [root, foreign] = await Promise.all([
        basePlanillaQuery(filtro)
          .or(`orden.ilike.*${sane}*,booking_retiro.ilike.*${sane}*,booking_asignado.ilike.*${sane}*`)
          .order("fecha_retiro", { ascending: false })
          .limit(FETCH_CAP),
        basePlanillaQuery(filtro)
          .ilike("contenedor.numero_contenedor", `%${normalizarNumero(sane)}%`)
          .order("fecha_retiro", { ascending: false })
          .limit(FETCH_CAP),
      ]);
      if (root.error || foreign.error) {
        nextError = (root.error ?? foreign.error)!.message;
      } else {
        // merge por id (dedup) + orden desc por fecha_retiro — ISO ordena lexicográfico
        const byId = new Map<string, PlanillaRow>();
        for (const r of [...(root.data as unknown as PlanillaRow[]), ...(foreign.data as unknown as PlanillaRow[])]) {
          byId.set(r.id, r);
        }
        nextRows = [...byId.values()].sort((a, b) => (a.fecha_retiro < b.fecha_retiro ? 1 : a.fecha_retiro > b.fecha_retiro ? -1 : 0));
      }
    }

    if (rid !== reqIdRef.current) return; // llegó tarde: hay otra búsqueda en vuelo
    if (nextError) {
      setRows(null);
      setLoadError(nextError);
    } else {
      setLoadError(null);
      setRows(nextRows);
    }
  }, [filtro, sane, searchActive]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // refetch al recuperar foco (mismo criterio que /ingreso, /egreso y la campana §13)
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const loading = rows === null && !loadError;

  const cols: Column<PlanillaRow>[] = [
    {
      key: "contenedor",
      header: "contenedor",
      render: (r) => (r.contenedor ? <ContainerNumber value={r.contenedor.numero_contenedor} /> : "—"),
      sortValue: (r) => r.contenedor?.numero_contenedor ?? null,
    },
    {
      key: "naviera",
      header: "naviera",
      render: (r) => r.contenedor?.naviera?.nombre ?? "—",
      sortValue: (r) => r.contenedor?.naviera?.nombre ?? null,
      hideOnMobile: true,
    },
    {
      key: "tipo",
      header: "tipo",
      render: (r) => r.contenedor?.tipo ?? "—",
      sortValue: (r) => r.contenedor?.tipo ?? null,
      hideOnMobile: true,
    },
    {
      key: "estado",
      header: "estado",
      render: (r) => <EstadoOperacionBadge estado={r.estado} />,
      sortValue: (r) => r.estado,
    },
    {
      key: "carga",
      header: "carga",
      render: (r) => <EstadoCargaBadge estadoCarga={r.estado_carga} />,
      sortValue: (r) => r.estado_carga,
      hideOnMobile: true,
    },
    {
      key: "planta",
      header: "planta",
      render: (r) => r.planta_actual?.nombre ?? "—",
      sortValue: (r) => r.planta_actual?.nombre ?? null,
    },
    {
      key: "fecha_retiro",
      header: "fecha retiro",
      numeric: true,
      render: (r) => fmtFecha(r.fecha_retiro),
      sortValue: (r) => r.fecha_retiro,
    },
    {
      key: "booking_retiro",
      header: "booking retiro",
      render: (r) => (r.booking_retiro ? <span className="mono">{r.booking_retiro}</span> : "—"),
      sortValue: (r) => r.booking_retiro,
      hideOnMobile: true,
    },
    {
      key: "orden",
      header: "orden",
      render: (r) => (r.orden ? <span className="mono">{r.orden}</span> : "—"),
      sortValue: (r) => r.orden,
      hideOnMobile: true,
    },
  ];

  const count = rows?.length ?? null;
  const filtroLabel = FILTROS.find((f) => f.value === filtro)!.label;

  return (
    <>
      <PageHeader
        title="Contenedores"
        counters={
          count != null ? (
            <>
              <Badge tone="neutro" mono icon="ti-list-details">
                {count} operaci{count === 1 ? "ón" : "ones"}
              </Badge>
              {count >= FETCH_CAP && (
                <Badge tone="amarillo" icon="ti-alert-triangle">
                  se muestran las primeras {FETCH_CAP} — refiná con la búsqueda
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

      {/* búsqueda global + filtro de estado */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <Field
            label="búsqueda global"
            htmlFor="cont-search"
            hint="contenedor, booking (retiro o asignado) u orden — mínimo 2 caracteres"
          >
            <Input
              id="cont-search"
              value={searchInput}
              placeholder="MSKU1234565, booking, orden…"
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </Field>
        </div>
        <Field label="estado" htmlFor="cont-filtro">
          <Select
            id="cont-filtro"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as EstadoFilter)}
            style={{ minWidth: 190 }}
          >
            {FILTROS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <DataTable
        columns={cols}
        rows={rows ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        skeletonRows={8}
        pageSize={15}
        maxHeight={560}
        defaultSort={{ key: "fecha_retiro", dir: "desc" }}
        onRowClick={(r) => {
          if (r.contenedor) router.push(`/contenedores/${r.contenedor.id}`);
        }}
        errorState={
          loadError ? (
            <ErrorState
              title="No se pudo cargar la planilla"
              detail={loadError}
              onRetry={() => void load()}
            />
          ) : undefined
        }
        emptyState={
          searchActive ? (
            <EmptyState icon="ti-search" title={`Sin resultados para «${sane}»`}>
              La búsqueda cubre número de contenedor, booking de retiro, booking asignado y orden — siempre dentro del
              filtro de estado activo ({filtroLabel.toLowerCase()}). Probá con otro término o cambiá el filtro a{" "}
              <strong>Todas</strong>.
            </EmptyState>
          ) : (
            <EmptyState icon="ti-list-details" title={EMPTY_COPY[filtro].title}>
              {EMPTY_COPY[filtro].body}
            </EmptyState>
          )
        }
      />
    </>
  );
}
