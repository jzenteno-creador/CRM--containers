"use client";

// Prefijos restringidos (B6, migración 031 — "Dow container screen"): Dow publica una
// lista de prefijos de 4 letras que NO deben usarse (armadores sancionados). Omar
// (supervisor) la actualiza ~julio y diciembre desde la intranet de Dow. Esta solapa
// tiene DOS secciones:
//
//   A) Stock en infracción (crm.vista_stock_prefijos_restringidos) — EL BARRIDO
//      RETROACTIVO: contenedores YA cargados en el sistema cuyo prefijo pasó a
//      restringido DESPUÉS de su alta (nadie lo veía entre julio y diciembre). La view
//      es derivada, siempre actual — sin snapshot que se pudra. SELECT libre.
//   B) Lista de prefijos (crm.prefijos_restringidos) — catálogo administrable. Escritura
//      DIRECTA sancionada (AGENTS.md B6, migración 031): INSERT/UPDATE permitidos SOLO
//      sobre esta tabla; RLS ya exige supervisor+ (decisión explícita de John: la opera
//      Omar, que es supervisor, no admin). La UI gatea los botones de escritura por rol
//      SOLO para evitar frustración — el gate real es la RLS.
//
// La validación al pegar contenedores (warning + confirmación) vive en tanda-form.tsx
// (/ingreso). El registro de la incidencia automática vive en crm_crear_tanda_retiro
// (031) — acá no se calcula ni se registra nada, solo se lee y se administra el catálogo.
// Patrón de página del repo (espejo de /alertas + /admin/depositos): load() por sección,
// refetch al recuperar foco, 4 estados por sección, modal de alta/edición.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { ContainerNumber } from "@/components/container-number";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { Field, Input, Select, Textarea, Toggle } from "@/components/fd/fields";
import { FormAlert } from "@/components/fd/form-alert";
import { Modal } from "@/components/fd/modal";
import { PageHeader } from "@/components/fd/page-header";
import { useToast } from "@/components/fd/toast";
import { fmtFecha } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { EstadoCargaBadge, EstadoOperacionBadge } from "../contenedores/estado-operacion";

/* ─────────────────────────── tipos ─────────────────────────── */

// Espejo de crm.vista_stock_prefijos_restringidos (031): la view ya filtra activo=true
// y estado NOT IN ('cerrado','anulada') — acá no se re-filtra nada.
type StockRow = {
  operacion_id: string;
  numero_contenedor: string;
  prefijo: string;
  nota_prefijo: string | null;
  naviera: string | null;
  planta: string | null;
  estado: string;
  estado_carga: string;
  fecha_retiro: string;
};

// Espejo de crm.prefijos_restringidos.
type PrefijoRow = {
  id: string;
  prefijo: string;
  activo: boolean;
  nota: string | null;
  created_at: string;
  updated_at: string;
};

/* ─────────────────────────── helpers de presentación ─────────────────────────── */

/** Nota truncada en una línea, con el texto completo en el tooltip nativo (title). */
function NotaTruncada({ nota }: { nota: string | null }) {
  if (!nota) return <span style={{ color: "var(--color-text-faint)" }}>—</span>;
  return (
    <span
      title={nota}
      style={{
        display: "inline-block",
        maxWidth: 260,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        verticalAlign: "bottom",
        color: "var(--color-text-secondary)",
      }}
    >
      {nota}
    </span>
  );
}

const PREFIJO_RE = /^[A-Z]{4}$/;

/* ─────────────────────────── modal de alta / edición ─────────────────────────── */
// Alta: prefijo (4 letras, auto-upper, validación en vivo) + nota. Edición: SOLO nota +
// toggle activo (el prefijo es la identidad del registro — no se edita; si vuelve a
// restringirse tras una baja, se reactiva la fila existente, nunca se duplica).

function PrefijoModal({
  target,
  onClose,
  onDone,
}: {
  /** null = alta; con fila = edición. */
  target: PrefijoRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [prefijo, setPrefijo] = useState(target?.prefijo ?? "");
  const [nota, setNota] = useState(target?.nota ?? "");
  const [activo, setActivo] = useState(target?.activo ?? true);
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const prefijoError = attempted && !PREFIJO_RE.test(prefijo) ? "el prefijo debe tener exactamente 4 letras" : null;
  const valid = target ? true : PREFIJO_RE.test(prefijo);

  const submit = async () => {
    setAttempted(true);
    setSubmitError(null);
    if (!valid || sending) return;
    setSending(true);
    const supabase = getSupabase();
    const notaVal = nota.trim() === "" ? null : nota.trim();
    // Escritura DIRECTA sancionada (AGENTS.md B6, migración 031) — SOLO sobre
    // crm.prefijos_restringidos, detrás de la RLS supervisor+.
    const { data, error } = target
      ? await supabase.from("prefijos_restringidos").update({ nota: notaVal, activo }).eq("id", target.id).select("id")
      : await supabase.from("prefijos_restringidos").insert({ prefijo, nota: notaVal }).select("id");
    setSending(false);
    if (error) {
      // literal: "duplicate key value violates unique constraint..." si ya existe, etc.
      setSubmitError(error.message);
      return;
    }
    if ((data?.length ?? 0) === 0) {
      setSubmitError(
        "La base de datos no aceptó el cambio — verificá que tu cuenta siga siendo supervisor o administrador activo.",
      );
      return;
    }
    toast({
      type: "exito",
      title: target ? "Prefijo actualizado" : "Prefijo agregado a la lista restringida",
      detail: target ? `${target.prefijo}${activo ? "" : " · desactivado"}` : `${prefijo} ya está restringido.`,
    });
    onDone();
  };

  return (
    <Modal
      open
      onClose={sending ? () => {} : onClose}
      title={target ? `Editar prefijo «${target.prefijo}»` : "Nuevo prefijo restringido"}
      width={440}
      closeOnBackdrop={!sending}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {target ? (
          <Field label="prefijo" hint="no se edita — es la identidad del registro">
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
              {target.prefijo}
            </div>
          </Field>
        ) : (
          <Field
            label="prefijo (4 letras)"
            htmlFor="prefijo-codigo"
            error={prefijoError}
            hint="ej: MSKU — sin dígito verificador, no es un número de contenedor completo"
          >
            <Input
              id="prefijo-codigo"
              value={prefijo}
              error={prefijoError}
              maxLength={4}
              placeholder="AAAA"
              className="mono"
              onChange={(e) => setPrefijo(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
            />
          </Field>
        )}
        <Field label="nota" htmlFor="prefijo-nota" hint="fuente o motivo — ej: armador / referencia del container screen de Dow">
          <Textarea id="prefijo-nota" rows={3} value={nota} onChange={(e) => setNota(e.target.value)} />
        </Field>
        {target && (
          <Toggle
            id="prefijo-activo"
            checked={activo}
            onChange={setActivo}
            label={
              <span>
                activo
                <span style={{ display: "block", fontSize: 11, color: "var(--color-text-faint)" }}>
                  apagalo para sacarlo de la lista vigente — no borra el histórico ni afecta lo ya detectado
                </span>
              </span>
            }
          />
        )}
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
            {target ? "Guardar cambios" : "Agregar prefijo"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────────────── página ─────────────────────────── */

export default function PrefijosPage() {
  const router = useRouter();
  const { perfil } = useSession();
  const canWrite = perfil?.rol === "supervisor" || perfil?.rol === "administrador";

  /* ---- sección A: stock en infracción (el barrido retroactivo) ---- */
  const [stockRows, setStockRows] = useState<StockRow[] | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const stockLoading = stockRows === null && !stockError;

  const loadStock = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("vista_stock_prefijos_restringidos")
      .select("operacion_id, numero_contenedor, prefijo, nota_prefijo, naviera, planta, estado, estado_carga, fecha_retiro")
      .order("fecha_retiro", { ascending: false });
    if (error) {
      setStockRows(null);
      setStockError(error.message);
      return;
    }
    setStockError(null);
    setStockRows(data as StockRow[]);
  }, []);

  /* ---- sección B: catálogo de prefijos ---- */
  const [prefRows, setPrefRows] = useState<PrefijoRow[] | null>(null);
  const [prefError, setPrefError] = useState<string | null>(null);
  const prefLoading = prefRows === null && !prefError;
  const [busqueda, setBusqueda] = useState("");
  const [filtroActivo, setFiltroActivo] = useState<"activos" | "todos">("activos");
  const [modal, setModal] = useState<{ open: boolean; target: PrefijoRow | null }>({ open: false, target: null });

  const loadPref = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("prefijos_restringidos")
      .select("id, prefijo, activo, nota, created_at, updated_at")
      .order("activo", { ascending: false })
      .order("prefijo", { ascending: true });
    if (error) {
      setPrefRows(null);
      setPrefError(error.message);
      return;
    }
    setPrefError(null);
    setPrefRows(data as PrefijoRow[]);
  }, []);

  useEffect(() => {
    void (async () => {
      await Promise.all([loadStock(), loadPref()]);
    })();
  }, [loadStock, loadPref]);

  // refetch al recuperar foco (mismo criterio que /alertas, /bookings, /contenedores)
  useEffect(() => {
    const onFocus = () => {
      void loadStock();
      void loadPref();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadStock, loadPref]);

  // Click en una fila del stock en infracción → ficha del contenedor. La view no trae
  // contenedor_id (solo numero_contenedor); se resuelve con un SELECT puntual sobre el
  // maestro (lectura abierta a cualquier activo, contenedores_select §14.4) — si falla o
  // no encuentra nada, simplemente no navega (silencioso, no hay a dónde ir).
  const goToContenedor = async (numero: string) => {
    const { data, error } = await getSupabase()
      .from("contenedores")
      .select("id")
      .eq("numero_contenedor", numero)
      .maybeSingle();
    if (error || !data) return;
    router.push(`/contenedores/${data.id}`);
  };

  const stockCols: Column<StockRow>[] = [
    {
      key: "contenedor",
      header: "contenedor",
      render: (r) => <ContainerNumber value={r.numero_contenedor} />,
      sortValue: (r) => r.numero_contenedor,
      width: "140px",
    },
    {
      key: "prefijo",
      header: "prefijo",
      render: (r) => <span className="mono">{r.prefijo}</span>,
      sortValue: (r) => r.prefijo,
      width: "80px",
    },
    { key: "nota", header: "nota", render: (r) => <NotaTruncada nota={r.nota_prefijo} />, hideOnMobile: true },
    { key: "naviera", header: "naviera", render: (r) => r.naviera ?? "—", sortValue: (r) => r.naviera },
    { key: "planta", header: "planta", render: (r) => r.planta ?? "—", sortValue: (r) => r.planta, hideOnMobile: true },
    {
      key: "estado",
      header: "estado",
      render: (r) => <EstadoOperacionBadge estado={r.estado} />,
      sortValue: (r) => r.estado,
    },
    {
      key: "carga",
      header: "carga",
      render: (r) => <EstadoCargaBadge estadoCarga={r.estado_carga} />,
      sortValue: (r) => r.estado_carga,
      hideOnMobile: true,
    },
    {
      key: "fecha_retiro",
      header: "fecha retiro",
      numeric: true,
      render: (r) => fmtFecha(r.fecha_retiro),
      sortValue: (r) => r.fecha_retiro,
    },
  ];

  const prefCols: Column<PrefijoRow>[] = [
    {
      key: "prefijo",
      header: "prefijo",
      render: (r) => (
        <span className="mono" style={{ fontWeight: 600, color: r.activo ? "var(--color-text-primary)" : "var(--color-text-faint)" }}>
          {r.prefijo}
        </span>
      ),
      sortValue: (r) => r.prefijo,
      width: "110px",
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
      width: "100px",
    },
    { key: "nota", header: "nota", render: (r) => <NotaTruncada nota={r.nota} /> },
    {
      key: "actualizado",
      header: "actualizado",
      numeric: true,
      render: (r) => fmtFecha(r.updated_at),
      sortValue: (r) => r.updated_at,
      hideOnMobile: true,
      width: "110px",
    },
    {
      key: "acciones",
      header: "",
      align: "right",
      render: (r) =>
        canWrite ? (
          <Button
            variant="ghost"
            icon="ti-pencil"
            style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}
            onClick={() => setModal({ open: true, target: r })}
          >
            Editar
          </Button>
        ) : null,
    },
  ];

  const q = busqueda.trim().toUpperCase();
  const visiblesPref = (prefRows ?? [])
    .filter((r) => (filtroActivo === "activos" ? r.activo : true))
    .filter((r) => (q === "" ? true : r.prefijo.includes(q)));

  const activosCount = (prefRows ?? []).filter((r) => r.activo).length;

  return (
    <>
      <PageHeader
        title="Prefijos restringidos"
        counters={
          <>
            {prefRows !== null && (
              <Badge tone="neutro" mono icon="ti-forbid-2">
                {activosCount} activo{activosCount === 1 ? "" : "s"}
              </Badge>
            )}
            {stockRows !== null && stockRows.length > 0 && (
              <Badge tone="rojo" mono icon="ti-alert-triangle">
                {stockRows.length} en infracción
              </Badge>
            )}
          </>
        }
        action={
          canWrite ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <Button variant="primary" icon="ti-plus" onClick={() => setModal({ open: true, target: null })}>
                Nuevo prefijo
              </Button>
              <span style={{ fontSize: 10.5, color: "var(--color-text-faint)", textAlign: "right", maxWidth: 260, lineHeight: 1.4 }}>
                La lista completa se actualiza desde el container screen de Dow (julio y diciembre).
              </span>
            </div>
          ) : undefined
        }
      />

      {/* ═══ Sección A — Stock en infracción (el barrido) ═══ */}
      <section style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
          <span className="fd-display fd-display-sm" style={{ color: "var(--color-text-secondary)" }}>
            <i className="ti ti-forbid-2" aria-hidden style={{ marginRight: 6, color: "var(--color-accent-500)" }} />
            Stock en infracción
          </span>
          {stockRows !== null && (
            <span className="mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {stockRows.length}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <Button variant="ghost" icon="ti-refresh" onClick={() => void loadStock()} disabled={stockLoading}>
            Re-verificar
          </Button>
        </div>

        {stockError ? (
          <div className="fd-panel">
            <ErrorState title="No se pudo verificar el stock" detail={stockError} onRetry={() => void loadStock()} />
          </div>
        ) : stockLoading ? (
          <DataTable columns={stockCols} rows={[]} rowKey={() => ""} loading skeletonRows={4} maxHeight={280} />
        ) : stockRows!.length === 0 ? (
          <div
            className="fd-panel"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 16px",
              color: "var(--color-status-green)",
              fontSize: 12.5,
            }}
          >
            <i className="ti ti-circle-check" aria-hidden style={{ fontSize: 18, flexShrink: 0 }} />
            Sin infracciones en el stock actual — ningún contenedor con ciclo abierto tiene hoy un prefijo restringido
            por Dow.
          </div>
        ) : (
          <>
            <FormAlert tone="error">
              <strong>{stockRows!.length}</strong> contenedor{stockRows!.length === 1 ? "" : "es"} en el sistema con
              prefijo hoy restringido por Dow — cada uno ya tiene una incidencia automática registrada. Coordiná su
              salida cuanto antes.
            </FormAlert>
            <div style={{ marginTop: 10 }}>
              <DataTable
                columns={stockCols}
                rows={stockRows!}
                rowKey={(r) => r.operacion_id}
                semaforo={() => "rojo"}
                maxHeight={360}
                onRowClick={(r) => void goToContenedor(r.numero_contenedor)}
              />
            </div>
          </>
        )}
      </section>

      {/* ═══ Sección B — Lista de prefijos ═══ */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
          <span className="fd-display fd-display-sm" style={{ color: "var(--color-text-secondary)" }}>
            <i className="ti ti-list-check" aria-hidden style={{ marginRight: 6, color: "var(--color-accent-500)" }} />
            Lista de prefijos
          </span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginBottom: 12 }}>
          <Field label="buscar por prefijo" htmlFor="pref-busqueda">
            <Input
              id="pref-busqueda"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="MSKU…"
              className="mono"
              style={{ minWidth: 180 }}
            />
          </Field>
          <Field label="estado" htmlFor="pref-filtro">
            <Select
              id="pref-filtro"
              value={filtroActivo}
              onChange={(e) => setFiltroActivo(e.target.value as "activos" | "todos")}
              style={{ minWidth: 160 }}
            >
              <option value="activos">Solo activos</option>
              <option value="todos">Todos</option>
            </Select>
          </Field>
        </div>

        <DataTable
          columns={prefCols}
          rows={visiblesPref}
          rowKey={(r) => r.id}
          loading={prefLoading}
          skeletonRows={5}
          pageSize={20}
          defaultSort={{ key: "prefijo", dir: "asc" }}
          errorState={
            prefError ? (
              <ErrorState title="No se pudo cargar la lista de prefijos" detail={prefError} onRetry={() => void loadPref()} />
            ) : undefined
          }
          emptyState={
            (prefRows?.length ?? 0) > 0 ? (
              <EmptyState icon="ti-filter" title="Sin prefijos con este filtro">
                Hay {prefRows!.length} prefijo{prefRows!.length === 1 ? "" : "s"} cargados, pero ninguno coincide con la
                búsqueda o el filtro actual.
              </EmptyState>
            ) : (
              <EmptyState icon="ti-forbid-2" title="Todavía no hay prefijos restringidos cargados">
                Acá se administra el container screen de Dow: prefijos de 4 letras que no deben usarse. Cargá el
                primero con «Nuevo prefijo», o pedile la lista a Omar (la actualiza desde la intranet de Dow ~julio y
                diciembre). Apenas un prefijo entra a la lista, cualquier contenedor del stock que lo use aparece en
                «Stock en infracción» arriba, sin esperar a un ciclo nuevo.
              </EmptyState>
            )
          }
        />
      </section>

      {modal.open && (
        <PrefijoModal
          target={modal.target}
          onClose={() => setModal({ open: false, target: null })}
          onDone={() => {
            setModal({ open: false, target: null });
            void loadPref();
          }}
        />
      )}
    </>
  );
}
