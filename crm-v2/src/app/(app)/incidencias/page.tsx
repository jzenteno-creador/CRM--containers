"use client";

// Incidencias (M7 §6.3.9): alta con fotos + historial. Una pantalla, dos secciones
// (patrón M3/M4): <AltaIncidenciaForm> arriba, historial abajo con búsqueda por
// contenedor (debounce 300ms server-side), thumbnails y modal de foto grande.
// - Fotos SIEMPRE por signed URLs del bucket privado crm-incidencias (1h) — cero URLs
//   públicas de Storage (plan M7, regla dura 1). Firma en batch tras cada load.
// - "por {nombre}" sale de usuarios_publicos (view §14) mapeada por usuario_id.
// - CERO cálculo de negocio: el evento del timeline lo escribe el trigger de la DB.
// Patrón de página del repo (espejo /contenedores): load() callback, anti-carrera por
// reqId, refetch al recuperar foco, 4 estados en la tabla, paginación client-side.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { ContainerNumber } from "@/components/container-number";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { Field, Input } from "@/components/fd/fields";
import { Modal } from "@/components/fd/modal";
import { PageHeader } from "@/components/fd/page-header";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { fmtFecha } from "@/lib/format";
import { normalizarNumero } from "@/lib/iso6346";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { AltaIncidenciaForm } from "./alta-form";
import { BUCKET_INCIDENCIAS, TipoIncidenciaBadge } from "./shared";

type FotoRow = { id: string; storage_path: string };

type IncidenciaRow = {
  id: string;
  tipo: string;
  descripcion: string | null;
  fecha: string;
  usuario_id: string | null;
  operacion: {
    id: string;
    contenedor: { id: string; numero_contenedor: string } | null;
    planta_actual: { nombre: string } | null;
  } | null;
  fotos: FotoRow[];
};

/** Resultado de firmar un path: url lista, o error para el placeholder tolerante. */
type FotoUrl = { url: string | null; error: string | null };

// cap de fetch (el volumen esperado de incidencias es bajo; la búsqueda refina server-side)
const FETCH_CAP = 200;

// !inner en AMBOS niveles del embed: necesario para que el ilike sobre la columna
// anidada (operacion.contenedor.numero_contenedor) filtre las filas raíz.
const SELECT_HISTORIAL =
  "id, tipo, descripcion, fecha, usuario_id, operacion:operaciones!inner(id, contenedor:contenedores!inner(id, numero_contenedor), planta_actual:plantas(nombre)), fotos:incidencia_fotos(id, storage_path)";

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

/* ---------- thumbnail de foto (skeleton mientras se firma / placeholder si falla) ---------- */

function FotoThumb({
  urlInfo,
  nombre,
  onOpen,
}: {
  /** undefined = la firma del batch todavía no llegó. */
  urlInfo: FotoUrl | undefined;
  nombre: string;
  onOpen: (url: string) => void;
}) {
  if (urlInfo === undefined) {
    return <SkeletonBlock width={30} height={30} style={{ borderRadius: 6, display: "inline-block" }} />;
  }
  if (urlInfo.url === null) {
    return (
      <span
        title={`No se pudo cargar la foto: ${urlInfo.error ?? "enlace inválido"}`}
        aria-label="foto no disponible"
        style={{
          width: 30,
          height: 30,
          display: "inline-grid",
          placeItems: "center",
          borderRadius: 6,
          border: "1px solid var(--color-border-strong)",
          background: "var(--color-surface-2)",
          color: "var(--color-text-faint)",
          fontSize: 14,
        }}
      >
        <i className="ti ti-photo-off" aria-hidden />
      </span>
    );
  }
  const url = urlInfo.url;
  return (
    <button
      type="button"
      aria-label={`ver foto de ${nombre}`}
      onClick={(e) => {
        e.stopPropagation(); // la fila navega a la ficha; el thumb abre el modal
        onOpen(url);
      }}
      style={{
        width: 30,
        height: 30,
        minHeight: 0,
        padding: 0,
        borderRadius: 6,
        border: "1px solid var(--color-border-strong)",
        overflow: "hidden",
        background: "var(--color-surface-2)",
        cursor: "zoom-in",
        flexShrink: 0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs efímeras de Storage, next/image no aplica */}
      <img src={url} alt={`foto de ${nombre}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </button>
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

  // modal de foto grande (misma signed URL del thumbnail, vigente 1h)
  const [verFoto, setVerFoto] = useState<{ url: string; numero: string; fecha: string } | null>(null);

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
  }, [sane, searchActive]);

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
      key: "descripcion",
      header: "descripción",
      render: (r) => (
        <span
          title={r.descripcion ?? undefined}
          style={{
            display: "block",
            maxWidth: 340,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {r.descripcion ?? "—"}
        </span>
      ),
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
      key: "fecha",
      header: "fecha",
      numeric: true,
      render: (r) => fmtFecha(r.fecha),
      sortValue: (r) => r.fecha,
    },
    {
      key: "fotos",
      header: "fotos",
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
        <AltaIncidenciaForm perfil={perfil} onCreated={() => void load()} />
      ) : (
        <DataTable columns={[]} rows={[]} rowKey={() => ""} loading skeletonRows={3} />
      )}

      <SectionTitle title="Historial" count={count} />

      <div style={{ maxWidth: 420, marginBottom: 12 }}>
        <Field label="buscar por contenedor" htmlFor="inc-hist-search" hint="mínimo 2 caracteres">
          <Input
            id="inc-hist-search"
            value={searchInput}
            placeholder="MSKU1234565…"
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </Field>
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
        onRowClick={(r) => {
          if (r.operacion?.contenedor) router.push(`/contenedores/${r.operacion.contenedor.id}`);
        }}
        errorState={
          loadError ? (
            <ErrorState title="No se pudo cargar el historial" detail={loadError} onRetry={() => void load()} />
          ) : undefined
        }
        emptyState={
          searchActive ? (
            <EmptyState icon="ti-search" title={`Sin incidencias para «${sane}»`}>
              La búsqueda cubre el número de contenedor de la operación. Probá con otro término, o limpiá el campo para
              ver el historial completo.
            </EmptyState>
          ) : (
            <EmptyState icon="ti-alert-triangle" title="Todavía no hay incidencias">
              Acá queda el registro de cada avería u otro evento sobre un contenedor: quién lo reportó, cuándo, con su
              descripción y sus fotos. Se cargan desde el formulario de arriba buscando el contenedor de una operación
              abierta; cada incidencia aparece también en el historial de la ficha del contenedor.
            </EmptyState>
          )
        }
      />

      {/* modal de foto grande — misma signed URL del thumbnail */}
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
    </>
  );
}
