"use client";

// Acciones de plata de IMPORTACIÓN (migración 039 — cierra el hueco "falta la RPC" que
// llegó a prod sin pantalla: crm_registrar_waiver_impo, crm_anular_waiver_impo,
// crm_corregir_operacion_impo_cerrada existían sin ningún caller). Mismo patrón de
// seguridad y de negocio que acciones.tsx (EXPO, 021/020): la lógica vive en las RPCs,
// acá solo se arman payloads, se muestran errores P0001 LITERALES y se dispara el refresh.
//
// Diferencia deliberada con acciones.tsx: IMPO no tiene ficha propia en v1 (alertas/
// page.tsx: "el click de una fila IMPO navega a /importacion, no a una ficha"). Por eso
// las 3 acciones (alta de waiver, anular waiver, corregir fecha de cerrada) no viven en 3
// modales disparados desde una página con cards — viven DENTRO de un único panel
// <AccionesPlataImpo>, abierto desde un botón por fila en /importacion. Anular waiver y
// corregir fecha usan ConfirmDialog con el motivo embebido en `message` (patrón YA usado
// por DesconsolidarModal en acciones.tsx) en vez del Modal + Textarea standalone de
// AnularWaiverModal/CorregirDatoModal — layout distinto, misma disciplina de
// validación/errores/confirmación.
//
// GATING por rol: el punto de entrada en /importacion ya está detrás de `canAnular`
// (supervisor/administrador) — mismo gate que el botón "Anular" de esa tabla. Acá adentro
// se repite el check (UX, defensa en profundidad) por si el componente se reusa desde otro
// entry point sin ese gate. El enforcement real es siempre la RPC + RLS.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/fd/button";
import { DateField, Field, Input, Select, Textarea } from "@/components/fd/fields";
import { FormAlert } from "@/components/fd/form-alert";
import { ConfirmDialog, Modal } from "@/components/fd/modal";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { useToast } from "@/components/fd/toast";
import { ContainerNumber } from "@/components/container-number";
import { fmtFecha, fmtUSD } from "@/lib/format";
import { useSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";
import { EstadoImpoBadge } from "./estado-impo";

export type OperacionPlataImpo = {
  id: string;
  estado: string;
  numeroContenedor: string;
  numeroOrden: string;
};

// Fila de crm.operacion_impo_waivers (039) — espejo de OperacionWaiverRow (EXPO, 021).
// READ directo permitido (RLS scopea por visibilidad de la operación); escritura SOLO
// vía crm_registrar_waiver_impo/crm_anular_waiver_impo.
type WaiverImpoRow = {
  id: string;
  dias: number;
  motivo: string;
  referencia: string | null;
  registrado_por: string;
  created_at: string;
  estado: "vigente" | "anulado";
  anulado_motivo: string | null;
  anulado_por: string | null;
  anulado_fecha: string | null;
};

// numeric-como-string posible de PostgREST (mismo contrato documentado en
// reportes/impo-section.tsx) — se normaliza SIEMPRE antes de usar.
type RawNum = string | number | null;
const toNum = (v: RawNum): number | null => (v == null ? null : Number(v));

type Numeros = {
  exceso_total: number | null;
  dias_waiver: number | null;
  costo_bruto: number | null;
  /** costo_proyectado (abierta) o costo_realizado (cerrada), copiado literal — nunca las
   *  dos sumadas, nunca recalculado (mismo invariante que reportes/impo-section.tsx). */
  costo_neto: number | null;
};

const LABEL_ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  color: "var(--color-text-secondary)",
};

const SECTION: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  paddingTop: 16,
  borderTop: "1px solid var(--color-border-subtle)",
};

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="fd-label" style={{ marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--color-text-primary)" }}>{children}</div>
    </div>
  );
}

// Whitelist EXACTA de crm_corregir_operacion_impo_cerrada (039): solo las 3 fechas, los
// textos logísticos de la orden quedan fuera de alcance (comentario de la propia RPC).
const CAMPOS_CORRECCION_IMPO: { value: string; label: string }[] = [
  { value: "fecha_retiro_terminal", label: "Fecha de retiro de terminal" },
  { value: "fecha_ingreso_planta", label: "Fecha de ingreso a planta" },
  { value: "fecha_devolucion", label: "Fecha de devolución" },
];

/* ================= Anular waiver (ConfirmDialog — motivo obligatorio) ================= */

function AnularWaiverImpoConfirm({
  waiver,
  numeroContenedor,
  onClose,
  onDone,
}: {
  waiver: { id: string; dias: number };
  numeroContenedor: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [motivo, setMotivo] = useState("");
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const motivoError = touched && motivo.trim() === "" ? "el motivo es obligatorio" : null;
  const valid = motivo.trim() !== "";

  const submit = async () => {
    setTouched(true);
    setSubmitError(null);
    if (!valid || sending) return;
    setSending(true);
    const { error } = await getSupabase().rpc("crm_anular_waiver_impo", {
      p_waiver: waiver.id,
      p_motivo: motivo.trim(),
    });
    setSending(false);
    if (error) {
      // errores P0001 LITERALES (rol, ya anulado…)
      setSubmitError(error.message);
      return;
    }
    toast({
      type: "exito",
      title: "Waiver anulado",
      detail: `${numeroContenedor}: se anularon ${waiver.dias} día${waiver.dias === 1 ? "" : "s"} — el costo neto se recalcula solo.`,
    });
    onDone();
  };

  return (
    <ConfirmDialog
      open
      title="Anular waiver"
      confirmLabel="Anular waiver"
      cancelLabel="Cancelar"
      danger
      loading={sending}
      onConfirm={() => void submit()}
      onCancel={sending ? () => {} : onClose}
      message={
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span>
            Se anulan{" "}
            <strong>
              {waiver.dias} día{waiver.dias === 1 ? "" : "s"}
            </strong>{" "}
            de waiver de <span className="mono">{numeroContenedor}</span>. Los demás waivers vigentes de la operación
            no se tocan.
          </span>
          <Field
            label="motivo de la anulación"
            htmlFor="anular-waiver-impo-motivo"
            error={motivoError}
            hint="queda en el historial del waiver"
          >
            <Textarea
              id="anular-waiver-impo-motivo"
              rows={2}
              value={motivo}
              error={motivoError}
              onChange={(e) => setMotivo(e.target.value)}
              onBlur={() => setTouched(true)}
            />
          </Field>
          {submitError && <FormAlert>{submitError}</FormAlert>}
        </div>
      }
    />
  );
}

/* ================= Corregir dato de la cerrada (ConfirmDialog) ================= */

function CorregirFechaImpoConfirm({
  operacionId,
  numeroContenedor,
  onClose,
  onDone,
}: {
  operacionId: string;
  numeroContenedor: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [campo, setCampo] = useState("");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const campoDef = CAMPOS_CORRECCION_IMPO.find((c) => c.value === campo) ?? null;
  const campoError = attempted && campo === "" ? "elegí el campo a corregir" : null;
  const valorError = attempted && valor.trim() === "" ? "indicá la fecha nueva" : null;
  const motivoError = attempted && motivo.trim() === "" ? "el motivo es obligatorio" : null;
  const valid = campo !== "" && valor.trim() !== "" && motivo.trim() !== "";

  const selectCampo = (c: string) => {
    setCampo(c);
    setValor(""); // el valor anterior era de OTRO campo
    setSubmitError(null);
  };

  const submit = async () => {
    setAttempted(true);
    setSubmitError(null);
    if (!valid || sending) return;
    setSending(true);
    // ISO con zona AR a mediodía (mismo contrato que crm_corregir_operacion_cerrada de
    // EXPO, 020): el mediodía evita que un corrimiento de timezone cambie el día calendario.
    const p_valor = `${valor}T12:00:00-03:00`;
    const { error } = await getSupabase().rpc("crm_corregir_operacion_impo_cerrada", {
      p_operacion_impo: operacionId,
      p_campo: campo,
      p_valor,
      p_motivo: motivo.trim(),
    });
    setSending(false);
    if (error) {
      // errores P0001 LITERALES (campo fuera de whitelist, operación no cerrada,
      // coherencia de fechas, rol insuficiente…) — van tal cual al FormAlert
      setSubmitError(error.message);
      return;
    }
    toast({
      type: "exito",
      title: "Dato corregido",
      detail: `${numeroContenedor}: ${campoDef?.label.toLowerCase() ?? campo} actualizado — los números se recalculan solos.`,
    });
    onDone();
  };

  return (
    <ConfirmDialog
      open
      title="Corregir dato de la cerrada"
      confirmLabel="Corregir dato"
      cancelLabel="Cancelar"
      loading={sending}
      onConfirm={() => void submit()}
      onCancel={sending ? () => {} : onClose}
      message={
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span>
            Corrección sobre la operación <strong>cerrada</strong> de <span className="mono">{numeroContenedor}</span>.
            Queda un evento de corrección en el historial con el valor anterior, el nuevo y tu usuario.
          </span>
          <Field label="campo a corregir" htmlFor="correccion-impo-campo" error={campoError}>
            <Select
              id="correccion-impo-campo"
              value={campo}
              error={campoError}
              onChange={(e) => selectCampo(e.target.value)}
            >
              <option value="">— elegí el campo —</option>
              {CAMPOS_CORRECCION_IMPO.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          {campoDef && (
            <Field
              label={`valor nuevo — ${campoDef.label.toLowerCase()}`}
              htmlFor="correccion-impo-valor"
              error={valorError}
            >
              <DateField
                id="correccion-impo-valor"
                value={valor}
                error={valorError}
                onChange={(e) => setValor(e.target.value)}
              />
            </Field>
          )}
          <Field
            label="motivo"
            htmlFor="correccion-impo-motivo"
            error={motivoError}
            hint="queda en el historial de la operación"
          >
            <Textarea
              id="correccion-impo-motivo"
              rows={2}
              value={motivo}
              error={motivoError}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Field>
          {submitError && <FormAlert>{submitError}</FormAlert>}
        </div>
      }
    />
  );
}

/* ================= Alta de waiver (form embebido — no es un modal aparte) ================= */

function RegistrarWaiverImpoForm({
  operacionId,
  numeroContenedor,
  totalVigente,
  onRegistrado,
}: {
  operacionId: string;
  numeroContenedor: string;
  /** Suma de días vigentes YA registrados en la operación (039 — ACUMULATIVO, igual que
   *  el waiver de EXPO 021: el nuevo valor SE SUMA, no reemplaza). */
  totalVigente: number;
  onRegistrado: () => void;
}) {
  const toast = useToast();
  const [dias, setDias] = useState("");
  const [motivo, setMotivo] = useState("");
  const [referencia, setReferencia] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const diasNum = Number(dias);
  // validación EN VIVO para valor inválido; el vacío recién al intentar (patrón EXPO)
  const diasError =
    dias.trim() !== "" && (!Number.isInteger(diasNum) || diasNum <= 0)
      ? "días inválidos (entero > 0)"
      : attempted && dias.trim() === ""
        ? "indicá los días de waiver"
        : null;
  const motivoError = attempted && motivo.trim() === "" ? "el motivo es obligatorio" : null;
  const valid = dias.trim() !== "" && Number.isInteger(diasNum) && diasNum > 0 && motivo.trim() !== "";

  const submit = async () => {
    setAttempted(true);
    setSubmitError(null);
    if (!valid || sending) return;
    setSending(true);
    const { error } = await getSupabase().rpc("crm_registrar_waiver_impo", {
      p_operacion_impo: operacionId,
      p_dias: diasNum,
      p_motivo: motivo.trim(),
      p_referencia: referencia.trim() === "" ? null : referencia.trim(),
    });
    setSending(false);
    if (error) {
      // errores P0001 LITERALES (rol, días inválidos, operación anulada, waiver acumulado
      // que superaría el exceso…) — van tal cual al FormAlert, nunca genéricos
      setSubmitError(error.message);
      return;
    }
    toast({
      type: "exito",
      title: "Waiver registrado",
      detail: `${numeroContenedor}: ${diasNum} día${diasNum === 1 ? "" : "s"} sin cargo — el costo neto se recalcula solo.`,
    });
    setDias("");
    setMotivo("");
    setReferencia("");
    setAttempted(false);
    onRegistrado();
  };

  return (
    <div style={SECTION}>
      <div className="fd-label" style={LABEL_ROW}>
        <i className="ti ti-square-rounded-plus" aria-hidden />
        Registrar waiver
      </div>
      <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
        La naviera condona días de detention/demurrage de <span className="mono">{numeroContenedor}</span>. El waiver
        es plata: queda auditado con tu usuario, la fecha y el motivo.
      </div>
      <FormAlert tone="info">
        Se suma al waiver acumulado de la operación (hoy:{" "}
        <strong>
          {totalVigente} día{totalVigente === 1 ? "" : "s"} vigente{totalVigente === 1 ? "" : "s"}
        </strong>
        ). El total no puede superar los días excedidos.
      </FormAlert>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Field label="días condonados" htmlFor="waiver-impo-dias" error={diasError}>
          <Input
            id="waiver-impo-dias"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            className="mono"
            value={dias}
            error={diasError}
            onChange={(e) => setDias(e.target.value)}
            style={{ maxWidth: 140 }}
          />
        </Field>
        <div style={{ flex: "1 1 200px", minWidth: 180 }}>
          <Field label="referencia" htmlFor="waiver-impo-referencia" hint="opcional — nro. de caso / mail de la naviera">
            <Input
              id="waiver-impo-referencia"
              value={referencia}
              placeholder="opcional"
              onChange={(e) => setReferencia(e.target.value)}
            />
          </Field>
        </div>
      </div>
      <Field label="motivo" htmlFor="waiver-impo-motivo" error={motivoError} hint="queda en el historial de la operación">
        <Textarea
          id="waiver-impo-motivo"
          rows={2}
          value={motivo}
          error={motivoError}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </Field>
      {submitError && <FormAlert>{submitError}</FormAlert>}
      <div>
        <Button variant="primary" icon="ti-discount" loading={sending} disabled={!valid} onClick={() => void submit()}>
          Registrar waiver
        </Button>
      </div>
    </div>
  );
}

/* ================= Panel principal ================= */

export function AccionesPlataImpo({
  operacion,
  onClose,
  onDone,
}: {
  operacion: OperacionPlataImpo;
  onClose: () => void;
  /** Se llama tras CADA acción exitosa — el caller refresca su lista (los números de la
   *  view cambian). El panel NO se cierra solo: es un hub de varias acciones sobre la
   *  misma operación, se cierra con "Cerrar" o la X. */
  onDone: () => void;
}) {
  const { perfil } = useSession();
  const canEscribir = perfil?.rol === "supervisor" || perfil?.rol === "administrador";
  const esCerrada = operacion.estado === "cerrado";
  const esAnulada = operacion.estado === "anulada";

  const [numeros, setNumeros] = useState<Numeros | null>(null);
  const [numerosError, setNumerosError] = useState<string | null>(null);
  const [waivers, setWaivers] = useState<WaiverImpoRow[] | null>(null);
  const [waiversError, setWaiversError] = useState<string | null>(null);
  const [nombresPorId, setNombresPorId] = useState<Map<string, string>>(new Map());
  const [loaded, setLoaded] = useState(false);

  const [anularWaiverTarget, setAnularWaiverTarget] = useState<{ id: string; dias: number } | null>(null);
  const [corregirOpen, setCorregirOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    // números: abierta → vista_alertas_impo; cerrada → vista_kpi_costos_cerradas_impo
    // (mismo criterio que costos en la ficha EXPO). Fetch TOLERANTE: son informativos —
    // si falla o no hay fila (sin tarifa vigente) el resto del panel sigue funcionando.
    const [num, wv, us] = await Promise.all([
      esCerrada
        ? supabase
            .from("vista_kpi_costos_cerradas_impo")
            .select("exceso_total, dias_waiver, costo_bruto, costo_realizado")
            .eq("operacion_impo_id", operacion.id)
            .maybeSingle()
        : supabase
            .from("vista_alertas_impo")
            .select("exceso_total, dias_waiver, costo_bruto, costo_proyectado")
            .eq("operacion_impo_id", operacion.id)
            .maybeSingle(),
      // historial de waivers de la MISMA operación — READ directo permitido (RLS scopea
      // por visibilidad de la operación)
      supabase
        .from("operacion_impo_waivers")
        .select(
          "id, dias, motivo, referencia, registrado_por, created_at, estado, anulado_motivo, anulado_por, anulado_fecha",
        )
        .eq("operacion_impo_id", operacion.id)
        .order("created_at", { ascending: false }),
      supabase.from("usuarios_publicos").select("id, nombre"),
    ]);

    if (!num.error && num.data) {
      const raw = num.data as unknown as {
        exceso_total: RawNum;
        dias_waiver: RawNum;
        costo_bruto: RawNum;
        costo_proyectado?: RawNum;
        costo_realizado?: RawNum;
      };
      setNumeros({
        exceso_total: toNum(raw.exceso_total),
        dias_waiver: toNum(raw.dias_waiver),
        costo_bruto: toNum(raw.costo_bruto),
        costo_neto: toNum(esCerrada ? (raw.costo_realizado ?? null) : (raw.costo_proyectado ?? null)),
      });
      setNumerosError(null);
    } else {
      setNumeros(null);
      setNumerosError(num.error?.message ?? null);
    }

    if (wv.error) {
      setWaivers(null);
      setWaiversError(wv.error.message);
    } else {
      setWaivers(wv.data as unknown as WaiverImpoRow[]);
      setWaiversError(null);
    }

    // nombres: TOLERANTE — si falla, se muestran "—" en vez de nombres (degradación,
    // mismo criterio que el resto de los fetches secundarios del repo).
    if (!us.error && us.data) {
      setNombresPorId(new Map((us.data as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre])));
    }

    setLoaded(true);
  }, [operacion.id, esCerrada]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // tras cada acción exitosa: refresca el panel Y avisa al caller (la tabla de
  // /importacion también depende de estos números).
  const reloadYNotificar = useCallback(() => {
    void load();
    onDone();
  }, [load, onDone]);

  // Total vigente (039): fuente PRIMARIA es dias_waiver de la view (misma fuente que
  // bruto/neto). Fallback a sumar el historial si la view falló o no trajo fila.
  const waiverTotalVigente = useMemo(() => {
    if (numeros?.dias_waiver != null) return numeros.dias_waiver;
    return (waivers ?? []).filter((w) => w.estado === "vigente").reduce((sum, w) => sum + w.dias, 0);
  }, [numeros, waivers]);

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Acciones de plata"
        width={640}
        footer={
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {/* ---------- encabezado ---------- */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <ContainerNumber value={operacion.numeroContenedor} />
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              orden <span className="mono">{operacion.numeroOrden}</span>
            </span>
            <EstadoImpoBadge estado={operacion.estado} />
          </div>

          {!loaded ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 16 }}>
              <SkeletonBlock height={14} width={180} />
              <SkeletonBlock height={40} delay={80} />
              <SkeletonBlock height={40} delay={160} />
            </div>
          ) : (
            <>
              {/* ---------- resumen de números (039 — bruto/waiver/neto, cero cálculo acá) ---------- */}
              <div style={SECTION}>
                <div className="fd-label" style={LABEL_ROW}>
                  <i className="ti ti-cash" aria-hidden />
                  Resumen {esCerrada ? "realizado" : "proyectado"}
                </div>
                {numerosError && (
                  <FormAlert tone="warning">No se pudieron cargar los números de costo: {numerosError}</FormAlert>
                )}
                {numeros ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
                    <Dato label="exceso (días)">
                      <span className="mono">{numeros.exceso_total ?? "—"}</span>
                    </Dato>
                    <Dato label="waiver vigente (días)">
                      <span className="mono">{numeros.dias_waiver ?? 0}</span>
                    </Dato>
                    <Dato label="costo bruto">
                      <span className="mono">{fmtUSD(numeros.costo_bruto)}</span>
                    </Dato>
                    <Dato label="costo neto">
                      <span className="mono" style={{ fontWeight: 700 }}>
                        {fmtUSD(numeros.costo_neto)}
                      </span>
                    </Dato>
                  </div>
                ) : (
                  !numerosError && (
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                      Sin datos de costo para esta operación (sin tarifa vigente para la fecha de arribo, o la naviera
                      no cobra detention/demurrage en destino).
                    </span>
                  )
                )}
              </div>

              {/* ---------- historial de waivers (039): registros individuales, anulables sup+ ---------- */}
              <div style={SECTION}>
                <div className="fd-label" style={LABEL_ROW}>
                  <i className="ti ti-discount" aria-hidden />
                  Waivers
                  {waivers && waivers.length > 0 && (
                    <span className="mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                      {waivers.length}
                    </span>
                  )}
                </div>
                {waiversError ? (
                  <FormAlert>No se pudo cargar el historial de waivers: {waiversError}</FormAlert>
                ) : !waivers || waivers.length === 0 ? (
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    Sin waivers registrados en esta operación.
                  </span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {waivers.map((w, i) => {
                      const anulado = w.estado === "anulado";
                      const quien = nombresPorId.get(w.registrado_por) ?? "—";
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
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "3px 9px",
                                borderRadius: "var(--radius-chip)",
                                fontSize: 11.5,
                                border: `1px solid ${anulado ? "var(--color-border-strong)" : "var(--color-green-line)"}`,
                                background: anulado ? "var(--color-surface-1)" : "var(--color-green-tint)",
                                color: anulado ? "var(--color-text-secondary)" : "var(--color-status-green)",
                              }}
                            >
                              {anulado ? "anulado" : "vigente"}
                            </span>
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
                              Anulado por {w.anulado_por ? (nombresPorId.get(w.anulado_por) ?? "—") : "—"}
                              {w.anulado_fecha ? <> el {fmtFecha(w.anulado_fecha)}</> : null}
                              {w.anulado_motivo ? <> — motivo: {w.anulado_motivo}</> : null}
                            </div>
                          )}
                          {!anulado && canEscribir && (
                            <div>
                              <Button
                                variant="ghost"
                                icon="ti-ban"
                                style={{ minHeight: 0, padding: "4px 10px", fontSize: 11.5 }}
                                onClick={() => setAnularWaiverTarget({ id: w.id, dias: w.dias })}
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

              {/* ---------- alta de waiver: sup+ sobre cualquier operación no anulada (la
                  naviera suele condonar días DESPUÉS del cierre, por eso no se gatea a
                  abierta — mismo criterio que el waiver de EXPO) ---------- */}
              {canEscribir && !esAnulada && (
                <RegistrarWaiverImpoForm
                  operacionId={operacion.id}
                  numeroContenedor={operacion.numeroContenedor}
                  totalVigente={waiverTotalVigente}
                  onRegistrado={reloadYNotificar}
                />
              )}

              {/* ---------- corrección (039): sup+, SOLO operación cerrada ---------- */}
              {canEscribir && esCerrada && (
                <div style={SECTION}>
                  <div className="fd-label" style={LABEL_ROW}>
                    <i className="ti ti-pencil-check" aria-hidden />
                    Corregir dato de la cerrada
                  </div>
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                    Para un retiro de terminal, ingreso a planta o devolución mal cargados sobre una operación ya
                    cerrada.
                  </span>
                  <div>
                    <Button variant="ghost" icon="ti-pencil-check" onClick={() => setCorregirOpen(true)}>
                      Corregir dato
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* stacked sobre el modal de arriba (mismo patrón que NuevoProductoModal en
          acciones.tsx) — sibling, no anidado dentro del <Modal>. */}
      {anularWaiverTarget && (
        <AnularWaiverImpoConfirm
          waiver={anularWaiverTarget}
          numeroContenedor={operacion.numeroContenedor}
          onClose={() => setAnularWaiverTarget(null)}
          onDone={() => {
            setAnularWaiverTarget(null);
            reloadYNotificar();
          }}
        />
      )}

      {corregirOpen && (
        <CorregirFechaImpoConfirm
          operacionId={operacion.id}
          numeroContenedor={operacion.numeroContenedor}
          onClose={() => setCorregirOpen(false)}
          onDone={() => {
            setCorregirOpen(false);
            reloadYNotificar();
          }}
        />
      )}
    </>
  );
}
