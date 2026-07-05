"use client";

// Alertas — triage Flight Deck (artboard 2d).
// REGLA DURA: todo número mostrado sale de vista_alertas (la DB calcula días, costos y
// semáforo en America/Argentina/Buenos_Aires). Acá SOLO se agrupa y se deriva presentación
// (pct de timers, horas = días × 24). Cero matemática de fechas nueva en el front.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/session-context";
import { Vacio, ErrorMsg, Semaforo, Paginacion, FreetimeMeter } from "@/components/ui";
import { fmtUSD, fmtFecha, hoyAR, ESTADO_LABELS } from "@/lib/format";
import { descargarCSV, type ColumnaCSV } from "@/lib/export-csv";
import { ContainerNumber } from "@/components/container-number";
import { RadialTimer } from "@/components/fd/radial-timer";
import { KpiCard } from "@/components/fd/kpi-card";
import { SkeletonRow, SkeletonRowsTable } from "@/components/fd/skeleton-row";
import type { VistaAlerta, Naviera } from "@/lib/types";

const PAGE_SIZE = 50;
const UMBRAL_DEFAULT = 3;
// Las abiertas hoy son ~70; el cap es un fusible, no una paginación (si se alcanza, se avisa)
const MAX_FILAS = 500;

type FiltroSemaforo = "todos" | "verde" | "amarillo" | "rojo" | "neutro";

// FE-04: columnas ordenables de la tabla "listado completo" (headers clickeables)
type ColumnaOrdenable =
  | "numero_contenedor"
  | "naviera"
  | "planta_actual"
  | "dias_estadia"
  | "dias_restantes"
  | "costo_proyectado"
  | "estado_semaforo";

// severidad operativa: rojo primero cuando el orden es ascendente
const SEMAFORO_RANK: Record<VistaAlerta["estado_semaforo"], number> = {
  rojo: 0,
  amarillo: 1,
  verde: 2,
  neutro: 3,
};

function valorOrdenable(fila: VistaAlerta, col: ColumnaOrdenable): string | number | null {
  if (col === "estado_semaforo") return SEMAFORO_RANK[fila.estado_semaforo];
  return fila[col];
}

function compararOrdenable(a: string | number | null, b: string | number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls siempre al final, sin importar la dirección
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "es", { sensitivity: "base" });
}

// F-01: columnas del export CSV (mismos campos reales de VistaAlerta)
const COLUMNAS_CSV: ColumnaCSV[] = [
  { key: "numero_contenedor", label: "N° Contenedor" },
  { key: "naviera", label: "Naviera" },
  { key: "planta_actual", label: "Planta" },
  { key: "estado", label: "Estado" },
  { key: "fecha_retiro", label: "Fecha Retiro" },
  { key: "dias_estadia", label: "Días Estadía" },
  { key: "dias_libres", label: "Días Libres" },
  { key: "dias_restantes", label: "Días Restantes" },
  { key: "tarifa_usd_dia", label: "Tarifa USD/Día" },
  { key: "costo_proyectado", label: "Costo Proyectado USD" },
  { key: "estado_semaforo", label: "Semáforo" },
];

export default function AlertasPage() {
  const session = useSession();

  const [filas, setFilas] = useState<VistaAlerta[]>([]);
  const [page, setPage] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [umbral, setUmbral] = useState<number>(UMBRAL_DEFAULT);
  const [navieras, setNavieras] = useState<Naviera[]>([]);
  const [fSemaforo, setFSemaforo] = useState<FiltroSemaforo>("todos");
  const [fNaviera, setFNaviera] = useState<string>("");
  // Contador de refetch: lo incrementan realtime y el botón reintentar
  const [tick, setTick] = useState(0);
  // FE-06: timer del trailing-debounce del realtime (ver efecto de suscripción más abajo)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FE-04: orden client-side de la tabla "listado completo"
  const [sortCol, setSortCol] = useState<ColumnaOrdenable | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Umbral configurable + catálogo de navieras (una sola vez)
  useEffect(() => {
    let vivo = true;
    (async () => {
      const [rCfg, rNav] = await Promise.all([
        supabase
          .from("configuracion")
          .select("valor")
          .eq("clave", "umbral_alerta_amarillo")
          .maybeSingle(),
        supabase.from("navieras").select("id, nombre").order("nombre"),
      ]);
      if (!vivo) return;
      const dias = (rCfg.data?.valor as { dias?: number } | null)?.dias;
      if (typeof dias === "number") setUmbral(dias);
      if (rNav.data) setNavieras(rNav.data as Naviera[]);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Fetch ÚNICO de todas las abiertas (el triage agrupa client-side; la vista solo trae abiertas)
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        let q = supabase
          .from("vista_alertas")
          .select("*")
          .order("dias_restantes", { ascending: true, nullsFirst: false })
          .order("numero_contenedor", { ascending: true })
          .limit(MAX_FILAS);
        if (session.rol === "operador" && session.plantaNombre) {
          q = q.eq("planta_actual", session.plantaNombre);
        }
        if (fNaviera) q = q.eq("naviera", fNaviera);
        const { data, error: err } = await q;
        if (!vivo) return;
        if (err) throw err;
        setError(null);
        setFilas((data ?? []) as VistaAlerta[]);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : "error cargando alertas");
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [fNaviera, session.rol, session.plantaNombre, tick]);

  // Realtime: cambios en operaciones → refetch (incrementa tick).
  // FE-06: trailing-debounce 350ms — varios eventos por fila se acumulan en un solo refetch.
  useEffect(() => {
    const ch = supabase
      .channel("alertas-operaciones")
      .on(
        "postgres_changes",
        { event: "*", schema: "detention", table: "operaciones" },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            debounceRef.current = null;
            setTick((t) => t + 1);
          }, 350);
        },
      )
      .subscribe();
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      void supabase.removeChannel(ch);
    };
  }, []);

  // ---- agrupación por semáforo de la DB (sin recalcular nada) ----
  const grupos = useMemo(() => {
    const rojos = filas.filter((f) => f.estado_semaforo === "rojo");
    const amarillos = filas.filter((f) => f.estado_semaforo === "amarillo");
    const horizonte = filas.filter(
      (f) => f.estado_semaforo === "verde" && f.dias_restantes != null && f.dias_restantes <= 7,
    );
    const verdesLejos = filas.filter(
      (f) => f.estado_semaforo === "verde" && (f.dias_restantes == null || f.dias_restantes > 7),
    ).length;
    const neutros = filas.filter((f) => f.estado_semaforo === "neutro").length;
    const costo = filas.reduce((s, f) => s + (f.costo_proyectado ?? 0), 0);
    return { rojos, amarillos, horizonte, verdesLejos, neutros, costo };
  }, [filas]);

  // tabla completa: filtro semáforo client-side + paginación client-side
  const filasTabla = useMemo(
    () => (fSemaforo === "todos" ? filas : filas.filter((f) => f.estado_semaforo === fSemaforo)),
    [filas, fSemaforo],
  );

  // FE-04: orden client-side por columna sobre la tabla ya filtrada (dataset completo en memoria)
  const filasOrdenadas = useMemo(() => {
    if (!sortCol) return filasTabla;
    const signo = sortDir === "asc" ? 1 : -1;
    return [...filasTabla].sort(
      (a, b) => signo * compararOrdenable(valorOrdenable(a, sortCol), valorOrdenable(b, sortCol)),
    );
  }, [filasTabla, sortCol, sortDir]);

  const pageRows = filasOrdenadas.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function alternarOrden(col: ColumnaOrdenable) {
    setPage(0);
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  // Header clickeable con indicador ▲/▼ de la columna activa
  function renderThOrdenable(label: string, col: ColumnaOrdenable, className?: string) {
    const activa = sortCol === col;
    return (
      <th
        className={className}
        onClick={() => alternarOrden(col)}
        style={{ cursor: "pointer", userSelect: "none" }}
        aria-sort={activa ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        {activa && (
          <span aria-hidden style={{ marginLeft: 3, color: "var(--text-accent)" }}>
            {sortDir === "asc" ? "▲" : "▼"}
          </span>
        )}
      </th>
    );
  }

  // F-01: exporta las filas actuales (filtro + orden activo) de vista_alertas
  function handleExportarCSV() {
    const filasCSV = filasOrdenadas.map((a) => ({
      numero_contenedor: a.numero_contenedor,
      naviera: a.naviera,
      planta_actual: a.planta_actual ?? "",
      estado: ESTADO_LABELS[a.estado] ?? a.estado,
      fecha_retiro: fmtFecha(a.fecha_retiro),
      dias_estadia: a.dias_estadia,
      dias_libres: a.dias_libres ?? "",
      dias_restantes: a.dias_restantes ?? "",
      tarifa_usd_dia: a.tarifa_usd_dia ?? "",
      costo_proyectado: a.costo_proyectado ?? "",
      estado_semaforo: a.estado_semaforo,
    }));
    descargarCSV(`alertas_${hoyAR()}`, COLUMNAS_CSV, filasCSV);
  }

  if (error && filas.length === 0 && !cargando) {
    return (
      <ErrorMsg
        msg={error}
        onRetry={() => {
          setCargando(true);
          setError(null);
          setTick((t) => t + 1);
        }}
      />
    );
  }

  return (
    <div>
      {error && (
        <ErrorMsg
          msg={`no se pudo actualizar: ${error}`}
          onRetry={() => {
            setCargando(true);
            setError(null);
            setTick((t) => t + 1);
          }}
        />
      )}

      {/* KPI strip */}
      <div className="fd-kpistrip">
        <KpiCard label="operaciones abiertas" value={filas.length} sub={`umbral amarillo: ${umbral} d (admin)`} />
        <KpiCard label="en demora" value={grupos.rojos.length} critical={grupos.rojos.length > 0} />
        <KpiCard
          label="costo proyectado USD"
          value={Math.round(grupos.costo)}
          prefix="$"
          critical
          sub="suma de las abiertas, a hoy"
        />
        <KpiCard label={`vencen <${umbral * 24} h`} value={grupos.amarillos.length} amber />
      </div>

      {filas.length >= MAX_FILAS && (
        <p className="note">se muestran las primeras {MAX_FILAS} operaciones — refiná por naviera</p>
      )}

      {/* triage 2 columnas (artboard 2d) */}
      <div className="twocol" style={{ alignItems: "start", gap: 16 }}>
        {/* EN DEMORA */}
        <div className="fd-panel">
          <div className="fd-panel-title" style={{ color: "var(--text-danger)" }}>
            <span className="dot dot-rojo fd-dot-pulse" /> en demora
            <span className="fd-count">{grupos.rojos.length}</span>
          </div>
          {cargando ? (
            Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} cols="44px 1fr 110px" index={i} height={56} />)
          ) : grupos.rojos.length === 0 ? (
            <p className="empty" style={{ color: "var(--text-success)" }}>sin contenedores en demora ✓</p>
          ) : (
            <>
              {grupos.rojos.map((a) => (
                <Link
                  key={a.operacion_id}
                  href={`/contenedores/${a.operacion_id}`}
                  className="fd-ccrow"
                  style={{
                    gridTemplateColumns: "44px minmax(0,1fr) 110px",
                    borderLeft: "2px solid var(--text-danger)",
                    padding: "8px 16px",
                  }}
                >
                  <RadialTimer
                    pct={100}
                    color="red"
                    size={44}
                    label={a.dias_restantes != null ? `${a.dias_restantes}` : "!"}
                    sublabel="días"
                  />
                  <span style={{ minWidth: 0 }}>
                    <ContainerNumber value={a.numero_contenedor} />
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.naviera} · {a.planta_actual ?? "tránsito"} · {ESTADO_LABELS[a.estado] ?? a.estado}
                    </span>
                  </span>
                  <span style={{ textAlign: "right" }}>
                    <span className="mono fd-usd" style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>
                      {a.costo_proyectado != null ? fmtUSD(a.costo_proyectado) : "—"}
                    </span>
                    <span className="mono" style={{ fontSize: 10.5, color: a.sin_cargo ? "var(--text-success)" : "var(--text-muted)" }}>
                      {a.sin_cargo
                        ? "waiver s/cargo"
                        : a.tarifa_usd_dia != null
                          ? `+${fmtUSD(a.tarifa_usd_dia)} mañana`
                          : ""}
                    </span>
                  </span>
                </Link>
              ))}
              <div style={{ padding: "10px 16px", fontSize: 12, borderTop: "1px solid var(--border)" }}>
                acción sugerida:{" "}
                <Link href="/egreso" style={{ fontWeight: 600 }}>
                  priorizar egreso / devolución de estos contenedores →
                </Link>
              </div>
            </>
          )}
        </div>

        {/* VENCEN <72H + HORIZONTE */}
        <div style={{ minWidth: 0 }}>
          <div className="fd-panel">
            <div className="fd-panel-title" style={{ color: "var(--color-status-amber-deep)" }}>
              <span className="dot dot-amarillo" /> vencen &lt;{umbral * 24} h
              <span className="fd-count">{grupos.amarillos.length}</span>
            </div>
            {cargando ? (
              <SkeletonRow cols="44px 1fr 90px" height={56} />
            ) : grupos.amarillos.length === 0 ? (
              <p className="empty">nada por vencer dentro del umbral ✓</p>
            ) : (
              grupos.amarillos.map((a) => {
                const consumidoPct =
                  a.dias_libres && a.dias_libres > 0
                    ? Math.min(100, Math.round((a.dias_transcurridos / a.dias_libres) * 100))
                    : 0;
                return (
                  <Link
                    key={a.operacion_id}
                    href={`/contenedores/${a.operacion_id}`}
                    className="fd-ccrow"
                    style={{ gridTemplateColumns: "44px minmax(0,1fr) 90px", padding: "8px 16px" }}
                  >
                    <RadialTimer
                      pct={consumidoPct}
                      color="amber"
                      size={44}
                      label={a.dias_restantes != null ? `${a.dias_restantes * 24}h` : "—"}
                    />
                    <span style={{ minWidth: 0 }}>
                      <ContainerNumber value={a.numero_contenedor} />
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)" }}>
                        {a.naviera} · {a.planta_actual ?? "tránsito"}
                      </span>
                    </span>
                    <span className="mono" style={{ textAlign: "right", color: "var(--text-warning)", fontSize: 12.5 }}>
                      {a.dias_restantes != null ? `vence en ${a.dias_restantes} d` : "—"}
                    </span>
                  </Link>
                );
              })
            )}
          </div>

          <div className="fd-panel">
            <div className="fd-panel-title" style={{ color: "var(--color-status-green-dim)" }}>
              <span className="dot dot-verde" /> horizonte 3–7 días
              <span className="fd-count">{grupos.horizonte.length}</span>
            </div>
            {cargando ? (
              <SkeletonRow cols="1fr 64px 60px" height={36} />
            ) : grupos.horizonte.length === 0 ? (
              <p className="empty">sin vencimientos en el horizonte</p>
            ) : (
              grupos.horizonte.map((a) => {
                const restantePct =
                  a.dias_libres && a.dias_libres > 0 && a.dias_restantes != null
                    ? Math.max(0, Math.min(100, Math.round((a.dias_restantes / a.dias_libres) * 100)))
                    : 0;
                return (
                  <Link
                    key={a.operacion_id}
                    href={`/contenedores/${a.operacion_id}`}
                    className="fd-ccrow"
                    style={{ gridTemplateColumns: "150px minmax(0,1fr) 60px", minHeight: 36 }}
                  >
                    <ContainerNumber value={a.numero_contenedor} />
                    <span className="ft-meter" style={{ alignSelf: "center" }}>
                      <i className="ft-ok" style={{ width: `${restantePct}%` }} />
                    </span>
                    <span className="mono" style={{ textAlign: "right", color: "var(--color-status-green-dim)" }}>
                      {a.dias_restantes} d
                    </span>
                  </Link>
                );
              })
            )}
            {!cargando && (grupos.verdesLejos > 0 || grupos.neutros > 0) && (
              <div style={{ padding: "10px 16px", fontSize: 12, color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
                +{grupos.verdesLejos} en free time &gt;7 días
                {grupos.neutros > 0 && ` · ${grupos.neutros} sin cargo de origen`} — sin acción requerida
              </div>
            )}
          </div>
        </div>
      </div>

      {/* listado completo (funcionalidad existente: filtros + paginación) */}
      <div className="fd-panel" style={{ marginTop: 16 }}>
        <div className="fd-panel-title">
          <i className="ti ti-list" aria-hidden /> listado completo
          <span className="fd-count">{filasTabla.length}</span>
          {(session.rol === "supervisor" || session.rol === "administrador") && (
            <button
              type="button"
              className="chip"
              style={{ cursor: "pointer", marginLeft: 8 }}
              disabled={cargando || filasOrdenadas.length === 0}
              onClick={handleExportarCSV}
              title="exporta las filas visibles con el filtro y orden activos"
            >
              <i className="ti ti-download" aria-hidden style={{ fontSize: 11 }} /> exportar CSV
            </button>
          )}
        </div>
        <div className="fd-panel-body" style={{ paddingBottom: 8 }}>
          <div className="filters" style={{ marginBottom: 0 }}>
            <div className="f">
              <label htmlFor="f-semaforo">semáforo</label>
              <select
                id="f-semaforo"
                value={fSemaforo}
                onChange={(e) => {
                  setFSemaforo(e.target.value as FiltroSemaforo);
                  setPage(0);
                }}
              >
                <option value="todos">todos</option>
                <option value="verde">verde</option>
                <option value="amarillo">amarillo</option>
                <option value="rojo">rojo</option>
                <option value="neutro">sin cargo de origen</option>
              </select>
            </div>
            <div className="f">
              <label htmlFor="f-naviera">naviera</label>
              <select
                id="f-naviera"
                value={fNaviera}
                onChange={(e) => {
                  setFNaviera(e.target.value);
                  setPage(0);
                  setCargando(true);
                  setError(null);
                }}
              >
                <option value="">todas</option>
                {navieras.map((n) => (
                  <option key={n.id} value={n.nombre}>
                    {n.nombre}
                  </option>
                ))}
              </select>
            </div>
            {(fSemaforo !== "todos" || fNaviera) && (
              <button
                type="button"
                className="chip"
                style={{ color: "var(--text-accent)", borderColor: "var(--border-accent)", background: "var(--bg-accent)", cursor: "pointer", alignSelf: "flex-end" }}
                onClick={() => {
                  setFSemaforo("todos");
                  setFNaviera("");
                  setPage(0);
                }}
              >
                limpiar filtros <i className="ti ti-x" aria-hidden style={{ fontSize: 11 }} />
              </button>
            )}
          </div>
        </div>

        {!cargando && filasTabla.length === 0 && <Vacio msg="sin alertas para los filtros seleccionados" />}

        {(cargando || filasTabla.length > 0) && (
          <>
            <div className="tblwrap" style={{ border: "none", borderRadius: 0, background: "transparent" }}>
              <table className="t">
                <thead>
                  <tr>
                    {renderThOrdenable("n° contenedor", "numero_contenedor")}
                    {renderThOrdenable("naviera", "naviera", "hide-sm")}
                    {renderThOrdenable("planta", "planta_actual", "hide-sm")}
                    <th className="hide-sm">estado</th>
                    {renderThOrdenable("estadía", "dias_estadia")}
                    <th>freetime</th>
                    <th className="hide-sm">libres</th>
                    {renderThOrdenable("rest.", "dias_restantes", "hide-sm")}
                    {renderThOrdenable("costo proy.", "costo_proyectado")}
                    {renderThOrdenable("semáforo", "estado_semaforo", "hide-sm")}
                  </tr>
                </thead>
                <tbody>
                  {cargando && <SkeletonRowsTable cols={10} rows={6} />}
                  {!cargando &&
                    pageRows.map((a) => (
                      <tr key={a.operacion_id}>
                        <td className="mono">
                          <Link href={`/contenedores/${a.operacion_id}`} style={{ textDecoration: "none" }}>
                            <ContainerNumber value={a.numero_contenedor} />
                          </Link>
                        </td>
                        <td className="hide-sm">{a.naviera}</td>
                        <td className="hide-sm">{a.planta_actual ?? "—"}</td>
                        <td className="hide-sm">{ESTADO_LABELS[a.estado] ?? a.estado}</td>
                        <td className="mono">{a.dias_estadia}</td>
                        <td>
                          <FreetimeMeter
                            estadia={a.dias_estadia}
                            libres={a.dias_libres}
                            semaforo={a.estado_semaforo}
                          />
                        </td>
                        <td className="mono hide-sm">{a.dias_libres ?? "—"}</td>
                        <td className="hide-sm">
                          {a.dias_restantes == null ? (
                            "—"
                          ) : a.dias_restantes < 0 ? (
                            <span className="badge badge-danger mono">{a.dias_restantes}</span>
                          ) : a.dias_restantes <= umbral ? (
                            <span className="badge mono">{a.dias_restantes}</span>
                          ) : (
                            <span className="mono">{a.dias_restantes}</span>
                          )}
                        </td>
                        <td className="mono">
                          {a.costo_proyectado == null ? (
                            "—"
                          ) : Number(a.costo_proyectado) > 0 ? (
                            <span className="fd-usd">{fmtUSD(a.costo_proyectado)}</span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>USD 0</span>
                          )}
                          {a.sin_cargo && (
                            <span className="badge" style={{ marginLeft: 6 }} title="excepción de cargo (waiver)">
                              sin cargo
                            </span>
                          )}
                        </td>
                        <td className="hide-sm">
                          <Semaforo estado={a.estado_semaforo} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "4px 16px 12px" }}>
              <Paginacion page={page} pageSize={PAGE_SIZE} total={filasTabla.length} onPage={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
