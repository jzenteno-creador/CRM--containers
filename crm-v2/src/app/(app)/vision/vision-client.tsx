"use client";

// PoC de monitoreo por cámara (informe "Real-Time Camera Monitoring", Camino A):
// TF.js + COCO-SSD corriendo 100% en el navegador sobre getUserMedia — el video nunca
// sale del dispositivo. Detecta las 90 clases COCO comunes (persona, celular, botella…);
// la lectura de siglas ISO 6346 es fase futura y NO vive acá. Solapa aislada: no toca
// Supabase ni persiste nada.
//
// El motor de captura (loop de inferencia, stop, dibujo) vive a nivel módulo sobre un
// contexto mutable estable — fuera del cuerpo del componente, donde el React Compiler
// exige pureza. El componente solo maneja estado de UI y gestos.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { ErrorState } from "@/components/fd/error-state";
import { PageHeader } from "@/components/fd/page-header";
import type { DetectedObject, ObjectDetection } from "@tensorflow-models/coco-ssd";
import {
  ERRORES_CAMARA,
  abrirCamara,
  errorDeCamara,
  soportaCamara,
  type ErrorCamara,
  type Facing,
} from "./camara";

type Estado = "idle" | "iniciando" | "activo" | "error";

/** Contexto mutable del motor de captura. `sesion` es la generación: cada arranque o
 * parada la bumpea y los loops viejos mueren en su próximo check — sin esto un toggle
 * rápido de cámara deja DOS loops de inferencia vivos. */
type Motor = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  fpsElRef: React.RefObject<HTMLSpanElement | null>;
  objsElRef: React.RefObject<HTMLSpanElement | null>;
  sesion: number;
  raf: number;
  stream: MediaStream | null;
  model: ObjectDetection | null;
  facing: Facing;
  fpsEma: number;
  lastDet: number;
};

// ---- modelo: UNA carga por sesión de navegación (patrón seccionCache del shell) ----
// TF.js (~1.3 MB de runtime) y los pesos (~1 MB, CDN de Google) entran recién con el
// primer "Iniciar cámara" — abrir la solapa no descarga nada pesado.
let modeloPromise: Promise<ObjectDetection> | null = null;

function cargarModelo(): Promise<ObjectDetection> {
  if (!modeloPromise) {
    modeloPromise = (async () => {
      const tf = await import("@tensorflow/tfjs");
      await tf.ready();
      const cocoSsd = await import("@tensorflow-models/coco-ssd");
      return cocoSsd.load({ base: "lite_mobilenet_v2" });
    })();
    // sin red la promesa cacheada quedaría rota para siempre: se descarta para reintentar
    modeloPromise.catch(() => {
      modeloPromise = null;
    });
  }
  return modeloPromise;
}

// ---- tokens para el canvas (no hereda CSS: se leen una vez del :root) ----
let tokensCanvas: { cyan: string; mono: string } | null = null;

function getTokensCanvas() {
  if (!tokensCanvas) {
    const cs = getComputedStyle(document.documentElement);
    tokensCanvas = {
      cyan: cs.getPropertyValue("--color-accent-500").trim() || "#22d3ee",
      mono: cs.getPropertyValue("--font-mono").trim() || "ui-monospace, Menlo, monospace",
    };
  }
  return tokensCanvas;
}

// El único error propio de esta solapa (la descarga del modelo TF.js); el resto de la
// taxonomía de cámara vive en ./camara.ts, compartida con el modo En vivo del escaneo.
const ERROR_MODELO: ErrorCamara = {
  titulo: "No se pudo descargar el modelo",
  detalle:
    "El modelo (~1 MB) se baja del CDN de Google la primera vez. Revisá la conexión y reintentá.",
};

/** Cajas + etiqueta + score sobre el frame. Coordenadas del modelo = píxeles del video;
 * el canvas se dimensiona igual y se estira por CSS junto al <video>, así la alineación
 * es exacta sin transformar nada. `espejar` invierte X cuando la cámara frontal se
 * muestra espejada por CSS (el texto se dibuja normal — solo se mueven las cajas). */
function dibujarDetecciones(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detecciones: DetectedObject[],
  espejar: boolean,
) {
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const { cyan, mono } = getTokensCanvas();
  // escala interna→CSS: la etiqueta rinde ~12.5px en pantalla sin importar la resolución
  const escala = canvas.width / Math.max(1, video.clientWidth);
  const fontPx = Math.max(11, Math.round(12.5 * escala));
  ctx.font = `${fontPx}px ${mono}`;
  ctx.textBaseline = "top";
  ctx.lineWidth = Math.max(1.5, 2 * escala);

  for (const d of detecciones) {
    const [bx, y, w, h] = d.bbox;
    const x = espejar ? canvas.width - bx - w : bx;
    ctx.strokeStyle = cyan;
    ctx.strokeRect(x, y, w, h);

    const label = `${d.class} ${Math.round(d.score * 100)}%`;
    const tw = ctx.measureText(label).width;
    // etiqueta arriba de la caja; si no entra en el frame, adentro
    const ly = y >= fontPx + 8 ? y - fontPx - 6 : y + 4;
    ctx.fillStyle = "rgba(10, 12, 16, 0.85)"; // bg-base translúcido
    ctx.fillRect(x, ly - 2, tw + 10, fontPx + 6);
    ctx.fillStyle = cyan;
    ctx.fillText(label, x + 5, ly + 1);
  }
}

/** Corta loop, stream y overlay. Idempotente; también invalida (sesion++) cualquier
 * arranque en curso. Al salir de la solapa esto apaga la cámara SIEMPRE — sin ello el
 * stream (y la luz de cámara) quedan vivos al navegar. */
function detenerCaptura(m: Motor) {
  m.sesion += 1;
  if (m.raf) {
    cancelAnimationFrame(m.raf);
    m.raf = 0;
  }
  m.stream?.getTracks().forEach((t) => t.stop());
  m.stream = null;
  if (m.videoRef.current) m.videoRef.current.srcObject = null;
  const canvas = m.canvasRef.current;
  canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  m.fpsEma = 0;
  m.lastDet = 0;
}

/** Loop de inferencia: detect(video) → dibujar → rAF. Los contadores se escriben
 * directo al DOM (15–25 updates/s no justifican re-render de React). */
async function correrTick(m: Motor, sesion: number) {
  if (sesion !== m.sesion) return;
  const video = m.videoRef.current;
  const canvas = m.canvasRef.current;
  if (video && canvas && m.model && video.videoWidth > 0 && video.readyState >= 2) {
    let dets: DetectedObject[] | null = null;
    try {
      dets = await m.model.detect(video);
    } catch {
      dets = null; // frame ocasional no decodificable: se saltea sin cortar el loop
    }
    if (sesion !== m.sesion) return; // detenido durante la inferencia
    if (dets) {
      dibujarDetecciones(canvas, video, dets, m.facing === "user");
      // FPS de INFERENCIA (EMA) — el número a medir en hardware real, no el del rAF
      const now = performance.now();
      if (m.lastDet > 0) {
        const inst = 1000 / (now - m.lastDet);
        m.fpsEma = m.fpsEma > 0 ? m.fpsEma * 0.85 + inst * 0.15 : inst;
        if (m.fpsElRef.current) m.fpsElRef.current.textContent = m.fpsEma.toFixed(1);
      }
      m.lastDet = now;
      if (m.objsElRef.current) m.objsElRef.current.textContent = String(dets.length);
    }
  }
  m.raf = requestAnimationFrame(() => void correrTick(m, sesion));
}

export default function VisionClient() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("idle");
  const [facing, setFacing] = useState<Facing>("environment"); // default trasera (celular)
  const [error, setError] = useState<ErrorCamara | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fpsElRef = useRef<HTMLSpanElement>(null);
  const objsElRef = useRef<HTMLSpanElement>(null);

  // contexto mutable del motor — useRef y no useState: el React Compiler exige
  // inmutabilidad sobre valores de useState; el ref es el escape hatch sancionado
  // para mutable de larga vida (solo se toca desde handlers/efectos, nunca en render)
  const motorRef = useRef<Motor>({
    videoRef,
    canvasRef,
    fpsElRef,
    objsElRef,
    sesion: 0,
    raf: 0,
    stream: null,
    model: null,
    facing: "environment",
    fpsEma: 0,
    lastDet: 0,
  });

  useEffect(() => {
    const m = motorRef.current;
    return () => detenerCaptura(m);
  }, []);

  /** Arranca (o renegocia) la captura. SIEMPRE por gesto del usuario — iOS Safari no
   * permite otra cosa. Con `ideal` el desktop sin cámara trasera cae a la webcam
   * disponible en vez de fallar. */
  async function iniciar(target: Facing) {
    const motor = motorRef.current;
    detenerCaptura(motor);
    const sesion = motor.sesion;
    setError(null);
    setEstado("iniciando");

    if (!soportaCamara()) {
      setError(ERRORES_CAMARA.noSoportado);
      setEstado("error");
      return;
    }

    // modelo y permiso en paralelo: la descarga avanza mientras el usuario responde
    const modeloEnCurso = cargarModelo();

    let stream: MediaStream;
    let facingReal: Facing;
    try {
      ({ stream, facingReal } = await abrirCamara(target));
    } catch (e) {
      if (sesion !== motor.sesion) return;
      setError(errorDeCamara(e));
      setEstado("error");
      return;
    }
    if (sesion !== motor.sesion) {
      // detenido/desmontado mientras esperábamos el permiso: liberar sin tocar estado
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    // registrar el stream ANTES de esperar el modelo: si el usuario navega durante la
    // descarga (primera vez, red lenta) el cleanup de unmount ya lo ve y apaga la
    // cámara al instante — track.stop() es idempotente para los stops posteriores
    motor.stream = stream;

    try {
      motor.model = await modeloEnCurso;
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      if (sesion !== motor.sesion) return;
      setError(ERROR_MODELO);
      setEstado("error");
      return;
    }
    if (sesion !== motor.sesion) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    // lado real reportado por el track (lo resuelve abrirCamara): chip y espejado
    // siguen la realidad, no lo pedido
    motor.facing = facingReal;
    setFacing(facingReal);

    const video = videoRef.current;
    if (!video) {
      detenerCaptura(motor);
      return;
    }
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // muted+playsInline autoplay igual; play() solo rebota si se navegó en el medio
    }
    if (sesion !== motor.sesion) return;

    setEstado("activo");
    motor.raf = requestAnimationFrame(() => void correrTick(motor, sesion));
  }

  function detener() {
    detenerCaptura(motorRef.current);
    setEstado("idle");
  }

  function cambiarCamara() {
    const motor = motorRef.current;
    const next: Facing = motor.facing === "environment" ? "user" : "environment";
    motor.facing = next;
    setFacing(next);
    // iOS solo cambia de lente renegociando el stream completo
    if (estado === "activo") void iniciar(next);
  }

  const activo = estado === "activo";
  const espejado = activo && facing === "user";

  return (
    <>
      <PageHeader
        title="Visión"
        counters={
          <>
            <Badge tone="accent">PoC</Badge>
            <Badge tone="neutro">COCO-SSD · 90 clases · 100% en el navegador</Badge>
          </>
        }
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              variant="ghost"
              icon="ti-photo-scan"
              onClick={() => router.push("/vision/escanear")}
            >
              Escanear sigla
            </Button>
            <Button
              variant="ghost"
              icon="ti-camera-rotate"
              onClick={cambiarCamara}
              disabled={estado === "iniciando"}
            >
              {facing === "environment" ? "Trasera" : "Frontal"}
            </Button>
            {activo ? (
              <Button variant="danger" icon="ti-player-stop" onClick={detener}>
                Detener cámara
              </Button>
            ) : (
              <Button
                variant="primary"
                icon="ti-camera"
                loading={estado === "iniciando"}
                onClick={() => void iniciar(facing)}
              >
                {estado === "iniciando" ? "Iniciando…" : "Iniciar cámara"}
              </Button>
            )}
          </div>
        }
      />

      <section className="fd-panel" style={{ maxWidth: 980 }}>
        <div className="fd-panel-title">
          <i className="ti ti-camera" aria-hidden />
          Detección en vivo
          {activo && (
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <Badge tone="accent" mono>
                <span ref={fpsElRef}>—</span>&nbsp;FPS
              </Badge>
              <Badge tone="neutro" mono>
                <span ref={objsElRef}>0</span>&nbsp;obj
              </Badge>
            </span>
          )}
        </div>
        <div className="fd-panel-body">
          <div
            style={{
              position: "relative",
              background: "#000",
              borderRadius: "var(--radius-input)",
              overflow: "hidden",
            }}
          >
            {/* video y canvas SIEMPRE montados (los refs viven antes del primer frame);
                el ancho lo define el video → el overlay calza exacto en cualquier pantalla */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{
                display: activo ? "block" : "none",
                width: "100%",
                height: "auto",
                transform: espejado ? "scaleX(-1)" : undefined,
              }}
            />
            <canvas
              ref={canvasRef}
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
            />
            {!activo && (
              <div style={{ minHeight: 300, display: "grid", placeItems: "center" }}>
                {estado === "error" && error ? (
                  <ErrorState
                    title={error.titulo}
                    detail={error.detalle}
                    onRetry={() => void iniciar(facing)}
                    retryLabel="Reintentar"
                  />
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      gap: 10,
                      padding: "36px 24px",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        background: "var(--color-surface-2)",
                        border: "1px solid var(--color-border-strong)",
                        color: "var(--color-accent-500)",
                        fontSize: 20,
                      }}
                    >
                      <i
                        className={`ti ${estado === "iniciando" ? "ti-loader-2" : "ti-camera"}`}
                        style={
                          estado === "iniciando"
                            ? { display: "inline-block", animation: "fd-spin 700ms linear infinite" }
                            : undefined
                        }
                      />
                    </span>
                    <div
                      className="fd-display"
                      style={{ fontSize: 14, color: "var(--color-text-primary)" }}
                    >
                      {estado === "iniciando"
                        ? "Pidiendo cámara y cargando modelo…"
                        : "Cámara apagada"}
                    </div>
                    <p
                      style={{
                        margin: 0,
                        maxWidth: 440,
                        fontSize: 12.5,
                        lineHeight: 1.5,
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {estado === "iniciando"
                        ? "La primera vez descarga el modelo (~1 MB); las siguientes arranca al toque."
                        : "Tocá «Iniciar cámara» y apuntá a un objeto. La detección corre en tu dispositivo — el video no sale del navegador. En el celular usá la cámara trasera."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 11.5,
              lineHeight: 1.5,
              color: "var(--color-text-faint)",
            }}
          >
            PoC de la capacidad de monitoreo: el modelo reconoce 90 clases comunes (persona,
            celular, botella, silla, camión…). La lectura de siglas de contenedor (ISO 6346)
            es una fase futura con modelo propio.
          </p>
        </div>
      </section>
    </>
  );
}
