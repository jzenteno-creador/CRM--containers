"use client";

// Admin → Depósitos (023, construido detrás del contrato — degrada si la migración
// todavía no está aplicada en prod, ver loadError abajo). Mismo patrón que
// /admin/plantas: listado (activos + inactivos con badge) + alta + edición + baja
// lógica (activo=false, JAMÁS delete — mismo criterio que planta/naviera). INSERT/UPDATE
// directos a `depositos` están SANCIONADOS (AGENTS.md, maestro sin impacto en costo).
//
// Diferencia con plantas: acá además hay FUSIONAR — dos depósitos que resultaron ser el
// mismo (ej. "Exolgan" vs "EXOLGAN" cargados por error) se unifican con
// crm_fusionar_depositos: repuntea TODAS las operaciones del origen al destino y
// desactiva el origen. Es la ÚNICA vía para tocar `operaciones` desde esta pantalla —
// nunca un UPDATE crudo (regla de escritura a la DB, AGENTS.md).
// Guard admin (patrón solicitudes §14.7): skeleton + redirect; RLS es la compuerta real.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { Field, Input, Select } from "@/components/fd/fields";
import { FormAlert } from "@/components/fd/form-alert";
import { ConfirmDialog, Modal } from "@/components/fd/modal";
import { PageHeader } from "@/components/fd/page-header";
import { useToast } from "@/components/fd/toast";
import { fmtFecha } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

type DepositoRow = {
  id: string;
  nombre: string;
  codigo: string | null;
  activo: boolean;
  created_at: string;
};

/* ---------- modal de alta / edición (mismo form) ---------- */

function DepositoModal({
  target,
  onClose,
  onDone,
}: {
  /** null = alta; con fila = edición. */
  target: DepositoRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState(target?.nombre ?? "");
  const [codigo, setCodigo] = useState(target?.codigo ?? "");
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const nombreError = attempted && nombre.trim() === "" ? "el nombre es obligatorio" : null;
  const valid = nombre.trim() !== "";

  const submit = async () => {
    setAttempted(true);
    setSubmitError(null);
    if (!valid || sending) return;
    setSending(true);
    const supabase = getSupabase();
    const payload = { nombre: nombre.trim(), codigo: codigo.trim() === "" ? null : codigo.trim() };
    const { data, error } = target
      ? await supabase.from("depositos").update(payload).eq("id", target.id).select("id")
      : await supabase.from("depositos").insert(payload).select("id");
    setSending(false);
    if (error) {
      // error LITERAL de la DB (unique violation del nombre incluida)
      setSubmitError(error.message);
      return;
    }
    if ((data?.length ?? 0) === 0) {
      setSubmitError("La base de datos no aceptó el cambio — verificá que tu cuenta siga siendo administrador activo.");
      return;
    }
    toast({
      type: "exito",
      title: target ? "Depósito actualizado" : "Depósito creado",
      detail: codigo.trim() ? `${nombre.trim()} (${codigo.trim()})` : nombre.trim(),
    });
    onDone();
  };

  return (
    <Modal
      open
      onClose={sending ? () => {} : onClose}
      title={target ? "Editar depósito" : "Nuevo depósito"}
      width={440}
      closeOnBackdrop={!sending}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field
          label="nombre"
          htmlFor="deposito-nombre"
          error={nombreError}
          hint="normalizado: evitá cargar variantes del mismo depósito (Exolgan / EXOLGAN)"
        >
          <Input
            id="deposito-nombre"
            value={nombre}
            error={nombreError}
            placeholder="ej: Exolgan"
            maxLength={120}
            onChange={(e) => setNombre(e.target.value)}
          />
        </Field>
        <Field label="código" htmlFor="deposito-codigo" hint="opcional — sigla interna">
          <Input
            id="deposito-codigo"
            value={codigo}
            placeholder="opcional"
            maxLength={40}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </Field>
        {submitError && <FormAlert>{submitError}</FormAlert>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon={target ? "ti-device-floppy" : "ti-plus"}
            loading={sending}
            disabled={!valid}
            onClick={() => void submit()}
          >
            {target ? "Guardar cambios" : "Crear depósito"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- modal de fusión (dos pasos: elegir → confirmar) ---------- */

function FusionModal({
  depositos,
  onClose,
  onDone,
}: {
  depositos: DepositoRow[];
  onClose: () => void;
  onDone: (resumen: { operaciones: number; origen: string; destino: string }) => void;
}) {
  const [origenId, setOrigenId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [step, setStep] = useState<"elegir" | "confirmar">("elegir");
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const origen = depositos.find((d) => d.id === origenId) ?? null;
  const destino = depositos.find((d) => d.id === destinoId) ?? null;
  const mismoDeposito = origenId !== "" && origenId === destinoId;
  const valid = origenId !== "" && destinoId !== "" && !mismoDeposito;

  const confirmar = async () => {
    if (sending || !origen || !destino) return;
    setSending(true);
    setSubmitError(null);
    const { data, error } = await getSupabase().rpc("crm_fusionar_depositos", {
      p_origen: origen.id,
      p_destino: destino.id,
    });
    setSending(false);
    if (error) {
      // literal: "el destino de la fusión debe estar activo", "requiere administrador", etc.
      setSubmitError(error.message);
      return;
    }
    const r = data as { operaciones_repunteadas?: number; origen?: string; destino?: string } | null;
    onDone({
      operaciones: r?.operaciones_repunteadas ?? 0,
      origen: r?.origen ?? origen.nombre,
      destino: r?.destino ?? destino.nombre,
    });
  };

  return (
    <Modal
      open
      onClose={sending ? () => {} : onClose}
      title="Fusionar depósitos duplicados"
      width={480}
      closeOnBackdrop={!sending}
    >
      {step === "elegir" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.55 }}>
            Usalo para unificar duplicados de carga (ej: &quot;Exolgan&quot; vs &quot;EXOLGAN&quot;). Todas las
            operaciones del depósito <strong>origen</strong> se repuntean al <strong>destino</strong> y el origen queda
            desactivado.
          </p>
          <Field label="origen — se fusiona y se desactiva" htmlFor="fusion-origen">
            <Select id="fusion-origen" value={origenId} onChange={(e) => setOrigenId(e.target.value)}>
              <option value="">— elegí el depósito de origen —</option>
              {depositos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                  {d.activo ? "" : " (inactivo)"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="destino — se conserva y recibe las operaciones" htmlFor="fusion-destino">
            <Select id="fusion-destino" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
              <option value="">— elegí el depósito destino —</option>
              {depositos
                .filter((d) => d.activo)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
            </Select>
          </Field>
          {mismoDeposito && <FormAlert tone="warning">Origen y destino no pueden ser el mismo depósito.</FormAlert>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" icon="ti-arrow-right" disabled={!valid} onClick={() => setStep("confirmar")}>
              Continuar
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FormAlert tone="warning">
            Vas a mover TODAS las operaciones de <strong>{origen?.nombre}</strong> a <strong>{destino?.nombre}</strong> y
            desactivar <strong>{origen?.nombre}</strong>. Esta acción no se puede deshacer.
          </FormAlert>
          {submitError && <FormAlert>{submitError}</FormAlert>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="ghost" onClick={() => setStep("elegir")} disabled={sending}>
              Volver
            </Button>
            <Button variant="danger" icon="ti-git-merge" loading={sending} onClick={() => void confirmar()}>
              Fusionar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---------- página ---------- */

export default function DepositosPage() {
  const router = useRouter();
  const toast = useToast();
  const { perfil } = useSession();

  const [rows, setRows] = useState<DepositoRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; target: DepositoRow | null }>({ open: false, target: null });
  const [fusionOpen, setFusionOpen] = useState(false);
  const [estadoTarget, setEstadoTarget] = useState<{ deposito: DepositoRow; activo: boolean } | null>(null);
  const [estadoSending, setEstadoSending] = useState(false);

  const isAdmin = perfil?.rol === "administrador";

  useEffect(() => {
    if (perfil && !isAdmin) router.replace("/inicio");
  }, [perfil, isAdmin, router]);

  // setState siempre después del await (regla set-state-in-effect)
  const load = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("depositos")
      .select("id, nombre, codigo, activo, created_at")
      .order("activo", { ascending: false })
      .order("nombre");
    if (error) {
      setRows(null);
      // 42P01 = la migración 023 todavía no está aplicada en este entorno — mensaje
      // propio en vez del error crudo de Postgres (degrada con contexto, no en silencio).
      setLoadError(
        error.code === "42P01"
          ? "El catálogo de depósitos todavía no está desplegado en esta base (migración 023 pendiente)."
          : error.message,
      );
      return;
    }
    setLoadError(null);
    setRows(data as DepositoRow[]);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      await load();
    })();
  }, [isAdmin, load]);

  // refetch al recuperar foco (mismo criterio que navieras/plantas/solicitudes)
  useEffect(() => {
    if (!isAdmin) return;
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isAdmin, load]);

  const loading = rows === null && !loadError;
  const activos = (rows ?? []).filter((r) => r.activo).length;
  const inactivos = (rows ?? []).length - activos;

  const submitEstado = async () => {
    if (!estadoTarget || estadoSending) return;
    setEstadoSending(true);
    const { data, error } = await getSupabase()
      .from("depositos")
      .update({ activo: estadoTarget.activo })
      .eq("id", estadoTarget.deposito.id)
      .select("id");
    setEstadoSending(false);
    if (error) {
      toast({ type: "error", title: "No se pudo cambiar el estado", detail: error.message });
      return;
    }
    if ((data?.length ?? 0) === 0) {
      toast({
        type: "error",
        title: "No se pudo cambiar el estado",
        detail: "La base de datos no aceptó el cambio — verificá que tu cuenta siga siendo administrador activo.",
      });
      return;
    }
    toast({
      type: "exito",
      title: estadoTarget.activo ? `${estadoTarget.deposito.nombre} reactivado` : `${estadoTarget.deposito.nombre} desactivado`,
      detail: estadoTarget.activo
        ? "Vuelve a estar disponible en el picker de retiro de la tanda."
        : "Deja de ofrecerse en el picker de retiro de la tanda; las operaciones ya cargadas no se ven afectadas.",
    });
    setEstadoTarget(null);
    void load();
  };

  const columns: Column<DepositoRow>[] = [
    {
      key: "nombre",
      header: "depósito",
      render: (r) => (
        <span style={{ color: r.activo ? "var(--color-text-primary)" : "var(--color-text-faint)", fontWeight: 600 }}>
          {r.nombre}
        </span>
      ),
      sortValue: (r) => r.nombre,
    },
    {
      key: "codigo",
      header: "código",
      render: (r) => (r.codigo ? <span className="mono">{r.codigo}</span> : "—"),
      sortValue: (r) => r.codigo,
    },
    {
      key: "estado",
      header: "estado",
      render: (r) =>
        r.activo ? (
          <Badge tone="verde" icon="ti-circle-check">
            activo
          </Badge>
        ) : (
          <Badge tone="neutro" icon="ti-ban">
            inactivo
          </Badge>
        ),
      sortValue: (r) => (r.activo ? 0 : 1),
    },
    {
      key: "creado",
      header: "creado",
      numeric: true,
      render: (r) => fmtFecha(r.created_at),
      sortValue: (r) => r.created_at,
      hideOnMobile: true,
    },
    {
      key: "acciones",
      header: "",
      align: "right",
      render: (r) => (
        <span style={{ display: "inline-flex", gap: 6 }}>
          <Button
            variant="ghost"
            icon="ti-pencil"
            style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}
            onClick={() => setModal({ open: true, target: r })}
          >
            Editar
          </Button>
          {r.activo ? (
            <Button
              variant="danger"
              icon="ti-ban"
              style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}
              onClick={() => setEstadoTarget({ deposito: r, activo: false })}
            >
              Desactivar
            </Button>
          ) : (
            <Button
              variant="ghost"
              icon="ti-circle-check"
              style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}
              onClick={() => setEstadoTarget({ deposito: r, activo: true })}
            >
              Reactivar
            </Button>
          )}
        </span>
      ),
    },
  ];

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Depósitos" />
        <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} loading skeletonRows={3} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Depósitos"
        counters={
          rows !== null ? (
            <>
              <Badge tone="neutro" mono icon="ti-building-warehouse">
                {activos} activo{activos === 1 ? "" : "s"}
              </Badge>
              {inactivos > 0 && (
                <Badge tone="neutro" mono icon="ti-ban">
                  {inactivos} inactivo{inactivos === 1 ? "" : "s"}
                </Badge>
              )}
            </>
          ) : undefined
        }
        action={
          <span style={{ display: "inline-flex", gap: 8 }}>
            {rows !== null && rows.length >= 2 && (
              <Button variant="ghost" icon="ti-git-merge" onClick={() => setFusionOpen(true)}>
                Fusionar duplicados
              </Button>
            )}
            <Button variant="primary" icon="ti-plus" onClick={() => setModal({ open: true, target: null })}>
              Nuevo depósito
            </Button>
          </span>
        }
      />

      <DataTable
        columns={columns}
        rows={rows ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        skeletonRows={3}
        pageSize={15}
        defaultSort={{ key: "nombre", dir: "asc" }}
        errorState={
          loadError ? (
            <ErrorState title="No se pudieron cargar los depósitos" detail={loadError} onRetry={() => void load()} />
          ) : undefined
        }
        emptyState={
          <EmptyState icon="ti-building-warehouse" title="Todavía no hay depósitos cargados">
            Los depósitos estandarizan de dónde se retira cada contenedor (§4.4). Creá el primero con «Nuevo
            depósito», o dejá que se creen inline desde la carga de la tanda en /ingreso.
          </EmptyState>
        }
      />

      <p style={{ margin: "10px 2px 0", fontSize: 11.5, color: "var(--color-text-faint)", lineHeight: 1.5 }}>
        Los depósitos no se borran (conservan el historial de operaciones): «Desactivar» es una baja lógica — deja de
        ofrecerse para tandas nuevas, pero no afecta lo ya cargado. Para unificar un duplicado usá «Fusionar
        duplicados» en vez de desactivar a mano: repuntea las operaciones del origen antes de desactivarlo.
      </p>

      {modal.open && (
        <DepositoModal
          target={modal.target}
          onClose={() => setModal({ open: false, target: null })}
          onDone={() => {
            setModal({ open: false, target: null });
            void load();
          }}
        />
      )}

      {fusionOpen && (
        <FusionModal
          depositos={rows ?? []}
          onClose={() => setFusionOpen(false)}
          onDone={(resumen) => {
            setFusionOpen(false);
            toast({
              type: "exito",
              title: `${resumen.origen} fusionado en ${resumen.destino}`,
              detail: `${resumen.operaciones} operación${resumen.operaciones === 1 ? "" : "es"} repunteada${resumen.operaciones === 1 ? "" : "s"}.`,
            });
            void load();
          }}
        />
      )}

      <ConfirmDialog
        open={estadoTarget !== null}
        danger={estadoTarget?.activo === false}
        loading={estadoSending}
        title={estadoTarget?.activo ? "Reactivar depósito" : "Desactivar depósito"}
        confirmLabel={estadoTarget?.activo ? "Reactivar" : "Desactivar"}
        message={
          estadoTarget?.activo ? (
            <>
              <strong>{estadoTarget?.deposito.nombre}</strong> vuelve a estar disponible en el picker de retiro de la
              tanda.
            </>
          ) : (
            <>
              <strong>{estadoTarget?.deposito.nombre}</strong> deja de ofrecerse en el picker de retiro de la tanda.
              Las operaciones ya cargadas con este depósito no se ven afectadas.
            </>
          )
        }
        onConfirm={() => void submitEstado()}
        onCancel={() => setEstadoTarget(null)}
      />
    </>
  );
}
