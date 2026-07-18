"use client";

// /vision/registros — galería de contenedores detectados (MODO PRUEBA).
// Lee crm.scan_pruebas (más reciente primero) y muestra la foto-comprobante de cada
// detección vía signed URLs del bucket privado crm-scan-comprobantes (patrón
// crm-incidencias: cero URLs públicas). Tocar un registro abre la foto completa.
// "Limpiar mis registros" borra archivos del Storage PRIMERO y filas después (si el
// Storage falla, las filas quedan — así no quedan fotos huérfanas invisibles).

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ContainerNumber } from "@/components/container-number";
import { Badge } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { ConfirmDialog, Modal } from "@/components/fd/modal";
import { PageHeader } from "@/components/fd/page-header";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { BUCKET_SCAN, SIGNED_URL_TTL, limpiarRegistrosPropios } from "@/lib/scan-comprobantes";
import { getSupabase } from "@/lib/supabase";

type RegistroRow = {
  id: string;
  usuario_id: string;
  sigla_leida: string | null;
  check_digit_valido: boolean | null;
  confianza: number | null;
  modelo_usado: string | null;
  imagen_url: string | null;
  created_at: string;
};

type Carga = { rows: RegistroRow[]; urls: Record<string, string> };

const fmtFecha = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const fmtFechaLarga = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Registros + signed URLs de sus fotos. Pura (sin setState): null = error de carga. */
async function fetchRegistros(): Promise<Carga | null> {
  try {
    const { data, error } = await getSupabase()
      .from("scan_pruebas")
      .select(
        "id, usuario_id, sigla_leida, check_digit_valido, confianza, modelo_usado, imagen_url, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) return null;
    const rows = (data as RegistroRow[]) ?? [];

    const paths = rows.map((r) => r.imagen_url).filter((p): p is string => !!p);
    const urls: Record<string, string> = {};
    if (paths.length > 0) {
      const signed = await getSupabase()
        .storage.from(BUCKET_SCAN)
        .createSignedUrls(paths, SIGNED_URL_TTL);
      if (!signed.error && signed.data) {
        for (const item of signed.data) {
          // ítems individuales pueden fallar (archivo borrado a mano) — se tolera
          if (item.path && item.signedUrl && !item.error) urls[item.path] = item.signedUrl;
        }
      }
    }
    return { rows, urls };
  } catch {
    return null;
  }
}

export default function RegistrosPage() {
  const router = useRouter();

  // undefined = cargando · null = error · Carga = poblada
  const [carga, setCarga] = useState<Carga | null | undefined>(undefined);
  const [sel, setSel] = useState<RegistroRow | null>(null);
  const [limpiando, setLimpiando] = useState(false);
  const [confirmLimpiar, setConfirmLimpiar] = useState(false);
  const [errorLimpiar, setErrorLimpiar] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const c = await fetchRegistros();
      if (alive) setCarga(c);
    })();
    return () => {
      alive = false;
    };
  }, []);

  function recargar() {
    setCarga(undefined);
    void fetchRegistros().then(setCarga);
  }

  async function limpiarMisRegistros() {
    setLimpiando(true);
    setErrorLimpiar(null);
    try {
      // rutina compartida con /vision/escanear (fotos primero, filas después)
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

  const rows = carga && carga !== null ? carga.rows : [];
  const urls = carga && carga !== null ? carga.urls : {};
  const selUrl = sel?.imagen_url ? (urls[sel.imagen_url] ?? null) : null;

  return (
    <>
      <PageHeader
        title="Registros de detección"
        counters={
          <>
            <Badge tone="amarillo">MODO PRUEBA</Badge>
            {carga ? <Badge tone="neutro" mono>{rows.length}</Badge> : null}
          </>
        }
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {errorLimpiar && (
              <span style={{ fontSize: 11.5, color: "var(--color-status-amber)" }}>
                {errorLimpiar}
              </span>
            )}
            <Button
              variant="ghost"
              icon="ti-trash"
              loading={limpiando}
              onClick={() => setConfirmLimpiar(true)}
            >
              Limpiar mis registros
            </Button>
            <Button
              variant="primary"
              icon="ti-scan"
              onClick={() => router.push("/vision/escanear")}
            >
              Escanear
            </Button>
          </div>
        }
      />

      <section className="fd-panel">
        <div className="fd-panel-body">
          {carga === undefined && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 10,
              }}
              aria-hidden
            >
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <SkeletonBlock key={i} width="100%" height={160} delay={i * 80} />
              ))}
            </div>
          )}

          {carga === null && (
            <ErrorState
              title="No se pudieron cargar los registros"
              detail="Revisá la conexión o reintentá."
              onRetry={recargar}
            />
          )}

          {carga && rows.length === 0 && (
            <EmptyState icon="ti-photo" title="Sin registros todavía">
              Cada detección con dígito verificador válido queda acá con su foto de
              comprobante. Escaneá un contenedor (foto o modo en vivo) y aparece al
              instante. Son datos desechables de prueba.
            </EmptyState>
          )}

          {carga && rows.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              {rows.map((r) => {
                const url = r.imagen_url ? (urls[r.imagen_url] ?? null) : null;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSel(r)}
                    style={{
                      padding: 0,
                      textAlign: "left",
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-border-subtle)",
                      borderRadius: "var(--radius-input)",
                      overflow: "hidden",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        aspectRatio: "4 / 3",
                        background: "var(--color-table-head)",
                        display: "grid",
                        placeItems: "center",
                        overflow: "hidden",
                      }}
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed URL efímera, next/image no aplica
                        <img
                          src={url}
                          alt={`Foto del contenedor ${r.sigla_leida ?? "sin sigla"}`}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          loading="lazy"
                        />
                      ) : (
                        <i
                          className="ti ti-photo-off"
                          aria-hidden
                          style={{ fontSize: 22, color: "var(--color-text-faint)" }}
                        />
                      )}
                    </div>
                    <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                      {r.sigla_leida ? (
                        <ContainerNumber value={r.sigla_leida} className="text-[12px]" />
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--color-text-faint)" }}>
                          — sin sigla —
                        </span>
                      )}
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 11,
                          color: "var(--color-text-muted)",
                        }}
                      >
                        <i
                          className={`ti ${r.check_digit_valido ? "ti-check" : "ti-alert-triangle"}`}
                          aria-hidden
                          style={{
                            color: r.check_digit_valido
                              ? "var(--color-status-green)"
                              : "var(--color-status-amber)",
                          }}
                        />
                        <span className="mono">{fmtFecha.format(new Date(r.created_at))}</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmLimpiar}
        title="¿Limpiar tus registros de detección?"
        message="Borra TODOS tus registros de prueba y sus fotos de comprobante. No se puede deshacer."
        confirmLabel="Borrar todo"
        danger
        loading={limpiando}
        onConfirm={() => void limpiarMisRegistros()}
        onCancel={() => setConfirmLimpiar(false)}
      />

      <Modal
        open={sel !== null}
        onClose={() => setSel(null)}
        width={720}
        title={
          sel?.sigla_leida ? <ContainerNumber value={sel.sigla_leida} /> : "Registro sin sigla"
        }
      >
        {sel && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {selUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed URL efímera
              <img
                src={selUrl}
                alt={`Foto completa del contenedor ${sel.sigla_leida ?? "sin sigla"}`}
                style={{ width: "100%", borderRadius: "var(--radius-input)" }}
              />
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-text-muted)" }}>
                Este registro no tiene foto de comprobante (lectura sin sigla válida, o la
                foto fue borrada).
              </p>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {sel.check_digit_valido !== null &&
                (sel.check_digit_valido ? (
                  <Badge tone="verde" icon="ti-check">Dígito OK</Badge>
                ) : (
                  <Badge tone="rojo" icon="ti-alert-triangle">revisar</Badge>
                ))}
              <span style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
                {fmtFechaLarga.format(new Date(sel.created_at))}
                {sel.confianza !== null && ` · confianza ${Math.round(sel.confianza * 100)}%`}
                {sel.modelo_usado && ` · ${sel.modelo_usado}`}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
