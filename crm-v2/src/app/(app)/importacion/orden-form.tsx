"use client";

// Importación · Fase 1 — Nueva orden (§6.4). Espejo de ingreso/tanda-form.tsx: UN
// encabezado (naviera, fecha de arribo, planta destino, número de orden — arribo común,
// mismo buque) + pegado de contenedores (ISO 6346 en vivo) que la RPC crm_crear_orden_impo
// procesa fila-por-fila. CERO cálculo de negocio: el front arma el jsonb y muestra
// literalmente lo que la DB devuelve (motivo_texto ya viene redactado en español desde
// la RPC — no se remapean los códigos de motivo acá).
// - fecha_arribo_terminal se manda como timestamptz AR fijo (-03:00), igual que el resto
//   del sistema (nunca new Date(str) suelto).
// - planta_destino: bloqueada a la planta del operador (mismo gate que ingreso §18.3);
//   libre para supervisor/administrador.
// - Prefijos restringidos (B6, mismo patrón completo que tanda-form): catálogo activo se
//   lee al montar (SELECT libre), cada fila cuyo prefijo matchea se marca ámbar (NO
//   bloquea el envío) y con ≥1 restringido se pide confirmación explícita antes de llamar
//   la RPC — que registra la incidencia automática SIEMPRE, confirme o no el operador.
// - Si TODAS las filas se rechazan, la orden queda creada VACÍA (comportamiento espejo de
//   la tanda de retiro): se avisa con un FormAlert destacado, no solo un toast que
//   desaparece — el operador necesita ver esto aunque se distraiga.

import { useEffect, useMemo, useState } from "react";
import { ContainerNumber } from "@/components/container-number";
import { Button } from "@/components/fd/button";
import { ComboboxCreatable } from "@/components/fd/combobox-creatable";
import { DataTable, type Column, type RowValidation } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { DateField, Field, Input, Select, Textarea } from "@/components/fd/fields";
import { FieldHelp } from "@/components/fd/field-help";
import { FormAlert } from "@/components/fd/form-alert";
import { ConfirmDialog } from "@/components/fd/modal";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { useToast } from "@/components/fd/toast";
import { parsearListaContenedores } from "@/lib/iso6346";
import { getSupabase } from "@/lib/supabase";
import type { Perfil } from "@/lib/session";

export type Naviera = { id: string; nombre: string };
export type Planta = { id: string; nombre: string; codigo: string | null };

// tipo de contenedor: catálogo cerrado en la DB (contenedores.tipo CHECK) — Select, nunca
// texto libre. Default 40HC editable por fila (pedido explícito del brief de B2).
const TIPOS = ["20DC", "40DC", "40HC"] as const;
type Tipo = (typeof TIPOS)[number];
const TIPO_DEFAULT: Tipo = "40HC";

type Row = { numero: string; error: string | null; tipo: Tipo };

// Fila del jsonb `resultados` de crm_crear_orden_impo (migración 032) — motivo_texto ya
// viene redactado en español desde la RPC (ver cabecera del archivo).
type ResultadoFila = {
  numero: string;
  estado: "aceptado" | "rechazado";
  operacion_impo_id: string | null;
  motivo: string | null;
  motivo_texto: string | null;
  prefijo_restringido?: boolean;
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

export function OrdenImpoForm({
  perfil,
  navieras,
  plantas,
  maestrosLoading,
  maestrosError,
  onRetryMaestros,
  onCreated,
}: {
  perfil: Perfil;
  navieras: Naviera[];
  plantas: Planta[];
  maestrosLoading: boolean;
  maestrosError: string | null;
  onRetryMaestros: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();

  const isOperador = perfil.rol === "operador";
  // operador → planta destino BLOQUEADA a su planta asignada (mismo gate que ingreso).
  const lockedPlanta = isOperador ? (perfil.planta_asignada_id ?? "") : null;

  const [numeroOrden, setNumeroOrden] = useState("");
  const [navieraId, setNavieraId] = useState("");
  const [bookingBl, setBookingBl] = useState("");
  const [buque, setBuque] = useState("");
  const [fechaArribo, setFechaArribo] = useState("");
  const [plantaSel, setPlantaSel] = useState("");

  const plantaDestino = lockedPlanta ?? plantaSel;

  const [pasteText, setPasteText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  // overrides de tipo tocados por el usuario (numero → valor); default TIPO_DEFAULT.
  const [tipoOverrides, setTipoOverrides] = useState<Record<string, Tipo>>({});

  // Prefijos restringidos (B6): prefijo → nota, SOLO activos. Fetch una vez al montar;
  // degrada en silencio si falla (la RPC igual detecta y registra la incidencia).
  const [prefijosRestringidos, setPrefijosRestringidos] = useState<Map<string, string | null>>(new Map());
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data, error } = await getSupabase()
          .from("prefijos_restringidos")
          .select("prefijo, nota")
          .eq("activo", true);
        if (!alive || error || !data) return;
        setPrefijosRestringidos(new Map((data as { prefijo: string; nota: string | null }[]).map((r) => [r.prefijo, r.nota])));
      } catch {
        // degradado silencioso: sin conexión / RLS / catálogo no desplegado aún
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const notaPrefijoRestringido = (numero: string): string | null | undefined =>
    prefijosRestringidos.get(numero.slice(0, 4));
  const esPrefijoRestringido = (numero: string): boolean => prefijosRestringidos.has(numero.slice(0, 4));

  // Confirmación explícita (B6): filas pendientes de confirmar antes de disparar la RPC.
  const [confirmPrefijos, setConfirmPrefijos] = useState<Row[] | null>(null);

  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // resultado fila-por-fila del último envío + contador de creadas (para el aviso de
  // "orden vacía" — null = todavía no se envió nada en esta sesión).
  const [ultimoResultado, setUltimoResultado] = useState<{ resultados: ResultadoFila[] | null; creadas: number } | null>(
    null,
  );

  const onPasteChange = (text: string) => {
    setPasteText(text);
    const parsed = parsearListaContenedores(text);
    setRows(parsed.map((p) => ({ numero: p.numero, error: p.error, tipo: tipoOverrides[p.numero] ?? TIPO_DEFAULT })));
  };

  const setTipoFila = (numero: string, tipo: Tipo) => {
    setRows((rs) => rs.map((r) => (r.numero === numero ? { ...r, tipo } : r)));
    setTipoOverrides((o) => ({ ...o, [numero]: tipo }));
  };

  const quitar = (numero: string) => {
    const next = rows.filter((r) => r.numero !== numero);
    setRows(next);
    setPasteText(next.map((r) => r.numero).join("\n"));
  };

  const plantaName = useMemo(
    () => plantas.find((p) => p.id === plantaDestino)?.nombre ?? null,
    [plantas, plantaDestino],
  );

  const headerErrors = {
    numeroOrden: numeroOrden.trim() === "" ? "indicá el número de orden" : null,
    naviera: navieraId === "" ? "elegí la naviera" : null,
    fechaArribo: fechaArribo === "" ? "indicá la fecha de arribo" : null,
    plantaDestino: plantaDestino === "" ? "elegí la planta destino" : null,
  };
  const headerComplete = Object.values(headerErrors).every((e) => e === null);

  const invalidCount = rows.filter((r) => r.error !== null).length;
  const operadorSinPlanta = isOperador && (perfil.planta_asignada_id === null || perfil.planta_asignada_id === "");

  const submitDisabled = sending || rows.length === 0 || invalidCount > 0 || operadorSinPlanta;

  const restringidosEnOrden = rows.filter((r) => esPrefijoRestringido(r.numero));

  const attemptSubmit = () => {
    if (sending) return;
    setAttempted(true);
    setSubmitError(null);
    setUltimoResultado(null);
    if (!headerComplete || rows.length === 0 || invalidCount > 0 || operadorSinPlanta) return;
    if (restringidosEnOrden.length > 0) {
      setConfirmPrefijos(restringidosEnOrden);
      return;
    }
    void doSubmit();
  };

  const doSubmit = async () => {
    if (sending) return;
    setSending(true);
    const p = {
      header: {
        numero_orden: numeroOrden.trim(),
        naviera_id: navieraId,
        ...(bookingBl.trim() ? { booking_bl: bookingBl.trim() } : {}),
        ...(buque.trim() ? { buque: buque.trim() } : {}),
        // timestamptz AR fijo (UTC-3, sin DST) — nunca new Date(str) suelto.
        fecha_arribo_terminal: `${fechaArribo}T00:00:00-03:00`,
        planta_destino_id: plantaDestino,
      },
      contenedores: rows.map((r) => ({ numero: r.numero, tipo: r.tipo })),
    };

    const { data, error } = await getSupabase().rpc("crm_crear_orden_impo", { p });
    setSending(false);
    setConfirmPrefijos(null);
    if (error) {
      // literal: "numero_orden_duplicado: ya existe una orden..." es información útil
      setSubmitError(error.message);
      return;
    }
    const respuesta = data as {
      orden_id?: string;
      creadas?: number;
      rechazadas?: number;
      resultados?: ResultadoFila[];
      prefijos_restringidos_detectados?: number;
    } | null;
    const creadas = respuesta?.creadas ?? rows.length;
    const rechazadas = respuesta?.rechazadas ?? 0;
    const prefijosDetectados = respuesta?.prefijos_restringidos_detectados ?? 0;
    const resultados = Array.isArray(respuesta?.resultados) ? respuesta.resultados : null;

    setUltimoResultado({ resultados, creadas });

    if (resultados) {
      // fila-por-fila: el textarea/tabla quedan SOLO con los rechazados, listos para
      // corregir y reintentar de una (mismo patrón que la tanda de retiro).
      const pendientes = resultados
        .filter((r) => r.estado === "rechazado")
        .map((r) => ({ numero: r.numero, error: null, tipo: tipoOverrides[r.numero] ?? TIPO_DEFAULT }) satisfies Row);
      setRows(pendientes);
      setPasteText(pendientes.map((r) => r.numero).join("\n"));
    } else {
      setRows([]);
      setPasteText("");
    }
    setTipoOverrides({});
    setAttempted(false);
    // el número de orden ya quedó tomado (único) — se limpia siempre, incluso si la
    // orden nació vacía, porque reintentar con el MISMO número vuelve a chocar contra
    // el UNIQUE de numero_orden.
    setNumeroOrden("");

    const detalleExtra =
      prefijosDetectados > 0
        ? ` · ${prefijosDetectados} con prefijo restringido — incidencia automática registrada.`
        : "";

    if (creadas === 0) {
      // Aviso destacado (§6.4): la orden nació SIN contenedores — comportamiento espejo
      // de la tanda de retiro (§4). Se queda como FormAlert persistente además del toast,
      // porque el toast desaparece solo y esto necesita quedar visible mientras el
      // operador corrige.
      toast({
        type: "error",
        title: "Orden creada sin contenedores",
        detail: "Reintentá con contenedores válidos o pedile al supervisor que la revise.",
      });
    } else if (rechazadas > 0) {
      toast({
        type: "info",
        title: `${creadas} creada${creadas === 1 ? "" : "s"} · ${rechazadas} rechazada${rechazadas === 1 ? "" : "s"}`,
        detail: `Revisá el detalle fila por fila debajo de la tabla.${detalleExtra}`,
      });
    } else {
      toast({
        type: "exito",
        title: `${creadas} operación${creadas === 1 ? "" : "es"} de importación creada${creadas === 1 ? "" : "s"}`,
        detail: `Quedan en «en terminal», pendientes de retiro.${detalleExtra}`,
      });
    }
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
      key: "tipo",
      header: "tipo",
      width: "130px",
      render: (r) => (
        <Select value={r.tipo} onChange={(e) => setTipoFila(r.numero, e.target.value as Tipo)} aria-label={`tipo ${r.numero}`}>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
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

  const rowValidation = (r: Row): RowValidation | null => {
    if (r.error) return { type: "error", message: `${r.numero}: ${r.error}` };
    if (esPrefijoRestringido(r.numero)) {
      const nota = notaPrefijoRestringido(r.numero);
      return {
        type: "warning",
        message: `Prefijo restringido por Dow container screen${nota ? ` — ${nota}` : ""}. El contenedor puede enviarse igual: se va a registrar una incidencia automática.`,
      };
    }
    return null;
  };

  if (maestrosError) {
    return (
      <div style={CARD}>
        <ErrorState title="No se pudieron cargar navieras y plantas" detail={maestrosError} onRetry={onRetryMaestros} />
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
      {/* ---- encabezado (una vez por orden — arribo común, mismo buque) ---- */}
      <SectionLabel>
        <i className="ti ti-file-description" aria-hidden />
        Encabezado de la orden
      </SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        <Field
          label="número de orden"
          htmlFor="orden-numero"
          error={attempted ? headerErrors.numeroOrden : null}
          help={<FieldHelp fieldKey="importacion.numero_orden" />}
        >
          <Input
            id="orden-numero"
            value={numeroOrden}
            error={attempted ? headerErrors.numeroOrden : null}
            placeholder="ej. IMP-2026-0451"
            onChange={(e) => setNumeroOrden(e.target.value)}
          />
        </Field>

        <Field
          label="naviera"
          htmlFor="orden-naviera"
          error={attempted ? headerErrors.naviera : null}
          help={<FieldHelp fieldKey="importacion.naviera" />}
        >
          <ComboboxCreatable
            id="orden-naviera"
            options={navieras.map((n) => ({ id: n.id, label: n.nombre }))}
            value={navieraId}
            onChange={setNavieraId}
            error={attempted ? headerErrors.naviera : null}
            placeholder="— elegí la naviera —"
          />
        </Field>

        <Field label="booking / BL" htmlFor="orden-booking" hint="opcional">
          <Input id="orden-booking" value={bookingBl} placeholder="opcional" onChange={(e) => setBookingBl(e.target.value)} />
        </Field>

        <Field label="buque" htmlFor="orden-buque" hint="opcional">
          <Input id="orden-buque" value={buque} placeholder="opcional" onChange={(e) => setBuque(e.target.value)} />
        </Field>

        <Field
          label="fecha de arribo a terminal"
          htmlFor="orden-fecha-arribo"
          error={attempted ? headerErrors.fechaArribo : null}
          help={<FieldHelp fieldKey="importacion.fecha_arribo" />}
        >
          <DateField
            id="orden-fecha-arribo"
            value={fechaArribo}
            error={attempted ? headerErrors.fechaArribo : null}
            onChange={(e) => setFechaArribo(e.target.value)}
          />
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
            htmlFor="orden-planta"
            error={attempted ? headerErrors.plantaDestino : null}
            help={<FieldHelp fieldKey="importacion.planta_destino" />}
          >
            <ComboboxCreatable
              id="orden-planta"
              options={plantas.map((p) => ({ id: p.id, label: `${p.nombre}${p.codigo ? ` (${p.codigo})` : ""}` }))}
              value={plantaSel}
              onChange={setPlantaSel}
              error={attempted ? headerErrors.plantaDestino : null}
              placeholder="— elegí la planta —"
            />
          </Field>
        )}
      </div>

      {operadorSinPlanta && (
        <FormAlert>
          Tu usuario no tiene una planta asignada, así que no podés crear órdenes. Pedí a un administrador que te asigne
          una planta.
        </FormAlert>
      )}

      {/* ---- pegado de contenedores ---- */}
      <SectionLabel>
        <i className="ti ti-clipboard-list" aria-hidden />
        Contenedores de la orden
      </SectionLabel>
      <Field
        label="pegá los números (uno por línea, o separados por coma)"
        htmlFor="orden-paste"
        hint="se validan con el dígito verificador ISO 6346; los repetidos se ignoran"
      >
        <Textarea
          id="orden-paste"
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
            Pegá arriba los números de contenedor de esta orden (uno por línea, hasta 4 por arribo). Cada uno aparece acá
            con su validación ISO 6346 y el tipo por defecto (40HC, editable); los números con dígito verificador
            incorrecto se marcan en rojo para que los corrijas o los quites antes de enviar.
          </EmptyState>
        }
      />

      {/* ---- resultado fila-por-fila del último envío ---- */}
      {ultimoResultado?.resultados && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SectionLabel>
            <i className="ti ti-list-check" aria-hidden />
            Resultado del último envío
          </SectionLabel>
          {ultimoResultado.creadas === 0 && (
            <FormAlert>
              <strong>Orden creada sin contenedores.</strong> Quedó registrada en el sistema pero sin ningún ciclo de
              importación abierto — reintentá con contenedores válidos o pedile al supervisor que la revise.
            </FormAlert>
          )}
          {ultimoResultado.resultados.map((r) => (
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
              {r.prefijo_restringido && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    marginLeft: "auto",
                    color: "var(--color-status-amber)",
                    fontSize: 11,
                  }}
                >
                  <i className="ti ti-alert-triangle" aria-hidden />
                  prefijo restringido
                </span>
              )}
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
          {restringidosEnOrden.length > 0 ? ` · ${restringidosEnOrden.length} con prefijo restringido` : ""}
        </span>
        <Button variant="primary" icon="ti-ship" loading={sending} disabled={submitDisabled} onClick={attemptSubmit}>
          Crear orden de importación
        </Button>
      </div>

      {/* Confirmación explícita de prefijos restringidos (B6) — NUNCA bloqueo duro. */}
      {confirmPrefijos && (
        <ConfirmDialog
          open
          loading={sending}
          title="Contenedores con prefijo restringido"
          confirmLabel="Continuar de todos modos"
          cancelLabel="Revisar"
          message={
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <FormAlert tone="warning">
                {confirmPrefijos.length} contenedor{confirmPrefijos.length === 1 ? "" : "es"} tiene
                {confirmPrefijos.length === 1 ? "" : "n"} prefijo restringido por el container screen de Dow. Si
                continuás, se registra una incidencia automática por cada uno.
              </FormAlert>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                {confirmPrefijos.map((r) => {
                  const nota = notaPrefijoRestringido(r.numero);
                  return (
                    <div key={r.numero} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <ContainerNumber value={r.numero} />
                      {nota && <span style={{ fontSize: 11, color: "var(--color-text-faint)" }}>{nota}</span>}
                    </div>
                  );
                })}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>¿Continuar?</p>
            </div>
          }
          onConfirm={() => void doSubmit()}
          onCancel={() => setConfirmPrefijos(null)}
        />
      )}
    </div>
  );
}
