"use client";

// Admin → Configuración (M9): umbral del semáforo amarillo de freetime.
// configuracion es clave/valor jsonb (SELECT todos los activos — la leyenda de M6
// la lee; INSERT/UPDATE solo admin por RLS). El guardado hace UPDATE directo:
// valor = {"dias": N} + updated_by = perfil.usuario_id, WHERE clave =
// 'umbral_alerta_amarillo'. Validación client-side 1..30; el impacto es inmediato:
// el semáforo de TODOS los listados/alertas se recalcula con el valor nuevo.
// La atribución (última modificación por quién) sale de usuarios_publicos (§14).
// Guard admin (patrón solicitudes §14.7): skeleton + redirect; RLS es la compuerta real.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/fd/button";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { Field, Input } from "@/components/fd/fields";
import { FieldHelp } from "@/components/fd/field-help";
import { FormAlert } from "@/components/fd/form-alert";
import { PageHeader } from "@/components/fd/page-header";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { useToast } from "@/components/fd/toast";
import { fmtFechaHora } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

const CLAVE_UMBRAL = "umbral_alerta_amarillo";

type UmbralConfig = {
  dias: number | null;
  updated_by: string | null;
  updated_at: string;
};

function parseDias(valor: unknown): number | null {
  const dias = (valor as { dias?: unknown } | null)?.dias;
  return typeof dias === "number" && Number.isFinite(dias) ? dias : null;
}

function ConfigSkeleton() {
  return (
    <div className="fd-panel" aria-hidden>
      <div className="fd-panel-title">
        <SkeletonBlock width={220} height={13} />
      </div>
      <div className="fd-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SkeletonBlock width="70%" delay={150} />
        <SkeletonBlock width={140} height={34} delay={300} />
        <SkeletonBlock width={260} height={11} delay={450} />
      </div>
    </div>
  );
}

export default function ConfiguracionPage() {
  const router = useRouter();
  const toast = useToast();
  const { perfil } = useSession();

  // undefined = cargando · null = la clave no existe · objeto = poblado
  const [config, setConfig] = useState<UmbralConfig | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autores, setAutores] = useState<Map<string, string>>(new Map());

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isAdmin = perfil?.rol === "administrador";

  useEffect(() => {
    if (perfil && !isAdmin) router.replace("/inicio");
  }, [perfil, isAdmin, router]);

  // setState siempre después del await (regla set-state-in-effect)
  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [c, u] = await Promise.all([
      supabase
        .from("configuracion")
        .select("valor, updated_by, updated_at")
        .eq("clave", CLAVE_UMBRAL)
        .maybeSingle(),
      supabase.from("usuarios_publicos").select("id, nombre"),
    ]);
    if (c.error) {
      setConfig(undefined);
      setLoadError(c.error.message);
      return;
    }
    setLoadError(null);
    // autores best-effort: si la view falla, la atribución muestra "—" sin romper la página
    setAutores(
      u.error ? new Map() : new Map((u.data as { id: string; nombre: string }[]).map((x) => [x.id, x.nombre])),
    );
    if (!c.data) {
      setConfig(null);
      return;
    }
    const dias = parseDias(c.data.valor);
    setConfig({ dias, updated_by: c.data.updated_by, updated_at: c.data.updated_at });
    setInput(dias != null ? String(dias) : "");
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      await load();
    })();
  }, [isAdmin, load]);

  // refetch al recuperar foco (mismo criterio que solicitudes)
  useEffect(() => {
    if (!isAdmin) return;
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isAdmin, load]);

  const n = Number(input);
  const inputValid = input.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= 30;
  // validación EN VIVO (catálogo §6.3): el error aparece apenas el valor sale de rango
  const inputError = input.trim() !== "" && !inputValid ? "tiene que ser un entero entre 1 y 30" : null;
  const dirty = config != null && inputValid && n !== config.dias;

  const save = async () => {
    if (!inputValid || !dirty || sending || !perfil) return;
    setSending(true);
    setSubmitError(null);
    const { data, error } = await getSupabase()
      .from("configuracion")
      .update({ valor: { dias: n }, updated_by: perfil.usuario_id })
      .eq("clave", CLAVE_UMBRAL)
      .select("clave");
    setSending(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    if ((data?.length ?? 0) === 0) {
      // UPDATE que no devolvió fila: RLS lo filtró en silencio (cuenta sin permisos)
      setSubmitError("La base de datos no aceptó el cambio — verificá que tu cuenta siga siendo administrador activo.");
      return;
    }
    toast({
      type: "exito",
      title: `Umbral amarillo: ${n} día${n === 1 ? "" : "s"}`,
      detail: "El semáforo de todos los listados y alertas usa el valor nuevo al instante.",
    });
    void load();
  };

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Configuración" />
        <ConfigSkeleton />
      </>
    );
  }

  const autor = config?.updated_by ? (autores.get(config.updated_by) ?? "—") : null;

  return (
    <>
      <PageHeader title="Configuración" />

      {loadError ? (
        <div className="fd-panel">
          <ErrorState title="No se pudo cargar la configuración" detail={loadError} onRetry={() => void load()} />
        </div>
      ) : config === undefined ? (
        <ConfigSkeleton />
      ) : config === null ? (
        <div className="fd-panel">
          <EmptyState icon="ti-settings" title="Falta la clave de configuración">
            La clave <span className="mono">{CLAVE_UMBRAL}</span> no existe en la tabla de configuración. Se crea con
            el seed de backend — pedila a administración del sistema; mientras falte, el semáforo usa su valor por
            defecto.
          </EmptyState>
        </div>
      ) : (
        <div className="fd-panel">
          <div className="fd-panel-title">
            <i className="ti ti-traffic-lights" aria-hidden style={{ color: "var(--color-status-amber)" }} />
            <span>umbral del semáforo amarillo</span>
          </div>
          <div className="fd-panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
              Un contenedor pasa a <strong style={{ color: "var(--color-status-amber)" }}>amarillo</strong> cuando le
              quedan estos días de freetime o menos (y a rojo cuando se le acaban). Aplica a todos los listados,
              alertas y notificaciones del sistema.
            </p>

            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="mono" style={{ fontSize: 26, fontWeight: 600, color: "var(--color-text-primary)" }}>
                {config.dias ?? "—"}
              </span>
              <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
                día{config.dias === 1 ? "" : "s"} restantes — valor actual
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <Field
                label="nuevo umbral (días)"
                htmlFor="config-umbral"
                error={inputError}
                hint="entero entre 1 y 30"
                help={<FieldHelp fieldKey="admin.config.umbral" />}
              >
                <Input
                  id="config-umbral"
                  type="number"
                  min={1}
                  max={30}
                  step={1}
                  inputMode="numeric"
                  className="mono"
                  style={{ width: 130 }}
                  value={input}
                  error={inputError}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setSubmitError(null);
                  }}
                />
              </Field>
              <Button
                variant="primary"
                icon="ti-device-floppy"
                loading={sending}
                disabled={!dirty}
                onClick={() => void save()}
              >
                Guardar
              </Button>
            </div>

            {submitError && <FormAlert>{submitError}</FormAlert>}

            <p style={{ margin: 0, fontSize: 11.5, color: "var(--color-text-faint)" }}>
              Última modificación: {fmtFechaHora(config.updated_at)}
              {autor !== null ? ` por ${autor}` : " (seed inicial)"}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
