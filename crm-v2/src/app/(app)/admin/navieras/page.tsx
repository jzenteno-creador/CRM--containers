"use client";

// Admin → Navieras (M9 + B1 multi-región): listado + alta + edición de líneas navieras.
// RLS verificada en vivo (plan-m9): SELECT activos · INSERT admin · UPDATE admin ·
// SIN DELETE — por eso acá no hay "borrar" (consistente con el soft-delete global).
// INSERT/UPDATE directos a la tabla (RLS enforcea); errores LITERALES al FormAlert
// del modal (unique violation del nombre incluida). La tarifa vigente por naviera
// sale de un embed a freetime_origin filtrado (vigente_hasta is null + regimen
// 'vacios') — solo display: el versionado vive en /admin/tarifas.
// B1 (migración 026): `tipo_proveedor` (naviera/forwarder, paridad Excel) y `activa`
// (solo las navieras activas aparecen en los combos operativos — ver ingreso/tanda-form.tsx)
// son editables en el mismo modal, estilo cobra_detention_origen (Toggle/Select dentro
// del alta/edición, sin flujo separado de desactivar).
// Guard admin (patrón solicitudes §14.7): skeleton + redirect; RLS es la compuerta real.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { Field, Input, Select, Toggle } from "@/components/fd/fields";
import { FieldHelp } from "@/components/fd/field-help";
import { FormAlert } from "@/components/fd/form-alert";
import { Modal } from "@/components/fd/modal";
import { PageHeader } from "@/components/fd/page-header";
import { useToast } from "@/components/fd/toast";
import { fmtUSDTarifa } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

// espeja el CHECK de crm.navieras.tipo_proveedor
const TIPO_PROVEEDOR_LABELS: Record<string, string> = {
  naviera: "Naviera",
  forwarder: "Forwarder",
};

type TarifaVigente = {
  dias_libres: number;
  tarifa_usd_dia: number;
  tipo: string;
};

type NavieraRow = {
  id: string;
  nombre: string;
  cobra_detention_origen: boolean;
  tipo_proveedor: string;
  activa: boolean;
  freetime_origin: TarifaVigente[];
};

/* ---------- modal de alta / edición (mismo form) ---------- */

function NavieraModal({
  target,
  onClose,
  onDone,
}: {
  /** null = alta; con fila = edición. */
  target: NavieraRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState(target?.nombre ?? "");
  // default true en el alta (columna con default true en la DB)
  const [cobra, setCobra] = useState(target?.cobra_detention_origen ?? true);
  // defaults que espejan la columna (tipo_proveedor default 'naviera', activa default true)
  const [tipoProveedor, setTipoProveedor] = useState(target?.tipo_proveedor ?? "naviera");
  const [activa, setActiva] = useState(target?.activa ?? true);
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
    const payload = {
      nombre: nombre.trim(),
      cobra_detention_origen: cobra,
      tipo_proveedor: tipoProveedor,
      activa,
    };
    const { data, error } = target
      ? await supabase.from("navieras").update(payload).eq("id", target.id).select("id")
      : await supabase.from("navieras").insert(payload).select("id");
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
      title: target ? "Naviera actualizada" : "Naviera creada",
      detail: `${nombre.trim()} · ${TIPO_PROVEEDOR_LABELS[tipoProveedor] ?? tipoProveedor} · ${cobra ? "cobra" : "no cobra"} detention en origen${activa ? "" : " · inactiva"}`,
    });
    onDone();
  };

  return (
    <Modal
      open
      onClose={sending ? () => {} : onClose}
      title={target ? "Editar naviera" : "Nueva naviera"}
      width={460}
      closeOnBackdrop={!sending}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field
          label="nombre"
          htmlFor="naviera-nombre"
          error={nombreError}
          hint="normalizado: todo el sistema referencia la naviera por este registro, nunca por texto"
        >
          <Input
            id="naviera-nombre"
            value={nombre}
            error={nombreError}
            placeholder="ej: HAPAG LLOYD"
            maxLength={120}
            onChange={(e) => setNombre(e.target.value)}
          />
        </Field>
        <Field
          label="tipo de proveedor"
          htmlFor="naviera-tipo"
          help={<FieldHelp fieldKey="admin.naviera.tipo_proveedor" />}
        >
          <Select id="naviera-tipo" value={tipoProveedor} onChange={(e) => setTipoProveedor(e.target.value)}>
            {Object.entries(TIPO_PROVEEDOR_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Toggle
          id="naviera-activa"
          checked={activa}
          onChange={setActiva}
          label={
            <span>
              activa
              <span style={{ display: "block", fontSize: 11, color: "var(--color-text-faint)" }}>
                solo las navieras activas aparecen en los formularios operativos (ej: tanda de retiro en Ingreso)
              </span>
            </span>
          }
        />
        <Toggle
          id="naviera-cobra"
          checked={cobra}
          onChange={setCobra}
          label={
            <span>
              cobra detention en origen
              <span style={{ display: "block", fontSize: 11, color: "var(--color-text-faint)" }}>
                apagalo si la línea no factura detention en Argentina (sin alertas de costo)
              </span>
            </span>
          }
        />
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
            {target ? "Guardar cambios" : "Crear naviera"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- página ---------- */

export default function NavierasPage() {
  const router = useRouter();
  const { perfil } = useSession();

  const [rows, setRows] = useState<NavieraRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; target: NavieraRow | null }>({ open: false, target: null });

  const isAdmin = perfil?.rol === "administrador";

  useEffect(() => {
    if (perfil && !isAdmin) router.replace("/inicio");
  }, [perfil, isAdmin, router]);

  // setState siempre después del await (regla set-state-in-effect)
  const load = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("navieras")
      .select(
        "id, nombre, cobra_detention_origen, tipo_proveedor, activa, freetime_origin(dias_libres, tarifa_usd_dia, tipo)",
      )
      .eq("freetime_origin.regimen", "vacios")
      .is("freetime_origin.vigente_hasta", null)
      .order("activa", { ascending: false })
      .order("nombre");
    if (error) {
      setRows(null);
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    setRows(data as NavieraRow[]);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      await load();
    })();
  }, [isAdmin, load]);

  // refetch al recuperar foco (mismo criterio que solicitudes)
  useEffect(() => {
    if (!isAdmin) return;
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isAdmin, load]);

  const loading = rows === null && !loadError;

  const columns: Column<NavieraRow>[] = [
    {
      key: "nombre",
      header: "naviera",
      render: (r) => <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{r.nombre}</span>,
      sortValue: (r) => r.nombre,
    },
    {
      key: "tipo_proveedor",
      header: "tipo",
      render: (r) => (
        <Badge tone={r.tipo_proveedor === "forwarder" ? "accent" : "neutro"}>
          {TIPO_PROVEEDOR_LABELS[r.tipo_proveedor] ?? r.tipo_proveedor}
        </Badge>
      ),
      sortValue: (r) => r.tipo_proveedor,
    },
    {
      key: "activa",
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
      key: "detention",
      header: "detention en origen",
      render: (r) =>
        r.cobra_detention_origen ? (
          <Badge tone="verde" icon="ti-cash">
            cobra
          </Badge>
        ) : (
          <Badge tone="neutro">no cobra</Badge>
        ),
      sortValue: (r) => (r.cobra_detention_origen ? 0 : 1),
      hideOnMobile: true,
    },
    {
      key: "tarifa",
      header: "tarifa vigente (vacíos)",
      align: "right",
      render: (r) => {
        // NOTA (B1): este embed no filtra por país — con multi-región activa una naviera
        // puede tener más de una versión vigente de "vacíos" (una por país) y acá se
        // muestra la primera que devuelva PostgREST (informativo). El detalle completo
        // y correcto por país vive en Admin → Tarifas.
        const t = r.freetime_origin[0];
        if (!t) {
          return <span style={{ fontSize: 11.5, color: "var(--color-text-faint)" }}>sin tarifa vigente</span>;
        }
        return (
          <span className="mono">
            {t.dias_libres} días · {fmtUSDTarifa(t.tarifa_usd_dia)}/día · {t.tipo}
          </span>
        );
      },
      sortValue: (r) => r.freetime_origin[0]?.tarifa_usd_dia ?? null,
      hideOnMobile: true,
    },
    {
      key: "acciones",
      header: "",
      align: "right",
      render: (r) => (
        <Button
          variant="ghost"
          icon="ti-pencil"
          style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}
          onClick={() => setModal({ open: true, target: r })}
        >
          Editar
        </Button>
      ),
    },
  ];

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Navieras" />
        <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} loading skeletonRows={6} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Navieras"
        counters={
          rows !== null ? (
            <Badge tone="neutro" mono icon="ti-ship">
              {rows.length} naviera{rows.length === 1 ? "" : "s"}
            </Badge>
          ) : undefined
        }
        action={
          <Button variant="primary" icon="ti-plus" onClick={() => setModal({ open: true, target: null })}>
            Nueva naviera
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={rows ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        skeletonRows={6}
        pageSize={15}
        defaultSort={{ key: "nombre", dir: "asc" }}
        errorState={
          loadError ? (
            <ErrorState title="No se pudieron cargar las navieras" detail={loadError} onRetry={() => void load()} />
          ) : undefined
        }
        emptyState={
          <EmptyState icon="ti-ship" title="Todavía no hay navieras">
            Acá se administran las líneas navieras del sistema. Cada contenedor referencia su naviera para calcular el
            freetime y el costo. Creá la primera con «Nueva naviera» y después cargale su tarifa en Admin → Tarifas de
            freetime.
          </EmptyState>
        }
      />

      <p style={{ margin: "10px 2px 0", fontSize: 11.5, color: "var(--color-text-faint)", lineHeight: 1.5 }}>
        Las navieras no se borran (conservan el historial de operaciones). La tarifa vigente se muestra a título
        informativo — el versionado vive en Admin → Tarifas de freetime.
      </p>

      {modal.open && (
        <NavieraModal
          target={modal.target}
          onClose={() => setModal({ open: false, target: null })}
          onDone={() => {
            setModal({ open: false, target: null });
            void load();
          }}
        />
      )}
    </>
  );
}
