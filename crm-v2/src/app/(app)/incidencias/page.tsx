"use client";

// Incidencias (B5, migración 030): alta con fotos + ciclo de reclamo (monto, responsable,
// estado_reclamo). Una pantalla, dos secciones (patrón M3/M4): <AltaIncidenciaForm> arriba,
// historial abajo con búsqueda por contenedor + filtros de tipo/estado del reclamo, y el
// panel de gestión (<ReclamoModal>) al click en una fila.
// - Fotos SIEMPRE por signed URLs del bucket privado crm-incidencias (1h) — cero URLs
//   públicas de Storage (plan M7, regla dura 1). Firma en batch tras cada load.
// - "por {nombre}" sale de usuarios_publicos (view §14) mapeada por usuario_id.
// - CERO cálculo de negocio: el evento del timeline lo escribe la RPC/el trigger de la DB.
//   Los KPIs de arriba son una SUMA/CONTEO informativo de las filas YA TRAÍDAS y filtradas
//   (rotulados "de lo filtrado") — no una agregación de negocio nueva.
// Patrón de página del repo (espejo /contenedores): load() callback, anti-carrera por
// reqId, refetch al recuperar foco, 4 estados en la tabla, paginación client-side.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { ContainerNumber } from "@/components/container-number";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { Field, Input, Select } from "@/components/fd/fields";
import { KpiCard } from "@/components/fd/kpi-card";
import { Modal } from "@/components/fd/modal";
import { PageHeader } from "@/components/fd/page-header";
import { fmtFecha, fmtUSD } from "@/lib/format";
import { normalizarNumero } from "@/lib/iso6346";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { AltaIncidenciaForm } from "./alta-form";
import { ReclamoModal, type IncidenciaDetalle } from "./reclamo-modal";
import {
  BUCKET_INCIDENCIAS,
  ESTADO_RECLAMO_OPTIONS,
  EstadoReclamoBadge,
  FotoThumb,
  TIPO_INCIDENCIA_OPTIONS_ALL,
  TipoIncidenciaBadge,
  type FotoUrl,
} from "./shared";

type IncidenciaRow = IncidenciaDetalle;

// cap de fetch (el volumen esperado de incidencias es bajo; la búsqueda refina server-side)
const FETCH_CAP = 200;

// !inner en AMBOS niveles del embed: necesario para que el ilike sobre la columna
// anidada (operacion.contenedor.numero_contenedor) filtre las filas raíz.
const SELECT_HISTORIAL =
  "id, tipo, descripcion, fecha, usuario_id, numero_orden, monto_usd, responsable, estado_reclamo, resultado, fecha_reclamo, fecha_resolucion, operacion:operaciones!inner(id, contenedor:contenedores!inner(id, numero_contenedor), planta_actual:plantas(nombre)), fotos:incidencia_fotos(id, storage_path)";

// grilla compartida por los KPIs (mismo patrón que /inicio: min 210px por celda)
const KPI_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: "var(--radius-panel)",
  overflow: "hidden",
  background: "var(--color-surface-1)",
  marginBottom: 20,
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

/* ---------- página ---------- */

export default function IncidenciasPage() {
  const router = useRouter();
  const { perfil } = useSession();

  const [rows, setRows] = useState<IncidenciaRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<Record<string, string>>({});
  // null = firmando el batch; las claves ausentes muestran skeleton en el thumb
  const [fotoUrls, setFotoUrls] = useState<Record<string, FotoUrl> | null>(null);
  const reqIdRef = useRef(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");

  // modal de foto grande (misma signed URL del thumbnail, vigente 1h) — usado desde la
  // tabla; el panel de gestión abre las suyas en una pestaña nueva (evita anidar modales).
  const [verFoto, setVerFoto] = useState<{ url: string; numero: string; fecha: string } | null>(null);
  // panel de gestión de reclamo: la fila completa (ya la tenemos cargada, sin refetch)
  const [gestionRow, setGestionRow] = useState<IncidenciaRow | null>(null);

  // debounce 300ms (mismo patrón que /contenedores)
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const sane = search.trim().replace(/[,()"'\\*]/g, "");
  const searchActive = sane.length >= 2;

  const load = useCallback(async () => {
    const rid = ++reqIdRef.current;
    let q = getSupabase().from("incidencias").select(SELECT_HISTORIAL);
    if (searchActive) q = q.ilike("operacion.contenedor.numero_contenedor", `%${normalizarNumero(sane)}%`);
    if (tipoFilter) q = q.eq("tipo", tipoFilter);
    if (estadoFilter) q = q.eq("estado_reclamo", estadoFilter);

    const [inc, us] = await Promise.all([
      q.order("fecha", { ascending: false }).limit(FETCH_CAP),
      getSupabase().from("usuarios_publicos").select("id, nombre"),
    ]);
    if (rid !== reqIdRef.current) return; // llegó tarde: hay otro load en vuelo

    const firstError = inc.error ?? us.error;
    if (firstError) {
      setRows(null);
      setLoadError(firstError.message);
      return;
    }
    const nextRows = inc.data as unknown as IncidenciaRow[];
    const userMap: Record<string, string> = {};
    for (const u of (us.data ?? []) as { id: string; nombre: string }[]) userMap[u.id] = u.nombre;
    setLoadError(null);
    setUsuarios(userMap);
    setRows(nextRows);
    // el panel de gestión (si estaba abierto) refleja los datos frescos, o se cierra si
    // la fila salió del recorte de filtros vigente
    setGestionRow((g) => (g ? (nextRows.find((r) => r.id === g.id) ?? null) : null));

    // firmar TODOS los paths en un batch (bucket privado → nunca URL pública)
    const paths = nextRows.flatMap((r) => r.fotos.map((f) => f.storage_path));
    if (paths.length === 0) {
      setFotoUrls({});
      return;
    }
    setFotoUrls(null);
    const signed = await getSupabase().storage.from(BUCKET_INCIDENCIAS).createSignedUrls(paths, 3600);
    if (rid !== reqIdRef.current) return;
    const map: Record<string, FotoUrl> = {};
    if (signed.error) {
      // firma global caída: placeholders tolerantes con el motivo — el historial sigue usable
      for (const p of paths) map[p] = { url: null, error: signed.error.message };
    } else {
      signed.data.forEach((d, i) => {
        map[paths[i]] = { url: d.signedUrl ?? null, error: d.error };
      });
    }
    setFotoUrls(map);
  }, [sane, searchActive, tipoFilter, estadoFilter]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // refetch al recuperar foco (mismo criterio que /ingreso, /egreso, /contenedores)
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const loading = rows === null && !loadError;

  // KPIs "de lo filtrado": suma/conteo simple sobre las filas YA traídas — cero cálculo de
  // negocio nuevo (el monto y el resultado ya viven en la fila; esto solo los agrega).
  const totalMonto = useMemo(
    () => (rows ?? []).reduce((acc, r) => acc + (r.monto_usd ?? 0), 0),
    [rows],
  );
  const nRecuperado = useMemo(() => (rows ?? []).filter((r) => r.resultado === "recuperado").length, [rows]);
  const nNoRecuperado = useMemo(() => (rows ?? []).filter((r) => r.resultado === "no_recuperado").length, [rows]);

  const cols: Column<IncidenciaRow>[] = [
    {
      key: "contenedor",
      header: "contenedor",
      render: (r) =>
        r.operacion?.contenedor ? <ContainerNumber value={r.operacion.contenedor.numero_contenedor} /> : "—",
      sortValue: (r) => r.operacion?.contenedor?.numero_contenedor ?? null,
    },
    {
      key: "tipo",
      header: "tipo",
      render: (r) => <TipoIncidenciaBadge tipo={r.tipo} />,
      sortValue: (r) => r.tipo,
    },
    {
      key: "orden",
      header: "orden",
      render: (r) => (r.numero_orden ? <span className="mono">{r.numero_orden}</span> : "—"),
      sortValue: (r) => r.numero_orden,
    },
    {
      key: "estado_reclamo",
      header: "reclamo",
      render: (r) => <EstadoReclamoBadge estado={r.estado_reclamo} resultado={r.resultado} />,
      sortValue: (r) => r.estado_reclamo,
    },
    {
      key: "monto",
      header: "monto",
      numeric: true,
      render: (r) => fmtUSD(r.monto_usd),
      sortValue: (r) => r.monto_usd,
    },
    {
      key: "fecha",
      header: "fecha",
      numeric: true,
      render: (r) => fmtFecha(r.fecha),
      sortValue: (r) => r.fecha,
    },
    {
      key: "responsable",
      header: "responsable",
      render: (r) => r.responsable ?? "—",
      sortValue: (r) => r.responsable,
      hideOnMobile: true,
    },
    {
      key: "descripcion",
      header: "descripción",
      render: (r) => (
        <span
          title={r.descripcion ?? undefined}
          style={{
            display: "block",
            maxWidth: 280,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {r.descripcion ?? "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "planta",
      header: "planta",
      render: (r) => r.operacion?.planta_actual?.nombre ?? "—",
      sortValue: (r) => r.operacion?.planta_actual?.nombre ?? null,
      hideOnMobile: true,
    },
    {
      key: "usuario",
      header: "por",
      render: (r) => (r.usuario_id ? (usuarios[r.usuario_id] ?? "—") : "—"),
      sortValue: (r) => (r.usuario_id ? (usuarios[r.usuario_id] ?? null) : null),
      hideOnMobile: true,
    },
    {
      key: "fotos",
      header: "fotos",
      hideOnMobile: true,
      render: (r) => {
        if (r.fotos.length === 0) return "—";
        const numero = r.operacion?.contenedor?.numero_contenedor ?? "contenedor";
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
            {r.fotos.map((f) => (
              <FotoThumb
                key={f.id}
                urlInfo={fotoUrls === null ? undefined : fotoUrls[f.storage_path]}
                nombre={numero}
                onOpen={(url) => setVerFoto({ url, numero, fecha: fmtFecha(r.fecha) })}
              />
            ))}
          </div>
        );
      },
    },
  ];

  const count = rows?.length ?? null;
  const filtersActive = tipoFilter !== "" || estadoFilter !== "";

  return (
    <>
      <PageHeader
        title="Incidencias"
        counters={
          count != null ? (
            <>
              <Badge tone="neutro" mono icon="ti-alert-triangle">
                {count} incidencia{count === 1 ? "" : "s"}
              </Badge>
              {count >= FETCH_CAP && (
                <Badge tone="amarillo" icon="ti-alert-triangle">
                  se muestran las últimas {FETCH_CAP} — refiná con la búsqueda
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

      <SectionTitle title="Registrar incidencia" count={null} />
      {perfil ? (
        <AltaIncidenciaForm onCreated={() => void load()} />
      ) : (
        <DataTable columns={[]} rows={[]} rowKey={() => ""} loading skeletonRows={3} />
      )}

      <SectionTitle title="Historial y reclamos" count={count} />

      {/* KPIs de lo filtrado — suma/conteo sobre las filas ya traídas, nunca cálculo nuevo */}
      <div style={KPI_GRID}>
        <KpiCard label="monto · de lo filtrado" value={Math.round(totalMonto)} prefix="USD " sub="suma de los montos cargados" />
        <KpiCard label="recuperado · de lo filtrado" value={nRecuperado} sub="reclamos resueltos a favor" />
        <KpiCard label="no recuperado · de lo filtrado" value={nNoRecuperado} amber={nNoRecuperado > 0} sub="reclamos resueltos en contra" />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <div style={{ maxWidth: 320, flex: "1 1 220px" }}>
          <Field label="buscar por contenedor" htmlFor="inc-hist-search" hint="mínimo 2 caracteres">
            <Input
              id="inc-hist-search"
              value={searchInput}
              placeholder="MSKU1234565…"
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </Field>
        </div>
        <div style={{ maxWidth: 220, flex: "1 1 160px" }}>
          <Field label="tipo" htmlFor="inc-hist-tipo">
            <Select id="inc-hist-tipo" value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)}>
              <option value="">— todos —</option>
              {TIPO_INCIDENCIA_OPTIONS_ALL.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div style={{ maxWidth: 220, flex: "1 1 160px" }}>
          <Field label="estado del reclamo" htmlFor="inc-hist-estado">
            <Select id="inc-hist-estado" value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}>
              <option value="">— todos —</option>
              {ESTADO_RECLAMO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <DataTable
        columns={cols}
        rows={rows ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        skeletonRows={6}
        pageSize={10}
        maxHeight={560}
        defaultSort={{ key: "fecha", dir: "desc" }}
        onRowClick={(r) => setGestionRow(r)}
        errorState={
          loadError ? (
            <ErrorState title="No se pudo cargar el historial" detail={loadError} onRetry={() => void load()} />
          ) : undefined
        }
        emptyState={
          searchActive || filtersActive ? (
            <EmptyState icon="ti-search" title="Sin incidencias para este filtro">
              Probá con otro contenedor, o limpiá la búsqueda y los filtros de tipo/estado para ver el historial
              completo.
            </EmptyState>
          ) : (
            <EmptyState icon="ti-alert-triangle" title="Todavía no hay incidencias">
              Acá queda el registro de cada avería, lavado exigido u otro evento sobre un contenedor: quién lo
              reportó, cuándo, con su descripción y sus fotos. Se cargan desde el formulario de arriba buscando el
              contenedor de una operación abierta. Cuando la incidencia implica un costo, hacé click en la fila para
              gestionar el reclamo (monto, responsable y estado) — cada incidencia aparece también en el historial de
              la ficha del contenedor.
            </EmptyState>
          )
        }
      />

      {/* modal de foto grande — misma signed URL del thumbnail (solo desde la tabla) */}
      <Modal
        open={verFoto !== null}
        onClose={() => setVerFoto(null)}
        title={
          verFoto ? (
            <span>
              Foto de incidencia — <span className="mono">{verFoto.numero}</span> · {verFoto.fecha}
            </span>
          ) : undefined
        }
        width={760}
      >
        {verFoto && (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL efímera de Storage, next/image no aplica
          <img
            src={verFoto.url}
            alt={`foto de incidencia de ${verFoto.numero}`}
            style={{ display: "block", width: "100%", maxHeight: "70vh", objectFit: "contain" }}
          />
        )}
      </Modal>

      {/* panel de gestión de reclamo */}
      {gestionRow && perfil && (
        <ReclamoModal
          incidencia={gestionRow}
          fotoUrls={fotoUrls}
          usuarios={usuarios}
          perfil={perfil}
          onClose={() => setGestionRow(null)}
          onUpdated={() => {
            setGestionRow(null);
            void load();
          }}
          onVerFicha={
            gestionRow.operacion?.contenedor
              ? () => router.push(`/contenedores/${gestionRow.operacion!.contenedor!.id}`)
              : undefined
          }
        />
      )}
    </>
  );
}
