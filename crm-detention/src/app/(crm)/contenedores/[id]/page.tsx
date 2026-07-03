"use client";

// Ficha de la operación (id = operacion_id): datos, timeline de eventos,
// movimiento entre plantas, incidencias, anulación y validación de reforzado.
//
// Decisión documentada (según brief): para confirmar la llegada de un movimiento
// entre plantas pendiente NO se usa RPC — se hace update directo sobre
// movimientos_planta (estado → 'confirmado' + fecha_llegada_confirmada +
// confirmado_por). El trigger de la tabla es el que actualiza
// operaciones.planta_actual_id al confirmar.
// Los nombres de plantas de los movimientos se resuelven contra el catálogo
// `plantas` ya cargado para el select de destino (evita desambiguar los dos FK
// origen/destino en el embed de PostgREST).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/session-context";
import { Cargando, ErrorMsg, Vacio } from "@/components/ui";
import {
  hoyAR,
  fmtFecha,
  fmtFechaHora,
  ESTADO_LABELS,
  TIPO_CIERRE_LABELS,
  EVENTO_LABELS,
} from "@/lib/format";
import type {
  Contenedor,
  MovimientoPlanta,
  Incidencia,
  Operacion,
  OperacionEvento,
  Planta,
  ReforzadoEstado,
  TipoEvento,
} from "@/lib/types";

type OpFicha = Omit<Operacion, "contenedores" | "plantas"> & {
  contenedores: Contenedor & { navieras: { nombre: string } | null };
  plantas: { nombre: string } | null;
};

const REFORZADO_LABELS: Record<ReforzadoEstado, string> = {
  pendiente_validacion: "reforzado: pendiente de validación",
  confirmado_reforzado: "reforzado confirmado",
  confirmado_no_reforzado: "no reforzado",
  discrepancia: "reforzado: discrepancia",
};

const INCIDENCIA_LABELS: Record<string, string> = {
  averia_sufrida: "avería sufrida",
  averia_recepcionada: "avería recepcionada",
  otro: "otro",
};

function chipEstado(estado: OpFicha["estado"]): string {
  if (estado === "anulada") return "chip chip-danger";
  if (estado === "en_planta") return "chip chip-success";
  if (estado === "cerrado") return "chip";
  return "chip chip-warning";
}

function chipReforzado(estado: ReforzadoEstado): string {
  if (estado === "confirmado_reforzado") return "chip chip-success";
  if (estado === "discrepancia") return "chip chip-danger";
  if (estado === "pendiente_validacion") return "chip chip-warning";
  return "chip";
}

function dotEvento(tipo: TipoEvento): string {
  if (tipo === "anulacion") return "dot dot-rojo";
  if (tipo === "incidencia") return "dot dot-amarillo";
  return "dot dot-verde";
}

/** detalle jsonb → "clave: valor · clave: valor" (solo valores simples). */
function detalleLegible(detalle: Record<string, unknown> | null): string {
  if (!detalle) return "";
  const partes: string[] = [];
  for (const [clave, valor] of Object.entries(detalle)) {
    if (valor == null) continue;
    if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") {
      partes.push(`${clave}: ${String(valor)}`);
    }
  }
  return partes.join(" · ");
}

function Dato({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div className="f">
      <label>{label}</label>
      <div>{valor && valor !== "" ? valor : "—"}</div>
    </div>
  );
}

export default function FichaOperacionPage() {
  const params = useParams<{ id: string }>();
  const opId = params.id;
  const session = useSession();
  const puedeGestionar = session.rol === "supervisor" || session.rol === "administrador";

  const [op, setOp] = useState<OpFicha | null>(null);
  const [eventos, setEventos] = useState<OperacionEvento[]>([]);
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoPlanta[]>([]);
  const [plantas, setPlantas] = useState<Planta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // form movimiento entre plantas
  const [movDestino, setMovDestino] = useState("");
  const [movMedio, setMovMedio] = useState<"camion" | "tren">("camion");
  const [movFecha, setMovFecha] = useState(hoyAR());
  const [movConfirmar, setMovConfirmar] = useState(false);
  const [movBusy, setMovBusy] = useState(false);
  const [movErr, setMovErr] = useState<string | null>(null);
  const [movOk, setMovOk] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  // anular
  const [motivo, setMotivo] = useState("");
  const [anBusy, setAnBusy] = useState(false);
  const [anErr, setAnErr] = useState<string | null>(null);
  const [anOk, setAnOk] = useState<string | null>(null);

  // validar reforzado
  const [refEstado, setRefEstado] = useState<ReforzadoEstado>("pendiente_validacion");
  const [refBusy, setRefBusy] = useState(false);
  const [refErr, setRefErr] = useState<string | null>(null);
  const [refOk, setRefOk] = useState<string | null>(null);

  const fetchTodo = useCallback(async () => {
    setError(null);
    try {
      const [opRes, evRes, incRes, movRes] = await Promise.all([
        supabase
          .from("operaciones")
          .select("*, contenedores(*, navieras(nombre)), plantas(nombre)")
          .eq("id", opId)
          .single(),
        supabase
          .from("operacion_eventos")
          .select("*")
          .eq("operacion_id", opId)
          .order("fecha", { ascending: true }),
        supabase
          .from("incidencias")
          .select("*")
          .eq("operacion_id", opId)
          .order("fecha", { ascending: false }),
        supabase
          .from("movimientos_planta")
          .select("*")
          .eq("operacion_id", opId)
          .order("fecha_salida", { ascending: false }),
      ]);
      if (opRes.error) throw opRes.error;
      if (evRes.error) throw evRes.error;
      if (incRes.error) throw incRes.error;
      if (movRes.error) throw movRes.error;
      const opData = opRes.data as unknown as OpFicha;
      setOp(opData);
      setRefEstado(opData.contenedores.reforzado_estado);
      setEventos((evRes.data ?? []) as unknown as OperacionEvento[]);
      setIncidencias((incRes.data ?? []) as unknown as Incidencia[]);
      setMovimientos((movRes.data ?? []) as unknown as MovimientoPlanta[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error al cargar la ficha");
    } finally {
      setCargando(false);
    }
  }, [opId]);

  useEffect(() => {
    void fetchTodo();
  }, [fetchTodo]);

  // catálogo de plantas (select destino + nombres en movimientos)
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const { data, error: err } = await supabase
        .from("plantas")
        .select("id, nombre, codigo")
        .order("nombre");
      if (vivo && !err && data) setPlantas(data as Planta[]);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const plantaNombre = useCallback(
    (id: string | null | undefined) => plantas.find((p) => p.id === id)?.nombre ?? "—",
    [plantas],
  );

  async function registrarMovimiento(e: React.FormEvent) {
    e.preventDefault();
    if (!op) return;
    setMovErr(null);
    setMovOk(null);
    if (!movDestino) {
      setMovErr("elegí la planta destino");
      return;
    }
    if (!movFecha) {
      setMovErr("elegí la fecha de salida");
      return;
    }
    setMovBusy(true);
    try {
      const fechaTz = `${movFecha}T10:00:00-03:00`;
      const { error: err } = await supabase.rpc("crm_mover_entre_plantas", {
        p_operacion_id: op.id,
        p_destino: movDestino,
        p_medio: movMedio,
        p_fecha_salida: fechaTz,
        p_confirmar: movConfirmar,
        p_fecha_llegada: movConfirmar ? fechaTz : null,
        p_usuario: session.id,
      });
      if (err) throw err;
      setMovOk(
        movConfirmar
          ? "movimiento registrado y llegada confirmada"
          : "movimiento registrado — queda en tránsito",
      );
      setMovDestino("");
      setMovConfirmar(false);
      await fetchTodo();
    } catch (e2) {
      setMovErr(e2 instanceof Error ? e2.message : "error al registrar el movimiento");
    } finally {
      setMovBusy(false);
    }
  }

  async function confirmarLlegada(movId: string) {
    setMovErr(null);
    setMovOk(null);
    setConfirmandoId(movId);
    try {
      // update directo: el trigger de movimientos_planta actualiza la planta actual
      const { error: err } = await supabase
        .from("movimientos_planta")
        .update({
          estado: "confirmado",
          fecha_llegada_confirmada: `${hoyAR()}T12:00:00-03:00`,
          confirmado_por: session.id,
        })
        .eq("id", movId);
      if (err) throw err;
      setMovOk("llegada confirmada");
      await fetchTodo();
    } catch (e) {
      setMovErr(e instanceof Error ? e.message : "error al confirmar la llegada");
    } finally {
      setConfirmandoId(null);
    }
  }

  async function anularOperacion(e: React.FormEvent) {
    e.preventDefault();
    if (!op) return;
    setAnErr(null);
    setAnOk(null);
    if (!motivo.trim()) {
      setAnErr("indicá el motivo de la anulación");
      return;
    }
    setAnBusy(true);
    try {
      const { error: err } = await supabase.rpc("crm_anular_operacion", {
        p_operacion_id: op.id,
        p_motivo: motivo.trim(),
        p_usuario: session.id,
      });
      if (err) throw err;
      setAnOk("operación anulada");
      setMotivo("");
      await fetchTodo();
    } catch (e2) {
      setAnErr(e2 instanceof Error ? e2.message : "error al anular la operación");
    } finally {
      setAnBusy(false);
    }
  }

  async function validarReforzado() {
    if (!op) return;
    setRefErr(null);
    setRefOk(null);
    setRefBusy(true);
    try {
      const { error: err } = await supabase.rpc("crm_validar_reforzado", {
        p_contenedor: op.contenedores.id,
        p_estado: refEstado,
        p_usuario: session.id,
      });
      if (err) throw err;
      setRefOk("estado de reforzado actualizado");
      await fetchTodo();
    } catch (e) {
      setRefErr(e instanceof Error ? e.message : "error al validar el reforzado");
    } finally {
      setRefBusy(false);
    }
  }

  if (cargando) return <Cargando msg="cargando ficha…" />;
  if (error) return <ErrorMsg msg={error} onRetry={() => void fetchTodo()} />;
  if (!op) return <Vacio msg="operación no encontrada" />;

  const cont = op.contenedores;
  const movPendientes = movimientos.filter((m) => m.estado === "en_transito");
  const puedeMover = op.estado === "en_planta" || op.estado === "cargado";
  const puedeAnular = puedeGestionar && op.estado !== "cerrado" && op.estado !== "anulada";

  return (
    <div>
      {/* 1 · header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 600 }}>
            {cont.numero_contenedor}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            <span className="chip">
              <i className="ti ti-ship" aria-hidden /> {cont.navieras?.nombre ?? "—"}
            </span>
            <span className="chip">{cont.tipo}</span>
            <span className={chipEstado(op.estado)}>{ESTADO_LABELS[op.estado] ?? op.estado}</span>
            <span className="chip">
              <i className="ti ti-map-pin" aria-hidden /> planta: {op.plantas?.nombre ?? "—"}
            </span>
            <span className={chipReforzado(cont.reforzado_estado)}>
              {REFORZADO_LABELS[cont.reforzado_estado]}
            </span>
          </div>
          {op.estado === "anulada" && (
            <div style={{ marginTop: 8 }}>
              <span className="chip chip-danger">
                <i className="ti ti-ban" aria-hidden /> anulada: {op.anulada_motivo ?? "sin motivo"}
              </span>
            </div>
          )}
        </div>
        <Link href="/contenedores" className="pill" style={{ textDecoration: "none" }}>
          <i className="ti ti-arrow-left" aria-hidden /> volver a la planilla
        </Link>
      </div>

      {/* 2 · datos de la operación */}
      <div className="crm-card">
        <h4>
          <i className="ti ti-clipboard-text" aria-hidden /> datos de la operación
        </h4>
        <div className="grid">
          <Dato label="retiro de" valor={op.retiro_de} />
          <Dato label="booking retiro" valor={op.booking_retiro} />
          <Dato label="fecha retiro" valor={fmtFecha(op.fecha_retiro)} />
          <Dato label="booking asignado" valor={op.booking_asignado} />
          <Dato label="buque" valor={op.buque} />
          <Dato label="destino" valor={op.destino} />
          <Dato label="orden" valor={op.orden} />
          <Dato label="SHP" valor={op.shp} />
          <Dato label="tipo cierre" valor={TIPO_CIERRE_LABELS[op.tipo_cierre] ?? op.tipo_cierre} />
          <Dato label="fecha egreso planta" valor={fmtFecha(op.fecha_egreso_planta)} />
          <Dato label="fecha devolución" valor={fmtFecha(op.fecha_devolucion)} />
        </div>
      </div>

      {/* 3 · timeline */}
      <div className="crm-card">
        <h4>
          <i className="ti ti-timeline" aria-hidden /> timeline
        </h4>
        {eventos.length === 0 ? (
          <Vacio msg="sin eventos registrados" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {eventos.map((ev) => {
              const detalle = detalleLegible(ev.detalle);
              return (
                <div key={ev.id} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className={dotEvento(ev.tipo_evento)} style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ fontWeight: 500 }}>
                      {EVENTO_LABELS[ev.tipo_evento] ?? ev.tipo_evento}
                    </strong>{" "}
                    <span className="mono" style={{ fontSize: 12 }}>
                      {fmtFechaHora(ev.fecha)}
                    </span>
                    {detalle && <div className="note" style={{ marginTop: 2 }}>{detalle}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4 · movimiento entre plantas — form solo en_planta|cargado; los pendientes
          se listan siempre que existan (por si el estado cambió con el mov en tránsito) */}
      {(puedeMover || movPendientes.length > 0) && (
        <div className="crm-card">
          <h4>
            <i className="ti ti-transfer" aria-hidden /> movimiento entre plantas
          </h4>

          {movPendientes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="tblwrap">
                <table className="t">
                  <thead>
                    <tr>
                      <th>destino</th>
                      <th>medio</th>
                      <th>salida</th>
                      <th>estado</th>
                      <th aria-label="acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {movPendientes.map((m) => (
                      <tr key={m.id}>
                        <td>{plantaNombre(m.planta_destino_id)}</td>
                        <td>{m.medio === "camion" ? "camión" : "tren"}</td>
                        <td>{fmtFechaHora(m.fecha_salida)}</td>
                        <td>
                          <span className="badge badge-accent">en tránsito</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            disabled={confirmandoId === m.id}
                            onClick={() => void confirmarLlegada(m.id)}
                          >
                            <i className="ti ti-check" aria-hidden />{" "}
                            {confirmandoId === m.id ? "confirmando…" : "confirmar llegada"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {puedeMover && (
            <form onSubmit={registrarMovimiento}>
              <div className="grid">
                <div className="f">
                  <label htmlFor="mov-destino">planta destino</label>
                  <select
                    id="mov-destino"
                    value={movDestino}
                    onChange={(e) => setMovDestino(e.target.value)}
                  >
                    <option value="">elegir planta…</option>
                    {plantas
                      .filter((p) => p.id !== op.planta_actual_id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="f">
                  <label htmlFor="mov-medio">medio</label>
                  <select
                    id="mov-medio"
                    value={movMedio}
                    onChange={(e) => setMovMedio(e.target.value as "camion" | "tren")}
                  >
                    <option value="camion">camión</option>
                    <option value="tren">tren</option>
                  </select>
                </div>
                <div className="f">
                  <label htmlFor="mov-fecha">fecha salida</label>
                  <input
                    id="mov-fecha"
                    type="date"
                    value={movFecha}
                    onChange={(e) => setMovFecha(e.target.value)}
                  />
                </div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={movConfirmar}
                  onChange={(e) => setMovConfirmar(e.target.checked)}
                />
                confirmar llegada ahora
              </label>
              <div className="actbar">
                <button type="submit" className="btn-primary" disabled={movBusy}>
                  <i className="ti ti-transfer" aria-hidden />{" "}
                  {movBusy ? "registrando…" : "registrar movimiento"}
                </button>
              </div>
            </form>
          )}

          {movErr && <div className="err">{movErr}</div>}
          {movOk && <div className="ok">{movOk}</div>}
        </div>
      )}

      {/* 5 · incidencias */}
      <div className="crm-card">
        <h4>
          <i className="ti ti-alert-triangle" aria-hidden /> incidencias
        </h4>
        {incidencias.length === 0 ? (
          <Vacio msg="sin incidencias registradas" />
        ) : (
          <div className="tblwrap">
            <table className="t">
              <thead>
                <tr>
                  <th>tipo</th>
                  <th>descripción</th>
                  <th>fecha</th>
                </tr>
              </thead>
              <tbody>
                {incidencias.map((inc) => (
                  <tr key={inc.id}>
                    <td>
                      <span className="badge badge-danger">
                        {INCIDENCIA_LABELS[inc.tipo] ?? inc.tipo}
                      </span>
                    </td>
                    <td>{inc.descripcion || "—"}</td>
                    <td>{fmtFechaHora(inc.fecha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="note">
          <Link href="/incidencias">
            <i className="ti ti-plus" aria-hidden /> cargar incidencia
          </Link>
        </p>
      </div>

      {/* 6 · anular operación (supervisor|administrador, no cerrada/anulada) */}
      {puedeAnular && (
        <div className="crm-card">
          <h4>
            <i className="ti ti-ban" aria-hidden /> anular operación
          </h4>
          <form onSubmit={anularOperacion}>
            <div className="actbar" style={{ marginTop: 0 }}>
              <div className="f" style={{ flex: "1 1 260px" }}>
                <label htmlFor="an-motivo">motivo</label>
                <input
                  id="an-motivo"
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="motivo de la anulación…"
                />
              </div>
              <button type="submit" className="btn-danger" disabled={anBusy}>
                <i className="ti ti-ban" aria-hidden /> {anBusy ? "anulando…" : "anular"}
              </button>
            </div>
          </form>
          <p className="note">la anulación corta el ciclo y queda registrada en el timeline.</p>
          {anErr && <div className="err">{anErr}</div>}
          {anOk && <div className="ok">{anOk}</div>}
        </div>
      )}

      {/* 7 · validar reforzado (supervisor|administrador) */}
      {puedeGestionar && (
        <div className="crm-card">
          <h4>
            <i className="ti ti-shield-check" aria-hidden /> validar reforzado
          </h4>
          <div className="actbar" style={{ marginTop: 0 }}>
            <div className="f" style={{ flex: "1 1 220px" }}>
              <label htmlFor="ref-estado">estado reforzado</label>
              <select
                id="ref-estado"
                value={refEstado}
                onChange={(e) => setRefEstado(e.target.value as ReforzadoEstado)}
              >
                {(Object.keys(REFORZADO_LABELS) as ReforzadoEstado[]).map((k) => (
                  <option key={k} value={k}>
                    {REFORZADO_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={refBusy}
              onClick={() => void validarReforzado()}
            >
              <i className="ti ti-check" aria-hidden /> {refBusy ? "validando…" : "validar"}
            </button>
          </div>
          {refErr && <div className="err">{refErr}</div>}
          {refOk && <div className="ok">{refOk}</div>}
        </div>
      )}
    </div>
  );
}
