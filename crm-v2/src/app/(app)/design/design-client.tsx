"use client";

// /design — showcase vivo del design system Flight Deck (M0).
// Cada componente aparece en TODOS sus estados; el "Patrón de página" demuestra el
// contrato de 4 estados (carga/vacío/error/poblado) que el reviewer gatea por pantalla.

import { useMemo, useState } from "react";
import { ContainerNumber } from "@/components/container-number";
import { Badge, FilterChip } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { CardIcon } from "@/components/fd/card-icon";
import { BarChart, TrendLine } from "@/components/fd/charts";
import { DataTable, type Column, type RowValidation } from "@/components/fd/data-table";
import { Dropdown, Popover, Tooltip } from "@/components/fd/dropdown";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { Checkbox, DateField, Field, Input, Select, Textarea, Toggle } from "@/components/fd/fields";
import { FormAlert } from "@/components/fd/form-alert";
import { FreetimeMeter, ProgressBar } from "@/components/fd/freetime-meter";
import { GateFrame } from "@/components/fd/gate-frame";
import { HelpPanel } from "@/components/fd/help-panel";
import { Kbd } from "@/components/fd/kbd";
import { KpiCard } from "@/components/fd/kpi-card";
import { Markdown } from "@/components/fd/markdown";
import { ConfirmDialog, Modal } from "@/components/fd/modal";
import { PageHeader } from "@/components/fd/page-header";
import { PhotoUpload, type PhotoItem } from "@/components/fd/photo-upload";
import { RadialTimer } from "@/components/fd/radial-timer";
import { SkeletonRow } from "@/components/fd/skeleton-row";
import { StatusBadge, type EstadoSemaforo } from "@/components/fd/status-badge";
import { Tabs } from "@/components/fd/tabs";
import { Timeline, type TimelineItem } from "@/components/fd/timeline";
import { useToast } from "@/components/fd/toast";
import { validarISO6346 } from "@/lib/iso6346";
import { fmtUSD } from "@/lib/format";

/* ---------- datos de ejemplo (SOLO /design — no hay datasource en M0) ---------- */

type OpDemo = {
  id: string;
  numero: string;
  naviera: string;
  planta: string;
  estado: string;
  retiro: string;
  estadia: number;
  libres: number | null;
  restantes: number | null;
  tarifa: number | null;
  costo: number | null;
  semaforo: EstadoSemaforo;
};

const OPS_DEMO: OpDemo[] = [
  { id: "1", numero: "MSKU4829103", naviera: "MAERSK", planta: "BAHIA", estado: "en planta", retiro: "28/06/26", estadia: 11, libres: 9, restantes: -2, tarifa: 85, costo: 170, semaforo: "rojo" },
  { id: "2", numero: "TCNU7290518", naviera: "HAPAG LLOYD", planta: "ABBOTT", estado: "en planta", retiro: "01/07/26", estadia: 8, libres: 10, restantes: 2, tarifa: 90, costo: 0, semaforo: "amarillo" },
  { id: "3", numero: "MSDU1750602", naviera: "MSC", planta: "BAHIA", estado: "en tránsito a planta", retiro: "05/07/26", estadia: 4, libres: 12, restantes: 8, tarifa: 75, costo: 0, semaforo: "verde" },
  { id: "4", numero: "CMAU0518390", naviera: "CMA CGM", planta: "ABBOTT", estado: "en planta", retiro: "03/07/26", estadia: 6, libres: 10, restantes: 4, tarifa: 80, costo: 0, semaforo: "verde" },
  { id: "5", numero: "ZIMU2648817", naviera: "ZIM LINES", planta: "BAHIA", estado: "en planta", retiro: "26/06/26", estadia: 13, libres: null, restantes: null, tarifa: null, costo: null, semaforo: "neutro" },
  { id: "6", numero: "HLBU9017225", naviera: "HAPAG LLOYD", planta: "BAHIA", estado: "en tránsito a terminal", retiro: "24/06/26", estadia: 15, libres: 10, restantes: -5, tarifa: 90, costo: 450, semaforo: "rojo" },
  { id: "7", numero: "MRKU3395414", naviera: "MAERSK", planta: "ABBOTT", estado: "en planta", retiro: "02/07/26", estadia: 7, libres: 9, restantes: 2, tarifa: 85, costo: 0, semaforo: "amarillo" },
  { id: "8", numero: "ONEU5502281", naviera: "ONE", planta: "BAHIA", estado: "en planta", retiro: "06/07/26", estadia: 3, libres: 14, restantes: 11, tarifa: 70, costo: 0, semaforo: "verde" },
  { id: "9", numero: "MSCU7381059", naviera: "MSC", planta: "ABBOTT", estado: "en planta", retiro: "04/07/26", estadia: 5, libres: 12, restantes: 7, tarifa: 75, costo: 0, semaforo: "verde" },
  { id: "10", numero: "CMAU4917238", naviera: "CMA CGM", planta: "BAHIA", estado: "en tránsito a planta", retiro: "07/07/26", estadia: 2, libres: 10, restantes: 8, tarifa: 80, costo: 0, semaforo: "verde" },
  { id: "11", numero: "SUDU6690023", naviera: "MAERSK", planta: "BAHIA", estado: "en planta", retiro: "29/06/26", estadia: 10, libres: 9, restantes: -1, tarifa: 85, costo: 85, semaforo: "rojo" },
  { id: "12", numero: "TLLU4392610", naviera: "EVERGREEN", planta: "ABBOTT", estado: "en planta", retiro: "05/07/26", estadia: 4, libres: 11, restantes: 7, tarifa: 78, costo: 0, semaforo: "verde" },
];

const COLS_DEMO: Column<OpDemo>[] = [
  {
    key: "numero",
    header: "contenedor",
    render: (r) => <ContainerNumber value={r.numero} />,
    sortValue: (r) => r.numero,
    width: "150px",
  },
  { key: "naviera", header: "naviera", render: (r) => r.naviera, sortValue: (r) => r.naviera, width: "120px" },
  { key: "planta", header: "posición", render: (r) => r.planta, hideOnMobile: true },
  {
    key: "estado",
    header: "estado ciclo",
    render: (r) => <Badge tone={r.estado === "en planta" ? "verde" : r.estado.includes("tránsito") ? "neutro" : "accent"}>{r.estado}</Badge>,
    hideOnMobile: true,
    width: "170px",
  },
  { key: "retiro", header: "retiro", render: (r) => <span className="mono">{r.retiro}</span>, hideOnMobile: true, width: "80px" },
  { key: "estadia", header: "estadía", numeric: true, render: (r) => r.estadia, sortValue: (r) => r.estadia, width: "70px" },
  {
    key: "restantes",
    header: "restantes",
    numeric: true,
    width: "90px",
    sortValue: (r) => r.restantes,
    render: (r) =>
      r.restantes == null ? (
        <span style={{ color: "var(--color-text-faint)" }}>—</span>
      ) : (
        <span
          style={{
            color:
              r.semaforo === "rojo"
                ? "var(--color-status-red)"
                : r.semaforo === "amarillo"
                  ? "var(--color-status-amber)"
                  : "var(--color-status-green)",
            fontWeight: 600,
          }}
        >
          {r.restantes < 0 ? `−${Math.abs(r.restantes)}` : r.restantes}
        </span>
      ),
  },
  {
    key: "costo",
    header: "costo proy.",
    numeric: true,
    width: "110px",
    sortValue: (r) => r.costo,
    render: (r) =>
      r.costo == null ? (
        <span style={{ color: "var(--color-text-faint)" }}>—</span>
      ) : r.costo > 0 ? (
        <span className="fd-usd">{fmtUSD(r.costo)}</span>
      ) : (
        <span style={{ color: "var(--color-text-faint)" }}>{fmtUSD(0)}</span>
      ),
  },
];

// tanda pegada con validación ISO 6346 REAL (lib/iso6346.ts)
const TANDA_DEMO = [
  { id: "t1", numero: "MSKU4829103", naviera: "MAERSK" },
  { id: "t2", numero: "MSKU4829104", naviera: "MAERSK" }, // dígito verificador incorrecto
  { id: "t3", numero: "TCNU729051", naviera: "HAPAG LLOYD" }, // formato inválido
  { id: "t4", numero: "ZIMU2648817", naviera: "ZIM LINES" },
];

const TIMELINE_DEMO: TimelineItem[] = [
  { id: "e1", date: "28/06/26", time: "08:40", title: "Retiro en depósito", detail: "Depósito TERBASA · tanda #142", status: "completado" },
  { id: "e2", date: "28/06/26", time: "11:15", title: "Ingreso a planta BAHIA", detail: "Confirmado por operador", status: "completado" },
  { id: "e3", date: "06/07/26", time: "23:59", title: "Fin del free time", detail: "9 días libres MAERSK · vigencia 2026-05", status: "hito" },
  { id: "e4", date: "hoy", title: "En demora", detail: "2 días · USD 85/día → USD 170 acumulado", status: "en_curso" },
  { id: "e5", date: "—", title: "Salida de planta / devolución", detail: "Corta el freetime al confirmar gate-in", status: "futuro" },
];

const BARS_DEMO = [
  { label: "MAERSK", value: 4120 },
  { label: "MSC", value: 2380 },
  { label: "HAPAG", value: 1950 },
  { label: "CMA CGM", value: 1240 },
  { label: "ZIM", value: 610 },
  { label: "ONE", value: 380 },
];

const TREND_DEMO = [
  { label: "feb", value: 5200 },
  { label: "mar", value: 4100 },
  { label: "abr", value: 6800 },
  { label: "may", value: 3900 },
  { label: "jun", value: 4600 },
  { label: "jul", value: 2700 },
];

const MD_DEMO = `# Qué es esta solapa

La solapa **Ingreso** registra la *tanda de retiro*: los contenedores que salen del depósito
hacia planta. El freetime de cada uno corre desde el \`fecha_retiro\` (día 1 inclusive).

## Flujo en 4 pasos

1. Pegá la lista de contenedores (uno por línea).
2. El sistema valida cada código con [ISO 6346](https://es.wikipedia.org/wiki/ISO_6346).
3. Elegí naviera, planta destino y fecha de retiro.
4. Confirmá la tanda — los inválidos quedan marcados para corrección.

> El toggle de **tránsito corto** confirma el ingreso a planta en el mismo paso.

\`\`\`
MSKU4829103
TCNU7290518
MSDU1750602
\`\`\`

---

Contenido editable desde Admin (M10) — script de ejemplo, no documentación real.`;

const PHOTO_SVG = (color: string, text: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="84" height="84"><rect width="84" height="84" fill="${color}"/><text x="42" y="46" font-family="monospace" font-size="11" fill="#e6eaf0" text-anchor="middle">${text}</text></svg>`,
  )}`;

const INITIAL_PHOTOS: PhotoItem[] = [
  { id: "f1", url: PHOTO_SVG("#10141b", "puerta 1"), name: "puerta-1.jpg", status: "ok" },
  { id: "f2", url: PHOTO_SVG("#0e1218", "puerta 2"), name: "puerta-2.jpg", status: "subiendo", progress: 55 },
  { id: "f3", url: PHOTO_SVG("#151a21", "puerta 3"), name: "puerta-3.jpg", status: "error", error: "sin conexión" },
];

/* ---------- helpers de layout del showcase ---------- */

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="fd-panel">
      <div className="fd-panel-title">
        {title}
        {note && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 400, letterSpacing: 0, textTransform: "none", color: "var(--color-text-faint)" }}>{note}</span>}
      </div>
      <div className="fd-panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </section>
  );
}

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <span className="fd-label">{label}</span>}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>{children}</div>
    </div>
  );
}

function Swatch({ varName, name }: { varName: string; name: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 170 }}>
      <span
        aria-hidden
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: `var(${varName})`,
          border: "1px solid var(--color-border-strong)",
          flexShrink: 0,
        }}
      />
      <span className="mono" style={{ fontSize: 10.5, color: "var(--color-text-muted)" }}>
        {name}
      </span>
    </div>
  );
}

/* ---------- página ---------- */

type PatternState = "carga" | "vacio" | "error" | "poblado";

export function DesignClient() {
  const toast = useToast();
  const [selection, setSelection] = useState<Set<string>>(new Set(["1"]));
  const [filters, setFilters] = useState<string[]>(["naviera: MAERSK", "semáforo: rojo"]);
  const [patternState, setPatternState] = useState<PatternState>("poblado");
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("solicitudes");
  const [toggleOn, setToggleOn] = useState(true);
  const [photos, setPhotos] = useState<PhotoItem[]>(INITIAL_PHOTOS);
  const [btnLoading, setBtnLoading] = useState(false);

  const tandaValidation = useMemo(
    () => (row: (typeof TANDA_DEMO)[number]): RowValidation => {
      const err = validarISO6346(row.numero);
      if (err) return { type: "error", message: err };
      if (row.naviera === "ZIM LINES") return { type: "warning", message: "naviera sin freetime vigente → semáforo neutro (Decisión 7)" };
      return { type: "ok" };
    },
    [],
  );

  const simulateConfirm = () => {
    setConfirming(true);
    window.setTimeout(() => {
      setConfirming(false);
      setConfirmOpen(false);
      toast({ type: "exito", title: "Operación anulada", detail: "demo — sin datasource en M0" });
    }, 1200);
  };

  const simulateButton = () => {
    setBtnLoading(true);
    window.setTimeout(() => setBtnLoading(false), 1500);
  };

  return (
    <>
      <PageHeader
        title="Design system"
        counters={
          <>
            <Badge tone="accent" mono>M0</Badge>
            <Badge tone="neutro">dev-only</Badge>
          </>
        }
        action={
          <Button variant="primary" icon="ti-command" onClick={() => window.dispatchEvent(new CustomEvent("fd-palette"))}>
            Abrir palette (⌘K)
          </Button>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* ============ tokens ============ */}
        <Section title="Tokens" note="globals.css @theme — Flight Deck puro, sin legacy">
          <Row label="superficies">
            <Swatch varName="--color-bg-base" name="bg-base" />
            <Swatch varName="--color-bg-rail" name="bg-rail" />
            <Swatch varName="--color-surface-1" name="surface-1" />
            <Swatch varName="--color-surface-2" name="surface-2" />
            <Swatch varName="--color-surface-selected" name="surface-selected" />
            <Swatch varName="--color-border-subtle" name="border-subtle" />
            <Swatch varName="--color-border-strong" name="border-strong" />
          </Row>
          <Row label="acción + semáforo">
            <Swatch varName="--color-accent-500" name="accent-500" />
            <Swatch varName="--color-accent-hover" name="accent-hover" />
            <Swatch varName="--color-status-green" name="status-green" />
            <Swatch varName="--color-status-amber" name="status-amber" />
            <Swatch varName="--color-status-red" name="status-red" />
            <Swatch varName="--color-status-red-soft" name="red-soft (USD)" />
          </Row>
          <Row label="tipografía">
            <span className="fd-display fd-display-lg">display-lg 17 · Archivo 118%</span>
            <span className="fd-display fd-display-sm" style={{ color: "var(--color-text-secondary)" }}>display-sm 13</span>
            <span className="mono" style={{ fontSize: 42, fontWeight: 600, lineHeight: 1 }}>42</span>
            <span className="mono" style={{ fontSize: 13.5, fontWeight: 600 }}>num-cell 13.5</span>
            <span style={{ fontSize: 12.5 }}>body 12.5</span>
            <span className="fd-label">label-micro 10.5</span>
          </Row>
        </Section>

        {/* ============ botones ============ */}
        <Section title="Button" note="loading = spinner interno + disabled → doble-submit imposible">
          <Row label="variantes">
            <Button variant="primary">Primario</Button>
            <Button variant="primary" icon="ti-plus">Registrar retiro</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="ghost" icon="ti-filter">Con ícono</Button>
            <Button variant="danger" icon="ti-ban">Anular</Button>
          </Row>
          <Row label="estados">
            <Button variant="primary" disabled>Disabled</Button>
            <Button variant="ghost" disabled>Disabled</Button>
            <Button variant="danger" disabled>Disabled</Button>
            <Button variant="primary" loading>Enviando…</Button>
            <Button variant="primary" loading={btnLoading} onClick={simulateButton}>
              {btnLoading ? "Procesando…" : "Probar loading"}
            </Button>
          </Row>
        </Section>

        {/* ============ formularios ============ */}
        <Section title="Formulario" note="surface-2 · border strong → cyan focus · radius 9 · error inline">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <Field label="booking" hint="opcional — se completa en el egreso">
              <Input placeholder="ej: 26BA00412" />
            </Field>
            <Field label="contenedor" error="dígito verificador incorrecto (esperado 3)">
              <Input defaultValue="MSKU4829104" error="dígito verificador incorrecto" />
            </Field>
            <Field label="naviera">
              <Select defaultValue="">
                <option value="" disabled>elegí naviera…</option>
                <option>MAERSK</option>
                <option>MSC</option>
                <option>HAPAG LLOYD</option>
              </Select>
            </Field>
            <Field label="fecha de retiro">
              <DateField defaultValue="2026-07-08" />
            </Field>
            <Field label="deshabilitado">
              <Input placeholder="sin permiso" disabled />
            </Field>
          </div>
          <Field label="observaciones">
            <Textarea rows={2} placeholder="notas de la operación…" />
          </Field>
          <Row label="checkbox + toggle">
            <Checkbox label="Reforzado" defaultChecked />
            <Checkbox label="Sin marcar" />
            <Checkbox label="Deshabilitado" disabled />
            <Toggle checked={toggleOn} onChange={setToggleOn} label="Tránsito corto (confirma ingreso a planta)" />
            <Toggle checked={false} onChange={() => {}} label="Deshabilitado" disabled />
          </Row>
        </Section>

        {/* ============ badges / chips ============ */}
        <Section title="Badge · StatusBadge · FilterChip">
          <Row label="badge tonal">
            <Badge tone="accent">accent</Badge>
            <Badge tone="verde">verde</Badge>
            <Badge tone="amarillo">amarillo</Badge>
            <Badge tone="rojo">rojo</Badge>
            <Badge tone="neutro">neutro</Badge>
            <Badge tone="accent" icon="ti-map-pin">BAHIA</Badge>
            <Badge tone="neutro" mono>142</Badge>
          </Row>
          <Row label="status badge (semáforo — solo el rojo pulsa con glow)">
            <StatusBadge estado="verde">en free time</StatusBadge>
            <StatusBadge estado="amarillo">vence &lt;72h</StatusBadge>
            <StatusBadge estado="rojo">en demora</StatusBadge>
            <StatusBadge estado="neutro">sin tarifa</StatusBadge>
          </Row>
          <Row label="filtros activos removibles">
            {filters.map((f) => (
              <FilterChip key={f} label={f} onRemove={() => setFilters((xs) => xs.filter((x) => x !== f))} />
            ))}
            {filters.length < 2 && (
              <Button variant="ghost" onClick={() => setFilters(["naviera: MAERSK", "semáforo: rojo"])}>
                restaurar filtros
              </Button>
            )}
          </Row>
        </Section>

        {/* ============ container number + kbd ============ */}
        <Section title="ContainerNumber · Kbd" note="recibe el string COMPLETO de la DB y separa internamente; un click selecciona todo">
          <Row>
            <ContainerNumber value="MSKU4829103" />
            <ContainerNumber value="TCNU7290518" className="text-[16px]" />
            <ContainerNumber value="ZIMU2648817" colorize={false} />
            <Kbd>⌘K</Kbd>
            <Kbd>ESC</Kbd>
            <Kbd>↵</Kbd>
          </Row>
        </Section>

        {/* ============ kpis + radial ============ */}
        <Section title="KpiCard · RadialTimer" note="count-up 1300ms al montar · gauge anima dasharray 800ms">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "var(--radius-panel)",
              overflow: "hidden",
              background: "var(--color-surface-1)",
            }}
          >
            <KpiCard label="contenedores activos" value={47} sub="en 2 plantas" />
            <KpiCard label="días de demora acum." value={23} sub="7 contenedores" amber />
            <KpiCard label="costo proyectado" value={4735} prefix="US$ " sub="si nada se devuelve hoy" critical />
            <KpiCard label="deadlines <72h" value={5} sub="próximo: sáb 09:00" amber />
          </div>
          <Row label="radial timer (verde parcial / ámbar con horas / rojo 100% crítico)">
            <RadialTimer pct={38} color="green" label="38%" size={56} />
            <RadialTimer pct={72} color="amber" label="31h" sublabel="restan" size={56} />
            <RadialTimer pct={100} color="red" label="+2d" sublabel="demora" size={56} />
          </Row>
        </Section>

        {/* ============ patrón de página: contrato de 4 estados ============ */}
        <Section title="Patrón de página — contrato de 4 estados" note="toda pantalla de módulo entrega estos 4 estados">
          <Tabs
            tabs={[
              { id: "carga", label: "carga" },
              { id: "vacio", label: "vacío" },
              { id: "error", label: "error" },
              { id: "poblado", label: "poblado", badge: OPS_DEMO.length },
            ]}
            active={patternState}
            onChange={(id) => setPatternState(id as PatternState)}
          />
          <DataTable<OpDemo>
            columns={COLS_DEMO}
            rows={patternState === "poblado" ? OPS_DEMO : []}
            rowKey={(r) => r.id}
            semaforo={(r) => r.semaforo}
            loading={patternState === "carga"}
            errorState={
              patternState === "error" ? (
                <ErrorState
                  detail="Falló la consulta a vista_alertas. Reintentá; si persiste, avisá a administración."
                  onRetry={() => setPatternState("poblado")}
                />
              ) : undefined
            }
            emptyState={
              <EmptyState icon="ti-list-details" title="Sin operaciones para los filtros" action={<Button variant="primary" icon="ti-plus" onClick={() => setPatternState("poblado")}>Registrar retiro</Button>}>
                Acá aparece la planilla global de contenedores con su semáforo de freetime. Los contenedores
                entran desde <strong>Ingreso</strong> al registrar una tanda de retiro y salen al confirmar
                devolución o embarque en <strong>Egreso</strong>.
              </EmptyState>
            }
            selection={{ ids: selection, onChange: setSelection }}
            defaultSort={{ key: "restantes", dir: "asc" }}
            pageSize={6}
            onRowClick={(r) => toast({ type: "info", title: r.numero, detail: "la ficha llega en M5" })}
          />
          <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-faint)" }}>
            DataTable: header sticky (con maxHeight), sort cyan, números right tabular-nums, dot semáforo +
            border-left rojo crítico, selección múltiple + contador, paginación, scroll-x propio en móvil.
          </p>
        </Section>

        {/* ============ validación por fila ============ */}
        <Section title="DataTable — slot de validación por fila" note="validación ISO 6346 real (lib/iso6346.ts) — caso tanda M3">
          <DataTable
            columns={[
              { key: "numero", header: "contenedor", render: (r) => <ContainerNumber value={r.numero} /> },
              { key: "naviera", header: "naviera", render: (r) => r.naviera },
            ]}
            rows={TANDA_DEMO}
            rowKey={(r) => r.id}
            validation={tandaValidation}
          />
        </Section>

        {/* ============ skeletons ============ */}
        <Section title="SkeletonRow" note="shimmer 1.4s + stagger 150ms, misma grilla que la fila real — nunca spinners">
          <div style={{ border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-input)", overflow: "hidden" }}>
            {[0, 1, 2].map((i) => (
              <SkeletonRow key={i} index={i} cols="150px 1fr 90px 110px" />
            ))}
          </div>
        </Section>

        {/* ============ timeline ============ */}
        <Section title="Timeline" note="anatomía 2c: fecha mono 96px · dot 12 + conector 2px · 4 estados">
          <div style={{ maxWidth: 560 }}>
            <Timeline items={TIMELINE_DEMO} />
          </div>
        </Section>

        {/* ============ meters ============ */}
        <Section title="ProgressBar · FreetimeMeter" note="namespace propio — lección v1: cero colisión con clases globales">
          <Row label="tonos">
            <div style={{ width: 160 }}><ProgressBar pct={35} tone="ok" /></div>
            <div style={{ width: 160 }}><ProgressBar pct={78} tone="warn" /></div>
            <div style={{ width: 160 }}><ProgressBar pct={100} tone="over" /></div>
            <div style={{ width: 160 }}><ProgressBar pct={100} tone="neutro" /></div>
          </Row>
          <Row label="freetime meter (semáforo por prop desde la DB · null = sin tarifa → neutro)">
            <div style={{ width: 220 }}><FreetimeMeter diasUsados={3} diasLibres={10} semaforo="verde" showLabel /></div>
            <div style={{ width: 220 }}><FreetimeMeter diasUsados={8} diasLibres={10} semaforo="amarillo" showLabel /></div>
            <div style={{ width: 220 }}><FreetimeMeter diasUsados={13} diasLibres={10} semaforo="rojo" showLabel /></div>
            <div style={{ width: 220 }}><FreetimeMeter diasUsados={13} diasLibres={null} semaforo="neutro" showLabel /></div>
          </Row>
        </Section>

        {/* ============ charts ============ */}
        <Section title="BarChart · TrendLine" note="SVG propio con tokens — consumidos por el dashboard M7">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            <div>
              <span className="fd-label">costo por naviera (USD)</span>
              <BarChart data={BARS_DEMO} formatValue={(v) => v.toLocaleString("es-AR")} color="var(--color-status-red-soft)" ariaLabel="costo por naviera" />
            </div>
            <div>
              <span className="fd-label">tendencia mensual (USD)</span>
              <TrendLine data={TREND_DEMO} ariaLabel="tendencia mensual de costo" />
            </div>
          </div>
        </Section>

        {/* ============ overlays ============ */}
        <Section title="Modal · ConfirmDialog · Toast · Dropdown · Tooltip · HelpPanel">
          <Row label="overlays">
            <Button variant="ghost" icon="ti-window" onClick={() => setModalOpen(true)}>Abrir modal</Button>
            <Button variant="danger" icon="ti-ban" onClick={() => setConfirmOpen(true)}>Confirmación danger</Button>
            <Button variant="ghost" icon="ti-help-circle" onClick={() => setHelpOpen(true)}>HelpPanel</Button>
          </Row>
          <Row label="toasts (apilables, auto-dismiss)">
            <Button variant="ghost" onClick={() => toast({ type: "exito", title: "Tanda registrada", detail: "8 contenedores · BAHIA" })}>éxito</Button>
            <Button variant="ghost" onClick={() => toast({ type: "error", title: "No se pudo confirmar", detail: "la operación ya tiene ciclo abierto" })}>error</Button>
            <Button variant="ghost" onClick={() => toast({ type: "info", title: "Realtime reconectado" })}>info</Button>
          </Row>
          <Row label="dropdown / popover / tooltip">
            <Dropdown
              trigger={(p) => (
                <Button variant="ghost" icon="ti-dots-vertical" onClick={p.toggle} aria-expanded={p["aria-expanded"]} aria-controls={p["aria-controls"]}>
                  Acciones
                </Button>
              )}
              header={<span className="fd-label">operación MSKU4829103</span>}
              items={[
                { id: "ver", label: "Ver ficha", icon: "ti-eye", onSelect: () => toast({ type: "info", title: "Ficha en M5" }) },
                { id: "mover", label: "Mover de planta", icon: "ti-transfer", onSelect: () => toast({ type: "info", title: "Movimiento en M5" }) },
                { id: "anular", label: "Anular operación", icon: "ti-ban", danger: true, divider: true, onSelect: () => setConfirmOpen(true) },
              ]}
            />
            <Popover
              width={240}
              trigger={(p) => (
                <Button variant="ghost" icon="ti-bell" onClick={p.toggle} aria-expanded={p["aria-expanded"]} aria-controls={p["aria-controls"]}>
                  Popover
                </Button>
              )}
            >
              <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--color-text-muted)" }}>
                Contenido libre — la campana del header lo usa para el dropdown de pendientes (M6).
              </div>
            </Popover>
            <Tooltip label="tooltip arriba">
              <Button variant="ghost">hover: tooltip ↑</Button>
            </Tooltip>
            <Tooltip label="tooltip abajo" side="bottom">
              <Button variant="ghost">hover: tooltip ↓</Button>
            </Tooltip>
          </Row>
        </Section>

        {/* ============ photo upload ============ */}
        <Section title="PhotoUpload" note="UI pura en M0 — items controlados con estados ok/subiendo/error; Storage llega en M9">
          <PhotoUpload
            items={photos}
            onAdd={(files) =>
              setPhotos((xs) => [
                ...xs,
                ...files.map((f, i) => ({
                  id: `n${Date.now()}-${i}`,
                  url: URL.createObjectURL(f),
                  name: f.name,
                  status: "pendiente" as const,
                })),
              ])
            }
            onRemove={(id) => setPhotos((xs) => xs.filter((x) => x.id !== id))}
          />
        </Section>

        {/* ============ markdown ============ */}
        <Section title="Markdown" note="subset seguro por construcción (sin innerHTML) — ayuda M10, preview del editor M8">
          <div style={{ maxWidth: 560 }}>
            <Markdown source={MD_DEMO} />
          </div>
        </Section>

        {/* ============ empty / error sueltos ============ */}
        <Section title="EmptyState · ErrorState" note="§15.3: el vacío explica QUÉ aparece acá y DESDE DÓNDE">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            <div style={{ border: "1px dashed var(--color-border-strong)", borderRadius: "var(--radius-panel)" }}>
              <EmptyState icon="ti-truck-return" title="No hay pendientes de terminal">
                Los contenedores que salen de planta aparecen acá hasta confirmar su ingreso a terminal, que
                corta el freetime.
              </EmptyState>
            </div>
            <div style={{ border: "1px dashed var(--color-border-strong)", borderRadius: "var(--radius-panel)" }}>
              <ErrorState detail="Sin conexión con la base. Los datos pueden estar desactualizados." onRetry={() => toast({ type: "info", title: "Reintentando…" })} />
            </div>
          </div>
        </Section>

        {/* ============ chrome de auth / gate ============ */}
        <Section
          title="GateFrame · CardIcon · FormAlert"
          note="chrome de auth/gate — consolidación #11, extracción pura (cero cambio visual)"
        >
          <Row label="card icon — tonal por estado (ámbar / rojo / verde / accent)">
            <CardIcon icon="ti-hourglass-high" color="var(--color-status-amber)" tint="var(--color-amber-tint)" line="var(--color-amber-line)" />
            <CardIcon icon="ti-user-x" color="var(--color-status-red)" tint="var(--color-red-tint)" line="var(--color-red-line)" />
            <CardIcon icon="ti-circle-check" color="var(--color-status-green)" tint="var(--color-green-tint)" line="var(--color-green-line)" />
            <CardIcon icon="ti-lock-cog" color="var(--color-accent-500)" tint="var(--color-accent-tint)" line="var(--color-accent-line)" />
          </Row>
          <Row label="form alert — error inline de formulario (login / registro / recuperar / reset)">
            <div style={{ width: "min(340px, 100%)" }}>
              <FormAlert>Correo o contraseña incorrectos.</FormAlert>
            </div>
          </Row>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="fd-label">gate frame — marco de compuerta (preview enmarcado; en prod ocupa el viewport)</span>
            <GateFrame
              style={{
                minHeight: 0,
                borderRadius: "var(--radius-panel)",
                border: "1px solid var(--color-border-strong)",
              }}
            >
              <div className="gate-card">
                <CardIcon icon="ti-hourglass-high" color="var(--color-status-amber)" tint="var(--color-amber-tint)" line="var(--color-amber-line)" />
                <h1 className="fd-display" style={{ fontSize: 17, margin: "4px 0 0", color: "var(--color-text-primary)" }}>
                  Tu cuenta espera aprobación
                </h1>
                <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.6, margin: 0, maxWidth: 340 }}>
                  Marco compartido por login, registro, recuperación, callback y las compuertas de sesión —
                  dot-logo «S», wordmark SSB·INTERNATIONAL y footer «CRM DETENTION · v2».
                </p>
              </div>
            </GateFrame>
          </div>
        </Section>

        {/* ============ tabs (referencia aislada) ============ */}
        <Section title="Tabs" note="navegación interna de pantalla (Admin M8)">
          <Tabs
            tabs={[
              { id: "solicitudes", label: "Solicitudes", badge: 3 },
              { id: "usuarios", label: "Usuarios" },
              { id: "navieras", label: "Navieras" },
              { id: "tarifas", label: "Tarifas" },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />
          <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)" }}>
            pestaña activa: <span className="mono">{activeTab}</span>
          </p>
        </Section>
      </div>

      {/* ---- overlays montados ---- */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Registrar egreso"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={() => {
                setModalOpen(false);
                toast({ type: "exito", title: "Egreso registrado", detail: "demo — sin datasource en M0" });
              }}
            >
              Confirmar egreso
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-text-secondary)" }}>
            Focus trap activo: Tab cicla adentro, ESC cierra, el backdrop también.
          </p>
          <Field label="destino">
            <Select defaultValue="terminal">
              <option value="terminal">Terminal (gate-in)</option>
              <option value="deposito">Devolución a depósito</option>
            </Select>
          </Field>
          <Field label="fecha de salida">
            <DateField defaultValue="2026-07-08" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Anular operación"
        message={
          <>
            Vas a anular la operación de <ContainerNumber value="MSKU4829103" />. La anulación es un soft
            delete: queda en el timeline y no borra historial. ¿Confirmás?
          </>
        }
        confirmLabel="Anular"
        danger
        loading={confirming}
        onConfirm={simulateConfirm}
        onCancel={() => setConfirmOpen(false)}
      />

      <HelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="DESIGN"
        footer={<span style={{ color: "var(--color-text-muted)" }}>Contenido editable desde Admin (M10).</span>}
      >
        <Markdown source={MD_DEMO} />
      </HelpPanel>
    </>
  );
}
