"use client";

// Timeline (spec artboard 2c — en v1 vivía inline en la ficha; acá nace componente):
// fecha+hora mono col 96px right · dot 12px + conector 2px · título 13.5/600 + detalle.
// 4 estados por evento: completado (dot verde relleno) / hito fin free time (dot rojo
// hueco, título ámbar, chip HITO) / en curso (dot rojo relleno + glow + pulso, chip
// EN CURSO) / futuro (dot gris hueco, texto muted).

export type TimelineEstado = "completado" | "hito" | "en_curso" | "futuro";

export type TimelineEvento = {
  id: string;
  /** Fecha ya formateada para display (ej: "03/07/26"). */
  fecha: string;
  hora?: string;
  titulo: string;
  detalle?: string;
  estado: TimelineEstado;
};

const CHIP: Partial<Record<TimelineEstado, { label: string; color: string; bg: string; border: string }>> = {
  hito: {
    label: "HITO",
    color: "var(--color-status-red)",
    bg: "var(--color-red-tint)",
    border: "var(--color-red-line)",
  },
  en_curso: {
    label: "EN CURSO",
    color: "var(--color-status-red)",
    bg: "var(--color-red-tint)",
    border: "var(--color-red-line)",
  },
};

function Dot({ estado }: { estado: TimelineEstado }) {
  const base: React.CSSProperties = {
    width: 12,
    height: 12,
    borderRadius: "50%",
    flexShrink: 0,
    boxSizing: "border-box",
  };
  switch (estado) {
    case "completado":
      return <span aria-hidden style={{ ...base, background: "var(--color-status-green)" }} />;
    case "hito":
      return (
        <span
          aria-hidden
          style={{ ...base, background: "transparent", border: "2px solid var(--color-status-red)" }}
        />
      );
    case "en_curso":
      return (
        <span
          aria-hidden
          className="fd-dot-pulse"
          style={{ ...base, background: "var(--color-status-red)", boxShadow: "var(--shadow-glow-red)" }}
        />
      );
    case "futuro":
      return (
        <span
          aria-hidden
          style={{ ...base, background: "transparent", border: "2px solid var(--color-border-strong)" }}
        />
      );
  }
}

export function TimelineEvent({ evento, last = false }: { evento: TimelineEvento; last?: boolean }) {
  const muted = evento.estado === "futuro";
  const chip = CHIP[evento.estado];
  const tituloColor = muted
    ? "var(--color-text-faint)"
    : evento.estado === "hito"
      ? "var(--color-status-amber)"
      : "var(--color-text-primary)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "96px 24px 1fr", gap: 0, flex: 1, minHeight: 56 }}>
      {/* fecha mono, right */}
      <div style={{ textAlign: "right", paddingRight: 4, paddingTop: 1 }}>
        <div className="mono" style={{ fontSize: 11, color: muted ? "var(--color-text-faint)" : "var(--color-text-secondary)" }}>
          {evento.fecha}
        </div>
        {evento.hora && (
          <div className="mono" style={{ fontSize: 10.5, color: "var(--color-text-faint)", marginTop: 1 }}>
            {evento.hora}
          </div>
        )}
      </div>
      {/* dot + conector 2px */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Dot estado={evento.estado} />
        {!last && (
          <span
            aria-hidden
            style={{
              width: 2,
              flex: 1,
              minHeight: 16,
              marginTop: 4,
              background: "var(--color-border-subtle)",
            }}
          />
        )}
      </div>
      {/* contenido */}
      <div style={{ paddingBottom: last ? 0 : 16, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: tituloColor }}>{evento.titulo}</span>
          {chip && (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.1em",
                padding: "2px 7px",
                borderRadius: "var(--radius-chip)",
                color: chip.color,
                background: chip.bg,
                border: `1px solid ${chip.border}`,
                whiteSpace: "nowrap",
              }}
            >
              {chip.label}
            </span>
          )}
        </div>
        {evento.detalle && (
          <div style={{ fontSize: 12, color: muted ? "var(--color-text-faint)" : "var(--color-text-label)", marginTop: 3 }}>
            {evento.detalle}
          </div>
        )}
      </div>
    </div>
  );
}

/** Eventos distribuidos en la altura del panel (flex column, cada evento flex:1). */
export function Timeline({ eventos, className = "" }: { eventos: TimelineEvento[]; className?: string }) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column" }}>
      {eventos.map((e, i) => (
        <TimelineEvent key={e.id} evento={e} last={i === eventos.length - 1} />
      ))}
    </div>
  );
}
