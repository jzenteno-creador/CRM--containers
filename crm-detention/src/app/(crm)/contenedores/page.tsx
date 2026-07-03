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

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/session-context";
import { Cargando, Vacio, ErrorMsg, Paginacion } from "@/components/ui";
import { fmtFecha, ESTADO_LABELS } from "@/lib/format";
import type { Naviera, OperacionEstado, Planta, ReforzadoEstado } from "@/lib/types";

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
          ? ""
          : " badge-accent";
  return <span className={`badge${extra}`}>{ESTADO_LABELS[estado] ?? estado}</span>;
}

function CeldaReforzado({ estado }: { estado: ReforzadoEstado }) {
  switch (estado) {
    case "confirmado_reforzado":
      return (
        <span className="chip chip-success" title="confirmado reforzado">
          <i className="ti ti-check" aria-hidden /> sí
        </span>
      );
    case "confirmado_no_reforzado":
      return (
        <span className="chip" title="confirmado no reforzado">
          <i className="ti ti-x" aria-hidden /> no
        </span>
      );
    case "discrepancia":
      return <span className="badge badge-danger">discrepancia</span>;
    default:
      return <span className="badge">pendiente</span>;
  }
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

  // datos
  const [filas, setFilas] = useState<FilaOperacion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setFilas((data ?? []) as unknown as FilaOperacion[]);
        setTotal(count ?? 0);
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
        setFilas(merged.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "error al cargar la planilla");
    } finally {
      setCargando(false);
    }
  }, [q, page, buildBase]);

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
        { event: "*", schema: "public", table: "operaciones" },
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

  return (
    <div>
      <div className="crm-card">
        <h4>
          <i className="ti ti-list-details" aria-hidden /> planilla de contenedores
        </h4>

        <div className="filters">
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

        {esOperador && (
          <p className="note">
            <i className="ti ti-map-pin" aria-hidden /> viendo solo operaciones en tu planta:{" "}
            {session.plantaNombre ?? "—"}
          </p>
        )}

        {error && <ErrorMsg msg={error} onRetry={() => void fetchFilas()} />}
        {cargando && !error && <Cargando msg="cargando planilla…" />}
        {!cargando && !error && filas.length === 0 && (
          <Vacio msg="sin operaciones para los filtros elegidos" />
        )}

        {!cargando && !error && filas.length > 0 && (
          <>
            <div className="tblwrap">
              <table className="t">
                <thead>
                  <tr>
                    <th>n° contenedor</th>
                    <th>naviera</th>
                    <th>tipo</th>
                    <th>planta</th>
                    <th>estado</th>
                    <th>fecha retiro</th>
                    <th>reforzado</th>
                    <th aria-label="acciones" />
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.id}>
                      <td className="mono">
                        <Link href={`/contenedores/${f.id}`}>
                          {f.contenedores.numero_contenedor}
                        </Link>
                      </td>
                      <td>{f.contenedores.navieras?.nombre ?? "—"}</td>
                      <td>{f.contenedores.tipo}</td>
                      <td>{f.plantas?.nombre ?? "—"}</td>
                      <td>
                        <BadgeEstado estado={f.estado} />
                      </td>
                      <td>{fmtFecha(f.fecha_retiro)}</td>
                      <td>
                        <CeldaReforzado estado={f.contenedores.reforzado_estado} />
                      </td>
                      <td>
                        <Link href={`/contenedores/${f.id}`} title="ver ficha">
                          <i className="ti ti-file-description" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacion page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
            {q && total >= SEARCH_CAP && (
              <p className="note">
                la búsqueda muestra hasta {SEARCH_CAP} resultados por criterio — refiná el término
                si no encontrás lo que buscás
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
