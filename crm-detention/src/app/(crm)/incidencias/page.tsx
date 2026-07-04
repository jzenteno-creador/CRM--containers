"use client";

// Módulo Incidencias: registro de averías/otros sobre operaciones abiertas + historial con fotos.
// Fotos en bucket público 'incidencias' de Supabase Storage.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/session-context";
import { Cargando, Vacio, ErrorMsg, Paginacion } from "@/components/ui";
import { hoyAR, fmtFecha, ESTADO_LABELS } from "@/lib/format";
import { ContainerNumber } from "@/components/container-number";

const PAGE_SIZE = 25;

type TipoIncidencia = "averia_sufrida" | "averia_recepcionada" | "otro";

const TIPO_INCIDENCIA_LABELS: Record<TipoIncidencia, string> = {
  averia_sufrida: "avería sufrida",
  averia_recepcionada: "avería recepcionada",
  otro: "otro",
};

const TIPO_INCIDENCIA_CHIP: Record<TipoIncidencia, string> = {
  averia_sufrida: "chip chip-danger",
  averia_recepcionada: "chip chip-warning",
  otro: "chip",
};

interface OperacionSugerida {
  id: string;
  estado: string;
  numero: string;
}

interface FotoLocal {
  file: File;
  url: string; // object URL para preview local
}

interface FilaHistorial {
  id: string;
  operacion_id: string;
  tipo: TipoIncidencia;
  descripcion: string | null;
  fecha: string;
  numero_contenedor: string;
  fotos: { storage_path: string }[];
}

/** Los embeds de PostgREST pueden venir como objeto o array según cómo detecte la relación; normalizamos. */
function primero<T>(v: unknown): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return (v[0] as T) ?? null;
  return v as T;
}

function mapFila(raw: unknown): FilaHistorial {
  const r = raw as Record<string, unknown>;
  const op = primero<{ id: string; contenedores: unknown }>(r.operaciones);
  const cont = op ? primero<{ numero_contenedor: string }>(op.contenedores) : null;
  return {
    id: r.id as string,
    operacion_id: r.operacion_id as string,
    tipo: r.tipo as TipoIncidencia,
    descripcion: (r.descripcion as string | null) ?? null,
    fecha: r.fecha as string,
    numero_contenedor: cont?.numero_contenedor ?? "—",
    fotos: ((r.incidencia_fotos as { storage_path: string }[] | null) ?? []).filter(
      (f) => !!f.storage_path
    ),
  };
}

export default function IncidenciasPage() {
  const session = useSession();

  // ---- form: nueva incidencia ----
  const [busq, setBusq] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [sugError, setSugError] = useState<string | null>(null);
  const [sugerencias, setSugerencias] = useState<OperacionSugerida[]>([]);
  const [opSel, setOpSel] = useState<OperacionSugerida | null>(null);

  const [tipo, setTipo] = useState<TipoIncidencia>("averia_sufrida");
  const [fecha, setFecha] = useState(hoyAR());
  const [descripcion, setDescripcion] = useState("");
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  // ---- historial ----
  const [filas, setFilas] = useState<FilaHistorial[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [histCargando, setHistCargando] = useState(true);
  const [histErr, setHistErr] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const [filtroDeb, setFiltroDeb] = useState("");

  // ---- búsqueda de operaciones abiertas (autocomplete, debounce 250ms) ----
  useEffect(() => {
    if (opSel) {
      setSugerencias([]);
      setBuscando(false);
      return;
    }
    const q = busq.trim();
    if (q.length < 3) {
      setSugerencias([]);
      setSugError(null);
      setBuscando(false);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from("operaciones")
        .select("id, estado, contenedores!inner(numero_contenedor)")
        .ilike("contenedores.numero_contenedor", `%${q}%`)
        .not("estado", "in", '("cerrado","anulada")')
        .limit(8);
      if (cancelado) return;
      setBuscando(false);
      if (error) {
        setSugError(error.message);
        setSugerencias([]);
        return;
      }
      setSugError(null);
      setSugerencias(
        ((data ?? []) as unknown[]).map((raw) => {
          const r = raw as Record<string, unknown>;
          const cont = primero<{ numero_contenedor: string }>(r.contenedores);
          return {
            id: r.id as string,
            estado: r.estado as string,
            numero: cont?.numero_contenedor ?? "—",
          };
        })
      );
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [busq, opSel]);

  function elegirOperacion(s: OperacionSugerida) {
    setOpSel(s);
    setBusq(s.numero);
    setSugerencias([]);
  }

  // ---- fotos locales (previews con object URLs, se revocan al quitar/resetear/desmontar) ----
  const fotosRef = useRef<FotoLocal[]>([]);
  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);
  useEffect(
    () => () => {
      fotosRef.current.forEach((f) => URL.revokeObjectURL(f.url));
    },
    []
  );

  function agregarFotos(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const nuevas: FotoLocal[] = [];
    for (const file of Array.from(lista)) {
      if (!file.type.startsWith("image/")) continue;
      nuevas.push({ file, url: URL.createObjectURL(file) });
    }
    if (nuevas.length > 0) setFotos((prev) => [...prev, ...nuevas]);
  }

  function quitarFoto(idx: number) {
    setFotos((prev) => {
      const f = prev[idx];
      if (f) URL.revokeObjectURL(f.url);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function resetForm() {
    setOpSel(null);
    setBusq("");
    setTipo("averia_sufrida");
    setFecha(hoyAR());
    setDescripcion("");
    setFotos((prev) => {
      prev.forEach((f) => URL.revokeObjectURL(f.url));
      return [];
    });
  }

  // ---- historial: fetch paginado con filtro server-side por n° de contenedor ----
  // El filtro usa ilike sobre el embed anidado (operaciones!inner → contenedores!inner),
  // así filtra en servidor y la paginación/count siguen siendo correctos.
  const fetchHistorial = useCallback(async () => {
    setHistCargando(true);
    setHistErr(null);
    const desde = page * PAGE_SIZE;
    let q = supabase
      .from("incidencias")
      .select(
        "id, operacion_id, tipo, descripcion, fecha, operaciones!inner(id, contenedores!inner(numero_contenedor)), incidencia_fotos(storage_path)",
        { count: "exact" }
      )
      .order("fecha", { ascending: false })
      .range(desde, desde + PAGE_SIZE - 1);
    const f = filtroDeb.trim();
    if (f) q = q.ilike("operaciones.contenedores.numero_contenedor", `%${f}%`);
    const { data, error, count } = await q;
    if (error) {
      setHistErr(error.message);
      setHistCargando(false);
      return;
    }
    setFilas(((data ?? []) as unknown[]).map(mapFila));
    setTotal(count ?? 0);
    setHistCargando(false);
  }, [page, filtroDeb]);

  useEffect(() => {
    void fetchHistorial();
  }, [fetchHistorial]);

  // debounce del filtro (300ms) + reset de página
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltroDeb(filtro);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [filtro]);

  // realtime sobre incidencias → refetch (ref para no resuscribir en cada cambio de página/filtro)
  const refetchRef = useRef(fetchHistorial);
  useEffect(() => {
    refetchRef.current = fetchHistorial;
  }, [fetchHistorial]);
  useEffect(() => {
    const ch = supabase
      .channel("incidencias-historial")
      .on(
        "postgres_changes",
        { event: "*", schema: "detention", table: "incidencias" },
        () => {
          void refetchRef.current();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  // ---- submit: insert incidencia → fotos (storage + tabla) → evento de operación ----
  async function registrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormErr(null);
    setFormOk(null);
    if (!opSel) {
      setFormErr("elegí una operación abierta desde el buscador de contenedores.");
      return;
    }
    if (!fecha) {
      setFormErr("indicá la fecha de la incidencia.");
      return;
    }
    setGuardando(true);
    try {
      const fechaTs = `${fecha}T12:00:00-03:00`;
      const desc = descripcion.trim() || null;

      // 1) incidencia (si falla, no se guarda nada)
      const { data: inc, error: eInc } = await supabase
        .from("incidencias")
        .insert({
          operacion_id: opSel.id,
          tipo,
          descripcion: desc,
          fecha: fechaTs,
          usuario_id: session.id,
        })
        .select("id")
        .single();
      if (eInc) throw new Error(`no se pudo registrar la incidencia: ${eInc.message}`);
      const incidenciaId = (inc as { id: string }).id;

      // 2) fotos: cada una por separado; si una falla se informa pero la incidencia no se pierde
      const avisos: string[] = [];
      let subidas = 0;
      for (const foto of fotos) {
        const nombreSano = foto.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${incidenciaId}/${Date.now()}-${nombreSano}`;
        const { error: eUp } = await supabase.storage.from("incidencias").upload(path, foto.file);
        if (eUp) {
          avisos.push(`foto «${foto.file.name}»: ${eUp.message}`);
          continue;
        }
        const { error: eRow } = await supabase
          .from("incidencia_fotos")
          .insert({ incidencia_id: incidenciaId, storage_path: path });
        if (eRow) {
          avisos.push(`registro de foto «${foto.file.name}»: ${eRow.message}`);
          continue;
        }
        subidas++;
      }

      // 3) evento en el timeline de la operación
      const { error: eEv } = await supabase.from("operacion_eventos").insert({
        operacion_id: opSel.id,
        tipo_evento: "incidencia",
        fecha: fechaTs,
        usuario_id: session.id,
        detalle: { tipo, descripcion: desc },
      });
      if (eEv) avisos.push(`evento de operación: ${eEv.message}`);

      let msg = `incidencia registrada sobre ${opSel.numero}`;
      if (fotos.length > 0) msg += ` · ${subidas}/${fotos.length} fotos subidas`;
      setFormOk(msg);
      if (avisos.length > 0) {
        setFormErr(`la incidencia se guardó, pero hubo problemas con: ${avisos.join(" · ")}`);
      }
      resetForm();
      if (page !== 0) setPage(0);
      else void fetchHistorial();
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : "error inesperado al registrar la incidencia");
    } finally {
      setGuardando(false);
    }
  }

  function urlPublica(storagePath: string): string {
    return supabase.storage.from("incidencias").getPublicUrl(storagePath).data.publicUrl;
  }

  return (
    <>
      {/* ============ nueva incidencia ============ */}
      <div className="crm-card">
        <h4>
          <span className="num">1</span> nueva incidencia
        </h4>
        <form onSubmit={registrar}>
          <div className="grid">
            <div className="f" style={{ position: "relative", gridColumn: "span 2" }}>
              <label>contenedor / operación</label>
              <input
                type="text"
                value={busq}
                onChange={(e) => {
                  setBusq(e.target.value);
                  setOpSel(null);
                }}
                placeholder="tipeá ≥3 caracteres del n° de contenedor…"
                autoComplete="off"
                spellCheck={false}
              />
              {!opSel && busq.trim().length >= 3 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 30,
                    marginTop: 4,
                    background: "var(--surface-2)",
                    border: "0.5px solid var(--border-strong)",
                    borderRadius: "var(--radius)",
                    maxHeight: 240,
                    overflowY: "auto",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
                  }}
                >
                  {buscando ? (
                    <p className="empty">buscando…</p>
                  ) : sugError ? (
                    <p className="empty">error buscando operaciones: {sugError}</p>
                  ) : sugerencias.length === 0 ? (
                    <p className="empty">sin operaciones abiertas para «{busq.trim()}»</p>
                  ) : (
                    sugerencias.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          elegirOperacion(s);
                        }}
                        style={{
                          display: "flex",
                          width: "100%",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          border: "none",
                          borderRadius: 0,
                          textAlign: "left",
                          background: "transparent",
                        }}
                      >
                        <span className="mono"><ContainerNumber value={s.numero} /></span>
                        <span className="badge badge-accent">
                          {ESTADO_LABELS[s.estado] ?? s.estado}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {opSel ? (
                <span className="note" style={{ marginTop: 4 }}>
                  <i className="ti ti-check" aria-hidden /> operación seleccionada:{" "}
                  <span className="mono"><ContainerNumber value={opSel.numero} /></span> ·{" "}
                  {ESTADO_LABELS[opSel.estado] ?? opSel.estado}
                </span>
              ) : (
                <span className="note" style={{ marginTop: 4 }}>
                  solo operaciones abiertas (excluye cerradas y anuladas)
                </span>
              )}
            </div>
            <div className="f">
              <label>tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoIncidencia)}>
                <option value="averia_sufrida">avería sufrida</option>
                <option value="averia_recepcionada">avería recepcionada</option>
                <option value="otro">otro</option>
              </select>
            </div>
            <div className="f">
              <label>fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          <div className="f" style={{ marginTop: 10 }}>
            <label>descripción</label>
            <textarea
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="qué pasó, dónde, estado del contenedor…"
            />
          </div>

          <div className="f" style={{ marginTop: 10 }}>
            <label>fotos</label>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                agregarFotos(e.dataTransfer.files);
              }}
              style={{
                border: `1.5px dashed ${arrastrando ? "var(--border-accent)" : "var(--border-strong)"}`,
                borderRadius: "var(--radius)",
                padding: "18px 12px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 12,
                cursor: "pointer",
                background: arrastrando ? "var(--bg-accent)" : "var(--surface-1)",
              }}
            >
              <i className="ti ti-photo-up" aria-hidden /> arrastrá fotos o clickeá para subir
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                agregarFotos(e.target.files);
                e.target.value = "";
              }}
            />
            {fotos.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                {fotos.map((f, i) => (
                  <span key={f.url} className="chip" style={{ gap: 6, padding: "3px 6px" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.url}
                      alt={f.file.name}
                      style={{
                        width: 28,
                        height: 28,
                        objectFit: "cover",
                        borderRadius: 4,
                        border: "0.5px solid var(--border)",
                      }}
                    />
                    <span
                      style={{
                        maxWidth: 140,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {f.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarFoto(i)}
                      title="quitar foto"
                      style={{ padding: "0 4px", border: "none", background: "transparent" }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="actbar">
            <button type="submit" className="btn-primary" disabled={guardando || !opSel}>
              <i className="ti ti-alert-triangle" aria-hidden />{" "}
              {guardando ? "registrando…" : "registrar incidencia"}
            </button>
          </div>
          {formErr && <div className="err">{formErr}</div>}
          {formOk && <div className="ok">{formOk}</div>}
        </form>
      </div>

      {/* ============ historial ============ */}
      <div className="crm-card">
        <h4>
          <span className="num">2</span> historial
        </h4>
        <div className="filters">
          <input
            type="text"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="filtrar por n° de contenedor…"
            style={{ minWidth: 220 }}
            spellCheck={false}
          />
          <span className="pill">{total} incidencias</span>
        </div>

        {histCargando ? (
          <Cargando msg="cargando incidencias…" />
        ) : histErr ? (
          <ErrorMsg msg={histErr} onRetry={() => void fetchHistorial()} />
        ) : filas.length === 0 ? (
          <Vacio
            msg={
              filtroDeb.trim()
                ? `sin incidencias para «${filtroDeb.trim()}»`
                : "sin incidencias registradas"
            }
          />
        ) : (
          <div className="tblwrap">
            <table className="t">
              <thead>
                <tr>
                  <th>fecha</th>
                  <th>contenedor</th>
                  <th>tipo</th>
                  <th>descripción</th>
                  <th>fotos</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtFecha(r.fecha)}</td>
                    <td>
                      <Link href={`/contenedores/${r.operacion_id}`} className="mono" style={{ textDecoration: "none" }}>
                        <ContainerNumber value={r.numero_contenedor} />
                      </Link>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span className={TIPO_INCIDENCIA_CHIP[r.tipo] ?? "chip"}>
                        {TIPO_INCIDENCIA_LABELS[r.tipo] ?? r.tipo}
                      </span>
                    </td>
                    <td>{r.descripcion || "—"}</td>
                    <td>
                      {r.fotos.length === 0 ? (
                        "—"
                      ) : (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {r.fotos.map((f) => {
                            const url = urlPublica(f.storage_path);
                            return (
                              <a
                                key={f.storage_path}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                title="ver foto completa"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt={`foto de incidencia ${r.numero_contenedor}`}
                                  loading="lazy"
                                  style={{
                                    width: 48,
                                    height: 48,
                                    objectFit: "cover",
                                    borderRadius: 6,
                                    border: "0.5px solid var(--border)",
                                    display: "block",
                                  }}
                                />
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacion page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        <p className="note">
          el filtro por contenedor se aplica en servidor (ilike sobre el embed operaciones →
          contenedores), así la paginación y el total quedan consistentes.
        </p>
      </div>
    </>
  );
}
