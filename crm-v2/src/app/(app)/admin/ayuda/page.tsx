"use client";

// Admin → Ayuda (M4 B3-B): editor del contenido de ayuda sin tocar código. Lista los
// items de crm.ayuda_contenido (secciones Y campos, publicados o no — el RLS ayuda_select
// deja ver todo a un usuario activo; el filtro `publicado` es de aplicación), permite
// editar titulo/contenido_md/orden, alta de item nuevo, y despublicar (no hay DELETE:
// publicado=false). Escritura directa sancionada por las policies ayuda_insert_admin /
// ayuda_update_admin (contenido, sin impacto en costo — análogo a `configuracion`).
// Vista previa lado a lado: se interpola con crm_ayuda_valores(null) — valores de ejemplo
// sin naviera; los {{...}} se completan solos en la app. Guard admin (patrón §14.7):
// skeleton + redirect; RLS es la compuerta real.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/fd/button";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { Field, Input, Select, Textarea, Toggle } from "@/components/fd/fields";
import { FormAlert } from "@/components/fd/form-alert";
import { Markdown } from "@/components/fd/markdown";
import { Modal } from "@/components/fd/modal";
import { PageHeader } from "@/components/fd/page-header";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { useToast } from "@/components/fd/toast";
import { interpolarAyuda, type AyudaValores } from "@/lib/ayuda";
import { useSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";

type Nivel = "seccion" | "campo";

type AyudaRow = {
  id: string;
  seccion: string;
  nivel: Nivel;
  clave: string | null;
  titulo: string;
  contenido_md: string;
  orden: number;
  publicado: boolean;
};

// CHECK de crm.ayuda_contenido.seccion (migración 002) — el alta solo puede usar estos.
// ⚠️ 'bookings' (M5 B3) TODAVÍA NO está en ese CHECK — el ALTER que lo agrega vive en
// supabase/seeds-ayuda/m5b3_bookings.sql (precondición documentada ahí mismo). Hasta que
// se aplique, elegir "Bookings" acá y guardar falla con un error de constraint de Postgres
// (no crashea, pero no guarda) — se deja igual el valor en la lista para no bloquear el
// editor una vez que la migración esté puesta.
const SECCIONES: { value: string; label: string }[] = [
  { value: "dashboard", label: "Inicio (dashboard)" },
  { value: "ingreso", label: "Ingreso" },
  { value: "egreso", label: "Egreso" },
  { value: "bookings", label: "Bookings" },
  { value: "contenedores", label: "Contenedores" },
  { value: "alertas", label: "Alertas" },
  { value: "incidencias", label: "Incidencias" },
  { value: "admin", label: "Admin" },
  { value: "faq", label: "FAQ" },
];
const SECCION_ORDER = SECCIONES.map((s) => s.value);
function seccionLabel(v: string): string {
  return SECCIONES.find((s) => s.value === v)?.label ?? v;
}

// Placeholders disponibles (crm_ayuda_valores) — se los mostramos al admin como ayuda.
const PLACEHOLDERS = ["{{umbral}}", "{{retiro_frase}}", "{{devolucion_frase}}", "{{dias_libres_frase}}", "{{tarifa_frase}}"];

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/* ═══════════════ editor (alta + edición) en modal con preview ═══════════════ */

function AyudaEditorModal({
  row,
  valores,
  onClose,
  onSaved,
}: {
  /** null = alta de item nuevo; objeto = edición. */
  row: AyudaRow | null;
  valores: AyudaValores | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = row !== null;

  const [nivel, setNivel] = useState<Nivel>(row?.nivel ?? "seccion");
  const [seccion, setSeccion] = useState(row?.seccion ?? "");
  const [clave, setClave] = useState(row?.clave ?? "");
  const [titulo, setTitulo] = useState(row?.titulo ?? "");
  const [orden, setOrden] = useState(String(row?.orden ?? 0));
  const [contenido, setContenido] = useState(row?.contenido_md ?? "");
  const [publicado, setPublicado] = useState(row?.publicado ?? true);

  const [attempted, setAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const ordenNum = Number(orden);
  const ordenValid = orden.trim() !== "" && Number.isInteger(ordenNum) && ordenNum >= 0;
  const claveRequerida = nivel === "campo";
  const errors = {
    seccion: seccion === "" ? "elegí la sección" : null,
    clave: claveRequerida && clave.trim() === "" ? "la clave es obligatoria para un campo" : null,
    titulo: titulo.trim() === "" ? "el título es obligatorio" : null,
    contenido: contenido.trim() === "" ? "el contenido no puede estar vacío" : null,
    orden: !ordenValid ? "orden inválido (entero ≥ 0)" : null,
  };
  const valid = !errors.seccion && !errors.clave && !errors.titulo && !errors.contenido && !errors.orden;

  const preview = useMemo(() => interpolarAyuda(contenido, valores), [contenido, valores]);

  const save = async () => {
    setAttempted(true);
    if (!valid || sending) return;
    setSending(true);
    setSubmitError(null);
    const supabase = getSupabase();

    if (isEdit && row) {
      // edición: solo titulo/contenido/orden/publicado (nivel/seccion/clave inmutables)
      const { data, error } = await supabase
        .from("ayuda_contenido")
        .update({ titulo: titulo.trim(), contenido_md: contenido, orden: ordenNum, publicado })
        .eq("id", row.id)
        .select("id");
      setSending(false);
      if (error) {
        setSubmitError(error.message);
        return;
      }
      if ((data?.length ?? 0) === 0) {
        setSubmitError("La base no aceptó el cambio — verificá que tu cuenta siga siendo administrador activo.");
        return;
      }
      toast({ type: "exito", title: "Contenido actualizado", detail: titulo.trim() });
      onSaved();
      return;
    }

    // alta
    const payload = {
      nivel,
      seccion,
      clave: nivel === "campo" ? clave.trim() : null,
      titulo: titulo.trim(),
      contenido_md: contenido,
      orden: ordenNum,
      publicado,
    };
    const { data, error } = await supabase.from("ayuda_contenido").insert(payload).select("id");
    setSending(false);
    if (error) {
      // clave duplicada (ux_ayuda_clave) u otra restricción → mensaje literal
      setSubmitError(error.message);
      return;
    }
    if ((data?.length ?? 0) === 0) {
      setSubmitError("La base no aceptó el alta — verificá que tu cuenta siga siendo administrador activo.");
      return;
    }
    toast({ type: "exito", title: "Contenido creado", detail: titulo.trim() });
    onSaved();
  };

  return (
    <Modal
      open
      onClose={sending ? () => {} : onClose}
      title={isEdit ? "Editar contenido de ayuda" : "Nuevo contenido de ayuda"}
      width={900}
      closeOnBackdrop={!sending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button variant="primary" icon="ti-device-floppy" loading={sending} disabled={!valid} onClick={() => void save()}>
            {isEdit ? "Guardar cambios" : "Crear contenido"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* metadatos */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <Field label="nivel">
            {isEdit ? (
              <div className="mono" style={metaBoxStyle}>
                {nivel === "campo" ? "campo (tooltip)" : "sección (instructivo)"}
              </div>
            ) : (
              <Select value={nivel} onChange={(e) => setNivel(e.target.value as Nivel)}>
                <option value="seccion">sección (instructivo de solapa)</option>
                <option value="campo">campo (tooltip de un input)</option>
              </Select>
            )}
          </Field>

          <Field label="sección" error={attempted ? errors.seccion : null}>
            {isEdit ? (
              <div className="mono" style={metaBoxStyle}>
                {seccionLabel(seccion)}
              </div>
            ) : (
              <Select value={seccion} error={attempted ? errors.seccion : null} onChange={(e) => setSeccion(e.target.value)}>
                <option value="">— elegí la sección —</option>
                {SECCIONES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="orden"
            error={attempted ? errors.orden : null}
            hint="posición dentro de la sección"
          >
            <Input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="mono"
              value={orden}
              error={attempted ? errors.orden : null}
              onChange={(e) => setOrden(e.target.value)}
            />
          </Field>
        </div>

        {claveRequerida && (
          <Field
            label="clave del campo"
            error={attempted ? errors.clave : null}
            hint="identificador técnico, ej. ingreso.fecha_retiro — debe coincidir con el fieldKey del input"
          >
            {isEdit ? (
              <div className="mono" style={metaBoxStyle}>
                {clave || "—"}
              </div>
            ) : (
              <Input
                className="mono"
                value={clave}
                error={attempted ? errors.clave : null}
                placeholder="seccion.campo"
                onChange={(e) => setClave(e.target.value)}
              />
            )}
          </Field>
        )}

        <Field label="título" error={attempted ? errors.titulo : null}>
          <Input value={titulo} error={attempted ? errors.titulo : null} onChange={(e) => setTitulo(e.target.value)} />
        </Field>

        {/* contenido + preview lado a lado */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <Field label="contenido (Markdown)" error={attempted ? errors.contenido : null}>
            <Textarea
              rows={12}
              value={contenido}
              error={attempted ? errors.contenido : null}
              onChange={(e) => setContenido(e.target.value)}
              style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.55, resize: "vertical" }}
            />
          </Field>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span className="fd-label">vista previa</span>
            <div
              style={{
                border: "1px solid var(--color-border-strong)",
                borderRadius: "var(--radius-input)",
                background: "var(--color-surface-2)",
                padding: "12px 14px",
                minHeight: 120,
                overflow: "auto",
              }}
            >
              {contenido.trim() ? (
                <Markdown source={preview} />
              ) : (
                <span style={{ fontSize: 12, color: "var(--color-text-faint)" }}>La vista previa aparece acá.</span>
              )}
            </div>
          </div>
        </div>

        {/* ayuda de placeholders */}
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--color-text-faint)", lineHeight: 1.55 }}>
          Los números (días libres, tarifa, umbral) <strong>no se escriben a mano</strong>: insertá una marca y el
          sistema la completa sola con el valor real de la naviera en contexto. Marcas disponibles:{" "}
          {PLACEHOLDERS.map((p, i) => (
            <span key={p}>
              {i > 0 && ", "}
              <code className="mono" style={{ fontSize: 11 }}>
                {p}
              </code>
            </span>
          ))}
          . La vista previa usa <strong>valores de ejemplo sin naviera</strong> (umbral real; días/tarifa en su frase
          genérica).
        </p>

        <Toggle checked={publicado} onChange={setPublicado} label={publicado ? "publicado (visible)" : "sin publicar (oculto)"} />

        {submitError && <FormAlert>{submitError}</FormAlert>}
      </div>
    </Modal>
  );
}

const metaBoxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  minHeight: 34,
  padding: "0 12px",
  borderRadius: "var(--radius-input)",
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-border-strong)",
  color: "var(--color-text-primary)",
  fontSize: 12.5,
};

/* ═══════════════════════════════ fila de item ═══════════════════════════════ */

function ItemRow({
  row,
  busy,
  onEdit,
  onTogglePublicado,
}: {
  row: AyudaRow;
  busy: boolean;
  onEdit: () => void;
  onTogglePublicado: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderTop: "1px solid var(--color-border-subtle)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-text-primary)" }}>{row.titulo}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "1px 6px",
              borderRadius: 4,
              background: row.nivel === "campo" ? "var(--color-accent-tint)" : "var(--color-surface-2)",
              border: `1px solid ${row.nivel === "campo" ? "var(--color-accent-line)" : "var(--color-border-strong)"}`,
              color: row.nivel === "campo" ? "var(--color-accent-500)" : "var(--color-text-muted)",
            }}
          >
            {row.nivel === "campo" ? "campo" : "sección"}
          </span>
          {row.clave && (
            <span className="mono" style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {row.clave}
            </span>
          )}
          <span className="mono" style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
            orden {row.orden}
          </span>
          {!row.publicado && (
            <span style={{ fontSize: 11, color: "var(--color-status-amber)" }}>
              <i className="ti ti-eye-off" aria-hidden /> sin publicar
            </span>
          )}
        </div>
      </div>
      <Toggle checked={row.publicado} disabled={busy} onChange={onTogglePublicado} label="publicado" />
      <Button variant="ghost" icon="ti-pencil" onClick={onEdit} style={{ minHeight: 32 }}>
        Editar
      </Button>
    </div>
  );
}

/* ══════════════════════════════════ página ══════════════════════════════════ */

function EditorSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-hidden>
      {[0, 1, 2].map((i) => (
        <div className="fd-panel" key={i}>
          <div className="fd-panel-title">
            <SkeletonBlock width={160} height={13} delay={i * 120} />
          </div>
          <div className="fd-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SkeletonBlock width="80%" delay={i * 120 + 80} />
            <SkeletonBlock width="65%" delay={i * 120 + 160} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminAyudaPage() {
  const router = useRouter();
  const toast = useToast();
  const { perfil } = useSession();
  const isAdmin = perfil?.rol === "administrador";

  const [rows, setRows] = useState<AyudaRow[] | null>(null);
  const [valores, setValores] = useState<AyudaValores | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  // undefined = cerrado · null = alta · AyudaRow = edición
  const [editing, setEditing] = useState<AyudaRow | null | undefined>(undefined);

  useEffect(() => {
    if (perfil && !isAdmin) router.replace("/inicio");
  }, [perfil, isAdmin, router]);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    setLoadError(null);
    const [r, v] = await Promise.all([
      supabase
        .from("ayuda_contenido")
        .select("id, seccion, nivel, clave, titulo, contenido_md, orden, publicado")
        .order("orden", { ascending: true }),
      supabase.rpc("crm_ayuda_valores", {}),
    ]);
    if (r.error) {
      setRows(null);
      setLoadError(r.error.message);
      return;
    }
    setValores(v.error ? null : (v.data as AyudaValores | null));
    setRows((r.data as AyudaRow[]) ?? []);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      await load();
    })();
  }, [isAdmin, load]);

  const togglePublicado = async (row: AyudaRow) => {
    if (busyId) return;
    setBusyId(row.id);
    const next = !row.publicado;
    const { data, error } = await getSupabase()
      .from("ayuda_contenido")
      .update({ publicado: next })
      .eq("id", row.id)
      .select("id");
    setBusyId(null);
    if (error) {
      toast({ type: "error", title: "No se pudo cambiar la publicación", detail: error.message });
      return;
    }
    if ((data?.length ?? 0) === 0) {
      toast({ type: "error", title: "La base rechazó el cambio", detail: "Verificá que tu cuenta siga siendo administrador activo." });
      return;
    }
    toast({ type: "exito", title: next ? "Contenido publicado" : "Contenido despublicado", detail: row.titulo });
    void load();
  };

  // agrupado por sección (orden canónico), items por orden
  const grupos = useMemo(() => {
    if (!rows) return [];
    const nq = norm(query.trim());
    const filtered = nq
      ? rows.filter(
          (r) =>
            norm(r.titulo).includes(nq) ||
            norm(r.clave ?? "").includes(nq) ||
            norm(r.seccion).includes(nq) ||
            norm(r.contenido_md).includes(nq),
        )
      : rows;
    const bySeccion = new Map<string, AyudaRow[]>();
    for (const r of filtered) {
      const arr = bySeccion.get(r.seccion) ?? [];
      arr.push(r);
      bySeccion.set(r.seccion, arr);
    }
    const keys = [...bySeccion.keys()].sort((a, b) => {
      const ia = SECCION_ORDER.indexOf(a);
      const ib = SECCION_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return keys.map((k) => ({
      seccion: k,
      items: (bySeccion.get(k) ?? []).sort((a, b) => a.orden - b.orden),
    }));
  }, [rows, query]);

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Editor de ayuda" />
        <EditorSkeleton />
      </>
    );
  }

  const total = rows?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Editor de ayuda"
        counters={
          rows ? (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {total} {total === 1 ? "item" : "items"}
            </span>
          ) : undefined
        }
        action={
          <Button variant="primary" icon="ti-plus" onClick={() => setEditing(null)} disabled={rows === null}>
            Nuevo contenido
          </Button>
        }
      />

      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.55 }}>
        Editás el instructivo de cada solapa y los tooltips de los campos. Los <code className="mono">{"{{...}}"}</code>{" "}
        se completan solos con los valores reales — no escribas números a mano. No hay borrado: para ocultar un
        contenido, despublicalo.
      </p>

      <div style={{ position: "relative", maxWidth: 380, marginBottom: 14 }}>
        <i
          className="ti ti-search"
          aria-hidden
          style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-faint)", fontSize: 15, pointerEvents: "none" }}
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título, clave o sección…"
          aria-label="buscar contenido de ayuda"
          style={{ paddingLeft: 34, width: "100%" }}
        />
      </div>

      {loadError ? (
        <div className="fd-panel">
          <ErrorState title="No se pudo cargar el contenido de ayuda" detail={loadError} onRetry={() => void load()} />
        </div>
      ) : rows === null ? (
        <EditorSkeleton />
      ) : grupos.length === 0 ? (
        <div className="fd-panel">
          <EmptyState icon={query ? "ti-search-off" : "ti-file-off"} title={query ? "Sin resultados" : "Todavía no hay contenido"}>
            {query ? (
              <>No hay items que coincidan con <strong>{query.trim()}</strong>.</>
            ) : (
              <>Creá el primer contenido con <strong>Nuevo contenido</strong>. El seed de backend (024) ya trae las secciones y tooltips base.</>
            )}
          </EmptyState>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {grupos.map((g) => (
            <div className="fd-panel" key={g.seccion}>
              <div className="fd-panel-title">
                <i className="ti ti-book-2" aria-hidden style={{ color: "var(--color-accent-500)" }} />
                <span>{seccionLabel(g.seccion)}</span>
                <span className="fd-count">{g.items.length}</span>
              </div>
              <div className="fd-panel-body" style={{ paddingTop: 0 }}>
                {g.items.map((row) => (
                  <ItemRow
                    key={row.id}
                    row={row}
                    busy={busyId === row.id}
                    onEdit={() => setEditing(row)}
                    onTogglePublicado={() => void togglePublicado(row)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <AyudaEditorModal
          row={editing}
          valores={valores}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            void load();
          }}
        />
      )}
    </>
  );
}
