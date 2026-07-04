"use client";

// Fase 1 · Tanda de retiro: encabezado único + lista pegada de contenedores,
// validación ISO 6346, chequeo de existentes y ciclos abiertos, alta vía RPC.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/session-context";
import { parsearListaContenedores } from "@/lib/iso6346";
import { ContainerNumber } from "@/components/container-number";
import { hoyAR } from "@/lib/format";
import type { Naviera, Planta, ReforzadoEstado } from "@/lib/types";
import { mensajeDeError } from "./errores";

const DEPOSITOS = ["PTN", "TERMINAL 4", "DEFIBE", "EXOLGAN", "HUXLEY", "TRP", "GAMMA", "HIPERBAIRES"];
const OTRO = "__otro__";
const TIPOS = ["40HC", "40DC", "20DC"] as const;

interface ContenedorExistente {
  id: string;
  numero_contenedor: string;
  tipo: string;
  reforzado_estado: ReforzadoEstado;
  navieras: { nombre: string } | null;
}

type FilaEstado = "error" | "ciclo_abierto" | "existente" | "nuevo";

interface Fila {
  numero: string;
  estado: FilaEstado;
  motivo: string | null; // motivo de error ISO
  existente: ContenedorExistente | null;
}

const REFORZADO_LABELS: Record<ReforzadoEstado, string> = {
  pendiente_validacion: "pendiente validación",
  confirmado_reforzado: "reforzado",
  confirmado_no_reforzado: "no reforzado",
  discrepancia: "discrepancia",
};

export function FaseRetiro({
  navieras,
  plantas,
  onCreada,
}: {
  navieras: Naviera[];
  plantas: Planta[];
  onCreada: () => void;
}) {
  const session = useSession();

  // Encabezado (una vez para toda la tanda)
  const [navieraId, setNavieraId] = useState("");
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>("40HC");
  const [retiroDe, setRetiroDe] = useState(DEPOSITOS[0]);
  const [retiroDeOtro, setRetiroDeOtro] = useState("");
  const [plantaDestinoId, setPlantaDestinoId] = useState(session.plantaId ?? "");
  const [bookingRetiro, setBookingRetiro] = useState("");
  const [fechaRetiro, setFechaRetiro] = useState(hoyAR());

  // Contenedores pegados
  const [texto, setTexto] = useState("");
  const [reforzadoMap, setReforzadoMap] = useState<Record<string, boolean>>({});

  // Prefijos restringidos (regla "PARA DOW"): alerta de compliance en la fila, NO bloquea la carga
  const [prefijos, setPrefijos] = useState<Map<string, { armador: string; estado: string }>>(
    new Map()
  );

  // Verificación contra la base
  const [existentes, setExistentes] = useState<Map<string, ContenedorExistente>>(new Map());
  const [ciclosAbiertos, setCiclosAbiertos] = useState<Set<string>>(new Set());
  const [verificando, setVerificando] = useState(false);
  const [errVerif, setErrVerif] = useState<string | null>(null);

  // Ingreso inmediato (tránsito corto)
  const [confirmaIngreso, setConfirmaIngreso] = useState(false);
  const [medio, setMedio] = useState<"camion" | "tren">("camion");

  // Submit
  const [enviando, setEnviando] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // La lista es chica (39 prefijos): se carga una vez por montaje
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data } = await supabase
        .from("prefijos_restringidos")
        .select("prefijo, armador, estado");
      if (!cancelado && data) {
        setPrefijos(
          new Map(
            (data as { prefijo: string; armador: string; estado: string }[]).map((p) => [
              p.prefijo,
              { armador: p.armador, estado: p.estado },
            ])
          )
        );
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const parseadas = useMemo(() => parsearListaContenedores(texto), [texto]);
  const numerosValidos = useMemo(
    () => parseadas.filter((p) => !p.error).map((p) => p.numero),
    [parseadas]
  );
  const numerosKey = numerosValidos.join(",");

  // Chequeo debounced de existentes + ciclos abiertos
  useEffect(() => {
    if (!numerosKey) {
      setExistentes(new Map());
      setCiclosAbiertos(new Set());
      setVerificando(false);
      setErrVerif(null);
      return;
    }
    let cancelado = false;
    setVerificando(true);
    const timer = setTimeout(async () => {
      try {
        const { data: conts, error: e1 } = await supabase
          .from("contenedores")
          .select("id, numero_contenedor, tipo, reforzado_estado, navieras(nombre)")
          .in("numero_contenedor", numerosKey.split(","));
        if (e1) throw e1;
        const lista = (conts ?? []) as unknown as ContenedorExistente[];

        let abiertos = new Set<string>();
        if (lista.length > 0) {
          const { data: ops, error: e2 } = await supabase
            .from("operaciones")
            .select("id, contenedor_id")
            .in("contenedor_id", lista.map((c) => c.id))
            .not("estado", "in", '("cerrado","anulada")');
          if (e2) throw e2;
          const idsAbiertos = new Set(
            ((ops ?? []) as { id: string; contenedor_id: string }[]).map((o) => o.contenedor_id)
          );
          abiertos = new Set(
            lista.filter((c) => idsAbiertos.has(c.id)).map((c) => c.numero_contenedor)
          );
        }
        if (!cancelado) {
          setExistentes(new Map(lista.map((c) => [c.numero_contenedor, c])));
          setCiclosAbiertos(abiertos);
          setErrVerif(null);
        }
      } catch (e) {
        if (!cancelado) setErrVerif(mensajeDeError(e));
      } finally {
        if (!cancelado) setVerificando(false);
      }
    }, 400);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [numerosKey]);

  const filas: Fila[] = useMemo(
    () =>
      parseadas.map((p) => {
        if (p.error) return { numero: p.numero, estado: "error", motivo: p.error, existente: null };
        const ext = existentes.get(p.numero) ?? null;
        if (ext && ciclosAbiertos.has(p.numero)) {
          return { numero: p.numero, estado: "ciclo_abierto", motivo: null, existente: ext };
        }
        if (ext) return { numero: p.numero, estado: "existente", motivo: null, existente: ext };
        return { numero: p.numero, estado: "nuevo", motivo: null, existente: null };
      }),
    [parseadas, existentes, ciclosAbiertos]
  );

  const filasValidas = useMemo(
    () => filas.filter((f) => f.estado === "existente" || f.estado === "nuevo"),
    [filas]
  );

  const navieraNombre = navieras.find((n) => n.id === navieraId)?.nombre ?? "—";

  const prefijoDeFila = (numero: string) => prefijos.get(numero.slice(0, 4)) ?? null;
  const restringidas = useMemo(
    () => filasValidas.filter((f) => prefijoDeFila(f.numero)?.estado === "vigente"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filasValidas, prefijos]
  );

  function reforzadoDeFila(f: Fila): boolean {
    if (f.existente) return f.existente.reforzado_estado === "confirmado_reforzado";
    return reforzadoMap[f.numero] ?? true;
  }

  async function confirmarTanda() {
    setOkMsg(null);
    setErrMsg(null);
    const retiroDeFinal = retiroDe === OTRO ? retiroDeOtro.trim() : retiroDe;
    if (!navieraId) return setErrMsg("elegí la naviera de la tanda");
    if (!plantaDestinoId) return setErrMsg("elegí la planta destino");
    if (!retiroDeFinal) return setErrMsg("indicá el depósito de retiro");
    if (!fechaRetiro) return setErrMsg("indicá la fecha de retiro");
    if (filasValidas.length === 0) return setErrMsg("no hay contenedores válidos para dar de alta");
    if (verificando) return setErrMsg("esperá a que termine la verificación de contenedores");

    setEnviando(true);
    try {
      const { data, error } = await supabase.rpc("crm_crear_tanda_retiro", {
        p: {
          header: {
            naviera_id: navieraId,
            tipo,
            retiro_de: retiroDeFinal,
            planta_destino_id: plantaDestinoId,
            booking_retiro: bookingRetiro.trim() || null,
            fecha_retiro: `${fechaRetiro}T09:00:00-03:00`,
            confirma_ingreso: confirmaIngreso,
            medio,
          },
          usuario_id: session.id,
          contenedores: filasValidas.map((f) => ({ numero: f.numero, reforzado: reforzadoDeFila(f) })),
        },
      });
      if (error) throw error;
      const creadas = (data as { creadas?: number } | null)?.creadas ?? filasValidas.length;
      setOkMsg(`${creadas} operaciones creadas — arranca freetime`);
      setTexto("");
      setReforzadoMap({});
      onCreada();
    } catch (e) {
      setErrMsg(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="crm-card">
      <h4>
        <span className="num">1</span> Tanda de retiro
      </h4>

      <div className="grid">
        <div className="f">
          <label>naviera (toda la tanda)</label>
          <select value={navieraId} onChange={(e) => setNavieraId(e.target.value)}>
            <option value="">seleccioná…</option>
            {navieras.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="f">
          <label>tipo (toda la tanda)</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as (typeof TIPOS)[number])}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="f">
          <label>retiro de (depósito)</label>
          <select value={retiroDe} onChange={(e) => setRetiroDe(e.target.value)}>
            {DEPOSITOS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            <option value={OTRO}>otro…</option>
          </select>
        </div>
        {retiroDe === OTRO && (
          <div className="f">
            <label>depósito (otro)</label>
            <input
              type="text"
              value={retiroDeOtro}
              onChange={(e) => setRetiroDeOtro(e.target.value)}
              placeholder="nombre del depósito"
            />
          </div>
        )}
        <div className="f">
          <label>planta destino</label>
          <select value={plantaDestinoId} onChange={(e) => setPlantaDestinoId(e.target.value)}>
            <option value="">seleccioná…</option>
            {plantas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="f">
          <label>booking de retiro</label>
          <input
            type="text"
            value={bookingRetiro}
            onChange={(e) => setBookingRetiro(e.target.value)}
            placeholder="ej: BK-123456"
          />
        </div>
        <div className="f">
          <label>fecha de retiro</label>
          <input type="date" value={fechaRetiro} onChange={(e) => setFechaRetiro(e.target.value)} />
        </div>
      </div>

      <div className="f" style={{ marginTop: 10 }}>
        <label>contenedores — pegá uno por línea</label>
        <textarea
          className="mono"
          rows={5}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={"MSCU1234565\nTGHU7654321"}
        />
      </div>

      {errVerif && <div className="err">error verificando contenedores: {errVerif}</div>}

      {restringidas.length > 0 && (
        <div className="err" role="alert">
          <i className="ti ti-alert-triangle" aria-hidden />{" "}
          {restringidas.length === 1 ? "1 contenedor" : `${restringidas.length} contenedores`} con{" "}
          prefijo restringido para DOW (
          {[...new Set(restringidas.map((f) => f.numero.slice(0, 4)))].join(", ")}) — la carga no
          se bloquea; verificá con compliance antes de operar.
        </div>
      )}

      {filas.length > 0 && (
        <div className="tblwrap" style={{ marginTop: 10 }}>
          <table className="t">
            <thead>
              <tr>
                <th>n° contenedor</th>
                <th>naviera</th>
                <th>tipo</th>
                <th>estado</th>
                <th>reforzado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.numero}>
                  <td className="mono"><ContainerNumber value={f.numero} /></td>
                  <td>{f.existente ? f.existente.navieras?.nombre ?? "—" : f.estado === "error" ? "—" : navieraNombre}</td>
                  <td>{f.existente ? f.existente.tipo : f.estado === "error" ? "—" : tipo}</td>
                  <td>
                    {f.estado === "error" && <span className="badge badge-danger">{f.motivo}</span>}
                    {f.estado === "ciclo_abierto" && <span className="badge badge-danger">ciclo abierto</span>}
                    {f.estado === "existente" && <span className="badge badge-accent">existente</span>}
                    {f.estado === "nuevo" &&
                      (verificando ? <span className="badge">verificando…</span> : <span className="badge">nuevo</span>)}
                    {f.estado !== "error" &&
                      (() => {
                        const pr = prefijoDeFila(f.numero);
                        if (!pr) return null;
                        return pr.estado === "vigente" ? (
                          <span
                            className="badge badge-danger"
                            style={{ marginLeft: 4 }}
                            title={`armador sancionado: ${pr.armador} — restringido para DOW`}
                          >
                            ⚠ prefijo restringido
                          </span>
                        ) : (
                          <span
                            className="badge"
                            style={{ marginLeft: 4 }}
                            title={`${pr.armador} — fuera del listado restringido desde 26-08-2025`}
                          >
                            prefijo ex-restringido
                          </span>
                        );
                      })()}
                  </td>
                  <td>
                    {f.estado === "error" || f.estado === "ciclo_abierto" ? (
                      "—"
                    ) : f.existente ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <input type="checkbox" checked={reforzadoDeFila(f)} disabled />
                        <span style={{ fontSize: 11 }}>{REFORZADO_LABELS[f.existente.reforzado_estado]}</span>
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={reforzadoDeFila(f)}
                        onChange={(e) =>
                          setReforzadoMap((m) => ({ ...m, [f.numero]: e.target.checked }))
                        }
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="note">
        naviera y tipo salen del encabezado. valida ISO 6346 y bloquea contenedor con ciclo abierto.
        reforzado tildado por default.
      </p>

      <label className="toggle">
        <input
          type="checkbox"
          checked={confirmaIngreso}
          onChange={(e) => setConfirmaIngreso(e.target.checked)}
        />
        confirmar ingreso a planta en el mismo momento (tránsito corto)
      </label>
      {confirmaIngreso && (
        <div className="f" style={{ marginTop: 8, maxWidth: 200 }}>
          <label>medio</label>
          <select value={medio} onChange={(e) => setMedio(e.target.value as "camion" | "tren")}>
            <option value="camion">camión</option>
            <option value="tren">tren</option>
          </select>
        </div>
      )}

      <div className="actbar">
        <button
          type="button"
          className="btn-primary"
          disabled={enviando || filasValidas.length === 0}
          onClick={() => void confirmarTanda()}
        >
          <i className="ti ti-check" aria-hidden />{" "}
          {enviando ? "confirmando…" : `confirmar retiro de la tanda (${filasValidas.length})`}
        </button>
        <span className="pill">arranca freetime</span>
      </div>

      {okMsg && <div className="ok">{okMsg}</div>}
      {errMsg && <div className="err">{errMsg}</div>}
    </section>
  );
}
