"use client";

// Timeline (spec artboard 2c — en v1 vivía inline en la ficha; acá nace componente):
// fecha+hora mono col 96px right · dot 12px + conector 2px · título 13.5/600 + detalle.
// 4 estados por evento: completado (dot verde relleno) / hito fin free time (dot rojo
// hueco, título ámbar, chip HITO) / en curso (dot rojo relleno + glow + pulso, chip
// EN CURSO) / futuro (dot gris hueco, texto muted).

export type TimelineStatus = "completado" | "hito" | "en_curso" | "futuro";

export type TimelineItem = {
  id: string;
  /** Fecha ya formateada para display (ej: "03/07/26"). */
  date: string;
  time?: string;
  title: string;
  detail?: string;
  status: TimelineStatus;
};

const CHIP: Partial<Record<TimelineStatus, { label: string; color: string; bg: string; border: string }>> = {
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

function Dot({ status }: { status: TimelineStatus }) {
  const base: React.CSSProperties = {
    width: 12,
    height: 12,
    borderRadius: "50%",
    flexShrink: 0,
    boxSizing: "border-box",
  };
  switch (status) {
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

export function TimelineEvent({ item, last = false }: { item: TimelineItem; last?: boolean }) {
  const muted = item.status === "futuro";
  const chip = CHIP[item.status];
  const titleColor = muted
    ? "var(--color-text-faint)"
    : item.status === "hito"
      ? "var(--color-status-amber)"
      : "var(--color-text-primary)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "96px 24px 1fr", gap: 0, flex: 1, minHeight: 56 }}>
      {/* fecha mono, right */}
      <div style={{ textAlign: "right", paddingRight: 4, paddingTop: 1 }}>
        <div className="mono" style={{ fontSize: 11, color: muted ? "var(--color-text-faint)" : "var(--color-text-secondary)" }}>
          {item.date}
        </div>
        {item.time && (
          <div className="mono" style={{ fontSize: 10.5, color: "var(--color-text-faint)", marginTop: 1 }}>
            {item.time}
          </div>
        )}
      </div>
      {/* dot + conector 2px */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Dot status={item.status} />
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
          <span style={{ fontSize: 13.5, fontWeight: 600, color: titleColor }}>{item.title}</span>
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
        {item.detail && (
          <div style={{ fontSize: 12, color: muted ? "var(--color-text-faint)" : "var(--color-text-label)", marginTop: 3 }}>
            {item.detail}
          </div>
        )}
      </div>
    </div>
  );
}

/** Eventos distribuidos en la altura del panel (flex column, cada item flex:1). */
export function Timeline({ items, className = "" }: { items: TimelineItem[]; className?: string }) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column" }}>
      {items.map((e, i) => (
        <TimelineEvent key={e.id} item={e} last={i === items.length - 1} />
      ))}
    </div>
  );
}
