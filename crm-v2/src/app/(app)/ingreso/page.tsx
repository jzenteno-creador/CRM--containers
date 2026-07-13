"use client";

// Ingreso a planta (M3 §6.1). Dos fases en una pantalla:
//  · Fase 1 — Tanda de retiro (<TandaForm>): arma el jsonb y llama a la RPC.
//  · Fase 2 — Pendientes de ingreso a planta: operaciones en_transito_a_planta que se
//    confirman en lote vía crm_confirmar_ingreso_planta.
// Patrón de página del repo (ver admin/solicitudes): useState<null|[]>, load() callback,
// toast en error transitorio, refetch al recuperar foco. Sin Realtime (v2 no lo usa).
// CERO cálculo de negocio en el front: solo se arman payloads y se muestra lo que la DB
// devuelve. RLS filtra los pendientes por planta del operador automáticamente.

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { ContainerNumber } from "@/components/container-number";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { DateField, Field, Select } from "@/components/fd/fields";
import { FieldHelp } from "@/components/fd/field-help";
import { FormAlert } from "@/components/fd/form-alert";
import { PageHeader } from "@/components/fd/page-header";
import { useToast } from "@/components/fd/toast";
import { fmtFecha, hoyAR } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { TandaForm, type Deposito, type Naviera, type Planta } from "./tanda-form";

type PendienteRow = {
  id: string;
  fecha_retiro: string;
  booking_retiro: string | null;
  retiro_de: string;
  contenedor: {
    numero_contenedor: string;
    tipo: string;
    naviera: { nombre: string } | null;
  } | null;
  // one-to-many; en en_transito_a_planta hay un solo movimiento (el retiro→planta).
  movimientos_planta: { planta_destino: { nombre: string } | null }[];
};

const MEDIOS: { value: "camion" | "tren"; label: string }[] = [
  { value: "camion", label: "Camión" },
  { value: "tren", label: "Tren" },
];

function SectionTitle({ title, count }: { title: string; count: number | null }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "22px 0 10px" }}>
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

export default function IngresoPage() {
  const toast = useToast();
  const { perfil } = useSession();

  /* ---------- maestros para el formulario (navieras + plantas + depósitos) ---------- */
  // nullable = "todavía sin cargar" → loading; así ningún setState corre síncrono en el
  // efecto (regla set-state-in-effect: los setState viven detrás del await del IIFE).
  const [maestros, setMaestros] = useState<{
    navieras: Naviera[];
    plantas: Planta[];
    depositos: Deposito[];
    /** false = la migración 023 todavía no está desplegada en este entorno (relation
     * "crm.depositos" no existe) — TandaForm degrada al Input de texto de antes. */
    depositosDisponible: boolean;
  } | null>(null);
  const [maestrosError, setMaestrosError] = useState<string | null>(null);

  const loadMaestros = useCallback(async () => {
    const supabase = getSupabase();
    const [nv, pl, dp] = await Promise.all([
      supabase.from("navieras").select("id, nombre").order("nombre"),
      // activa=true: una planta dada de baja (Admin → Plantas) deja de ofrecerse para
      // tandas nuevas, sin afectar las operaciones que ya la tienen como destino.
      supabase.from("plantas").select("id, nombre, codigo").eq("activa", true).order("nombre"),
      // activo=true (023): mismo criterio que plantas. Si la tabla todavía no existe
      // (42P01 — migración pendiente de GO) degradamos en vez de bloquear el módulo.
      supabase.from("depositos").select("id, nombre").eq("activo", true).order("nombre"),
    ]);
    if (nv.error || pl.error) {
      setMaestros(null);
      setMaestrosError((nv.error ?? pl.error)!.message);
      return;
    }
    if (dp.error && dp.error.code !== "42P01") {
      // error real de depósitos (no "no existe la tabla") — no degradamos en silencio
      // un fallo de RLS/policy; se reporta igual que navieras/plantas.
      setMaestros(null);
      setMaestrosError(dp.error.message);
      return;
    }
    setMaestrosError(null);
    setMaestros({
      navieras: nv.data as Naviera[],
      plantas: pl.data as Planta[],
      depositos: dp.error ? [] : (dp.data as Deposito[]),
      depositosDisponible: !dp.error,
    });
  }, []);

  useEffect(() => {
    void (async () => {
      await loadMaestros();
    })();
  }, [loadMaestros]);

  const maestrosLoading = maestros === null && maestrosError === null;
  const retryMaestros = () => {
    setMaestros(null);
    setMaestrosError(null);
    void loadMaestros();
  };

  /* ---------- Fase 2 — pendientes de ingreso a planta ---------- */
  const [pendientes, setPendientes] = useState<PendienteRow[] | null>(null);
  const [pendientesError, setPendientesError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [fechaLlegada, setFechaLlegada] = useState(hoyAR());
  const [medio, setMedio] = useState<"camion" | "tren">("camion");
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const [confirmSending, setConfirmSending] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const loadPendientes = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("operaciones")
      .select(
        // planta destino sale del movimiento retiro→planta; movimientos_planta tiene DOS
        // FK a plantas (origen/destino) → desambiguar por el nombre de constraint o
        // PostgREST rechaza el embed por ambigüedad.
        "id, fecha_retiro, booking_retiro, retiro_de, contenedor:contenedores(numero_contenedor, tipo, naviera:navieras(nombre)), movimientos_planta(planta_destino:plantas!movimientos_planta_planta_destino_id_fkey(nombre))",
      )
      .eq("estado", "en_transito_a_planta")
      .order("fecha_retiro", { ascending: true });
    if (error) {
      setPendientes(null);
      setPendientesError(error.message);
      return;
    }
    const rows = data as unknown as PendienteRow[];
    setPendientesError(null);
    setPendientes(rows);
    // podar de la selección los ids que ya no están (tras un refetch): se hace acá,
    // detrás del await, para no violar set-state-in-effect.
    const valid = new Set(rows.map((r) => r.id));
    setSelected((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, []);

  useEffect(() => {
    void (async () => {
      await loadPendientes();
    })();
  }, [loadPendientes]);

  // refetch al recuperar foco (mismo criterio que solicitudes / la campana §13)
  useEffect(() => {
    const onFocus = () => void loadPendientes();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadPendientes]);

  const pendientesLoading = pendientes === null && !pendientesError;

  const onCreated = useCallback(() => {
    void loadPendientes();
  }, [loadPendientes]);

  const fechaLlegadaError = confirmAttempted && fechaLlegada === "" ? "indicá la fecha de llegada" : null;

  const confirmarIngreso = async () => {
    if (confirmSending) return;
    setConfirmAttempted(true);
    setConfirmError(null);
    const ids = [...selected];
    if (ids.length === 0 || fechaLlegada === "") return;

    setConfirmSending(true);
    const { data, error } = await getSupabase().rpc("crm_confirmar_ingreso_planta", {
      p_operacion_ids: ids,
      // timestamptz AR fijo (UTC-3, sin DST) — nunca new Date(str) suelto
      p_fecha: `${fechaLlegada}T00:00:00-03:00`,
      p_medio: medio,
    });
    setConfirmSending(false);
    if (error) {
      setConfirmError(error.message);
      return;
    }
    const confirmadas = (data as { confirmadas?: number } | null)?.confirmadas ?? 0;
    if (confirmadas === ids.length) {
      toast({
        type: "exito",
        title: `${confirmadas} ingreso${confirmadas === 1 ? "" : "s"} confirmado${confirmadas === 1 ? "" : "s"}`,
        detail: "Los contenedores pasaron a en planta.",
      });
    } else {
      // la RPC no dice cuál falló → comparar confirmadas vs ids.length (anti-carrera)
      toast({
        type: "info",
        title: `Se confirmaron ${confirmadas} de ${ids.length}`,
        detail: "El resto ya no estaba pendiente (otro usuario o un refresco previo).",
      });
    }
    setSelected(new Set());
    setConfirmAttempted(false);
    void loadPendientes();
  };

  const cols: Column<PendienteRow>[] = [
    {
      key: "contenedor",
      header: "contenedor",
      render: (r) => (r.contenedor ? <ContainerNumber value={r.contenedor.numero_contenedor} /> : "—"),
      sortValue: (r) => r.contenedor?.numero_contenedor ?? null,
    },
    {
      key: "naviera",
      header: "naviera",
      render: (r) => r.contenedor?.naviera?.nombre ?? "—",
      sortValue: (r) => r.contenedor?.naviera?.nombre ?? null,
      hideOnMobile: true,
    },
    {
      key: "tipo",
      header: "tipo",
      render: (r) => r.contenedor?.tipo ?? "—",
      sortValue: (r) => r.contenedor?.tipo ?? null,
      hideOnMobile: true,
    },
    {
      key: "planta_destino",
      header: "planta destino",
      render: (r) => r.movimientos_planta?.[0]?.planta_destino?.nombre ?? "—",
      sortValue: (r) => r.movimientos_planta?.[0]?.planta_destino?.nombre ?? null,
      hideOnMobile: true,
    },
    {
      key: "retiro_de",
      header: "retiro de",
      render: (r) => r.retiro_de,
      sortValue: (r) => r.retiro_de,
      hideOnMobile: true,
    },
    {
      key: "fecha_retiro",
      header: "fecha retiro",
      numeric: true,
      render: (r) => fmtFecha(r.fecha_retiro),
      sortValue: (r) => r.fecha_retiro,
    },
    {
      key: "booking",
      header: "booking",
      render: (r) => (r.booking_retiro ? <span className="mono">{r.booking_retiro}</span> : "—"),
      sortValue: (r) => r.booking_retiro,
      hideOnMobile: true,
    },
  ];

  const pendientesCount = pendientes?.length ?? null;

  return (
    <>
      <PageHeader
        title="Ingreso a planta"
        counters={
          pendientesCount != null ? (
            <Badge tone={pendientesCount > 0 ? "amarillo" : "neutro"} mono icon="ti-truck">
              {pendientesCount} pendiente{pendientesCount === 1 ? "" : "s"} de ingreso
            </Badge>
          ) : undefined
        }
        action={
          <Button
            variant="ghost"
            icon="ti-refresh"
            onClick={() => void loadPendientes()}
            disabled={pendientesLoading}
          >
            Actualizar
          </Button>
        }
      />

      <SectionTitle title="Nueva tanda de retiro" count={null} />
      {perfil ? (
        <TandaForm
          perfil={perfil}
          navieras={maestros?.navieras ?? []}
          plantas={maestros?.plantas ?? []}
          depositos={maestros?.depositos ?? []}
          depositosDisponible={maestros?.depositosDisponible ?? false}
          onRefreshDepositos={loadMaestros}
          maestrosLoading={maestrosLoading}
          maestrosError={maestrosError}
          onRetryMaestros={retryMaestros}
          onCreated={onCreated}
        />
      ) : (
        <DataTable columns={[]} rows={[]} rowKey={() => ""} loading skeletonRows={3} />
      )}

      <SectionTitle title="Pendientes de ingreso a planta" count={pendientesCount} />

      {/* barra de acción: aparece con selección; confirma el ingreso en lote */}
      {selected.size > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            gap: 12,
            padding: 12,
            marginBottom: 10,
            background: "var(--color-surface-1)",
            border: "1px solid var(--color-accent-line)",
            borderRadius: "var(--radius-input)",
          }}
        >
          <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)", alignSelf: "center" }}>
            Confirmar ingreso de <strong className="mono">{selected.size}</strong> contenedor
            {selected.size === 1 ? "" : "es"}:
          </span>
          <Field
            label="fecha de llegada"
            htmlFor="ingreso-fecha"
            error={fechaLlegadaError}
            help={<FieldHelp fieldKey="ingreso.fecha_llegada" />}
          >
            <DateField
              id="ingreso-fecha"
              value={fechaLlegada}
              error={fechaLlegadaError}
              onChange={(e) => setFechaLlegada(e.target.value)}
            />
          </Field>
          <Field label="medio" htmlFor="ingreso-medio">
            <Select
              id="ingreso-medio"
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
          <Button
            variant="primary"
            icon="ti-circle-check"
            loading={confirmSending}
            onClick={() => void confirmarIngreso()}
            style={{ marginBottom: 1 }}
          >
            Confirmar ingreso
          </Button>
        </div>
      )}
      {confirmError && (
        <div style={{ marginBottom: 10 }}>
          <FormAlert>{confirmError}</FormAlert>
        </div>
      )}

      <DataTable
        columns={cols}
        rows={pendientes ?? []}
        rowKey={(r) => r.id}
        loading={pendientesLoading}
        skeletonRows={5}
        pageSize={12}
        maxHeight={480}
        defaultSort={{ key: "fecha_retiro", dir: "asc" }}
        selection={{ ids: selected, onChange: setSelected }}
        errorState={
          pendientesError ? (
            <ErrorState
              title="No se pudieron cargar los pendientes"
              detail={pendientesError}
              onRetry={() => void loadPendientes()}
            />
          ) : undefined
        }
        emptyState={
          <EmptyState icon="ti-truck" title="Sin pendientes de ingreso">
            Acá aparece cada contenedor de una tanda de retiro que todavía no confirmó su llegada a la planta. Creá una
            tanda arriba sin marcar &quot;confirmar ingreso ahora&quot; y sus contenedores quedan listados acá hasta que
            confirmes el ingreso, que es lo que los pasa a <strong>en planta</strong>.
          </EmptyState>
        }
      />
    </>
  );
}
