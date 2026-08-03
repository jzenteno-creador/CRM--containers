"use client";

// Escaneo de sigla por cámara — integrado a /ingreso (2026-08-03), sobre la PoC ya
// probada de /vision/escanear. Reusa camara.ts (apertura/cierre de stream, captura de
// frame ≤1280px) y pega contra el MISMO endpoint /api/vision/scan (server-side, Bearer
// del usuario) que la solapa de prueba — NO se toca /vision ni scan_pruebas, este
// componente es un consumer nuevo del contrato ya existente.
//
// 6 estados: pidiendo-permiso → capturando → procesando → resultado, con las salidas
// laterales sin-permiso (getUserMedia falló) y error (el POST a /api/vision/scan
// falló o el server respondió ok:false). La cámara se abre al montar y se LIBERA
// SIEMPRE al desmontar (stop de tracks) — TandaForm renderiza este componente
// condicionalmente, así que cerrar el modal = desmontar = cámara apagada, sin
// excepción (mismo contrato que exige la spec del módulo).
//
// "Usar esta sigla" solo habilita con check digit válido (regla de producto explícita,
// misma que /vision/escanear y ScanVivo): un OCR nunca se acepta a ciegas. El consumer
// (TandaForm) igual vuelve a pasar el número por su propio pipeline de validación ISO
// 6346 antes de sumarlo a la tanda — este modal nunca es la única puerta de validación.

import { useEffect, useRef, useState } from "react";
import { ContainerNumber } from "@/components/container-number";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { ErrorState } from "@/components/fd/error-state";
import { Modal } from "@/components/fd/modal";
import { getSupabase } from "@/lib/supabase";
import {
  ERRORES_CAMARA,
  abrirCamara,
  capturarFrame,
  errorDeCamara,
  soportaCamara,
  type ErrorCamara,
  type Facing,
} from "../vision/camara";
import type { ScanRespuesta } from "../vision/escanear/tipos";

type EstadoModal =
  | "pidiendo-permiso"
  | "sin-permiso"
  | "capturando"
  | "procesando"
  | "resultado"
  | "error";

function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

export function EscanearSiglaModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  /** Sigla con dígito verificador YA validado (solo se llama cuando `valido===true`).
   * El consumer igual la corre por su propio pipeline — este modal no es la única puerta. */
  onConfirm: (numero: string) => void;
}) {
  const [estado, setEstado] = useState<EstadoModal>("pidiendo-permiso");
  const [facing, setFacing] = useState<Facing>("environment");
  const [errorCamara, setErrorCamara] = useState<ErrorCamara | null>(null);
  const [errorScan, setErrorScan] = useState<{ titulo: string; detalle: string } | null>(null);
  const [previewCapturada, setPreviewCapturada] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState<ScanRespuesta | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sesionRef = useRef(0); // generación: mata cualquier callback en vuelo de una apertura vieja
  const facingRef = useRef<Facing>("environment");
  const abortRef = useRef<AbortController | null>(null);
  const frameRef = useRef<string | null>(null); // último frame capturado — "Reintentar" del error lo reenvía sin recapturar

  /** Corta stream + fetch en vuelo. Idempotente; sesion++ mata cualquier callback zombie. */
  function parar() {
    sesionRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  /** Apertura de cámara SIN tocar estado de React (regla set-state-in-effect: nada acá
   * setea antes del primer await, así `iniciarCamara` puede llamarse tanto desde el
   * useEffect de montaje como desde un click de reintento sin violar la regla). */
  async function abrirCamaraSegura(
    target: Facing,
  ): Promise<{ ok: true; stream: MediaStream; facingReal: Facing } | { ok: false; error: ErrorCamara }> {
    if (!soportaCamara()) return { ok: false, error: ERRORES_CAMARA.noSoportado };
    try {
      const { stream, facingReal } = await abrirCamara(target);
      return { ok: true, stream, facingReal };
    } catch (e) {
      return { ok: false, error: errorDeCamara(e) };
    }
  }

  async function iniciarCamara(target: Facing) {
    parar();
    const sesion = sesionRef.current;
    const resultado = await abrirCamaraSegura(target); // primer await: nada setea antes de esto
    if (sesion !== sesionRef.current) {
      if (resultado.ok) resultado.stream.getTracks().forEach((t) => t.stop());
      return;
    }
    if (!resultado.ok) {
      setErrorCamara(resultado.error);
      setEstado("sin-permiso");
      return;
    }
    streamRef.current = resultado.stream;
    facingRef.current = resultado.facingReal;
    setFacing(resultado.facingReal);
    const video = videoRef.current;
    if (!video) {
      parar();
      return;
    }
    video.srcObject = resultado.stream;
    try {
      await video.play();
    } catch {
      // muted+playsInline autoplay igual funciona; play() solo rebota si se navegó en el medio
    }
    if (sesion !== sesionRef.current) return;
    setEstado("capturando");
  }

  // abre la cámara al montar (el montaje del modal ES el gesto del usuario que lo
  // disparó); la libera SIEMPRE al desmontar — cerrar el modal = desmontar. El estado
  // inicial YA es "pidiendo-permiso"/sin error (useState de arriba) — no hace falta
  // resetear nada acá, así el efecto no dispara ningún setState síncrono.
  useEffect(() => {
    // IIFE async: los setState de iniciarCamara quedan detrás del await
    // (set-state-in-effect — mismo patrón que el resto del repo)
    void (async () => {
      await iniciarCamara("environment");
    })();
    return () => parar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Reintento desde un click (ErrorState / cambiar cámara): acá SÍ es válido resetear
   * síncrono — no corre dentro de un efecto. */
  function reintentarCamara(target: Facing) {
    setErrorCamara(null);
    setEstado("pidiendo-permiso");
    void iniciarCamara(target);
  }

  function cambiarCamara() {
    const next: Facing = facingRef.current === "environment" ? "user" : "environment";
    reintentarCamara(next);
  }

  async function enviarFrame(frame: string) {
    const sesion = sesionRef.current;
    frameRef.current = frame;
    setEstado("procesando");
    setErrorScan(null);
    setRespuesta(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { data } = await getSupabase().auth.getSession();
      if (sesion !== sesionRef.current) return;
      const token = data.session?.access_token;
      if (!token) {
        setErrorScan({ titulo: "Sesión vencida", detalle: "Volvé a iniciar sesión para poder escanear." });
        setEstado("error");
        return;
      }
      const res = await fetch("/api/vision/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64: frame }),
        signal: controller.signal,
      });
      const json = (await res.json()) as ScanRespuesta;
      if (sesion !== sesionRef.current) return;
      if (!json.ok) {
        setErrorScan({
          titulo: json.error === "sin_configurar" ? "Escaneo sin configurar" : "No se pudo escanear",
          detalle: json.detalle,
        });
        setEstado("error");
        return;
      }
      setRespuesta(json);
      setEstado("resultado");
    } catch (e) {
      // abort disparado por parar() (cerrar el modal a mitad de un envío): silencio.
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (sesion !== sesionRef.current) return;
      setErrorScan({
        titulo: "No se pudo escanear",
        detalle: e instanceof Error ? e.message : "Error de red al enviar la foto.",
      });
      setEstado("error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function capturar() {
    if (estado !== "capturando") return;
    const video = videoRef.current;
    const frame = video ? capturarFrame(video) : null;
    if (!frame) {
      setErrorScan({
        titulo: "No se pudo capturar la imagen",
        detalle: "La cámara todavía no tiene una imagen lista — esperá un instante y probá de nuevo.",
      });
      setEstado("error");
      return;
    }
    setPreviewCapturada(`data:image/jpeg;base64,${frame}`);
    void enviarFrame(frame);
  }

  function reintentarEnvio() {
    if (frameRef.current) void enviarFrame(frameRef.current);
  }

  function volverACapturar() {
    setRespuesta(null);
    setErrorScan(null);
    setPreviewCapturada(null);
    setEstado("capturando");
  }

  function usarSigla() {
    if (respuesta?.ok !== true || !respuesta.sigla?.valido) return;
    onConfirm(respuesta.sigla.sigla);
    onClose();
  }

  const resultadoOk = respuesta?.ok === true ? respuesta : null;
  const puedeUsar = resultadoOk?.sigla?.valido === true;

  return (
    <Modal open onClose={onClose} title="Escanear sigla con cámara" width={640}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {estado !== "sin-permiso" && (
          <div
            style={{
              position: "relative",
              background: "#000",
              borderRadius: "var(--radius-input)",
              border: "1px solid var(--color-border-subtle)",
              overflow: "hidden",
              minHeight: 280,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{
                display: estado === "capturando" ? "block" : "none",
                width: "100%",
                maxHeight: "56vh",
                objectFit: "cover",
                transform: estado === "capturando" && facing === "user" ? "scaleX(-1)" : undefined,
              }}
            />
            {estado !== "capturando" && previewCapturada && (
              // eslint-disable-next-line @next/next/no-img-element -- data URL local, next/image no aplica
              <img
                src={previewCapturada}
                alt="Foto capturada del contenedor"
                style={{ width: "100%", maxHeight: "56vh", objectFit: "cover", display: "block" }}
              />
            )}
            {estado === "pidiendo-permiso" && !previewCapturada && (
              <p
                style={{
                  margin: 0,
                  maxWidth: 360,
                  padding: "0 20px",
                  textAlign: "center",
                  fontSize: 12.5,
                  color: "var(--color-text-muted)",
                }}
              >
                Pidiendo acceso a la cámara…
              </p>
            )}
          </div>
        )}

        {estado === "sin-permiso" && errorCamara && (
          <ErrorState
            title={errorCamara.titulo}
            detail={errorCamara.detalle}
            onRetry={() => reintentarCamara(facing)}
            retryLabel="Reintentar"
          />
        )}

        {estado === "capturando" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="ghost" icon="ti-camera-rotate" onClick={cambiarCamara} style={{ minHeight: 44 }}>
              {facing === "environment" ? "Trasera" : "Frontal"}
            </Button>
            {/* botón de captura: pensado para usar con guantes — mínimo 56px de alto */}
            <Button
              variant="primary"
              icon="ti-camera"
              onClick={capturar}
              style={{ minHeight: 56, fontSize: 15, fontWeight: 700, flex: 1, minWidth: 200 }}
            >
              Capturar
            </Button>
          </div>
        )}

        {estado === "procesando" && (
          <Button variant="primary" icon="ti-scan" loading style={{ minHeight: 56, fontSize: 15 }}>
            Leyendo sigla…
          </Button>
        )}

        {estado === "error" && errorScan && (
          <ErrorState
            title={errorScan.titulo}
            detail={errorScan.detalle}
            onRetry={reintentarEnvio}
            retryLabel="Reintentar"
          />
        )}

        {estado === "resultado" && resultadoOk && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {resultadoOk.sigla ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  padding: "20px 12px",
                  background: "var(--color-surface-2)",
                  border: `1px solid ${resultadoOk.sigla.valido ? "var(--color-green-line)" : "var(--color-red-line)"}`,
                  borderRadius: "var(--radius-input)",
                }}
              >
                <span style={{ fontSize: 30, letterSpacing: "0.12em" }}>
                  <ContainerNumber value={resultadoOk.sigla.sigla} colorize={false} />
                </span>
                {resultadoOk.sigla.valido ? (
                  <Badge tone="verde" icon="ti-check">
                    Dígito verificador OK ({resultadoOk.sigla.digitoCalculado})
                  </Badge>
                ) : (
                  <Badge tone="rojo" icon="ti-alert-triangle">
                    REVISAR — leído «{resultadoOk.sigla.digitoLeido}», calculado {resultadoOk.sigla.digitoCalculado}
                  </Badge>
                )}
                <span style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
                  Confianza OCR: {pct(resultadoOk.confianza)}
                </span>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  padding: "20px 12px",
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "var(--radius-input)",
                }}
              >
                <i className="ti ti-zoom-question" aria-hidden style={{ fontSize: 26, color: "var(--color-text-faint)" }} />
                <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)", textAlign: "center" }}>
                  No se encontró una sigla en la foto. Probá más cerca, de frente y con el número completo en cuadro.
                </span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" icon="ti-refresh" onClick={volverACapturar} style={{ flex: 1, minHeight: 44 }}>
                Reintentar
              </Button>
              <Button
                variant="primary"
                icon="ti-check"
                disabled={!puedeUsar}
                onClick={usarSigla}
                style={{ flex: 1, minHeight: 44 }}
              >
                Usar esta sigla
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
