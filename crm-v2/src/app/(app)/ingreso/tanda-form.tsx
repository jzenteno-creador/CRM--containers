"use client";

// Ingreso · Fase 1 — Tanda de retiro (§6.1). El operativo arma UN encabezado y pega
// la lista de contenedores; el front SOLO construye el jsonb y llama a la RPC
// crm_crear_tanda_retiro. CERO cálculo de negocio: días/costos/estados los decide la DB.
// - Validación ISO 6346 por fila vía lib/iso6346 (número inválido se MARCA, no se descarta).
// - fecha_retiro se manda como timestamptz AR fijo (-03:00) — nunca new Date(str) suelto.
// - El error de la RPC (cuenta no activa, header incompleto, "ciclo abierto: X,Y",
//   "ya tiene un ciclo abierto") se muestra LITERAL en un FormAlert (no toast, no crash).
// - planta_destino: bloqueada a la planta del operador (RLS-aware §18.3); libre para sup/admin.
// - retiro de (depósito, 023): ComboboxCreatable sobre crm.depositos activos → manda
//   retiro_de_id (uuid) en el header. Si la migración 023 todavía no está desplegada
//   (depositosDisponible=false, ver page.tsx) degrada al Input de texto libre de antes,
//   mandando retiro_de texto — la RPC es retrocompatible con ambos casos.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ContainerNumber } from "@/components/container-number";
import { NuevoBookingModal } from "@/components/fd/booking-modal";
import { Button } from "@/components/fd/button";
import { ComboboxCreatable } from "@/components/fd/combobox-creatable";
import { DataTable, type Column, type RowValidation } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { Checkbox, DateField, Field, Input, Select, Textarea, Toggle } from "@/components/fd/fields";
import { FieldHelp } from "@/components/fd/field-help";
import { FormAlert } from "@/components/fd/form-alert";
import { Modal } from "@/components/fd/modal";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { StatusBadge, type EstadoSemaforo } from "@/components/fd/status-badge";
import { useToast } from "@/components/fd/toast";
import { fmtFechaDia } from "@/lib/format";
import { parsearListaContenedores } from "@/lib/iso6346";
import { getSupabase } from "@/lib/supabase";
import type { Perfil } from "@/lib/session";

export type Naviera = { id: string; nombre: string };
export type Planta = { id: string; nombre: string; codigo: string | null };
export type Deposito = { id: string; nombre: string };

type SimilarDeposito = { id: string; nombre: string; activo: boolean; similitud: number };
// Booking de retiro (M5 B3) — filtrado por naviera+tipo='retiro'+estado='activo'.
type Booking = { id: string; numero: string; etd: string; fecha_corte: string | null; buque: string | null };
// Saldo del booking elegido (vista_bookings_saldo): la DB ya calcula días a ETD y
// semáforo — el front NUNCA resta fechas para esto, solo muestra lo que llega.
type BookingSaldo = { etd: string; dias_a_etd: number; estado_semaforo: EstadoSemaforo };

/** Pre-check fuzzy + alta inline de depósito (023) — abierto desde el "Crear «X»" del
 * combobox. NUNCA crea en silencio: primero muestra similares (crm_depositos_similares)
 * con opción de usar uno existente; solo con click explícito en "Crear" llama
 * crm_crear_deposito. El front no calcula similitud — eso vive en la RPC. */
function NuevoDepositoModal({
  texto,
  onClose,
  onUsarExistente,
  onCreado,
}: {
  texto: string;
  onClose: () => void;
  onUsarExistente: (id: string) => void;
  onCreado: (id: string) => void;
}) {
  const [similares, setSimilares] = useState<SimilarDeposito[] | null>(null);
  const [similaresError, setSimilaresError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // fetch al montar (una sola vez por texto — el modal se remonta si cambia el texto).
  // setState siempre después del await (regla set-state-in-effect).
  useEffect(() => {
    void (async () => {
      const { data, error } = await getSupabase().rpc("crm_depositos_similares", { p_nombre: texto });
      if (error) {
        setSimilaresError(error.message);
        setSimilares([]);
        return;
      }
      setSimilaresError(null);
      setSimilares(data as SimilarDeposito[]);
    })();
  }, [texto]);

  const crear = async () => {
    if (sending) return;
    setSending(true);
    setSubmitError(null);
    const { data, error } = await getSupabase().rpc("crm_crear_deposito", { p_nombre: texto });
    setSending(false);
    if (error) {
      // literal: "ya existe un depósito con el nombre..." (carrera con otro operador)
      setSubmitError(error.message);
      return;
    }
    onCreado(data as string);
  };

  const cargandoSimilares = similares === null;

  return (
    <Modal open onClose={sending ? () => {} : onClose} title={`Crear depósito «${texto}»`} width={460} closeOnBackdrop={!sending}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {cargandoSimilares && (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-text-muted)" }}>
            Buscando depósitos parecidos…
          </p>
        )}
        {similaresError && <FormAlert tone="warning">No se pudo chequear parecidos: {similaresError}</FormAlert>}
        {!cargandoSimilares && similares.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="fd-label">¿Quisiste decir…?</span>
            {similares.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: "var(--radius-input)",
                  border: "1px solid var(--color-border-strong)",
                  background: "var(--color-surface-2)",
                }}
              >
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--color-text-primary)" }}>
                  {s.nombre}
                  {!s.activo && (
                    <span style={{ color: "var(--color-text-faint)", marginLeft: 6 }}>(inactivo)</span>
                  )}
                </span>
                <span className="mono" style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
                  {Math.round(s.similitud * 100)}%
                </span>
                <Button
                  variant="ghost"
                  style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}
                  disabled={!s.activo}
                  onClick={() => onUsarExistente(s.id)}
                >
                  Usar este
                </Button>
              </div>
            ))}
          </div>
        )}
        {submitError && <FormAlert>{submitError}</FormAlert>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon="ti-plus"
            loading={sending}
            disabled={cargandoSimilares}
            onClick={() => void crear()}
          >
            Crear «{texto}» de todos modos
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// tipo de contenedor: es un catálogo cerrado en la DB (contenedores.tipo CHECK) —
// por eso va como Select y no como texto libre (texto libre rompería el INSERT).
const TIPOS = ["20DC", "40DC", "40HC"] as const;
const MEDIOS: { value: "camion" | "tren"; label: string }[] = [
  { value: "camion", label: "Camión" },
  { value: "tren", label: "Tren" },
];

type Row = { numero: string; error: string | null; reforzado: boolean };

// Fila del jsonb `resultados` de crm_crear_tanda_retiro (migración 019). Si el
// deploy está desfasado y la RPC solo devuelve `creadas` (sin `resultados`),
// se degrada al comportamiento anterior (ver submit()).
type ResultadoFila = {
  numero: string;
  estado: "aceptado" | "rechazado";
  operacion_id: string | null;
  motivo: string | null;
  motivo_texto: string | null;
};

const CARD: React.CSSProperties = {
  background: "var(--color-surface-1)",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: "var(--radius-input)",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fd-label"
      style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-text-secondary)" }}
    >
      {children}
    </div>
  );
}

export function TandaForm({
  perfil,
  navieras,
  plantas,
  depositos,
  depositosDisponible,
  onRefreshDepositos,
  maestrosLoading,
  maestrosError,
  onRetryMaestros,
  onCreated,
}: {
  perfil: Perfil;
  navieras: Naviera[];
  plantas: Planta[];
  /** Depósitos activos (023). Vacío + depositosDisponible=false si la migración todavía
   * no está desplegada en este entorno — ahí el formulario degrada al Input de texto. */
  depositos: Deposito[];
  depositosDisponible: boolean;
  /** Refetch silencioso de maestros (navieras+plantas+depositos) tras crear un depósito
   * inline — NO resetea a loading (eso es onRetryMaestros, para el botón de error). */
  onRefreshDepositos: () => Promise<void>;
  maestrosLoading: boolean;
  maestrosError: string | null;
  onRetryMaestros: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();

  const isOperador = perfil.rol === "operador";
  // operador → planta destino BLOQUEADA a su planta asignada (la policy de INSERT de
  // movimientos_planta solo lo deja crear hacia su planta). null = no bloqueada (sup/admin).
  const lockedPlanta = isOperador ? (perfil.planta_asignada_id ?? "") : null;

  const [navieraId, setNavieraId] = useState("");
  const [tipo, setTipo] = useState("");
  // retiro de (depósito, 023): retiroDeId cuando depositosDisponible; retiroDe (texto
  // libre) como fallback si la migración todavía no está desplegada (ver page.tsx).
  const [retiroDe, setRetiroDe] = useState("");
  const [retiroDeId, setRetiroDeId] = useState("");
  const [modalDepositoTexto, setModalDepositoTexto] = useState<string | null>(null);
  const [plantaSel, setPlantaSel] = useState("");
  const [fechaRetiro, setFechaRetiro] = useState("");

  // booking de retiro (028, M5 B3): OBLIGATORIO, filtrado por la naviera del
  // encabezado + tipo='retiro' + estado='activo'. Deshabilitado hasta elegir naviera.
  const [bookingId, setBookingId] = useState("");
  const [modalBookingTexto, setModalBookingTexto] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [bookingSaldo, setBookingSaldo] = useState<BookingSaldo | null>(null);

  const plantaDestino = lockedPlanta ?? plantaSel;

  // reset de la selección al cambiar de naviera (ajuste durante el render, mismo
  // patrón que AlertasPageContent/HelpPanelContent): un booking de OTRA naviera deja
  // de tener sentido apenas cambia el encabezado — nunca un efecto síncrono.
  const [lastNavieraId, setLastNavieraId] = useState(navieraId);
  if (navieraId !== lastNavieraId) {
    setLastNavieraId(navieraId);
    setBookingId("");
  }

  const loadBookings = useCallback(async () => {
    if (navieraId === "") {
      setBookings([]);
      setBookingsError(null);
      return;
    }
    const { data, error } = await getSupabase()
      .from("bookings")
      .select("id, numero, etd, fecha_corte, buque")
      .eq("naviera_id", navieraId)
      .eq("tipo", "retiro")
      .eq("estado", "activo")
      .order("etd", { ascending: true });
    if (error) {
      setBookings(null);
      setBookingsError(error.message);
      return;
    }
    setBookingsError(null);
    setBookings(data as Booking[]);
  }, [navieraId]);

  useEffect(() => {
    void (async () => {
      await loadBookings();
    })();
  }, [loadBookings]);

  // pill de ETD/días del booking elegido — la DB ya lo calcula (vista_bookings_saldo).
  // El reset a null vive en el ajuste durante el render de abajo (evita setState
  // síncrono en el cuerpo del efecto); el efecto solo dispara el fetch cuando hay id.
  const [lastBookingId, setLastBookingId] = useState(bookingId);
  if (bookingId !== lastBookingId) {
    setLastBookingId(bookingId);
    setBookingSaldo(null);
  }

  useEffect(() => {
    if (bookingId === "") return;
    let alive = true;
    void (async () => {
      const { data, error } = await getSupabase()
        .from("vista_bookings_saldo")
        .select("etd, dias_a_etd, estado_semaforo")
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (!alive) return;
      setBookingSaldo(error || !data ? null : (data as BookingSaldo));
    })();
    return () => {
      alive = false;
    };
  }, [bookingId]);

  const [confirmaIngreso, setConfirmaIngreso] = useState(false);
  const [medio, setMedio] = useState<"camion" | "tren">("camion");

  // estado_carga (M5-029, D3 informativo): default 'vacio' — caso raro (movimiento
  // entre plantas de un contenedor ya lleno) queda a un click. Aplica a TODAS las
  // operaciones de la tanda (columna de header, no por contenedor).
  const [estadoCarga, setEstadoCarga] = useState<"vacio" | "lleno">("vacio");

  const [pasteText, setPasteText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  // overrides de reforzado tocados por el usuario (numero → valor); default es true.
  const [reforzadoOverrides, setReforzadoOverrides] = useState<Record<string, boolean>>({});

  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // resultado fila-por-fila del último envío (null = todavía no se envió nada
  // en esta sesión, o el envío anterior no trajo `resultados` — ver submit()).
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoFila[] | null>(null);

  // re-parsear al cambiar el textarea, preservando el reforzado ya tocado
  const onPasteChange = (text: string) => {
    setPasteText(text);
    const parsed = parsearListaContenedores(text);
    setRows(parsed.map((p) => ({ numero: p.numero, error: p.error, reforzado: reforzadoOverrides[p.numero] ?? true })));
  };

  const toggleReforzado = (numero: string) => {
    setRows((rs) => rs.map((r) => (r.numero === numero ? { ...r, reforzado: !r.reforzado } : r)));
    setReforzadoOverrides((o) => {
      const cur = rows.find((r) => r.numero === numero)?.reforzado ?? true;
      return { ...o, [numero]: !cur };
    });
  };

  const quitar = (numero: string) => {
    const next = rows.filter((r) => r.numero !== numero);
    setRows(next);
    // normalizar el textarea a la lista restante para que no reaparezca al re-parsear
    setPasteText(next.map((r) => r.numero).join("\n"));
  };

  const plantaName = useMemo(
    () => plantas.find((p) => p.id === plantaDestino)?.nombre ?? null,
    [plantas, plantaDestino],
  );

  const headerErrors = {
    naviera: navieraId === "" ? "elegí la naviera" : null,
    tipo: tipo === "" ? "elegí el tipo de contenedor" : null,
    retiroDe: depositosDisponible
      ? retiroDeId === ""
        ? "elegí el depósito de retiro"
        : null
      : retiroDe.trim() === ""
        ? "indicá el depósito de retiro"
        : null,
    plantaDestino: plantaDestino === "" ? "elegí la planta destino" : null,
    fechaRetiro: fechaRetiro === "" ? "indicá la fecha de retiro" : null,
    booking: bookingId === "" ? "elegí el booking de retiro" : null,
  };
  const headerComplete = Object.values(headerErrors).every((e) => e === null);

  const invalidCount = rows.filter((r) => r.error !== null).length;
  const operadorSinPlanta = isOperador && (perfil.planta_asignada_id === null || perfil.planta_asignada_id === "");

  // el botón se BLOQUEA por los motivos visibles en pantalla (tabla vacía, badges ISO,
  // envío en curso, operador sin planta). El header incompleto se revela al intentar.
  const submitDisabled =
    sending || rows.length === 0 || invalidCount > 0 || operadorSinPlanta;

  const submit = async () => {
    if (sending) return;
    setAttempted(true);
    setSubmitError(null);
    setUltimoResultado(null); // el resultado del envío anterior se reemplaza por el nuevo
    if (!headerComplete || rows.length === 0 || invalidCount > 0 || operadorSinPlanta) return;

    setSending(true);
    const p = {
      header: {
        naviera_id: navieraId,
        tipo,
        // 023: si el catálogo está disponible mandamos el uuid (fuente de verdad, la
        // RPC deriva el texto); si no, degradamos al texto libre de antes.
        ...(depositosDisponible ? { retiro_de_id: retiroDeId } : { retiro_de: retiroDe.trim() }),
        planta_destino_id: plantaDestino,
        // timestamptz AR fijo (UTC-3, sin DST). El día del retiro cuenta como
        // día 1 del freetime (conteo inclusivo, validado 2.804/2.804 vs Excel).
        fecha_retiro: `${fechaRetiro}T00:00:00-03:00`,
        confirma_ingreso: confirmaIngreso,
        // 028 (M5 B3): booking pasa a ser OBLIGATORIO en el alta — el front nuevo
        // SIEMPRE manda booking_id + require_booking:true (headerComplete ya garantiza
        // bookingId no vacío acá).
        booking_id: bookingId,
        require_booking: true,
        ...(confirmaIngreso ? { medio } : {}),
        // 029 (M5): solo se manda si es 'lleno' — el default 'vacio' lo pone la DB.
        ...(estadoCarga === "lleno" ? { estado_carga: "lleno" } : {}),
      },
      contenedores: rows.map((r) => ({ numero: r.numero, reforzado: r.reforzado })),
    };

    const { data, error } = await getSupabase().rpc("crm_crear_tanda_retiro", { p });
    setSending(false);
    if (error) {
      // literal: "Contenedores con ciclo abierto: X, Y" es información útil para el operativo
      setSubmitError(error.message);
      return;
    }
    const respuesta = data as { creadas?: number; rechazadas?: number; resultados?: ResultadoFila[] } | null;
    const creadas = respuesta?.creadas ?? rows.length;
    const rechazadas = respuesta?.rechazadas ?? 0;

    if (Array.isArray(respuesta?.resultados)) {
      // fila-por-fila (019): el textarea/tabla quedan SOLO con los rechazados, listos
      // para corregir (booking abierto, número mal tipeado) y reintentar de una.
      setUltimoResultado(respuesta.resultados);
      const pendientes = respuesta.resultados
        .filter((r) => r.estado === "rechazado")
        .map((r) => ({ numero: r.numero, error: null, reforzado: reforzadoOverrides[r.numero] ?? true }) satisfies Row);
      setRows(pendientes);
      setPasteText(pendientes.map((r) => r.numero).join("\n"));
    } else {
      // null-guard: deploy desfasado sin `resultados` → comportamiento anterior (todo éxito)
      setUltimoResultado(null);
      setRows([]);
      setPasteText("");
    }
    setReforzadoOverrides({});
    setAttempted(false);

    toast(
      rechazadas > 0
        ? {
            type: "info",
            title: `${creadas} creada${creadas === 1 ? "" : "s"} · ${rechazadas} rechazada${rechazadas === 1 ? "" : "s"}`,
            detail: "Revisá el detalle fila por fila debajo de la tabla.",
          }
        : {
            type: "exito",
            title: `${creadas} operación${creadas === 1 ? "" : "es"} creada${creadas === 1 ? "" : "s"}`,
            detail: confirmaIngreso
              ? "Ingreso a planta confirmado en la misma tanda."
              : "Quedan pendientes de ingreso a planta.",
          },
    );
    if (creadas > 0) onCreated();
  };

  const cols: Column<Row>[] = [
    {
      key: "numero",
      header: "contenedor",
      render: (r) => <ContainerNumber value={r.numero} />,
      sortValue: (r) => r.numero,
    },
    {
      key: "reforzado",
      header: "reforzado",
      align: "center",
      render: (r) => (
        <Checkbox
          checked={r.reforzado}
          onChange={() => toggleReforzado(r.numero)}
          aria-label={`reforzado ${r.numero}`}
        />
      ),
    },
    {
      key: "quitar",
      header: "",
      align: "right",
      width: "1%",
      render: (r) => (
        <Button
          variant="ghost"
          icon="ti-x"
          onClick={() => quitar(r.numero)}
          style={{ minHeight: 0, padding: "4px 8px", fontSize: 12 }}
          aria-label={`quitar ${r.numero}`}
        >
          Quitar
        </Button>
      ),
    },
  ];

  const rowValidation = (r: Row): RowValidation | null =>
    r.error ? { type: "error", message: `${r.numero}: ${r.error}` } : null;

  if (maestrosError) {
    return (
      <div style={CARD}>
        <ErrorState
          title="No se pudieron cargar navieras y plantas"
          detail={maestrosError}
          onRetry={onRetryMaestros}
        />
      </div>
    );
  }

  if (maestrosLoading) {
    return (
      <div style={CARD} aria-busy="true" aria-label="cargando formulario">
        <SkeletonBlock width="30%" height={12} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <SkeletonBlock height={34} delay={100} />
          <SkeletonBlock height={34} delay={150} />
          <SkeletonBlock height={34} delay={200} />
          <SkeletonBlock height={34} delay={250} />
        </div>
        <SkeletonBlock height={90} delay={300} />
      </div>
    );
  }

  return (
    <div style={CARD}>
      {/* ---- encabezado (una vez por tanda) ---- */}
      <SectionLabel>
        <i className="ti ti-file-description" aria-hidden />
        Encabezado de la tanda
      </SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        <Field
          label="naviera"
          htmlFor="tanda-naviera"
          error={attempted ? headerErrors.naviera : null}
          help={<FieldHelp fieldKey="ingreso.naviera" naviera={navieraId || undefined} />}
        >
          <ComboboxCreatable
            id="tanda-naviera"
            options={navieras.map((n) => ({ id: n.id, label: n.nombre }))}
            value={navieraId}
            onChange={setNavieraId}
            error={attempted ? headerErrors.naviera : null}
            placeholder="— elegí la naviera —"
          />
        </Field>

        <Field label="tipo de contenedor" htmlFor="tanda-tipo" error={attempted ? headerErrors.tipo : null}>
          <Select
            id="tanda-tipo"
            value={tipo}
            error={attempted ? headerErrors.tipo : null}
            onChange={(e) => setTipo(e.target.value)}
          >
            <option value="">— elegí el tipo —</option>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="retiro de (depósito)"
          htmlFor="tanda-retiro-de"
          error={attempted ? headerErrors.retiroDe : null}
          hint={!depositosDisponible ? "catálogo de depósitos no disponible en este entorno — texto libre" : undefined}
          help={<FieldHelp fieldKey="ingreso.retiro_de" />}
        >
          {depositosDisponible ? (
            <ComboboxCreatable
              id="tanda-retiro-de"
              options={depositos.map((d) => ({ id: d.id, label: d.nombre }))}
              value={retiroDeId}
              onChange={setRetiroDeId}
              onCreate={(texto) => setModalDepositoTexto(texto)}
              placeholder="buscá o creá un depósito…"
              error={attempted ? headerErrors.retiroDe : null}
              emptyMessage="sin depósitos que matcheen — tipeá para crear uno nuevo"
            />
          ) : (
            <Input
              id="tanda-retiro-de"
              value={retiroDe}
              error={attempted ? headerErrors.retiroDe : null}
              placeholder="depósito / terminal de origen"
              onChange={(e) => setRetiroDe(e.target.value)}
            />
          )}
        </Field>

        {/* planta destino: bloqueada para operador (§18.3), libre para sup/admin */}
        {lockedPlanta !== null ? (
          <Field label="planta destino" hint="asignada a tu usuario">
            <div
              className="mono"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minHeight: 34,
                padding: "0 12px",
                borderRadius: "var(--radius-input)",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border-strong)",
                color: "var(--color-text-primary)",
                fontSize: 12.5,
              }}
            >
              <i className="ti ti-lock" aria-hidden style={{ color: "var(--color-text-faint)", fontSize: 14 }} />
              {plantaName ?? (operadorSinPlanta ? "sin planta asignada" : "—")}
            </div>
          </Field>
        ) : (
          <Field
            label="planta destino"
            htmlFor="tanda-planta"
            error={attempted ? headerErrors.plantaDestino : null}
          >
            <ComboboxCreatable
              id="tanda-planta"
              options={plantas.map((p) => ({ id: p.id, label: `${p.nombre}${p.codigo ? ` (${p.codigo})` : ""}` }))}
              value={plantaSel}
              onChange={setPlantaSel}
              error={attempted ? headerErrors.plantaDestino : null}
              placeholder="— elegí la planta —"
            />
          </Field>
        )}

        <Field
          label="fecha de retiro"
          htmlFor="tanda-fecha"
          error={attempted ? headerErrors.fechaRetiro : null}
          help={<FieldHelp fieldKey="ingreso.fecha_retiro" naviera={navieraId || undefined} />}
        >
          <DateField
            id="tanda-fecha"
            value={fechaRetiro}
            error={attempted ? headerErrors.fechaRetiro : null}
            onChange={(e) => setFechaRetiro(e.target.value)}
          />
        </Field>

        <Field
          label="booking de retiro"
          htmlFor="tanda-booking"
          error={attempted ? headerErrors.booking : null}
          hint={navieraId === "" ? "elegí primero la naviera" : undefined}
          help={<FieldHelp fieldKey="ingreso.booking_retiro" naviera={navieraId || undefined} />}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <ComboboxCreatable
                id="tanda-booking"
                options={(bookings ?? []).map((b) => ({ id: b.id, label: `${b.numero} · ETD ${fmtFechaDia(b.etd)}` }))}
                value={bookingId}
                onChange={setBookingId}
                onCreate={(t) => setModalBookingTexto(t)}
                disabled={navieraId === "" || bookings === null}
                error={attempted ? headerErrors.booking : null}
                placeholder={
                  navieraId === ""
                    ? "— elegí la naviera primero —"
                    : bookings === null
                      ? "cargando bookings…"
                      : "buscá o creá un booking…"
                }
                emptyMessage="sin bookings activos para esta naviera — tipeá para crear uno nuevo"
              />
            </div>
            {bookingSaldo && (
              <StatusBadge estado={bookingSaldo.estado_semaforo}>
                ETD {fmtFechaDia(bookingSaldo.etd)} ·{" "}
                {bookingSaldo.dias_a_etd < 0 ? `−${Math.abs(bookingSaldo.dias_a_etd)}` : bookingSaldo.dias_a_etd}d
              </StatusBadge>
            )}
          </div>
        </Field>

        <Field
          label="estado de carga"
          htmlFor="tanda-estado-carga"
          hint="caso raro — movimiento entre plantas de un contenedor ya lleno"
          help={<FieldHelp fieldKey="ingreso.estado_carga" />}
        >
          <Select
            id="tanda-estado-carga"
            value={estadoCarga}
            onChange={(e) => setEstadoCarga(e.target.value as "vacio" | "lleno")}
          >
            <option value="vacio">Vacío</option>
            <option value="lleno">Lleno</option>
          </Select>
        </Field>
      </div>

      {bookingsError && (
        <FormAlert tone="warning">
          No se pudieron cargar los bookings de esta naviera: {bookingsError}{" "}
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

      {operadorSinPlanta && (
        <FormAlert>
          Tu usuario no tiene una planta asignada, así que no podés crear tandas. Pedí a un administrador que te asigne una planta.
        </FormAlert>
      )}

      {/* ---- pegado de contenedores ---- */}
      <SectionLabel>
        <i className="ti ti-clipboard-list" aria-hidden />
        Contenedores de la tanda
      </SectionLabel>
      <Field
        label="pegá los números (uno por línea, o separados por coma)"
        htmlFor="tanda-paste"
        hint="se validan con el dígito verificador ISO 6346; los repetidos se ignoran"
      >
        <Textarea
          id="tanda-paste"
          rows={4}
          value={pasteText}
          placeholder={"MSKU1234565\nTCLU1234563\n…"}
          onChange={(e) => onPasteChange(e.target.value)}
          style={{ resize: "vertical" }}
        />
      </Field>

      <DataTable
        columns={cols}
        rows={rows}
        rowKey={(r) => r.numero}
        validation={rowValidation}
        maxHeight={360}
        emptyState={
          <EmptyState icon="ti-clipboard-list" title="Todavía no pegaste contenedores">
            Pegá arriba los números de contenedor de esta tanda (uno por línea). Cada uno aparece acá con su validación
            ISO 6346; los números con dígito verificador incorrecto se marcan en rojo para que los corrijas o los quites
            antes de enviar.
          </EmptyState>
        }
      />

      {/* ---- confirmar ingreso ahora ---- */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
        <Toggle
          checked={confirmaIngreso}
          onChange={setConfirmaIngreso}
          label="confirmar ingreso a planta ahora"
        />
        {confirmaIngreso && (
          <Field label="medio" htmlFor="tanda-medio">
            <Select
              id="tanda-medio"
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
        )}
      </div>
      {confirmaIngreso && (
        <span style={{ fontSize: 11.5, color: "var(--color-text-faint)", marginTop: -8 }}>
          Cada contenedor nace directamente <strong>en planta</strong> (sin pasar por pendientes de ingreso).
        </span>
      )}

      {/* ---- resultado fila-por-fila del último envío (019) ---- */}
      {ultimoResultado && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SectionLabel>
            <i className="ti ti-list-check" aria-hidden />
            Resultado del último envío
          </SectionLabel>
          {ultimoResultado.map((r) => (
            <div
              key={r.numero}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                padding: "6px 10px",
                borderRadius: "var(--radius-input)",
                background: r.estado === "aceptado" ? "var(--color-green-tint)" : "var(--color-red-tint)",
                border: `1px solid ${r.estado === "aceptado" ? "var(--color-green-line)" : "var(--color-red-line)"}`,
              }}
            >
              <i
                className={`ti ${r.estado === "aceptado" ? "ti-circle-check" : "ti-x"}`}
                aria-hidden
                style={{ color: r.estado === "aceptado" ? "var(--color-status-green)" : "var(--color-status-red)" }}
              />
              <ContainerNumber value={r.numero} />
              <span style={{ color: "var(--color-text-secondary)" }}>
                {r.estado === "aceptado" ? "operación creada" : (r.motivo_texto ?? "rechazado")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ---- errores de validación agregada + envío ---- */}
      {invalidCount > 0 && (
        <FormAlert>
          {invalidCount} contenedor{invalidCount === 1 ? "" : "es"} con número inválido — corregilos o quitalos antes de
          enviar.
        </FormAlert>
      )}
      {submitError && <FormAlert>{submitError}</FormAlert>}

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 11.5, color: "var(--color-text-muted)" }} className="mono">
          {rows.length} contenedor{rows.length === 1 ? "" : "es"}
          {invalidCount > 0 ? ` · ${invalidCount} con error` : ""}
        </span>
        <Button
          variant="primary"
          icon="ti-truck-loading"
          loading={sending}
          disabled={submitDisabled}
          onClick={() => void submit()}
        >
          Crear tanda de retiro
        </Button>
      </div>

      {modalDepositoTexto !== null && (
        <NuevoDepositoModal
          texto={modalDepositoTexto}
          onClose={() => setModalDepositoTexto(null)}
          onUsarExistente={(id) => {
            setRetiroDeId(id);
            setModalDepositoTexto(null);
          }}
          onCreado={async (id) => {
            const textoCreado = modalDepositoTexto;
            // esperamos el refetch ANTES de seleccionar: así `depositos` ya trae la
            // opción nueva cuando el combobox vuelve a renderizar (React 18+ batchea
            // las dos actualizaciones — sin esto el combobox mostraría vacío un instante).
            await onRefreshDepositos();
            setRetiroDeId(id);
            setModalDepositoTexto(null);
            toast({ type: "exito", title: "Depósito creado", detail: `«${textoCreado}» ya está disponible.` });
          }}
        />
      )}

      {modalBookingTexto !== null && (
        <NuevoBookingModal
          texto={modalBookingTexto}
          tipo="retiro"
          navieraId={navieraId}
          onClose={() => setModalBookingTexto(null)}
          onCreado={async (id) => {
            const textoCreado = modalBookingTexto;
            // mismo orden que NuevoDepositoModal: esperamos el refetch ANTES de
            // seleccionar, así el combobox ya trae la opción nueva al re-renderizar.
            await loadBookings();
            setBookingId(id);
            setModalBookingTexto(null);
            toast({ type: "exito", title: "Booking creado", detail: `«${textoCreado}» ya está disponible.` });
          }}
        />
      )}
    </div>
  );
}
