"use client";

// Admin → Solicitudes de acceso (§12.3–§12.5, mini-panel M2; el Admin completo es M8).
// - Pendientes: aprobar (modal rol + planta, planta OBLIGATORIA si operador — §18.3)
//   vía RPC aprobar_usuario; rechazar (modal motivo obligatorio) vía rechazar_usuario.
// - Warning §12.4 si el dominio del email NO está en configuracion.dominios_sugeridos
//   (aviso, nunca bloqueo — el gate es la aprobación humana).
// - Resueltos: activos/rechazados/suspendidos con suspender/reactivar vía
//   set_estado_usuario (§12.5: pierde acceso al instante por RLS, sin borrar historial).
// Solo admin: el rol se lee del contexto de sesión (RPC perfil() — §14.7); RLS es
// la compuerta real de datos.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, type BadgeTone } from "@/components/fd/badge";
import { Button } from "@/components/fd/button";
import { DataTable, type Column, type RowValidation } from "@/components/fd/data-table";
import { EmptyState } from "@/components/fd/empty-state";
import { ErrorState } from "@/components/fd/error-state";
import { Field, Select, Textarea } from "@/components/fd/fields";
import { ConfirmDialog, Modal } from "@/components/fd/modal";
import { PageHeader } from "@/components/fd/page-header";
import { useToast } from "@/components/fd/toast";
import { fmtFechaHora } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { ROL_LABELS, useSession, type EstadoCuenta, type Rol } from "@/lib/session";

type UsuarioRow = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol | null;
  planta_asignada_id: string | null;
  estado_cuenta: EstadoCuenta;
  rechazo_motivo: string | null;
  created_at: string;
  fecha_aprobacion: string | null;
};

type Planta = { id: string; nombre: string; codigo: string | null };

const ESTADO_TONE: Record<EstadoCuenta, BadgeTone> = {
  pendiente_aprobacion: "amarillo",
  activo: "verde",
  rechazado: "rojo",
  suspendido: "amarillo",
};

const ESTADO_LABEL: Record<EstadoCuenta, string> = {
  pendiente_aprobacion: "pendiente",
  activo: "activo",
  rechazado: "rechazado",
  suspendido: "suspendido",
};

function emailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

function SectionTitle({ title, count }: { title: string; count: number | null }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "20px 0 10px" }}>
      <span className="fd-display fd-display-sm" style={{ color: "var(--color-text-secondary)" }}>
        {title}
      </span>
      {count != null && (
        <span className="mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          {count}
        </span>
      )}
    </div>
  );
}

/* ---------- modal de aprobación (§12.3): rol + planta con validación en vivo ---------- */

function AprobarModal({
  target,
  plantas,
  domainWarning,
  onClose,
  onDone,
}: {
  target: UsuarioRow;
  plantas: Planta[];
  domainWarning: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [rol, setRol] = useState<Rol | "">("");
  const [plantaId, setPlantaId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const rolError = submitted && rol === "" ? "elegí un rol" : null;
  // validación EN VIVO (§18.3): el error de planta aparece apenas rol=operador sin planta
  const plantaError = rol === "operador" && plantaId === "" ? "un operador necesita planta asignada" : null;
  const valid = rol !== "" && !plantaError;

  const submit = async () => {
    setSubmitted(true);
    if (!valid || sending) return;
    setSending(true);
    const { error } = await getSupabase().rpc("aprobar_usuario", {
      p_usuario_id: target.id,
      p_rol: rol,
      p_planta_id: plantaId === "" ? null : plantaId,
    });
    setSending(false);
    if (error) {
      toast({ type: "error", title: "No se pudo aprobar", detail: error.message });
      return;
    }
    const plantaNombre = plantas.find((p) => p.id === plantaId)?.nombre;
    toast({
      type: "exito",
      title: `${target.nombre} aprobado`,
      detail: `${ROL_LABELS[rol as Rol]}${plantaNombre ? ` · planta ${plantaNombre}` : ""}`,
    });
    onDone();
  };

  return (
    <Modal open onClose={sending ? () => {} : onClose} title="Aprobar solicitud" width={460} closeOnBackdrop={!sending}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{target.nombre}</div>
          <div className="mono" style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginTop: 2 }}>
            {target.email}
          </div>
        </div>
        {domainWarning && (
          <div
            role="note"
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              fontSize: 11.5,
              lineHeight: 1.5,
              color: "var(--color-status-amber)",
              background: "var(--color-amber-tint)",
              border: "1px solid var(--color-amber-line)",
              borderRadius: "var(--radius-input)",
              padding: "8px 10px",
            }}
          >
            <i className="ti ti-alert-triangle" aria-hidden style={{ fontSize: 14, marginTop: 1 }} />
            <span>{domainWarning}</span>
          </div>
        )}
        <Field label="rol" htmlFor="aprobar-rol" error={rolError}>
          <Select
            id="aprobar-rol"
            value={rol}
            error={rolError}
            onChange={(e) => setRol(e.target.value as Rol | "")}
          >
            <option value="">— elegí un rol —</option>
            <option value="operador">Operador — opera solo su planta</option>
            <option value="supervisor">Supervisor — todas las plantas + validaciones</option>
            <option value="administrador">Administrador — todo + usuarios y configuración</option>
          </Select>
        </Field>
        <Field
          label="planta asignada"
          htmlFor="aprobar-planta"
          error={plantaError}
          hint={rol === "operador" ? undefined : "opcional para supervisor / administrador"}
        >
          <Select id="aprobar-planta" value={plantaId} error={plantaError} onChange={(e) => setPlantaId(e.target.value)}>
            <option value="">— sin planta —</option>
            {plantas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.codigo ? ` (${p.codigo})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button variant="primary" icon="ti-user-check" loading={sending} disabled={!valid} onClick={() => void submit()}>
            Aprobar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- modal de rechazo (§12.3): motivo obligatorio ---------- */

function RechazarModal({
  target,
  onClose,
  onDone,
}: {
  target: UsuarioRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [motivo, setMotivo] = useState("");
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);

  const motivoError = touched && motivo.trim() === "" ? "el motivo es obligatorio" : null;
  const valid = motivo.trim() !== "";

  const submit = async () => {
    setTouched(true);
    if (!valid || sending) return;
    setSending(true);
    const { error } = await getSupabase().rpc("rechazar_usuario", {
      p_usuario_id: target.id,
      p_motivo: motivo.trim(),
    });
    setSending(false);
    if (error) {
      toast({ type: "error", title: "No se pudo rechazar", detail: error.message });
      return;
    }
    toast({ type: "exito", title: `Solicitud de ${target.nombre} rechazada` });
    onDone();
  };

  return (
    <Modal open onClose={sending ? () => {} : onClose} title="Rechazar solicitud" width={460} closeOnBackdrop={!sending}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{target.nombre}</div>
          <div className="mono" style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginTop: 2 }}>
            {target.email}
          </div>
        </div>
        <Field
          label="motivo del rechazo"
          htmlFor="rechazo-motivo"
          error={motivoError}
          hint="queda registrado en la cuenta rechazada"
        >
          <Textarea
            id="rechazo-motivo"
            rows={3}
            value={motivo}
            error={motivoError}
            onChange={(e) => setMotivo(e.target.value)}
            onBlur={() => setTouched(true)}
          />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button variant="danger" icon="ti-user-x" loading={sending} disabled={!valid} onClick={() => void submit()}>
            Rechazar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- página ---------- */

export default function SolicitudesPage() {
  const router = useRouter();
  const toast = useToast();
  const { perfil } = useSession();

  const [rows, setRows] = useState<UsuarioRow[] | null>(null);
  const [plantas, setPlantas] = useState<Planta[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [approveTarget, setApproveTarget] = useState<UsuarioRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<UsuarioRow | null>(null);
  const [estadoTarget, setEstadoTarget] = useState<{ user: UsuarioRow; to: "suspendido" | "activo" } | null>(null);
  const [estadoSending, setEstadoSending] = useState(false);

  const isAdmin = perfil?.rol === "administrador";

  // solo admin (§7): el resto vuelve al inicio. RLS protege los datos igual.
  useEffect(() => {
    if (perfil && !isAdmin) router.replace("/inicio");
  }, [perfil, isAdmin, router]);

  // Todos los setState ocurren después del await (regla set-state-in-effect):
  // en el retry, el ErrorState queda visible hasta que llega el resultado nuevo.
  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [u, p, c] = await Promise.all([
      supabase
        .from("usuarios")
        .select("id, email, nombre, rol, planta_asignada_id, estado_cuenta, rechazo_motivo, created_at, fecha_aprobacion")
        .order("created_at", { ascending: true }),
      supabase.from("plantas").select("id, nombre, codigo").order("nombre"),
      supabase.from("configuracion").select("valor").eq("clave", "dominios_sugeridos").maybeSingle(),
    ]);
    if (u.error || p.error) {
      setRows(null);
      setLoadError((u.error ?? p.error)!.message);
      return;
    }
    setLoadError(null);
    setRows(u.data as UsuarioRow[]);
    setPlantas(p.data as Planta[]);
    // dominios sugeridos: si la clave falta o falla, no hay warnings (§12.4 es aviso soft)
    const valor: unknown = c.error ? null : c.data?.valor;
    setDomains(
      Array.isArray(valor) ? valor.filter((d): d is string => typeof d === "string").map((d) => d.toLowerCase()) : [],
    );
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    // IIFE async: los setState de load() quedan detrás del await (set-state-in-effect)
    void (async () => {
      await load();
    })();
  }, [isAdmin, load]);

  // refetch al recuperar foco (mismo criterio que la campana §13)
  useEffect(() => {
    if (!isAdmin) return;
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isAdmin, load]);

  const loading = rows === null && !loadError;
  const plantaNameById = useMemo(() => new Map(plantas.map((p) => [p.id, p.nombre])), [plantas]);
  const pendientes = useMemo(() => (rows ?? []).filter((r) => r.estado_cuenta === "pendiente_aprobacion"), [rows]);
  const resueltos = useMemo(() => (rows ?? []).filter((r) => r.estado_cuenta !== "pendiente_aprobacion"), [rows]);

  const isDomainOk = useCallback(
    (email: string) => domains.length === 0 || domains.includes(emailDomain(email)),
    [domains],
  );
  const domainWarningText = useCallback(
    (email: string) =>
      `Dominio @${emailDomain(email)} fuera de los sugeridos (${domains.join(", ")}). Es solo un aviso: aprobar o rechazar sigue siendo decisión tuya.`,
    [domains],
  );

  const submitEstado = async () => {
    if (!estadoTarget || estadoSending) return;
    setEstadoSending(true);
    const { error } = await getSupabase().rpc("set_estado_usuario", {
      p_usuario_id: estadoTarget.user.id,
      p_estado: estadoTarget.to,
    });
    setEstadoSending(false);
    if (error) {
      toast({ type: "error", title: "No se pudo cambiar el estado", detail: error.message });
      return;
    }
    toast({
      type: "exito",
      title:
        estadoTarget.to === "suspendido"
          ? `${estadoTarget.user.nombre} suspendido`
          : `${estadoTarget.user.nombre} reactivado`,
      detail:
        estadoTarget.to === "suspendido" ? "Pierde el acceso de inmediato; su historial se conserva." : undefined,
    });
    setEstadoTarget(null);
    void load();
  };

  const actionButtonStyle: React.CSSProperties = { minHeight: 0, padding: "4px 10px", fontSize: 12 };

  const pendientesCols: Column<UsuarioRow>[] = [
    {
      key: "nombre",
      header: "nombre",
      render: (r) => <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{r.nombre}</span>,
      sortValue: (r) => r.nombre,
    },
    {
      key: "email",
      header: "correo",
      render: (r) => <span className="mono">{r.email}</span>,
      sortValue: (r) => r.email,
      hideOnMobile: true,
    },
    {
      key: "solicitado",
      header: "solicitado",
      render: (r) => fmtFechaHora(r.created_at),
      numeric: true,
      sortValue: (r) => r.created_at,
    },
    {
      key: "acciones",
      header: "",
      align: "right",
      render: (r) => (
        <span style={{ display: "inline-flex", gap: 6 }}>
          <Button variant="ghost" icon="ti-user-check" style={actionButtonStyle} onClick={() => setApproveTarget(r)}>
            Aprobar
          </Button>
          <Button variant="danger" icon="ti-user-x" style={actionButtonStyle} onClick={() => setRejectTarget(r)}>
            Rechazar
          </Button>
        </span>
      ),
    },
  ];

  const resueltosCols: Column<UsuarioRow>[] = [
    {
      key: "nombre",
      header: "nombre",
      render: (r) => <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{r.nombre}</span>,
      sortValue: (r) => r.nombre,
    },
    {
      key: "email",
      header: "correo",
      render: (r) => <span className="mono">{r.email}</span>,
      sortValue: (r) => r.email,
      hideOnMobile: true,
    },
    {
      key: "rol",
      header: "rol",
      render: (r) => (r.rol ? ROL_LABELS[r.rol] : "—"),
      sortValue: (r) => r.rol,
      hideOnMobile: true,
    },
    {
      key: "planta",
      header: "planta",
      render: (r) => (r.planta_asignada_id ? (plantaNameById.get(r.planta_asignada_id) ?? "—") : "—"),
      sortValue: (r) => (r.planta_asignada_id ? (plantaNameById.get(r.planta_asignada_id) ?? null) : null),
      hideOnMobile: true,
    },
    {
      key: "estado",
      header: "estado",
      render: (r) => (
        <Badge tone={ESTADO_TONE[r.estado_cuenta]}>
          <span title={r.estado_cuenta === "rechazado" && r.rechazo_motivo ? `Motivo: ${r.rechazo_motivo}` : undefined}>
            {ESTADO_LABEL[r.estado_cuenta]}
          </span>
        </Badge>
      ),
      sortValue: (r) => r.estado_cuenta,
    },
    {
      key: "acciones",
      header: "",
      align: "right",
      render: (r) => {
        if (r.id === perfil?.usuario_id) {
          return <span style={{ fontSize: 11, color: "var(--color-text-faint)" }}>tu cuenta</span>;
        }
        if (r.estado_cuenta === "activo") {
          return (
            <Button
              variant="danger"
              icon="ti-lock"
              style={actionButtonStyle}
              onClick={() => setEstadoTarget({ user: r, to: "suspendido" })}
            >
              Suspender
            </Button>
          );
        }
        if (r.estado_cuenta === "suspendido") {
          return (
            <Button
              variant="ghost"
              icon="ti-lock-open"
              style={actionButtonStyle}
              onClick={() => setEstadoTarget({ user: r, to: "activo" })}
            >
              Reactivar
            </Button>
          );
        }
        return null;
      },
    },
  ];

  // validación por fila §12.4: warning de dominio (nunca bloqueo)
  const domainValidation = (r: UsuarioRow): RowValidation | null =>
    isDomainOk(r.email) ? null : { type: "warning", message: domainWarningText(r.email) };

  if (!isAdmin) {
    // sin rol admin (o perfil aún no resuelto): skeleton mientras el guard redirige
    return (
      <>
        <PageHeader title="Solicitudes de acceso" />
        <DataTable columns={pendientesCols} rows={[]} rowKey={(r) => r.id} loading skeletonRows={4} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Solicitudes de acceso"
        counters={
          rows !== null ? (
            <>
              <Badge tone={pendientes.length > 0 ? "amarillo" : "neutro"} mono icon="ti-user-question">
                {pendientes.length} pendiente{pendientes.length === 1 ? "" : "s"}
              </Badge>
              <Badge tone="neutro" mono icon="ti-users">
                {resueltos.length} resuelto{resueltos.length === 1 ? "" : "s"}
              </Badge>
            </>
          ) : undefined
        }
        action={
          <Button variant="ghost" icon="ti-refresh" onClick={() => void load()} disabled={loading}>
            Actualizar
          </Button>
        }
      />

      <SectionTitle title="Pendientes de aprobación" count={rows !== null ? pendientes.length : null} />
      <DataTable
        columns={pendientesCols}
        rows={pendientes}
        rowKey={(r) => r.id}
        loading={loading}
        skeletonRows={4}
        defaultSort={{ key: "solicitado", dir: "asc" }}
        validation={domainValidation}
        errorState={
          loadError ? (
            <ErrorState
              title="No se pudieron cargar las solicitudes"
              detail={loadError}
              onRetry={() => void load()}
            />
          ) : undefined
        }
        emptyState={
          <EmptyState icon="ti-user-question" title="No hay solicitudes pendientes">
            Acá aparece cada persona que se registra y confirma su correo. Queda pendiente hasta que un administrador
            la apruebe asignándole rol y planta — o la rechace con motivo.
          </EmptyState>
        }
      />

      <SectionTitle title="Usuarios resueltos" count={rows !== null ? resueltos.length : null} />
      <DataTable
        columns={resueltosCols}
        rows={resueltos}
        rowKey={(r) => r.id}
        loading={loading}
        skeletonRows={4}
        pageSize={12}
        errorState={
          loadError ? (
            <ErrorState title="No se pudieron cargar los usuarios" detail={loadError} onRetry={() => void load()} />
          ) : undefined
        }
        emptyState={
          <EmptyState icon="ti-users" title="Todavía no hay usuarios resueltos">
            Cuando apruebes, rechaces o suspendas cuentas quedan listadas acá con su rol, planta y estado. La gestión
            completa de usuarios llega con el Admin de M8.
          </EmptyState>
        }
      />

      {approveTarget && (
        <AprobarModal
          target={approveTarget}
          plantas={plantas}
          domainWarning={isDomainOk(approveTarget.email) ? null : domainWarningText(approveTarget.email)}
          onClose={() => setApproveTarget(null)}
          onDone={() => {
            setApproveTarget(null);
            void load();
          }}
        />
      )}

      {rejectTarget && (
        <RechazarModal
          target={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onDone={() => {
            setRejectTarget(null);
            void load();
          }}
        />
      )}

      <ConfirmDialog
        open={estadoTarget !== null}
        danger={estadoTarget?.to === "suspendido"}
        loading={estadoSending}
        title={estadoTarget?.to === "suspendido" ? "Suspender cuenta" : "Reactivar cuenta"}
        confirmLabel={estadoTarget?.to === "suspendido" ? "Suspender" : "Reactivar"}
        message={
          estadoTarget?.to === "suspendido" ? (
            <>
              <strong>{estadoTarget?.user.nombre}</strong> pierde el acceso al CRM de inmediato (lo corta RLS). Su
              historial se conserva y podés reactivarla cuando quieras.
            </>
          ) : (
            <>
              <strong>{estadoTarget?.user.nombre}</strong> recupera el acceso con el rol y la planta que ya tenía
              asignados.
            </>
          )
        }
        onConfirm={() => void submitEstado()}
        onCancel={() => setEstadoTarget(null)}
      />
    </>
  );
}
