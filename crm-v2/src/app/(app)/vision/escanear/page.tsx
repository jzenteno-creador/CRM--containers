"use client";

// /vision/escanear — PoC escaneo de sigla ISO 6346 (MODO PRUEBA, 2026-07-18).
// El usuario saca/sube una foto del contenedor desde el celular; el server (route
// handler /api/vision/scan) corre el OCR hosted de Roboflow y valida el dígito
// verificador; acá se muestra el resultado y los últimos registros de prueba de
// crm.scan_pruebas (tabla desechable, RLS: insert/delete propios, select compartido).
// La foto se reduce client-side a ≤1280px antes de enviar (límite request de Vercel).

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ContainerNumber } from "@/components/container-number";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { DataTable, type Column } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { ConfirmDialog } from "@/components/fd/modal";
import { PageHeader } from "@/components/fd/page-header";
import { limpiarRegistrosPropios } from "@/lib/scan-comprobantes";
import { getSupabase } from "@/lib/supabase";
import type { ScanRespuesta } from "./tipos";
import { ScanVivo } from "./vivo";

type ScanRow = {
  id: string;
  usuario_id: string;
  sigla_leida: string | null;
  check_digit_valido: boolean | null;
  confianza: number | null;
  modelo_usado: string | null;
  created_at: string;
};

const MAX_LADO = 1280; // px — suficiente para el OCR, mantiene el payload chico

/** Reduce la foto en el cliente: canvas a ≤MAX_LADO px, JPEG 0.85, base64 sin prefijo. */
async function reducirFoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible en este navegador.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return dataUrl.replace(/^data:image\/\w+;base64,/, "");
}

const fmtFechaHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

/** Últimos 20 registros de prueba. Pura (sin setState): null = error de carga. */
async function fetchUltimos(): Promise<ScanRow[] | null> {
  try {
    const { data, error } = await getSupabase()
      .from("scan_pruebas")
      .select("id, usuario_id, sigla_leida, check_digit_valido, confianza, modelo_usado, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    return error ? null : ((data as ScanRow[]) ?? []);
  } catch {
    return null;
  }
}

export default function EscanearPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [modoVivo, setModoVivo] = useState(false);
  const [preview, setPreview] = useState<string | null>(null); // data URL reducida
  const [base64, setBase64] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [respuesta, setRespuesta] = useState<ScanRespuesta | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  // undefined = cargando · null = error · array = poblada
  const [rows, setRows] = useState<ScanRow[] | null | undefined>(undefined);
  const [limpiando, setLimpiando] = useState(false);
  const [confirmLimpiar, setConfirmLimpiar] = useState(false);
  const [errorLimpiar, setErrorLimpiar] = useState<string | null>(null);

  // carga inicial: IIFE async con guard `alive` (patrón del shell) — el estado inicial
  // ya es undefined (cargando), setRows corre solo DESPUÉS del await
  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await fetchUltimos();
      if (alive) setRows(r);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // refetch desde handlers: reset síncrono a skeleton + fetch (acá sí es legal)
  function recargar() {
    setRows(undefined);
    void fetchUltimos().then(setRows);
  }

  async function elegirFoto(file: File | null) {
    setRespuesta(null);
    setErrorFoto(null);
    setPreview(null);
    setBase64(null);
    if (!file) return;
    try {
      const b64 = await reducirFoto(file);
      setBase64(b64);
      setPreview(`data:image/jpeg;base64,${b64}`);
    } catch (e) {
      setErrorFoto(e instanceof Error ? e.message : "No se pudo procesar la foto.");
    }
  }

  async function escanear() {
    if (!base64) return;
    setEnviando(true);
    setRespuesta(null);
    try {
      const { data } = await getSupabase().auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setRespuesta({ ok: false, error: "sin_autenticacion", detalle: "Sesión vencida — volvé a iniciar sesión." });
        return;
      }
      const res = await fetch("/api/vision/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const json = (await res.json()) as ScanRespuesta;
      setRespuesta(json);
      if (json.ok && json.registrado) recargar();
    } catch (e) {
      setRespuesta({
        ok: false,
        error: "red",
        detalle: e instanceof Error ? e.message : "Error de red al enviar la foto.",
      });
    } finally {
      setEnviando(false);
    }
  }

  async function limpiarMisPruebas() {
    setLimpiando(true);
    setErrorLimpiar(null);
    try {
      // rutina compartida con /vision/registros: fotos del bucket PRIMERO, filas después
      // (el review cazó la regresión: borrar solo filas dejaba comprobantes huérfanos)
      const err = await limpiarRegistrosPropios();
      if (err) {
        setErrorLimpiar(err);
        return;
      }
      recargar();
    } finally {
      setLimpiando(false);
      setConfirmLimpiar(false);
    }
  }

  const columns: Column<ScanRow>[] = [
    {
      key: "fecha",
      header: "Fecha",
      render: (r) => <span className="mono">{fmtFechaHora.format(new Date(r.created_at))}</span>,
      sortValue: (r) => r.created_at,
      width: "90px",
    },
    {
      key: "sigla",
      header: "Sigla leída",
      render: (r) =>
        r.sigla_leida ? (
          <ContainerNumber value={r.sigla_leida} />
        ) : (
          <span style={{ color: "var(--color-text-faint)" }}>— sin sigla —</span>
        ),
    },
    {
      key: "estado",
      header: "Dígito",
      render: (r) =>
        r.check_digit_valido === null ? (
          <Badge tone="neutro">s/d</Badge>
        ) : r.check_digit_valido ? (
          <Badge tone="verde" icon="ti-check">OK</Badge>
        ) : (
          <Badge tone="rojo" icon="ti-alert-triangle">revisar</Badge>
        ),
      width: "110px",
    },
    {
      key: "confianza",
      header: "Conf.",
      render: (r) => pct(r.confianza),
      numeric: true,
      width: "70px",
      hideOnMobile: true,
    },
    {
      key: "modelo",
      header: "Modelo",
      render: (r) => <span style={{ color: "var(--color-text-muted)" }}>{r.modelo_usado ?? "—"}</span>,
      hideOnMobile: true,
    },
  ];

  const resultadoOk = respuesta?.ok === true ? respuesta : null;

  return (
    <>
      <PageHeader
        title="Escanear sigla"
        counters={
          <>
            <Badge tone="amarillo">MODO PRUEBA</Badge>
            <Badge tone="neutro">OCR + ISO 6346</Badge>
          </>
        }
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="ghost" icon="ti-photo" onClick={() => router.push("/vision/registros")}>
              Registros
            </Button>
            <Button variant="ghost" icon="ti-camera" onClick={() => router.push("/vision")}>
              Detección de objetos
            </Button>
            {!modoVivo && (
              <Button
                variant="primary"
                icon="ti-photo-scan"
                onClick={() => inputRef.current?.click()}
              >
                {preview ? "Otra foto" : "Sacar / elegir foto"}
              </Button>
            )}
          </div>
        }
      />

      {/* modo: Foto (una a la vez) | En vivo (auto-scan continuo) */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Button
          variant={modoVivo ? "ghost" : "primary"}
          icon="ti-photo-scan"
          onClick={() => setModoVivo(false)}
        >
          Foto
        </Button>
        <Button
          variant={modoVivo ? "primary" : "ghost"}
          icon="ti-video"
          onClick={() => setModoVivo(true)}
        >
          En vivo
        </Button>
      </div>
      {/* capture=environment: en el celular abre la cámara trasera directo */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => void elegirFoto(e.target.files?.[0] ?? null)}
      />

      <section className="fd-panel" style={{ maxWidth: 720 }}>
        <div className="fd-panel-title">
          <i className={`ti ${modoVivo ? "ti-video" : "ti-scan"}`} aria-hidden />
          {modoVivo ? "Escaneo en vivo" : "Foto y resultado"}
        </div>
        <div className="fd-panel-body">
          {modoVivo && <ScanVivo onRegistrado={recargar} />}
          {!modoVivo && !preview && !errorFoto && (
            <EmptyState icon="ti-photo-scan" title="Sin foto todavía">
              Sacá una foto de la sigla del contenedor (o subí una de la galería). El sistema
              lee el texto, reconstruye la sigla ISO 6346 y valida el dígito verificador.
              Los registros son de prueba — se pueden borrar cuando quieras.
            </EmptyState>
          )}
          {!modoVivo && errorFoto && <ErrorState title="No se pudo leer la foto" detail={errorFoto} />}

          {!modoVivo && preview && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* imagen anotada del modelo si vino; sino la preview local */}
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL local, next/image no aplica */}
              <img
                src={resultadoOk?.imagenAnotada ?? preview}
                alt="Foto del contenedor a escanear"
                style={{
                  width: "100%",
                  borderRadius: "var(--radius-input)",
                  border: "1px solid var(--color-border-subtle)",
                }}
              />
              {!respuesta && (
                <Button variant="primary" icon="ti-scan" loading={enviando} onClick={() => void escanear()}>
                  {enviando ? "Escaneando…" : "Escanear sigla"}
                </Button>
              )}
            </div>
          )}

          {!modoVivo && respuesta && !respuesta.ok && (
            <ErrorState
              title={
                respuesta.error === "sin_configurar"
                  ? "Escaneo sin configurar"
                  : "No se pudo escanear"
              }
              detail={respuesta.detalle}
              onRetry={() => void escanear()}
              retryLabel="Reintentar"
            />
          )}

          {!modoVivo && resultadoOk && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              {resultadoOk.sigla ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    padding: "18px 12px",
                    background: "var(--color-surface-2)",
                    border: `1px solid ${resultadoOk.sigla.valido ? "var(--color-green-line)" : "var(--color-red-line)"}`,
                    borderRadius: "var(--radius-input)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 26,
                      letterSpacing: "0.12em",
                      color: resultadoOk.sigla.valido
                        ? "var(--color-status-green)"
                        : "var(--color-status-red)",
                    }}
                  >
                    {/* display centralizado del estándar; colorize off — acá el color es por validez */}
                    <ContainerNumber value={resultadoOk.sigla.sigla} colorize={false} />
                  </span>
                  {resultadoOk.sigla.valido ? (
                    <Badge tone="verde" icon="ti-check">
                      Dígito verificador OK ({resultadoOk.sigla.digitoCalculado})
                    </Badge>
                  ) : (
                    <Badge tone="rojo" icon="ti-alert-triangle">
                      REVISAR — leído «{resultadoOk.sigla.digitoLeido}», calculado{" "}
                      {resultadoOk.sigla.digitoCalculado}
                    </Badge>
                  )}
                  <span style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
                    Confianza OCR: {pct(resultadoOk.confianza)}
                    {!resultadoOk.registrado && " · ⚠ no se guardó el registro"}
                  </span>
                  {resultadoOk.errorRegistro && (
                    <span style={{ fontSize: 11.5, color: "var(--color-status-amber)" }}>
                      Error al guardar: {resultadoOk.errorRegistro}
                    </span>
                  )}
                </div>
              ) : (
                <EmptyState icon="ti-zoom-question" title="No se encontró una sigla en la foto">
                  El OCR leyó texto pero ninguno matchea el formato ISO 6346 (4 letras + 6
                  dígitos + verificador). Probá más cerca, de frente y con la sigla completa en
                  cuadro. El intento quedó registrado igual.
                </EmptyState>
              )}

              {resultadoOk.recognizedText && (
                <p style={{ margin: 0, fontSize: 11.5, color: "var(--color-text-muted)" }}>
                  Texto completo leído: <span className="mono">{resultadoOk.recognizedText}</span>
                </p>
              )}

              <details>
                <summary style={{ cursor: "pointer", fontSize: 11.5, color: "var(--color-text-label)" }}>
                  JSON crudo del workflow (debug)
                </summary>
                <pre
                  style={{
                    margin: "8px 0 0",
                    padding: 10,
                    fontSize: 10.5,
                    lineHeight: 1.4,
                    background: "var(--color-table-head)",
                    border: "1px solid var(--color-border-subtle)",
                    borderRadius: "var(--radius-input)",
                    overflowX: "auto",
                    maxHeight: 320,
                  }}
                >
                  {JSON.stringify(respuesta, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </section>

      <section className="fd-panel" style={{ maxWidth: 720 }}>
        <div className="fd-panel-title">
          <i className="ti ti-list-details" aria-hidden />
          Últimos escaneos de prueba
          <span className="fd-count">{rows?.length ?? "…"}</span>
        </div>
        <div className="fd-panel-body">
          <DataTable<ScanRow>
            columns={columns}
            rows={rows ?? []}
            rowKey={(r) => r.id}
            loading={rows === undefined}
            emptyState={
              <EmptyState icon="ti-scan" title="Sin escaneos todavía">
                Cada foto escaneada se registra acá con su sigla, el resultado de la
                validación y la confianza del OCR. Son datos desechables de prueba.
              </EmptyState>
            }
            errorState={
              // presencia = se muestra (semántica de DataTable): solo cuando la carga falló
              rows === null ? (
                <ErrorState
                  title="No se pudieron cargar los escaneos"
                  detail="Revisá la conexión o reintentá."
                  onRetry={recargar}
                />
              ) : undefined
            }
          />
          <div
            style={{
              marginTop: 10,
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 10,
            }}
          >
            {errorLimpiar && (
              <span style={{ fontSize: 11.5, color: "var(--color-status-amber)" }}>{errorLimpiar}</span>
            )}
            <Button
              variant="ghost"
              icon="ti-trash"
              loading={limpiando}
              onClick={() => setConfirmLimpiar(true)}
            >
              Limpiar mis escaneos
            </Button>
          </div>
          <ConfirmDialog
            open={confirmLimpiar}
            title="¿Limpiar tus escaneos de prueba?"
            message="Borra TODOS tus registros de prueba y sus fotos de comprobante. No se puede deshacer."
            confirmLabel="Borrar todo"
            danger
            loading={limpiando}
            onConfirm={() => void limpiarMisPruebas()}
            onCancel={() => setConfirmLimpiar(false)}
          />
        </div>
      </section>
    </>
  );
}
