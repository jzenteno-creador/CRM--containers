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
import { Cargando, ErrorMsg, Vacio, ConfirmDialog } from "@/components/ui";
import { ContainerNumber } from "@/components/container-number";
import {
  hoyAR,
  fmtFecha,
  fmtFechaHora,
  fmtUSD,
  ESTADO_LABELS,
  TIPO_CIERRE_LABELS,
  EVENTO_LABELS,
} from "@/lib/format";
import { RadialTimer } from "@/components/fd/radial-timer";
import { semaforoAColor } from "@/components/fd/status-badge";
import type {
  Contenedor,
  MovimientoPlanta,
  Incidencia,
  Operacion,
  OperacionEvento,
  Planta,
  ReforzadoEstado,
  VistaAlerta,
  VistaCostoCerrado,
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

/** timestamptz ISO → 'YYYY-MM-DD' en zona AR (para inputs date de corrección). */
function isoAFechaAR(iso: string | null): string {
  if (!iso) return "";
  const ar = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return ar.toISOString().slice(0, 10);
}

const CAMPOS_CORR = [
  { k: "booking_asignado", label: "booking asignado", tipo: "text" },
  { k: "buque", label: "buque", tipo: "text" },
  { k: "destino", label: "destino", tipo: "text" },
  { k: "orden", label: "orden", tipo: "text" },
  { k: "shp", label: "SHP", tipo: "text" },
  { k: "fecha_retiro", label: "fecha retiro", tipo: "date" },
  { k: "fecha_egreso_planta", label: "egreso planta", tipo: "date" },
  { k: "fecha_devolucion", label: "devolución", tipo: "date" },
] as const;

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

export default function FichaOperacionPage() {
  const params = useParams<{ id: string }>();
  const opId = params.id;
  const session = useSession();
  const puedeGestionar = session.rol === "supervisor" || session.rol === "administrador";

  const [op, setOp] = useState<OpFicha | null>(null);
  // freetime/costo calculados por la DB (vista_alertas si está abierta, vista_costos_cerrados si cerró)
  const [ft, setFt] = useState<VistaAlerta | null>(null);
  const [cerrada, setCerrada] = useState<VistaCostoCerrado | null>(null);
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
  const [anConfirm, setAnConfirm] = useState(false);

  // reabrir operación cerrada (F-02, reversa contable)
  const [reMotivo, setReMotivo] = useState("");
  const [reBusy, setReBusy] = useState(false);
  const [reErr, setReErr] = useState<string | null>(null);
  const [reOk, setReOk] = useState<string | null>(null);
  const [reConfirm, setReConfirm] = useState(false);

  // corregir datos (F-03, edición auditada)
  const [corrOpen, setCorrOpen] = useState(false);
  const [corrForm, setCorrForm] = useState<Record<string, string>>({});
  const [corrBusy, setCorrBusy] = useState(false);
  const [corrErr, setCorrErr] = useState<string | null>(null);
  const [corrOk, setCorrOk] = useState<string | null>(null);

  // validar reforzado
  const [refEstado, setRefEstado] = useState<ReforzadoEstado>("pendiente_validacion");
  const [refBusy, setRefBusy] = useState(false);
  const [refErr, setRefErr] = useState<string | null>(null);
  const [refOk, setRefOk] = useState<string | null>(null);

  const fetchTodo = useCallback(async () => {
    setError(null);
    try {
      const [opRes, ftRes, cerRes, evRes, incRes, movRes] = await Promise.all([
        supabase
          .from("operaciones")
          .select("*, contenedores(*, navieras(nombre)), plantas(nombre)")
          .eq("id", opId)
          .single(),
        supabase.from("vista_alertas").select("*").eq("operacion_id", opId).maybeSingle(),
        supabase.from("vista_costos_cerrados").select("*").eq("operacion_id", opId).maybeSingle(),
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
      // vistas de costo: pueden no tener fila (anulada / naviera sin tarifa) — no es error
      setFt(!ftRes.error && ftRes.data ? (ftRes.data as VistaAlerta) : null);
      setCerrada(!cerRes.error && cerRes.data ? (cerRes.data as VistaCostoCerrado) : null);
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

  function pedirAnulacion(e: React.FormEvent) {
    e.preventDefault();
    setAnErr(null);
    setAnOk(null);
    if (!motivo.trim()) {
      setAnErr("indicá el motivo de la anulación");
      return;
    }
    setAnConfirm(true);
  }

  async function ejecutarAnulacion() {
    if (!op) return;
    setAnBusy(true);
    setAnErr(null);
    try {
      const { error: err } = await supabase.rpc("crm_anular_operacion", {
        p_operacion_id: op.id,
        p_motivo: motivo.trim(),
        p_usuario: session.id,
      });
      if (err) throw err;
      setAnConfirm(false);
      setAnOk("operación anulada");
      setMotivo("");
      await fetchTodo();
    } catch (e2) {
      setAnConfirm(false);
      setAnErr(e2 instanceof Error ? e2.message : "error al anular la operación");
    } finally {
      setAnBusy(false);
    }
  }

  async function ejecutarReapertura() {
    if (!op) return;
    setReBusy(true);
    setReErr(null);
    try {
      const { error: err } = await supabase.rpc("crm_reabrir_operacion", {
        p_operacion: op.id,
        p_usuario: session.id,
        p_motivo: reMotivo.trim(),
      });
      if (err) throw err;
      setReConfirm(false);
      setReOk("operación reabierta — vuelve a estar en tránsito a terminal");
      setReMotivo("");
      await fetchTodo();
    } catch (e2) {
      setReConfirm(false);
      setReErr(e2 instanceof Error ? e2.message : "error al reabrir la operación");
    } finally {
      setReBusy(false);
    }
  }

  function valoresOriginales(o: OpFicha): Record<string, string> {
    return {
      booking_asignado: o.booking_asignado ?? "",
      buque: o.buque ?? "",
      destino: o.destino ?? "",
      orden: o.orden ?? "",
      shp: o.shp ?? "",
      fecha_retiro: isoAFechaAR(o.fecha_retiro),
      fecha_egreso_planta: isoAFechaAR(o.fecha_egreso_planta),
      fecha_devolucion: isoAFechaAR(o.fecha_devolucion),
    };
  }

  function abrirCorreccion() {
    if (!op) return;
    setCorrErr(null);
    setCorrOk(null);
    setCorrForm(valoresOriginales(op));
    setCorrOpen(true);
  }

  async function guardarCorreccion(e: React.FormEvent) {
    e.preventDefault();
    if (!op) return;
    setCorrErr(null);
    setCorrOk(null);
    const orig = valoresOriginales(op);
    const campos: Record<string, string | null> = {};
    for (const { k, tipo } of CAMPOS_CORR) {
      const val = (corrForm[k] ?? "").trim();
      if (val === (orig[k] ?? "")) continue; // sin cambio
      if (tipo === "date") {
        if (k === "fecha_retiro" && !val) {
          setCorrErr("la fecha de retiro no puede quedar vacía");
          return;
        }
        campos[k] = val ? `${val}T12:00:00-03:00` : null;
      } else {
        campos[k] = val || null;
      }
    }
    if (Object.keys(campos).length === 0) {
      setCorrErr("no cambiaste ningún campo");
      return;
    }
    setCorrBusy(true);
    try {
      const { error: err } = await supabase.rpc("crm_corregir_operacion", {
        p_operacion: op.id,
        p_usuario: session.id,
        p_campos: campos,
      });
      if (err) throw err;
      setCorrOk("datos corregidos — queda registrado en el timeline");
      setCorrOpen(false);
      await fetchTodo();
    } catch (e2) {
      setCorrErr(e2 instanceof Error ? e2.message : "error al corregir los datos");
    } finally {
      setCorrBusy(false);
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
  const puedeReabrir = puedeGestionar && op.estado === "cerrado";
  const puedeCorregir = puedeGestionar && op.estado !== "anulada";

  // ---- derivaciones de PRESENTACIÓN (días/costos ya calculados por las vistas de la DB) ----
  const abiertaOp = op.estado !== "cerrado" && op.estado !== "anulada";
  const diasLibres = ft?.dias_libres ?? cerrada?.dias_libres ?? null;
  const tarifa = ft?.tarifa_usd_dia ?? cerrada?.tarifa_usd_dia ?? null;
  const estadiaDias = ft?.dias_estadia ?? cerrada?.estadia ?? null;
  const demoraDias = ft
    ? ft.dias_restantes != null && ft.dias_restantes < 0
      ? -ft.dias_restantes
      : 0
    : (cerrada?.demora ?? 0);
  const costoTotal = ft ? ft.costo_proyectado : cerrada ? cerrada.costo_usd : null;
  const sinCargo = ft?.sin_cargo ?? false;
  const diasConsumidos = ft ? ft.dias_transcurridos : (cerrada?.estadia ?? null);
  const gaugePct =
    diasLibres && diasLibres > 0 && diasConsumidos != null
      ? Math.min(100, (diasConsumidos / diasLibres) * 100)
      : 0;
  const gaugeColor = ft ? semaforoAColor(ft.estado_semaforo) : demoraDias > 0 ? "red" : "green";
  // HITO fin de free time: fecha_retiro + dias_libres (marcador visual, no recalcula negocio)
  const finFreetime =
    diasLibres != null && op.fecha_retiro
      ? new Date(new Date(op.fecha_retiro).getTime() + diasLibres * 86400000)
      : null;

  // timeline: eventos reales + HITO fin free time intercalado cronológico + nodo "en curso"
  type NodoTL = {
    key: string;
    fecha: string | null;
    titulo: string;
    detalle?: string;
    tipo: "done" | "hito" | "actual" | "rojo";
  };
  const nodos: NodoTL[] = eventos.map((ev) => ({
    key: ev.id,
    fecha: ev.fecha,
    titulo: EVENTO_LABELS[ev.tipo_evento] ?? ev.tipo_evento,
    detalle: detalleLegible(ev.detalle),
    tipo: ev.tipo_evento === "anulacion" || ev.tipo_evento === "incidencia" ? "rojo" : "done",
  }));
  if (finFreetime) {
    const iso = finFreetime.toISOString();
    const hito: NodoTL = {
      key: "hito-freetime",
      fecha: iso,
      titulo: "fin del free time",
      detalle: `${diasLibres} días libres desde el retiro`,
      tipo: "hito",
    };
    const idx = nodos.findIndex((n) => n.fecha != null && n.fecha > iso);
    if (idx === -1) nodos.push(hito);
    else nodos.splice(idx, 0, hito);
  }
  if (abiertaOp) {
    nodos.push({
      key: "en-curso",
      fecha: null,
      titulo: ESTADO_LABELS[op.estado] ?? op.estado,
      detalle: "estado actual",
      tipo: "actual",
    });
  }

  const DOT_TL: Record<NodoTL["tipo"], React.CSSProperties> = {
    done: { background: "var(--text-success)" },
    rojo: { background: "var(--text-danger)" },
    hito: { background: "transparent", border: "2px solid var(--text-danger)" },
    actual: { background: "var(--text-danger)", boxShadow: "var(--shadow-glow-red)" },
  };

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
            <ContainerNumber value={cont.numero_contenedor} />
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
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/contenedores" className="pill" style={{ textDecoration: "none" }}>
            <i className="ti ti-arrow-left" aria-hidden /> planilla
          </Link>
          {abiertaOp && (
            <Link
              href="/egreso"
              className="btn-primary"
              style={{ padding: "7px 12px", borderRadius: 9, textDecoration: "none", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              Registrar egreso <i className="ti ti-arrow-right" aria-hidden />
            </Link>
          )}
        </div>
      </div>

      {/* 2 · spec strip (artboard 2c): datos de la operación en celdas label→valor */}
      <div className="fd-panel" style={{ marginBottom: 16 }}>
        <div
          className="fd-panel-body"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", gap: "12px 18px" }}
        >
          {(
            [
              ["booking retiro", op.booking_retiro ?? "—"],
              ["booking asignado", op.booking_asignado ?? "—"],
              ["buque", op.buque ?? "—"],
              ["destino", op.destino ?? "—"],
              ["orden", op.orden ?? "—"],
              ["shp", op.shp ?? "—"],
              ["retiro de", op.retiro_de ?? "—"],
              ["fecha retiro", fmtFecha(op.fecha_retiro)],
              ["tipo cierre", TIPO_CIERRE_LABELS[op.tipo_cierre] ?? op.tipo_cierre],
              ["egreso planta", fmtFecha(op.fecha_egreso_planta)],
              ["devolución", fmtFecha(op.fecha_devolucion)],
              [
                "tarifa vigente",
                tarifa != null ? `USD ${tarifa}/día · ${diasLibres ?? "—"} libres` : "sin cargo de origen",
              ],
            ] as const
          ).map(([k, v]) => (
            <div key={k} style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span className="fd-label">{k}</span>
              <span className="mono" style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3 · timeline | gauge + desglose (artboard 2c) */}
      <div className="fd-cc" style={{ marginBottom: 16 }}>
        <div className="fd-panel">
          <div className="fd-panel-title">
            <i className="ti ti-timeline" aria-hidden /> timeline del ciclo
          </div>
          <div className="fd-panel-body">
            {nodos.length === 0 ? (
              <Vacio msg="sin eventos registrados" />
            ) : (
              nodos.map((n, i) => (
                <div key={n.key} style={{ display: "grid", gridTemplateColumns: "96px 24px 1fr", gap: 8 }}>
                  <span
                    className="mono"
                    style={{ fontSize: 11.5, color: "var(--text-muted)", textAlign: "right", paddingTop: 2, whiteSpace: "nowrap" }}
                  >
                    {n.fecha ? fmtFechaHora(n.fecha) : "hoy"}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span
                      className={n.tipo === "actual" ? "fd-dot-pulse" : undefined}
                      style={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0, marginTop: 3, ...DOT_TL[n.tipo] }}
                    />
                    {i < nodos.length - 1 && (
                      <span style={{ width: 2, flex: 1, minHeight: 14, background: "var(--border-strong)" }} />
                    )}
                  </span>
                  <div style={{ paddingBottom: 16, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: n.tipo === "hito" ? "var(--text-warning)" : "var(--text-primary)",
                      }}
                    >
                      {n.titulo}
                    </span>
                    {n.tipo === "hito" && (
                      <span className="badge badge-danger" style={{ marginLeft: 8, fontSize: 10 }}>HITO</span>
                    )}
                    {n.tipo === "actual" && (
                      <span className="badge badge-danger" style={{ marginLeft: 8, fontSize: 10 }}>EN CURSO</span>
                    )}
                    {n.detalle && (
                      <div style={{ fontSize: 12, color: "var(--color-text-label)", marginTop: 2 }}>{n.detalle}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div className="fd-panel">
            <div className="fd-panel-title">
              <i className="ti ti-clock-hour-4" aria-hidden /> freetime
            </div>
            <div className="fd-panel-body" style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
              <RadialTimer
                pct={gaugePct}
                color={gaugeColor}
                size={148}
                label={diasConsumidos != null ? `${diasConsumidos}/${diasLibres ?? "∞"}` : "—"}
                sublabel="días"
              />
              <div style={{ display: "grid", gap: 8, flex: 1, minWidth: 120 }}>
                {(
                  [
                    ["estadía", estadiaDias != null ? `${estadiaDias} d` : "—"],
                    ["free time", diasLibres != null ? `${diasLibres} d` : "—"],
                    ["en demora", demoraDias > 0 ? `${demoraDias} d` : "no"],
                    ...(ft?.dias_restantes != null ? ([["restantes", `${ft.dias_restantes} d`]] as const) : []),
                  ] as readonly (readonly [string, string])[]
                ).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span className="fd-label">{k}</span>
                    <span className="mono" style={{ fontSize: 13, color: k === "en demora" && demoraDias > 0 ? "var(--text-danger)" : undefined }}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="fd-panel">
            <div className="fd-panel-title">
              <i className="ti ti-receipt-2" aria-hidden /> desglose de cargos
            </div>
            <div className="fd-panel-body">
              {tarifa == null ? (
                <p className="empty" style={{ textAlign: "left", padding: 0 }}>
                  la naviera no tiene cargo de origen aplicable a esta operación
                </p>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5 }}>
                    <span>detention</span>
                    <span className="mono" style={{ color: "var(--text-muted)" }}>
                      {demoraDias} d × USD {tarifa}
                    </span>
                    <span className="mono">{fmtUSD(demoraDias * Number(tarifa))}</span>
                  </div>
                  {sinCargo && (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, marginTop: 6 }}>
                      <span style={{ color: "var(--text-success)" }}>waiver autorizado (sin cargo)</span>
                      <span className="mono" style={{ color: "var(--text-success)" }}>
                        −{fmtUSD(demoraDias * Number(tarifa))}
                      </span>
                    </div>
                  )}
                  <div style={{ borderTop: "1px solid var(--border)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span className="fd-label">total {abiertaOp ? "proyectado a hoy" : "facturado"}</span>
                    <span
                      className="mono fd-usd"
                      style={{ fontSize: 24, fontWeight: 700, textShadow: "0 0 12px rgba(248,81,73,0.35)" }}
                    >
                      {fmtUSD(Number(costoTotal ?? 0))}
                    </span>
                  </div>
                  <p className="note" style={{ marginTop: 8 }}>
                    tarifa de la versión vigente a la fecha de retiro (freetime versionado — nunca se pisa)
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
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
          <form onSubmit={pedirAnulacion}>
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
                <i className="ti ti-ban" aria-hidden /> anular
              </button>
            </div>
          </form>
          <p className="note">la anulación corta el ciclo y queda registrada en el timeline.</p>
          {anErr && <div className="err">{anErr}</div>}
          {anOk && <div className="ok">{anOk}</div>}
          <ConfirmDialog
            open={anConfirm}
            titulo="Anular operación"
            mensaje={`Vas a anular la operación de ${cont.numero_contenedor}. Corta el ciclo y queda registrada en el timeline.`}
            detalle={<p className="note" style={{ marginTop: 0 }}>motivo: {motivo.trim() || "—"}</p>}
            confirmLabel="anular"
            danger
            busy={anBusy}
            onConfirm={() => void ejecutarAnulacion()}
            onCancel={() => setAnConfirm(false)}
          />
        </div>
      )}

      {/* 6b · reabrir operación cerrada (F-02, supervisor|administrador) */}
      {puedeReabrir && (
        <div className="crm-card">
          <h4>
            <i className="ti ti-lock-open" aria-hidden /> reabrir operación
          </h4>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setReErr(null);
              setReOk(null);
              if (!reMotivo.trim()) {
                setReErr("indicá el motivo de la reapertura");
                return;
              }
              setReConfirm(true);
            }}
          >
            <div className="actbar" style={{ marginTop: 0 }}>
              <div className="f" style={{ flex: "1 1 260px" }}>
                <label htmlFor="re-motivo">motivo</label>
                <input
                  id="re-motivo"
                  type="text"
                  value={reMotivo}
                  onChange={(e) => setReMotivo(e.target.value)}
                  placeholder="p. ej. fecha de devolución mal cargada…"
                />
              </div>
              <button type="submit" className="btn-primary" disabled={reBusy}>
                <i className="ti ti-lock-open" aria-hidden /> reabrir
              </button>
            </div>
          </form>
          <p className="note">
            revierte el cierre (vuelve a tránsito a terminal), limpia la devolución y deja el hito en el
            timeline. Corregí los datos y volvé a confirmar la devolución.
          </p>
          {reErr && <div className="err">{reErr}</div>}
          {reOk && <div className="ok">{reOk}</div>}
          <ConfirmDialog
            open={reConfirm}
            titulo="Reabrir operación cerrada"
            mensaje={`Vas a reabrir la operación de ${cont.numero_contenedor}. Sale del historial de costos hasta que se vuelva a cerrar.`}
            detalle={<p className="note" style={{ marginTop: 0 }}>motivo: {reMotivo.trim() || "—"}</p>}
            confirmLabel="reabrir"
            busy={reBusy}
            onConfirm={() => void ejecutarReapertura()}
            onCancel={() => setReConfirm(false)}
          />
        </div>
      )}

      {/* 6c · corregir datos (F-03, supervisor|administrador) */}
      {puedeCorregir && (
        <div className="crm-card">
          <h4>
            <i className="ti ti-edit" aria-hidden /> corregir datos
          </h4>
          {!corrOpen ? (
            <>
              <p className="note" style={{ marginTop: 0 }}>
                editá booking, buque, destino, orden, SHP o fechas cargados con error. Queda auditado en
                el timeline (valor anterior → nuevo). Las fechas recalculan el costo.
              </p>
              <button type="button" onClick={abrirCorreccion}>
                <i className="ti ti-edit" aria-hidden /> corregir datos
              </button>
              {corrOk && <div className="ok">{corrOk}</div>}
            </>
          ) : (
            <form onSubmit={guardarCorreccion}>
              <div className="grid">
                {CAMPOS_CORR.map(({ k, label, tipo }) => (
                  <div className="f" key={k}>
                    <label htmlFor={`corr-${k}`}>{label}</label>
                    <input
                      id={`corr-${k}`}
                      type={tipo}
                      value={corrForm[k] ?? ""}
                      onChange={(e) => setCorrForm((f) => ({ ...f, [k]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="actbar">
                <button type="button" onClick={() => setCorrOpen(false)} disabled={corrBusy}>
                  cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={corrBusy}>
                  {corrBusy ? "guardando…" : "guardar corrección"}
                </button>
              </div>
              {corrErr && <div className="err">{corrErr}</div>}
            </form>
          )}
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
