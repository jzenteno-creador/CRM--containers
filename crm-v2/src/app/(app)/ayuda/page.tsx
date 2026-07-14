"use client";

// /ayuda (M4 B3-B): banco completo de consultas. Las secciones salen de
// crm.ayuda_contenido (nivel='seccion', publicado), agrupadas por solapa y en el orden
// de las solapas. El copy se interpola con crm_ayuda_valores(null) — sin naviera, así el
// umbral es el real y los días/tarifa quedan en su frase genérica (el front NUNCA
// hardcodea un número). Buscador client-side + deep-link ?seccion=. Degradación: si la
// tabla no responde (024 sin aplicar), ErrorState con retry — nada crashea.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { Input } from "@/components/fd/fields";
import { Markdown } from "@/components/fd/markdown";
import { PageHeader } from "@/components/fd/page-header";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { Tabs, type TabDef } from "@/components/fd/tabs";
import { interpolarAyuda, type AyudaValores } from "@/lib/ayuda";
import { getSupabase } from "@/lib/supabase";

type SectionItem = { seccion: string; titulo: string; contenido_md: string; orden: number };

// Orden y etiqueta de las secciones = orden de las solapas del shell (inicio→dashboard).
// Las secciones que aparezcan en la DB fuera de esta lista se agregan al final.
const SECTION_META: { seccion: string; label: string; icon: string }[] = [
  { seccion: "dashboard", label: "Inicio", icon: "ti-layout-dashboard" },
  { seccion: "ingreso", label: "Ingreso", icon: "ti-login-2" },
  { seccion: "egreso", label: "Egreso", icon: "ti-logout-2" },
  { seccion: "bookings", label: "Bookings", icon: "ti-anchor" },
  { seccion: "contenedores", label: "Contenedores", icon: "ti-list-details" },
  { seccion: "alertas", label: "Alertas", icon: "ti-bell" },
  { seccion: "incidencias", label: "Incidencias", icon: "ti-alert-triangle" },
  { seccion: "admin", label: "Admin", icon: "ti-settings" },
];

function labelOf(seccion: string): string {
  return SECTION_META.find((s) => s.seccion === seccion)?.label ?? seccion;
}

// normaliza para búsqueda: sin acentos, minúsculas (matchea "devolucion" con "devolución")
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function AyudaSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div className="fd-panel" key={i}>
          <div className="fd-panel-title">
            <SkeletonBlock width={200} height={13} delay={i * 120} />
          </div>
          <div className="fd-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SkeletonBlock width="90%" delay={i * 120 + 80} />
            <SkeletonBlock width="75%" delay={i * 120 + 160} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Una consulta: título + copy interpolado, en un panel del design system. */
function TemaPanel({ item, valores }: { item: SectionItem; valores: AyudaValores | null }) {
  const texto = useMemo(() => interpolarAyuda(item.contenido_md, valores), [item.contenido_md, valores]);
  return (
    <div className="fd-panel">
      <div className="fd-panel-title">
        <i className="ti ti-help-circle" aria-hidden style={{ color: "var(--color-accent-500)" }} />
        <span>{item.titulo}</span>
        <span className="fd-count">{labelOf(item.seccion)}</span>
      </div>
      <div className="fd-panel-body">
        <Markdown source={texto} />
      </div>
    </div>
  );
}

function AyudaPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const seccionParam = searchParams.get("seccion");

  const [items, setItems] = useState<SectionItem[] | null>(null);
  const [valores, setValores] = useState<AyudaValores | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [active, setActive] = useState<string>(seccionParam ?? SECTION_META[0].seccion);
  const [query, setQuery] = useState("");

  // re-sync si el ?seccion= cambia con la página ya montada (footer del panel "?" del
  // shell → /ayuda?seccion=X estando ya en /ayuda). Ajuste durante el render, no efecto.
  const [lastParam, setLastParam] = useState(seccionParam);
  if (seccionParam !== lastParam) {
    setLastParam(seccionParam);
    if (seccionParam) {
      setActive(seccionParam);
      setQuery("");
    }
  }

  const load = useCallback(async () => {
    const supabase = getSupabase();
    setLoadError(null);
    const [s, v] = await Promise.all([
      supabase
        .from("ayuda_contenido")
        .select("seccion, titulo, contenido_md, orden")
        .eq("nivel", "seccion")
        .eq("publicado", true)
        .order("seccion", { ascending: true })
        .order("orden", { ascending: true }),
      supabase.rpc("crm_ayuda_valores", {}),
    ]);
    if (s.error) {
      setItems(null);
      setLoadError(s.error.message);
      return;
    }
    // valores best-effort: si la RPC falla, los {{...}} quedan literales (no crashea)
    setValores(v.error ? null : (v.data as AyudaValores | null));
    setItems((s.data as SectionItem[]) ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // solapas: orden canónico primero, luego secciones extra que aparezcan en la DB
  const tabs: TabDef[] = useMemo(() => {
    const byS = new Map<string, number>();
    for (const it of items ?? []) byS.set(it.seccion, (byS.get(it.seccion) ?? 0) + 1);
    const canon = SECTION_META.map((m) => ({ id: m.seccion, label: m.label, badge: byS.get(m.seccion) }));
    const extras = [...byS.keys()]
      .filter((k) => !SECTION_META.some((m) => m.seccion === k))
      .map((k) => ({ id: k, label: labelOf(k), badge: byS.get(k) }));
    return [...canon, ...extras];
  }, [items]);

  const q = query.trim();
  const searching = q.length > 0;

  const searchResults = useMemo(() => {
    if (!searching || !items) return [];
    const nq = norm(q);
    return items.filter((it) => norm(it.titulo).includes(nq) || norm(interpolarAyuda(it.contenido_md, valores)).includes(nq));
  }, [searching, q, items, valores]);

  const activeItems = useMemo(
    () => (items ?? []).filter((it) => it.seccion === active),
    [items, active],
  );

  const selectTab = (id: string) => {
    setActive(id);
    setQuery("");
    router.replace(`/ayuda?seccion=${encodeURIComponent(id)}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title="Ayuda"
        counters={
          items ? (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {items.length} {items.length === 1 ? "consulta" : "consultas"}
            </span>
          ) : undefined
        }
      />

      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.55 }}>
        El banco completo de consultas del sistema: qué hace cada solapa, qué completa cada campo y el flujo de trabajo.
        Buscá por palabra o navegá por solapa.
      </p>

      {/* buscador client-side */}
      <div style={{ position: "relative", maxWidth: 380, marginBottom: 14 }}>
        <i
          className="ti ti-search"
          aria-hidden
          style={{
            position: "absolute",
            left: 11,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--color-text-faint)",
            fontSize: 15,
            pointerEvents: "none",
          }}
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en la ayuda…"
          aria-label="buscar en la ayuda"
          style={{ paddingLeft: 34, width: "100%" }}
        />
      </div>

      {!searching && <Tabs tabs={tabs} active={active} onChange={selectTab} className="fd-ayuda-tabs" />}

      <div style={{ marginTop: 16 }}>
        {loadError ? (
          <div className="fd-panel">
            <ErrorState
              title="No se pudo cargar la ayuda"
              detail={loadError}
              onRetry={() => void load()}
            />
          </div>
        ) : items === null ? (
          <AyudaSkeleton />
        ) : searching ? (
          searchResults.length === 0 ? (
            <div className="fd-panel">
              <EmptyState icon="ti-search-off" title="Sin resultados">
                No hay consultas que coincidan con <strong>{q}</strong>. Probá con otra palabra o navegá por solapa
                borrando la búsqueda.
              </EmptyState>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="fd-label">
                {searchResults.length} {searchResults.length === 1 ? "resultado" : "resultados"} para “{q}”
              </div>
              {searchResults.map((it) => (
                <TemaPanel key={`${it.seccion}-${it.titulo}`} item={it} valores={valores} />
              ))}
            </div>
          )
        ) : activeItems.length === 0 ? (
          <div className="fd-panel">
            <EmptyState icon="ti-file-off" title="Sección sin contenido publicado">
              Todavía no hay consultas publicadas para <strong>{labelOf(active)}</strong>. El contenido se edita desde{" "}
              <span className="mono">Admin → Ayuda</span>.
            </EmptyState>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {activeItems.map((it) => (
              <TemaPanel key={`${it.seccion}-${it.titulo}`} item={it} valores={valores} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// useSearchParams exige un límite de Suspense en build estático (Next 16 — ver AGENTS.md).
export default function AyudaPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Ayuda" />
          <AyudaSkeleton />
        </>
      }
    >
      <AyudaPageContent />
    </Suspense>
  );
}
