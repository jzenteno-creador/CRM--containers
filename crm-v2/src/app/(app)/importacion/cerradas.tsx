"use client";

// Cerradas (M5 B2 — cierre de deuda 2026-08-02): desbloquea el modal de corrección de
// fechas de una operación cerrada (CorregirFechaImpoConfirm, dentro de <AccionesPlataImpo>,
// migración 039) que estaba implementado pero era INALCANZABLE — la página de /importacion
// solo listaba los 4 estados abiertos del ciclo, así que ninguna fila cerrada llegaba nunca
// a la UI y el botón "Corregir dato de la cerrada" no tenía forma de abrirse.
//
// Mismo patrón que la sección "cerradas" de /contenedores (EXPO): historial, no cola
// operativa → CollapsibleSection colapsada por default, cap defensivo con badge, búsqueda
// SOLO por contenedor (acá client-side porque el máximo son 200 filas ya en memoria, a
// diferencia de /contenedores que busca server-side sobre miles de operaciones).
//
// Costos: crm.vista_kpi_costos_cerradas_impo (039) es la ÚNICA fuente — CERO cálculo en
// el front (AGENTS.md). "días estadía" NO es una columna directa de la view (que expone
// pares demurrage/detention/combined según el reloj del contrato, `modo_reloj`): se copia,
// SIN aritmética nueva, el par ya calculado que corresponde — mismo criterio ya establecido
// en alertas/page.tsx (mapImpo). Una fila de esta tabla siempre tiene fecha_retiro_terminal
// (si no, no estaría cerrada), así que en modo split la fase relevante es siempre detention.
//
// El caller (page.tsx) es dueño del modal <AccionesPlataImpo> — un solo modal compartido
// con la sección de pendientes — así que este componente solo arma el shape
// OperacionPlataImpo y lo entrega por callback.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { CollapsibleSection } from "@/components/fd/collapsible-section";
import { ContainerNumber } from "@/components/container-number";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { Input } from "@/components/fd/fields";
import { fmtFecha, fmtUSD } from "@/lib/format";
import { normalizarNumero } from "@/lib/iso6346";
import { getSupabase } from "@/lib/supabase";
import type { OperacionPlataImpo } from "./acciones-plata";

type CerradaBaseRow = {
  id: string;
  estado: string;
  fecha_devolucion: string | null;
  orden: { numero_orden: string; naviera: { nombre: string } | null } | null;
  contenedor: { numero_contenedor: string; tipo: string } | null;
};

// numeric-como-string posible de PostgREST (mismo contrato documentado en
// reportes/impo-section.tsx) — se normaliza SIEMPRE antes de usar.
type RawNum = string | number | null;
const toNum = (v: RawNum): number | null => (v == null ? null : Number(v));

type NumsRawCerrada = {
  operacion_impo_id: string;
  modo_reloj: string | null;
  dias_detention_transcurridos: RawNum;
  dias_combined_transcurridos: RawNum;
  exceso_total: RawNum;
  costo_realizado: RawNum;
};

// fila ya aplanada + números mergeados de la view — lo único que consume la tabla.
type CerradaRow = {
  id: string;
  estado: string;
  numeroContenedor: string;
  tipo: string;
  numeroOrden: string;
  naviera: string;
  fechaDevolucion: string | null;
  diasEstadia: number | null;
  diasExceso: number | null;
  costoNeto: number | null;
};

const SELECT_CERRADAS =
  "id, estado, fecha_devolucion, orden:ordenes_impo(numero_orden, naviera:navieras(nombre)), contenedor:contenedores(numero_contenedor, tipo)";

const VIEW_COLS_CERRADAS =
  "operacion_impo_id, modo_reloj, dias_detention_transcurridos, dias_combined_transcurridos, exceso_total, costo_realizado";

// cap defensivo (mismo criterio que FETCH_CAP de page.tsx): las cerradas son historial, no
// cola operativa — 200 alcanza sobra para el uso real; si algún día lo toca, el badge avisa
// en vez de truncar en silencio.
const FETCH_CAP = 200;

// lotes para el .in() contra la view (acota el largo de la URL — hoy es 1 sola query porque
// FETCH_CAP === IN_CHUNK, pero queda de defensa si el cap cambia sin tocar esto).
const IN_CHUNK = 200;

async function fetchNumerosCerradas(ids: string[]): Promise<Map<string, NumsRawCerrada>> {
  const map = new Map<string, NumsRawCerrada>();
  if (ids.length === 0) return map;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK));
  const results = await Promise.all(
    chunks.map((c) =>
      getSupabase().from("vista_kpi_costos_cerradas_impo").select(VIEW_COLS_CERRADAS).in("operacion_impo_id", c),
    ),
  );
  for (const res of results) {
    if (res.error || !res.data) continue; // tolerante: sin números para ese lote → "—"
    for (const row of res.data as unknown as NumsRawCerrada[]) {
      map.set(row.operacion_impo_id, row);
    }
  }
  return map;
}

// Cero aritmética nueva: se copia el par YA calculado que corresponde según modo_reloj
// (mismo criterio documentado en alertas/page.tsx mapImpo) — nada se suma, resta ni deriva.
function numerosAFila(raw: NumsRawCerrada | undefined): {
  diasEstadia: number | null;
  diasExceso: number | null;
  costoNeto: number | null;
} {
  if (!raw) return { diasEstadia: null, diasExceso: null, costoNeto: null };
  const diasEstadia =
    raw.modo_reloj === "combined" ? toNum(raw.dias_combined_transcurridos) : toNum(raw.dias_detention_transcurridos);
  return { diasEstadia, diasExceso: toNum(raw.exceso_total), costoNeto: toNum(raw.costo_realizado) };
}

export function CerradasImpo({
  onAccionesPlata,
  refreshSignal,
}: {
  /** El caller es dueño del modal compartido <AccionesPlataImpo> — acá solo se arma el
   *  shape y se entrega. */
  onAccionesPlata: (target: OperacionPlataImpo) => void;
  /** Cambiá este número (ej: contador incremental) para forzar un refetch — el caller lo
   *  bumpea cuando una acción de plata sobre una fila de ESTA lista (waiver, corrección)
   *  termina con éxito. */
  refreshSignal: number;
}) {
  const [rows, setRows] = useState<CerradaRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  // anti-carrera: si una respuesta llega después de que se disparó otro load, se descarta.
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const rid = ++reqIdRef.current;
    const { data, error } = await getSupabase()
      .from("operaciones_impo")
      .select(SELECT_CERRADAS)
      .eq("estado", "cerrado")
      .order("fecha_devolucion", { ascending: false })
      .limit(FETCH_CAP);

    if (rid !== reqIdRef.current) return; // llegó tarde: hay otro load en vuelo

    if (error) {
      setRows(null);
      setLoadError(error.message);
      return;
    }

    const base = (data as unknown as CerradaBaseRow[]) ?? [];
    const nums = await fetchNumerosCerradas(base.map((b) => b.id));
    if (rid !== reqIdRef.current) return;

    const merged: CerradaRow[] = base.map((b) => ({
      id: b.id,
      estado: b.estado,
      numeroContenedor: b.contenedor?.numero_contenedor ?? "—",
      tipo: b.contenedor?.tipo ?? "—",
      numeroOrden: b.orden?.numero_orden ?? "—",
      naviera: b.orden?.naviera?.nombre ?? "—",
      fechaDevolucion: b.fecha_devolucion,
      ...numerosAFila(nums.get(b.id)),
    }));

    setLoadError(null);
    setRows(merged);
  }, []);

  // carga inicial + cada vez que el caller pide refresh (waiver/corrección exitosos)
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load, refreshSignal]);

  // refetch al recuperar foco (mismo criterio que el resto de la página)
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const loading = rows === null && !loadError;

  const term = normalizarNumero(searchInput.trim());
  const searchActive = term.length > 0;
  const filteredRows = useMemo(() => {
    if (!rows) return [];
    if (!searchActive) return rows;
    return rows.filter((r) => normalizarNumero(r.numeroContenedor).includes(term));
  }, [rows, searchActive, term]);

  const cols: Column<CerradaRow>[] = [
    {
      key: "contenedor",
      header: "contenedor",
      // <ContainerNumber> espera el string COMPLETO real — nunca el placeholder "—" (mismo
      // guard que TablaGrupo en page.tsx; contenedor_id es NOT NULL en el schema, así que
      // esto es defensivo, no un caso esperado).
      render: (r) => (r.numeroContenedor !== "—" ? <ContainerNumber value={r.numeroContenedor} /> : "—"),
      sortValue: (r) => r.numeroContenedor,
    },
    {
      key: "tipo",
      header: "tipo",
      render: (r) => r.tipo,
      sortValue: (r) => r.tipo,
      hideOnMobile: true,
    },
    {
      key: "orden",
      header: "orden",
      render: (r) => <span className="mono">{r.numeroOrden}</span>,
      sortValue: (r) => r.numeroOrden,
      hideOnMobile: true,
    },
    {
      key: "naviera",
      header: "naviera",
      render: (r) => r.naviera,
      sortValue: (r) => r.naviera,
      hideOnMobile: true,
    },
    {
      key: "fecha_devolucion",
      header: "fecha devolución",
      numeric: true,
      render: (r) => fmtFecha(r.fechaDevolucion),
      sortValue: (r) => r.fechaDevolucion,
    },
    {
      key: "dias_estadia",
      header: "días estadía",
      numeric: true,
      render: (r) => r.diasEstadia ?? "—",
      sortValue: (r) => r.diasEstadia,
    },
    {
      key: "dias_exceso",
      header: "exceso",
      numeric: true,
      render: (r) => r.diasExceso ?? "—",
      sortValue: (r) => r.diasExceso,
    },
    {
      key: "costo_neto",
      header: "costo neto",
      numeric: true,
      render: (r) => <span style={{ fontWeight: 700 }}>{fmtUSD(r.costoNeto)}</span>,
      sortValue: (r) => r.costoNeto,
    },
    {
      key: "acciones",
      header: "",
      align: "right",
      width: "1%",
      render: (r) => (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="ghost"
            icon="ti-cash"
            onClick={() =>
              onAccionesPlata({
                id: r.id,
                estado: r.estado,
                numeroContenedor: r.numeroContenedor,
                numeroOrden: r.numeroOrden,
              })
            }
            style={{ minHeight: 0, padding: "4px 8px", fontSize: 12 }}
            aria-label={`acciones de plata ${r.numeroContenedor} (orden ${r.numeroOrden})`}
          >
            Plata
          </Button>
        </div>
      ),
    },
  ];

  const atCap = (rows?.length ?? 0) >= FETCH_CAP;

  return (
    <CollapsibleSection title="Cerradas" icon="ti-archive" count={rows == null ? null : rows.length} defaultOpen={false}>
      {/* búsqueda chica por contenedor + cap defensivo — arriba de la tabla en vez de
          dentro del <button> del header de arriba (header nativo, un <input> adentro
          rompería el toggle y sería HTML inválido: botón anidando control interactivo). */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ position: "relative", width: 220, maxWidth: "100%" }}>
          <i
            className="ti ti-search"
            aria-hidden
            style={{
              position: "absolute",
              left: 9,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-faint)",
              fontSize: 13,
              pointerEvents: "none",
            }}
          />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="buscar contenedor…"
            aria-label="buscar en cerradas por número de contenedor"
            style={{ paddingLeft: 28, width: "100%", fontSize: 12.5 }}
          />
        </div>
        {atCap && (
          <Badge tone="amarillo" icon="ti-alert-triangle">
            mostrando las primeras {FETCH_CAP}
          </Badge>
        )}
      </div>

      <DataTable
        columns={cols}
        rows={filteredRows}
        rowKey={(r) => r.id}
        loading={loading}
        skeletonRows={4}
        pageSize={15}
        maxHeight={420}
        defaultSort={{ key: "fecha_devolucion", dir: "desc" }}
        errorState={
          loadError ? (
            <ErrorState
              title="No se pudieron cargar las operaciones cerradas"
              detail={loadError}
              onRetry={() => void load()}
            />
          ) : undefined
        }
        emptyState={
          searchActive ? (
            <EmptyState icon="ti-search-off" title={`Sin resultados para «${searchInput.trim()}»`}>
              Probá con otro número de contenedor.
            </EmptyState>
          ) : (
            <EmptyState icon="ti-archive" title="Todavía no hay operaciones cerradas">
              Acá aparece cada ciclo de importación una vez que confirmás su devolución (grupo{" "}
              <strong>En tránsito a devolución</strong> más arriba) — funciona como historial. Desde el botón{" "}
              <strong>Plata</strong> de cada fila podés registrar un waiver posterior al cierre o corregir una fecha
              mal cargada.
            </EmptyState>
          )
        }
      />
    </CollapsibleSection>
  );
}
