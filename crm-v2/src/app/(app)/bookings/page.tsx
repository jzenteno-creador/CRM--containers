"use client";

// Bookings expo (M5 B3): tablero de saldo de bookings de retiro sobre
// crm.vista_bookings_saldo — LA VIEW YA CALCULA TODO (contenedores en planta,
// totales, días a ETD, semáforo con umbral configurable). Acá no se recalcula
// nada: solo formateo, filtro de presentación y las dos acciones de auditoría
// (rolear / reasignar), que son RPCs — nunca UPDATE directo (regla dura del repo).
//
// Contexto de negocio (Omar, reunión 2026-07-13): los retiros de expo se cargan
// contra un booking ficticio de la naviera con ETD; ocupa lugar en un buque. Si se
// acerca el ETD y quedan contenedores en planta, se pide roleo (mismo booking,
// nuevo ETD/buque) o se reasignan los contenedores a otro booking. Hoy esto se
// controla a mano cada viernes; esta pantalla lo reemplaza con saldo + semáforo.
//
// Patrón de página del repo (espejo de /alertas): useSearchParams + Suspense para
// el deep-link ?semaforo=, load() con anti-carrera, refetch al recuperar foco,
// 4 estados en la tabla, filtro de presentación client-side.

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, type BadgeTone } from "@/components/fd/badge";
import { NuevoBookingModal, type NavieraOption } from "@/components/fd/booking-modal";
import { Button } from "@/components/fd/button";
import { ComboboxCreatable } from "@/components/fd/combobox-creatable";
import { ContainerNumber } from "@/components/container-number";
import { DataTable, type Column } from "@/components/fd/data-table";
import { DateField, Field, Input, Select, Textarea } from "@/components/fd/fields";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { FormAlert } from "@/components/fd/form-alert";
import { Modal } from "@/components/fd/modal";
import { PageHeader } from "@/components/fd/page-header";
import { StatusBadge, type EstadoSemaforo } from "@/components/fd/status-badge";
import { useToast } from "@/components/fd/toast";
import { fmtFechaDia } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";

// Contrato de crm.vista_bookings_saldo (migración 028): números y semáforo YA
// calculados en DB — el front solo formatea y filtra lo ya traído.
export type BookingSaldoRow = {
  booking_id: string;
  numero: string;
  naviera: string;
  etd: string;
  fecha_corte: string | null;
  buque: string | null;
  contenedores_en_planta: number;
  contenedores_totales: number;
  dias_a_etd: number;
  estado_semaforo: EstadoSemaforo;
};

type SemaforoFilter = "todos" | EstadoSemaforo;

const SEMAFORO_LABEL: Record<EstadoSemaforo, string> = {
  rojo: "vencido",
  amarillo: "por vencer",
  verde: "en plazo",
  neutro: "sin pendientes",
};
const SEMAFORO_RANK: Record<EstadoSemaforo, number> = { rojo: 0, amarillo: 1, verde: 2, neutro: 3 };
const SEMAFOROS: EstadoSemaforo[] = ["rojo", "amarillo", "verde", "neutro"];
const SEMAFORO_TONE: Record<EstadoSemaforo, BadgeTone> = { rojo: "rojo", amarillo: "amarillo", verde: "verde", neutro: "neutro" };
const DIAS_COLOR: Record<EstadoSemaforo, string> = {
  rojo: "var(--color-status-red)",
  amarillo: "var(--color-status-amber)",
  verde: "var(--color-status-green)",
  neutro: "var(--color-text-muted)",
};

const FETCH_CAP = 500;
const ACTION_BTN: React.CSSProperties = { minHeight: 0, padding: "4px 10px", fontSize: 12 };

const SEMAFORO_QUERY_VALUES: SemaforoFilter[] = ["rojo", "amarillo", "verde", "neutro"];
function parseSemaforoParam(v: string | null): SemaforoFilter | null {
  return v !== null && (SEMAFORO_QUERY_VALUES as string[]).includes(v) ? (v as SemaforoFilter) : null;
}

function DiasAEtd({ row }: { row: BookingSaldoRow }) {
  const display = row.dias_a_etd < 0 ? `−${Math.abs(row.dias_a_etd)}` : String(row.dias_a_etd);
  return <span style={{ color: DIAS_COLOR[row.estado_semaforo], fontWeight: 600 }}>{display}</span>;
}

/** Chip de filtro semáforo — un <Badge> clickeable con anillo cyan cuando está activo. */
function SemaforoChip({
  tone,
  active,
  count,
  label,
  onClick,
}: {
  tone: BadgeTone;
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        minHeight: 0,
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        borderRadius: "var(--radius-chip)",
        boxShadow: active ? "0 0 0 2px var(--color-accent-500)" : "none",
        opacity: active ? 1 : 0.72,
        transition: "opacity 150ms var(--ease-out-expo), box-shadow 150ms var(--ease-out-expo)",
      }}
    >
      <Badge tone={tone} mono>
        {label} · {count}
      </Badge>
    </button>
  );
}

/* ═══════════════════════ Rolear (crm_rolear_booking) ═══════════════════════ */

function RolearModal({ row, onClose, onDone }: { row: BookingSaldoRow; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [nuevoEtd, setNuevoEtd] = useState("");
  const [nuevoBuque, setNuevoBuque] = useState(row.buque ?? "");
  const [motivo, setMotivo] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const etdError = attempted && nuevoEtd === "" ? "el nuevo ETD es obligatorio" : null;
  const valid = nuevoEtd !== "";

  const submit = async () => {
    setAttempted(true);
    setSubmitError(null);
    if (!valid || sending) return;
    setSending(true);
    const { data, error } = await getSupabase().rpc("crm_rolear_booking", {
      p_booking_id: row.booking_id,
      p_nuevo_etd: nuevoEtd,
      p_nuevo_buque: nuevoBuque.trim() || null,
      p_motivo: motivo.trim() || null,
    });
    setSending(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    const anotadas = (data as { operaciones_anotadas?: number } | null)?.operaciones_anotadas ?? 0;
    toast({
      type: "exito",
      title: `Booking ${row.numero} roleado`,
      detail:
        anotadas > 0
          ? `${anotadas} operación${anotadas === 1 ? "" : "es"} abierta${anotadas === 1 ? "" : "s"} anotada${anotadas === 1 ? "" : "s"} con el nuevo ETD.`
          : "Sin operaciones abiertas para anotar.",
    });
    onDone();
  };

  return (
    <Modal open onClose={sending ? () => {} : onClose} title={`Rolear booking «${row.numero}»`} width={460} closeOnBackdrop={!sending}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12.5, color: "var(--color-text-secondary)" }}>
          <span>
            ETD actual: <strong className="mono">{fmtFechaDia(row.etd)}</strong>
          </span>
          {row.buque && (
            <span>
              Buque actual: <strong>{row.buque}</strong>
            </span>
          )}
        </div>
        <Field label="nuevo ETD" htmlFor="rolear-etd" error={etdError}>
          <DateField id="rolear-etd" value={nuevoEtd} error={etdError} onChange={(e) => setNuevoEtd(e.target.value)} />
        </Field>
        <Field label="nuevo buque" htmlFor="rolear-buque" hint="opcional — si lo dejás vacío, se mantiene el actual">
          <Input id="rolear-buque" value={nuevoBuque} onChange={(e) => setNuevoBuque(e.target.value)} />
        </Field>
        <Field label="motivo" htmlFor="rolear-motivo" hint="opcional — queda en el historial de cada operación anotada">
          <Textarea id="rolear-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Field>
        {submitError && <FormAlert>{submitError}</FormAlert>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button variant="primary" icon="ti-calendar-time" loading={sending} disabled={!valid} onClick={() => void submit()}>
            Rolear
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ═══════════════ Reasignar (crm_reasignar_contenedores_booking) ═══════════════ */

type ContenedorEnPlanta = { id: string; numero: string };

const MOTIVO_OPCIONES: { value: "roleo_naviera" | "correccion" | "otro"; label: string }[] = [
  { value: "roleo_naviera", label: "Roleo de naviera" },
  { value: "correccion", label: "Corrección" },
  { value: "otro", label: "Otro" },
];

const RECHAZO_LABELS: Record<string, string> = {
  operacion_inexistente: "ya no existe",
  operacion_cerrada: "el ciclo ya está cerrado",
  ya_asignado_al_destino: "ya estaba en ese booking",
  no_disponible: "ya no estaba disponible",
};

function ReasignarModal({
  row,
  bookingOptions,
  navieras,
  onClose,
  onDone,
  onRefreshBookings,
}: {
  row: BookingSaldoRow;
  /** Otros bookings de retiro activos (misma vista de la página) — destino posible. */
  bookingOptions: BookingSaldoRow[];
  navieras: NavieraOption[];
  onClose: () => void;
  onDone: () => void;
  onRefreshBookings: () => Promise<void>;
}) {
  const toast = useToast();
  const [containers, setContainers] = useState<ContenedorEnPlanta[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [destinoId, setDestinoId] = useState("");
  const [modalBookingTexto, setModalBookingTexto] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<"" | "roleo_naviera" | "correccion" | "otro">("");
  const [detalle, setDetalle] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("operaciones")
      .select("id, contenedor:contenedores(numero_contenedor)")
      .eq("booking_retiro_id", row.booking_id)
      .eq("estado", "en_planta");
    if (error) {
      setContainers(null);
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    setContainers(
      (data as unknown as { id: string; contenedor: { numero_contenedor: string } | null }[]).map((r) => ({
        id: r.id,
        numero: r.contenedor?.numero_contenedor ?? "—",
      })),
    );
  }, [row.booking_id]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const loading = containers === null && !loadError;
  const containerNumeroById = useMemo(() => new Map((containers ?? []).map((c) => [c.id, c.numero])), [containers]);
  const destinoOpciones = useMemo(
    () => bookingOptions.filter((b) => b.booking_id !== row.booking_id),
    [bookingOptions, row.booking_id],
  );

  const seleccionError = attempted && selected.size === 0 ? "seleccioná al menos un contenedor" : null;
  const destinoError = attempted && destinoId === "" ? "elegí el booking destino" : null;
  const motivoError = attempted && motivo === "" ? "elegí un motivo" : null;
  const valid = selected.size > 0 && destinoId !== "" && motivo !== "";

  const cols: Column<ContenedorEnPlanta>[] = [
    { key: "numero", header: "contenedor", render: (r) => <ContainerNumber value={r.numero} />, sortValue: (r) => r.numero },
  ];

  const submit = async () => {
    setAttempted(true);
    setSubmitError(null);
    if (!valid || sending) return;
    setSending(true);
    const { data, error } = await getSupabase().rpc("crm_reasignar_contenedores_booking", {
      p_operacion_ids: [...selected],
      p_booking_destino_id: destinoId,
      p_motivo: motivo,
      p_detalle: detalle.trim() || null,
    });
    setSending(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    const resp = data as { reasignadas?: number; rechazadas?: { id: string; motivo: string }[] } | null;
    const reasignadas = resp?.reasignadas ?? 0;
    const rechazadas = resp?.rechazadas ?? [];
    const destinoNumero = destinoOpciones.find((b) => b.booking_id === destinoId)?.numero ?? "destino";
    if (rechazadas.length === 0) {
      toast({
        type: "exito",
        title: `${reasignadas} contenedor${reasignadas === 1 ? "" : "es"} reasignado${reasignadas === 1 ? "" : "s"}`,
        detail: `Ahora en el booking ${destinoNumero}.`,
      });
    } else {
      const detalleTxt = rechazadas
        .slice(0, 5)
        .map((r) => `${containerNumeroById.get(r.id) ?? r.id.slice(0, 8)}: ${RECHAZO_LABELS[r.motivo] ?? r.motivo}`)
        .join(" · ");
      toast({
        type: "info",
        title: `Se reasignaron ${reasignadas} de ${reasignadas + rechazadas.length}`,
        detail: rechazadas.length > 5 ? `${detalleTxt} · y ${rechazadas.length - 5} más` : detalleTxt,
      });
    }
    onDone();
  };

  return (
    <>
      <Modal
        open
        onClose={sending ? () => {} : onClose}
        title={`Reasignar contenedores de «${row.numero}»`}
        width={560}
        closeOnBackdrop={!sending}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <DataTable
            columns={cols}
            rows={containers ?? []}
            rowKey={(r) => r.id}
            loading={loading}
            skeletonRows={3}
            maxHeight={220}
            selection={{ ids: selected, onChange: setSelected }}
            errorState={
              loadError ? (
                <ErrorState title="No se pudieron cargar los contenedores" detail={loadError} onRetry={() => void load()} />
              ) : undefined
            }
            emptyState={
              <EmptyState icon="ti-building-warehouse" title="Sin contenedores en planta">
                Este booking no tiene contenedores en planta para reasignar en este momento.
              </EmptyState>
            }
          />
          {seleccionError && (
            <span role="alert" style={{ fontSize: 11, color: "var(--color-status-red)" }}>
              {seleccionError}
            </span>
          )}

          <Field label="booking destino" htmlFor="reasignar-destino" error={destinoError}>
            <ComboboxCreatable
              id="reasignar-destino"
              options={destinoOpciones.map((b) => ({ id: b.booking_id, label: `${b.numero} · ETD ${fmtFechaDia(b.etd)}` }))}
              value={destinoId}
              onChange={setDestinoId}
              onCreate={(t) => setModalBookingTexto(t)}
              error={destinoError}
              placeholder="buscá o creá el booking destino…"
              emptyMessage="sin otros bookings activos — tipeá para crear uno nuevo"
            />
          </Field>

          <Field label="motivo" htmlFor="reasignar-motivo" error={motivoError}>
            <Select id="reasignar-motivo" value={motivo} error={motivoError} onChange={(e) => setMotivo(e.target.value as typeof motivo)}>
              <option value="">— elegí un motivo —</option>
              {MOTIVO_OPCIONES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="detalle" htmlFor="reasignar-detalle" hint="opcional">
            <Textarea id="reasignar-detalle" rows={2} value={detalle} onChange={(e) => setDetalle(e.target.value)} />
          </Field>

          {submitError && <FormAlert>{submitError}</FormAlert>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <Button variant="ghost" onClick={onClose} disabled={sending}>
              Cancelar
            </Button>
            <Button variant="primary" icon="ti-transfer" loading={sending} disabled={!valid} onClick={() => void submit()}>
              Reasignar{selected.size > 0 ? ` (${selected.size})` : ""}
            </Button>
          </div>
        </div>
      </Modal>

      {modalBookingTexto !== null && (
        <NuevoBookingModal
          texto={modalBookingTexto}
          tipo="retiro"
          navieras={navieras}
          onClose={() => setModalBookingTexto(null)}
          onCreado={async (id) => {
            const textoCreado = modalBookingTexto;
            await onRefreshBookings();
            setDestinoId(id);
            setModalBookingTexto(null);
            toast({ type: "exito", title: "Booking creado", detail: `«${textoCreado}» ya está disponible.` });
          }}
        />
      )}
    </>
  );
}

/* ══════════════════════════════ página ══════════════════════════════ */

function BookingsPageContent() {
  const searchParams = useSearchParams();

  const semaforoParam = parseSemaforoParam(searchParams.get("semaforo"));
  const [filtroSemaforo, setFiltroSemaforo] = useState<SemaforoFilter>(semaforoParam ?? "todos");
  const [lastParam, setLastParam] = useState(semaforoParam);
  if (semaforoParam !== lastParam) {
    setLastParam(semaforoParam);
    if (semaforoParam) setFiltroSemaforo(semaforoParam);
  }

  const [navieraFiltro, setNavieraFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const [rows, setRows] = useState<BookingSaldoRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [navieras, setNavieras] = useState<NavieraOption[]>([]);
  const reqIdRef = useRef(0);

  const [rolearTarget, setRolearTarget] = useState<BookingSaldoRow | null>(null);
  const [reasignarTarget, setReasignarTarget] = useState<BookingSaldoRow | null>(null);

  const load = useCallback(async () => {
    const rid = ++reqIdRef.current;
    const { data, error } = await getSupabase()
      .from("vista_bookings_saldo")
      .select("*")
      .order("dias_a_etd", { ascending: true })
      .limit(FETCH_CAP);
    if (rid !== reqIdRef.current) return;
    if (error) {
      setRows(null);
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    setRows(data as unknown as BookingSaldoRow[]);
  }, []);

  const loadNavieras = useCallback(async () => {
    const { data, error } = await getSupabase().from("navieras").select("id, nombre").eq("activa", true).order("nombre");
    setNavieras(error ? [] : ((data as NavieraOption[]) ?? []));
  }, []);

  useEffect(() => {
    void (async () => {
      await Promise.all([load(), loadNavieras()]);
    })();
  }, [load, loadNavieras]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const loading = rows === null && !loadError;

  const counts: Record<EstadoSemaforo, number> = { rojo: 0, amarillo: 0, verde: 0, neutro: 0 };
  for (const r of rows ?? []) counts[r.estado_semaforo] += 1;

  const navierasEnLista = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows ?? []) set.add(r.naviera);
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const bySemaforo = filtroSemaforo === "todos" ? (rows ?? []) : (rows ?? []).filter((r) => r.estado_semaforo === filtroSemaforo);
  const byNaviera = navieraFiltro === "" ? bySemaforo : bySemaforo.filter((r) => r.naviera === navieraFiltro);
  const q = busqueda.trim().toLowerCase();
  const visibles = q === "" ? byNaviera : byNaviera.filter((r) => r.numero.toLowerCase().includes(q));

  const filtroActivo = filtroSemaforo !== "todos" || navieraFiltro !== "" || q !== "";

  const cols: Column<BookingSaldoRow>[] = [
    {
      key: "semaforo",
      header: "semáforo",
      width: "130px",
      render: (r) => <StatusBadge estado={r.estado_semaforo}>{SEMAFORO_LABEL[r.estado_semaforo]}</StatusBadge>,
      sortValue: (r) => SEMAFORO_RANK[r.estado_semaforo],
    },
    {
      key: "numero",
      header: "booking",
      render: (r) => (
        <span className="mono" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
          {r.numero}
        </span>
      ),
      sortValue: (r) => r.numero,
    },
    { key: "naviera", header: "naviera", render: (r) => r.naviera, sortValue: (r) => r.naviera },
    { key: "etd", header: "ETD", numeric: true, render: (r) => fmtFechaDia(r.etd), sortValue: (r) => r.etd },
    {
      key: "corte",
      header: "corte",
      numeric: true,
      render: (r) => fmtFechaDia(r.fecha_corte),
      sortValue: (r) => r.fecha_corte,
      hideOnMobile: true,
    },
    { key: "buque", header: "buque", render: (r) => r.buque ?? "—", sortValue: (r) => r.buque, hideOnMobile: true },
    {
      key: "en_planta",
      header: "en planta",
      numeric: true,
      render: (r) => r.contenedores_en_planta,
      sortValue: (r) => r.contenedores_en_planta,
      width: "90px",
    },
    {
      key: "totales",
      header: "totales",
      numeric: true,
      render: (r) => r.contenedores_totales,
      sortValue: (r) => r.contenedores_totales,
      hideOnMobile: true,
      width: "90px",
    },
    {
      key: "dias_etd",
      header: "días a ETD",
      numeric: true,
      render: (r) => <DiasAEtd row={r} />,
      sortValue: (r) => r.dias_a_etd,
      width: "100px",
    },
    {
      key: "acciones",
      header: "",
      align: "right",
      render: (r) => (
        <span style={{ display: "inline-flex", gap: 6 }}>
          <Button variant="ghost" icon="ti-calendar-time" style={ACTION_BTN} onClick={() => setRolearTarget(r)}>
            Rolear
          </Button>
          <Button
            variant="ghost"
            icon="ti-transfer"
            style={ACTION_BTN}
            disabled={r.contenedores_en_planta === 0}
            title={r.contenedores_en_planta === 0 ? "sin contenedores en planta" : undefined}
            onClick={() => setReasignarTarget(r)}
          >
            Reasignar
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Bookings"
        counters={
          rows != null ? (
            <>
              {SEMAFOROS.filter((s) => counts[s] > 0).map((s) => (
                <Badge key={s} tone={s} mono>
                  {counts[s]} {SEMAFORO_LABEL[s]}
                </Badge>
              ))}
              {rows.length >= FETCH_CAP && (
                <Badge tone="amarillo" icon="ti-alert-triangle">
                  se muestran los primeros {FETCH_CAP}
                </Badge>
              )}
            </>
          ) : undefined
        }
        action={
          <Button variant="ghost" icon="ti-refresh" onClick={() => void load()} disabled={loading}>
            Actualizar
          </Button>
        }
      />

      {/* chips de semáforo */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <SemaforoChip
          tone="accent"
          active={filtroSemaforo === "todos"}
          count={rows?.length ?? 0}
          label="Todos"
          onClick={() => setFiltroSemaforo("todos")}
        />
        {SEMAFOROS.map((s) => (
          <SemaforoChip
            key={s}
            tone={SEMAFORO_TONE[s]}
            active={filtroSemaforo === s}
            count={counts[s]}
            label={SEMAFORO_LABEL[s]}
            onClick={() => setFiltroSemaforo(s)}
          />
        ))}
      </div>

      {/* naviera + búsqueda */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginBottom: 12 }}>
        <Field label="naviera" htmlFor="bookings-naviera">
          <div style={{ minWidth: 220 }}>
            <ComboboxCreatable
              id="bookings-naviera"
              options={[{ id: "", label: "— todas —" }, ...navierasEnLista.map((n) => ({ id: n, label: n }))]}
              value={navieraFiltro}
              onChange={setNavieraFiltro}
              placeholder="— todas —"
            />
          </div>
        </Field>
        <Field label="buscar por número" htmlFor="bookings-busqueda">
          <Input
            id="bookings-busqueda"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="número de booking…"
            style={{ minWidth: 200 }}
          />
        </Field>
      </div>

      <DataTable
        columns={cols}
        rows={visibles}
        rowKey={(r) => r.booking_id}
        semaforo={(r) => r.estado_semaforo}
        loading={loading}
        skeletonRows={8}
        pageSize={15}
        maxHeight={560}
        defaultSort={{ key: "dias_etd", dir: "asc" }}
        errorState={
          loadError ? <ErrorState title="No se pudieron cargar los bookings" detail={loadError} onRetry={() => void load()} /> : undefined
        }
        emptyState={
          filtroActivo && (rows?.length ?? 0) > 0 ? (
            <EmptyState icon="ti-filter" title="Sin bookings con este filtro">
              Hay {rows!.length} booking{rows!.length === 1 ? "" : "s"} de retiro activos, pero ninguno coincide con el
              filtro actual. Probá cambiando el semáforo, la naviera o la búsqueda.
            </EmptyState>
          ) : (
            <EmptyState icon="ti-anchor" title="No hay bookings de retiro activos">
              Acá aparece cada booking de retiro con su saldo de contenedores en planta y el semáforo según su ETD. Los
              bookings se crean desde la solapa <strong>Ingreso</strong> al cargar una tanda (o acá mismo, al reasignar
              contenedores a un booking que todavía no existe). Si el ETD se acerca y quedan contenedores en planta,{" "}
              <strong>roleá</strong> el booking o <strong>reasigná</strong> esos contenedores a otro.
            </EmptyState>
          )
        }
      />

      {rolearTarget && (
        <RolearModal
          row={rolearTarget}
          onClose={() => setRolearTarget(null)}
          onDone={() => {
            setRolearTarget(null);
            void load();
          }}
        />
      )}

      {reasignarTarget && (
        <ReasignarModal
          row={reasignarTarget}
          bookingOptions={rows ?? []}
          navieras={navieras}
          onClose={() => setReasignarTarget(null)}
          onDone={() => {
            setReasignarTarget(null);
            void load();
          }}
          onRefreshBookings={load}
        />
      )}
    </>
  );
}

// useSearchParams exige un límite de Suspense en build estático (Next 16 — ver AGENTS.md);
// el fallback repite el esqueleto de la propia tabla, nunca un spinner de página.
export default function BookingsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Bookings" />
          <DataTable columns={[]} rows={[]} rowKey={() => ""} loading skeletonRows={8} maxHeight={560} />
        </>
      }
    >
      <BookingsPageContent />
    </Suspense>
  );
}
