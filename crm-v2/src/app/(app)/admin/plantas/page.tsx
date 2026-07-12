"use client";

// Admin → Plantas (M9): listado SOLO LECTURA.
// Verificado en vivo (plan-m9): la tabla plantas tiene únicamente policy de SELECT —
// no existe write policy, así que el alta/edición ES IMPOSIBLE desde el front sin una
// migración de backend (DDL prohibido fuera del schema-builder). Esta pantalla lo
// dice explícito en un aviso en vez de ofrecer botones que fallarían.
// Guard admin (patrón solicitudes §14.7): skeleton + redirect; RLS es la compuerta real.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { FormAlert } from "@/components/fd/form-alert";
import { PageHeader } from "@/components/fd/page-header";
import { fmtFecha } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

type PlantaRow = {
  id: string;
  nombre: string;
  codigo: string | null;
  created_at: string;
};

export default function PlantasPage() {
  const router = useRouter();
  const { perfil } = useSession();

  const [rows, setRows] = useState<PlantaRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isAdmin = perfil?.rol === "administrador";

  useEffect(() => {
    if (perfil && !isAdmin) router.replace("/inicio");
  }, [perfil, isAdmin, router]);

  // setState siempre después del await (regla set-state-in-effect)
  const load = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("plantas")
      .select("id, nombre, codigo, created_at")
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

  const loading = rows === null && !loadError;

  const columns: Column<PlantaRow>[] = [
    {
      key: "nombre",
      header: "planta",
      render: (r) => <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{r.nombre}</span>,
      sortValue: (r) => r.nombre,
    },
    {
      key: "codigo",
      header: "código",
      render: (r) => (r.codigo ? <span className="mono">{r.codigo}</span> : "—"),
      sortValue: (r) => r.codigo,
    },
    {
      key: "creada",
      header: "creada",
      numeric: true,
      render: (r) => fmtFecha(r.created_at),
      sortValue: (r) => r.created_at,
      hideOnMobile: true,
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
            <Badge tone="neutro" mono icon="ti-building-factory-2">
              {rows.length} planta{rows.length === 1 ? "" : "s"}
            </Badge>
          ) : undefined
        }
        action={
          <Button variant="ghost" icon="ti-refresh" onClick={() => void load()} disabled={loading}>
            Actualizar
          </Button>
        }
      />

      <div style={{ marginBottom: 14 }}>
        <FormAlert tone="info">
          Listado de solo lectura: el alta o la edición de plantas requiere una migración de backend (la tabla no
          tiene política de escritura) — pedila a administración del sistema.
        </FormAlert>
      </div>

      <DataTable
        columns={columns}
        rows={rows ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        skeletonRows={3}
        errorState={
          loadError ? (
            <ErrorState title="No se pudieron cargar las plantas" detail={loadError} onRetry={() => void load()} />
          ) : undefined
        }
        emptyState={
          <EmptyState icon="ti-building-factory-2" title="No hay plantas cargadas">
            Las plantas definen dónde puede estar un contenedor y a qué planta se liga cada operador. Se cargan por
            migración de backend — pedila a administración del sistema.
          </EmptyState>
        }
      />
    </>
  );
}
