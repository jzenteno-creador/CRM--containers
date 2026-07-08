// Espera de aprobación estática (§12.2, plan 1.5): autenticado pero no aprobado.
// El acceso cero a datos lo garantiza RLS (M1), no esta pantalla. M2 la wirea
// (sesión real + logout); acá es la compuerta visual.

import { Button } from "@/components/fd/button";

export default function EsperaAprobacionPage() {
  return (
    <div className="gate-page">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className="dot-logo">S</span>
        <span className="wordmark">
          SSB<b>·</b>INTERNATIONAL
        </span>
      </div>

      <div className="gate-card">
        <span
          aria-hidden
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "var(--color-amber-tint)",
            border: "1px solid var(--color-amber-line)",
            color: "var(--color-status-amber)",
            fontSize: 24,
          }}
        >
          <i className="ti ti-hourglass-high" />
        </span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.13em",
            textTransform: "uppercase",
            padding: "3px 10px",
            borderRadius: "var(--radius-chip)",
            color: "var(--color-status-amber)",
            background: "var(--color-amber-tint)",
            border: "1px solid var(--color-amber-line)",
          }}
        >
          Pendiente de aprobación
        </span>
        <h1
          className="fd-display"
          style={{ fontSize: 17, margin: "4px 0 0", color: "var(--color-text-primary)" }}
        >
          Tu cuenta espera aprobación
        </h1>
        <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.6, margin: 0, maxWidth: 340 }}>
          Un administrador tiene que aprobar tu solicitud y asignarte rol y planta. Vas a poder entrar al
          sistema apenas te aprueben — no hace falta que hagas nada más.
        </p>
        <div style={{ marginTop: 10, width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          {/* sin lógica — M2 conecta el logout real de Supabase Auth */}
          <Button variant="ghost" icon="ti-logout" disabled title="Se conecta en M2" style={{ width: "100%", padding: 10 }}>
            Cerrar sesión
          </Button>
          <span style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
            ¿Consultas? Escribí a administración de SSB.
          </span>
        </div>
      </div>

      <span className="mono" style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
        CRM DETENTION · v2
      </span>
    </div>
  );
}
