"use client";

// Modo "En vivo" del escaneo: cámara encendida como stream, un frame cada ~1.5s al
// endpoint (modo vivo: el server registra SOLO verdes, con dedup global de 5 min).
// SIN COCO-SSD a propósito: acá lo único que importa es la sigla — este componente no
// carga TF.js ni dibuja cajas de detección genérica (decisión de producto, brief John).
//
// Frenos del brief: requests NUNCA solapadas — el próximo frame se agenda recién cuando
// respondió el anterior, con cadencia objetivo ~1.5s (elapsed-aware); loop y stream
// mueren en Detener/unmount vía contador de generación (mismo patrón que vision-client).

import { useEffect, useRef, useState } from "react";
import { ContainerNumber } from "@/components/container-number";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { ErrorState } from "@/components/fd/error-state";
import { getSupabase } from "@/lib/supabase";
import {
  ERRORES_CAMARA,
  abrirCamara,
  capturarFrame,
  errorDeCamara,
  soportaCamara,
  type ErrorCamara,
  type Facing,
} from "../camara";
import type { ScanRespuesta } from "./tipos";

const CADENCIA_MS = 1500;

type EstadoVivo = "idle" | "iniciando" | "activo" | "error";

export function ScanVivo({ onRegistrado }: { onRegistrado: () => void }) {
  const [estado, setEstado] = useState<EstadoVivo>("idle");
  const [facing, setFacing] = useState<Facing>("environment");
  const [error, setError] = useState<ErrorCamara | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [ultima, setUltima] = useState<ScanRespuesta | null>(null);
  const [ultimoRegistro, setUltimoRegistro] = useState<{ sigla: string; hora: string } | null>(
    null,
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sesionRef = useRef(0);
  const facingRef = useRef<Facing>("environment");
  const fallosRef = useRef(0); // fallas consecutivas del endpoint — 3 seguidas cortan el loop

  /** Corta loop + stream. Idempotente; sesion++ mata cualquier ciclo en vuelo. */
  function parar() {
    sesionRef.current += 1;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  // salir de la página (o desmontar el modo) apaga cámara y timers SIEMPRE
  useEffect(() => {
    return () => parar();
  }, []);

  async function ciclo(sesion: number) {
    if (sesion !== sesionRef.current) return;
    const inicio = performance.now();
    let huboRegistro = false;
    let fallo: string | null = null;

    const video = videoRef.current;
    const frame = video ? capturarFrame(video) : null;
    if (frame) {
      setLeyendo(true);
      try {
        const { data } = await getSupabase().auth.getSession();
        // getSession puede awaitear red (refresh de token en vuelo): sin este check un
        // ciclo zombie dispara un POST después de Detener/toggle/unmount (P1 del review)
        if (sesion !== sesionRef.current) return;
        const token = data.session?.access_token;
        if (!token) {
          fallo = "Sesión vencida — volvé a iniciar sesión.";
        } else {
          const res = await fetch("/api/vision/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ imageBase64: frame, modo: "vivo" }),
          });
          const json = (await res.json()) as ScanRespuesta;
          if (sesion !== sesionRef.current) return;
          setUltima(json);
          if (json.ok) {
            if (json.registrado && json.sigla) {
              setUltimoRegistro({
                sigla: json.sigla.sigla,
                hora: new Date().toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }),
              });
              huboRegistro = true;
            }
          } else {
            fallo = json.detalle;
          }
        }
      } catch (e) {
        if (sesion !== sesionRef.current) return;
        fallo = e instanceof Error ? e.message : "Error de red al enviar el frame.";
        setUltima({ ok: false, error: "red", detalle: fallo });
      } finally {
        if (sesion === sesionRef.current) setLeyendo(false);
      }
    }

    if (sesion !== sesionRef.current) return;
    if (huboRegistro) onRegistrado();

    if (fallo) {
      fallosRef.current += 1;
      // 3 fallas seguidas (token vencido / Roboflow caído / sin key / red): cortar el
      // loop y mostrar el error — sin esto la UI queda muda martillando el endpoint
      // cada ~1.5s (P2 del review)
      if (fallosRef.current >= 3) {
        parar();
        setLeyendo(false);
        setError({
          titulo: "El escaneo en vivo se detuvo",
          detalle: `${fallo} (3 lecturas fallidas seguidas)`,
        });
        setEstado("error");
        return;
      }
    } else if (frame) {
      fallosRef.current = 0;
    }

    // cadencia elapsed-aware SIN overlap: recién acá (post-respuesta) se agenda el próximo
    const espera = Math.max(250, CADENCIA_MS - (performance.now() - inicio));
    timerRef.current = setTimeout(() => void ciclo(sesion), espera);
  }

  /** Arranque por gesto (botón). Renegocia desde cero — mismo contrato que la solapa cámara. */
  async function iniciar(target: Facing) {
    parar();
    const sesion = sesionRef.current;
    fallosRef.current = 0;
    setError(null);
    setUltima(null);
    setEstado("iniciando");

    if (!soportaCamara()) {
      setError(ERRORES_CAMARA.noSoportado);
      setEstado("error");
      return;
    }
    try {
      const { stream, facingReal } = await abrirCamara(target);
      if (sesion !== sesionRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      facingRef.current = facingReal;
      setFacing(facingReal);
      const video = videoRef.current;
      if (!video) {
        parar();
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // muted+playsInline autoplay igual; play() solo rebota si se navegó en el medio
      }
      if (sesion !== sesionRef.current) return;
      setEstado("activo");
      // primer frame apenas el video tenga datos (capturarFrame devuelve null si aún no)
      timerRef.current = setTimeout(() => void ciclo(sesion), 400);
    } catch (e) {
      if (sesion !== sesionRef.current) return;
      setError(errorDeCamara(e));
      setEstado("error");
    }
  }

  function detener() {
    parar();
    setLeyendo(false);
    setEstado("idle");
  }

  function cambiarCamara() {
    const next: Facing = facingRef.current === "environment" ? "user" : "environment";
    facingRef.current = next;
    setFacing(next);
    if (estado === "activo") void iniciar(next);
  }

  const activo = estado === "activo";
  const lectura = ultima?.ok === true ? ultima : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
            Detener
          </Button>
        ) : (
          <Button
            variant="primary"
            icon="ti-video"
            loading={estado === "iniciando"}
            onClick={() => void iniciar(facing)}
          >
            {estado === "iniciando" ? "Iniciando…" : "Iniciar escaneo en vivo"}
          </Button>
        )}
        {activo && (
          <Badge tone={leyendo ? "accent" : "neutro"} icon={leyendo ? "ti-loader-2" : "ti-eye"}>
            {leyendo ? "leyendo…" : "esperando frame"}
          </Badge>
        )}
      </div>

      <div
        style={{
          position: "relative",
          background: "#000",
          borderRadius: "var(--radius-input)",
          overflow: "hidden",
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{
            display: activo ? "block" : "none",
            width: "100%",
            height: "auto",
            transform: activo && facing === "user" ? "scaleX(-1)" : undefined,
          }}
        />
        {!activo && (
          <div style={{ minHeight: 260, display: "grid", placeItems: "center" }}>
            {estado === "error" && error ? (
              <ErrorState
                title={error.titulo}
                detail={error.detalle}
                onRetry={() => void iniciar(facing)}
                retryLabel="Reintentar"
              />
            ) : (
              <p
                style={{
                  margin: 0,
                  maxWidth: 420,
                  padding: "28px 20px",
                  textAlign: "center",
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  color: "var(--color-text-muted)",
                }}
              >
                {estado === "iniciando"
                  ? "Pidiendo cámara…"
                  : "Apuntá la cámara trasera a la sigla del contenedor. Cada lectura verde se registra sola (con su foto de comprobante); las rojas se muestran pero no se guardan."}
              </p>
            )}
          </div>
        )}
      </div>

      {/* readout de la última lectura */}
      {activo && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            padding: "14px 12px",
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "var(--radius-input)",
          }}
        >
          {lectura?.sigla ? (
            <>
              <span
                style={{
                  fontSize: 24,
                  letterSpacing: "0.12em",
                  color: lectura.sigla.valido
                    ? "var(--color-status-green)"
                    : "var(--color-status-red)",
                }}
              >
                <ContainerNumber value={lectura.sigla.sigla} colorize={false} />
              </span>
              {lectura.sigla.valido ? (
                lectura.motivoNoRegistro === "duplicado" ? (
                  <Badge tone="amarillo" icon="ti-copy">
                    ya registrado hace &lt;5 min
                  </Badge>
                ) : (
                  <Badge tone="verde" icon="ti-check">
                    Dígito OK ({lectura.sigla.digitoCalculado})
                  </Badge>
                )
              ) : (
                <Badge tone="rojo" icon="ti-alert-triangle">
                  REVISAR — leído «{lectura.sigla.digitoLeido}», calculado{" "}
                  {lectura.sigla.digitoCalculado} · no se registra
                </Badge>
              )}
              {lectura.errorRegistro && (
                <span style={{ fontSize: 11.5, color: "var(--color-status-amber)" }}>
                  {lectura.errorRegistro}
                </span>
              )}
            </>
          ) : ultima && !ultima.ok ? (
            // falla transitoria (el loop reintenta; a las 3 seguidas se corta solo)
            <span style={{ fontSize: 12, color: "var(--color-status-amber)" }}>
              <i className="ti ti-alert-triangle" aria-hidden /> {ultima.detalle}
            </span>
          ) : (
            <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
              buscando sigla en el cuadro…
            </span>
          )}
        </div>
      )}

      {/* feedback del último auto-registro */}
      {ultimoRegistro && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: "var(--color-green-tint)",
            border: "1px solid var(--color-green-line)",
            borderRadius: "var(--radius-input)",
            color: "var(--color-status-green)",
            fontSize: 12.5,
          }}
        >
          <i className="ti ti-circle-check" aria-hidden />
          Contenedor registrado:&nbsp;
          <ContainerNumber value={ultimoRegistro.sigla} colorize={false} />
          <span style={{ marginLeft: "auto", color: "var(--color-text-muted)" }}>
            {ultimoRegistro.hora}
          </span>
        </div>
      )}

      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: "var(--color-text-faint)" }}>
        Cada lectura tarda ~1–2 s (el OCR corre en la API hosted de Roboflow): es un
        auto-scan continuo, no 30 fps. Solo las lecturas con dígito verificador válido se
        registran, máximo una vez cada 5 minutos por sigla.
      </p>
    </div>
  );
}
