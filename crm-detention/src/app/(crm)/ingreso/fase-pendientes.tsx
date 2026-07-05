"use client";

// Fase 2 · Pendientes de ingreso a planta: retiros en tránsito largo,
// confirmación en lote vía RPC + realtime sobre operaciones.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/session-context";
import { Vacio, ErrorMsg, Paginacion } from "@/components/ui";
import { ContainerNumber } from "@/components/container-number";
import { SkeletonRowsTable } from "@/components/fd/skeleton-row";
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

  // Operador con planta asignada → el filtro de planta va en el query (embed !inner)
  // para que count y paginación cuenten solo SUS pendientes, no los de todas las plantas.
  const plantaOperadorId = session.rol === "operador" ? session.plantaId : null;
  const esOperador = !!plantaOperadorId;

  const cargar = useCallback(async () => {
    setError(null);
    const desde = page * PAGE_SIZE;
    const embed = plantaOperadorId
      ? "movimientos_planta!inner(planta_destino_id, medio, estado, plantas!movimientos_planta_planta_destino_id_fkey(nombre))"
      : "movimientos_planta(planta_destino_id, medio, estado, plantas!movimientos_planta_planta_destino_id_fkey(nombre))";
    let q = supabase
      .from("operaciones")
      .select(
        `id, retiro_de, fecha_retiro, contenedores(numero_contenedor, navieras(nombre)), ${embed}`,
        { count: "exact" }
      )
      .eq("estado", "en_transito_a_planta");
    if (plantaOperadorId) {
      q = q
        .eq("movimientos_planta.estado", "en_transito")
        .eq("movimientos_planta.planta_destino_id", plantaOperadorId);
    }
    const { data, error, count } = await q
      .order("fecha_retiro", { ascending: true })
      .range(desde, desde + PAGE_SIZE - 1);
    if (error) {
      setError(error.message);
    } else {
      setRows((data ?? []) as unknown as PendienteRow[]);
      setTotal(count ?? 0);
    }
    setCargando(false);
  }, [page, plantaOperadorId]);

  useEffect(() => {
    setCargando(true);
    void cargar();
  }, [cargar, refreshTick]);

  // Realtime: cualquier cambio en operaciones → refetch (sin recrear el canal).
  // Trailing debounce de 350ms: una tanda de N filas dispara N eventos → un solo refetch.
  const cargarRef = useRef(cargar);
  useEffect(() => {
    cargarRef.current = cargar;
  }, [cargar]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ch = supabase
      .channel("ingreso-pendientes-operaciones")
      .on("postgres_changes", { event: "*", schema: "detention", table: "operaciones" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          void cargarRef.current();
        }, 350);
      })
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(ch);
    };
  }, []);

  // Operador → el filtro de planta ya viene aplicado server-side en `cargar` (embed !inner);
  // este filtro queda como red de seguridad para no seleccionar/confirmar filas de otra planta
  // si el query devolviera algo inesperado.
  const visibles = useMemo(() => {
    if (!plantaOperadorId) return rows;
    return rows.filter((r) => movEnTransito(r)?.planta_destino_id === plantaOperadorId);
  }, [rows, plantaOperadorId]);

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
    <section className="fd-panel">
      <div className="fd-panel-title">
        <span className="num">2</span> pendientes de ingreso a planta
        <span className="fd-count">tránsito largo, esperando llegada</span>
      </div>
      <div className="fd-panel-body">

      {cargando ? (
        <div className="tblwrap">
          <table className="t">
            <tbody>
              <SkeletonRowsTable cols={7} rows={4} />
            </tbody>
          </table>
        </div>
      ) : error ? (
        <ErrorMsg msg={error} onRetry={() => void cargar()} />
      ) : visibles.length === 0 ? (
        <Vacio
          msg={
            esOperador
              ? "sin retiros pendientes de ingreso hacia tu planta"
              : "sin retiros pendientes de ingreso"
          }
        />
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
      </div>
    </section>
  );
}
