"use client";

// Inicio — command center Flight Deck (artboard 2a).
// Datos: RPC crm_dashboard (KPIs de plata, scoped por rol) + vista_alertas (detalle por
// operación abierta: semáforo/costos calculados en la DB, acá NO se recalcula nada) +
// feed de operacion_eventos. Realtime sobre operaciones refresca todo.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/session-context";
import { Vacio, ErrorMsg } from "@/components/ui";
import { KpiCard } from "@/components/fd/kpi-card";
import { SkeletonRow } from "@/components/fd/skeleton-row";
import { ContainerNumber } from "@/components/container-number";
import { fmtUSD } from "@/lib/format";
import type { VistaAlerta } from "@/lib/types";

interface CostoNaviera {
  naviera: string;
  costo: number;
}

interface TendenciaMes {
  mes: string; // 'YYYY-MM'
  costo: number;
}

interface DashboardData {
  costo_mes: number;
  costo_ytd: number;
  costo_historial: number;
  historial_desde: string | null; // 'YYYY-MM' de la primera devolución registrada
  costo_proyectado_abiertas: number;
  en_riesgo: number;
  vencidos: number;
  por_vencer: number;
  stock_vacios: number;
  en_transito_a_planta: number;
  en_transito_a_terminal: number;
  demora_promedio: number;
  estadia_promedio: number;
  estadia_promedio_abiertas: number;
  costo_por_naviera: CostoNaviera[];
  tendencia_mensual: TendenciaMes[];
}

interface EventoFeed {
  id: string;
  tipo_evento: string;
  fecha: string;
  operaciones: { contenedores: { numero_contenedor: string } | null } | null;
}

/** Abrevia un monto USD para labels chicos de gráfico: 12.345 → "12,3k". */
function fmtUsdCorto(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) {
    return (n / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + "k";
  }
  return Math.round(n).toLocaleString("es-AR");
}

/** 'YYYY-MM' → 'MM/YY'. */
function mesCorto(mes: string): string {
  if (!mes || mes.length < 7) return mes;
  return `${mes.slice(5, 7)}/${mes.slice(2, 4)}`;
}

const MESES_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** 'YYYY-MM' → 'ago-25' (para rotular el rango real del historial). */
function mesNombre(mes: string | null | undefined): string {
  if (!mes || mes.length < 7) return "—";
  const m = Number(mes.slice(5, 7));
  return `${MESES_ABBR[m - 1] ?? mes.slice(5, 7)}-${mes.slice(2, 4)}`;
}

/** Hora del evento en zona AR (el feed muestra hora local operativa). */
function horaAR(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

const EVENTO_DOT: Record<string, string> = {
  retiro: "var(--text-accent)",
  ingreso_planta: "var(--text-success)",
  movimiento: "var(--text-muted)",
  carga: "var(--text-accent)",
  egreso: "var(--text-warning)",
  devolucion: "var(--text-success)",
  anulacion: "var(--text-danger)",
  incidencia: "var(--text-danger)",
};

const EVENTO_LABEL: Record<string, string> = {
  retiro: "retiro en depósito",
  ingreso_planta: "ingreso a planta",
  movimiento: "movimiento entre plantas",
  carga: "carga",
  egreso: "salida de planta",
  devolucion: "devolución / gate-in",
  anulacion: "operación anulada",
  incidencia: "incidencia",
};

/** Fila de ranking (lenguaje único para navieras e histórico): label fijo + track
 *  full-width + valor mono tabular. Banca disparidad extrema (558k vs 0): aunque la
 *  barra sea invisible, label y valor siguen legibles. */
function FilaBarra({
  label,
  valor,
  pct,
  destacada = false,
  title,
}: {
  label: string;
  valor: string;
  pct: number;
  destacada?: boolean;
  title?: string;
}) {
  return (
    <div
      title={title}
      style={{ display: "grid", gridTemplateColumns: "118px minmax(0,1fr) 78px", gap: 12, alignItems: "center", minHeight: 30 }}
    >
      <span
        style={{
          fontSize: 11.5,
          fontWeight: destacada ? 600 : 400,
          color: destacada ? "var(--text-primary)" : "var(--text-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <div style={{ height: 10, background: "var(--surface-0)", borderRadius: 5, overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.max(pct, 0.6)}%`,
            height: "100%",
            borderRadius: 5,
            background: destacada
              ? "linear-gradient(90deg, var(--color-accent-muted), var(--text-accent))"
              : "var(--text-accent)",
            opacity: destacada ? 1 : 0.5,
          }}
        />
      </div>
      <span
        className="mono"
        style={{
          fontSize: 12.5,
          fontWeight: destacada ? 600 : 400,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          color: destacada ? "var(--text-primary)" : "var(--text-secondary)",
          whiteSpace: "nowrap",
        }}
      >
        {valor}
      </span>
    </div>
  );
}

function BarrasNavieras({ datos }: { datos: CostoNaviera[] }) {
  if (!datos || datos.length === 0) return <Vacio msg="sin costos registrados" />;
  const ordenados = [...datos].sort((a, b) => (Number(b.costo) || 0) - (Number(a.costo) || 0));
  const max = Math.max(...ordenados.map((d) => Number(d.costo) || 0), 1);
  const total = ordenados.reduce((s, d) => s + (Number(d.costo) || 0), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, justifyContent: "space-evenly" }}>
      {ordenados.map((d, i) => {
        const costo = Number(d.costo) || 0;
        return (
          <FilaBarra
            key={d.naviera}
            label={d.naviera}
            valor={fmtUsdCorto(costo)}
            pct={(costo / max) * 100}
            destacada={i === 0 && costo > 0}
            title={`${d.naviera}: ${fmtUSD(costo)}`}
          />
        );
      })}
      <div
        style={{
          paddingTop: 12,
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <span className="fd-label">total historial</span>
        <span className="mono" style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {fmtUSD(total)}
        </span>
      </div>
    </div>
  );
}

function TendenciaMensual({ datos }: { datos: TendenciaMes[] }) {
  // viewBox = ancho REAL del contenedor (ResizeObserver) → escala SIEMPRE 1:1:
  // stroke y tipografía se renderizan al tamaño declarado en todo viewport
  // (el viejo 200x96 escalaba 3.12x en desktop; uno fijo de 720 dejaba 0.42x en mobile).
  const contRef = useRef<HTMLDivElement>(null);
  const [anchoCont, setAnchoCont] = useState(0);
  useEffect(() => {
    const el = contRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cw = Math.round(entries[0].contentRect.width);
      if (cw > 0) setAnchoCont(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!datos || datos.length === 0) return <Vacio msg="sin datos de tendencia" />;
  const W = Math.max(300, anchoCont);
  const compacto = W < 480;
  const H = compacto ? 200 : 240;
  const ML = compacto ? 44 : 54; // margen para labels USD del eje Y
  const MR = compacto ? 34 : 46; // aire para el label del último punto
  const MT = 16;
  const MB = 30;
  const vals = datos.map((d) => Number(d.costo) || 0);
  const max = Math.max(...vals, 1);
  const n = vals.length;
  const px = (i: number) => ML + (n <= 1 ? (W - ML - MR) / 2 : (i * (W - ML - MR)) / (n - 1));
  // baseline en 0: montos absolutos, la forma no miente
  const py = (v: number) => MT + (1 - v / max) * (H - MT - MB);
  const linea = vals.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const area = `${px(0).toFixed(1)},${py(0).toFixed(1)} ${linea} ${px(n - 1).toFixed(1)},${py(0).toFixed(1)}`;
  const ticks = [0, 1 / 3, 2 / 3, 1].map((f) => f * max);
  const paso = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(W / 90))));
  const iUlt = n - 1;
  return (
    <div ref={contRef} style={{ width: "100%", minWidth: 0 }}>
    {anchoCont > 0 && (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      style={{ display: "block", fontFamily: "var(--font-mono)" }}
      role="img"
      aria-label="tendencia mensual de costo en USD"
    >
      <defs>
        <linearGradient id="fd-grad-tendencia" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--text-accent)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--text-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* gridlines + labels USD */}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={ML}
            y1={py(t)}
            x2={W - MR}
            y2={py(t)}
            stroke={t === 0 ? "var(--border-strong)" : "var(--border)"}
            strokeWidth={1}
          />
          <text x={ML - 8} y={py(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--color-text-faint)">
            {fmtUsdCorto(t)}
          </text>
        </g>
      ))}
      {/* area + línea */}
      {n > 1 && <polygon points={area} fill="url(#fd-grad-tendencia)" />}
      {n > 1 && (
        <polyline
          points={linea}
          fill="none"
          stroke="var(--text-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {/* puntos con tooltip nativo */}
      {vals.map((v, i) => (
        <circle
          key={datos[i].mes}
          cx={px(i)}
          cy={py(v)}
          r={i === iUlt ? 4.5 : 2.6}
          fill={i === iUlt ? "var(--text-accent)" : "var(--surface-0)"}
          stroke="var(--text-accent)"
          strokeWidth={1.6}
        >
          <title>{`${mesCorto(datos[i].mes)}: ${fmtUSD(v)}`}</title>
        </circle>
      ))}
      {/* valor del último punto (el dato vivo del mes en curso) */}
      <text
        x={Math.min(px(iUlt) + 10, W - 4)}
        y={py(vals[iUlt]) - 10}
        textAnchor="end"
        fontSize={11.5}
        fontWeight={600}
        fill="var(--text-primary)"
      >
        {fmtUsdCorto(vals[iUlt])}
      </text>
      {/* meses */}
      {datos.map((d, i) =>
        i % paso === 0 || i === iUlt ? (
          <text key={d.mes} x={px(i)} y={H - 8} textAnchor="middle" fontSize={10.5} fill="var(--color-text-label)">
            {mesCorto(d.mes)}
          </text>
        ) : null
      )}
    </svg>
    )}
    </div>
  );
}

/** Módulo APARTE: serie agregada 2020-2026 de la planilla COSTOS HISTORICOS de operaciones.
 *  Granularidad y alcance distintos al historial del CRM — no se mezcla con los KPIs operativos. */
function HistoricoAgregado() {
  const [serie, setSerie] = useState<{ anio: number; costo: number }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase.from("costos_historicos").select("anio, costo_usd");
      if (cancelado) return;
      if (error) {
        setErr(error.message);
        return;
      }
      const porAnio = new Map<number, number>();
      for (const r of (data ?? []) as { anio: number; costo_usd: number }[]) {
        porAnio.set(r.anio, (porAnio.get(r.anio) ?? 0) + Number(r.costo_usd));
      }
      setSerie(
        [...porAnio.entries()].map(([anio, costo]) => ({ anio, costo })).sort((a, b) => a.anio - b.anio)
      );
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  if (err) return null; // módulo secundario: si falla no ensucia el dashboard
  if (!serie || serie.length === 0) return null;
  const max = Math.max(...serie.map((s) => s.costo), 1);
  const total = serie.reduce((acc, s) => acc + s.costo, 0);
  return (
    <div className="fd-panel" style={{ marginTop: 16 }}>
      <div className="fd-panel-title">
        <i className="ti ti-archive" aria-hidden /> histórico agregado 2020-2026
        <span className="fd-count">{fmtUsdCorto(total)} total</span>
      </div>
      <div className="fd-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {serie.map((s) => (
          <FilaBarra
            key={s.anio}
            label={String(s.anio)}
            valor={fmtUsdCorto(s.costo)}
            pct={(s.costo / max) * 100}
            destacada={s.costo === max}
            title={`${s.anio}: ${fmtUSD(s.costo)}`}
          />
        ))}
        <p className="note">
          serie semanal registrada por operaciones (hoja COSTOS HISTORICOS) · total {fmtUSD(total)} ·
          métrica propia del equipo — no comparable con el historial operativo del CRM (ago-2025 → hoy)
        </p>
      </div>
    </div>
  );
}

export default function InicioPage() {
  const session = useSession();
  const plantaScope = session.rol === "operador" ? session.plantaId : null;
  const plantaNombreScope = session.rol === "operador" ? session.plantaNombre : null;

  const [datos, setDatos] = useState<DashboardData | null>(null);
  const [alertas, setAlertas] = useState<VistaAlerta[] | null>(null);
  const [eventos, setEventos] = useState<EventoFeed[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      let qAlertas = supabase
        .from("vista_alertas")
        .select("*")
        .order("dias_restantes", { ascending: true, nullsFirst: false });
      if (plantaNombreScope) qAlertas = qAlertas.eq("planta_actual", plantaNombreScope);

      let qEventos = supabase
        .from("operacion_eventos")
        .select("id, tipo_evento, fecha, operaciones!inner(planta_actual_id, contenedores(numero_contenedor))")
        .order("fecha", { ascending: false })
        .limit(12);
      if (plantaScope) qEventos = qEventos.eq("operaciones.planta_actual_id", plantaScope);

      const [rpcRes, alertasRes, eventosRes] = await Promise.all([
        supabase.rpc("crm_dashboard", { p_planta: plantaScope }),
        qAlertas,
        qEventos,
      ]);
      if (rpcRes.error) throw rpcRes.error;
      if (!rpcRes.data) throw new Error("el dashboard no devolvió datos");
      setDatos(rpcRes.data as DashboardData);
      // Los paneles de detalle degradan sin romper el dashboard si su query falla
      if (!alertasRes.error) setAlertas((alertasRes.data ?? []) as VistaAlerta[]);
      if (!eventosRes.error) setEventos((eventosRes.data ?? []) as unknown as EventoFeed[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error al cargar el dashboard");
    }
  }, [plantaScope, plantaNombreScope]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Realtime: cualquier cambio en operaciones refresca los KPIs
  useEffect(() => {
    const ch = supabase
      .channel("inicio-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "detention", table: "operaciones" },
        () => {
          void cargar();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [cargar]);

  if (error && !datos) {
    return <ErrorMsg msg={error} onRetry={() => void cargar()} />;
  }

  if (!datos) {
    return (
      <div>
        <div className="fd-kpistrip" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} style={{ padding: "14px 18px" }}>
              <SkeletonRow cols="1fr" index={i} height={72} />
            </div>
          ))}
        </div>
        <div className="fd-panel">
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonRow key={i} cols="190px 1fr 150px 92px 110px" index={i} />
          ))}
        </div>
      </div>
    );
  }

  // Derivaciones de PRESENTACIÓN sobre lo que la DB ya calculó (nunca recalcular días/costos acá)
  const abiertas = alertas ?? [];
  const enDemora = abiertas.filter((a) => a.estado_semaforo === "rojo");
  const porVencer = abiertas.filter((a) => a.estado_semaforo === "amarillo");
  const enFreetime = abiertas.filter((a) => a.estado_semaforo === "verde");
  const diasDemoraAcum = enDemora.reduce(
    (acc, a) => acc + (a.dias_restantes != null && a.dias_restantes < 0 ? -a.dias_restantes : 0),
    0
  );

  // EN FREE TIME agrupado por naviera (cards)
  const porNaviera = new Map<string, { n: number; minRestantes: number | null }>();
  for (const a of enFreetime) {
    const e = porNaviera.get(a.naviera) ?? { n: 0, minRestantes: null };
    e.n += 1;
    if (a.dias_restantes != null) {
      e.minRestantes = e.minRestantes == null ? a.dias_restantes : Math.min(e.minRestantes, a.dias_restantes);
    }
    porNaviera.set(a.naviera, e);
  }

  // POSICIÓN DE FLOTA por planta (+ tránsitos del RPC)
  const porPlanta = new Map<string, number>();
  for (const a of abiertas) {
    const key = a.planta_actual ?? "en tránsito";
    porPlanta.set(key, (porPlanta.get(key) ?? 0) + 1);
  }
  const maxPlanta = Math.max(...[...porPlanta.values()], 1);

  const desdeLbl = mesNombre(datos.historial_desde);
  const anioActual = new Date().getFullYear();
  const estadia = Number(datos.estadia_promedio ?? 0);

  return (
    <div>
      {error && <ErrorMsg msg={`no se pudo actualizar: ${error}`} onRetry={() => void cargar()} />}

      {/* KPI strip (artboard 2a): activos · demora acum · costo proyectado (ancla) · deadlines */}
      <div className="fd-kpistrip">
        <KpiCard label="contenedores activos" value={abiertas.length} sub={`stock de vacíos: ${datos.stock_vacios}`} />
        <KpiCard label="días de demora acum." value={diasDemoraAcum} sub={`${enDemora.length} en demora`} />
        <KpiCard
          label="costo proyectado USD"
          value={Number(datos.costo_proyectado_abiertas) || 0}
          sub="operaciones abiertas, a hoy"
          critical
          prefix="$"
        />
        <KpiCard label="deadlines <72 h" value={porVencer.length} sub={`umbral configurable · ${datos.por_vencer} por vencer`} amber />
      </div>

      <div className="fd-cc">
        {/* columna izquierda */}
        <div style={{ minWidth: 0 }}>
          {/* EN DEMORA */}
          <div className="fd-panel">
            <div className="fd-panel-title" style={{ color: "var(--text-danger)" }}>
              <span className="dot dot-rojo fd-dot-pulse" /> en demora
              <span className="fd-count">{enDemora.length}</span>
            </div>
            {alertas == null ? (
              Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} cols="190px 1fr 92px 110px" index={i} />)
            ) : enDemora.length === 0 ? (
              <p className="empty">sin contenedores en demora ✓</p>
            ) : (
              enDemora.slice(0, 8).map((a) => (
                <Link
                  key={a.operacion_id}
                  href={`/contenedores/${a.operacion_id}`}
                  className="fd-ccrow"
                  style={{ borderLeft: "2px solid var(--text-danger)" }}
                >
                  <ContainerNumber value={a.numero_contenedor} />
                  <span style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.naviera} · {a.planta_actual ?? "tránsito"}
                  </span>
                  <span className="mono hide-sm" style={{ textAlign: "right" }}>{a.dias_estadia} d</span>
                  <span className="mono" style={{ textAlign: "right", color: "var(--text-danger)" }}>
                    {a.dias_restantes != null ? `${a.dias_restantes} d` : "—"}
                  </span>
                  <span className="mono fd-usd" style={{ textAlign: "right" }}>
                    {a.costo_proyectado != null ? fmtUSD(a.costo_proyectado) : "—"}
                  </span>
                </Link>
              ))
            )}
            {enDemora.length > 8 && (
              <Link href="/alertas" style={{ display: "block", padding: "9px 16px", fontSize: 12, textDecoration: "none" }}>
                ver las {enDemora.length} en alertas →
              </Link>
            )}
          </div>

          {/* POR VENCER <72H */}
          <div className="fd-panel">
            <div className="fd-panel-title" style={{ color: "var(--color-status-amber-deep)" }}>
              <span className="dot dot-amarillo" /> por vencer &lt;72 h
              <span className="fd-count">{porVencer.length}</span>
            </div>
            {alertas == null ? (
              <SkeletonRow cols="190px 1fr 110px" />
            ) : porVencer.length === 0 ? (
              <p className="empty">nada vence en las próximas 72 h ✓</p>
            ) : (
              porVencer.slice(0, 6).map((a) => {
                const consumido =
                  a.dias_libres && a.dias_libres > 0
                    ? Math.min(100, Math.round((a.dias_transcurridos / a.dias_libres) * 100))
                    : 0;
                return (
                  <Link
                    key={a.operacion_id}
                    href={`/contenedores/${a.operacion_id}`}
                    className="fd-ccrow"
                    style={{ gridTemplateColumns: "150px minmax(0, 1fr) 90px" }}
                  >
                    <ContainerNumber value={a.numero_contenedor} />
                    <span className="ft-meter" style={{ alignSelf: "center" }}>
                      <i className="ft-warn" style={{ width: `${consumido}%` }} />
                    </span>
                    <span className="mono" style={{ textAlign: "right", color: "var(--text-warning)" }}>
                      {a.dias_restantes != null ? `${a.dias_restantes} d` : "—"}
                    </span>
                  </Link>
                );
              })
            )}
          </div>

          {/* EN FREE TIME (cards por naviera) */}
          <div className="fd-panel">
            <div className="fd-panel-title" style={{ color: "var(--color-status-green-dim)" }}>
              <span className="dot dot-verde" /> en free time
              <span className="fd-count">{enFreetime.length}</span>
            </div>
            <div
              className="fd-panel-body"
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}
            >
              {alertas == null ? (
                <SkeletonRow cols="1fr 1fr 1fr" height={56} />
              ) : porNaviera.size === 0 ? (
                <p className="empty" style={{ gridColumn: "1 / -1" }}>sin contenedores en free time</p>
              ) : (
                [...porNaviera.entries()]
                  .sort((a, b) => b[1].n - a[1].n)
                  .map(([nav, info]) => (
                    <div
                      key={nav}
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 9,
                        padding: "10px 12px",
                      }}
                    >
                      <div className="fd-label" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nav}</div>
                      <div className="mono" style={{ fontSize: 22, fontWeight: 600, marginTop: 2 }}>{info.n}</div>
                      <div style={{ fontSize: 11, color: "var(--color-status-green-dim)" }}>
                        {info.minRestantes != null ? `próximo vence en ${info.minRestantes} d` : "sin cargo aplicable"}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        {/* columna derecha */}
        <div style={{ minWidth: 0 }}>
          {/* POSICIÓN DE FLOTA */}
          <div className="fd-panel">
            <div className="fd-panel-title">
              <i className="ti ti-map-pin" aria-hidden /> posición de flota
            </div>
            <div className="fd-panel-body">
              {[...porPlanta.entries()].sort((a, b) => b[1] - a[1]).map(([planta, n]) => (
                <div key={planta} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 96, fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {planta}
                  </span>
                  <div style={{ flex: 1, height: 7, background: "var(--surface-0)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${Math.round((n / maxPlanta) * 100)}%`, height: "100%", background: "var(--text-accent)", borderRadius: 4, opacity: 0.85 }} />
                  </div>
                  <span className="mono" style={{ width: 34, textAlign: "right", fontSize: 12.5 }}>{n}</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <span className="chip">
                  <i className="ti ti-truck" aria-hidden /> a planta: {datos.en_transito_a_planta}
                </span>
                <span className="chip">
                  <i className="ti ti-ship" aria-hidden /> a terminal: {datos.en_transito_a_terminal}
                </span>
              </div>
            </div>
          </div>

          {/* ACTIVIDAD */}
          <div className="fd-panel">
            <div className="fd-panel-title">
              <i className="ti ti-activity" aria-hidden /> actividad
            </div>
            <div className="fd-panel-body" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {eventos == null ? (
                Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} cols="86px 1fr" index={i} height={22} />)
              ) : eventos.length === 0 ? (
                <p className="empty">sin actividad registrada</p>
              ) : (
                eventos.map((ev) => (
                  <div key={ev.id} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5, minWidth: 0 }}>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                      {horaAR(ev.fecha)}
                    </span>
                    <span
                      aria-hidden
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        flexShrink: 0,
                        alignSelf: "center",
                        background: EVENTO_DOT[ev.tipo_evento] ?? "var(--text-muted)",
                      }}
                    />
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {EVENTO_LABEL[ev.tipo_evento] ?? ev.tipo_evento}
                      {ev.operaciones?.contenedores?.numero_contenedor && (
                        <>
                          {" · "}
                          <ContainerNumber value={ev.operaciones.contenedores.numero_contenedor} colorize={false} />
                        </>
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== KPIs de plata (spec §9) — SE CONSERVAN: es lo que mira el dueño ===== */}
      <div className="fd-kpistrip" style={{ marginTop: 16 }}>
        <KpiCard label="costo detention (mes)" value={Number(datos.costo_mes) || 0} prefix="$" />
        <KpiCard label={`costo historial (${desdeLbl} → hoy)`} value={Number(datos.costo_historial) || 0} prefix="$" />
        <KpiCard label={`costo detention (${anioActual})`} value={Number(datos.costo_ytd) || 0} prefix="$" />
        <KpiCard
          label="estadía promedio (cerradas)"
          value={Math.round(estadia)}
          suffix=" d"
          sub={`en riesgo ahora: ${datos.en_riesgo}`}
        />
      </div>

      <div className="twocol" style={{ marginTop: 16 }}>
        {/* display:flex en el panel + flex:1 en el body: el contenido LLENA el alto que el
            grid estira (antes las barras quedaban arrinconadas con 60% del panel vacío) */}
        <div className="fd-panel" style={{ display: "flex", flexDirection: "column" }}>
          <div className="fd-panel-title">
            <i className="ti ti-chart-bar" aria-hidden /> costo por naviera — historial ({desdeLbl} → hoy)
          </div>
          <div className="fd-panel-body" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <BarrasNavieras datos={datos.costo_por_naviera ?? []} />
          </div>
        </div>
        <div className="fd-panel" style={{ display: "flex", flexDirection: "column" }}>
          <div className="fd-panel-title">
            <i className="ti ti-chart-line" aria-hidden /> tendencia mensual (USD) — historial ({desdeLbl} → hoy)
          </div>
          <div className="fd-panel-body" style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <TendenciaMensual datos={datos.tendencia_mensual ?? []} />
          </div>
        </div>
      </div>

      {/* Módulo aparte: histórico agregado 2020-2026 (granularidad distinta, no se mezcla) */}
      <HistoricoAgregado />
    </div>
  );
}
