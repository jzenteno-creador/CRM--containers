"use client";

// Admin → Países (B1 multi-región, migración 026): listado + alta + edición de países.
// RLS (026): SELECT activo · INSERT admin · UPDATE admin · SIN DELETE — mismo criterio
// soft que el resto de los maestros (naviera/planta/depósito nunca se borran). INSERT/
// UPDATE directos a la tabla están SANCIONADOS (AGENTS.md, "paises" en la lista admin-only
// sin impacto en costo — decisión explícita de John 2026-07-14 D4). Errores LITERALES al
// FormAlert del modal (unique violation del nombre incluida).
// Estilo NAVIERAS (pedido explícito): "activo" es un Toggle DENTRO del mismo modal de
// alta/edición — no hay un flujo separado de Desactivar/Reactivar con ConfirmDialog (a
// diferencia de plantas/depósitos). El país sirve de FK para freetime_origin/destino y
// plantas — desactivarlo solo lo saca de los pickers de creación nuevos, no toca lo ya
// cargado (la RPC de versionado exige país activo para crear/versionar tarifas).
// region ∈ {LATAM, EMEAI, APAC, NAM} — CHECK de la tabla (crm.paises.region), catálogo
// cerrado por eso va como Select y no texto libre.
// Guard admin (patrón solicitudes §14.7): skeleton + redirect; RLS es la compuerta real.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { Field, Input, Select, Toggle } from "@/components/fd/fields";
import { FormAlert } from "@/components/fd/form-alert";
import { Modal } from "@/components/fd/modal";
import { PageHeader } from "@/components/fd/page-header";
import { useToast } from "@/components/fd/toast";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

// espeja el CHECK de crm.paises.region
const REGIONES = ["LATAM", "EMEAI", "APAC", "NAM"] as const;

type PaisRow = {
  id: string;
  nombre: string;
  region: string;
  activo: boolean;
};

/* ---------- modal de alta / edición (mismo form) ---------- */

function PaisModal({
  target,
  onClose,
  onDone,
}: {
  /** null = alta; con fila = edición. */
  target: PaisRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState(target?.nombre ?? "");
  const [region, setRegion] = useState<string>(target?.region ?? "LATAM");
  // default true en el alta (columna con default true en la DB)
  const [activo, setActivo] = useState(target?.activo ?? true);
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
    const payload = { nombre: nombre.trim(), region, activo };
    const { data, error } = target
      ? await supabase.from("paises").update(payload).eq("id", target.id).select("id")
      : await supabase.from("paises").insert(payload).select("id");
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
      title: target ? "País actualizado" : "País creado",
      detail: `${payload.nombre} · región ${region}${activo ? "" : " · inactivo"}`,
    });
    onDone();
  };

  return (
    <Modal
      open
      onClose={sending ? () => {} : onClose}
      title={target ? "Editar país" : "Nuevo país"}
      width={440}
      closeOnBackdrop={!sending}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field
          label="nombre"
          htmlFor="pais-nombre"
          error={nombreError}
          hint="normalizado: todo el sistema referencia el país por este registro, nunca por texto"
        >
          <Input
            id="pais-nombre"
            value={nombre}
            error={nombreError}
            placeholder="ej: BRASIL"
            maxLength={80}
            onChange={(e) => setNombre(e.target.value)}
          />
        </Field>
        <Field label="región" htmlFor="pais-region" hint="agrupa países para reportes y filtros">
          <Select id="pais-region" value={region} onChange={(e) => setRegion(e.target.value)}>
            {REGIONES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <Toggle
          id="pais-activo"
          checked={activo}
          onChange={setActivo}
          label={
            <span>
              activo
              <span style={{ display: "block", fontSize: 11, color: "var(--color-text-faint)" }}>
                apagalo para sacarlo de los pickers de país de plantas y tarifas nuevas — no afecta lo ya cargado
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
            {target ? "Guardar cambios" : "Crear país"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- página ---------- */

export default function PaisesPage() {
  const router = useRouter();
  const { perfil } = useSession();

  const [rows, setRows] = useState<PaisRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; target: PaisRow | null }>({ open: false, target: null });

  const isAdmin = perfil?.rol === "administrador";

  useEffect(() => {
    if (perfil && !isAdmin) router.replace("/inicio");
  }, [perfil, isAdmin, router]);

  // setState siempre después del await (regla set-state-in-effect)
  const load = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("paises")
      .select("id, nombre, region, activo")
      .order("activo", { ascending: false })
      .order("nombre");
    if (error) {
      setRows(null);
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    setRows(data as PaisRow[]);
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

  const columns: Column<PaisRow>[] = [
    {
      key: "nombre",
      header: "país",
      render: (r) => (
        <span style={{ color: r.activo ? "var(--color-text-primary)" : "var(--color-text-faint)", fontWeight: 600 }}>
          {r.nombre}
        </span>
      ),
      sortValue: (r) => r.nombre,
    },
    {
      key: "region",
      header: "región",
      render: (r) => (
        <Badge tone="accent" mono>
          {r.region}
        </Badge>
      ),
      sortValue: (r) => r.region,
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
        <PageHeader title="Países" />
        <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} loading skeletonRows={6} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Países"
        counters={
          rows !== null ? (
            <>
              <Badge tone="neutro" mono icon="ti-world">
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
          <Button variant="primary" icon="ti-plus" onClick={() => setModal({ open: true, target: null })}>
            Nuevo país
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={rows ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        skeletonRows={6}
        pageSize={20}
        defaultSort={{ key: "nombre", dir: "asc" }}
        errorState={
          loadError ? (
            <ErrorState title="No se pudieron cargar los países" detail={loadError} onRetry={() => void load()} />
          ) : undefined
        }
        emptyState={
          <EmptyState icon="ti-world" title="Todavía no hay países cargados">
            Los países definen la región de las plantas y las tarifas de freetime de origen/destino. Creá el primero
            con «Nuevo país» — ARGENTINA ya viene precargada de fábrica.
          </EmptyState>
        }
      />

      <p style={{ margin: "10px 2px 0", fontSize: 11.5, color: "var(--color-text-faint)", lineHeight: 1.5 }}>
        Los países no se borran (conservan el historial de plantas y tarifas): «activo» es una baja lógica — deja de
        ofrecerse en los pickers de país nuevos, pero no afecta lo ya cargado.
      </p>

      {modal.open && (
        <PaisModal
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
