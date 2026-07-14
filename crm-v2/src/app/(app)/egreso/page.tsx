"use client";

// Egreso (M4 §6.2). Dos fases en una pantalla:
//  · Fase 1 — Salida de planta: selección de contenedores en_planta → tipo_cierre
//    (+ asignación de embarque por lote si embarca) vía crm_registrar_salida_planta.
//    La salida NO corta el freetime.
//  · Fase 2 — Pendientes de terminal/devolución: operaciones en_transito_a_terminal
//    que se confirman en lote vía crm_confirmar_devolucion — esto SÍ corta el freetime
//    y cierra la operación.
// Patrón de página del repo (espejo de /ingreso): useState<null|[]>, load() callback,
// refetch al recuperar foco, toasts N-vs-ids, error RPC literal en FormAlert. Sin
// Realtime (v2 no lo usa). CERO cálculo de negocio en el front: solo se arman payloads
// y se muestra lo que la DB devuelve. RLS scopea por planta — acá no se re-filtra.
// Pegado inverso (§6.3.7): pegar números solo tilda filas del listado; no dispara
// requests. Los que no matchean se reportan en un aviso no bloqueante.

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { NuevoBookingModal, type NavieraOption } from "@/components/fd/booking-modal";
import { Button } from "@/components/fd/button";
import { ComboboxCreatable } from "@/components/fd/combobox-creatable";
import { ContainerNumber } from "@/components/container-number";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { DateField, Field, Input, Select, Textarea } from "@/components/fd/fields";
import { FieldHelp } from "@/components/fd/field-help";
import { FormAlert } from "@/components/fd/form-alert";
import { PageHeader } from "@/components/fd/page-header";
import { useToast } from "@/components/fd/toast";
import { fmtFecha, fmtFechaDia, hoyAR, TIPO_CIERRE_LABELS } from "@/lib/format";
import { parsearListaContenedores } from "@/lib/iso6346";
import { getSupabase } from "@/lib/supabase";

type ContenedorEmbed = {
  numero_contenedor: string;
  tipo: string;
  naviera: { nombre: string } | null;
};

type EnPlantaRow = {
  id: string;
  fecha_retiro: string;
  booking_retiro: string | null;
  retiro_de: string;
  contenedor: ContenedorEmbed | null;
  planta_actual: { nombre: string } | null;
};

type PendienteTerminalRow = {
  id: string;
  tipo_cierre: string;
  fecha_egreso_planta: string | null;
  booking_asignado: string | null;
  buque: string | null;
  destino: string | null;
  orden: string | null;
  contenedor: ContenedorEmbed | null;
  planta_actual: { nombre: string } | null;
};

type TipoCierre = "embarcado" | "devuelto_vacio";

// Booking de embarque (M5 B3) — cualquier tipo/naviera activos (a diferencia de
// Ingreso, acá NO se filtra por naviera: el lote de salida puede mezclar navieras).
type BookingOption = { id: string; numero: string; etd: string; naviera: { nombre: string } | null };

const TIPOS_CIERRE: { value: TipoCierre; label: string }[] = [
  { value: "embarcado", label: TIPO_CIERRE_LABELS.embarcado },
  { value: "devuelto_vacio", label: TIPO_CIERRE_LABELS.devuelto_vacio },
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

const ACTION_BAR: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 12,
  marginBottom: 10,
  background: "var(--color-surface-1)",
  border: "1px solid var(--color-accent-line)",
  borderRadius: "var(--radius-input)",
};

export default function EgresoPage() {
  const toast = useToast();

  /* ---------- Fase 1 — contenedores en planta ---------- */
  const [enPlanta, setEnPlanta] = useState<EnPlantaRow[] | null>(null);
  const [enPlantaError, setEnPlantaError] = useState<string | null>(null);
  const [selectedSalida, setSelectedSalida] = useState<Set<string>>(new Set());

  // pegado inverso (§6.3.7): solo selecciona filas del listado, nunca dispara requests
  const [pasteText, setPasteText] = useState("");
  const [pasteReport, setPasteReport] = useState<{ seleccionados: number; faltantes: string[] } | null>(null);

  const [tipoCierre, setTipoCierre] = useState<TipoCierre>("embarcado");
  const [fechaSalida, setFechaSalida] = useState(hoyAR());
  // asignación de embarque (§18.1) — jsonb plano, se aplica a todo el lote
  const [orden, setOrden] = useState("");
  const [shp, setShp] = useState("");
  const [bookingAsignado, setBookingAsignado] = useState("");
  const [buque, setBuque] = useState("");
  const [destino, setDestino] = useState("");

  // booking de embarque desde catálogo (028, M5 B3) — opcional, tiene prioridad
  // sobre el texto libre `bookingAsignado` de arriba (que se mantiene como fallback).
  const [bookingId, setBookingId] = useState("");
  const [modalBookingTexto, setModalBookingTexto] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingOption[] | null>(null);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  // navieras activas: solo hacen falta para el selector del alta inline (acá el
  // booking nuevo puede ser de cualquier naviera, a diferencia de Ingreso).
  const [navieras, setNavieras] = useState<NavieraOption[]>([]);

  const [salidaAttempted, setSalidaAttempted] = useState(false);
  const [salidaSending, setSalidaSending] = useState(false);
  const [salidaError, setSalidaError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("bookings")
      .select("id, numero, etd, naviera:navieras(nombre)")
      .eq("estado", "activo")
      .order("etd", { ascending: true });
    if (error) {
      setBookings(null);
      setBookingsError(error.message);
      return;
    }
    setBookingsError(null);
    setBookings(data as unknown as BookingOption[]);
  }, []);

  const loadNavieras = useCallback(async () => {
    const { data, error } = await getSupabase().from("navieras").select("id, nombre").eq("activa", true).order("nombre");
    setNavieras(error ? [] : ((data as NavieraOption[]) ?? []));
  }, []);

  const loadEnPlanta = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("operaciones")
      .select(
        // operaciones→plantas tiene UNA sola FK (planta_actual_id) → sin desambiguar
        "id, fecha_retiro, booking_retiro, retiro_de, contenedor:contenedores(numero_contenedor, tipo, naviera:navieras(nombre)), planta_actual:plantas(nombre)",
      )
      .eq("estado", "en_planta")
      .order("fecha_retiro", { ascending: true });
    if (error) {
      setEnPlanta(null);
      setEnPlantaError(error.message);
      return;
    }
    const rows = data as unknown as EnPlantaRow[];
    setEnPlantaError(null);
    setEnPlanta(rows);
    // podar de la selección los ids que ya no están (tras un refetch): detrás del
    // await, para no violar set-state-in-effect.
    const valid = new Set(rows.map((r) => r.id));
    setSelectedSalida((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, []);

  /* ---------- Fase 2 — pendientes de terminal / devolución ---------- */
  const [pendientes, setPendientes] = useState<PendienteTerminalRow[] | null>(null);
  const [pendientesError, setPendientesError] = useState<string | null>(null);
  const [selectedDevolucion, setSelectedDevolucion] = useState<Set<string>>(new Set());

  const [fechaDevolucion, setFechaDevolucion] = useState(hoyAR());
  const [devolucionAttempted, setDevolucionAttempted] = useState(false);
  const [devolucionSending, setDevolucionSending] = useState(false);
  const [devolucionError, setDevolucionError] = useState<string | null>(null);

  const loadPendientes = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("operaciones")
      .select(
        "id, tipo_cierre, fecha_egreso_planta, booking_asignado, buque, destino, orden, contenedor:contenedores(numero_contenedor, tipo, naviera:navieras(nombre)), planta_actual:plantas(nombre)",
      )
      .eq("estado", "en_transito_a_terminal")
      .order("fecha_egreso_planta", { ascending: true });
    if (error) {
      setPendientes(null);
      setPendientesError(error.message);
      return;
    }
    const rows = data as unknown as PendienteTerminalRow[];
    setPendientesError(null);
    setPendientes(rows);
    const valid = new Set(rows.map((r) => r.id));
    setSelectedDevolucion((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, []);

  useEffect(() => {
    void (async () => {
      await Promise.all([loadEnPlanta(), loadPendientes(), loadBookings(), loadNavieras()]);
    })();
  }, [loadEnPlanta, loadPendientes, loadBookings, loadNavieras]);

  // refetch al recuperar foco (mismo criterio que /ingreso y la campana §13)
  useEffect(() => {
    const onFocus = () => {
      void loadEnPlanta();
      void loadPendientes();
      void loadBookings();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadEnPlanta, loadPendientes, loadBookings]);

  const enPlantaLoading = enPlanta === null && !enPlantaError;
  const pendientesLoading = pendientes === null && !pendientesError;

  /* ---------- pegado inverso ---------- */
  const onPasteChange = (text: string) => {
    setPasteText(text);
    setPasteReport(null);
  };

  const aplicarPegado = () => {
    const parsed = parsearListaContenedores(pasteText);
    if (parsed.length === 0) return;
    const byNumero = new Map<string, string>();
    (enPlanta ?? []).forEach((r) => {
      if (r.contenedor) byNumero.set(r.contenedor.numero_contenedor, r.id);
    });
    const matchedIds: string[] = [];
    const faltantes: string[] = [];
    for (const p of parsed) {
      const id = byNumero.get(p.numero);
      if (id) matchedIds.push(id);
      else faltantes.push(p.numero);
    }
    // suma a la selección existente (no pisa lo tildado a mano)
    setSelectedSalida((prev) => {
      const next = new Set(prev);
      matchedIds.forEach((id) => next.add(id));
      return next;
    });
    setPasteReport({ seleccionados: matchedIds.length, faltantes });
  };

  /* ---------- Fase 1 — submit ---------- */
  const fechaSalidaError = salidaAttempted && fechaSalida === "" ? "indicá la fecha de salida" : null;
  const ordenError =
    salidaAttempted && tipoCierre === "embarcado" && orden.trim() === "" ? "indicá la orden" : null;
  const shpError = salidaAttempted && tipoCierre === "embarcado" && shp.trim() === "" ? "indicá el SHP" : null;

  const registrarSalida = async () => {
    if (salidaSending) return;
    setSalidaAttempted(true);
    setSalidaError(null);
    const ids = [...selectedSalida];
    if (ids.length === 0 || fechaSalida === "") return;
    // §14.1: orden y SHP obligatorios si embarca — se bloquea acá, CERO request
    if (tipoCierre === "embarcado" && (orden.trim() === "" || shp.trim() === "")) return;

    setSalidaSending(true);
    const asignacion =
      tipoCierre === "embarcado"
        ? {
            orden: orden.trim(),
            shp: shp.trim(),
            // booking_id (catálogo) tiene prioridad — la RPC pisa el snapshot texto
            // con el numero del booking resuelto cuando viene. El texto libre sigue
            // mandándose igual como fallback si no se eligió ninguno del catálogo.
            ...(bookingId ? { booking_id: bookingId } : {}),
            ...(bookingAsignado.trim() ? { booking_asignado: bookingAsignado.trim() } : {}),
            ...(buque.trim() ? { buque: buque.trim() } : {}),
            ...(destino.trim() ? { destino: destino.trim() } : {}),
          }
        : null;
    const { data, error } = await getSupabase().rpc("crm_registrar_salida_planta", {
      p_operacion_ids: ids,
      p_tipo_cierre: tipoCierre,
      // timestamptz AR fijo (UTC-3, sin DST) — nunca new Date(str) suelto
      p_fecha: `${fechaSalida}T00:00:00-03:00`,
      p_asignacion: asignacion,
    });
    setSalidaSending(false);
    if (error) {
      setSalidaError(error.message);
      return;
    }
    const salidas = (data as { salidas?: number } | null)?.salidas ?? 0;
    if (salidas === ids.length) {
      toast({
        type: "exito",
        title: `${salidas} salida${salidas === 1 ? "" : "s"} registrada${salidas === 1 ? "" : "s"}`,
        detail: "Pasaron a en tránsito a terminal; el freetime se corta al confirmar abajo.",
      });
    } else {
      // la RPC saltea en silencio lo que ya no estaba en_planta → comparar contra ids.length
      toast({
        type: "info",
        title: `Se registraron ${salidas} de ${ids.length}`,
        detail: "El resto ya no estaba en planta (otro usuario o un refresco previo).",
      });
    }
    setSelectedSalida(new Set());
    setSalidaAttempted(false);
    setPasteText("");
    setPasteReport(null);
    void loadEnPlanta();
    void loadPendientes();
  };

  /* ---------- Fase 2 — submit ---------- */
  const fechaDevolucionError =
    devolucionAttempted && fechaDevolucion === "" ? "indicá la fecha de devolución" : null;

  const confirmarDevolucion = async () => {
    if (devolucionSending) return;
    setDevolucionAttempted(true);
    setDevolucionError(null);
    const ids = [...selectedDevolucion];
    if (ids.length === 0 || fechaDevolucion === "") return;

    setDevolucionSending(true);
    const { data, error } = await getSupabase().rpc("crm_confirmar_devolucion", {
      p_operacion_ids: ids,
      p_fecha: `${fechaDevolucion}T00:00:00-03:00`,
    });
    setDevolucionSending(false);
    if (error) {
      setDevolucionError(error.message);
      return;
    }
    const cerradas = (data as { cerradas?: number } | null)?.cerradas ?? 0;
    if (cerradas === ids.length) {
      toast({
        type: "exito",
        title: `${cerradas} operación${cerradas === 1 ? "" : "es"} cerrada${cerradas === 1 ? "" : "s"}`,
        detail: "Freetime cortado con la fecha de devolución.",
      });
    } else {
      toast({
        type: "info",
        title: `Se cerraron ${cerradas} de ${ids.length}`,
        detail: "El resto ya no estaba pendiente (otro usuario o un refresco previo).",
      });
    }
    setSelectedDevolucion(new Set());
    setDevolucionAttempted(false);
    void loadPendientes();
  };

  /* ---------- columnas ---------- */
  const colsSalida: Column<EnPlantaRow>[] = [
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
      key: "planta",
      header: "planta",
      render: (r) => r.planta_actual?.nombre ?? "—",
      sortValue: (r) => r.planta_actual?.nombre ?? null,
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

  const colsPendientes: Column<PendienteTerminalRow>[] = [
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
      key: "cierre",
      header: "cierre",
      render: (r) => (
        <Badge tone={r.tipo_cierre === "embarcado" ? "accent" : "neutro"}>
          {TIPO_CIERRE_LABELS[r.tipo_cierre] ?? r.tipo_cierre}
        </Badge>
      ),
      sortValue: (r) => r.tipo_cierre,
    },
    {
      key: "destino_buque",
      header: "destino / buque",
      render: (r) => {
        const parts = [r.destino, r.buque].filter(Boolean);
        return parts.length > 0 ? parts.join(" · ") : "—";
      },
      sortValue: (r) => r.destino ?? r.buque ?? null,
      hideOnMobile: true,
    },
    {
      key: "orden",
      header: "orden",
      render: (r) => (r.orden ? <span className="mono">{r.orden}</span> : "—"),
      sortValue: (r) => r.orden,
    },
    {
      key: "planta_salida",
      header: "planta de salida",
      render: (r) => r.planta_actual?.nombre ?? "—",
      sortValue: (r) => r.planta_actual?.nombre ?? null,
      hideOnMobile: true,
    },
    {
      key: "fecha_egreso",
      header: "fecha egreso",
      numeric: true,
      render: (r) => fmtFecha(r.fecha_egreso_planta),
      sortValue: (r) => r.fecha_egreso_planta,
    },
  ];

  const enPlantaCount = enPlanta?.length ?? null;
  const pendientesCount = pendientes?.length ?? null;

  return (
    <>
      <PageHeader
        title="Egreso"
        counters={
          <>
            {enPlantaCount != null && (
              <Badge tone="neutro" mono icon="ti-building-warehouse">
                {enPlantaCount} en planta
              </Badge>
            )}
            {pendientesCount != null && (
              <Badge tone={pendientesCount > 0 ? "amarillo" : "neutro"} mono icon="ti-ship">
                {pendientesCount} pendiente{pendientesCount === 1 ? "" : "s"} de terminal
              </Badge>
            )}
          </>
        }
        action={
          <Button
            variant="ghost"
            icon="ti-refresh"
            onClick={() => {
              void loadEnPlanta();
              void loadPendientes();
            }}
            disabled={enPlantaLoading || pendientesLoading}
          >
            Actualizar
          </Button>
        }
      />

      {/* ================= Fase 1 — Salida de planta ================= */}
      <SectionTitle title="Salida de planta" count={enPlantaCount} />

      {/* pegado inverso: tilda filas del listado, no envía nada */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <Field
            label="seleccionar por pegado"
            htmlFor="egreso-paste"
            hint="pegá números (uno por línea, o separados por coma) y se tildan los que están en planta — no envía nada"
          >
            <Textarea
              id="egreso-paste"
              rows={2}
              value={pasteText}
              placeholder={"MSKU1234565, TCLU1234563, …"}
              onChange={(e) => onPasteChange(e.target.value)}
              style={{ resize: "vertical" }}
            />
          </Field>
        </div>
        <Button
          variant="ghost"
          icon="ti-list-check"
          onClick={aplicarPegado}
          disabled={pasteText.trim() === "" || enPlantaLoading}
          style={{ marginBottom: 22 }}
        >
          Seleccionar pegados
        </Button>
      </div>
      {pasteReport && (
        <div style={{ marginBottom: 10 }}>
          <FormAlert tone={pasteReport.faltantes.length > 0 ? "warning" : "info"}>
            Se seleccionaron <strong className="mono">{pasteReport.seleccionados}</strong> contenedor
            {pasteReport.seleccionados === 1 ? "" : "es"} del listado.
            {pasteReport.faltantes.length > 0 && (
              <>
                {" "}
                {pasteReport.faltantes.length === 1 ? "Este número no está" : `Estos ${pasteReport.faltantes.length} números no están`}{" "}
                en planta o no existen: <span className="mono">{pasteReport.faltantes.join(", ")}</span>
              </>
            )}
          </FormAlert>
        </div>
      )}

      {/* barra de acción: aparece con selección; registra la salida en lote */}
      {selectedSalida.size > 0 && (
        <div style={ACTION_BAR}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
            <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)", alignSelf: "center" }}>
              Registrar salida de <strong className="mono">{selectedSalida.size}</strong> contenedor
              {selectedSalida.size === 1 ? "" : "es"}:
            </span>
            <Field label="tipo de cierre" htmlFor="egreso-cierre">
              <Select
                id="egreso-cierre"
                value={tipoCierre}
                onChange={(e) => setTipoCierre(e.target.value as TipoCierre)}
                style={{ minWidth: 150 }}
              >
                {TIPOS_CIERRE.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="fecha de salida"
              htmlFor="egreso-fecha-salida"
              error={fechaSalidaError}
              help={<FieldHelp fieldKey="egreso.fecha_salida" />}
            >
              <DateField
                id="egreso-fecha-salida"
                value={fechaSalida}
                error={fechaSalidaError}
                onChange={(e) => setFechaSalida(e.target.value)}
              />
            </Field>
            <Button
              variant="primary"
              icon="ti-logout"
              loading={salidaSending}
              onClick={() => void registrarSalida()}
              style={{ marginBottom: 1 }}
            >
              Registrar salida
            </Button>
          </div>

          {tipoCierre === "embarcado" && (
            <>
              <div
                className="fd-label"
                style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-text-secondary)" }}
              >
                <i className="ti ti-ship" aria-hidden />
                Asignación de embarque — se aplica a todo el lote
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                <Field label="orden" htmlFor="egreso-orden" error={ordenError}>
                  <Input
                    id="egreso-orden"
                    value={orden}
                    error={ordenError}
                    placeholder="obligatoria"
                    onChange={(e) => setOrden(e.target.value)}
                  />
                </Field>
                <Field label="shp" htmlFor="egreso-shp" error={shpError}>
                  <Input
                    id="egreso-shp"
                    value={shp}
                    error={shpError}
                    placeholder="obligatorio"
                    onChange={(e) => setShp(e.target.value)}
                  />
                </Field>
                <Field label="booking (catálogo)" htmlFor="egreso-booking-cat" hint="opcional — prioriza sobre el texto libre">
                  <ComboboxCreatable
                    id="egreso-booking-cat"
                    options={(bookings ?? []).map((b) => ({
                      id: b.id,
                      label: `${b.numero} — ${b.naviera?.nombre ?? "—"} (ETD ${fmtFechaDia(b.etd)})`,
                    }))}
                    value={bookingId}
                    onChange={setBookingId}
                    onCreate={(t) => setModalBookingTexto(t)}
                    disabled={bookings === null}
                    placeholder={bookings === null ? "cargando bookings…" : "buscá o creá un booking…"}
                    emptyMessage="sin bookings activos — tipeá para crear uno nuevo"
                  />
                </Field>
                <Field
                  label="booking asignado (texto libre)"
                  htmlFor="egreso-booking"
                  hint="opcional — se ignora si elegiste uno del catálogo"
                >
                  <Input
                    id="egreso-booking"
                    value={bookingAsignado}
                    placeholder="opcional"
                    onChange={(e) => setBookingAsignado(e.target.value)}
                  />
                </Field>
                <Field label="buque" htmlFor="egreso-buque" hint="opcional">
                  <Input
                    id="egreso-buque"
                    value={buque}
                    placeholder="opcional"
                    onChange={(e) => setBuque(e.target.value)}
                  />
                </Field>
                <Field label="destino" htmlFor="egreso-destino" hint="opcional">
                  <Input
                    id="egreso-destino"
                    value={destino}
                    placeholder="opcional"
                    onChange={(e) => setDestino(e.target.value)}
                  />
                </Field>
              </div>
              {bookingsError && (
                <FormAlert tone="warning">
                  No se pudieron cargar los bookings: {bookingsError}{" "}
                  <button
                    type="button"
                    onClick={() => void loadBookings()}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      font: "inherit",
                      color: "inherit",
                      textDecoration: "underline",
                      cursor: "pointer",
                    }}
                  >
                    reintentar
                  </button>
                </FormAlert>
              )}
            </>
          )}

          <span style={{ fontSize: 11.5, color: "var(--color-text-faint)" }}>
            La salida <strong>no corta el freetime</strong>: se corta al confirmar la llegada a terminal / devolución,
            en la lista de abajo.
          </span>
        </div>
      )}
      {salidaError && (
        <div style={{ marginBottom: 10 }}>
          <FormAlert>{salidaError}</FormAlert>
        </div>
      )}

      <DataTable
        columns={colsSalida}
        rows={enPlanta ?? []}
        rowKey={(r) => r.id}
        loading={enPlantaLoading}
        skeletonRows={5}
        pageSize={12}
        maxHeight={480}
        defaultSort={{ key: "fecha_retiro", dir: "asc" }}
        selection={{ ids: selectedSalida, onChange: setSelectedSalida }}
        errorState={
          enPlantaError ? (
            <ErrorState
              title="No se pudieron cargar los contenedores en planta"
              detail={enPlantaError}
              onRetry={() => void loadEnPlanta()}
            />
          ) : undefined
        }
        emptyState={
          <EmptyState icon="ti-building-warehouse" title="No hay contenedores en planta">
            Acá aparece cada contenedor con ingreso a planta confirmado (desde la solapa <strong>Ingreso</strong>).
            Seleccionalos para registrar su salida — embarcado con su asignación, o devuelto vacío. La salida{" "}
            <strong>no corta el freetime</strong>: eso pasa recién al confirmar la llegada a terminal, en la lista de
            abajo.
          </EmptyState>
        }
      />

      {/* ============ Fase 2 — Pendientes de terminal / devolución ============ */}
      <SectionTitle title="Pendientes de terminal / devolución" count={pendientesCount} />

      {selectedDevolucion.size > 0 && (
        <div style={ACTION_BAR}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
            <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)", alignSelf: "center" }}>
              Confirmar llegada a terminal / devolución de{" "}
              <strong className="mono">{selectedDevolucion.size}</strong> contenedor
              {selectedDevolucion.size === 1 ? "" : "es"} — <strong>corta el freetime</strong> y cierra la operación:
            </span>
            <Field
              label="fecha de devolución"
              htmlFor="egreso-fecha-devolucion"
              error={fechaDevolucionError}
              help={<FieldHelp fieldKey="egreso.fecha_devolucion" />}
            >
              <DateField
                id="egreso-fecha-devolucion"
                value={fechaDevolucion}
                error={fechaDevolucionError}
                onChange={(e) => setFechaDevolucion(e.target.value)}
              />
            </Field>
            <Button
              variant="primary"
              icon="ti-circle-check"
              loading={devolucionSending}
              onClick={() => void confirmarDevolucion()}
              style={{ marginBottom: 1 }}
            >
              Confirmar devolución
            </Button>
          </div>
        </div>
      )}
      {devolucionError && (
        <div style={{ marginBottom: 10 }}>
          <FormAlert>{devolucionError}</FormAlert>
        </div>
      )}

      <DataTable
        columns={colsPendientes}
        rows={pendientes ?? []}
        rowKey={(r) => r.id}
        loading={pendientesLoading}
        skeletonRows={5}
        pageSize={12}
        maxHeight={480}
        defaultSort={{ key: "fecha_egreso", dir: "asc" }}
        selection={{ ids: selectedDevolucion, onChange: setSelectedDevolucion }}
        errorState={
          pendientesError ? (
            <ErrorState
              title="No se pudieron cargar los pendientes de terminal"
              detail={pendientesError}
              onRetry={() => void loadPendientes()}
            />
          ) : undefined
        }
        emptyState={
          <EmptyState icon="ti-ship" title="Sin pendientes de terminal">
            Acá aparece cada contenedor que salió de planta (fase de arriba) hasta que confirmes su llegada a terminal
            o la devolución del vacío. Esa confirmación <strong>sí corta el freetime</strong> y cierra la operación.
          </EmptyState>
        }
      />

      {modalBookingTexto !== null && (
        <NuevoBookingModal
          texto={modalBookingTexto}
          tipo="embarque"
          navieras={navieras}
          onClose={() => setModalBookingTexto(null)}
          onCreado={async (id) => {
            const textoCreado = modalBookingTexto;
            await loadBookings();
            setBookingId(id);
            setModalBookingTexto(null);
            toast({ type: "exito", title: "Booking creado", detail: `«${textoCreado}» ya está disponible.` });
          }}
        />
      )}
    </>
  );
}
