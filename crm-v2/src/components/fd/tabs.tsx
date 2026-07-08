"use client";

// Tabs (design system M0): navegación interna de una pantalla (ej: Admin).
// Activa: texto primary + subrayado cyan 2px. Scroll-x propio en móvil.

export type TabDef = {
  id: string;
  label: string;
  /** Contador opcional (mono). */
  badge?: number;
};

export function Tabs({
  tabs,
  active,
  onChange,
  className = "",
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={className}
      style={{
        display: "flex",
        gap: 2,
        borderBottom: "1px solid var(--color-border-subtle)",
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
    >
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className="hover:[background:var(--color-surface-2)!important]"
            style={{
              minHeight: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 14px",
              border: "none",
              borderRadius: 0,
              borderBottom: `2px solid ${isActive ? "var(--color-accent-500)" : "transparent"}`,
              background: "transparent",
              fontSize: 12.5,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--color-text-primary)" : "var(--color-text-muted)",
              whiteSpace: "nowrap",
              transition: "color 150ms var(--ease-out-expo), border-color 150ms var(--ease-out-expo)",
            }}
          >
            {t.label}
            {t.badge != null && (
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: isActive ? "var(--color-accent-tint)" : "var(--color-surface-2)",
                  border: `1px solid ${isActive ? "var(--color-accent-line)" : "var(--color-border-strong)"}`,
                  color: isActive ? "var(--color-accent-500)" : "var(--color-text-muted)",
                }}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
