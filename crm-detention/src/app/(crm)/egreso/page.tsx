"use client";

// Egreso en dos fases:
//  1) salida de planta (no corta freetime) → crm_registrar_salida_planta
//  2) confirmación de ingreso a terminal / devolución (corta freetime) → crm_confirmar_devolucion

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/session-context";
import { Cargando, Vacio, ErrorMsg, Semaforo, Paginacion } from "@/components/ui";
import { parsearListaContenedores } from "@/lib/iso6346";
import { hoyAR, fmtFecha, diasDesde, TIPO_CIERRE_LABELS } from "@/lib/format";
import type { VistaAlerta, Planta, TipoCierre } from "@/lib/types";

const PAGE_SIZE = 50;

type TipoCierreSalida = Extract<TipoCierre, "embarcado" | "devuelto_vacio">;

interface OpTransito {
  id: string;
  tipo_cierre: TipoCierre;
  destino: string | null;
  fecha_egreso_planta: string | null;
  contenedores: {
    numero_contenedor: string;
    navieras: { nombre: string } | null;
  } | null;
}

interface Asignacion {
  booking_asignado: string;
  buque: string;
  destino: string;
  orden: string;
  shp: string;
}

const ASIGNACION_VACIA: Asignacion = { booking_asignado: "", buque: "", destino: "", orden: "", shp: "" };

export default function EgresoPage() {
  const session = useSession();
  const esOperador = session.rol === "operador";

  // ── Fase 1 · salida de planta ──────────────────────────────────────────
  const [rows1, setRows1] = useState<VistaAlerta[]>([]);
  const [total1, setTotal1] = useState(0);
  const [page1, setPage1] = useState(0);
  const [loading1, setLoading1] = useState(true);
  const [err1, setErr1] = useState<string | null>(null);
  const [sel1, setSel1] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [plantaFiltro, setPlantaFiltro] = useState("todas");
  const [plantas, setPlantas] = useState<Planta[]>([]);
  const [tipoCierre, setTipoCierre] = useState<TipoCierreSalida>("embarcado");
  const [asig, setAsig] = useState<Asignacion>(ASIGNACION_VACIA);
  const [fechaSalida, setFechaSalida] = useState(hoyAR());
  const [busy1, setBusy1] = useState(false);
  const [okMut1, setOkMut1] = useState<string | null>(null);
  const [errMut1, setErrMut1] = useState<string | null>(null);
  // números pegados pendientes de auto-selección tras el próximo fetch
  const autoSelectRef = useRef<string[] | null>(null);

  // ── Fase 2 · pendientes de confirmar en terminal ──────────────────────
  const [rows2, setRows2] = useState<OpTransito[]>([]);
  const [total2, setTotal2] = useState(0);
  const [page2, setPage2] = useState(0);
  const [loading2, setLoading2] = useState(true);
  const [err2, setErr2] = useState<string | null>(null);
  const [sel2, setSel2] = useState<Set<string>>(new Set());
  const [fechaDevolucion, setFechaDevolucion] = useState(hoyAR());
  const [busy2, setBusy2] = useState(false);
  const [okMut2, setOkMut2] = useState<string | null>(null);
  const [errMut2, setErrMut2] = useState<string | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────

  const fetchFase1 = useCallback(async () => {
    setLoading1(true);
    setErr1(null);
    try {
      let q = supabase
        .from("vista_alertas")
        .select("*", { count: "exact" })
        .in("estado", ["en_planta", "cargado"]);

      const plantaScope = esOperador
        ? session.plantaNombre
        : plantaFiltro === "todas"
          ? null
          : plantaFiltro;
      if (plantaScope) q = q.eq("planta_actual", plantaScope);

      const tokens = parsearListaContenedores(busqueda).map((p) => p.numero);
      if (tokens.length > 1) {
        q = q.in("numero_contenedor", tokens);
      } else if (tokens.length === 1) {
        q = q.ilike("numero_contenedor", `%${tokens[0]}%`);
      }

      const { data, error, count } = await q
        .order("dias_restantes", { ascending: true })
        .range(page1 * PAGE_SIZE, page1 * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;

      const filas = (data ?? []) as VistaAlerta[];
      setRows1(filas);
      setTotal1(count ?? 0);
      // podar selección a filas visibles + auto-seleccionar los pegados que matchean
      setSel1((prev) => {
        const visibles = new Set(filas.map((f) => f.operacion_id));
        const next = new Set([...prev].filter((id) => visibles.has(id)));
        const pegados = autoSelectRef.current;
        if (pegados && pegados.length > 0) {
          const nums = new Set(pegados);
          for (const f of filas) {
            if (nums.has(f.numero_contenedor)) next.add(f.operacion_id);
          }
          autoSelectRef.current = null;
        }
        return next;
      });
    } catch (e) {
      setErr1(e instanceof Error ? e.message : "error al cargar contenedores en planta");
    } finally {
      setLoading1(false);
    }
  }, [page1, plantaFiltro, busqueda, esOperador, session.plantaNombre]);

  const fetchFase2 = useCallback(async () => {
    setLoading2(true);
    setErr2(null);
    try {
      const { data, error, count } = await supabase
        .from("operaciones")
        .select(
          "id, tipo_cierre, destino, fecha_egreso_planta, contenedores(numero_contenedor, navieras(nombre))",
          { count: "exact" }
        )
        .eq("estado", "en_transito_a_terminal")
        .order("fecha_egreso_planta", { ascending: false })
        .range(page2 * PAGE_SIZE, page2 * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;

      const filas = (data ?? []) as unknown as OpTransito[];
      setRows2(filas);
      setTotal2(count ?? 0);
      setSel2((prev) => {
        const visibles = new Set(filas.map((f) => f.id));
        return new Set([...prev].filter((id) => visibles.has(id)));
      });
    } catch (e) {
      setErr2(e instanceof Error ? e.message : "error al cargar operaciones en tránsito");
    } finally {
      setLoading2(false);
    }
  }, [page2]);

  // fase 1: debounce cuando hay búsqueda tipeada
  useEffect(() => {
    const t = setTimeout(() => void fetchFase1(), busqueda ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchFase1, busqueda]);

  useEffect(() => {
    void fetchFase2();
  }, [fetchFase2]);

  // plantas para el filtro (solo supervisor/admin)
  useEffect(() => {
    if (esOperador) return;
    let activo = true;
    void (async () => {
      const { data, error } = await supabase.from("plantas").select("id, nombre, codigo").order("nombre");
      if (!error && activo) setPlantas((data ?? []) as Planta[]);
    })();
    return () => {
      activo = false;
    };
  }, [esOperador]);

  // realtime: cualquier cambio en operaciones refresca ambas fases
  const refetchRef = useRef<() => void>(() => {});
  refetchRef.current = () => {
    void fetchFase1();
    void fetchFase2();
  };
  useEffect(() => {
    const ch = supabase
      .channel("egreso-operaciones")
      .on("postgres_changes", { event: "*", schema: "public", table: "operaciones" }, () => {
        refetchRef.current();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  // ── Handlers fase 1 ───────────────────────────────────────────────────

  function onPasteBusqueda(e: React.ClipboardEvent<HTMLInputElement>) {
    const texto = e.clipboardData.getData("text");
    const parsed = parsearListaContenedores(texto);
    if (parsed.length > 1) {
      e.preventDefault();
      const nums = parsed.map((p) => p.numero);
      autoSelectRef.current = nums;
      setBusqueda(nums.join(", "));
      setPage1(0);
    }
  }

  function toggleFila1(id: string) {
    setSel1((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const todas1 = rows1.length > 0 && rows1.every((r) => sel1.has(r.operacion_id));
  function toggleTodas1() {
    setSel1((prev) => {
      const next = new Set(prev);
      if (todas1) rows1.forEach((r) => next.delete(r.operacion_id));
      else rows1.forEach((r) => next.add(r.operacion_id));
      return next;
    });
  }

  async function confirmarSalida() {
    setOkMut1(null);
    setErrMut1(null);
    if (sel1.size === 0) {
      setErrMut1("seleccioná al menos un contenedor en planta");
      return;
    }
    if (!fechaSalida) {
      setErrMut1("indicá la fecha de salida");
      return;
    }
    setBusy1(true);
    try {
      const asignacion =
        tipoCierre === "embarcado"
          ? {
              booking_asignado: asig.booking_asignado.trim() || null,
              buque: asig.buque.trim() || null,
              destino: asig.destino.trim() || null,
              orden: asig.orden.trim() || null,
              shp: asig.shp.trim() || null,
            }
          : {};
      const { data, error } = await supabase.rpc("crm_registrar_salida_planta", {
        p_operacion_ids: [...sel1],
        p_tipo_cierre: tipoCierre,
        p_fecha: `${fechaSalida}T14:00:00-03:00`,
        p_asignacion: asignacion,
        p_usuario: session.id,
      });
      if (error) throw error;
      const n = (data as { salidas?: number } | null)?.salidas ?? sel1.size;
      setOkMut1(
        `${n} salida${n === 1 ? "" : "s"} de planta registrada${n === 1 ? "" : "s"} — recordá confirmar el ingreso a terminal en la fase 2`
      );
      setSel1(new Set());
      setAsig(ASIGNACION_VACIA);
      await Promise.all([fetchFase1(), fetchFase2()]);
    } catch (e) {
      setErrMut1(e instanceof Error ? e.message : "error al registrar la salida de planta");
    } finally {
      setBusy1(false);
    }
  }

  // ── Handlers fase 2 ───────────────────────────────────────────────────

  function toggleFila2(id: string) {
    setSel2((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const todas2 = rows2.length > 0 && rows2.every((r) => sel2.has(r.id));
  function toggleTodas2() {
    setSel2((prev) => {
      const next = new Set(prev);
      if (todas2) rows2.forEach((r) => next.delete(r.id));
      else rows2.forEach((r) => next.add(r.id));
      return next;
    });
  }

  async function confirmarDevolucion() {
    setOkMut2(null);
    setErrMut2(null);
    if (sel2.size === 0) {
      setErrMut2("seleccioná al menos una operación en tránsito");
      return;
    }
    if (!fechaDevolucion) {
      setErrMut2("indicá la fecha de devolución / gate-in");
      return;
    }
    setBusy2(true);
    try {
      const { data, error } = await supabase.rpc("crm_confirmar_devolucion", {
        p_operacion_ids: [...sel2],
        p_fecha: `${fechaDevolucion}T16:00:00-03:00`,
        p_usuario: session.id,
      });
      if (error) throw error;
      const n = (data as { cerradas?: number } | null)?.cerradas ?? sel2.size;
      setOkMut2(`${n} operacion${n === 1 ? "" : "es"} cerrada${n === 1 ? "" : "s"} — freetime cortado`);
      setSel2(new Set());
      await Promise.all([fetchFase1(), fetchFase2()]);
    } catch (e) {
      setErrMut2(e instanceof Error ? e.message : "error al confirmar la devolución");
    } finally {
      setBusy2(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      {/* Fase 1 · salida de planta */}
      <section className="crm-card">
        <h4>
          <span className="num">1</span> salida de planta
        </h4>

        <div className="filters">
          <input
            type="text"
            placeholder="buscar o pegar contenedores en planta…"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPage1(0);
            }}
            onPaste={onPasteBusqueda}
            style={{ flex: "1 1 260px", minWidth: 200 }}
            aria-label="buscar o pegar contenedores en planta"
          />
          {esOperador ? (
            <span className="pill">planta: {session.plantaNombre ?? "—"}</span>
          ) : (
            <select
              value={plantaFiltro}
              onChange={(e) => {
                setPlantaFiltro(e.target.value);
                setPage1(0);
              }}
              aria-label="filtrar por planta"
            >
              <option value="todas">planta: todas</option>
              {plantas.map((p) => (
                <option key={p.id} value={p.nombre}>
                  {p.nombre}
                </option>
              ))}
            </select>
          )}
        </div>

        {err1 ? (
          <ErrorMsg msg={err1} onRetry={() => void fetchFase1()} />
        ) : loading1 ? (
          <Cargando msg="cargando contenedores en planta…" />
        ) : rows1.length === 0 ? (
          <Vacio msg="no hay contenedores en planta que coincidan" />
        ) : (
          <>
            <div className="tblwrap">
              <table className="t">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}>
                      <input
                        type="checkbox"
                        checked={todas1}
                        onChange={toggleTodas1}
                        aria-label="seleccionar todos los contenedores visibles"
                      />
                    </th>
                    <th>n° contenedor</th>
                    <th>naviera</th>
                    <th>planta</th>
                    <th>días freetime</th>
                    <th>semáforo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows1.map((r) => (
                    <tr key={r.operacion_id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={sel1.has(r.operacion_id)}
                          onChange={() => toggleFila1(r.operacion_id)}
                          aria-label={`seleccionar ${r.numero_contenedor}`}
                        />
                      </td>
                      <td className="mono">{r.numero_contenedor}</td>
                      <td>{r.naviera}</td>
                      <td>{r.planta_actual ?? "—"}</td>
                      <td>
                        {r.dias_restantes < 0 ? (
                          <span className="badge badge-danger">{r.dias_restantes}</span>
                        ) : (
                          r.dias_restantes
                        )}
                      </td>
                      <td>
                        <Semaforo estado={r.estado_semaforo} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacion page={page1} pageSize={PAGE_SIZE} total={total1} onPage={setPage1} />
          </>
        )}

        <div className="filters" style={{ marginTop: 12 }} role="radiogroup" aria-label="tipo de cierre">
          <label className="toggle">
            <input
              type="radio"
              name="tipo-cierre"
              checked={tipoCierre === "embarcado"}
              onChange={() => setTipoCierre("embarcado")}
            />
            embarcado
          </label>
          <label className="toggle">
            <input
              type="radio"
              name="tipo-cierre"
              checked={tipoCierre === "devuelto_vacio"}
              onChange={() => setTipoCierre("devuelto_vacio")}
            />
            devuelto vacío
          </label>
        </div>

        {tipoCierre === "embarcado" && (
          <div
            style={{
              background: "var(--surface-1)",
              border: "0.5px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "12px 14px",
              marginTop: 10,
            }}
          >
            <div className="grid">
              <div className="f">
                <label htmlFor="eg-booking">booking asignado</label>
                <input
                  id="eg-booking"
                  type="text"
                  value={asig.booking_asignado}
                  onChange={(e) => setAsig((a) => ({ ...a, booking_asignado: e.target.value }))}
                />
              </div>
              <div className="f">
                <label htmlFor="eg-buque">buque</label>
                <input
                  id="eg-buque"
                  type="text"
                  value={asig.buque}
                  onChange={(e) => setAsig((a) => ({ ...a, buque: e.target.value }))}
                />
              </div>
              <div className="f">
                <label htmlFor="eg-destino">destino</label>
                <input
                  id="eg-destino"
                  type="text"
                  value={asig.destino}
                  onChange={(e) => setAsig((a) => ({ ...a, destino: e.target.value }))}
                />
              </div>
              <div className="f">
                <label htmlFor="eg-orden">orden</label>
                <input
                  id="eg-orden"
                  type="text"
                  value={asig.orden}
                  onChange={(e) => setAsig((a) => ({ ...a, orden: e.target.value }))}
                />
              </div>
              <div className="f">
                <label htmlFor="eg-shp">SHP</label>
                <input
                  id="eg-shp"
                  type="text"
                  value={asig.shp}
                  onChange={(e) => setAsig((a) => ({ ...a, shp: e.target.value }))}
                />
              </div>
            </div>
            <p className="note">se aplica a los seleccionados.</p>
          </div>
        )}

        <div className="actbar">
          <div className="f">
            <label htmlFor="eg-fecha-salida">fecha de salida</label>
            <input
              id="eg-fecha-salida"
              type="date"
              value={fechaSalida}
              onChange={(e) => setFechaSalida(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={busy1 || sel1.size === 0}
            onClick={() => void confirmarSalida()}
          >
            <i className="ti ti-truck" aria-hidden />{" "}
            {busy1 ? "registrando…" : `confirmar salida (${sel1.size})`}
          </button>
        </div>

        {errMut1 && <div className="err">{errMut1}</div>}
        {okMut1 && <div className="ok">{okMut1}</div>}

        <p className="note">la salida de planta no corta el freetime — lo corta la fase 2.</p>
      </section>

      {/* Fase 2 · confirmación en terminal */}
      <section className="crm-card">
        <h4>
          <span className="num">2</span> pendientes de confirmar ingreso a terminal / devolución
        </h4>
        <p className="note" style={{ marginTop: 0, marginBottom: 10 }}>
          salidos en tránsito. confirmar acá corta el freetime.
        </p>

        {err2 ? (
          <ErrorMsg msg={err2} onRetry={() => void fetchFase2()} />
        ) : loading2 ? (
          <Cargando msg="cargando operaciones en tránsito…" />
        ) : rows2.length === 0 ? (
          <Vacio msg="no hay operaciones en tránsito a terminal" />
        ) : (
          <>
            <div className="tblwrap">
              <table className="t">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}>
                      <input
                        type="checkbox"
                        checked={todas2}
                        onChange={toggleTodas2}
                        aria-label="seleccionar todas las operaciones visibles"
                      />
                    </th>
                    <th>n° contenedor</th>
                    <th>cierre</th>
                    <th>destino</th>
                    <th>salida</th>
                    <th>días</th>
                  </tr>
                </thead>
                <tbody>
                  {rows2.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={sel2.has(r.id)}
                          onChange={() => toggleFila2(r.id)}
                          aria-label={`seleccionar ${r.contenedores?.numero_contenedor ?? r.id}`}
                        />
                      </td>
                      <td className="mono">{r.contenedores?.numero_contenedor ?? "—"}</td>
                      <td>{TIPO_CIERRE_LABELS[r.tipo_cierre] ?? r.tipo_cierre}</td>
                      <td>{r.destino ?? "—"}</td>
                      <td>{fmtFecha(r.fecha_egreso_planta)}</td>
                      <td>{r.fecha_egreso_planta ? diasDesde(r.fecha_egreso_planta) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacion page={page2} pageSize={PAGE_SIZE} total={total2} onPage={setPage2} />
          </>
        )}

        <div className="actbar">
          <div className="f">
            <label htmlFor="eg-fecha-dev">fecha de devolución / gate-in</label>
            <input
              id="eg-fecha-dev"
              type="date"
              value={fechaDevolucion}
              onChange={(e) => setFechaDevolucion(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={busy2 || sel2.size === 0}
            onClick={() => void confirmarDevolucion()}
          >
            <i className="ti ti-anchor" aria-hidden />{" "}
            {busy2 ? "confirmando…" : "confirmar ingreso a terminal (corta freetime)"}
          </button>
        </div>

        {errMut2 && <div className="err">{errMut2}</div>}
        {okMut2 && <div className="ok">{okMut2}</div>}
      </section>
    </>
  );
}
