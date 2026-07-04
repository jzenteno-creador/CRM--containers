"use client";

// Fase 2 · Pendientes de ingreso a planta: retiros en tránsito largo,
// confirmación en lote vía RPC + realtime sobre operaciones.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/session-context";
import { Cargando, Vacio, ErrorMsg, Paginacion } from "@/components/ui";
import { ContainerNumber } from "@/components/container-number";
import { hoyAR, fmtFecha, diasDesde } from "@/lib/format";
import { mensajeDeError } from "./errores";

const PAGE_SIZE = 50;

interface Movimiento {
  planta_destino_id: string;
  medio: string;
  estado: string;
  plantas: { nombre: string } | null;
}

interface PendienteRow {
  id: string;
  retiro_de: string;
  fecha_retiro: string;
  contenedores: { numero_contenedor: string; navieras: { nombre: string } | null } | null;
  movimientos_planta: Movimiento[];
}

function movEnTransito(r: PendienteRow): Movimiento | null {
  const movs = r.movimientos_planta ?? [];
  return movs.find((m) => m.estado === "en_transito") ?? movs[0] ?? null;
}

export function FasePendientes({ refreshTick }: { refreshTick: number }) {
  const session = useSession();

  const [rows, setRows] = useState<PendienteRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sel, setSel] = useState<Set<string>>(new Set());
  const [fechaLlegada, setFechaLlegada] = useState(hoyAR());
  const [medio, setMedio] = useState<"camion" | "tren">("camion");

  const [enviando, setEnviando] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const desde = page * PAGE_SIZE;
    const { data, error, count } = await supabase
      .from("operaciones")
      .select(
        "id, retiro_de, fecha_retiro, contenedores(numero_contenedor, navieras(nombre)), movimientos_planta(planta_destino_id, medio, estado, plantas!movimientos_planta_planta_destino_id_fkey(nombre))",
        { count: "exact" }
      )
      .eq("estado", "en_transito_a_planta")
      .order("fecha_retiro", { ascending: true })
      .range(desde, desde + PAGE_SIZE - 1);
    if (error) {
      setError(error.message);
    } else {
      setRows((data ?? []) as unknown as PendienteRow[]);
      setTotal(count ?? 0);
    }
    setCargando(false);
  }, [page]);

  useEffect(() => {
    setCargando(true);
    void cargar();
  }, [cargar, refreshTick]);

  // Realtime: cualquier cambio en operaciones → refetch (sin recrear el canal)
  const cargarRef = useRef(cargar);
  useEffect(() => {
    cargarRef.current = cargar;
  }, [cargar]);
  useEffect(() => {
    const ch = supabase
      .channel("ingreso-pendientes-operaciones")
      .on("postgres_changes", { event: "*", schema: "detention", table: "operaciones" }, () => {
        void cargarRef.current();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  // Operador → solo tandas cuyo movimiento en tránsito apunta a su planta
  const visibles = useMemo(() => {
    if (session.rol !== "operador" || !session.plantaId) return rows;
    return rows.filter((r) => movEnTransito(r)?.planta_destino_id === session.plantaId);
  }, [rows, session.rol, session.plantaId]);

  const todasSeleccionadas = visibles.length > 0 && visibles.every((r) => sel.has(r.id));

  function toggleTodas(checked: boolean) {
    setSel(checked ? new Set(visibles.map((r) => r.id)) : new Set());
  }

  function toggleUna(id: string, checked: boolean) {
    setSel((s) => {
      const next = new Set(s);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function confirmarIngreso() {
    setOkMsg(null);
    setErrMsg(null);
    const ids = [...sel];
    if (ids.length === 0) return setErrMsg("seleccioná al menos una operación");
    if (!fechaLlegada) return setErrMsg("indicá la fecha de llegada");

    setEnviando(true);
    try {
      const { data, error } = await supabase.rpc("crm_confirmar_ingreso_planta", {
        p_operacion_ids: ids,
        p_fecha: `${fechaLlegada}T12:00:00-03:00`,
        p_medio: medio,
        p_usuario: session.id,
      });
      if (error) throw error;
      const n = (data as { confirmadas?: number } | null)?.confirmadas ?? ids.length;
      setOkMsg(`${n} ingresos confirmados`);
      setSel(new Set());
      await cargar();
    } catch (e) {
      setErrMsg(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="crm-card">
      <h4>
        <span className="num">2</span> Pendientes de ingreso a planta
      </h4>
      <p className="note">retiros en tránsito largo, esperando llegada.</p>

      {cargando ? (
        <Cargando msg="cargando pendientes…" />
      ) : error ? (
        <ErrorMsg msg={error} onRetry={() => void cargar()} />
      ) : visibles.length === 0 ? (
        <Vacio msg="sin retiros pendientes de ingreso" />
      ) : (
        <>
          <div className="tblwrap">
            <table className="t">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={todasSeleccionadas}
                      onChange={(e) => toggleTodas(e.target.checked)}
                      aria-label="seleccionar todas"
                    />
                  </th>
                  <th>n° contenedor</th>
                  <th>naviera</th>
                  <th>retiro de</th>
                  <th>planta destino</th>
                  <th>fecha retiro</th>
                  <th>días</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => {
                  const mov = movEnTransito(r);
                  return (
                    <tr key={r.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={sel.has(r.id)}
                          onChange={(e) => toggleUna(r.id, e.target.checked)}
                          aria-label={`seleccionar ${r.contenedores?.numero_contenedor ?? r.id}`}
                        />
                      </td>
                      <td className="mono">
                        {r.contenedores?.numero_contenedor ? (
                          <ContainerNumber value={r.contenedores.numero_contenedor} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{r.contenedores?.navieras?.nombre ?? "—"}</td>
                      <td>{r.retiro_de}</td>
                      <td>{mov?.plantas?.nombre ?? "—"}</td>
                      <td>{fmtFecha(r.fecha_retiro)}</td>
                      <td>{diasDesde(r.fecha_retiro)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginacion page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </>
      )}

      <div className="actbar">
        <div className="f">
          <label>fecha de llegada</label>
          <input type="date" value={fechaLlegada} onChange={(e) => setFechaLlegada(e.target.value)} />
        </div>
        <div className="f">
          <label>medio</label>
          <select value={medio} onChange={(e) => setMedio(e.target.value as "camion" | "tren")}>
            <option value="camion">camión</option>
            <option value="tren">tren</option>
          </select>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={enviando || sel.size === 0}
          onClick={() => void confirmarIngreso()}
        >
          <i className="ti ti-login-2" aria-hidden />{" "}
          {enviando ? "confirmando…" : `confirmar ingreso (${sel.size} seleccionados)`}
        </button>
      </div>

      {okMsg && <div className="ok">{okMsg}</div>}
      {errMsg && <div className="err">{errMsg}</div>}
    </section>
  );
}
