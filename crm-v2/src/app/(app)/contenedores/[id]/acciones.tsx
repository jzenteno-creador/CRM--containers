"use client";

// Acciones de la ficha de contenedor (M5 + M4 Bloque 2): mover entre plantas, confirmar
// llegada de un movimiento inter-planta pendiente, anular operación, validar reforzado,
// registrar waiver (019) y corregir dato de operación cerrada (020 — F-02).
// Toda la lógica vive en las RPCs (crm_mover_entre_plantas, crm_confirmar_ingreso_planta,
// crm_anular_operacion, crm_validar_reforzado, crm_registrar_waiver,
// crm_corregir_operacion_cerrada) — acá solo se arman payloads, se muestran
// errores literales en FormAlert y se dispara el reload de la ficha en éxito.
// El gating por rol de los botones que abren estos modales es UX: el enforcement real
// es de cada RPC (+ RLS).

import { useState } from "react";
import { Button } from "@/components/fd/button";
import { DateField, Field, Input, Select, Textarea, Toggle } from "@/components/fd/fields";
import { FormAlert } from "@/components/fd/form-alert";
import { Modal } from "@/components/fd/modal";
import { useToast } from "@/components/fd/toast";
import { fmtFecha, hoyAR } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";

export type PlantaOption = { id: string; nombre: string };

export type MovimientoPendiente = {
  id: string;
  medio: string | null;
  fecha_salida: string | null;
  planta_origen: { nombre: string } | null;
  planta_destino: { nombre: string } | null;
};

const MEDIOS: { value: "camion" | "tren"; label: string }[] = [
  { value: "camion", label: "Camión" },
  { value: "tren", label: "Tren" },
];

// Estados de validación del reforzado (contrato crm_validar_reforzado, plan M5)
export const REFORZADO_OPTIONS: { value: string; label: string }[] = [
  { value: "pendiente_validacion", label: "Pendiente de validación" },
  { value: "confirmado_reforzado", label: "Confirmado reforzado" },
  { value: "confirmado_no_reforzado", label: "Confirmado no reforzado" },
  { value: "discrepancia", label: "Discrepancia" },
];

function ModalFooter({
  onCancel,
  sending,
  children,
}: {
  onCancel: () => void;
  sending: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
      <Button variant="ghost" onClick={onCancel} disabled={sending}>
        Cancelar
      </Button>
      {children}
    </div>
  );
}

/* ================= Mover entre plantas ================= */

export function MoverPlantasModal({
  operacionId,
  plantaActualId,
  plantaActualNombre,
  plantas,
  onClose,
  onDone,
}: {
  operacionId: string;
  plantaActualId: string | null;
  plantaActualNombre: string;
  plantas: PlantaOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [destinoId, setDestinoId] = useState("");
  const [medio, setMedio] = useState<"camion" | "tren">("camion");
  const [fechaSalida, setFechaSalida] = useState(hoyAR());
  // default ON (patrón tanda): lo habitual es que el movimiento ya ocurrió completo
  const [confirmarAhora, setConfirmarAhora] = useState(true);
  const [fechaLlegada, setFechaLlegada] = useState(hoyAR());
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // la RPC rechaza destino = actual; acá directamente no se ofrece (UX)
  const destinos = plantas.filter((p) => p.id !== plantaActualId);

  const destinoError = attempted && destinoId === "" ? "elegí la planta destino" : null;
  const fechaSalidaError = attempted && fechaSalida === "" ? "indicá la fecha de salida" : null;
  const fechaLlegadaError =
    attempted && confirmarAhora && fechaLlegada === "" ? "indicá la fecha de llegada" : null;
  const valid = destinoId !== "" && fechaSalida !== "" && (!confirmarAhora || fechaLlegada !== "");

  const submit = async () => {
    setAttempted(true);
    setSubmitError(null);
    if (!valid || sending) return;
    setSending(true);
    // devuelve void: éxito = sin error. timestamptz AR fijo (UTC-3, sin DST).
    const { error } = await getSupabase().rpc("crm_mover_entre_plantas", {
      p_operacion_id: operacionId,
      p_destino: destinoId,
      p_medio: medio,
      p_fecha_salida: `${fechaSalida}T00:00:00-03:00`,
      p_confirmar: confirmarAhora,
      p_fecha_llegada: confirmarAhora ? `${fechaLlegada}T00:00:00-03:00` : null,
    });
    setSending(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    const destinoNombre = destinos.find((p) => p.id === destinoId)?.nombre ?? "la planta destino";
    toast(
      confirmarAhora
        ? { type: "exito", title: "Movimiento confirmado", detail: `El contenedor ya figura en ${destinoNombre}.` }
        : {
            type: "exito",
            title: "Movimiento registrado en tránsito",
            detail: `Confirmá la llegada a ${destinoNombre} desde esta ficha cuando ocurra.`,
          },
    );
    onDone();
  };

  return (
    <Modal
      open
      onClose={sending ? () => {} : onClose}
      title="Mover entre plantas"
      width={480}
      closeOnBackdrop={!sending}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
          Planta actual: <strong>{plantaActualNombre}</strong>
        </div>
        <Field label="planta destino" htmlFor="mover-destino" error={destinoError}>
          <Select
            id="mover-destino"
            value={destinoId}
            error={destinoError}
            onChange={(e) => setDestinoId(e.target.value)}
          >
            <option value="">— elegí la planta —</option>
            {destinos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Field label="medio" htmlFor="mover-medio">
            <Select
              id="mover-medio"
              value={medio}
              onChange={(e) => setMedio(e.target.value as "camion" | "tren")}
              style={{ minWidth: 130 }}
            >
              {MEDIOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="fecha de salida" htmlFor="mover-salida" error={fechaSalidaError}>
            <DateField
              id="mover-salida"
              value={fechaSalida}
              error={fechaSalidaError}
              onChange={(e) => setFechaSalida(e.target.value)}
            />
          </Field>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
          <Toggle checked={confirmarAhora} onChange={setConfirmarAhora} label="confirmar llegada ahora" />
          {confirmarAhora && (
            <Field label="fecha de llegada" htmlFor="mover-llegada" error={fechaLlegadaError}>
              <DateField
                id="mover-llegada"
                value={fechaLlegada}
                error={fechaLlegadaError}
                onChange={(e) => setFechaLlegada(e.target.value)}
              />
            </Field>
          )}
        </div>
        <span style={{ fontSize: 11.5, color: "var(--color-text-faint)", lineHeight: 1.5 }}>
          {confirmarAhora ? (
            <>El movimiento queda confirmado y la planta actual pasa a ser la de destino.</>
          ) : (
            <>
              Queda <strong>en tránsito</strong>: la operación sigue en planta {plantaActualNombre} hasta que confirmes
              la llegada desde esta ficha.
            </>
          )}
        </span>
        {submitError && <FormAlert>{submitError}</FormAlert>}
        <ModalFooter onCancel={onClose} sending={sending}>
          <Button variant="primary" icon="ti-transfer" loading={sending} onClick={() => void submit()}>
            Registrar movimiento
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}

/* ================= Confirmar llegada (movimiento inter-planta pendiente) ================= */

export function ConfirmarLlegadaModal({
  operacionId,
  movimientos,
  onClose,
  onDone,
}: {
  operacionId: string;
  movimientos: MovimientoPendiente[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [fecha, setFecha] = useState(hoyAR());
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fechaError = attempted && fecha === "" ? "indicá la fecha de llegada" : null;

  const submit = async () => {
    setAttempted(true);
    setSubmitError(null);
    if (fecha === "" || sending) return;
    setSending(true);
    const supabase = getSupabase();
    // sin p_medio: la RPC hace coalesce(p_medio, medio) y el movimiento conserva el
    // medio con el que salió.
    const { error } = await supabase.rpc("crm_confirmar_ingreso_planta", {
      p_operacion_ids: [operacionId],
      p_fecha: `${fecha}T00:00:00-03:00`,
    });
    if (error) {
      setSending(false);
      setSubmitError(error.message);
      return;
    }
    // La RPC devuelve {confirmadas:0} porque la operación no estaba en_transito_a_planta
    // — en este contexto ese 0 NO es error. El éxito se decide contra la DB recargada:
    // si ya no queda ningún movimiento en_transito de la operación, se confirmó.
    const check = await supabase
      .from("movimientos_planta")
      .select("id")
      .eq("operacion_id", operacionId)
      .eq("estado", "en_transito");
    setSending(false);
    if (check.error) {
      setSubmitError(check.error.message);
      return;
    }
    if ((check.data ?? []).length > 0) {
      setSubmitError(
        "No se pudo confirmar la llegada. Si sos operador, solo podés confirmar movimientos hacia tu planta asignada.",
      );
      return;
    }
    toast({
      type: "exito",
      title: "Llegada confirmada",
      detail: "La planta actual del contenedor ya es la de destino del movimiento.",
    });
    onDone();
  };

  return (
    <Modal
      open
      onClose={sending ? () => {} : onClose}
      title="Confirmar llegada a planta"
      width={480}
      closeOnBackdrop={!sending}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {movimientos.map((m) => (
            <div key={m.id} style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
              <strong>{m.planta_origen?.nombre ?? "—"}</strong> <i className="ti ti-arrow-right" aria-hidden />{" "}
              <strong>{m.planta_destino?.nombre ?? "—"}</strong>
              {m.medio ? ` · ${m.medio === "camion" ? "camión" : m.medio}` : ""} · salió el{" "}
              <span className="mono">{fmtFecha(m.fecha_salida)}</span>
            </div>
          ))}
        </div>
        <Field label="fecha de llegada" htmlFor="llegada-fecha" error={fechaError}>
          <DateField
            id="llegada-fecha"
            value={fecha}
            error={fechaError}
            onChange={(e) => setFecha(e.target.value)}
          />
        </Field>
        <span style={{ fontSize: 11.5, color: "var(--color-text-faint)", lineHeight: 1.5 }}>
          Al confirmar, la planta actual de la operación pasa a ser la de destino
          {movimientos.length > 1 ? " (se confirman todos los movimientos pendientes de la operación)" : ""}.
        </span>
        {submitError && <FormAlert>{submitError}</FormAlert>}
        <ModalFooter onCancel={onClose} sending={sending}>
          <Button variant="primary" icon="ti-circle-check" loading={sending} onClick={() => void submit()}>
            Confirmar llegada
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}

/* ================= Anular operación ================= */

export function AnularOperacionModal({
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
    const { error } = await getSupabase().rpc("crm_anular_operacion", {
      p_operacion_id: operacionId,
      p_motivo: motivo.trim(),
    });
    setSending(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    toast({
      type: "exito",
      title: "Operación anulada",
      detail: `El ciclo de ${numeroContenedor} quedó anulado con tu usuario y el motivo registrados.`,
    });
    onDone();
  };

  return (
    <Modal open onClose={sending ? () => {} : onClose} title="Anular operación" width={480} closeOnBackdrop={!sending}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FormAlert tone="warning">
          La anulación es <strong>definitiva</strong>: la operación de <span className="mono">{numeroContenedor}</span>{" "}
          sale de la planilla de abiertas y queda como anulada, con tu usuario y el motivo registrados en el historial.
        </FormAlert>
        <Field label="motivo de la anulación" htmlFor="anular-motivo" error={motivoError} hint="queda en el historial de la operación">
          <Textarea
            id="anular-motivo"
            rows={3}
            value={motivo}
            error={motivoError}
            onChange={(e) => setMotivo(e.target.value)}
            onBlur={() => setTouched(true)}
          />
        </Field>
        {submitError && <FormAlert>{submitError}</FormAlert>}
        <ModalFooter onCancel={onClose} sending={sending}>
          <Button variant="danger" icon="ti-ban" loading={sending} disabled={!valid} onClick={() => void submit()}>
            Anular operación
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}

/* ================= Validar reforzado ================= */

export function ValidarReforzadoModal({
  contenedorId,
  numeroContenedor,
  estadoActual,
  onClose,
  onDone,
}: {
  contenedorId: string;
  numeroContenedor: string;
  estadoActual: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [estado, setEstado] = useState(estadoActual);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitError(null);
    if (sending) return;
    setSending(true);
    const { error } = await getSupabase().rpc("crm_validar_reforzado", {
      p_contenedor: contenedorId,
      p_estado: estado,
    });
    setSending(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    const label = REFORZADO_OPTIONS.find((o) => o.value === estado)?.label ?? estado;
    toast({
      type: "exito",
      title: "Reforzado validado",
      detail: `${numeroContenedor}: ${label.toLowerCase()} — queda registrado con tu usuario y la fecha.`,
    });
    onDone();
  };

  return (
    <Modal open onClose={sending ? () => {} : onClose} title="Validar reforzado" width={460} closeOnBackdrop={!sending}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
          Estado del reforzado de <span className="mono">{numeroContenedor}</span> — la validación aplica al{" "}
          <strong>contenedor</strong> (a todos sus ciclos), no a una operación puntual.
        </div>
        <Field label="estado del reforzado" htmlFor="reforzado-estado">
          <Select id="reforzado-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
            {REFORZADO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        {submitError && <FormAlert>{submitError}</FormAlert>}
        <ModalFooter onCancel={onClose} sending={sending}>
          <Button variant="primary" icon="ti-shield-check" loading={sending} onClick={() => void submit()}>
            Guardar validación
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}

/* ================= Registrar waiver (019 — sup+) ================= */

export function RegistrarWaiverModal({
  operacionId,
  numeroContenedor,
  waiverActual,
  onClose,
  onDone,
}: {
  operacionId: string;
  numeroContenedor: string;
  /** Días del waiver ya registrado (si hay): la RPC lo REEMPLAZA, no lo suma. */
  waiverActual: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [dias, setDias] = useState("");
  const [motivo, setMotivo] = useState("");
  const [referencia, setReferencia] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const diasNum = Number(dias);
  // validación EN VIVO para valor inválido; el vacío recién al intentar (patrón tarifas)
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
    const { error } = await getSupabase().rpc("crm_registrar_waiver", {
      p_operacion: operacionId,
      p_dias: diasNum,
      p_motivo: motivo.trim(),
      p_referencia: referencia.trim() === "" ? null : referencia.trim(),
    });
    setSending(false);
    if (error) {
      // errores P0001 LITERALES (rol, días inválidos, operación anulada…)
      setSubmitError(error.message);
      return;
    }
    toast({
      type: "exito",
      title: "Waiver registrado",
      detail: `${numeroContenedor}: ${diasNum} día${diasNum === 1 ? "" : "s"} sin cargo — el costo neto se recalcula solo.`,
    });
    onDone();
  };

  return (
    <Modal open onClose={sending ? () => {} : onClose} title="Registrar waiver" width={480} closeOnBackdrop={!sending}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          La naviera condona días de detention de <span className="mono">{numeroContenedor}</span>. El waiver es plata:
          queda auditado con tu usuario, la fecha y el motivo.
        </div>
        {waiverActual != null && (
          <FormAlert tone="warning">
            Esta operación ya tiene un waiver de <strong>{waiverActual} día{waiverActual === 1 ? "" : "s"}</strong> — el
            nuevo valor lo <strong>reemplaza</strong> (no se suma).
          </FormAlert>
        )}
        <Field label="días condonados" htmlFor="waiver-dias" error={diasError}>
          <Input
            id="waiver-dias"
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
        <Field label="motivo" htmlFor="waiver-motivo" error={motivoError} hint="queda en el historial de la operación">
          <Textarea
            id="waiver-motivo"
            rows={3}
            value={motivo}
            error={motivoError}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </Field>
        <Field label="referencia" htmlFor="waiver-referencia" hint="opcional — nro. de caso / mail de la naviera">
          <Input
            id="waiver-referencia"
            value={referencia}
            placeholder="opcional"
            onChange={(e) => setReferencia(e.target.value)}
          />
        </Field>
        {submitError && <FormAlert>{submitError}</FormAlert>}
        <ModalFooter onCancel={onClose} sending={sending}>
          <Button variant="primary" icon="ti-discount" loading={sending} disabled={!valid} onClick={() => void submit()}>
            Registrar waiver
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}

/* ================= Corregir dato de operación cerrada (020 — F-02, sup+) ================= */

// Whitelist EXACTA de crm_corregir_operacion_cerrada (020) con labels humanos.
// `kind` decide el input: date → DateField (viaja como ISO con zona AR, mediodía
// para que ningún corrimiento de TZ cambie el día); text → Input.
const CAMPOS_CORRECCION: { value: string; label: string; kind: "date" | "text" }[] = [
  { value: "fecha_retiro", label: "Fecha de retiro", kind: "date" },
  { value: "fecha_egreso_planta", label: "Fecha de egreso de planta", kind: "date" },
  { value: "fecha_devolucion", label: "Fecha de devolución", kind: "date" },
  { value: "booking_retiro", label: "Booking de retiro", kind: "text" },
  { value: "booking_asignado", label: "Booking asignado", kind: "text" },
  { value: "buque", label: "Buque", kind: "text" },
  { value: "destino", label: "Destino", kind: "text" },
  { value: "orden", label: "Orden", kind: "text" },
  { value: "shp", label: "SHP", kind: "text" },
];

export function CorregirDatoModal({
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

  const campoDef = CAMPOS_CORRECCION.find((c) => c.value === campo) ?? null;

  const campoError = attempted && campo === "" ? "elegí el campo a corregir" : null;
  const valorError =
    attempted && valor.trim() === ""
      ? campoDef?.kind === "date"
        ? "indicá la fecha nueva"
        : "indicá el valor nuevo"
      : null;
  const motivoError = attempted && motivo.trim() === "" ? "el motivo es obligatorio" : null;
  const valid = campo !== "" && valor.trim() !== "" && motivo.trim() !== "";

  const selectCampo = (c: string) => {
    setCampo(c);
    setValor(""); // el valor anterior era de OTRO campo (o de otro tipo de input)
    setSubmitError(null);
  };

  const submit = async () => {
    setAttempted(true);
    setSubmitError(null);
    if (!valid || sending) return;
    setSending(true);
    // fechas: ISO con zona AR a mediodía (contrato 020) — el mediodía evita que un
    // corrimiento de timezone en la DB cambie el día calendario. Texto: literal.
    const p_valor = campoDef?.kind === "date" ? `${valor}T12:00:00-03:00` : valor.trim();
    const { error } = await getSupabase().rpc("crm_corregir_operacion_cerrada", {
      p_operacion: operacionId,
      p_campo: campo,
      p_valor,
      p_motivo: motivo.trim(),
    });
    setSending(false);
    if (error) {
      // los errores de la RPC son legibles (campo fuera de whitelist, operación no
      // cerrada, rol insuficiente…) — van tal cual al FormAlert
      setSubmitError(error.message);
      return;
    }
    toast({
      type: "exito",
      title: "Dato corregido",
      detail: `${numeroContenedor}: ${campoDef?.label.toLowerCase() ?? campo} actualizado — los números de la ficha se recalculan solos.`,
    });
    onDone();
  };

  return (
    <Modal open onClose={sending ? () => {} : onClose} title="Corregir dato" width={480} closeOnBackdrop={!sending}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          Corrección sobre la operación <strong>cerrada</strong> de <span className="mono">{numeroContenedor}</span>.
          Queda un evento de corrección en el historial con el valor anterior, el nuevo y tu usuario.
        </div>
        <Field label="campo a corregir" htmlFor="correccion-campo" error={campoError}>
          <Select id="correccion-campo" value={campo} error={campoError} onChange={(e) => selectCampo(e.target.value)}>
            <option value="">— elegí el campo —</option>
            {CAMPOS_CORRECCION.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        {campoDef && (
          <Field label={`valor nuevo — ${campoDef.label.toLowerCase()}`} htmlFor="correccion-valor" error={valorError}>
            {campoDef.kind === "date" ? (
              <DateField
                id="correccion-valor"
                value={valor}
                error={valorError}
                onChange={(e) => setValor(e.target.value)}
                style={{ maxWidth: 200 }}
              />
            ) : (
              <Input
                id="correccion-valor"
                value={valor}
                error={valorError}
                onChange={(e) => setValor(e.target.value)}
              />
            )}
          </Field>
        )}
        <Field label="motivo" htmlFor="correccion-motivo" error={motivoError} hint="queda en el historial de la operación">
          <Textarea
            id="correccion-motivo"
            rows={3}
            value={motivo}
            error={motivoError}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </Field>
        {submitError && <FormAlert>{submitError}</FormAlert>}
        <ModalFooter onCancel={onClose} sending={sending}>
          <Button variant="primary" icon="ti-pencil-check" loading={sending} disabled={!valid} onClick={() => void submit()}>
            Corregir dato
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
