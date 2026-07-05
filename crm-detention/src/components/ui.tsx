"use client";

import type { ReactNode } from "react";

// Piezas compartidas para estados de carga/vacío/error + paginación (spec §11: en TODOS los listados)

/**
 * Diálogo de confirmación reutilizable (FE-01): acciones de lote irreversibles
 * (cortar freetime, anular, reabrir) piden confirmación con el impacto a la vista.
 * Estilos inline sobre las variables del tema (no toca globals.css).
 */
export function ConfirmDialog({
  open,
  titulo,
  mensaje,
  detalle,
  confirmLabel = "confirmar",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  titulo: string;
  mensaje: string;
  detalle?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={() => !busy && onCancel()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius)",
          padding: "18px 20px",
          maxWidth: 460,
          width: "100%",
          boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
        }}
      >
        <h4 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600 }}>{titulo}</h4>
        <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "var(--text-primary)" }}>{mensaje}</p>
        {detalle}
        <div className="actbar" style={{ justifyContent: "flex-end", marginTop: 14 }}>
          <button type="button" onClick={onCancel} disabled={busy}>
            cancelar
          </button>
          <button
            type="button"
            className={danger ? "btn-danger" : "btn-primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "procesando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Cargando({ msg = "cargando…" }: { msg?: string }) {
  return <p className="empty">{msg}</p>;
}

export function Vacio({ msg = "sin resultados" }: { msg?: string }) {
  return <p className="empty">{msg}</p>;
}

export function ErrorMsg({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return (
    <div className="err" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span>{msg}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} style={{ padding: "3px 9px" }}>
          reintentar
        </button>
      )}
    </div>
  );
}

export function Semaforo({ estado }: { estado: "verde" | "amarillo" | "rojo" | "neutro" }) {
  return <span className={`dot dot-${estado}`} title={estado === "neutro" ? "sin cargo de origen aplicable" : estado} />;
}

/** Ícono de contenedor (guía de diseño): marcador de unidad en conteos y KPIs. */
export function ContainerIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      className="cont-ico"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <rect x="2" y="7" width="20" height="10" rx="1" />
      <line x1="6" y1="7" x2="6" y2="17" />
      <line x1="10" y1="7" x2="10" y2="17" />
      <line x1="14" y1="7" x2="14" y2="17" />
      <line x1="18" y1="7" x2="18" y2="17" />
    </svg>
  );
}

/** Medidor de freetime (firma de la guía): barra que se llena verde→ámbar→rojo según el semáforo. */
export function FreetimeMeter({
  estadia,
  libres,
  semaforo,
}: {
  estadia: number;
  libres: number | null;
  semaforo: "verde" | "amarillo" | "rojo" | "neutro";
}) {
  if (libres == null || libres <= 0) {
    return (
      <div className="ft-meter" title="sin freetime aplicable">
        <i className="ft-neutro" style={{ width: "25%" }} />
      </div>
    );
  }
  const pct = Math.max(4, Math.min(100, Math.round((estadia / libres) * 100)));
  const cls =
    semaforo === "rojo"
      ? "ft-over"
      : semaforo === "amarillo"
        ? "ft-warn"
        : semaforo === "neutro"
          ? "ft-neutro"
          : "ft-ok";
  return (
    <div className="ft-meter" title={`${estadia} de ${libres} días libres`}>
      <i className={cls} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Paginacion({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number; // 0-based
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="actbar" style={{ justifyContent: "flex-end", alignItems: "center" }}>
      <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)}>
        ‹ anterior
      </button>
      <span className="pill">
        {page + 1} / {pages} · {total} filas
      </span>
      <button type="button" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
        siguiente ›
      </button>
    </div>
  );
}
