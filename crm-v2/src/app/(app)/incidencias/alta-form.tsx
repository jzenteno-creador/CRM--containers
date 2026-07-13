"use client";

// Alta de incidencia (M7 §6.3.9): avería u otro evento sobre una operación abierta,
// con fotos al bucket PRIVADO crm-incidencias. Orden de submit OBLIGADO por la policy
// de Storage (el INSERT/SELECT de storage.objects exige que exista la fila de
// crm.incidencias cuyo id es la carpeta del path):
//   1. INSERT crm.incidencias → id            (usuario_id = perfil.usuario_id explícito)
//   2. upload a `{incidencia_id}/{uuid}.{ext}` (secuencial, estado por foto)
//   3. INSERT crm.incidencia_fotos por cada upload OK
// Fotos que fallan NO revierten la incidencia (el evento del timeline ya existe —
// decisión plan M7): quedan en estado error + FormAlert warning, y el form pasa a
// modo reintento sobre el MISMO id (imposible duplicar la incidencia).
// CERO cálculo de negocio; descripción REQUERIDA en UI aunque la columna sea nullable
// (decisión plan M7 por calidad de dato). Timezone AR fija (-03:00).

import { useEffect, useRef, useState } from "react";
import { ContainerNumber } from "@/components/container-number";
import { Button } from "@/components/fd/button";
import { DateField, Field, Input, Select, Textarea } from "@/components/fd/fields";
import { FieldHelp } from "@/components/fd/field-help";
import { FormAlert } from "@/components/fd/form-alert";
import { PhotoUpload, type PhotoItem } from "@/components/fd/photo-upload";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { useToast } from "@/components/fd/toast";
import { hoyAR } from "@/lib/format";
import { normalizarNumero } from "@/lib/iso6346";
import { getSupabase } from "@/lib/supabase";
import type { Perfil } from "@/lib/session";
import { EstadoOperacionBadge } from "../contenedores/estado-operacion";
import { BUCKET_INCIDENCIAS, TIPO_INCIDENCIA_OPTIONS } from "./shared";

// límite client-side por foto (el bucket no tiene file_size_limit — no confiar en eso)
const MAX_PHOTO_MB = 8;
const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024;
const MAX_FOTOS = 6;

// solo operaciones ABIERTAS admiten incidencias (mismo catálogo que la planilla M5)
const ESTADOS_ABIERTOS = ["en_transito_a_planta", "en_planta", "en_transito_a_terminal"];

export type OperacionResult = {
  id: string;
  estado: string;
  contenedor: { id: string; numero_contenedor: string } | null;
  planta_actual: { nombre: string } | null;
};

/** PhotoItem del design system + el File original para poder subirlo/reintentar. */
type FormPhoto = PhotoItem & { file: File };

const CARD: React.CSSProperties = {
  background: "var(--color-surface-1)",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: "var(--radius-input)",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

/** Extensión segura para el path de Storage: del nombre del archivo, o del MIME. */
function fileExt(f: File): string {
  const fromName = f.name.includes(".") ? (f.name.split(".").pop() ?? "") : "";
  const clean = fromName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  if (clean) return `.${clean}`;
  const fromMime = (f.type.split("/")[1] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  return fromMime ? `.${fromMime}` : "";
}

export function AltaIncidenciaForm({ perfil, onCreated }: { perfil: Perfil; onCreated: () => void }) {
  const toast = useToast();

  /* ---------- selector de operación: búsqueda por contenedor ---------- */
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<OperacionResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  // contador de reintentos: re-dispara el efecto de búsqueda con el mismo término
  const [searchRetry, setSearchRetry] = useState(0);
  const [selectedOp, setSelectedOp] = useState<OperacionResult | null>(null);
  const reqIdRef = useRef(0);

  // debounce 300ms (mismo patrón que la planilla /contenedores)
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  // saneo de sintaxis PostgREST (no es lógica de negocio) + mínimo 2 caracteres
  const sane = search.trim().replace(/[,()"'\\*]/g, "");
  const searchActive = selectedOp === null && sane.length >= 2;

  useEffect(() => {
    // sin término no hay request; el reset de results/searchError vive en los
    // handlers (onChange/selección) — cero setState síncrono en el efecto.
    if (!searchActive) return;
    const rid = ++reqIdRef.current;
    void (async () => {
      const { data, error } = await getSupabase()
        .from("operaciones")
        .select("id, estado, contenedor:contenedores!inner(id, numero_contenedor), planta_actual:plantas(nombre)")
        .in("estado", ESTADOS_ABIERTOS)
        .ilike("contenedor.numero_contenedor", `%${normalizarNumero(sane)}%`)
        .order("fecha_retiro", { ascending: false })
        .limit(20);
      if (rid !== reqIdRef.current) return; // llegó tarde: hay otra búsqueda en vuelo
      if (error) {
        setResults(null);
        setSearchError(error.message);
        return;
      }
      setSearchError(null);
      setResults(data as unknown as OperacionResult[]);
    })();
  }, [searchActive, sane, searchRetry]);

  const searchLoading = searchActive && results === null && searchError === null;

  /* ---------- campos ---------- */
  const [tipo, setTipo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(hoyAR());

  /* ---------- fotos (estado controlado — el padre es dueño, PhotoUpload pinta) ---------- */
  const [photos, setPhotos] = useState<FormPhoto[]>([]);
  const [addWarning, setAddWarning] = useState<string | null>(null);

  /* ---------- envío ---------- */
  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // id de la incidencia ya insertada: activa el modo reintento de fotos (los campos se
  // bloquean — ya están persistidos — y el submit NO vuelve a insertar la fila).
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  const retryMode = createdId !== null;

  const onAddPhotos = (files: File[]) => {
    const rejected: string[] = [];
    const accepted: FormPhoto[] = [];
    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        rejected.push(`${f.name} (no es una imagen)`);
        continue;
      }
      if (f.size > MAX_PHOTO_BYTES) {
        rejected.push(`${f.name} (supera los ${MAX_PHOTO_MB} MB)`);
        continue;
      }
      accepted.push({
        id: crypto.randomUUID(),
        url: URL.createObjectURL(f),
        name: f.name,
        status: "pendiente",
        file: f,
      });
    }
    // respetar el máximo revocando los object URLs que no entran (sin fugas)
    const space = Math.max(0, MAX_FOTOS - photos.length);
    const toAdd = accepted.slice(0, space);
    accepted.slice(space).forEach((x) => URL.revokeObjectURL(x.url));
    if (toAdd.length > 0) setPhotos((p) => [...p, ...toAdd]);
    setAddWarning(
      rejected.length > 0
        ? `No se agregaron: ${rejected.join(", ")}. Solo imágenes de hasta ${MAX_PHOTO_MB} MB.`
        : null,
    );
  };

  const onRemovePhoto = (id: string) => {
    setPhotos((p) => {
      const target = p.find((x) => x.id === id);
      if (target?.url.startsWith("blob:")) URL.revokeObjectURL(target.url);
      return p.filter((x) => x.id !== id);
    });
  };

  const resetForm = () => {
    photos.forEach((p) => {
      if (p.url.startsWith("blob:")) URL.revokeObjectURL(p.url);
    });
    setPhotos([]);
    setSelectedOp(null);
    setSearchInput("");
    setResults(null);
    setSearchError(null);
    setTipo("");
    setDescripcion("");
    setFecha(hoyAR());
    setAttempted(false);
    setSubmitError(null);
    setCreatedId(null);
    setUploadWarning(null);
    setAddWarning(null);
  };

  const fieldErrors = {
    operacion: selectedOp === null ? "buscá el contenedor y elegí su operación" : null,
    tipo: tipo === "" ? "elegí el tipo de incidencia" : null,
    descripcion: descripcion.trim() === "" ? "describí qué pasó — es obligatorio" : null,
    fecha: fecha === "" ? "indicá la fecha de la incidencia" : null,
  };
  const formValid = Object.values(fieldErrors).every((e) => e === null);

  const submit = async () => {
    if (sending) return;
    setAttempted(true);
    setSubmitError(null);
    if (!retryMode && !formValid) return;
    setSending(true);

    // 1) la fila de incidencias PRIMERO: la policy de Storage exige que exista antes
    //    del upload (el path es `{incidencia_id}/…`). En reintento ya existe.
    let incidenciaId = createdId;
    if (incidenciaId === null) {
      const { data, error } = await getSupabase()
        .from("incidencias")
        .insert({
          operacion_id: selectedOp!.id,
          tipo,
          descripcion: descripcion.trim(),
          fecha: `${fecha}T00:00:00-03:00`,
          // atribución explícita — no depender del coalesce del trigger (plan M7)
          usuario_id: perfil.usuario_id,
        })
        .select("id")
        .single();
      if (error) {
        setSending(false);
        setSubmitError(error.message);
        return;
      }
      incidenciaId = (data as { id: string }).id;
      setCreatedId(incidenciaId);
    }

    // 2+3) fotos secuenciales: upload al path `{incidencia_id}/{uuid}.{ext}` y, si
    //      subió, la fila de incidencia_fotos. Error en una NO frena a las demás.
    const pendientes = photos.filter((p) => p.status !== "ok");
    let okCount = photos.length - pendientes.length;
    const failed: string[] = [];
    for (const p of pendientes) {
      setPhotos((list) => list.map((x) => (x.id === p.id ? { ...x, status: "subiendo", error: undefined } : x)));
      const path = `${incidenciaId}/${crypto.randomUUID()}${fileExt(p.file)}`;
      const up = await getSupabase()
        .storage.from(BUCKET_INCIDENCIAS)
        .upload(path, p.file, { contentType: p.file.type || undefined, upsert: false });
      if (up.error) {
        const msg = up.error.message;
        failed.push(p.name);
        setPhotos((list) => list.map((x) => (x.id === p.id ? { ...x, status: "error", error: msg } : x)));
        continue;
      }
      const ins = await getSupabase()
        .from("incidencia_fotos")
        .insert({ incidencia_id: incidenciaId, storage_path: path });
      if (ins.error) {
        const msg = ins.error.message;
        failed.push(p.name);
        setPhotos((list) => list.map((x) => (x.id === p.id ? { ...x, status: "error", error: msg } : x)));
        continue;
      }
      okCount += 1;
      setPhotos((list) => list.map((x) => (x.id === p.id ? { ...x, status: "ok", progress: 100 } : x)));
    }
    setSending(false);

    // la incidencia ya existe pase lo que pase con las fotos → el historial se refresca
    onCreated();

    if (failed.length > 0) {
      setUploadWarning(
        `La incidencia quedó registrada, pero ${
          failed.length === 1 ? "esta foto no se pudo subir" : "estas fotos no se pudieron subir"
        }: ${failed.join(", ")}. Reintentá la subida, o quitalas y terminá sin ellas.`,
      );
      return;
    }
    toast({
      type: "exito",
      title: "Incidencia registrada",
      detail:
        okCount > 0
          ? `Con ${okCount} foto${okCount === 1 ? "" : "s"} adjunta${okCount === 1 ? "" : "s"}. Quedó en el historial y en la ficha del contenedor.`
          : "Quedó en el historial y en la ficha del contenedor.",
    });
    resetForm();
  };

  return (
    <div style={CARD}>
      {/* ---- operación (búsqueda por contenedor) ---- */}
      {selectedOp === null ? (
        <>
          <Field
            label="contenedor de la incidencia"
            htmlFor="inc-search"
            hint="buscá por número entre las operaciones abiertas — mínimo 2 caracteres"
            error={attempted ? fieldErrors.operacion : null}
          >
            <Input
              id="inc-search"
              value={searchInput}
              error={attempted ? fieldErrors.operacion : null}
              placeholder="MSKU1234565…"
              onChange={(e) => {
                setSearchInput(e.target.value);
                // resetear acá (handler) y no en el efecto: el término nuevo arranca
                // en estado de carga, sin resultados viejos ni error previo colgado
                setResults(null);
                setSearchError(null);
              }}
            />
          </Field>

          {/* resultados: 4 estados (carga skeleton / error + retry / vacío / poblado) */}
          {searchActive && (
            <div
              role="listbox"
              aria-label="operaciones encontradas"
              style={{
                display: "flex",
                flexDirection: "column",
                maxHeight: 240,
                overflowY: "auto",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "var(--radius-input)",
                background: "var(--color-surface-2)",
              }}
            >
              {searchLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10 }} aria-busy="true">
                  <SkeletonBlock height={22} />
                  <SkeletonBlock height={22} delay={150} />
                  <SkeletonBlock height={22} delay={300} />
                </div>
              ) : searchError ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                  <span style={{ fontSize: 12, color: "var(--color-status-red)", flex: 1 }}>
                    No se pudo buscar: {searchError}
                  </span>
                  <Button
                    variant="ghost"
                    icon="ti-refresh"
                    onClick={() => {
                      setResults(null);
                      setSearchError(null);
                      setSearchRetry((r) => r + 1);
                    }}
                    style={{ minHeight: 0, padding: "4px 10px", fontSize: 12 }}
                  >
                    Reintentar
                  </Button>
                </div>
              ) : (results ?? []).length === 0 ? (
                <p style={{ margin: 0, padding: "12px 14px", fontSize: 12, color: "var(--color-text-muted)" }}>
                  Sin operaciones abiertas para «{sane}» — la incidencia se registra sobre un ciclo en circulación
                  (retirado y sin devolver). Revisá el número en la solapa <strong>Contenedores</strong>.
                </p>
              ) : (
                (results ?? []).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      setSelectedOp(r);
                      setSearchInput("");
                      setResults(null);
                      setSearchError(null);
                    }}
                    className="hover:[background:var(--color-surface-1)!important]"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 10,
                      minHeight: 40,
                      padding: "8px 12px",
                      border: "none",
                      borderBottom: "1px solid var(--color-border-subtle)",
                      background: "transparent",
                      textAlign: "left",
                      fontSize: 12.5,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {r.contenedor ? <ContainerNumber value={r.contenedor.numero_contenedor} /> : "—"}
                    <EstadoOperacionBadge estado={r.estado} />
                    <span style={{ color: "var(--color-text-muted)" }}>{r.planta_actual?.nombre ?? "sin planta"}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      ) : (
        <Field label="contenedor de la incidencia">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              minHeight: 34,
              padding: "6px 12px",
              borderRadius: "var(--radius-input)",
              background: "var(--color-accent-tint)",
              border: "1px solid var(--color-accent-line)",
            }}
          >
            {selectedOp.contenedor ? <ContainerNumber value={selectedOp.contenedor.numero_contenedor} /> : "—"}
            <EstadoOperacionBadge estado={selectedOp.estado} />
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {selectedOp.planta_actual?.nombre ?? "sin planta"}
            </span>
            {!retryMode && (
              <Button
                variant="ghost"
                icon="ti-arrows-exchange"
                onClick={() => setSelectedOp(null)}
                disabled={sending}
                style={{ minHeight: 0, padding: "3px 8px", fontSize: 11.5, marginLeft: "auto" }}
              >
                Cambiar
              </Button>
            )}
          </div>
        </Field>
      )}

      {/* ---- tipo + fecha ---- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        <Field label="tipo de incidencia" htmlFor="inc-tipo" error={attempted ? fieldErrors.tipo : null}>
          <Select
            id="inc-tipo"
            value={tipo}
            error={attempted ? fieldErrors.tipo : null}
            disabled={retryMode || sending}
            onChange={(e) => setTipo(e.target.value)}
          >
            <option value="">— elegí el tipo —</option>
            {TIPO_INCIDENCIA_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="fecha de la incidencia"
          htmlFor="inc-fecha"
          error={attempted ? fieldErrors.fecha : null}
          help={<FieldHelp fieldKey="incidencias.fecha" />}
        >
          <DateField
            id="inc-fecha"
            value={fecha}
            error={attempted ? fieldErrors.fecha : null}
            disabled={retryMode || sending}
            onChange={(e) => setFecha(e.target.value)}
          />
        </Field>
      </div>

      {/* ---- descripción (REQUERIDA en UI — decisión plan M7) ---- */}
      <Field
        label="descripción"
        htmlFor="inc-descripcion"
        hint="qué pasó, dónde está el daño, y todo dato útil para el reclamo"
        error={attempted ? fieldErrors.descripcion : null}
      >
        <Textarea
          id="inc-descripcion"
          rows={3}
          value={descripcion}
          error={attempted ? fieldErrors.descripcion : null}
          disabled={retryMode || sending}
          placeholder="ej: abolladura en el lateral derecho al descargar en planta"
          onChange={(e) => setDescripcion(e.target.value)}
          style={{ resize: "vertical" }}
        />
      </Field>

      {/* ---- fotos ---- */}
      <Field label={`fotos (opcional, hasta ${MAX_FOTOS})`} hint={`solo imágenes, máx. ${MAX_PHOTO_MB} MB cada una`}>
        <PhotoUpload items={photos} onAdd={onAddPhotos} onRemove={onRemovePhoto} max={MAX_FOTOS} disabled={sending} />
      </Field>

      {/* ---- avisos + envío ---- */}
      {addWarning && <FormAlert tone="warning">{addWarning}</FormAlert>}
      {uploadWarning && <FormAlert tone="warning">{uploadWarning}</FormAlert>}
      {submitError && <FormAlert>{submitError}</FormAlert>}

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
        {retryMode && (
          <Button variant="ghost" icon="ti-eraser" disabled={sending} onClick={resetForm}>
            Descartar fotos y limpiar
          </Button>
        )}
        <Button
          variant="primary"
          icon={retryMode ? "ti-refresh" : "ti-alert-triangle"}
          loading={sending}
          onClick={() => void submit()}
        >
          {retryMode ? "Reintentar fotos" : "Registrar incidencia"}
        </Button>
      </div>
    </div>
  );
}
