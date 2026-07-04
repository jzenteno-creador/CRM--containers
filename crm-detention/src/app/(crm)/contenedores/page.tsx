"use client";

// Planilla de contenedores: listado global de operaciones con filtros, búsqueda,
// paginación (50) y realtime sobre `operaciones`.
//
// Decisión de búsqueda global (documentada según brief):
// PostgREST no permite mezclar en un solo .or() columnas top-level (booking_retiro,
// booking_asignado, orden, shp) con un filtro sobre la tabla embebida
// (contenedores.numero_contenedor). Por eso, cuando hay término de búsqueda se
// disparan DOS queries en paralelo — una con .ilike sobre el embed !inner y otra
// con .or sobre las columnas propias — y se mergean por id en el cliente.
// En modo búsqueda cada query trae hasta 200 filas y la paginación es client-side
// (suficiente para la demo); sin búsqueda la paginación es server-side con
// count:'exact' y .range().

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/session-context";
import { Vacio, ErrorMsg, Paginacion, ContainerIcon } from "@/components/ui";
import { fmtFecha, fmtUSD, diasEstadia, ESTADO_LABELS } from "@/lib/format";
import { ContainerNumber } from "@/components/container-number";
import { SkeletonRowsTable } from "@/components/fd/skeleton-row";
import type { Naviera, OperacionEstado, Planta, ReforzadoEstado, VistaAlerta } from "@/lib/types";

const PAGE_SIZE = 50;
const SEARCH_CAP = 200; // tope por query en modo búsqueda (merge client-side)

const SELECT =
  "id, estado, fecha_retiro, retiro_de, booking_retiro, booking_asignado, orden, " +
  "contenedores!inner(id, numero_contenedor, tipo, reforzado_estado, naviera_id, navieras(nombre)), " +
  "plantas(nombre)";

interface FilaOperacion {
  id: string;
  estado: OperacionEstado;
  fecha_retiro: string;
  retiro_de: string | null;
  booking_retiro: string | null;
  booking_asignado: string | null;
  orden: string | null;
  contenedores: {
    id: string;
    numero_contenedor: string;
    tipo: string;
    reforzado_estado: ReforzadoEstado;
    naviera_id: string;
    navieras: { nombre: string } | null;
  };
  plantas: { nombre: string } | null;
}

function BadgeEstado({ estado }: { estado: OperacionEstado }) {
  const extra =
    estado === "anulada"
      ? " badge-danger"
      : estado === "en_planta"
        ? " badge-success"
        : estado === "cerrado"
          ? " badge-neutro"
          : " badge-accent";
  return <span className={`badge${extra}`}>{ESTADO_LABELS[estado] ?? estado}</span>;
}

export default function ContenedoresPage() {
  const session = useSession();
  const esOperador = session.rol === "operador";

  // filtros
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState(""); // término debounced
  const [fPlanta, setFPlanta] = useState("");
  const [fNaviera, setFNaviera] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [soloVacios, setSoloVacios] = useState(false);

  // catálogos para selects
  const [plantas, setPlantas] = useState<Planta[]>([]);
  const [navieras, setNavieras] = useState<Naviera[]>([]);

  // fila expandida (clic/+): detalle inline sin salir del listado
  const [abierta, setAbierta] = useState<string | null>(null);

  // datos
  const [filas, setFilas] = useState<FilaOperacion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // freetime por operación de la página (vista_alertas, read-only): dot semáforo,
  // libres/restantes/costo del artboard 2b. Cerradas/anuladas no están en la vista → "—".
  type FreetimeFila = Pick<
    VistaAlerta,
    "operacion_id" | "dias_estadia" | "dias_libres" | "dias_restantes" | "tarifa_usd_dia" | "costo_proyectado" | "estado_semaforo" | "sin_cargo"
  >;
  const [freetime, setFreetime] = useState<Map<string, FreetimeFila>>(new Map());

  const cargarFreetime = useCallback(async (rows: FilaOperacion[]) => {
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) {
      setFreetime(new Map());
      return;
    }
    const { data } = await supabase
      .from("vista_alertas")
      .select("operacion_id, dias_estadia, dias_libres, dias_restantes, tarifa_usd_dia, costo_proyectado, estado_semaforo, sin_cargo")
      .in("operacion_id", ids);
    setFreetime(new Map(((data ?? []) as FreetimeFila[]).map((a) => [a.operacion_id, a])));
  }, []);

  // debounce búsqueda (350 ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  // catálogos (una vez)
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [pRes, nRes] = await Promise.all([
        supabase.from("plantas").select("id, nombre, codigo").order("nombre"),
        supabase.from("navieras").select("id, nombre").order("nombre"),
      ]);
      if (!vivo) return;
      if (!pRes.error && pRes.data) setPlantas(pRes.data as Planta[]);
      if (!nRes.error && nRes.data) setNavieras(nRes.data as Naviera[]);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const buildBase = useCallback(() => {
    let qy = supabase.from("operaciones").select(SELECT, { count: "exact" });
    // operador → scope duro a su planta
    if (esOperador && session.plantaId) {
      qy = qy.eq("planta_actual_id", session.plantaId);
    } else if (fPlanta) {
      qy = qy.eq("planta_actual_id", fPlanta);
    }
    if (fNaviera) qy = qy.eq("contenedores.naviera_id", fNaviera);
    if (soloVacios) qy = qy.eq("estado", "en_planta");
    else if (fEstado) qy = qy.eq("estado", fEstado);
    return qy;
  }, [esOperador, session.plantaId, fPlanta, fNaviera, fEstado, soloVacios]);

  const fetchFilas = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      if (!q) {
        // sin búsqueda → paginación server-side
        const desde = page * PAGE_SIZE;
        const { data, error: err, count } = await buildBase()
          .order("fecha_retiro", { ascending: false })
          .range(desde, desde + PAGE_SIZE - 1);
        if (err) throw err;
        const rows = (data ?? []) as unknown as FilaOperacion[];
        setFilas(rows);
        setTotal(count ?? 0);
        void cargarFreetime(rows);
      } else {
        // con búsqueda → dos queries en paralelo + merge por id (ver nota al inicio)
        const safe = q.replace(/[,()]/g, " ").trim();
        const [porContenedor, porCampos] = await Promise.all([
          buildBase()
            .ilike("contenedores.numero_contenedor", `%${safe}%`)
            .order("fecha_retiro", { ascending: false })
            .range(0, SEARCH_CAP - 1),
          buildBase()
            .or(
              `booking_retiro.ilike.%${safe}%,booking_asignado.ilike.%${safe}%,orden.ilike.%${safe}%,shp.ilike.%${safe}%`,
            )
            .order("fecha_retiro", { ascending: false })
            .range(0, SEARCH_CAP - 1),
        ]);
        if (porContenedor.error) throw porContenedor.error;
        if (porCampos.error) throw porCampos.error;
        const mapa = new Map<string, FilaOperacion>();
        for (const fila of [
          ...((porContenedor.data ?? []) as unknown as FilaOperacion[]),
          ...((porCampos.data ?? []) as unknown as FilaOperacion[]),
        ]) {
          mapa.set(fila.id, fila);
        }
        const merged = Array.from(mapa.values()).sort((a, b) =>
          a.fecha_retiro < b.fecha_retiro ? 1 : a.fecha_retiro > b.fecha_retiro ? -1 : 0,
        );
        setTotal(merged.length);
        const pageRows = merged.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        setFilas(pageRows);
        void cargarFreetime(pageRows);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "error al cargar la planilla");
    } finally {
      setCargando(false);
    }
  }, [q, page, buildBase, cargarFreetime]);

  useEffect(() => {
    void fetchFilas();
  }, [fetchFilas]);

  // realtime: refetch ante cualquier cambio en operaciones (ref para no resuscribir)
  const refetchRef = useRef(fetchFilas);
  useEffect(() => {
    refetchRef.current = fetchFilas;
  }, [fetchFilas]);
  useEffect(() => {
    const ch = supabase
      .channel("contenedores-planilla")
      .on(
        "postgres_changes",
        { event: "*", schema: "detention", table: "operaciones" },
        () => {
          void refetchRef.current();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  const resetPagina = () => setPage(0);

  // chips de filtros activos — representación removible de los estados existentes (cero lógica nueva)
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (q) chips.push({ key: "q", label: `búsqueda: ${q}`, clear: () => setQInput("") });
  if (fPlanta)
    chips.push({
      key: "planta",
      label: `planta: ${plantas.find((p) => p.id === fPlanta)?.nombre ?? fPlanta}`,
      clear: () => {
        setFPlanta("");
        resetPagina();
      },
    });
  if (fNaviera)
    chips.push({
      key: "naviera",
      label: `naviera: ${navieras.find((n) => n.id === fNaviera)?.nombre ?? fNaviera}`,
      clear: () => {
        setFNaviera("");
        resetPagina();
      },
    });
  if (fEstado && !soloVacios)
    chips.push({
      key: "estado",
      label: `estado: ${ESTADO_LABELS[fEstado as OperacionEstado] ?? fEstado}`,
      clear: () => {
        setFEstado("");
        resetPagina();
      },
    });
  if (soloVacios)
    chips.push({
      key: "vacios",
      label: "solo stock de vacíos",
      clear: () => {
        setSoloVacios(false);
        resetPagina();
      },
    });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <ContainerIcon size={17} />
        <h2 className="fd-display" style={{ margin: 0, fontSize: 15 }}>
          planilla de contenedores
        </h2>
        <span className="pill mono">{total.toLocaleString("es-AR")} operaciones</span>
        <span style={{ flex: 1 }} />
        <Link
          href="/ingreso"
          className="btn-primary"
          style={{ padding: "7px 12px", borderRadius: 9, textDecoration: "none", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <i className="ti ti-plus" aria-hidden /> Registrar retiro
        </Link>
      </div>

      <div className="fd-panel">
        <div className="fd-panel-body" style={{ paddingBottom: 8 }}>
        <div className="filters" style={{ marginBottom: chips.length ? 8 : 0 }}>
          <input
            type="search"
            placeholder="buscar contenedor, orden, booking…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            style={{ minWidth: 230, flex: "1 1 230px" }}
            aria-label="búsqueda global"
          />
          {!esOperador && (
            <select
              value={fPlanta}
              onChange={(e) => {
                setFPlanta(e.target.value);
                resetPagina();
              }}
              aria-label="filtro planta"
            >
              <option value="">todas las plantas</option>
              {plantas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          )}
          <select
            value={fNaviera}
            onChange={(e) => {
              setFNaviera(e.target.value);
              resetPagina();
            }}
            aria-label="filtro naviera"
          >
            <option value="">todas las navieras</option>
            {navieras.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nombre}
              </option>
            ))}
          </select>
          <select
            value={fEstado}
            onChange={(e) => {
              setFEstado(e.target.value);
              resetPagina();
            }}
            disabled={soloVacios}
            aria-label="filtro estado"
          >
            <option value="">todos los estados</option>
            {Object.entries(ESTADO_LABELS).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
          <label className="toggle" style={{ marginTop: 0 }}>
            <input
              type="checkbox"
              checked={soloVacios}
              onChange={(e) => {
                setSoloVacios(e.target.checked);
                resetPagina();
              }}
            />
            solo stock de vacíos
          </label>
        </div>

        {chips.length > 0 && (
          <div className="filters" style={{ marginBottom: 0 }}>
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={c.clear}
                className="chip"
                style={{
                  color: "var(--text-accent)",
                  borderColor: "var(--border-accent)",
                  background: "var(--bg-accent)",
                  cursor: "pointer",
                }}
                title="quitar filtro"
              >
                {c.label} <i className="ti ti-x" aria-hidden style={{ fontSize: 11 }} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setQInput("");
                setFPlanta("");
                setFNaviera("");
                setFEstado("");
                setSoloVacios(false);
                resetPagina();
              }}
              style={{ border: "none", background: "transparent", fontSize: 12, color: "var(--text-muted)" }}
            >
              limpiar filtros
            </button>
          </div>
        )}

        {esOperador && (
          <p className="note">
            <i className="ti ti-map-pin" aria-hidden /> viendo solo operaciones en tu planta:{" "}
            {session.plantaNombre ?? "—"}
          </p>
        )}
        </div>

        {error && (
          <div style={{ padding: "0 16px 12px" }}>
            <ErrorMsg msg={error} onRetry={() => void fetchFilas()} />
          </div>
        )}
        {!cargando && !error && filas.length === 0 && (
          <Vacio msg="sin operaciones para los filtros elegidos" />
        )}

        {!error && (cargando || filas.length > 0) && (
          <>
            <div className="tblwrap" style={{ border: "none", borderRadius: 0, background: "transparent" }}>
              <table className="t">
                <thead>
                  <tr>
                    <th aria-label="semáforo" style={{ width: 30 }} />
                    <th>n° contenedor</th>
                    <th className="hide-sm">naviera</th>
                    <th className="hide-sm">tipo</th>
                    <th className="hide-sm">posición</th>
                    <th className="hide-sm">estado ciclo</th>
                    <th className="hide-sm">retiro</th>
                    <th>estadía</th>
                    <th className="hide-sm">libres</th>
                    <th>restantes</th>
                    <th>costo proy.</th>
                    <th aria-label="acciones" className="hide-sm" />
                  </tr>
                </thead>
                <tbody>
                  {cargando && <SkeletonRowsTable cols={12} rows={8} />}
                  {!cargando && filas.map((f) => {
                    const abiertaEsta = abierta === f.id;
                    const ft = freetime.get(f.id);
                    return (
                      <Fragment key={f.id}>
                        <tr
                          className="expandible"
                          aria-expanded={abiertaEsta}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest("a")) return;
                            setAbierta(abiertaEsta ? null : f.id);
                          }}
                        >
                          <td style={{ width: 30 }}>
                            {ft ? (
                              <span className={`dot dot-${ft.estado_semaforo}`} />
                            ) : (
                              <span className="dot dot-neutro" style={{ opacity: 0.35 }} />
                            )}
                          </td>
                          <td className="mono">
                            <Link href={`/contenedores/${f.id}`} style={{ textDecoration: "none" }}>
                              <ContainerNumber value={f.contenedores.numero_contenedor} />
                            </Link>
                          </td>
                          <td className="hide-sm">{f.contenedores.navieras?.nombre ?? "—"}</td>
                          <td className="hide-sm">{f.contenedores.tipo}</td>
                          <td className="hide-sm">{f.plantas?.nombre ?? "—"}</td>
                          <td className="hide-sm">
                            <BadgeEstado estado={f.estado} />
                          </td>
                          <td className="mono hide-sm">{fmtFecha(f.fecha_retiro)}</td>
                          <td className="mono">
                            {/* dwell siempre visible en abiertas (retiro = día 1, zona AR) */}
                            {ft?.dias_estadia ??
                              (f.estado === "cerrado" || f.estado === "anulada"
                                ? "—"
                                : diasEstadia(f.fecha_retiro))}
                          </td>
                          <td className="mono hide-sm">{ft?.dias_libres ?? "—"}</td>
                          <td
                            className="mono"
                            style={{
                              color:
                                ft?.estado_semaforo === "rojo"
                                  ? "var(--text-danger)"
                                  : ft?.estado_semaforo === "amarillo"
                                    ? "var(--text-warning)"
                                    : undefined,
                            }}
                          >
                            {ft?.dias_restantes ?? "—"}
                          </td>
                          <td className="mono">
                            {ft && ft.costo_proyectado != null ? (
                              Number(ft.costo_proyectado) > 0 ? (
                                <span className="fd-usd">{fmtUSD(ft.costo_proyectado)}</span>
                              ) : (
                                <span style={{ color: "var(--text-muted)" }}>
                                  USD 0{ft.sin_cargo ? " · s/c" : ""}
                                </span>
                              )
                            ) : (
                              <span style={{ color: "var(--color-text-faint)" }}>—</span>
                            )}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }} className="hide-sm">
                            <button
                              type="button"
                              className="ft-plus"
                              title={abiertaEsta ? "cerrar detalle" : "ver detalle"}
                              aria-label={abiertaEsta ? "cerrar detalle" : "ver detalle"}
                            >
                              {abiertaEsta ? "−" : "+"}
                            </button>
                          </td>
                        </tr>
                        {abiertaEsta && (
                          <tr>
                            <td colSpan={12} style={{ padding: "4px 8px 10px" }}>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                                  gap: "10px 18px",
                                  padding: "12px 14px",
                                  background: "var(--surface-1)",
                                  borderRadius: "var(--radius)",
                                }}
                              >
                                {(
                                  [
                                    ["retiro de", f.retiro_de ?? "—"],
                                    ["fecha retiro", fmtFecha(f.fecha_retiro)],
                                    ["booking retiro", f.booking_retiro ?? "—"],
                                    ["booking asignado", f.booking_asignado ?? "—"],
                                    ["orden", f.orden ?? "—"],
                                    ["planta", f.plantas?.nombre ?? "—"],
                                    [
                                      "tipo",
                                      `${f.contenedores.tipo} · ${
                                        f.contenedores.reforzado_estado === "confirmado_reforzado"
                                          ? "reforzado"
                                          : f.contenedores.reforzado_estado === "confirmado_no_reforzado"
                                            ? "no reforzado"
                                            : f.contenedores.reforzado_estado
                                      }`,
                                    ],
                                  ] as const
                                ).map(([k, v]) => (
                                  <div key={k} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    <span
                                      style={{
                                        fontSize: 10.5,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.06em",
                                        color: "var(--text-muted)",
                                      }}
                                    >
                                      {k}
                                    </span>
                                    <span className="mono" style={{ fontSize: 12.5 }}>
                                      {v}
                                    </span>
                                  </div>
                                ))}
                                <div style={{ alignSelf: "end" }}>
                                  <Link href={`/contenedores/${f.id}`} title="ver ficha completa">
                                    ficha completa <i className="ti ti-arrow-right" aria-hidden />
                                  </Link>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "4px 16px 12px" }}>
              <Paginacion page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
              {q && total >= SEARCH_CAP && (
                <p className="note">
                  la búsqueda muestra hasta {SEARCH_CAP} resultados por criterio — refiná el término
                  si no encontrás lo que buscás
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
