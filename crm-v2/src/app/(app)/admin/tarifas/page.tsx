"use client";

// Admin → Tarifas de freetime (M9): versionado por naviera.
// freetime_origin es SOLO SELECT por RLS (verificado en vivo, plan-m9): el front
// JAMÁS hace INSERT/UPDATE — toda escritura pasa por la RPC crm_nueva_version_freetime
// [SECURITY DEFINER, solo admin activo], que valida, cierra la versión vigente
// (vigente_hasta = desde − 1) e inserta la nueva. Sus errores P0001 van LITERALES
// al FormAlert del modal. Caso idempotente (misma versión → devuelve el id vigente
// sin tocar nada): NO es error → toast informativo.
// p_desde es DATE: viaja como "YYYY-MM-DD" plano, SIN sufijo de timezone.
// Guard admin (patrón solicitudes §14.7): skeleton + redirect; el enforcement es la RPC.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { DateField, Field, Input, Select, Toggle } from "@/components/fd/fields";
import { FormAlert } from "@/components/fd/form-alert";
import { Modal } from "@/components/fd/modal";
import { PageHeader } from "@/components/fd/page-header";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { useToast } from "@/components/fd/toast";
import { fmtFechaDia, fmtUSDTarifa, hoyAR } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

type Naviera = { id: string; nombre: string };

type TarifaRow = {
  id: string;
  regimen: string;
  dias_libres: number;
  aplica_carga_peligrosa: boolean;
  tipo: string;
  tarifa_usd_dia: number;
  vigente_desde: string;
  vigente_hasta: string | null;
};

// espeja el CHECK de la RPC (regimen ∈ {vacios, cargados, sin_uso})
const REGIMEN_LABELS: Record<string, string> = {
  vacios: "vacíos",
  cargados: "cargados",
  sin_uso: "sin uso",
};

// espeja el CHECK de la RPC (tipo ∈ {Detention, Demurrage, Combined} — vocabulario naviero)
const TIPOS = ["Detention", "Demurrage", "Combined"] as const;

function SectionTitle({ title, count }: { title: string; count: number | null }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "20px 0 10px" }}>
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

/* ---------- card de versión vigente (una por régimen con vigencia abierta) ---------- */

function VigenteStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 96 }}>
      <span className="fd-label">{label}</span>
      <span className="mono" style={{ fontSize: 15, color: "var(--color-text-primary)" }}>
        {children}
      </span>
    </div>
  );
}

function VigenteCard({ tarifa }: { tarifa: TarifaRow }) {
  return (
    <div className="fd-panel">
      <div className="fd-panel-title">
        <i className="ti ti-receipt-2" aria-hidden style={{ color: "var(--color-accent-500)" }} />
        <span>versión vigente · régimen {REGIMEN_LABELS[tarifa.regimen] ?? tarifa.regimen}</span>
        <span className="fd-count">desde {fmtFechaDia(tarifa.vigente_desde)}</span>
      </div>
      <div
        className="fd-panel-body"
        style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "14px 28px" }}
      >
        <VigenteStat label="días libres">{tarifa.dias_libres}</VigenteStat>
        <VigenteStat label="tarifa">{fmtUSDTarifa(tarifa.tarifa_usd_dia)}/día</VigenteStat>
        <VigenteStat label="tipo">{tarifa.tipo}</VigenteStat>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span className="fd-label">carga peligrosa</span>
          {tarifa.aplica_carga_peligrosa ? (
            <Badge tone="amarillo" icon="ti-alert-triangle">
              aplica
            </Badge>
          ) : (
            <Badge tone="neutro">no aplica</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- modal Nueva versión → RPC crm_nueva_version_freetime ---------- */

function NuevaVersionModal({
  naviera,
  vigentes,
  onClose,
  onDone,
}: {
  naviera: Naviera;
  /** Versiones con vigente_hasta null (una por régimen), para prefill + detección de idempotencia. */
  vigentes: TarifaRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const initial = vigentes.find((v) => v.regimen === "vacios") ?? null;

  const [regimen, setRegimen] = useState("vacios");
  const [dias, setDias] = useState(initial ? String(initial.dias_libres) : "");
  const [tarifa, setTarifa] = useState(initial ? String(initial.tarifa_usd_dia) : "");
  const [tipo, setTipo] = useState(initial?.tipo ?? "Detention");
  const [peligrosa, setPeligrosa] = useState(initial?.aplica_carga_peligrosa ?? false);
  const [desde, setDesde] = useState(hoyAR());
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const vigente = vigentes.find((v) => v.regimen === regimen) ?? null;

  // al cambiar de régimen se precarga la versión vigente de ESE régimen (si existe)
  const applyRegimen = (r: string) => {
    setRegimen(r);
    setSubmitError(null);
    const vig = vigentes.find((v) => v.regimen === r);
    if (vig) {
      setDias(String(vig.dias_libres));
      setTarifa(String(vig.tarifa_usd_dia));
      setTipo(vig.tipo);
      setPeligrosa(vig.aplica_carga_peligrosa);
    }
  };

  const diasNum = Number(dias);
  const tarifaNum = Number(tarifa);
  // validación EN VIVO: el error aparece apenas el valor es inválido; el vacío recién al intentar
  const diasError =
    dias.trim() !== "" && (!Number.isInteger(diasNum) || diasNum < 0)
      ? "días libres inválidos (entero ≥ 0)"
      : attempted && dias.trim() === ""
        ? "indicá los días libres"
        : null;
  const tarifaError =
    tarifa.trim() !== "" && (Number.isNaN(tarifaNum) || tarifaNum < 0)
      ? "tarifa inválida (número ≥ 0)"
      : attempted && tarifa.trim() === ""
        ? "indicá la tarifa"
        : null;
  const desdeError = attempted && desde === "" ? "indicá la fecha de vigencia" : null;
  const valid =
    dias.trim() !== "" &&
    Number.isInteger(diasNum) &&
    diasNum >= 0 &&
    tarifa.trim() !== "" &&
    !Number.isNaN(tarifaNum) &&
    tarifaNum >= 0 &&
    desde !== "";

  const submit = async () => {
    setAttempted(true);
    setSubmitError(null);
    if (!valid || sending) return;
    setSending(true);
    // p_desde: DATE plano "YYYY-MM-DD" — sin sufijo de timezone
    const { data, error } = await getSupabase().rpc("crm_nueva_version_freetime", {
      p_naviera: naviera.id,
      p_dias: diasNum,
      p_peligrosa: peligrosa,
      p_tipo: tipo,
      p_tarifa: tarifaNum,
      p_desde: desde,
      p_regimen: regimen,
    });
    setSending(false);
    if (error) {
      // errores P0001 LITERALES (incluye "la vigencia nueva (…) debe ser posterior…" y el de rol)
      setSubmitError(error.message);
      return;
    }
    const newId = data as string | null;
    if (vigente && newId === vigente.id) {
      // idempotencia de la RPC: misma versión → devuelve el id vigente sin tocar nada. NO es error.
      toast({
        type: "info",
        title: "Sin cambios",
        detail: "La versión vigente ya tiene exactamente esos valores.",
      });
    } else {
      toast({
        type: "exito",
        title: "Nueva versión de tarifa registrada",
        detail: `${naviera.nombre} · régimen ${REGIMEN_LABELS[regimen] ?? regimen} · vigente desde ${fmtFechaDia(desde)}. La versión anterior quedó cerrada.`,
      });
    }
    onDone();
  };

  return (
    <Modal
      open
      onClose={sending ? () => {} : onClose}
      title="Nueva versión de tarifa"
      width={500}
      closeOnBackdrop={!sending}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
          Naviera: <strong>{naviera.nombre}</strong>
        </div>

        <Field
          label="régimen"
          htmlFor="tarifa-regimen"
          hint={vigente ? undefined : "este régimen todavía no tiene versión vigente — esta será la primera"}
        >
          <Select id="tarifa-regimen" value={regimen} onChange={(e) => applyRegimen(e.target.value)}>
            {Object.entries(REGIMEN_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <Field label="días libres" htmlFor="tarifa-dias" error={diasError}>
            <Input
              id="tarifa-dias"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="mono"
              value={dias}
              error={diasError}
              onChange={(e) => setDias(e.target.value)}
            />
          </Field>
          <Field label="tarifa (USD/día)" htmlFor="tarifa-usd" error={tarifaError}>
            <Input
              id="tarifa-usd"
              type="number"
              min={0}
              step={0.01}
              inputMode="decimal"
              className="mono"
              value={tarifa}
              error={tarifaError}
              onChange={(e) => setTarifa(e.target.value)}
            />
          </Field>
        </div>

        <Field label="tipo" htmlFor="tarifa-tipo">
          <Select id="tarifa-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Toggle
          id="tarifa-peligrosa"
          checked={peligrosa}
          onChange={setPeligrosa}
          label="aplica a carga peligrosa"
        />

        <Field
          label="vigente desde"
          htmlFor="tarifa-desde"
          error={desdeError}
          hint={
            vigente
              ? `la versión vigente arranca el ${fmtFechaDia(vigente.vigente_desde)} — la nueva debe ser posterior`
              : undefined
          }
        >
          <DateField
            id="tarifa-desde"
            value={desde}
            error={desdeError}
            onChange={(e) => setDesde(e.target.value)}
            style={{ maxWidth: 200 }}
          />
        </Field>

        {submitError && <FormAlert>{submitError}</FormAlert>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon="ti-versions"
            loading={sending}
            disabled={!valid}
            onClick={() => void submit()}
          >
            Versionar tarifa
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- página ---------- */

export default function TarifasPage() {
  const router = useRouter();
  const { perfil } = useSession();

  const [navieras, setNavieras] = useState<Naviera[] | null>(null);
  const [navierasError, setNavierasError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [tarifas, setTarifas] = useState<TarifaRow[] | null>(null);
  const [tarifasError, setTarifasError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // evita aplicar una respuesta vieja si se cambia rápido de naviera;
  // se actualiza SOLO en selectNaviera (nunca durante el render — regla refs)
  const selectedRef = useRef("");

  const isAdmin = perfil?.rol === "administrador";

  useEffect(() => {
    if (perfil && !isAdmin) router.replace("/inicio");
  }, [perfil, isAdmin, router]);

  const loadNavieras = useCallback(async () => {
    const { data, error } = await getSupabase().from("navieras").select("id, nombre").order("nombre");
    if (error) {
      setNavieras(null);
      setNavierasError(error.message);
      return;
    }
    setNavierasError(null);
    setNavieras(data as Naviera[]);
  }, []);

  const loadTarifas = useCallback(async (navieraId: string) => {
    if (navieraId === "") {
      setTarifas(null);
      setTarifasError(null);
      return;
    }
    const { data, error } = await getSupabase()
      .from("freetime_origin")
      .select("id, regimen, dias_libres, aplica_carga_peligrosa, tipo, tarifa_usd_dia, vigente_desde, vigente_hasta")
      .eq("naviera_id", navieraId)
      .order("vigente_desde", { ascending: false });
    if (selectedRef.current !== navieraId) return; // respuesta vieja: se descartó la selección
    if (error) {
      setTarifas(null);
      setTarifasError(error.message);
      return;
    }
    setTarifasError(null);
    setTarifas(data as TarifaRow[]);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      await loadNavieras();
    })();
  }, [isAdmin, loadNavieras]);

  // refetch al recuperar foco (mismo criterio que solicitudes)
  useEffect(() => {
    if (!isAdmin) return;
    const onFocus = () => {
      void loadNavieras();
      if (selectedRef.current !== "") void loadTarifas(selectedRef.current);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isAdmin, loadNavieras, loadTarifas]);

  const selectNaviera = (id: string) => {
    setSelectedId(id);
    selectedRef.current = id;
    setTarifas(null);
    setTarifasError(null);
    void loadTarifas(id);
  };

  const selected = useMemo(() => (navieras ?? []).find((n) => n.id === selectedId) ?? null, [navieras, selectedId]);
  const vigentes = useMemo(() => (tarifas ?? []).filter((t) => t.vigente_hasta === null), [tarifas]);

  const loadingNavieras = navieras === null && !navierasError;
  const loadingTarifas = selectedId !== "" && tarifas === null && !tarifasError;

  const columns: Column<TarifaRow>[] = [
    {
      key: "vigencia",
      header: "vigencia",
      render: (r) =>
        r.vigente_hasta === null ? (
          <Badge tone="verde" icon="ti-circle-check">
            vigente desde {fmtFechaDia(r.vigente_desde)}
          </Badge>
        ) : (
          <span className="mono">
            {fmtFechaDia(r.vigente_desde)} → {fmtFechaDia(r.vigente_hasta)}
          </span>
        ),
      sortValue: (r) => r.vigente_desde,
    },
    {
      key: "regimen",
      header: "régimen",
      render: (r) => REGIMEN_LABELS[r.regimen] ?? r.regimen,
      sortValue: (r) => r.regimen,
      hideOnMobile: true,
    },
    {
      key: "dias",
      header: "días libres",
      numeric: true,
      render: (r) => r.dias_libres,
      sortValue: (r) => r.dias_libres,
    },
    {
      key: "tarifa",
      header: "USD/día",
      numeric: true,
      render: (r) => fmtUSDTarifa(r.tarifa_usd_dia),
      sortValue: (r) => r.tarifa_usd_dia,
    },
    {
      key: "tipo",
      header: "tipo",
      render: (r) => r.tipo,
      sortValue: (r) => r.tipo,
      hideOnMobile: true,
    },
    {
      key: "peligrosa",
      header: "peligrosa",
      render: (r) =>
        r.aplica_carga_peligrosa ? (
          <Badge tone="amarillo">aplica</Badge>
        ) : (
          <span style={{ color: "var(--color-text-faint)" }}>—</span>
        ),
      sortValue: (r) => (r.aplica_carga_peligrosa ? 0 : 1),
      hideOnMobile: true,
    },
  ];

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Tarifas de freetime" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-hidden>
          <SkeletonBlock width={320} height={34} />
          <SkeletonBlock height={90} delay={150} style={{ borderRadius: "var(--radius-input)" }} />
        </div>
        <div style={{ marginTop: 16 }}>
          <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} loading skeletonRows={5} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Tarifas de freetime"
        counters={
          selected && tarifas !== null ? (
            <Badge tone="neutro" mono icon="ti-versions">
              {tarifas.length} versi{tarifas.length === 1 ? "ón" : "ones"}
            </Badge>
          ) : undefined
        }
        action={
          <Button variant="primary" icon="ti-plus" disabled={!selected || tarifas === null} onClick={() => setModalOpen(true)}>
            Nueva versión
          </Button>
        }
      />

      {navierasError ? (
        <div className="fd-panel">
          <ErrorState
            title="No se pudieron cargar las navieras"
            detail={navierasError}
            onRetry={() => void loadNavieras()}
          />
        </div>
      ) : loadingNavieras ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-hidden>
          <SkeletonBlock width={320} height={34} />
          <SkeletonBlock height={90} delay={150} style={{ borderRadius: "var(--radius-input)" }} />
        </div>
      ) : (navieras ?? []).length === 0 ? (
        <div className="fd-panel">
          <EmptyState
            icon="ti-ship"
            title="No hay navieras cargadas"
            action={
              <Button variant="primary" icon="ti-ship" onClick={() => router.push("/admin/navieras")}>
                Ir a Navieras
              </Button>
            }
          >
            Las tarifas se versionan por naviera. Primero creá la naviera en Admin → Navieras y después volvé acá para
            cargarle días libres y USD/día.
          </EmptyState>
        </div>
      ) : (
        <>
          <div style={{ maxWidth: 340, marginBottom: 14 }}>
            <Field label="naviera" htmlFor="tarifas-naviera">
              <Select id="tarifas-naviera" value={selectedId} onChange={(e) => selectNaviera(e.target.value)}>
                <option value="">— elegí una naviera —</option>
                {(navieras ?? []).map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nombre}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {selected === null ? (
            <div className="fd-panel" style={{ marginTop: 14 }}>
              <EmptyState icon="ti-receipt-2" title="Elegí una naviera">
                Seleccioná una naviera arriba para ver su tarifa vigente y el historial completo de versiones. Cada
                cambio de tarifa crea una versión nueva — nunca se pisa una anterior, así cada operación conserva la
                tarifa que le tocó por fecha de retiro.
              </EmptyState>
            </div>
          ) : tarifasError ? (
            <div className="fd-panel" style={{ marginTop: 14 }}>
              <ErrorState
                title={`No se pudieron cargar las tarifas de ${selected.nombre}`}
                detail={tarifasError}
                onRetry={() => void loadTarifas(selectedId)}
              />
            </div>
          ) : loadingTarifas ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }} aria-hidden>
              <SkeletonBlock height={90} style={{ borderRadius: "var(--radius-input)" }} />
              <SkeletonBlock height={160} delay={150} style={{ borderRadius: "var(--radius-input)" }} />
            </div>
          ) : (tarifas ?? []).length === 0 ? (
            <div className="fd-panel" style={{ marginTop: 14 }}>
              <EmptyState icon="ti-receipt-2" title={`${selected.nombre} no tiene tarifas cargadas`}>
                Sin tarifa vigente, sus contenedores no pueden calcular días libres ni costo proyectado. Creá la
                primera versión con «Nueva versión»: días libres, USD/día, tipo y desde cuándo rige.
              </EmptyState>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
                {vigentes.map((v) => (
                  <VigenteCard key={v.id} tarifa={v} />
                ))}
                {vigentes.length === 0 && (
                  <FormAlert tone="warning">
                    {selected.nombre} tiene historial pero NINGUNA versión vigente (todas con vigencia cerrada) — sus
                    contenedores no calculan freetime. Cargá una versión nueva.
                  </FormAlert>
                )}
              </div>

              <SectionTitle title="Historial de versiones" count={tarifas!.length} />
              <DataTable
                columns={columns}
                rows={tarifas!}
                rowKey={(r) => r.id}
                pageSize={12}
                defaultSort={{ key: "vigencia", dir: "desc" }}
              />
              <p style={{ margin: "10px 2px 0", fontSize: 11.5, color: "var(--color-text-faint)", lineHeight: 1.5 }}>
                El historial nunca se edita ni se borra: cada operación toma la versión que estaba vigente a su fecha
                de retiro. Versionar cierra la vigente el día anterior al inicio de la nueva.
              </p>
            </>
          )}
        </>
      )}

      {modalOpen && selected && tarifas !== null && (
        <NuevaVersionModal
          naviera={selected}
          vigentes={vigentes}
          onClose={() => setModalOpen(false)}
          onDone={() => {
            setModalOpen(false);
            void loadTarifas(selectedId);
          }}
        />
      )}
    </>
  );
}
