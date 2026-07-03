"use client";

// Alertas de freetime — semáforo por operación abierta (vista_alertas)
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/session-context";
import { Cargando, Vacio, ErrorMsg, Semaforo, Paginacion } from "@/components/ui";
import { fmtUSD, ESTADO_LABELS } from "@/lib/format";
import type { VistaAlerta, Naviera } from "@/lib/types";

const PAGE_SIZE = 50;
const UMBRAL_DEFAULT = 3;

type FiltroSemaforo = "todos" | "verde" | "amarillo" | "rojo";

interface Kpis {
  total: number;
  vencidos: number;
  porVencer: number;
  costo: number;
}

export default function AlertasPage() {
  const session = useSession();

  const [filas, setFilas] = useState<VistaAlerta[]>([]);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState<Kpis>({ total: 0, vencidos: 0, porVencer: 0, costo: 0 });
  const [page, setPage] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [umbral, setUmbral] = useState<number>(UMBRAL_DEFAULT);
  const [navieras, setNavieras] = useState<Naviera[]>([]);
  const [fSemaforo, setFSemaforo] = useState<FiltroSemaforo>("todos");
  const [fNaviera, setFNaviera] = useState<string>("");
  // Contador de refetch: lo incrementan realtime y el botón reintentar
  const [tick, setTick] = useState(0);

  // Umbral configurable + catálogo de navieras (una sola vez)
  useEffect(() => {
    let vivo = true;
    (async () => {
      const [rCfg, rNav] = await Promise.all([
        supabase
          .from("configuracion")
          .select("valor")
          .eq("clave", "umbral_alerta_amarillo")
          .maybeSingle(),
        supabase.from("navieras").select("id, nombre").order("nombre"),
      ]);
      if (!vivo) return;
      const dias = (rCfg.data?.valor as { dias?: number } | null)?.dias;
      if (typeof dias === "number") setUmbral(dias);
      if (rNav.data) setNavieras(rNav.data as Naviera[]);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Fetch de tabla + KPIs — todos los setState quedan después de un await
  // (regla react-hooks/set-state-in-effect); el flag de carga se prende en
  // los handlers de filtros/página/reintento.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const desde = page * PAGE_SIZE;
        const hasta = desde + PAGE_SIZE - 1;

        // Tabla paginada + query liviana para KPIs sobre el mismo filtro
        let qTabla = supabase.from("vista_alertas").select("*", { count: "exact" });
        let qKpis = supabase.from("vista_alertas").select("estado_semaforo, costo_proyectado");

        // Operador → scope a su planta
        if (session.rol === "operador" && session.plantaNombre) {
          qTabla = qTabla.eq("planta_actual", session.plantaNombre);
          qKpis = qKpis.eq("planta_actual", session.plantaNombre);
        }
        if (fSemaforo !== "todos") {
          qTabla = qTabla.eq("estado_semaforo", fSemaforo);
          qKpis = qKpis.eq("estado_semaforo", fSemaforo);
        }
        if (fNaviera) {
          qTabla = qTabla.eq("naviera", fNaviera);
          qKpis = qKpis.eq("naviera", fNaviera);
        }

        const [rTabla, rKpis] = await Promise.all([
          qTabla
            .order("dias_restantes", { ascending: true })
            .order("numero_contenedor", { ascending: true })
            .range(desde, hasta),
          qKpis,
        ]);
        if (!vivo) return;

        if (rTabla.error) throw rTabla.error;
        if (rKpis.error) throw rKpis.error;

        setError(null);
        setFilas((rTabla.data ?? []) as VistaAlerta[]);
        setTotal(rTabla.count ?? 0);

        const agregado = (rKpis.data ?? []) as Pick<
          VistaAlerta,
          "estado_semaforo" | "costo_proyectado"
        >[];
        setKpis({
          total: agregado.length,
          vencidos: agregado.filter((a) => a.estado_semaforo === "rojo").length,
          porVencer: agregado.filter((a) => a.estado_semaforo === "amarillo").length,
          costo: agregado.reduce((suma, a) => suma + (a.costo_proyectado ?? 0), 0),
        });
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : "error cargando alertas");
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [page, fSemaforo, fNaviera, session.rol, session.plantaNombre, tick]);

  // Realtime: cambios en operaciones → refetch (incrementa tick)
  useEffect(() => {
    const ch = supabase
      .channel("alertas-operaciones")
      .on(
        "postgres_changes",
        { event: "*", schema: "detention", table: "operaciones" },
        () => {
          setTick((t) => t + 1);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div className="crm-card">
      <h4>
        <i className="ti ti-alert-triangle" aria-hidden /> alertas de freetime
      </h4>

      <div className="filters">
        <span className="chip">
          <span className="dot dot-verde" /> ok
        </span>
        <span className="chip">
          <span className="dot dot-amarillo" /> por vencer
        </span>
        <span className="chip">
          <span className="dot dot-rojo" /> vencido
        </span>
        <span className="chip">
          <span className="dot dot-neutro" /> sin cargo de origen
        </span>
        <span className="note" style={{ marginTop: 0 }}>
          umbral amarillo: {umbral} {umbral === 1 ? "día" : "días"} (configurable en admin)
        </span>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="l">operaciones abiertas</div>
          <div className="v">{kpis.total}</div>
        </div>
        <div className="kpi">
          <div className="l">vencidos</div>
          <div className="v" style={{ color: "var(--text-danger)" }}>
            {kpis.vencidos}
          </div>
        </div>
        <div className="kpi">
          <div className="l">por vencer</div>
          <div className="v" style={{ color: "var(--text-warning)" }}>
            {kpis.porVencer}
          </div>
        </div>
        <div className="kpi">
          <div className="l">costo proyectado</div>
          <div className="v">{fmtUSD(kpis.costo)}</div>
        </div>
      </div>

      <div className="filters">
        <div className="f">
          <label htmlFor="f-semaforo">semáforo</label>
          <select
            id="f-semaforo"
            value={fSemaforo}
            onChange={(e) => {
              setFSemaforo(e.target.value as FiltroSemaforo);
              setPage(0);
              setCargando(true);
              setError(null);
            }}
          >
            <option value="todos">todos</option>
            <option value="verde">verde</option>
            <option value="amarillo">amarillo</option>
            <option value="rojo">rojo</option>
          </select>
        </div>
        <div className="f">
          <label htmlFor="f-naviera">naviera</label>
          <select
            id="f-naviera"
            value={fNaviera}
            onChange={(e) => {
              setFNaviera(e.target.value);
              setPage(0);
              setCargando(true);
              setError(null);
            }}
          >
            <option value="">todas</option>
            {navieras.map((n) => (
              <option key={n.id} value={n.nombre}>
                {n.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <ErrorMsg
          msg={error}
          onRetry={() => {
            setCargando(true);
            setError(null);
            setTick((t) => t + 1);
          }}
        />
      )}

      {cargando ? (
        <Cargando />
      ) : filas.length === 0 && !error ? (
        <Vacio msg="sin alertas para los filtros seleccionados" />
      ) : (
        <>
          <div className="tblwrap">
            <table className="t">
              <thead>
                <tr>
                  <th>n° contenedor</th>
                  <th>naviera</th>
                  <th>planta</th>
                  <th>estado</th>
                  <th>estadía (días)</th>
                  <th>días libres</th>
                  <th>días rest.</th>
                  <th>costo proy.</th>
                  <th>semáforo</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((a) => (
                  <tr key={a.operacion_id}>
                    <td className="mono">
                      <Link href={`/contenedores/${a.operacion_id}`}>{a.numero_contenedor}</Link>
                    </td>
                    <td>{a.naviera}</td>
                    <td>{a.planta_actual ?? "—"}</td>
                    <td>{ESTADO_LABELS[a.estado] ?? a.estado}</td>
                    <td>{a.dias_estadia}</td>
                    <td>{a.dias_libres ?? "—"}</td>
                    <td>
                      {a.dias_restantes == null ? (
                        "—"
                      ) : a.dias_restantes < 0 ? (
                        <span className="badge badge-danger">{a.dias_restantes}</span>
                      ) : a.dias_restantes <= umbral ? (
                        <span className="badge">{a.dias_restantes}</span>
                      ) : (
                        a.dias_restantes
                      )}
                    </td>
                    <td>
                      {a.costo_proyectado == null ? "—" : fmtUSD(a.costo_proyectado)}
                      {a.sin_cargo && (
                        <span className="badge" style={{ marginLeft: 6 }} title="excepción de cargo (waiver)">
                          sin cargo
                        </span>
                      )}
                    </td>
                    <td>
                      <Semaforo estado={a.estado_semaforo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPage={(p) => {
              setPage(p);
              setCargando(true);
            }}
          />
        </>
      )}
    </div>
  );
}
