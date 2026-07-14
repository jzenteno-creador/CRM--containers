"use client";

// Ficha de contenedor (M5) — primera ruta dinámica de la app: /contenedores/[id]
// (id = uuid del CONTENEDOR). Client component: lee el id con use(params) (Next 16)
// y hace fetch por id contra Supabase.
// - Header: número ISO 6346 grande + naviera/tipo/reforzado + validar reforzado (sup/admin).
// - Card "Operación actual": la op abierta (hay a lo sumo 1 por guard de DB); si no hay,
//   la última operación con nota "sin ciclo abierto".
// - Acciones: mover entre plantas / confirmar llegada de movimiento pendiente / anular
//   (modales en ./acciones.tsx — la lógica vive en las RPCs, acá solo payloads).
// - Historial: operacion_eventos de TODOS los ciclos en el Timeline del design system;
//   los uuid de plantas y usuarios del jsonb `detalle` se resuelven con los maestros
//   cargados (map id→nombre, join mecánico — no cálculo).
// - Waivers (021 — waiver acumulativo): historial de crm.operacion_waivers de la
//   operación mostrada (SELECT directo — READ permitido, RLS scopea); cada registro es
//   anulable individualmente (sup+, modal en ./acciones.tsx). El total vigente sale de
//   waiver_dias de la view (misma fuente que bruto/absorbido/neto) con fallback a sumar
//   los `dias` del historial si no hay fila de view.
// 4 estados: skeleton / error con retry / "no encontrado" (uuid inválido o inexistente,
// sin crash) / poblado. CERO cálculo de negocio: días/costos llegan con las views de M6.

import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, type BadgeTone } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { ContainerNumber } from "@/components/container-number";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { FormAlert } from "@/components/fd/form-alert";
import { PageHeader } from "@/components/fd/page-header";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { Timeline, type TimelineItem, type TimelineStatus } from "@/components/fd/timeline";
import {
  ESTADO_RECLAMO_LABELS,
  EVENTO_LABELS,
  RESULTADO_RECLAMO_LABELS,
  TIPO_CIERRE_LABELS,
  TIPO_INCIDENCIA_LABELS,
  fmtFecha,
  fmtFechaHora,
  fmtHora,
  fmtUSD,
  fmtUSDTarifa,
} from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { EstadoCargaBadge, EstadoOperacionBadge } from "../estado-operacion";
import {
  AnularOperacionModal,
  AnularWaiverModal,
  ConfirmarLlegadaModal,
  ConsolidarModal,
  CorregirDatoModal,
  DesconsolidarModal,
  MoverPlantasModal,
  REFORZADO_OPTIONS,
  RegistrarWaiverModal,
  ValidarReforzadoModal,
  type OperacionWaiverRow,
  type PlantaOption,
} from "./acciones";

/* ---------- tipos (espejo de los selects) ---------- */

type ContenedorFicha = {
  id: string;
  numero_contenedor: string;
  tipo: string;
  reforzado_estado: string;
  reforzado_validado_por: string | null;
  reforzado_fecha_validacion: string | null;
  naviera: { nombre: string } | null;
};

type OperacionFicha = {
  id: string;
  estado: string;
  // informativo (M5-029, D3): NO selecciona tarifa ni corta el reloj de detention.
  estado_carga: string;
  fecha_retiro: string;
  retiro_de: string;
  booking_retiro: string | null;
  orden: string | null;
  shp: string | null;
  booking_asignado: string | null;
  buque: string | null;
  destino: string | null;
  fecha_egreso_planta: string | null;
  tipo_cierre: string | null;
  fecha_devolucion: string | null;
  anulada_motivo: string | null;
  planta_actual_id: string | null;
  planta_actual: { nombre: string } | null;
  // NB: operaciones.waiver_dias/waiver_motivo/waiver_referencia quedaron CONGELADAS
  // por la 021 (snapshot pre-021) — NO se leen más para el detalle. La verdad vive en
  // crm.operacion_waivers (WaiverFicha, más abajo) y en waiver_dias de las views.
};

// Números de detention de la operación mostrada — vienen CALCULADOS por las views 019
// (vista_alertas si el ciclo está abierto, vista_kpi_costos_cerradas si está cerrado).
// CERO recálculo client-side: acá solo se formatea lo que devuelve la DB.
type CostosFicha = {
  costo_bruto: number | null;
  costo_absorbido: number | null;
  costo_neto: number | null;
  waiver_dias: number | null;
  dias_libres: number | null;
  tarifa_usd_dia: number | null;
  sin_cargo: boolean;
};

type MovimientoFicha = {
  id: string;
  estado: string;
  medio: string | null;
  fecha_salida: string | null;
  fecha_llegada_confirmada: string | null;
  planta_origen_id: string | null;
  planta_destino_id: string | null;
  planta_origen: { nombre: string } | null;
  planta_destino: { nombre: string } | null;
};

type EventoRow = {
  id: string;
  operacion_id: string;
  tipo_evento: string;
  fecha: string;
  usuario_id: string | null;
  detalle: Record<string, unknown> | null;
};

type UsuarioPublico = { id: string; nombre: string };

// Línea agregada de crm.vista_carga_actual (M5-029) — GMID + descripción + bolsas +
// lote opcional. La view solo trae filas con al menos una línea vigente.
type CargaLinea = { gmid: string; descripcion: string; cantidad_bolsas: number; lote: string | null };
type CargaActualRow = { operacion_id: string; lineas: CargaLinea[]; total_bolsas: number };

type FichaData = {
  contenedor: ContenedorFicha;
  operaciones: OperacionFicha[];
  eventos: EventoRow[];
  movimientos: MovimientoFicha[];
  plantas: PlantaOption[];
  usuarios: UsuarioPublico[];
  /** null = sin fila en la view (op anulada, cerrada sin devolución, o fetch tolerante que falló). */
  costos: CostosFicha | null;
  /** Historial de crm.operacion_waivers (021) de la operación mostrada — orden created_at desc. */
  waivers: OperacionWaiverRow[];
  /** null = sin líneas vigentes (vacío, o fetch tolerante que falló) — ver targetOp abajo. */
  cargaActual: CargaActualRow | null;
};

/* ---------- display helpers (solo formato — cero negocio) ---------- */

const REFORZADO_TONE: Record<string, BadgeTone> = {
  pendiente_validacion: "amarillo",
  confirmado_reforzado: "verde",
  confirmado_no_reforzado: "neutro",
  discrepancia: "rojo",
};

const CARD: React.CSSProperties = {
  background: "var(--color-surface-1)",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: "var(--radius-input)",
  padding: 16,
};

// tabla chica "carga actual" (029) — mismos tokens que DataTable (uppercase label,
// tabular-nums) pero sin header sticky/paginación: son a lo sumo unas pocas líneas.
const TH_MINI: React.CSSProperties = {
  textAlign: "left",
  padding: "4px 10px 4px 0",
  color: "var(--color-text-label)",
  fontWeight: 500,
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  borderBottom: "1px solid var(--color-border-subtle)",
};

const TD_MINI: React.CSSProperties = {
  padding: "5px 10px 5px 0",
  borderBottom: "1px solid var(--color-border-subtle)",
  color: "var(--color-text-secondary)",
};

function medioLabel(medio: string | null): string | null {
  if (!medio) return null;
  return medio === "camion" ? "camión" : medio;
}

function fmtDetalleValor(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function joinParts(parts: (string | null | undefined | false)[]): string | null {
  const clean = parts.filter((p): p is string => typeof p === "string" && p !== "");
  return clean.length > 0 ? clean.join(" · ") : null;
}

/** Detalle legible por shape del jsonb (shapes verificadas de los triggers, plan M5). */
function detalleTexto(
  tipo: string,
  detalle: Record<string, unknown> | null,
  plantaNombre: (id: unknown) => string,
): string | null {
  if (!detalle) return null;
  const s = (k: string): string | null => {
    const v = detalle[k];
    return typeof v === "string" && v.trim() !== "" ? v : null;
  };
  switch (tipo) {
    case "retiro":
      return joinParts([
        s("retiro_de") ? `retiro de ${s("retiro_de")}` : null,
        s("booking_retiro") ? `booking ${s("booking_retiro")}` : null,
      ]);
    case "ingreso_planta":
      return s("medio") ? `medio: ${medioLabel(s("medio"))}` : null;
    case "movimiento":
      return joinParts([
        `${plantaNombre(detalle.origen_id)} → ${plantaNombre(detalle.destino_id)}`,
        medioLabel(s("medio")),
        // el flag quedó congelado al crear el evento: solo afirma el caso true
        detalle.confirmado === true ? "confirmado al registrar" : null,
      ]);
    case "carga": {
      // M5-029: un mismo tipo de evento cubre dos flujos — se distinguen por
      // detalle.accion (solo presente en consolidar/desconsolidar). Los eventos legacy
      // de asignación de embarque (pre-029) no tienen esa clave → caen al shape de abajo.
      const accion = s("accion");
      if (accion === "consolidar") {
        const lineasArr = Array.isArray(detalle.lineas) ? (detalle.lineas as Array<Record<string, unknown>>) : [];
        const resumen = lineasArr
          .map((l) => {
            const gmid = typeof l.gmid === "string" ? l.gmid : "—";
            const cant = typeof l.cantidad_bolsas === "number" ? l.cantidad_bolsas : null;
            return cant != null ? `${gmid} (${cant})` : gmid;
          })
          .join(", ");
        const total = detalle.total_lineas_vigentes;
        return joinParts([
          resumen ? `agregado: ${resumen}` : null,
          typeof total === "number" ? `${total} línea${total === 1 ? "" : "s"} vigente${total === 1 ? "" : "s"}` : null,
        ]);
      }
      if (accion === "desconsolidar") {
        const cerradas = detalle.lineas_cerradas;
        return joinParts([
          typeof cerradas === "number"
            ? `${cerradas} línea${cerradas === 1 ? "" : "s"} cerrada${cerradas === 1 ? "" : "s"}`
            : null,
          s("motivo") ? `motivo: ${s("motivo")}` : null,
        ]);
      }
      // legacy: asignación de embarque (evt_operacion_update, 005/019)
      return joinParts([
        s("orden") ? `orden ${s("orden")}` : null,
        s("shp") ? `SHP ${s("shp")}` : null,
        s("booking_asignado") ? `booking ${s("booking_asignado")}` : null,
        s("buque") ? `buque ${s("buque")}` : null,
        s("destino") ? `destino ${s("destino")}` : null,
      ]);
    }
    case "egreso": {
      const tc = s("tipo_cierre");
      return tc ? `cierre: ${TIPO_CIERRE_LABELS[tc] ?? tc}` : null;
    }
    case "devolucion":
      if (detalle.corta_freetime === true) return "corta el freetime";
      if (detalle.corta_freetime === false) return "no corta el freetime";
      return null;
    case "anulacion":
      return s("motivo") ? `motivo: ${s("motivo")}` : null;
    case "waiver": {
      const d = detalle.dias;
      return joinParts([
        typeof d === "number" ? `${d} día${d === 1 ? "" : "s"} condonado${d === 1 ? "" : "s"}` : null,
        s("motivo") ? `motivo: ${s("motivo")}` : null,
        s("referencia") ? `ref: ${s("referencia")}` : null,
      ]);
    }
    case "incidencia": {
      // M5-030: dos shapes distintas bajo el mismo tipo_evento — se distinguen por
      // detalle.accion (solo presente en los eventos que emite crm_actualizar_reclamo).
      // El alta (crm_crear_incidencia, 030/032) nunca trae `accion` → cae al shape de abajo.
      if (s("accion") === "reclamo") {
        const cambiosRaw = detalle.cambios;
        const cambios: Record<string, { de: unknown; a: unknown }> =
          cambiosRaw && typeof cambiosRaw === "object" && !Array.isArray(cambiosRaw)
            ? (cambiosRaw as Record<string, { de: unknown; a: unknown }>)
            : {};
        const piezas = Object.entries(cambios).map(([campo, cambio]) => {
          if (campo === "estado_reclamo") {
            const de = typeof cambio.de === "string" ? (ESTADO_RECLAMO_LABELS[cambio.de] ?? cambio.de) : "—";
            const a = typeof cambio.a === "string" ? (ESTADO_RECLAMO_LABELS[cambio.a] ?? cambio.a) : "—";
            return `estado ${de} → ${a}`;
          }
          if (campo === "resultado") {
            const de = typeof cambio.de === "string" ? (RESULTADO_RECLAMO_LABELS[cambio.de] ?? cambio.de) : "—";
            const a = typeof cambio.a === "string" ? (RESULTADO_RECLAMO_LABELS[cambio.a] ?? cambio.a) : "—";
            return `resultado ${de} → ${a}`;
          }
          if (campo === "monto_usd") {
            const de = typeof cambio.de === "number" ? fmtUSDTarifa(cambio.de) : "—";
            const a = typeof cambio.a === "number" ? fmtUSDTarifa(cambio.a) : "—";
            return `monto ${de} → ${a}`;
          }
          if (campo === "responsable") {
            return `responsable ${fmtDetalleValor(cambio.de)} → ${fmtDetalleValor(cambio.a)}`;
          }
          // campo no reconocido (extensión futura de crm_actualizar_reclamo) → genérico
          return `${campo} ${fmtDetalleValor(cambio.de)} → ${fmtDetalleValor(cambio.a)}`;
        });
        const resumen = piezas.length > 0 ? `Reclamo: ${piezas.join(" · ")}` : "Reclamo";
        return joinParts([resumen, s("nota") ? `nota: ${s("nota")}` : null]);
      }
      // alta (crm_crear_incidencia, 030/032) — humanizar el enum con el mapa único de M7
      // (mismo label que el badge de /incidencias)
      const tipoInc = s("tipo");
      return joinParts([tipoInc ? (TIPO_INCIDENCIA_LABELS[tipoInc] ?? tipoInc) : null, s("descripcion")]);
    }
    case "correccion":
      return `${s("campo") ?? "campo"}: ${fmtDetalleValor(detalle.anterior)} → ${fmtDetalleValor(detalle.nuevo)}`;
    default:
      // tipo no reconocido → render genérico clave: valor
      return joinParts(Object.entries(detalle).map(([k, v]) => `${k}: ${fmtDetalleValor(v)}`));
  }
}

/* ---------- piezas de layout ---------- */

function SectionTitle({ title, count }: { title: string; count: number | null }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "0 0 10px" }}>
      <span className="fd-display fd-display-sm" style={{ color: "var(--color-text-secondary)" }}>
        {title}
      </span>
      {count != null && (
        <span className="mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          {count}
        </span>
      )}
    </div>
  );
}

function DataItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="fd-label" style={{ marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>{children}</div>
    </div>
  );
}

function FichaSkeleton() {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <SkeletonBlock width={230} height={24} />
        <SkeletonBlock width={90} height={20} delay={150} />
        <SkeletonBlock width={130} height={20} delay={300} />
      </div>
      <div style={GRID2}>
        <div style={CARD}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} height={14} delay={i * 150} width={`${85 - i * 8}%`} style={{ marginBottom: 14 }} />
          ))}
        </div>
        <div style={CARD}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} height={14} delay={i * 150} width={`${90 - i * 6}%`} style={{ marginBottom: 14 }} />
          ))}
        </div>
      </div>
    </>
  );
}

const GRID2: React.CSSProperties = {
  display: "grid",
  gap: 18,
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))",
  alignItems: "start",
};

// Formato UUID del segmento de ruta: un id malformado se corta ANTES de armar
// queries — cero requests a Supabase (el manejo de 22P02 en load() queda como backstop).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ---------- página ---------- */

export default function ContenedorFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { perfil } = useSession();

  const [data, setData] = useState<FichaData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const reqIdRef = useRef(0);

  const [moverOpen, setMoverOpen] = useState(false);
  const [llegadaOpen, setLlegadaOpen] = useState(false);
  const [anularOpen, setAnularOpen] = useState(false);
  const [reforzadoOpen, setReforzadoOpen] = useState(false);
  const [waiverOpen, setWaiverOpen] = useState(false);
  const [corregirOpen, setCorregirOpen] = useState(false);
  const [anularWaiver, setAnularWaiver] = useState<{ id: string; dias: number } | null>(null);
  const [consolidarOpen, setConsolidarOpen] = useState(false);
  const [desconsolidarOpen, setDesconsolidarOpen] = useState(false);

  const load = useCallback(async () => {
    const rid = ++reqIdRef.current;
    // id malformado → "no encontrado" directo, sin tocar la red
    if (!UUID_RE.test(id)) {
      setData(null);
      setLoadError(null);
      setNotFound(true);
      return;
    }
    const supabase = getSupabase();
    const [c, ops, pl, us] = await Promise.all([
      supabase
        .from("contenedores")
        .select(
          "id, numero_contenedor, tipo, reforzado_estado, reforzado_validado_por, reforzado_fecha_validacion, naviera:navieras(nombre)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("operaciones")
        .select(
          "id, estado, estado_carga, fecha_retiro, retiro_de, booking_retiro, orden, shp, booking_asignado, buque, destino, fecha_egreso_planta, tipo_cierre, fecha_devolucion, anulada_motivo, planta_actual_id, planta_actual:plantas(nombre)",
        )
        .eq("contenedor_id", id)
        .order("fecha_retiro", { ascending: false }),
      supabase.from("plantas").select("id, nombre").order("nombre"),
      supabase.from("usuarios_publicos").select("id, nombre"),
    ]);
    if (rid !== reqIdRef.current) return;

    // uuid malformado → 22P02 de Postgres: es "no encontrado", no un error de sistema
    if (c.error?.code === "22P02" || ops.error?.code === "22P02") {
      setData(null);
      setLoadError(null);
      setNotFound(true);
      return;
    }
    const firstError = c.error ?? ops.error ?? pl.error ?? us.error;
    if (firstError) {
      setData(null);
      setNotFound(false);
      setLoadError(firstError.message);
      return;
    }
    if (!c.data) {
      setData(null);
      setLoadError(null);
      setNotFound(true);
      return;
    }

    const operaciones = ops.data as unknown as OperacionFicha[];
    const openOp = operaciones.find((o) => o.estado !== "cerrado" && o.estado !== "anulada") ?? null;
    const opIds = operaciones.map((o) => o.id);

    let eventos: EventoRow[] = [];
    if (opIds.length > 0) {
      const ev = await supabase
        .from("operacion_eventos")
        .select("id, operacion_id, tipo_evento, fecha, usuario_id, detalle")
        .in("operacion_id", opIds)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(300);
      if (rid !== reqIdRef.current) return;
      if (ev.error) {
        setData(null);
        setNotFound(false);
        setLoadError(ev.error.message);
        return;
      }
      eventos = ev.data as unknown as EventoRow[];
    }

    let movimientos: MovimientoFicha[] = [];
    if (openOp) {
      // embeds origen/destino desambiguados por nombre de FK (dos FKs a plantas)
      const mv = await supabase
        .from("movimientos_planta")
        .select(
          "id, estado, medio, fecha_salida, fecha_llegada_confirmada, planta_origen_id, planta_destino_id, planta_origen:plantas!movimientos_planta_planta_origen_id_fkey(nombre), planta_destino:plantas!movimientos_planta_planta_destino_id_fkey(nombre)",
        )
        .eq("operacion_id", openOp.id)
        .order("fecha_salida", { ascending: false });
      if (rid !== reqIdRef.current) return;
      if (mv.error) {
        setData(null);
        setNotFound(false);
        setLoadError(mv.error.message);
        return;
      }
      movimientos = mv.data as unknown as MovimientoFicha[];
    }

    // costos de la operación mostrada (la misma que elige el render: abierta, o la
    // última). Abierta → vista_alertas; cerrada → vista_kpi_costos_cerradas (solo tiene
    // filas con fecha_devolucion). Fetch TOLERANTE: los números son informativos — si
    // falla o no hay fila, la ficha sale igual sin el bloque de costos.
    let costos: CostosFicha | null = null;
    const targetOp = openOp ?? operaciones[0] ?? null;
    if (targetOp && targetOp.estado !== "anulada") {
      const vista = targetOp.estado === "cerrado" ? "vista_kpi_costos_cerradas" : "vista_alertas";
      const co = await supabase
        .from(vista)
        .select("costo_bruto, costo_absorbido, costo_neto, waiver_dias, dias_libres, tarifa_usd_dia, sin_cargo")
        .eq("operacion_id", targetOp.id)
        .maybeSingle();
      if (rid !== reqIdRef.current) return;
      if (!co.error && co.data) costos = co.data as CostosFicha;
    }

    // historial de waivers (021) de la MISMA operación mostrada — READ directo
    // permitido (RLS scopea por visibilidad de la operación); se pide siempre que haya
    // targetOp (incluso anulada: es historial, no una acción nueva).
    let waivers: OperacionWaiverRow[] = [];
    if (targetOp) {
      const wv = await supabase
        .from("operacion_waivers")
        .select("id, dias, motivo, referencia, registrado_por, created_at, estado, anulado_motivo, anulado_por, anulado_fecha")
        .eq("operacion_id", targetOp.id)
        .order("created_at", { ascending: false });
      if (rid !== reqIdRef.current) return;
      if (wv.error) {
        setData(null);
        setNotFound(false);
        setLoadError(wv.error.message);
        return;
      }
      waivers = wv.data as unknown as OperacionWaiverRow[];
    }

    // carga actual (029) de la MISMA operación mostrada — READ directo (RLS scopea
    // transitivamente vía la operación). Fetch TOLERANTE: es informativo (D3), si falla
    // o no hay fila (vacío) la ficha sale igual sin el bloque de carga.
    let cargaActual: CargaActualRow | null = null;
    if (targetOp) {
      const ca = await supabase
        .from("vista_carga_actual")
        .select("operacion_id, lineas, total_bolsas")
        .eq("operacion_id", targetOp.id)
        .maybeSingle();
      if (rid !== reqIdRef.current) return;
      if (!ca.error && ca.data) cargaActual = ca.data as unknown as CargaActualRow;
    }

    setLoadError(null);
    setNotFound(false);
    setData({
      contenedor: c.data as unknown as ContenedorFicha,
      operaciones,
      eventos,
      movimientos,
      plantas: pl.data as PlantaOption[],
      usuarios: us.data as UsuarioPublico[],
      costos,
      waivers,
      cargaActual,
    });
  }, [id]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // refetch al recuperar foco (mismo criterio que la planilla y los módulos M3/M4)
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const loading = data === null && !loadError && !notFound;
  const canSupAdmin = perfil?.rol === "supervisor" || perfil?.rol === "administrador";

  const plantasById = useMemo(() => new Map((data?.plantas ?? []).map((p) => [p.id, p.nombre])), [data]);
  const usuariosById = useMemo(() => new Map((data?.usuarios ?? []).map((u) => [u.id, u.nombre])), [data]);
  const plantaNombre = useCallback(
    (pid: unknown) => (typeof pid === "string" ? (plantasById.get(pid) ?? "—") : "—"),
    [plantasById],
  );

  const openOp = useMemo(
    () => data?.operaciones.find((o) => o.estado !== "cerrado" && o.estado !== "anulada") ?? null,
    [data],
  );
  // pendiente inter-planta: en_transito con origen (el movimiento inicial retiro→planta
  // no tiene origen y se confirma desde /ingreso, no acá)
  const pendingMoves = useMemo(
    () => (data?.movimientos ?? []).filter((m) => m.estado === "en_transito" && m.planta_origen_id !== null),
    [data],
  );

  // Total vigente (021): fuente PRIMARIA es waiver_dias de la view (costos) — mismo
  // número que ya rige bruto/absorbido/neto. Si no hay fila de view (op anulada, sin
  // tarifa vigente, o fetch tolerante que falló), fallback a sumar los `dias` YA
  // devueltos por el historial — es tally de un campo dado, no cálculo de costo.
  const waiverTotalVigente = useMemo(() => {
    if (!data) return 0;
    if (data.costos?.waiver_dias != null) return data.costos.waiver_dias;
    return data.waivers.filter((w) => w.estado === "vigente").reduce((sum, w) => sum + w.dias, 0);
  }, [data]);

  const timelineItems: TimelineItem[] = useMemo(() => {
    if (!data) return [];
    const pendingRoutes = new Set(pendingMoves.map((m) => `${m.planta_origen_id}|${m.planta_destino_id}`));
    return data.eventos.map((e) => {
      // "en curso" SOLO si el movimiento sigue en_transito HOY (cruce contra la tabla
      // viva — el flag del jsonb quedó congelado al crearse el evento)
      const isPending =
        e.tipo_evento === "movimiento" &&
        e.operacion_id === openOp?.id &&
        e.detalle?.confirmado === false &&
        pendingRoutes.has(`${String(e.detalle?.origen_id)}|${String(e.detalle?.destino_id)}`);
      const status: TimelineStatus = isPending ? "en_curso" : "completado";
      const actor = e.usuario_id ? (usuariosById.get(e.usuario_id) ?? "—") : "—";
      const detail = joinParts([detalleTexto(e.tipo_evento, e.detalle, plantaNombre), `por ${actor}`]) ?? undefined;
      return {
        id: e.id,
        date: fmtFecha(e.fecha),
        time: fmtHora(e.fecha),
        title: EVENTO_LABELS[e.tipo_evento] ?? e.tipo_evento,
        detail,
        status,
      };
    });
  }, [data, openOp, pendingMoves, plantaNombre, usuariosById]);

  /* ---------- estados de página ---------- */

  if (notFound) {
    return (
      <>
        <PageHeader title="Contenedores" />
        <div style={CARD}>
          <EmptyState
            icon="ti-file-search"
            title="Contenedor no encontrado"
            action={
              <Button variant="primary" icon="ti-arrow-left" onClick={() => router.push("/contenedores")}>
                Volver a la planilla
              </Button>
            }
          >
            El enlace apunta a un contenedor que no existe o que tu cuenta no puede ver. Volvé a la planilla y abrí la
            ficha clickeando su fila — cada fila es un ciclo del contenedor.
          </EmptyState>
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Contenedores" />
        <div style={CARD}>
          <ErrorState title="No se pudo cargar la ficha" detail={loadError} onRetry={() => void load()} />
        </div>
      </>
    );
  }

  if (loading || !data) {
    return <FichaSkeleton />;
  }

  const cont = data.contenedor;
  const lastOp = data.operaciones[0] ?? null;
  const shownOp = openOp ?? lastOp;
  const reforzadoLabel =
    REFORZADO_OPTIONS.find((o) => o.value === cont.reforzado_estado)?.label ?? cont.reforzado_estado;
  const validadoNombre = cont.reforzado_validado_por ? (usuariosById.get(cont.reforzado_validado_por) ?? "—") : null;
  const hasAsignacion = !!(
    shownOp &&
    (shownOp.orden || shownOp.shp || shownOp.booking_asignado || shownOp.buque || shownOp.destino)
  );
  const hasCierre = !!(
    shownOp &&
    (shownOp.fecha_egreso_planta || shownOp.fecha_devolucion || (shownOp.tipo_cierre && shownOp.tipo_cierre !== "pendiente"))
  );

  return (
    <>
      {/* ---------- header: volver + número + badges + acciones de contenedor ---------- */}
      <div style={{ marginBottom: 8 }}>
        <Button
          variant="ghost"
          icon="ti-arrow-left"
          onClick={() => router.push("/contenedores")}
          style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}
        >
          Planilla
        </Button>
      </div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
        <h2 className="fd-display fd-display-lg" style={{ margin: 0, color: "var(--color-text-primary)" }}>
          <ContainerNumber value={cont.numero_contenedor} />
        </h2>
        <Badge tone="neutro" icon="ti-anchor">
          {cont.naviera?.nombre ?? "sin naviera"}
        </Badge>
        <Badge tone="neutro" mono>
          {cont.tipo}
        </Badge>
        <Badge tone={REFORZADO_TONE[cont.reforzado_estado] ?? "neutro"} icon="ti-shield">
          {reforzadoLabel.toLowerCase()}
        </Badge>
        {data.operaciones.length > 0 && (
          <Badge tone="neutro" mono icon="ti-history">
            {data.operaciones.length} ciclo{data.operaciones.length === 1 ? "" : "s"}
          </Badge>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canSupAdmin && (
            <Button variant="ghost" icon="ti-shield-check" onClick={() => setReforzadoOpen(true)}>
              Validar reforzado
            </Button>
          )}
          <Button variant="ghost" icon="ti-refresh" onClick={() => void load()}>
            Actualizar
          </Button>
        </div>
      </div>
      {(validadoNombre || cont.reforzado_fecha_validacion) && (
        <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginBottom: 14 }}>
          Reforzado validado por {validadoNombre ?? "—"} — {fmtFechaHora(cont.reforzado_fecha_validacion)}
        </div>
      )}

      <div style={{ ...GRID2, marginTop: 12 }}>
        {/* ---------- columna 1: operación actual + acciones ---------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionTitle title={openOp ? "Operación actual" : "Última operación"} count={null} />

          {/* movimiento inter-planta pendiente: visible arriba para que no quede invisible */}
          {pendingMoves.length > 0 && (
            <div
              style={{
                ...CARD,
                borderColor: "var(--color-amber-line)",
                background: "var(--color-amber-tint)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--color-status-amber)",
                }}
              >
                <i className="ti ti-truck" aria-hidden />
                Movimiento entre plantas en tránsito
              </div>
              {pendingMoves.map((m) => (
                <div key={m.id} style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
                  <strong>{m.planta_origen?.nombre ?? "—"}</strong> → <strong>{m.planta_destino?.nombre ?? "—"}</strong>
                  {m.medio ? ` · ${medioLabel(m.medio)}` : ""} · salió el{" "}
                  <span className="mono">{fmtFecha(m.fecha_salida)}</span>
                </div>
              ))}
              <div style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
                La operación sigue <strong>en planta {shownOp?.planta_actual?.nombre ?? "—"}</strong> hasta que
                confirmes la llegada.
              </div>
              <div>
                <Button variant="primary" icon="ti-circle-check" onClick={() => setLlegadaOpen(true)}>
                  Confirmar llegada
                </Button>
              </div>
            </div>
          )}

          {shownOp ? (
            <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 14 }}>
              {!openOp && (
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  <i className="ti ti-info-circle" aria-hidden /> Sin ciclo abierto — un ciclo nuevo se abre desde la
                  solapa <strong>Ingreso</strong>. Esta es la última operación registrada.
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                <DataItem label="estado">
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <EstadoOperacionBadge estado={shownOp.estado} />
                    <EstadoCargaBadge estadoCarga={shownOp.estado_carga} />
                  </div>
                </DataItem>
                <DataItem label="planta actual">{shownOp.planta_actual?.nombre ?? "—"}</DataItem>
                <DataItem label="fecha retiro">
                  <span className="mono">{fmtFecha(shownOp.fecha_retiro)}</span>
                </DataItem>
                <DataItem label="retiro de">{shownOp.retiro_de}</DataItem>
                <DataItem label="booking retiro">
                  {shownOp.booking_retiro ? <span className="mono">{shownOp.booking_retiro}</span> : "—"}
                </DataItem>
                {hasAsignacion && (
                  <>
                    <DataItem label="orden">
                      {shownOp.orden ? <span className="mono">{shownOp.orden}</span> : "—"}
                    </DataItem>
                    <DataItem label="shp">{shownOp.shp ? <span className="mono">{shownOp.shp}</span> : "—"}</DataItem>
                    <DataItem label="booking asignado">
                      {shownOp.booking_asignado ? <span className="mono">{shownOp.booking_asignado}</span> : "—"}
                    </DataItem>
                    <DataItem label="buque">{shownOp.buque ?? "—"}</DataItem>
                    <DataItem label="destino">{shownOp.destino ?? "—"}</DataItem>
                  </>
                )}
                {hasCierre && (
                  <>
                    <DataItem label="tipo de cierre">
                      {shownOp.tipo_cierre ? (TIPO_CIERRE_LABELS[shownOp.tipo_cierre] ?? shownOp.tipo_cierre) : "—"}
                    </DataItem>
                    <DataItem label="fecha egreso planta">
                      <span className="mono">{fmtFecha(shownOp.fecha_egreso_planta)}</span>
                    </DataItem>
                    <DataItem label="fecha devolución">
                      <span className="mono">{fmtFecha(shownOp.fecha_devolucion)}</span>
                    </DataItem>
                  </>
                )}
              </div>
              {shownOp.estado === "anulada" && shownOp.anulada_motivo && (
                <FormAlert tone="warning">
                  Motivo de la anulación: <strong>{shownOp.anulada_motivo}</strong>
                </FormAlert>
              )}
              {(openOp || (canSupAdmin && shownOp.estado !== "anulada")) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {openOp?.estado === "en_planta" && (
                    <Button variant="ghost" icon="ti-transfer" onClick={() => setMoverOpen(true)}>
                      Mover entre plantas
                    </Button>
                  )}
                  {/* consolidar/desconsolidar (029, D3 — informativo): solo en_planta, mismo
                      gate que "mover entre plantas" */}
                  {openOp?.estado === "en_planta" && (
                    <Button variant="ghost" icon="ti-package-import" onClick={() => setConsolidarOpen(true)}>
                      {openOp.estado_carga === "lleno" ? "Agregar carga" : "Consolidar"}
                    </Button>
                  )}
                  {openOp?.estado === "en_planta" && openOp.estado_carga === "lleno" && (
                    <Button variant="ghost" icon="ti-package-export" onClick={() => setDesconsolidarOpen(true)}>
                      Desconsolidar
                    </Button>
                  )}
                  {/* waiver (019): sup+ sobre cualquier operación no anulada — la naviera
                      suele condonar días DESPUÉS del cierre, por eso no se gatea a abierta */}
                  {canSupAdmin && shownOp.estado !== "anulada" && (
                    <Button variant="ghost" icon="ti-discount" onClick={() => setWaiverOpen(true)}>
                      Registrar waiver
                    </Button>
                  )}
                  {/* corrección F-02 (020): sup+, SOLO operación cerrada */}
                  {canSupAdmin && shownOp.estado === "cerrado" && (
                    <Button variant="ghost" icon="ti-pencil-check" onClick={() => setCorregirOpen(true)}>
                      Corregir dato
                    </Button>
                  )}
                  {openOp && canSupAdmin && (
                    <Button variant="danger" icon="ti-ban" onClick={() => setAnularOpen(true)}>
                      Anular operación
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={CARD}>
              <EmptyState icon="ti-truck-loading" title="Sin operaciones registradas">
                Este contenedor todavía no tiene ningún ciclo. Los ciclos se crean desde la solapa{" "}
                <strong>Ingreso</strong> con una tanda de retiro; al cargar una, el ciclo aparece acá con su historial.
              </EmptyState>
            </div>
          )}

          {/* ---------- carga actual (029, D3 — informativo): solo si está lleno ---------- */}
          {shownOp && shownOp.estado_carga === "lleno" && (
            <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                className="fd-label"
                style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-text-secondary)" }}
              >
                <i className="ti ti-box" aria-hidden />
                Carga actual
                {data.cargaActual && data.cargaActual.lineas.length > 0 && (
                  <span className="mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    {data.cargaActual.lineas.length} producto{data.cargaActual.lineas.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              {!data.cargaActual || data.cargaActual.lineas.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  El estado dice «lleno» pero no hay líneas de carga vigentes — usá <strong>Consolidar</strong> para
                  cargar el detalle, o <strong>Desconsolidar</strong> si en realidad está vacío.
                </span>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                    <thead>
                      <tr>
                        <th style={TH_MINI}>gmid</th>
                        <th style={TH_MINI}>descripción</th>
                        <th style={{ ...TH_MINI, textAlign: "right" }}>bolsas</th>
                        <th style={TH_MINI}>lote</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.cargaActual.lineas.map((l, i) => (
                        <tr key={`${l.gmid}-${l.lote ?? ""}-${i}`}>
                          <td style={TD_MINI} className="mono">{l.gmid}</td>
                          <td style={TD_MINI}>{l.descripcion}</td>
                          <td style={{ ...TD_MINI, textAlign: "right" }} className="mono">
                            {l.cantidad_bolsas.toLocaleString("es-AR")}
                          </td>
                          <td style={TD_MINI}>{l.lote ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={{ ...TD_MINI, fontWeight: 700, borderBottom: "none" }} colSpan={2}>
                          Total
                        </td>
                        <td
                          style={{ ...TD_MINI, textAlign: "right", fontWeight: 700, borderBottom: "none" }}
                          className="mono"
                        >
                          {data.cargaActual.total_bolsas.toLocaleString("es-AR")}
                        </td>
                        <td style={{ ...TD_MINI, borderBottom: "none" }} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ---------- detention: bruto / absorbido / neto (views 019 — cero cálculo acá) ---------- */}
          {shownOp && shownOp.estado !== "anulada" && data.costos && (
            <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                className="fd-label"
                style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-text-secondary)" }}
              >
                <i className="ti ti-cash" aria-hidden />
                Detention {shownOp.estado === "cerrado" ? "realizado" : "proyectado"}
                {data.costos.sin_cargo && <Badge tone="neutro">sin cargo</Badge>}
              </div>
              {data.costos.costo_bruto == null && !data.costos.sin_cargo ? (
                <span style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                  Sin tarifa vigente para la fecha de retiro (o la naviera no cobra detention en origen) — no hay costo
                  calculado.
                </span>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
                  <DataItem label="costo bruto">
                    <span className="mono">{fmtUSD(data.costos.costo_bruto)}</span>
                  </DataItem>
                  <DataItem label="absorbido (waiver / sin cargo)">
                    <span className="mono">{fmtUSD(data.costos.costo_absorbido)}</span>
                  </DataItem>
                  <DataItem label="costo neto">
                    <span className="mono" style={{ fontWeight: 700 }}>
                      {fmtUSD(data.costos.costo_neto)}
                    </span>
                  </DataItem>
                </div>
              )}
              {waiverTotalVigente > 0 && (
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
                  <i className="ti ti-discount" aria-hidden style={{ color: "var(--color-status-green)" }} /> Waiver
                  acumulado vigente:{" "}
                  <strong>
                    {waiverTotalVigente} día{waiverTotalVigente === 1 ? "" : "s"}
                  </strong>{" "}
                  — detalle por registro en <strong>Waivers</strong>, más abajo.
                </div>
              )}
            </div>
          )}

          {/* ---------- historial de waivers (021): registros individuales, anulables sup+ ---------- */}
          {shownOp && (
            <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                className="fd-label"
                style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-text-secondary)" }}
              >
                <i className="ti ti-discount" aria-hidden />
                Waivers
                {data.waivers.length > 0 && (
                  <span className="mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    {data.waivers.length}
                  </span>
                )}
              </div>
              {data.waivers.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  Sin waivers registrados en esta operación.
                </span>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {data.waivers.map((w, i) => {
                    const anulado = w.estado === "anulado";
                    const quien = usuariosById.get(w.registrado_por) ?? "—";
                    return (
                      <div
                        key={w.id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          padding: "10px 0",
                          borderTop: i === 0 ? undefined : "1px solid var(--color-border-subtle)",
                          opacity: anulado ? 0.6 : 1,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                          <span
                            className="mono"
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              textDecoration: anulado ? "line-through" : "none",
                              color: "var(--color-text-primary)",
                            }}
                          >
                            {w.dias} día{w.dias === 1 ? "" : "s"}
                          </span>
                          <Badge tone={anulado ? "neutro" : "verde"}>{anulado ? "anulado" : "vigente"}</Badge>
                          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-text-muted)" }}>
                            {fmtFecha(w.created_at)} · por {quien}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--color-text-secondary)",
                            textDecoration: anulado ? "line-through" : "none",
                          }}
                        >
                          {w.motivo}
                          {w.referencia ? (
                            <>
                              {" "}
                              · ref: <span className="mono">{w.referencia}</span>
                            </>
                          ) : null}
                        </div>
                        {anulado && (
                          <div style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
                            Anulado por {w.anulado_por ? (usuariosById.get(w.anulado_por) ?? "—") : "—"}
                            {w.anulado_fecha ? <> el {fmtFecha(w.anulado_fecha)}</> : null}
                            {w.anulado_motivo ? <> — motivo: {w.anulado_motivo}</> : null}
                          </div>
                        )}
                        {!anulado && canSupAdmin && (
                          <div>
                            <Button
                              variant="ghost"
                              icon="ti-ban"
                              style={{ minHeight: 0, padding: "4px 10px", fontSize: 11.5 }}
                              onClick={() => setAnularWaiver({ id: w.id, dias: w.dias })}
                            >
                              Anular
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---------- columna 2: historial (timeline) ---------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionTitle title="Historial" count={data.eventos.length} />
          <div style={{ ...CARD, maxHeight: 560, overflowY: "auto" }}>
            {timelineItems.length > 0 ? (
              <Timeline items={timelineItems} />
            ) : (
              <EmptyState icon="ti-timeline" title="Sin eventos registrados">
                Acá aparece cada evento del contenedor (retiro, ingreso a planta, movimientos, egreso, devolución…) con
                fecha y usuario. Se registran solos a medida que operás desde <strong>Ingreso</strong> y{" "}
                <strong>Egreso</strong>.
              </EmptyState>
            )}
          </div>
        </div>
      </div>

      {/* ---------- modales de acción ---------- */}
      {moverOpen && openOp && (
        <MoverPlantasModal
          operacionId={openOp.id}
          plantaActualId={openOp.planta_actual_id}
          plantaActualNombre={openOp.planta_actual?.nombre ?? "—"}
          plantas={data.plantas}
          onClose={() => setMoverOpen(false)}
          onDone={() => {
            setMoverOpen(false);
            void load();
          }}
        />
      )}
      {llegadaOpen && openOp && (
        <ConfirmarLlegadaModal
          operacionId={openOp.id}
          movimientos={pendingMoves}
          onClose={() => setLlegadaOpen(false)}
          onDone={() => {
            setLlegadaOpen(false);
            void load();
          }}
        />
      )}
      {anularOpen && openOp && (
        <AnularOperacionModal
          operacionId={openOp.id}
          numeroContenedor={cont.numero_contenedor}
          onClose={() => setAnularOpen(false)}
          onDone={() => {
            setAnularOpen(false);
            void load();
          }}
        />
      )}
      {waiverOpen && shownOp && (
        <RegistrarWaiverModal
          operacionId={shownOp.id}
          numeroContenedor={cont.numero_contenedor}
          totalVigente={waiverTotalVigente}
          onClose={() => setWaiverOpen(false)}
          onDone={() => {
            setWaiverOpen(false);
            void load();
          }}
        />
      )}
      {anularWaiver && (
        <AnularWaiverModal
          waiverId={anularWaiver.id}
          numeroContenedor={cont.numero_contenedor}
          dias={anularWaiver.dias}
          onClose={() => setAnularWaiver(null)}
          onDone={() => {
            setAnularWaiver(null);
            void load();
          }}
        />
      )}
      {corregirOpen && shownOp && (
        <CorregirDatoModal
          operacionId={shownOp.id}
          numeroContenedor={cont.numero_contenedor}
          onClose={() => setCorregirOpen(false)}
          onDone={() => {
            setCorregirOpen(false);
            void load();
          }}
        />
      )}
      {consolidarOpen && openOp && (
        <ConsolidarModal
          operacionId={openOp.id}
          numeroContenedor={cont.numero_contenedor}
          yaLleno={openOp.estado_carga === "lleno"}
          onClose={() => setConsolidarOpen(false)}
          onDone={() => {
            setConsolidarOpen(false);
            void load();
          }}
        />
      )}
      {desconsolidarOpen && openOp && (
        <DesconsolidarModal
          operacionId={openOp.id}
          numeroContenedor={cont.numero_contenedor}
          totalBolsas={data.cargaActual?.total_bolsas ?? 0}
          onClose={() => setDesconsolidarOpen(false)}
          onDone={() => {
            setDesconsolidarOpen(false);
            void load();
          }}
        />
      )}
      {reforzadoOpen && (
        <ValidarReforzadoModal
          contenedorId={cont.id}
          numeroContenedor={cont.numero_contenedor}
          estadoActual={cont.reforzado_estado}
          onClose={() => setReforzadoOpen(false)}
          onDone={() => {
            setReforzadoOpen(false);
            void load();
          }}
        />
      )}
    </>
  );
}
