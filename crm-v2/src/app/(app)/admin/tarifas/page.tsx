"use client";

// Admin → Tarifas de freetime (M9 + B1 multi-región): versionado por naviera/país/hub,
// con dos pestañas — Origen (freetime_origin, evolución de la vista M9) y Destino
// (freetime_destino, NUEVA — migración 026).
//
// freetime_origin/freetime_destino son SOLO SELECT por RLS: el front JAMÁS hace
// INSERT/UPDATE sobre ellas — toda escritura pasa por crm_nueva_version_freetime /
// crm_nueva_version_freetime_destino [SECURITY DEFINER, solo admin activo], que validan,
// cierran la versión vigente (vigente_hasta = desde − 1) e insertan la nueva. Sus errores
// P0001 van LITERALES al FormAlert del modal. Caso idempotente (misma versión → devuelve
// el id vigente sin tocar nada): NO es error → toast informativo.
// p_desde/vigente_desde son DATE: viajan como "YYYY-MM-DD" plano, SIN sufijo de timezone.
//
// UX B1 (decisión de John, D2): en vez de elegir una naviera y ver su historial completo,
// cada pestaña es una TABLA filtrada — país (preset ARGENTINA, 90% del uso es local),
// búsqueda por naviera (+ hub en destino) y toggle "solo vigentes" (default on) — con
// "Nueva versión" por FILA. La fila trae naviera+país+régimen+hub ya fijos (identifican
// la vigencia única, ux_freetime_vigente/ux_freetime_destino_vigente): el modal de
// "nueva versión" los muestra de solo lectura y deja editar el resto. El botón "Nueva
// tarifa" (acción primaria de cada pestaña) abre el mismo modal en modo alta: ahí sí
// naviera/país/régimen/hub son editables, para el primer registro de una combinación.
//
// Server-side filtering (730/1441 filas — nunca se trae todo): país vía .eq("pais_id"),
// vigentes vía .is("vigente_hasta", null), naviera vía .in("naviera_id", ids-matcheados-
// por-nombre) — PostgREST no permite filtrar el root por una columna de texto de un embed
// sin !inner + dot-path, así que se resuelve del lado del cliente contra la lista de
// navieras (33 filas, ya cargada) y se manda como lista de ids. FETCH_CAP defensivo
// (mismo patrón que /reportes) por si "todos los países" + "todas" queda muy amplio.
// Guard admin (patrón solicitudes §14.7): skeleton + redirect; el enforcement es la RPC.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { ComboboxCreatable } from "@/components/fd/combobox-creatable";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { DateField, Field, Input, Select, Textarea, Toggle } from "@/components/fd/fields";
import { FieldHelp } from "@/components/fd/field-help";
import { FormAlert } from "@/components/fd/form-alert";
import { Modal } from "@/components/fd/modal";
import { PageHeader } from "@/components/fd/page-header";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { Tabs, type TabDef } from "@/components/fd/tabs";
import { useToast } from "@/components/fd/toast";
import { fmtFechaDia, fmtUSDTarifa, hoyAR } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

type Naviera = { id: string; nombre: string };
type Pais = { id: string; nombre: string; region: string; activo: boolean };

type OrigenRow = {
  id: string;
  naviera_id: string;
  naviera: { nombre: string } | null;
  pais_id: string;
  pais: { nombre: string } | null;
  hub: string | null;
  regimen: string;
  dias_libres: number;
  aplica_carga_peligrosa: boolean;
  tipo: string;
  tarifa_usd_dia: number;
  freetime_reefer: number | null;
  tarifa_reefer_usd_dia: number | null;
  nota: string | null;
  vigente_desde: string;
  vigente_hasta: string | null;
  convencion_conteo: string;
  cobra_detention_origen: boolean;
};

type DestinoRow = {
  id: string;
  naviera_id: string;
  naviera: { nombre: string } | null;
  pais_id: string;
  pais: { nombre: string } | null;
  hub: string | null;
  dias_combined: number | null;
  dias_demurrage: number | null;
  dias_detention: number | null;
  aplica_carga_peligrosa: boolean | null;
  tarifa_dry_usd_dia: number | null;
  tarifa_reefer_usd_dia: number | null;
  freetime_reefer: number | null;
  convencion_conteo: string;
  nota: string | null;
  vigente_desde: string;
  vigente_hasta: string | null;
};

// espeja el CHECK de la RPC (p_convencion ∈ {retiro_dia_1, retiro_dia_0}) — labels humanos
const CONVENCION_LABELS: Record<string, string> = {
  retiro_dia_1: "El día del retiro cuenta como día 1",
  retiro_dia_0: "El free time arranca el día siguiente al retiro",
};

// destino: el reloj arranca en el ARRIBO, no en el retiro (migración 026, comentario de columna)
const CONVENCION_DESTINO_LABELS: Record<string, string> = {
  retiro_dia_1: "El día del arribo cuenta como día 1",
  retiro_dia_0: "El free time arranca el día siguiente al arribo",
};

// espeja el CHECK de la RPC (regimen ∈ {vacios, cargados, sin_uso})
const REGIMEN_LABELS: Record<string, string> = {
  vacios: "vacíos",
  cargados: "cargados",
  sin_uso: "sin uso",
};

// espeja el CHECK de la RPC (tipo ∈ {Detention, Demurrage, Combined} — vocabulario naviero)
const TIPOS = ["Detention", "Demurrage", "Combined"] as const;

// aplica_carga_peligrosa de destino es NULLABLE (5.6% del contrato no trae el dato) —
// tri-estado: "" = sin dato / "true" / "false".
const PELIGROSA_TRI: { value: string; label: string }[] = [
  { value: "", label: "sin dato" },
  { value: "true", label: "aplica" },
  { value: "false", label: "no aplica" },
];

const FETCH_CAP = 1000;

function SectionRow({
  title,
  count,
  truncado,
  action,
}: {
  title: string;
  count: number | null;
  truncado: boolean;
  action: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
        margin: "18px 0 10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="fd-display fd-display-sm" style={{ color: "var(--color-text-secondary)" }}>
          {title}
        </span>
        {count != null && (
          <span className="mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            {count}
            {truncado ? "+" : ""}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

function PaisCell({ pais, hub }: { pais: string | undefined; hub: string | null }) {
  return (
    <span>
      {pais ?? "—"}
      {hub && (
        <span style={{ marginLeft: 6, fontSize: 11, color: "var(--color-text-faint)" }} className="mono">
          · {hub}
        </span>
      )}
    </span>
  );
}

function VigenciaCell({ desde, hasta }: { desde: string; hasta: string | null }) {
  return hasta === null ? (
    <Badge tone="verde" icon="ti-circle-check">
      vigente desde {fmtFechaDia(desde)}
    </Badge>
  ) : (
    <span className="mono">
      {fmtFechaDia(desde)} → {fmtFechaDia(hasta)}
    </span>
  );
}

function NotaCell({ nota }: { nota: string | null }) {
  if (!nota) return <span style={{ color: "var(--color-text-faint)" }}>—</span>;
  return (
    <span
      title={nota}
      tabIndex={0}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        maxWidth: 160,
        cursor: "help",
        color: "var(--color-text-muted)",
      }}
    >
      <i className="ti ti-note" aria-hidden style={{ fontSize: 13, flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11.5 }}>{nota}</span>
    </span>
  );
}

function NumOrDash({ n }: { n: number | null }) {
  return n == null ? <span style={{ color: "var(--color-text-faint)" }}>—</span> : <>{n}</>;
}

function PeligrosaBadge({ v }: { v: boolean | null }) {
  if (v == null) return <span style={{ color: "var(--color-text-faint)" }}>—</span>;
  return v ? (
    <Badge tone="amarillo" icon="ti-alert-triangle">
      aplica
    </Badge>
  ) : (
    <Badge tone="neutro">no aplica</Badge>
  );
}

/* ---------- modal Nueva versión / Nueva tarifa (origen) ---------- */

function OrigenVersionModal({
  paises,
  navieras,
  defaultPaisId,
  row,
  onClose,
  onDone,
}: {
  paises: Pais[];
  navieras: Naviera[];
  defaultPaisId: string;
  /** null = alta (naviera/país/régimen/hub editables); con fila = nueva versión (contexto fijo). */
  row: OrigenRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const paisesActivos = useMemo(() => paises.filter((p) => p.activo), [paises]);

  const [navieraId, setNavieraId] = useState(row?.naviera_id ?? "");
  const [paisId, setPaisId] = useState(row?.pais_id ?? defaultPaisId);
  const [regimen, setRegimen] = useState(row?.regimen ?? "vacios");
  const [hub, setHub] = useState(row?.hub ?? "");
  const [dias, setDias] = useState(row ? String(row.dias_libres) : "");
  const [tarifa, setTarifa] = useState(row ? String(row.tarifa_usd_dia) : "");
  const [tipo, setTipo] = useState(row?.tipo ?? "Detention");
  const [peligrosa, setPeligrosa] = useState(row?.aplica_carga_peligrosa ?? false);
  const [convencion, setConvencion] = useState(row?.convencion_conteo ?? "retiro_dia_1");
  const [cobra, setCobra] = useState(row?.cobra_detention_origen ?? true);
  const [freetimeReefer, setFreetimeReefer] = useState(
    row?.freetime_reefer != null ? String(row.freetime_reefer) : "",
  );
  const [tarifaReefer, setTarifaReefer] = useState(
    row?.tarifa_reefer_usd_dia != null ? String(row.tarifa_reefer_usd_dia) : "",
  );
  const [nota, setNota] = useState(row?.nota ?? "");
  const [desde, setDesde] = useState(hoyAR());
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const navieraSel = navieras.find((n) => n.id === navieraId) ?? null;
  const paisSel = paises.find((p) => p.id === paisId) ?? null;

  const diasNum = Number(dias);
  const tarifaNum = Number(tarifa);
  const freetimeReeferNum = freetimeReefer.trim() === "" ? null : Number(freetimeReefer);
  const tarifaReeferNum = tarifaReefer.trim() === "" ? null : Number(tarifaReefer);

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
  const freetimeReeferError =
    freetimeReefer.trim() !== "" && (!Number.isInteger(freetimeReeferNum as number) || (freetimeReeferNum as number) < 0)
      ? "freetime reefer inválido (entero ≥ 0)"
      : null;
  const tarifaReeferError =
    tarifaReefer.trim() !== "" && (Number.isNaN(tarifaReeferNum as number) || (tarifaReeferNum as number) < 0)
      ? "tarifa reefer inválida (número ≥ 0)"
      : null;
  const desdeError = attempted && desde === "" ? "indicá la fecha de vigencia" : null;
  const navieraError = row === null && attempted && navieraId === "" ? "elegí la naviera" : null;
  const paisError = row === null && attempted && paisId === "" ? "elegí el país" : null;

  const valid =
    (row !== null || (navieraId !== "" && paisId !== "")) &&
    dias.trim() !== "" &&
    Number.isInteger(diasNum) &&
    diasNum >= 0 &&
    tarifa.trim() !== "" &&
    !Number.isNaN(tarifaNum) &&
    tarifaNum >= 0 &&
    freetimeReeferError === null &&
    tarifaReeferError === null &&
    desde !== "";

  const submit = async () => {
    setAttempted(true);
    setSubmitError(null);
    if (!valid || sending) return;
    setSending(true);
    const pNombre = row ? (row.pais?.nombre ?? "ARGENTINA") : (paisSel?.nombre ?? "ARGENTINA");
    const pHub = (row ? row.hub : hub.trim() === "" ? null : hub.trim()) ?? null;
    const { data, error } = await getSupabase().rpc("crm_nueva_version_freetime", {
      p_naviera: row ? row.naviera_id : navieraId,
      p_dias: diasNum,
      p_peligrosa: peligrosa,
      p_tipo: tipo,
      p_tarifa: tarifaNum,
      p_desde: desde,
      p_regimen: row ? row.regimen : regimen,
      p_convencion: convencion,
      p_cobra: cobra,
      p_pais: pNombre,
      p_hub: pHub,
      p_freetime_reefer: freetimeReeferNum,
      p_tarifa_reefer_usd_dia: tarifaReeferNum,
      p_nota: nota.trim() === "" ? null : nota.trim(),
    });
    setSending(false);
    if (error) {
      // errores P0001 LITERALES (incluye "la vigencia nueva (…) debe ser posterior…",
      // "país inválido o inactivo", y el de rol)
      setSubmitError(error.message);
      return;
    }
    const newId = data as string | null;
    const nombreNaviera = row ? (row.naviera?.nombre ?? "") : (navieraSel?.nombre ?? "");
    if (row && newId === row.id) {
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
        detail: `${nombreNaviera} · ${pNombre}${pHub ? ` (${pHub})` : ""} · vigente desde ${fmtFechaDia(desde)}.`,
      });
    }
    onDone();
  };

  return (
    <Modal
      open
      onClose={sending ? () => {} : onClose}
      title={row ? "Nueva versión de tarifa (origen)" : "Nueva tarifa de origen"}
      width={560}
      closeOnBackdrop={!sending}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {row ? (
          <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
            <strong>{row.naviera?.nombre ?? "—"}</strong> · {row.pais?.nombre ?? "—"}
            {row.hub ? ` (${row.hub})` : ""} · régimen {REGIMEN_LABELS[row.regimen] ?? row.regimen}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <Field label="naviera" htmlFor="of-naviera" error={navieraError}>
              <ComboboxCreatable
                id="of-naviera"
                options={navieras.map((n) => ({ id: n.id, label: n.nombre }))}
                value={navieraId}
                onChange={setNavieraId}
                error={navieraError}
                placeholder="— elegí la naviera —"
              />
            </Field>
            <Field label="país" htmlFor="of-pais" error={paisError} help={<FieldHelp fieldKey="admin.tarifa.pais" />}>
              <Select id="of-pais" value={paisId} error={paisError} onChange={(e) => setPaisId(e.target.value)}>
                <option value="">— elegí el país —</option>
                {paisesActivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="régimen" htmlFor="of-regimen">
              <Select id="of-regimen" value={regimen} onChange={(e) => setRegimen(e.target.value)}>
                {Object.entries(REGIMEN_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="hub" htmlFor="of-hub" hint="opcional — puerto/terminal específico dentro del país">
              <Input id="of-hub" value={hub} placeholder="opcional" onChange={(e) => setHub(e.target.value)} />
            </Field>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <Field label="días libres" htmlFor="of-dias" error={diasError}>
            <Input
              id="of-dias"
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
          <Field label="tarifa dry (USD/día)" htmlFor="of-tarifa" error={tarifaError}>
            <Input
              id="of-tarifa"
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

        <Field label="tipo" htmlFor="of-tipo">
          <Select id="of-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Toggle id="of-peligrosa" checked={peligrosa} onChange={setPeligrosa} label="aplica a carga peligrosa" />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <Field
            label="freetime reefer (días)"
            htmlFor="of-ft-reefer"
            error={freetimeReeferError}
            hint="opcional — si no aplica, dejalo vacío"
          >
            <Input
              id="of-ft-reefer"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="mono"
              value={freetimeReefer}
              error={freetimeReeferError}
              onChange={(e) => setFreetimeReefer(e.target.value)}
            />
          </Field>
          <Field label="tarifa reefer (USD/día)" htmlFor="of-tarifa-reefer" error={tarifaReeferError} hint="opcional">
            <Input
              id="of-tarifa-reefer"
              type="number"
              min={0}
              step={0.01}
              inputMode="decimal"
              className="mono"
              value={tarifaReefer}
              error={tarifaReeferError}
              onChange={(e) => setTarifaReefer(e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="conteo del freetime"
          htmlFor="of-convencion"
          hint="cómo cuenta esta naviera el primer día — cambia los días transcurridos de todas las operaciones que tomen esta versión"
          help={<FieldHelp fieldKey="admin.tarifa.convencion" />}
        >
          <Select id="of-convencion" value={convencion} onChange={(e) => setConvencion(e.target.value)}>
            {Object.entries(CONVENCION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Toggle
          id="of-cobra"
          checked={cobra}
          onChange={setCobra}
          label={
            <span>
              cobra detention en origen
              <span style={{ display: "block", fontSize: 11, color: "var(--color-text-faint)" }}>
                apagalo si esta versión no factura detention en este país (semáforo neutro, sin costo proyectado)
              </span>
            </span>
          }
        />

        <Field
          label="nota"
          htmlFor="of-nota"
          hint="opcional — documentá ajustes operativos vs. contrato"
          help={<FieldHelp fieldKey="admin.tarifa.nota" />}
        >
          <Textarea id="of-nota" rows={2} value={nota} placeholder="opcional" onChange={(e) => setNota(e.target.value)} style={{ resize: "vertical" }} />
        </Field>

        <Field
          label="vigente desde"
          htmlFor="of-desde"
          error={desdeError}
          hint={
            row
              ? `la versión vigente arranca el ${fmtFechaDia(row.vigente_desde)} — la nueva debe ser posterior`
              : undefined
          }
          help={<FieldHelp fieldKey="admin.tarifa.vigente_desde" />}
        >
          <DateField id="of-desde" value={desde} error={desdeError} onChange={(e) => setDesde(e.target.value)} style={{ maxWidth: 200 }} />
        </Field>

        {submitError && <FormAlert>{submitError}</FormAlert>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button variant="primary" icon="ti-versions" loading={sending} disabled={!valid} onClick={() => void submit()}>
            {row ? "Versionar tarifa" : "Crear tarifa"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- modal Nueva versión / Nueva tarifa (destino) ---------- */

function DestinoVersionModal({
  paises,
  navieras,
  defaultPaisId,
  row,
  onClose,
  onDone,
}: {
  paises: Pais[];
  navieras: Naviera[];
  defaultPaisId: string;
  row: DestinoRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const paisesActivos = useMemo(() => paises.filter((p) => p.activo), [paises]);

  const [navieraId, setNavieraId] = useState(row?.naviera_id ?? "");
  const [paisId, setPaisId] = useState(row?.pais_id ?? defaultPaisId);
  const [hub, setHub] = useState(row?.hub ?? "");
  const [diasCombined, setDiasCombined] = useState(row?.dias_combined != null ? String(row.dias_combined) : "");
  const [diasDemurrage, setDiasDemurrage] = useState(row?.dias_demurrage != null ? String(row.dias_demurrage) : "");
  const [diasDetention, setDiasDetention] = useState(row?.dias_detention != null ? String(row.dias_detention) : "");
  const [peligrosa, setPeligrosa] = useState<string>(
    row?.aplica_carga_peligrosa == null ? "" : String(row.aplica_carga_peligrosa),
  );
  const [tarifaDry, setTarifaDry] = useState(row?.tarifa_dry_usd_dia != null ? String(row.tarifa_dry_usd_dia) : "");
  const [tarifaReefer, setTarifaReefer] = useState(
    row?.tarifa_reefer_usd_dia != null ? String(row.tarifa_reefer_usd_dia) : "",
  );
  const [freetimeReefer, setFreetimeReefer] = useState(
    row?.freetime_reefer != null ? String(row.freetime_reefer) : "",
  );
  const [convencion, setConvencion] = useState(row?.convencion_conteo ?? "retiro_dia_1");
  const [nota, setNota] = useState(row?.nota ?? "");
  const [desde, setDesde] = useState(hoyAR());
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const navieraSel = navieras.find((n) => n.id === navieraId) ?? null;
  const paisSel = paises.find((p) => p.id === paisId) ?? null;

  const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
  const diasCombinedNum = numOrNull(diasCombined);
  const diasDemurrageNum = numOrNull(diasDemurrage);
  const diasDetentionNum = numOrNull(diasDetention);
  const tarifaDryNum = numOrNull(tarifaDry);
  const tarifaReeferNum = numOrNull(tarifaReefer);
  const freetimeReeferNum = numOrNull(freetimeReefer);

  const intErr = (s: string, n: number | null) =>
    s.trim() !== "" && (!Number.isInteger(n as number) || (n as number) < 0) ? "entero ≥ 0" : null;
  const numErr = (s: string, n: number | null) =>
    s.trim() !== "" && (Number.isNaN(n as number) || (n as number) < 0) ? "número ≥ 0" : null;

  const diasCombinedError = intErr(diasCombined, diasCombinedNum);
  const diasDemurrageError = intErr(diasDemurrage, diasDemurrageNum);
  const diasDetentionError = intErr(diasDetention, diasDetentionNum);
  const tarifaDryError = numErr(tarifaDry, tarifaDryNum);
  const tarifaReeferError = numErr(tarifaReefer, tarifaReeferNum);
  const freetimeReeferError = intErr(freetimeReefer, freetimeReeferNum);
  const desdeError = attempted && desde === "" ? "indicá la fecha de vigencia" : null;
  const navieraError = row === null && attempted && navieraId === "" ? "elegí la naviera" : null;
  const paisError = row === null && attempted && paisId === "" ? "elegí el país" : null;

  const numericOk =
    diasCombinedError === null &&
    diasDemurrageError === null &&
    diasDetentionError === null &&
    tarifaDryError === null &&
    tarifaReeferError === null &&
    freetimeReeferError === null;

  const valid = (row !== null || (navieraId !== "" && paisId !== "")) && desde !== "" && numericOk;

  const submit = async () => {
    setAttempted(true);
    setSubmitError(null);
    if (!valid || sending) return;
    setSending(true);
    const pNombre = row ? (row.pais?.nombre ?? "ARGENTINA") : (paisSel?.nombre ?? "ARGENTINA");
    const pHub = (row ? row.hub : hub.trim() === "" ? null : hub.trim()) ?? null;
    const { data, error } = await getSupabase().rpc("crm_nueva_version_freetime_destino", {
      p_naviera: row ? row.naviera_id : navieraId,
      p_pais: pNombre,
      p_desde: desde,
      p_hub: pHub,
      p_dias_combined: diasCombinedNum,
      p_dias_demurrage: diasDemurrageNum,
      p_dias_detention: diasDetentionNum,
      p_peligrosa: peligrosa === "" ? null : peligrosa === "true",
      p_tarifa_dry_usd_dia: tarifaDryNum,
      p_tarifa_reefer_usd_dia: tarifaReeferNum,
      p_freetime_reefer: freetimeReeferNum,
      p_convencion: convencion,
      p_nota: nota.trim() === "" ? null : nota.trim(),
    });
    setSending(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    const newId = data as string | null;
    const nombreNaviera = row ? (row.naviera?.nombre ?? "") : (navieraSel?.nombre ?? "");
    if (row && newId === row.id) {
      toast({
        type: "info",
        title: "Sin cambios",
        detail: "La versión vigente ya tiene exactamente esos valores.",
      });
    } else {
      toast({
        type: "exito",
        title: "Nueva versión de tarifa de destino registrada",
        detail: `${nombreNaviera} · ${pNombre}${pHub ? ` (${pHub})` : ""} · vigente desde ${fmtFechaDia(desde)}.`,
      });
    }
    onDone();
  };

  return (
    <Modal
      open
      onClose={sending ? () => {} : onClose}
      title={row ? "Nueva versión de tarifa (destino)" : "Nueva tarifa de destino"}
      width={600}
      closeOnBackdrop={!sending}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {row ? (
          <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
            <strong>{row.naviera?.nombre ?? "—"}</strong> · {row.pais?.nombre ?? "—"}
            {row.hub ? ` (${row.hub})` : ""}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <Field label="naviera" htmlFor="df-naviera" error={navieraError}>
              <ComboboxCreatable
                id="df-naviera"
                options={navieras.map((n) => ({ id: n.id, label: n.nombre }))}
                value={navieraId}
                onChange={setNavieraId}
                error={navieraError}
                placeholder="— elegí la naviera —"
              />
            </Field>
            <Field label="país" htmlFor="df-pais" error={paisError} help={<FieldHelp fieldKey="admin.tarifa.pais" />}>
              <Select id="df-pais" value={paisId} error={paisError} onChange={(e) => setPaisId(e.target.value)}>
                <option value="">— elegí el país —</option>
                {paisesActivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="hub" htmlFor="df-hub" hint="opcional — puerto/terminal específico dentro del país">
              <Input id="df-hub" value={hub} placeholder="opcional" onChange={(e) => setHub(e.target.value)} />
            </Field>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
          <Field label="días combined" htmlFor="df-combined" error={diasCombinedError} hint="opcional">
            <Input
              id="df-combined"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="mono"
              value={diasCombined}
              error={diasCombinedError}
              onChange={(e) => setDiasCombined(e.target.value)}
            />
          </Field>
          <Field label="días demurrage" htmlFor="df-demurrage" error={diasDemurrageError} hint="opcional">
            <Input
              id="df-demurrage"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="mono"
              value={diasDemurrage}
              error={diasDemurrageError}
              onChange={(e) => setDiasDemurrage(e.target.value)}
            />
          </Field>
          <Field label="días detention" htmlFor="df-detention" error={diasDetentionError} hint="opcional">
            <Input
              id="df-detention"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="mono"
              value={diasDetention}
              error={diasDetentionError}
              onChange={(e) => setDiasDetention(e.target.value)}
            />
          </Field>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-faint)", lineHeight: 1.5 }}>
          Combined no se deriva de demurrage + detention — cargá tal cual figura en el contrato; el 78% de los
          contratos reales no cuadra la suma.
        </p>

        <Field label="carga peligrosa" htmlFor="df-peligrosa">
          <Select id="df-peligrosa" value={peligrosa} onChange={(e) => setPeligrosa(e.target.value)}>
            {PELIGROSA_TRI.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <Field label="tarifa dry (USD/día)" htmlFor="df-tarifa-dry" error={tarifaDryError} hint="opcional">
            <Input
              id="df-tarifa-dry"
              type="number"
              min={0}
              step={0.01}
              inputMode="decimal"
              className="mono"
              value={tarifaDry}
              error={tarifaDryError}
              onChange={(e) => setTarifaDry(e.target.value)}
            />
          </Field>
          <Field label="tarifa reefer (USD/día)" htmlFor="df-tarifa-reefer" error={tarifaReeferError} hint="opcional">
            <Input
              id="df-tarifa-reefer"
              type="number"
              min={0}
              step={0.01}
              inputMode="decimal"
              className="mono"
              value={tarifaReefer}
              error={tarifaReeferError}
              onChange={(e) => setTarifaReefer(e.target.value)}
            />
          </Field>
          <Field label="freetime reefer (días)" htmlFor="df-ft-reefer" error={freetimeReeferError} hint="opcional">
            <Input
              id="df-ft-reefer"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="mono"
              value={freetimeReefer}
              error={freetimeReeferError}
              onChange={(e) => setFreetimeReefer(e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="conteo del freetime"
          htmlFor="df-convencion"
          hint="el reloj de destino arranca en el arribo, no en el retiro"
          help={<FieldHelp fieldKey="admin.tarifa.convencion_destino" />}
        >
          <Select id="df-convencion" value={convencion} onChange={(e) => setConvencion(e.target.value)}>
            {Object.entries(CONVENCION_DESTINO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="nota"
          htmlFor="df-nota"
          hint="opcional — documentá ajustes operativos vs. contrato"
          help={<FieldHelp fieldKey="admin.tarifa.nota" />}
        >
          <Textarea id="df-nota" rows={2} value={nota} placeholder="opcional" onChange={(e) => setNota(e.target.value)} style={{ resize: "vertical" }} />
        </Field>

        <Field
          label="vigente desde"
          htmlFor="df-desde"
          error={desdeError}
          hint={
            row
              ? `la versión vigente arranca el ${fmtFechaDia(row.vigente_desde)} — la nueva debe ser posterior`
              : undefined
          }
        >
          <DateField id="df-desde" value={desde} error={desdeError} onChange={(e) => setDesde(e.target.value)} style={{ maxWidth: 200 }} />
        </Field>

        {submitError && <FormAlert>{submitError}</FormAlert>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button variant="primary" icon="ti-versions" loading={sending} disabled={!valid} onClick={() => void submit()}>
            {row ? "Versionar tarifa" : "Crear tarifa"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- barra de filtros compartida (país + búsqueda + solo vigentes) ---------- */

function FiltrosBar({
  paises,
  paisId,
  onPaisChange,
  searchInput,
  onSearchChange,
  searchPlaceholder,
  soloVigentes,
  onSoloVigentesChange,
  activos,
  onLimpiar,
}: {
  paises: Pais[];
  paisId: string;
  onPaisChange: (id: string) => void;
  searchInput: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  soloVigentes: boolean;
  onSoloVigentesChange: (v: boolean) => void;
  activos: boolean;
  onLimpiar: () => void;
}) {
  const paisOptions = useMemo(
    () => [{ id: "", label: "Todos los países" }, ...paises.map((p) => ({ id: p.id, label: p.nombre }))],
    [paises],
  );
  return (
    <div className="fd-panel">
      <div className="fd-panel-title">
        <i className="ti ti-filter" aria-hidden style={{ fontSize: 15 }} /> Filtros
        {activos && (
          <button
            type="button"
            onClick={onLimpiar}
            className="hover:[color:var(--color-text-primary)!important]"
            style={{
              marginLeft: "auto",
              minHeight: 0,
              padding: "2px 8px",
              fontSize: 11.5,
              border: "none",
              background: "transparent",
              color: "var(--color-text-muted)",
              textDecoration: "underline",
            }}
          >
            limpiar filtros
          </button>
        )}
      </div>
      <div
        className="fd-panel-body"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "end" }}
      >
        <Field label="país" htmlFor="tf-pais">
          <ComboboxCreatable id="tf-pais" options={paisOptions} value={paisId} onChange={onPaisChange} placeholder="Todos los países" />
        </Field>
        <Field label="buscar" htmlFor="tf-search">
          <Input id="tf-search" value={searchInput} placeholder={searchPlaceholder} onChange={(e) => onSearchChange(e.target.value)} />
        </Field>
        <Toggle id="tf-vigentes" checked={soloVigentes} onChange={onSoloVigentesChange} label="solo vigentes" />
      </div>
    </div>
  );
}

/* ---------- pestaña Origen ---------- */

function OrigenPanel({
  paises,
  navieras,
  defaultPaisId,
}: {
  paises: Pais[];
  navieras: Naviera[];
  defaultPaisId: string;
}) {
  const [paisId, setPaisId] = useState(defaultPaisId);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [soloVigentes, setSoloVigentes] = useState(true);
  const [rows, setRows] = useState<OrigenRow[] | null>(null);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; row: OrigenRow | null }>({ open: false, row: null });

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    let q = getSupabase()
      .from("freetime_origin")
      .select(
        "id, naviera_id, naviera:navieras(nombre), pais_id, pais:paises(nombre), hub, regimen, dias_libres, aplica_carga_peligrosa, tipo, tarifa_usd_dia, freetime_reefer, tarifa_reefer_usd_dia, nota, vigente_desde, vigente_hasta, convencion_conteo, cobra_detention_origen",
      );
    if (paisId) q = q.eq("pais_id", paisId);
    if (soloVigentes) q = q.is("vigente_hasta", null);
    const term = search.trim().toLowerCase();
    if (term) {
      const ids = navieras.filter((n) => n.nombre.toLowerCase().includes(term)).map((n) => n.id);
      q = q.in("naviera_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
    }
    const { data, error } = await q.order("vigente_desde", { ascending: false }).limit(FETCH_CAP);
    if (error) {
      setRows(null);
      setRowsError(error.message);
      return;
    }
    setRowsError(null);
    setRows(data as unknown as OrigenRow[]);
  }, [paisId, soloVigentes, search, navieras]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const loading = rows === null && !rowsError;
  const filtrosActivos = paisId !== defaultPaisId || searchInput !== "" || !soloVigentes;

  const columns: Column<OrigenRow>[] = [
    {
      key: "naviera",
      header: "naviera",
      render: (r) => <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{r.naviera?.nombre ?? "—"}</span>,
      sortValue: (r) => r.naviera?.nombre ?? null,
    },
    {
      key: "pais",
      header: "país",
      render: (r) => <PaisCell pais={r.pais?.nombre} hub={r.hub} />,
      sortValue: (r) => r.pais?.nombre ?? null,
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
      key: "tipo",
      header: "tipo",
      render: (r) => r.tipo,
      sortValue: (r) => r.tipo,
      hideOnMobile: true,
    },
    {
      key: "tarifa",
      header: "USD/día (dry)",
      numeric: true,
      render: (r) => fmtUSDTarifa(r.tarifa_usd_dia),
      sortValue: (r) => r.tarifa_usd_dia,
    },
    {
      key: "ft_reefer",
      header: "freetime reefer",
      numeric: true,
      render: (r) => <NumOrDash n={r.freetime_reefer} />,
      sortValue: (r) => r.freetime_reefer,
      hideOnMobile: true,
    },
    {
      key: "tarifa_reefer",
      header: "USD/día (reefer)",
      numeric: true,
      render: (r) => fmtUSDTarifa(r.tarifa_reefer_usd_dia),
      sortValue: (r) => r.tarifa_reefer_usd_dia,
      hideOnMobile: true,
    },
    {
      key: "peligrosa",
      header: "peligrosa",
      render: (r) => <PeligrosaBadge v={r.aplica_carga_peligrosa} />,
      sortValue: (r) => (r.aplica_carga_peligrosa ? 0 : 1),
      hideOnMobile: true,
    },
    {
      key: "cobra",
      header: "detention",
      render: (r) =>
        r.cobra_detention_origen ? (
          <Badge tone="verde">cobra</Badge>
        ) : (
          <Badge tone="neutro">no cobra</Badge>
        ),
      sortValue: (r) => (r.cobra_detention_origen ? 0 : 1),
      hideOnMobile: true,
    },
    {
      key: "vigencia",
      header: "vigencia",
      render: (r) => <VigenciaCell desde={r.vigente_desde} hasta={r.vigente_hasta} />,
      sortValue: (r) => r.vigente_desde,
    },
    {
      key: "nota",
      header: "nota",
      render: (r) => <NotaCell nota={r.nota} />,
      hideOnMobile: true,
    },
    {
      key: "acciones",
      header: "",
      align: "right",
      render: (r) => (
        <Button
          variant="ghost"
          icon="ti-versions"
          style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}
          onClick={() => setModal({ open: true, row: r })}
        >
          Nueva versión
        </Button>
      ),
    },
  ];

  return (
    <>
      <FiltrosBar
        paises={paises}
        paisId={paisId}
        onPaisChange={setPaisId}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="buscar por naviera…"
        soloVigentes={soloVigentes}
        onSoloVigentesChange={setSoloVigentes}
        activos={filtrosActivos}
        onLimpiar={() => {
          setPaisId(defaultPaisId);
          setSearchInput("");
          setSoloVigentes(true);
        }}
      />

      <SectionRow
        title="Tarifas de origen"
        count={rows?.length ?? null}
        truncado={(rows?.length ?? 0) >= FETCH_CAP}
        action={
          <Button variant="primary" icon="ti-plus" onClick={() => setModal({ open: true, row: null })}>
            Nueva tarifa
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={rows ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        skeletonRows={8}
        pageSize={15}
        maxHeight={560}
        defaultSort={{ key: "vigencia", dir: "desc" }}
        errorState={
          rowsError ? (
            <ErrorState title="No se pudieron cargar las tarifas de origen" detail={rowsError} onRetry={() => void load()} />
          ) : undefined
        }
        emptyState={
          <EmptyState icon="ti-receipt-2" title="Sin tarifas de origen para estos filtros">
            No hay versiones de freetime de origen que matcheen el país, la búsqueda y &quot;solo vigentes&quot;
            elegidos. Achicá el filtro de país, borrá la búsqueda o apagá &quot;solo vigentes&quot; para ver el
            historial completo — o cargá la primera con «Nueva tarifa».
          </EmptyState>
        }
      />

      {modal.open && (
        <OrigenVersionModal
          paises={paises}
          navieras={navieras}
          defaultPaisId={defaultPaisId}
          row={modal.row}
          onClose={() => setModal({ open: false, row: null })}
          onDone={() => {
            setModal({ open: false, row: null });
            void load();
          }}
        />
      )}
    </>
  );
}

/* ---------- pestaña Destino ---------- */

function DestinoPanel({
  paises,
  navieras,
  defaultPaisId,
}: {
  paises: Pais[];
  navieras: Naviera[];
  defaultPaisId: string;
}) {
  const [paisId, setPaisId] = useState(defaultPaisId);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [soloVigentes, setSoloVigentes] = useState(true);
  const [rows, setRows] = useState<DestinoRow[] | null>(null);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; row: DestinoRow | null }>({ open: false, row: null });

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    let q = getSupabase()
      .from("freetime_destino")
      .select(
        "id, naviera_id, naviera:navieras(nombre), pais_id, pais:paises(nombre), hub, dias_combined, dias_demurrage, dias_detention, aplica_carga_peligrosa, tarifa_dry_usd_dia, tarifa_reefer_usd_dia, freetime_reefer, convencion_conteo, nota, vigente_desde, vigente_hasta",
      );
    if (paisId) q = q.eq("pais_id", paisId);
    if (soloVigentes) q = q.is("vigente_hasta", null);
    // saneo simple de sintaxis PostgREST (no es lógica de negocio, mismo criterio que alta-form.tsx)
    const term = search.trim().replace(/[,()"'\\*]/g, "");
    if (term) {
      const ids = navieras.filter((n) => n.nombre.toLowerCase().includes(term.toLowerCase())).map((n) => n.id);
      const partes: string[] = [`hub.ilike.%${term}%`];
      if (ids.length > 0) partes.push(`naviera_id.in.(${ids.join(",")})`);
      q = q.or(partes.join(","));
    }
    const { data, error } = await q.order("vigente_desde", { ascending: false }).limit(FETCH_CAP);
    if (error) {
      setRows(null);
      setRowsError(error.message);
      return;
    }
    setRowsError(null);
    setRows(data as unknown as DestinoRow[]);
  }, [paisId, soloVigentes, search, navieras]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const loading = rows === null && !rowsError;
  const filtrosActivos = paisId !== defaultPaisId || searchInput !== "" || !soloVigentes;

  const columns: Column<DestinoRow>[] = [
    {
      key: "naviera",
      header: "naviera",
      render: (r) => <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{r.naviera?.nombre ?? "—"}</span>,
      sortValue: (r) => r.naviera?.nombre ?? null,
    },
    {
      key: "pais",
      header: "país",
      render: (r) => <PaisCell pais={r.pais?.nombre} hub={r.hub} />,
      sortValue: (r) => r.pais?.nombre ?? null,
    },
    {
      key: "combined",
      header: "combined",
      numeric: true,
      render: (r) => <NumOrDash n={r.dias_combined} />,
      sortValue: (r) => r.dias_combined,
      hideOnMobile: true,
    },
    {
      key: "demurrage",
      header: "demurrage",
      numeric: true,
      render: (r) => <NumOrDash n={r.dias_demurrage} />,
      sortValue: (r) => r.dias_demurrage,
      hideOnMobile: true,
    },
    {
      key: "detention",
      header: "detention",
      numeric: true,
      render: (r) => <NumOrDash n={r.dias_detention} />,
      sortValue: (r) => r.dias_detention,
      hideOnMobile: true,
    },
    {
      key: "peligrosa",
      header: "peligrosa",
      render: (r) => <PeligrosaBadge v={r.aplica_carga_peligrosa} />,
      sortValue: (r) => (r.aplica_carga_peligrosa == null ? 1 : r.aplica_carga_peligrosa ? 0 : 2),
      hideOnMobile: true,
    },
    {
      key: "tarifa_dry",
      header: "USD/día (dry)",
      numeric: true,
      render: (r) => fmtUSDTarifa(r.tarifa_dry_usd_dia),
      sortValue: (r) => r.tarifa_dry_usd_dia,
    },
    {
      key: "tarifa_reefer",
      header: "USD/día (reefer)",
      numeric: true,
      render: (r) => fmtUSDTarifa(r.tarifa_reefer_usd_dia),
      sortValue: (r) => r.tarifa_reefer_usd_dia,
      hideOnMobile: true,
    },
    {
      key: "ft_reefer",
      header: "freetime reefer",
      numeric: true,
      render: (r) => <NumOrDash n={r.freetime_reefer} />,
      sortValue: (r) => r.freetime_reefer,
      hideOnMobile: true,
    },
    {
      key: "vigencia",
      header: "vigencia",
      render: (r) => <VigenciaCell desde={r.vigente_desde} hasta={r.vigente_hasta} />,
      sortValue: (r) => r.vigente_desde,
    },
    {
      key: "nota",
      header: "nota",
      render: (r) => <NotaCell nota={r.nota} />,
      hideOnMobile: true,
    },
    {
      key: "acciones",
      header: "",
      align: "right",
      render: (r) => (
        <Button
          variant="ghost"
          icon="ti-versions"
          style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}
          onClick={() => setModal({ open: true, row: r })}
        >
          Nueva versión
        </Button>
      ),
    },
  ];

  return (
    <>
      <FiltrosBar
        paises={paises}
        paisId={paisId}
        onPaisChange={setPaisId}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="buscar por naviera o hub…"
        soloVigentes={soloVigentes}
        onSoloVigentesChange={setSoloVigentes}
        activos={filtrosActivos}
        onLimpiar={() => {
          setPaisId(defaultPaisId);
          setSearchInput("");
          setSoloVigentes(true);
        }}
      />

      <SectionRow
        title="Tarifas de destino"
        count={rows?.length ?? null}
        truncado={(rows?.length ?? 0) >= FETCH_CAP}
        action={
          <Button variant="primary" icon="ti-plus" onClick={() => setModal({ open: true, row: null })}>
            Nueva tarifa
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={rows ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        skeletonRows={8}
        pageSize={15}
        maxHeight={560}
        defaultSort={{ key: "vigencia", dir: "desc" }}
        errorState={
          rowsError ? (
            <ErrorState title="No se pudieron cargar las tarifas de destino" detail={rowsError} onRetry={() => void load()} />
          ) : undefined
        }
        emptyState={
          <EmptyState icon="ti-anchor" title="Sin tarifas de destino para estos filtros">
            No hay versiones de freetime de destino que matcheen el país, la búsqueda y &quot;solo vigentes&quot;
            elegidos. El freetime de destino arranca en el arribo (no en el retiro) — achicá los filtros o cargá la
            primera con «Nueva tarifa».
          </EmptyState>
        }
      />

      {modal.open && (
        <DestinoVersionModal
          paises={paises}
          navieras={navieras}
          defaultPaisId={defaultPaisId}
          row={modal.row}
          onClose={() => setModal({ open: false, row: null })}
          onDone={() => {
            setModal({ open: false, row: null });
            void load();
          }}
        />
      )}
    </>
  );
}

/* ---------- página ---------- */

const TABS: TabDef[] = [
  { id: "origen", label: "Origen" },
  { id: "destino", label: "Destino" },
];

export default function TarifasPage() {
  const router = useRouter();
  const { perfil } = useSession();

  const [tab, setTab] = useState<"origen" | "destino">("origen");
  const [maestros, setMaestros] = useState<{ paises: Pais[]; navieras: Naviera[] } | null>(null);
  const [maestrosError, setMaestrosError] = useState<string | null>(null);

  const isAdmin = perfil?.rol === "administrador";

  useEffect(() => {
    if (perfil && !isAdmin) router.replace("/inicio");
  }, [perfil, isAdmin, router]);

  const loadMaestros = useCallback(async () => {
    const supabase = getSupabase();
    const [ps, nv] = await Promise.all([
      supabase.from("paises").select("id, nombre, region, activo").order("nombre"),
      // sin filtro de activa: Admin necesita versionar/consultar tarifas de TODAS las
      // navieras (incluidas inactivas/forwarders) — el filtro activa=true es solo para
      // los combos OPERATIVOS (ingreso de tandas), no para esta pantalla de gestión.
      supabase.from("navieras").select("id, nombre").order("nombre"),
    ]);
    if (ps.error || nv.error) {
      setMaestros(null);
      setMaestrosError((ps.error ?? nv.error)!.message);
      return;
    }
    setMaestrosError(null);
    setMaestros({ paises: ps.data as Pais[], navieras: nv.data as Naviera[] });
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      await loadMaestros();
    })();
  }, [isAdmin, loadMaestros]);

  const defaultPaisId = useMemo(
    () => maestros?.paises.find((p) => p.nombre === "ARGENTINA")?.id ?? "",
    [maestros],
  );

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Tarifas de freetime" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-hidden>
          <SkeletonBlock width={320} height={34} />
          <SkeletonBlock height={90} delay={150} style={{ borderRadius: "var(--radius-input)" }} />
        </div>
        <div style={{ marginTop: 16 }}>
          <DataTable columns={[]} rows={[]} rowKey={() => ""} loading skeletonRows={6} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Tarifas de freetime" />

      {maestrosError ? (
        <div className="fd-panel">
          <ErrorState title="No se pudieron cargar países/navieras" detail={maestrosError} onRetry={() => void loadMaestros()} />
        </div>
      ) : maestros === null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-hidden>
          <SkeletonBlock width={220} height={30} />
          <SkeletonBlock height={90} delay={150} style={{ borderRadius: "var(--radius-input)" }} />
          <SkeletonBlock height={280} delay={250} style={{ borderRadius: "var(--radius-input)" }} />
        </div>
      ) : (
        <>
          <Tabs tabs={TABS} active={tab} onChange={(id) => setTab(id as "origen" | "destino")} />
          <div style={{ marginTop: 14 }}>
            {tab === "origen" ? (
              <OrigenPanel paises={maestros.paises} navieras={maestros.navieras} defaultPaisId={defaultPaisId} />
            ) : (
              <DestinoPanel paises={maestros.paises} navieras={maestros.navieras} defaultPaisId={defaultPaisId} />
            )}
          </div>
        </>
      )}
    </>
  );
}
