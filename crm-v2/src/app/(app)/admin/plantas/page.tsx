"use client";

// Admin → Plantas (M9 + M4 Bloque 2): listado + alta + edición + baja lógica.
// RLS verificada en vivo (2026-07-12): SELECT activos · INSERT admin · UPDATE admin ·
// SIN DELETE — por eso acá NUNCA hay "borrar": la baja es `activa = false` (soft),
// igual que el resto del sistema (naviera nunca se borra, usuario se suspende).
// INSERT/UPDATE directos a la tabla (RLS enforcea, sin RPC de maestros — mismo
// patrón que /admin/navieras). Errores LITERALES al FormAlert del modal (unique
// violation del nombre incluida — el CHECK de catálogo cerrado se eliminó en 019).
// El listado muestra TAMBIÉN las inactivas (con badge) para poder reactivarlas;
// los pickers de planta de /ingreso y /admin/solicitudes filtran `activa=true`.
// Guard admin (patrón solicitudes §14.7): skeleton + redirect; RLS es la compuerta real.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { Field, Input } from "@/components/fd/fields";
import { FormAlert } from "@/components/fd/form-alert";
import { ConfirmDialog, Modal } from "@/components/fd/modal";
import { PageHeader } from "@/components/fd/page-header";
import { useToast } from "@/components/fd/toast";
import { fmtFecha } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

type PlantaRow = {
  id: string;
  nombre: string;
  codigo: string | null;
  activa: boolean;
  created_at: string;
};

/* ---------- modal de alta / edición (mismo form) ---------- */

function PlantaModal({
  target,
  onClose,
  onDone,
}: {
  /** null = alta; con fila = edición. */
  target: PlantaRow | null;
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
      ? await supabase.from("plantas").update(payload).eq("id", target.id).select("id")
      : await supabase.from("plantas").insert(payload).select("id");
    setSending(false);
    if (error) {
      // error LITERAL de la DB (unique violation del nombre incluida)
      setSubmitError(error.message);
      return;
    }
    if ((data?.length ?? 0) === 0) {
      // UPDATE que no devolvió fila: RLS lo filtró en silencio (cuenta sin permisos)
      setSubmitError("La base de datos no aceptó el cambio — verificá que tu cuenta siga siendo administrador activo.");
      return;
    }
    toast({
      type: "exito",
      title: target ? "Planta actualizada" : "Planta creada",
      detail: codigo.trim() ? `${nombre.trim()} (${codigo.trim()})` : nombre.trim(),
    });
    onDone();
  };

  return (
    <Modal
      open
      onClose={sending ? () => {} : onClose}
      title={target ? "Editar planta" : "Nueva planta"}
      width={440}
      closeOnBackdrop={!sending}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field
          label="nombre"
          htmlFor="planta-nombre"
          error={nombreError}
          hint="normalizado: todo el sistema referencia la planta por este registro, nunca por texto"
        >
          <Input
            id="planta-nombre"
            value={nombre}
            error={nombreError}
            placeholder="ej: PLANTA ZÁRATE"
            maxLength={120}
            onChange={(e) => setNombre(e.target.value)}
          />
        </Field>
        <Field label="código" htmlFor="planta-codigo" hint="opcional — sigla interna">
          <Input
            id="planta-codigo"
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
            {target ? "Guardar cambios" : "Crear planta"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- página ---------- */

export default function PlantasPage() {
  const router = useRouter();
  const toast = useToast();
  const { perfil } = useSession();

  const [rows, setRows] = useState<PlantaRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; target: PlantaRow | null }>({ open: false, target: null });
  const [estadoTarget, setEstadoTarget] = useState<{ planta: PlantaRow; activa: boolean } | null>(null);
  const [estadoSending, setEstadoSending] = useState(false);

  const isAdmin = perfil?.rol === "administrador";

  useEffect(() => {
    if (perfil && !isAdmin) router.replace("/inicio");
  }, [perfil, isAdmin, router]);

  // setState siempre después del await (regla set-state-in-effect)
  const load = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("plantas")
      .select("id, nombre, codigo, activa, created_at")
      .order("activa", { ascending: false })
      .order("nombre");
    if (error) {
      setRows(null);
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    setRows(data as PlantaRow[]);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      await load();
    })();
  }, [isAdmin, load]);

  // refetch al recuperar foco (mismo criterio que navieras/solicitudes)
  useEffect(() => {
    if (!isAdmin) return;
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isAdmin, load]);

  const loading = rows === null && !loadError;
  const activas = (rows ?? []).filter((r) => r.activa).length;
  const inactivas = (rows ?? []).length - activas;

  const submitEstado = async () => {
    if (!estadoTarget || estadoSending) return;
    setEstadoSending(true);
    const { data, error } = await getSupabase()
      .from("plantas")
      .update({ activa: estadoTarget.activa })
      .eq("id", estadoTarget.planta.id)
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
      title: estadoTarget.activa ? `${estadoTarget.planta.nombre} reactivada` : `${estadoTarget.planta.nombre} desactivada`,
      detail: estadoTarget.activa
        ? "Vuelve a estar disponible en los pickers de planta."
        : "Deja de ofrecerse en los pickers de planta destino y de asignación de usuarios; las operaciones ya cargadas no se ven afectadas.",
    });
    setEstadoTarget(null);
    void load();
  };

  const columns: Column<PlantaRow>[] = [
    {
      key: "nombre",
      header: "planta",
      render: (r) => (
        <span
          style={{
            color: r.activa ? "var(--color-text-primary)" : "var(--color-text-faint)",
            fontWeight: 600,
          }}
        >
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
        r.activa ? (
          <Badge tone="verde" icon="ti-circle-check">
            activa
          </Badge>
        ) : (
          <Badge tone="neutro" icon="ti-ban">
            inactiva
          </Badge>
        ),
      sortValue: (r) => (r.activa ? 0 : 1),
    },
    {
      key: "creada",
      header: "creada",
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
          {r.activa ? (
            <Button
              variant="danger"
              icon="ti-ban"
              style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}
              onClick={() => setEstadoTarget({ planta: r, activa: false })}
            >
              Desactivar
            </Button>
          ) : (
            <Button
              variant="ghost"
              icon="ti-circle-check"
              style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}
              onClick={() => setEstadoTarget({ planta: r, activa: true })}
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
        <PageHeader title="Plantas" />
        <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} loading skeletonRows={3} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Plantas"
        counters={
          rows !== null ? (
            <>
              <Badge tone="neutro" mono icon="ti-building-factory-2">
                {activas} activa{activas === 1 ? "" : "s"}
              </Badge>
              {inactivas > 0 && (
                <Badge tone="neutro" mono icon="ti-ban">
                  {inactivas} inactiva{inactivas === 1 ? "" : "s"}
                </Badge>
              )}
            </>
          ) : undefined
        }
        action={
          <Button variant="primary" icon="ti-plus" onClick={() => setModal({ open: true, target: null })}>
            Nueva planta
          </Button>
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
            <ErrorState title="No se pudieron cargar las plantas" detail={loadError} onRetry={() => void load()} />
          ) : undefined
        }
        emptyState={
          <EmptyState icon="ti-building-factory-2" title="Todavía no hay plantas cargadas">
            Las plantas definen dónde puede estar un contenedor y a qué planta se liga cada operador. Creá la primera
            con «Nueva planta».
          </EmptyState>
        }
      />

      <p style={{ margin: "10px 2px 0", fontSize: 11.5, color: "var(--color-text-faint)", lineHeight: 1.5 }}>
        Las plantas no se borran (conservan el historial de operaciones): «Desactivar» es una baja lógica — deja de
        ofrecerse para tandas nuevas y asignaciones de usuario, pero no afecta lo ya cargado.
      </p>

      {modal.open && (
        <PlantaModal
          target={modal.target}
          onClose={() => setModal({ open: false, target: null })}
          onDone={() => {
            setModal({ open: false, target: null });
            void load();
          }}
        />
      )}

      <ConfirmDialog
        open={estadoTarget !== null}
        danger={estadoTarget?.activa === false}
        loading={estadoSending}
        title={estadoTarget?.activa ? "Reactivar planta" : "Desactivar planta"}
        confirmLabel={estadoTarget?.activa ? "Reactivar" : "Desactivar"}
        message={
          estadoTarget?.activa ? (
            <>
              <strong>{estadoTarget?.planta.nombre}</strong> vuelve a estar disponible en los pickers de planta
              destino y de asignación de usuarios.
            </>
          ) : (
            <>
              <strong>{estadoTarget?.planta.nombre}</strong> deja de ofrecerse en los pickers de planta destino y de
              asignación de usuarios. Las operaciones y usuarios ya asignados a ella no se ven afectados.
            </>
          )
        }
        onConfirm={() => void submitEstado()}
        onCancel={() => setEstadoTarget(null)}
      />
    </>
  );
}
