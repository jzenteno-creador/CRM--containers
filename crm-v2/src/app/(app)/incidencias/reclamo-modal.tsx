"use client";

// Panel de gestión del reclamo de una incidencia (B5, migración 030). Se abre al click en
// una fila del historial. Todo pasa por crm_actualizar_reclamo — un submit por acción:
//   - Transición de estado (sin_reclamo→abierta→reclamada→resuelta): SOLO supervisor+
//     (la RLS lo bloquea igual; acá se esconde el botón para evitar frustración — la
//     misma UX que el resto del repo, ej. admin/solicitudes).
//   - Resolver exige `resultado` (recuperado|no_recuperado) en el mismo submit; admite
//     corregir el monto final en la misma llamada.
//   - Edición de monto/responsable + nota: operador+ (todos los roles operativos).
// Errores literales del RPC (transicion_invalida / resolver_exige_resultado / sin_cambios
// / gates de rol) se muestran tal cual vía toast — igual que el resto del repo.
// Historial NO: el timeline completo vive en la ficha del contenedor (§ del módulo).

import { useState } from "react";
import { ContainerNumber } from "@/components/container-number";
import { Button } from "@/components/fd/button";
import { Field, Input, Select, Textarea } from "@/components/fd/fields";
import { Modal } from "@/components/fd/modal";
import { useToast } from "@/components/fd/toast";
import { fmtFecha, fmtUSD } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import type { Perfil } from "@/lib/session";
import { EstadoReclamoBadge, FotoThumb, TipoIncidenciaBadge, type FotoUrl } from "./shared";

export type IncidenciaDetalle = {
  id: string;
  tipo: string;
  descripcion: string | null;
  fecha: string;
  numero_orden: string | null;
  monto_usd: number | null;
  responsable: string | null;
  estado_reclamo: string;
  resultado: string | null;
  fecha_reclamo: string | null;
  fecha_resolucion: string | null;
  usuario_id: string | null;
  operacion: {
    id: string;
    contenedor: { id: string; numero_contenedor: string } | null;
    planta_actual: { nombre: string } | null;
  } | null;
  fotos: { id: string; storage_path: string }[];
};

const SECTION: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "12px 0",
  borderTop: "1px solid var(--color-border-subtle)",
};

const LABEL_MICRO: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-label)",
};

// próxima transición válida (espeja el CHECK del RPC — solo para decidir qué botón
// mostrar; la validación real vive en crm_actualizar_reclamo)
const NEXT_ESTADO: Record<string, { to: string; label: string; icon: string } | null> = {
  sin_reclamo: { to: "abierta", label: "Abrir reclamo", icon: "ti-file-alert" },
  abierta: { to: "reclamada", label: "Marcar reclamada", icon: "ti-send" },
  reclamada: { to: "resuelta", label: "Resolver", icon: "ti-check" },
  resuelta: null,
};

export function ReclamoModal({
  incidencia,
  fotoUrls,
  usuarios,
  perfil,
  onClose,
  onUpdated,
  onVerFicha,
}: {
  incidencia: IncidenciaDetalle;
  /** null = firmando el batch todavía; las claves ausentes muestran skeleton en el thumb. */
  fotoUrls: Record<string, FotoUrl> | null;
  usuarios: Record<string, string>;
  perfil: Perfil;
  onClose: () => void;
  /** Mutación exitosa: el padre recarga el historial y cierra el panel. */
  onUpdated: () => void;
  onVerFicha?: () => void;
}) {
  const toast = useToast();
  const canTransition = perfil.rol === "supervisor" || perfil.rol === "administrador";
  const numero = incidencia.operacion?.contenedor?.numero_contenedor ?? "contenedor";

  // ---- acción única compartida: cualquier mutación exitosa recarga y cierra (mismo
  // patrón que AprobarModal/RechazarModal de admin/solicitudes) ----
  const [sending, setSending] = useState<"transicion" | "resolver" | "edicion" | null>(null);

  const runMutation = async (
    action: "transicion" | "resolver" | "edicion",
    params: {
      p_estado_reclamo?: string;
      p_resultado?: string;
      p_monto_usd?: number | null;
      p_responsable?: string | null;
      p_nota?: string | null;
    },
  ) => {
    if (sending) return;
    setSending(action);
    const { error } = await getSupabase().rpc("crm_actualizar_reclamo", {
      p_incidencia_id: incidencia.id,
      ...params,
    });
    setSending(null);
    if (error) {
      toast({ type: "error", title: "No se pudo actualizar el reclamo", detail: error.message });
      return;
    }
    toast({ type: "exito", title: "Reclamo actualizado" });
    onUpdated();
  };

  /* ---------- edición de monto / responsable / nota (operador+) ---------- */
  const montoActualTxt = incidencia.monto_usd != null ? String(incidencia.monto_usd) : "";
  const [montoEdit, setMontoEdit] = useState(montoActualTxt);
  const [responsableEdit, setResponsableEdit] = useState(incidencia.responsable ?? "");
  const [nota, setNota] = useState("");

  const montoChanged = montoEdit.trim() !== "" && Number(montoEdit) !== incidencia.monto_usd;
  const responsableChanged =
    responsableEdit.trim() !== "" && responsableEdit.trim() !== (incidencia.responsable ?? "");
  const notaFilled = nota.trim() !== "";
  const edicionDirty = montoChanged || responsableChanged || notaFilled;

  /* ---------- resolver (supervisor+): resultado obligatorio + monto final opcional ---------- */
  const [resolverResultado, setResolverResultado] = useState("");
  const [resolverMonto, setResolverMonto] = useState("");
  const [resolverAttempted, setResolverAttempted] = useState(false);

  const next = NEXT_ESTADO[incidencia.estado_reclamo] ?? null;

  return (
    <Modal
      open
      onClose={sending ? () => {} : onClose}
      closeOnBackdrop={!sending}
      width={560}
      title={
        <span>
          Gestión de reclamo — <span className="mono">{numero}</span>
        </span>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {/* ---- datos completos de la incidencia ---- */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <TipoIncidenciaBadge tipo={incidencia.tipo} />
          <EstadoReclamoBadge estado={incidencia.estado_reclamo} resultado={incidencia.resultado} />
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-muted)" }}>
            {fmtFecha(incidencia.fecha)}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <div style={LABEL_MICRO}>contenedor</div>
            <div style={{ marginTop: 3 }}>
              {incidencia.operacion?.contenedor ? (
                <ContainerNumber value={incidencia.operacion.contenedor.numero_contenedor} />
              ) : (
                "—"
              )}
            </div>
          </div>
          <div>
            <div style={LABEL_MICRO}>número de orden</div>
            <div className="mono" style={{ marginTop: 3, fontSize: 12.5, color: "var(--color-text-secondary)" }}>
              {incidencia.numero_orden ?? "—"}
            </div>
          </div>
          <div>
            <div style={LABEL_MICRO}>planta</div>
            <div style={{ marginTop: 3, fontSize: 12.5, color: "var(--color-text-secondary)" }}>
              {incidencia.operacion?.planta_actual?.nombre ?? "—"}
            </div>
          </div>
          <div>
            <div style={LABEL_MICRO}>reportado por</div>
            <div style={{ marginTop: 3, fontSize: 12.5, color: "var(--color-text-secondary)" }}>
              {incidencia.usuario_id ? (usuarios[incidencia.usuario_id] ?? "—") : "—"}
            </div>
          </div>
        </div>

        {incidencia.descripcion && (
          <div style={{ marginTop: 10 }}>
            <div style={LABEL_MICRO}>descripción</div>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
              {incidencia.descripcion}
            </p>
          </div>
        )}

        {incidencia.fotos.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={LABEL_MICRO}>fotos</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
              {incidencia.fotos.map((f) => (
                <FotoThumb
                  key={f.id}
                  urlInfo={fotoUrls === null ? undefined : fotoUrls[f.storage_path]}
                  nombre={numero}
                  size={52}
                  onOpen={(url) => window.open(url, "_blank", "noopener,noreferrer")}
                />
              ))}
            </div>
          </div>
        )}

        {onVerFicha && (
          <div style={{ marginTop: 10 }}>
            <Button variant="ghost" icon="ti-external-link" onClick={onVerFicha} style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}>
              Ver ficha del contenedor
            </Button>
          </div>
        )}

        {/* ---- estado del reclamo: transición (solo supervisor+) ---- */}
        <div style={SECTION}>
          <div style={LABEL_MICRO}>estado del reclamo</div>
          {(incidencia.fecha_reclamo || incidencia.fecha_resolucion) && (
            <div style={{ fontSize: 11.5, color: "var(--color-text-faint)" }}>
              {incidencia.fecha_reclamo && <>reclamada el {fmtFecha(incidencia.fecha_reclamo)}</>}
              {incidencia.fecha_reclamo && incidencia.fecha_resolucion && " · "}
              {incidencia.fecha_resolucion && <>resuelta el {fmtFecha(incidencia.fecha_resolucion)}</>}
            </div>
          )}

          {!canTransition && next && (
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--color-text-faint)" }}>
              Solo supervisor o administrador puede avanzar el estado del reclamo.
            </p>
          )}

          {canTransition && next && next.to !== "resuelta" && (
            <div>
              <Button
                variant="primary"
                icon={next.icon}
                loading={sending === "transicion"}
                disabled={sending !== null}
                onClick={() => void runMutation("transicion", { p_estado_reclamo: next.to })}
              >
                {next.label}
              </Button>
            </div>
          )}

          {canTransition && next && next.to === "resuelta" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <Field
                  label="resultado"
                  htmlFor="reclamo-resultado"
                  error={resolverAttempted && resolverResultado === "" ? "elegí el resultado" : null}
                >
                  <Select
                    id="reclamo-resultado"
                    value={resolverResultado}
                    error={resolverAttempted && resolverResultado === "" ? "elegí el resultado" : null}
                    disabled={sending !== null}
                    onChange={(e) => setResolverResultado(e.target.value)}
                  >
                    <option value="">— elegí —</option>
                    <option value="recuperado">Recuperado</option>
                    <option value="no_recuperado">No recuperado</option>
                  </Select>
                </Field>
                <Field label="monto final (USD)" htmlFor="reclamo-monto-final" hint="opcional — corrige el estimado">
                  <Input
                    id="reclamo-monto-final"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={resolverMonto}
                    disabled={sending !== null}
                    placeholder={montoActualTxt || "sin monto cargado"}
                    onChange={(e) => setResolverMonto(e.target.value)}
                  />
                </Field>
              </div>
              <div>
                <Button
                  variant="primary"
                  icon="ti-check"
                  loading={sending === "resolver"}
                  disabled={sending !== null}
                  onClick={() => {
                    setResolverAttempted(true);
                    if (resolverResultado === "") return;
                    void runMutation("resolver", {
                      p_estado_reclamo: "resuelta",
                      p_resultado: resolverResultado,
                      p_monto_usd: resolverMonto.trim() === "" ? null : Number(resolverMonto),
                    });
                  }}
                >
                  Resolver reclamo
                </Button>
              </div>
            </div>
          )}

          {!next && (
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--color-text-faint)" }}>
              El reclamo quedó resuelto — {incidencia.resultado ? "resultado " : ""}
              <strong>{incidencia.resultado === "recuperado" ? "recuperado" : "no recuperado"}</strong>.
            </p>
          )}
        </div>

        {/* ---- monto / responsable / nota (operador+) ---- */}
        <div style={SECTION}>
          <div style={LABEL_MICRO}>monto y responsable</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <Field label="monto (USD)" htmlFor="reclamo-monto" hint={incidencia.monto_usd != null ? `actual: ${fmtUSD(incidencia.monto_usd)}` : "sin monto cargado"}>
              <Input
                id="reclamo-monto"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={montoEdit}
                disabled={sending !== null}
                onChange={(e) => setMontoEdit(e.target.value)}
              />
            </Field>
            <Field label="responsable" htmlFor="reclamo-responsable" hint="a quién se le imputa el costo">
              <Input
                id="reclamo-responsable"
                value={responsableEdit}
                disabled={sending !== null}
                placeholder="ej: naviera / depósito / transportista"
                onChange={(e) => setResponsableEdit(e.target.value)}
              />
            </Field>
          </div>
          <Field label="nota (opcional)" htmlFor="reclamo-nota" hint="queda registrada en el rastro del cambio">
            <Textarea
              id="reclamo-nota"
              rows={2}
              value={nota}
              disabled={sending !== null}
              placeholder="ej: se corrige el monto contra la factura de lavado"
              onChange={(e) => setNota(e.target.value)}
              style={{ resize: "vertical" }}
            />
          </Field>
          <div>
            <Button
              variant="ghost"
              icon="ti-device-floppy"
              loading={sending === "edicion"}
              disabled={sending !== null || !edicionDirty}
              onClick={() =>
                void runMutation("edicion", {
                  p_monto_usd: montoChanged ? Number(montoEdit) : null,
                  p_responsable: responsableChanged ? responsableEdit.trim() : null,
                  p_nota: notaFilled ? nota.trim() : null,
                })
              }
            >
              Guardar cambios
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
