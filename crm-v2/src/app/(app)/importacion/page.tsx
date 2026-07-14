"use client";

// Importación (M5 B2 §6.4). Ciclo impo: arribo a terminal → retiro de terminal → ingreso
// a planta → devolución del vacío (corta el reloj de demurrage/detention). Una orden trae
// 1-4 contenedores con arribo común (mismo buque); los retiros son escalonados (mismo
// camión, varios viajes el mismo día) — por eso Fase 2 · "en terminal" abre un modal con
// fecha default + fecha editable POR FILA en vez de la fecha única del resto de los grupos.
//
// Dos fases en una pantalla (mismo patrón que /ingreso y /egreso):
//  · Fase 1 — Nueva orden (<OrdenImpoForm>): arma el jsonb y llama a crm_crear_orden_impo.
//  · Fase 2 — Pendientes, 4 grupos por estado (colapsables): cada uno confirma en lote con
//    su propia RPC de transición. CERO cálculo de negocio en el front: solo se arman
//    payloads y se muestra lo que la DB devuelve.
//
// Anular (supervisor+): acción por fila con motivo obligatorio, disponible en cualquier
// grupo — misma RPC (crm_anular_operacion_impo) y mismo patrón que la ficha de contenedor
// EXPO (AnularOperacionModal), gateada acá también por rol (UX; el enforcement real es la
// RPC + RLS).
//
// Sin Realtime (v2 no lo usa). Refetch al recuperar foco, igual que /ingreso y /egreso.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { CollapsibleSection } from "@/components/fd/collapsible-section";
import { ContainerNumber } from "@/components/container-number";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { DateField, Field, Textarea, TimeField } from "@/components/fd/fields";
import { FormAlert } from "@/components/fd/form-alert";
import { Modal } from "@/components/fd/modal";
import { PageHeader } from "@/components/fd/page-header";
import { useToast } from "@/components/fd/toast";
import { fmtFecha, hoyAR } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { OrdenImpoForm, type Naviera, type Planta } from "./orden-form";

type PendienteImpoRow = {
  id: string;
  estado: string;
  fecha_retiro_terminal: string | null;
  fecha_ingreso_planta: string | null;
  fecha_devolucion: string | null;
  orden: {
    numero_orden: string;
    fecha_arribo_terminal: string;
    naviera: { nombre: string } | null;
    planta_destino: { nombre: string } | null;
  } | null;
  contenedor: { numero_contenedor: string; tipo: string } | null;
};

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

const ACTION_BAR: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: 12,
  padding: 12,
  marginBottom: 10,
  background: "var(--color-surface-1)",
  border: "1px solid var(--color-accent-line)",
  borderRadius: "var(--radius-input)",
};

function etiquetaFila(r: PendienteImpoRow): string {
  const num = r.contenedor?.numero_contenedor ?? "—";
  const orden = r.orden?.numero_orden ?? "—";
  return `${num} (orden ${orden})`;
}

/* ═══════════════ Anular (supervisor+) — compartido por los 4 grupos ═══════════════ */

function AnularImpoModal({
  target,
  onClose,
  onDone,
}: {
  target: { id: string; label: string };
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
    const { error } = await getSupabase().rpc("crm_anular_operacion_impo", {
      p_operacion_impo_id: target.id,
      p_motivo: motivo.trim(),
    });
    setSending(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    toast({
      type: "exito",
      title: "Operación de importación anulada",
      detail: `${target.label} quedó anulada, con tu usuario y el motivo registrados.`,
    });
    onDone();
  };

  return (
    <Modal
      open
      onClose={sending ? () => {} : onClose}
      title="Anular operación de importación"
      width={480}
      closeOnBackdrop={!sending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button variant="danger" icon="ti-ban" loading={sending} disabled={!valid} onClick={() => void submit()}>
            Anular operación
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FormAlert tone="warning">
          La anulación es <strong>definitiva</strong>: el ciclo de importación de{" "}
          <span className="mono">{target.label}</span> sale de los pendientes y queda como anulado, con tu usuario y el
          motivo registrados en el historial.
        </FormAlert>
        <Field label="motivo de la anulación" htmlFor="anular-impo-motivo" error={motivoError} hint="queda en el historial de la operación">
          <Textarea
            id="anular-impo-motivo"
            rows={3}
            value={motivo}
            error={motivoError}
            onChange={(e) => setMotivo(e.target.value)}
            onBlur={() => setTouched(true)}
          />
        </Field>
        {submitError && <FormAlert>{submitError}</FormAlert>}
      </div>
    </Modal>
  );
}

/* ═══════════════ Grupo 1 — En terminal → Confirmar retiro (fecha por fila) ═══════════ */

function ConfirmarRetiroModal({
  rows,
  onClose,
  onDone,
}: {
  rows: PendienteImpoRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [fechaDefault, setFechaDefault] = useState(hoyAR());
  const [horaDefault, setHoraDefault] = useState("08:00");
  const [porFila, setPorFila] = useState<Record<string, { fecha: string; hora: string }>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, { fecha: hoyAR(), hora: "08:00" }])),
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aplicarATodas = () => {
    setPorFila(Object.fromEntries(rows.map((r) => [r.id, { fecha: fechaDefault, hora: horaDefault }])));
  };

  const confirmar = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    const items = rows.map((r) => {
      const v = porFila[r.id] ?? { fecha: fechaDefault, hora: horaDefault };
      return { operacion_impo_id: r.id, fecha: `${v.fecha}T${v.hora}:00-03:00` };
    });
    const { data, error: err } = await getSupabase().rpc("crm_confirmar_retiro_terminal", { p_items: items });
    setSending(false);
    if (err) {
      setError(err.message);
      return;
    }
    const resp = data as { confirmadas?: number; rechazadas?: number } | null;
    const confirmadas = resp?.confirmadas ?? 0;
    const total = rows.length;
    if (confirmadas === total) {
      toast({
        type: "exito",
        title: `${confirmadas} retiro${confirmadas === 1 ? "" : "s"} confirmado${confirmadas === 1 ? "" : "s"}`,
        detail: "Pasaron a en tránsito a planta.",
      });
    } else {
      toast({
        type: "info",
        title: `Se confirmaron ${confirmadas} de ${total}`,
        detail: "El resto no se pudo confirmar (fecha anterior al arribo, u otro usuario ya actuó).",
      });
    }
    onDone();
  };

  return (
    <Modal
      open
      onClose={sending ? () => {} : onClose}
      title="Confirmar retiro de terminal"
      width={580}
      closeOnBackdrop={!sending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button variant="primary" icon="ti-circle-check" loading={sending} onClick={() => void confirmar()}>
            Confirmar retiro
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          Los retiros pueden ser escalonados (un mismo camión, varios viajes el mismo día): ajustá la fecha/hora fila
          por fila si no coinciden.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 10 }}>
          <Field label="fecha por defecto" htmlFor="retiro-fecha-default">
            <DateField id="retiro-fecha-default" value={fechaDefault} onChange={(e) => setFechaDefault(e.target.value)} />
          </Field>
          <Field label="hora por defecto" htmlFor="retiro-hora-default">
            <TimeField id="retiro-hora-default" value={horaDefault} onChange={(e) => setHoraDefault(e.target.value)} />
          </Field>
          <Button variant="ghost" icon="ti-copy" onClick={aplicarATodas} style={{ marginBottom: 1 }}>
            Aplicar a todas las filas
          </Button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
          {rows.map((r) => {
            const v = porFila[r.id] ?? { fecha: fechaDefault, hora: horaDefault };
            return (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: "var(--radius-input)",
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                <div style={{ flex: 1, minWidth: 140 }}>
                  {r.contenedor && <ContainerNumber value={r.contenedor.numero_contenedor} />}
                  <div style={{ fontSize: 11, color: "var(--color-text-faint)" }}>orden {r.orden?.numero_orden ?? "—"}</div>
                </div>
                <DateField
                  aria-label={`fecha de retiro ${r.contenedor?.numero_contenedor ?? r.id}`}
                  value={v.fecha}
                  onChange={(e) => setPorFila((p) => ({ ...p, [r.id]: { ...v, fecha: e.target.value } }))}
                  style={{ width: 140 }}
                />
                <TimeField
                  aria-label={`hora de retiro ${r.contenedor?.numero_contenedor ?? r.id}`}
                  value={v.hora}
                  onChange={(e) => setPorFila((p) => ({ ...p, [r.id]: { ...v, hora: e.target.value } }))}
                  style={{ width: 100 }}
                />
              </div>
            );
          })}
        </div>
        {error && <FormAlert>{error}</FormAlert>}
      </div>
    </Modal>
  );
}

/* ═══ Grupos 2-4 — acción en lote con UNA fecha compartida (ingreso planta / salida
   devolución / confirmar devolución) ═══ */

function GrupoAccionSimple({
  selected,
  onSelectedChange,
  onDone,
  actionLabel,
  actionIcon,
  fechaLabel,
  hintText,
  rpcName,
  resultKey,
}: {
  selected: Set<string>;
  onSelectedChange: (s: Set<string>) => void;
  onDone: () => void;
  actionLabel: string;
  actionIcon: string;
  fechaLabel: string;
  hintText?: string;
  rpcName: string;
  resultKey: string;
}) {
  const toast = useToast();
  const [fecha, setFecha] = useState(hoyAR());
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fechaError = attempted && fecha === "" ? "indicá la fecha" : null;

  const confirmar = async () => {
    if (sending) return;
    setAttempted(true);
    setError(null);
    const ids = [...selected];
    if (ids.length === 0 || fecha === "") return;
    setSending(true);
    const { data, error: err } = await getSupabase().rpc(rpcName, {
      p_operacion_impo_ids: ids,
      p_fecha: `${fecha}T00:00:00-03:00`,
    });
    setSending(false);
    if (err) {
      setError(err.message);
      return;
    }
    const resp = (data as Record<string, number | undefined> | null) ?? {};
    const n = resp[resultKey] ?? 0;
    if (n === ids.length) {
      toast({ type: "exito", title: `${n} operación${n === 1 ? "" : "es"} actualizada${n === 1 ? "" : "s"}`, detail: hintText });
    } else {
      toast({
        type: "info",
        title: `Se actualizaron ${n} de ${ids.length}`,
        detail: "El resto ya no estaba en ese estado (otro usuario o un refresco previo).",
      });
    }
    onSelectedChange(new Set());
    setAttempted(false);
    onDone();
  };

  if (selected.size === 0) return null;

  return (
    <div style={ACTION_BAR}>
      <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)", alignSelf: "center" }}>
        {actionLabel} de <strong className="mono">{selected.size}</strong> contenedor{selected.size === 1 ? "" : "es"}:
      </span>
      <Field label={fechaLabel} htmlFor={`grupo-fecha-${rpcName}`} error={fechaError}>
        <DateField id={`grupo-fecha-${rpcName}`} value={fecha} error={fechaError} onChange={(e) => setFecha(e.target.value)} />
      </Field>
      <Button variant="primary" icon={actionIcon} loading={sending} onClick={() => void confirmar()} style={{ marginBottom: 1 }}>
        {actionLabel}
      </Button>
      {error && (
        <div style={{ width: "100%" }}>
          <FormAlert>{error}</FormAlert>
        </div>
      )}
      {hintText && <span style={{ fontSize: 11.5, color: "var(--color-text-faint)", width: "100%" }}>{hintText}</span>}
    </div>
  );
}

/* ═══════════════ tabla de un grupo (columnas comunes + acciones) ═══════════════ */

function TablaGrupo({
  rows,
  loading,
  selected,
  onSelectedChange,
  fechaHeader,
  fechaValue,
  canAnular,
  onAnular,
  emptyIcon,
  emptyTitle,
  emptyBody,
}: {
  rows: PendienteImpoRow[];
  loading: boolean;
  selected: Set<string>;
  onSelectedChange: (s: Set<string>) => void;
  fechaHeader: string;
  fechaValue: (r: PendienteImpoRow) => string | null;
  canAnular: boolean;
  onAnular: (target: { id: string; label: string }) => void;
  emptyIcon: string;
  emptyTitle: string;
  emptyBody: React.ReactNode;
}) {
  const cols: Column<PendienteImpoRow>[] = [
    {
      key: "contenedor",
      header: "contenedor",
      render: (r) => (r.contenedor ? <ContainerNumber value={r.contenedor.numero_contenedor} /> : "—"),
      sortValue: (r) => r.contenedor?.numero_contenedor ?? null,
    },
    {
      key: "tipo",
      header: "tipo",
      render: (r) => r.contenedor?.tipo ?? "—",
      sortValue: (r) => r.contenedor?.tipo ?? null,
      hideOnMobile: true,
    },
    {
      key: "orden",
      header: "orden",
      render: (r) => <span className="mono">{r.orden?.numero_orden ?? "—"}</span>,
      sortValue: (r) => r.orden?.numero_orden ?? null,
    },
    {
      key: "naviera",
      header: "naviera",
      render: (r) => r.orden?.naviera?.nombre ?? "—",
      sortValue: (r) => r.orden?.naviera?.nombre ?? null,
      hideOnMobile: true,
    },
    {
      key: "planta",
      header: "planta destino",
      render: (r) => r.orden?.planta_destino?.nombre ?? "—",
      sortValue: (r) => r.orden?.planta_destino?.nombre ?? null,
      hideOnMobile: true,
    },
    {
      key: "fecha",
      header: fechaHeader,
      numeric: true,
      render: (r) => fmtFecha(fechaValue(r)),
      sortValue: (r) => fechaValue(r),
    },
    ...(canAnular
      ? ([
          {
            key: "acciones",
            header: "",
            align: "right" as const,
            width: "1%",
            render: (r: PendienteImpoRow) => (
              <Button
                variant="ghost"
                icon="ti-ban"
                onClick={() => onAnular({ id: r.id, label: etiquetaFila(r) })}
                style={{ minHeight: 0, padding: "4px 8px", fontSize: 12 }}
                aria-label={`anular ${etiquetaFila(r)}`}
              >
                Anular
              </Button>
            ),
          },
        ] satisfies Column<PendienteImpoRow>[])
      : []),
  ];

  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={(r) => r.id}
      loading={loading}
      skeletonRows={3}
      maxHeight={360}
      defaultSort={{ key: "fecha", dir: "asc" }}
      selection={{ ids: selected, onChange: onSelectedChange }}
      emptyState={
        <EmptyState icon={emptyIcon} title={emptyTitle}>
          {emptyBody}
        </EmptyState>
      }
    />
  );
}

/* ═══════════════════════════════ página ═══════════════════════════════ */

export default function ImportacionPage() {
  const toast = useToast();
  const { perfil } = useSession();
  const canAnular = perfil?.rol === "supervisor" || perfil?.rol === "administrador";

  /* ---------- maestros del formulario (navieras + plantas) ---------- */
  const [maestros, setMaestros] = useState<{ navieras: Naviera[]; plantas: Planta[] } | null>(null);
  const [maestrosError, setMaestrosError] = useState<string | null>(null);

  const loadMaestros = useCallback(async () => {
    const supabase = getSupabase();
    const [nv, pl] = await Promise.all([
      supabase.from("navieras").select("id, nombre").eq("activa", true).order("nombre"),
      supabase.from("plantas").select("id, nombre, codigo").eq("activa", true).order("nombre"),
    ]);
    if (nv.error || pl.error) {
      setMaestros(null);
      setMaestrosError((nv.error ?? pl.error)!.message);
      return;
    }
    setMaestrosError(null);
    setMaestros({ navieras: nv.data as Naviera[], plantas: pl.data as Planta[] });
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

  /* ---------- Fase 2 — pendientes (los 4 estados abiertos, un solo fetch) ---------- */
  const [pendientes, setPendientes] = useState<PendienteImpoRow[] | null>(null);
  const [pendientesError, setPendientesError] = useState<string | null>(null);

  const [selEnTerminal, setSelEnTerminal] = useState<Set<string>>(new Set());
  const [selEnTransitoPlanta, setSelEnTransitoPlanta] = useState<Set<string>>(new Set());
  const [selEnPlanta, setSelEnPlanta] = useState<Set<string>>(new Set());
  const [selEnTransitoDevolucion, setSelEnTransitoDevolucion] = useState<Set<string>>(new Set());

  const [modalRetiro, setModalRetiro] = useState<PendienteImpoRow[] | null>(null);
  const [anularTarget, setAnularTarget] = useState<{ id: string; label: string } | null>(null);

  const loadPendientes = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("operaciones_impo")
      .select(
        "id, estado, fecha_retiro_terminal, fecha_ingreso_planta, fecha_devolucion, orden:ordenes_impo(numero_orden, fecha_arribo_terminal, naviera:navieras(nombre), planta_destino:plantas(nombre)), contenedor:contenedores(numero_contenedor, tipo)",
      )
      .in("estado", ["en_terminal", "en_transito_a_planta", "en_planta", "en_transito_devolucion"])
      .order("created_at", { ascending: true });
    if (error) {
      setPendientes(null);
      setPendientesError(error.message);
      return;
    }
    const rows = data as unknown as PendienteImpoRow[];
    setPendientesError(null);
    setPendientes(rows);
    // podar de cada selección los ids que ya no están (tras un refetch) — detrás del
    // await, para no violar set-state-in-effect.
    const valid = new Set(rows.map((r) => r.id));
    const podar = (prev: Set<string>) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    };
    setSelEnTerminal(podar);
    setSelEnTransitoPlanta(podar);
    setSelEnPlanta(podar);
    setSelEnTransitoDevolucion(podar);
  }, []);

  useEffect(() => {
    void (async () => {
      await loadPendientes();
    })();
  }, [loadPendientes]);

  // refetch al recuperar foco (mismo criterio que /ingreso y /egreso)
  useEffect(() => {
    const onFocus = () => void loadPendientes();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadPendientes]);

  const pendientesLoading = pendientes === null && !pendientesError;

  const onCreated = useCallback(() => {
    void loadPendientes();
  }, [loadPendientes]);

  const onAnularDone = () => {
    setAnularTarget(null);
    void loadPendientes();
    toast({ type: "info", title: "Lista actualizada" });
  };

  const enTerminal = useMemo(() => (pendientes ?? []).filter((r) => r.estado === "en_terminal"), [pendientes]);
  const enTransitoPlanta = useMemo(
    () => (pendientes ?? []).filter((r) => r.estado === "en_transito_a_planta"),
    [pendientes],
  );
  const enPlanta = useMemo(() => (pendientes ?? []).filter((r) => r.estado === "en_planta"), [pendientes]);
  const enTransitoDevolucion = useMemo(
    () => (pendientes ?? []).filter((r) => r.estado === "en_transito_devolucion"),
    [pendientes],
  );

  const filasRetiroSeleccionadas = enTerminal.filter((r) => selEnTerminal.has(r.id));

  const totalPendientes = pendientes?.length ?? null;

  return (
    <>
      <PageHeader
        title="Importación"
        counters={
          totalPendientes != null ? (
            <Badge tone={totalPendientes > 0 ? "amarillo" : "neutro"} mono icon="ti-ship">
              {totalPendientes} pendiente{totalPendientes === 1 ? "" : "s"} en el ciclo
            </Badge>
          ) : undefined
        }
        action={
          <Button variant="ghost" icon="ti-refresh" onClick={() => void loadPendientes()} disabled={pendientesLoading}>
            Actualizar
          </Button>
        }
      />

      <SectionTitle title="Nueva orden de importación" count={null} />
      {perfil ? (
        <OrdenImpoForm
          perfil={perfil}
          navieras={maestros?.navieras ?? []}
          plantas={maestros?.plantas ?? []}
          maestrosLoading={maestrosLoading}
          maestrosError={maestrosError}
          onRetryMaestros={retryMaestros}
          onCreated={onCreated}
        />
      ) : (
        <DataTable columns={[]} rows={[]} rowKey={() => ""} loading skeletonRows={3} />
      )}

      <SectionTitle title="Pendientes" count={totalPendientes} />

      {pendientesError ? (
        <ErrorState
          title="No se pudieron cargar los pendientes"
          detail={pendientesError}
          onRetry={() => void loadPendientes()}
        />
      ) : (
        <>
          <CollapsibleSection title="En terminal" icon="ti-anchor" count={pendientesLoading ? null : enTerminal.length}>
            {selEnTerminal.size > 0 && (
              <div style={ACTION_BAR}>
                <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)", alignSelf: "center" }}>
                  <strong className="mono">{selEnTerminal.size}</strong> contenedor{selEnTerminal.size === 1 ? "" : "es"}{" "}
                  seleccionado{selEnTerminal.size === 1 ? "" : "s"} — el retiro puede ser escalonado (fecha por fila).
                </span>
                <Button
                  variant="primary"
                  icon="ti-truck-loading"
                  onClick={() => setModalRetiro(filasRetiroSeleccionadas)}
                  style={{ marginBottom: 1 }}
                >
                  Confirmar retiro
                </Button>
              </div>
            )}
            <TablaGrupo
              rows={enTerminal}
              loading={pendientesLoading}
              selected={selEnTerminal}
              onSelectedChange={setSelEnTerminal}
              fechaHeader="fecha arribo"
              fechaValue={(r) => r.orden?.fecha_arribo_terminal ?? null}
              canAnular={canAnular}
              onAnular={setAnularTarget}
              emptyIcon="ti-anchor"
              emptyTitle="Sin contenedores en terminal"
              emptyBody={
                <>
                  Acá aparece cada contenedor de una orden nueva, recién arribado, hasta que confirmes su retiro de
                  terminal. Cargá una orden arriba para que aparezcan acá.
                </>
              }
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="En tránsito a planta"
            icon="ti-truck"
            count={pendientesLoading ? null : enTransitoPlanta.length}
          >
            <GrupoAccionSimple
              selected={selEnTransitoPlanta}
              onSelectedChange={setSelEnTransitoPlanta}
              onDone={() => void loadPendientes()}
              actionLabel="Confirmar ingreso a planta"
              actionIcon="ti-circle-check"
              fechaLabel="fecha de ingreso"
              hintText="Pasan a en planta."
              rpcName="crm_confirmar_ingreso_planta_impo"
              resultKey="confirmadas"
            />
            <TablaGrupo
              rows={enTransitoPlanta}
              loading={pendientesLoading}
              selected={selEnTransitoPlanta}
              onSelectedChange={setSelEnTransitoPlanta}
              fechaHeader="fecha retiro"
              fechaValue={(r) => r.fecha_retiro_terminal}
              canAnular={canAnular}
              onAnular={setAnularTarget}
              emptyIcon="ti-truck"
              emptyTitle="Sin contenedores en tránsito a planta"
              emptyBody={
                <>
                  Acá aparece cada contenedor con retiro de terminal confirmado (grupo de arriba), hasta que confirmes
                  su ingreso a planta.
                </>
              }
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="En planta"
            icon="ti-building-warehouse"
            count={pendientesLoading ? null : enPlanta.length}
          >
            <GrupoAccionSimple
              selected={selEnPlanta}
              onSelectedChange={setSelEnPlanta}
              onDone={() => void loadPendientes()}
              actionLabel="Registrar salida a devolución"
              actionIcon="ti-logout-2"
              fechaLabel="fecha de salida"
              hintText="Pasan a en tránsito a devolución."
              rpcName="crm_registrar_salida_devolucion_impo"
              resultKey="salidas"
            />
            <TablaGrupo
              rows={enPlanta}
              loading={pendientesLoading}
              selected={selEnPlanta}
              onSelectedChange={setSelEnPlanta}
              fechaHeader="fecha ingreso planta"
              fechaValue={(r) => r.fecha_ingreso_planta}
              canAnular={canAnular}
              onAnular={setAnularTarget}
              emptyIcon="ti-building-warehouse"
              emptyTitle="Sin contenedores en planta"
              emptyBody={
                <>
                  Acá aparece cada contenedor con ingreso a planta confirmado (grupo de arriba), hasta que registrés su
                  salida hacia la devolución del vacío.
                </>
              }
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="En tránsito a devolución"
            icon="ti-arrow-back-up"
            count={pendientesLoading ? null : enTransitoDevolucion.length}
          >
            <GrupoAccionSimple
              selected={selEnTransitoDevolucion}
              onSelectedChange={setSelEnTransitoDevolucion}
              onDone={() => void loadPendientes()}
              actionLabel="Confirmar devolución"
              actionIcon="ti-flag-check"
              fechaLabel="fecha de devolución"
              hintText="Corta el reloj de demurrage/detention — la operación se cierra."
              rpcName="crm_confirmar_devolucion_impo"
              resultKey="cerradas"
            />
            <TablaGrupo
              rows={enTransitoDevolucion}
              loading={pendientesLoading}
              selected={selEnTransitoDevolucion}
              onSelectedChange={setSelEnTransitoDevolucion}
              fechaHeader="fecha ingreso planta"
              fechaValue={(r) => r.fecha_ingreso_planta}
              canAnular={canAnular}
              onAnular={setAnularTarget}
              emptyIcon="ti-flag-check"
              emptyTitle="Sin contenedores en tránsito a devolución"
              emptyBody={
                <>
                  Acá aparece cada contenedor con salida hacia devolución registrada (grupo de arriba), hasta que
                  confirmes la devolución — eso <strong>corta el reloj</strong> de demurrage/detention y cierra la
                  operación.
                </>
              }
            />
          </CollapsibleSection>
        </>
      )}

      {modalRetiro && modalRetiro.length > 0 && (
        <ConfirmarRetiroModal
          rows={modalRetiro}
          onClose={() => setModalRetiro(null)}
          onDone={() => {
            setModalRetiro(null);
            setSelEnTerminal(new Set());
            void loadPendientes();
          }}
        />
      )}

      {anularTarget && <AnularImpoModal target={anularTarget} onClose={() => setAnularTarget(null)} onDone={onAnularDone} />}
    </>
  );
}
