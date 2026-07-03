"use client";

// Inicio — dashboard de KPIs de plata (rpc crm_dashboard, scoped por rol)

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/session-context";
import { Cargando, Vacio, ErrorMsg } from "@/components/ui";
import { fmtUSD } from "@/lib/format";

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
  costo_proyectado_abiertas: number;
  en_riesgo: number;
  vencidos: number;
  por_vencer: number;
  stock_vacios: number;
  en_transito_a_planta: number;
  en_transito_a_terminal: number;
  demora_promedio: number;
  costo_por_naviera: CostoNaviera[];
  tendencia_mensual: TendenciaMes[];
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

function BarrasNavieras({ datos }: { datos: CostoNaviera[] }) {
  if (!datos || datos.length === 0) return <Vacio msg="sin costos registrados este año" />;
  const max = Math.max(...datos.map((d) => Number(d.costo) || 0), 1);
  return (
    <div style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 18,
          minHeight: 170,
          padding: "4px 6px 0",
        }}
      >
        {datos.map((d) => {
          const costo = Number(d.costo) || 0;
          const alto = Math.max(6, Math.round((costo / max) * 110));
          return (
            <div
              key={d.naviera}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
            >
              <span style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                {fmtUsdCorto(costo)}
              </span>
              <div
                style={{
                  width: 22,
                  height: alto,
                  background: "var(--text-accent)",
                  borderRadius: "4px 4px 0 0",
                  opacity: 0.85,
                }}
                title={`${d.naviera}: ${fmtUSD(costo)}`}
              />
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  maxWidth: 74,
                  textAlign: "center",
                  overflowWrap: "break-word",
                }}
              >
                {d.naviera}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TendenciaMensual({ datos }: { datos: TendenciaMes[] }) {
  if (!datos || datos.length === 0) return <Vacio msg="sin datos de tendencia" />;
  const vals = datos.map((d) => Number(d.costo) || 0);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const n = datos.length;
  const px = (i: number) => (n <= 1 ? 100 : 10 + (i * 180) / (n - 1));
  const py = (v: number) => 76 - ((v - min) / span) * 62;
  const puntos = vals.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  // Si hay muchos meses, mostramos labels salteados para que no se pisen
  const paso = Math.max(1, Math.ceil(n / 6));
  return (
    <svg viewBox="0 0 200 96" style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="tendencia mensual de costo en USD">
      {n > 1 && (
        <polyline
          points={puntos}
          fill="none"
          stroke="var(--text-accent)"
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {vals.map((v, i) => (
        <circle key={datos[i].mes} cx={px(i)} cy={py(v)} r={1.8} fill="var(--text-accent)">
          <title>{`${mesCorto(datos[i].mes)}: ${fmtUSD(v)}`}</title>
        </circle>
      ))}
      {datos.map((d, i) =>
        i % paso === 0 || i === n - 1 ? (
          <text
            key={d.mes}
            x={px(i)}
            y={90}
            textAnchor="middle"
            fontSize={7}
            fill="var(--text-muted)"
          >
            {mesCorto(d.mes)}
          </text>
        ) : null
      )}
    </svg>
  );
}

export default function InicioPage() {
  const session = useSession();
  const plantaScope = session.rol === "operador" ? session.plantaId : null;

  const [datos, setDatos] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const { data, error: rpcError } = await supabase.rpc("crm_dashboard", {
        p_planta: plantaScope,
      });
      if (rpcError) throw rpcError;
      if (!data) throw new Error("el dashboard no devolvió datos");
      setDatos(data as DashboardData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error al cargar el dashboard");
    }
  }, [plantaScope]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Realtime: cualquier cambio en operaciones refresca los KPIs
  useEffect(() => {
    const ch = supabase
      .channel("inicio-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operaciones" },
        () => {
          void cargar();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [cargar]);

  const header = (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 12,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>Resumen</h2>
      <span className="note" style={{ margin: 0 }}>
        datos scoped por rol
        {session.rol === "operador" && session.plantaNombre
          ? ` · planta ${session.plantaNombre}`
          : " · todas las plantas"}
      </span>
    </div>
  );

  if (error && !datos) {
    return (
      <div>
        {header}
        <ErrorMsg msg={error} onRetry={() => void cargar()} />
      </div>
    );
  }

  if (!datos) {
    return (
      <div>
        {header}
        <Cargando msg="cargando resumen…" />
      </div>
    );
  }

  const demora = Number(datos.demora_promedio ?? 0);

  return (
    <div>
      {header}

      {error && <ErrorMsg msg={`no se pudo actualizar: ${error}`} onRetry={() => void cargar()} />}

      {/* Banner de alertas */}
      <div className="filters">
        <span className="chip chip-danger">
          <span className="dot dot-rojo" /> vencidos: {datos.vencidos}
        </span>
        <span className="chip chip-warning">
          <span className="dot dot-amarillo" /> por vencer: {datos.por_vencer}
        </span>
        <Link
          href="/alertas"
          className="btn-primary"
          style={{
            padding: "5px 10px",
            border: "0.5px solid var(--border-accent)",
            borderRadius: "var(--radius)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <i className="ti ti-bell" aria-hidden /> ver alertas
        </Link>
      </div>

      {/* KPIs */}
      <div className="kpis">
        <div className="kpi">
          <div className="l">costo detention (mes)</div>
          <div className="v">{fmtUSD(datos.costo_mes)}</div>
        </div>
        <div className="kpi">
          <div className="l">costo detention (YTD)</div>
          <div className="v">{fmtUSD(datos.costo_ytd)}</div>
        </div>
        <div className="kpi">
          <div className="l">contenedores en riesgo</div>
          <div className="v">{datos.en_riesgo}</div>
        </div>
        <div className="kpi">
          <div className="l">stock de vacíos</div>
          <div className="v">{datos.stock_vacios}</div>
        </div>
        <div className="kpi">
          <div className="l">demora promedio</div>
          <div className="v">
            {demora.toLocaleString("es-AR", { maximumFractionDigits: 1 })} d
          </div>
        </div>
        <div className="kpi">
          <div className="l">costo proyectado (abiertas)</div>
          <div className="v">{fmtUSD(datos.costo_proyectado_abiertas)}</div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="twocol">
        <div className="crm-card">
          <h4>
            <i className="ti ti-chart-bar" aria-hidden /> costo por naviera (YTD)
          </h4>
          <BarrasNavieras datos={datos.costo_por_naviera ?? []} />
        </div>
        <div className="crm-card">
          <h4>
            <i className="ti ti-chart-line" aria-hidden /> tendencia mensual (USD)
          </h4>
          <TendenciaMensual datos={datos.tendencia_mensual ?? []} />
        </div>
      </div>

      {/* Chips secundarios */}
      <div className="filters" style={{ marginTop: 12, marginBottom: 0 }}>
        <span className="chip">
          <i className="ti ti-truck" aria-hidden /> en tránsito a planta: {datos.en_transito_a_planta}
        </span>
        <span className="chip">
          <i className="ti ti-ship" aria-hidden /> en tránsito a terminal: {datos.en_transito_a_terminal}
        </span>
      </div>
    </div>
  );
}
