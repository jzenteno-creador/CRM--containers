import Link from "next/link";
import { EmptyState } from "@/components/fd/empty-state";
import { GateFrame } from "@/components/fd/gate-frame";

// 404 Flight Deck (review M0): el rail linkea solapas que recién existen desde M3+
// (ingreso, egreso, contenedores, alertas, incidencias, admin, ayuda). Hasta que cada
// módulo llegue, cualquier ruta sin página cae acá con los tokens del sistema en vez
// del 404 default de Next sin estilar. Misma familia visual que /espera-aprobacion.
export default function NotFound() {
  return (
    <GateFrame>
      <div className="gate-card">
        <span
          className="mono"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.13em",
            padding: "3px 10px",
            borderRadius: "var(--radius-chip)",
            color: "var(--color-text-muted)",
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border-strong)",
          }}
        >
          404
        </span>
        <EmptyState icon="ti-map-off" title="Esta página no existe (todavía)">
          Los módulos del rail —Ingreso, Egreso, Contenedores, Alertas, Incidencias, Admin y Ayuda— se
          construyen de M3 en adelante. Si llegaste por un link viejo o una URL mal tipeada, volvé al
          inicio y navegá desde ahí.
        </EmptyState>
        <Link
          href="/inicio"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 18px",
            borderRadius: "var(--radius-input)",
            background: "var(--color-accent-500)",
            color: "var(--color-accent-ink)",
            fontSize: 12.5,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          <i className="ti ti-arrow-left" aria-hidden />
          Volver al inicio
        </Link>
      </div>
    </GateFrame>
  );
}
