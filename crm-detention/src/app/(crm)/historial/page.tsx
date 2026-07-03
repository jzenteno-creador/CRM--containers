"use client";

// Historial — consulta de operaciones CERRADAS (todo el registro, hoy ~2.880).
// Búsqueda por contenedor/booking/orden, filtro por naviera y rango de devolución.
// Paginación SERVER-SIDE (range + count): nunca se traen todas las filas al cliente.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/session-context";
import { Cargando, Vacio, ErrorMsg } from "@/components/ui";
import { fmtFecha, fmtUSD, TIPO_CIERRE_LABELS } from "@/lib/format";

const POR_PAGINA = 50;

interface FilaCerrada {
  operacion_id: string;
  numero_contenedor: string;
  naviera: string;
  tipo_cierre: string;
  destino: string | null;
  fecha_retiro: string;
  fecha_devolucion: string;
  sin_cargo: boolean;
  estadia: number;
  dias_libres: number | null;
  demora: number | null;
  tarifa_usd_dia: number | null;
  costo_usd: number | null;
  retiro_de: string | null;
  booking_retiro: string | null;
  booking_asignado: string | null;
  buque: string | null;
  orden: string | null;
  shp: string | null;
  observaciones: string | null;
  producto: string | null;
  gmid: string | null;
  tipo_contenedor: string | null;
  reforzado_estado: string | null;
  planta: string | null;
}

/** Escapa el término para PostgREST .or(): coma y paréntesis rompen la sintaxis. */
function limpiarBusqueda(q: string): string {
  return q.replace(/[(),]/g, " ").trim();
}

function Detalle({ f }: { f: FilaCerrada }) {
  const item = (k: string, v: React.ReactNode) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
        {k}
      </span>
      <span style={{ fontSize: 12.5 }}>{v ?? "—"}</span>
    </div>
  );
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "10px 18px",
        padding: "12px 14px",
        background: "var(--surface-1)",
        borderRadius: "var(--radius)",
      }}
    >
      {item("retiro de", f.retiro_de)}
      {item("booking retiro", <span className="mono">{f.booking_retiro ?? "—"}</span>)}
      {item("booking asignado", <span className="mono">{f.booking_asignado ?? "—"}</span>)}
      {item("buque", f.buque)}
      {item("destino", f.destino)}
      {item("orden", <span className="mono">{f.orden ?? "—"}</span>)}
      {item("shp", <span className="mono">{f.shp ?? "—"}</span>)}
      {item("planta", f.planta)}
      {item("tipo", f.tipo_contenedor)}
      {item("producto", f.producto)}
      {item("gmid", f.gmid ? <span className="mono">{f.gmid}</span> : "—")}
      {item(
        "tarifa",
        f.tarifa_usd_dia != null ? `${fmtUSD(Number(f.tarifa_usd_dia))}/día` : "—"
      )}
      {f.observaciones && (
        <div style={{ gridColumn: "1 / -1" }}>
          {item("observaciones", f.observaciones)}
        </div>
      )}
    </div>
  );
}

export default function HistorialPage() {
  const session = useSession();

  const [navieras, setNavieras] = useState<string[]>([]);
  const [filas, setFilas] = useState<FilaCerrada[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  // Filtros
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [naviera, setNaviera] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pagina, setPagina] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  // Al cambiar cualquier filtro se vuelve a la primera página
  useEffect(() => {
    setPagina(0);
  }, [qDebounced, naviera, desde, hasta]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data } = await supabase.from("navieras").select("nombre").order("nombre");
      if (!cancelado && data) setNavieras((data as { nombre: string }[]).map((n) => n.nombre));
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const cargar = useCallback(async () => {
    try {
      let query = supabase
        .from("vista_costos_cerrados")
        .select("*", { count: "exact" })
        .order("fecha_devolucion", { ascending: false })
        .order("numero_contenedor", { ascending: true });

      const term = limpiarBusqueda(qDebounced);
      if (term) {
        query = query.or(
          `numero_contenedor.ilike.%${term}%,orden.ilike.%${term}%,booking_asignado.ilike.%${term}%,booking_retiro.ilike.%${term}%`
        );
      }
      if (naviera) query = query.eq("naviera", naviera);
      if (desde) query = query.gte("fecha_devolucion", `${desde}T00:00:00-03:00`);
      if (hasta) query = query.lte("fecha_devolucion", `${hasta}T23:59:59-03:00`);
      if (session.rol === "operador" && session.plantaNombre) {
        query = query.eq("planta", session.plantaNombre);
      }

      const a = pagina * POR_PAGINA;
      const { data, error: qError, count } = await query.range(a, a + POR_PAGINA - 1);
      if (qError) throw qError;
      setFilas((data ?? []) as FilaCerrada[]);
      setTotal(count ?? 0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error al cargar el historial");
    }
  }, [qDebounced, naviera, desde, hasta, pagina, session.rol, session.plantaNombre]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const desdeN = total === 0 ? 0 : pagina * POR_PAGINA + 1;
  const hastaN = Math.min(total, (pagina + 1) * POR_PAGINA);

  return (
    <div>
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
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>Historial de operaciones cerradas</h2>
        <span className="note" style={{ margin: 0 }}>
          {total.toLocaleString("es-AR")} operaciones · registro completo desde ago-2025
        </span>
      </div>

      <div className="filters">
        <div className="f" style={{ minWidth: 220, flex: 1, maxWidth: 340 }}>
          <label>buscar (contenedor / booking / orden)</label>
          <input
            type="search"
            className="mono"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="MRKU1234567 · 272006963 · 118833310"
          />
        </div>
        <div className="f">
          <label>naviera</label>
          <select value={naviera} onChange={(e) => setNaviera(e.target.value)}>
            <option value="">todas</option>
            {navieras.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="f">
          <label>devolución desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="f">
          <label>devolución hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      {error && <ErrorMsg msg={error} onRetry={() => void cargar()} />}
      {!filas && !error && <Cargando msg="cargando historial…" />}
      {filas && filas.length === 0 && <Vacio msg="sin operaciones para ese filtro" />}

      {filas && filas.length > 0 && (
        <div className="tblwrap">
          <table className="t">
            <thead>
              <tr>
                <th>contenedor</th>
                <th>naviera</th>
                <th>retiro</th>
                <th>devolución</th>
                <th>cierre</th>
                <th style={{ textAlign: "right" }}>estadía</th>
                <th style={{ textAlign: "right" }}>libres</th>
                <th style={{ textAlign: "right" }}>demora</th>
                <th style={{ textAlign: "right" }}>costo</th>
                <th aria-label="detalle" />
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const abiertaEsta = abierta === f.operacion_id;
                return (
                  <FilaConDetalle
                    key={f.operacion_id}
                    f={f}
                    abierta={abiertaEsta}
                    onToggle={() => setAbierta(abiertaEsta ? null : f.operacion_id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filas && total > 0 && (
        <div className="actbar" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <span className="note" style={{ margin: 0 }}>
            {desdeN.toLocaleString("es-AR")}–{hastaN.toLocaleString("es-AR")} de{" "}
            {total.toLocaleString("es-AR")} · página {pagina + 1} de {paginas}
          </span>
          <span style={{ display: "inline-flex", gap: 8 }}>
            <button type="button" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
              <i className="ti ti-chevron-left" aria-hidden /> anterior
            </button>
            <button
              type="button"
              disabled={pagina + 1 >= paginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              siguiente <i className="ti ti-chevron-right" aria-hidden />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

function FilaConDetalle({
  f,
  abierta,
  onToggle,
}: {
  f: FilaCerrada;
  abierta: boolean;
  onToggle: () => void;
}) {
  const costo = f.costo_usd == null ? null : Number(f.costo_usd);
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: "pointer" }} aria-expanded={abierta}>
        <td className="mono">{f.numero_contenedor}</td>
        <td>{f.naviera}</td>
        <td className="mono">{fmtFecha(f.fecha_retiro)}</td>
        <td className="mono">{fmtFecha(f.fecha_devolucion)}</td>
        <td>{TIPO_CIERRE_LABELS[f.tipo_cierre] ?? f.tipo_cierre}</td>
        <td className="mono" style={{ textAlign: "right" }}>{f.estadia}</td>
        <td className="mono" style={{ textAlign: "right" }}>{f.dias_libres ?? "—"}</td>
        <td className="mono" style={{ textAlign: "right" }}>{f.demora ?? "—"}</td>
        <td className="mono" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          {costo == null ? "—" : fmtUSD(costo)}
          {f.sin_cargo && (
            <span className="badge" style={{ marginLeft: 6 }} title="excepción de cargo (waiver)">
              sin cargo
            </span>
          )}
        </td>
        <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{abierta ? "−" : "+"}</td>
      </tr>
      {abierta && (
        <tr>
          <td colSpan={10} style={{ padding: "4px 8px 10px" }}>
            <Detalle f={f} />
          </td>
        </tr>
      )}
    </>
  );
}
