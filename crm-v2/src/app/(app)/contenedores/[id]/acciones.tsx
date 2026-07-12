"use client";

// Acciones de la ficha de contenedor (M5): mover entre plantas, confirmar llegada de
// un movimiento inter-planta pendiente, anular operación y validar reforzado.
// Toda la lógica vive en las RPCs (crm_mover_entre_plantas, crm_confirmar_ingreso_planta,
// crm_anular_operacion, crm_validar_reforzado) — acá solo se arman payloads, se muestran
// errores literales en FormAlert y se dispara el reload de la ficha en éxito.
// El gating por rol de los botones que abren estos modales es UX: el enforcement real
// es de cada RPC (+ RLS).

import { useState } from "react";
import { Button } from "@/components/fd/button";
import { DateField, Field, Select, Textarea, Toggle } from "@/components/fd/fields";
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
