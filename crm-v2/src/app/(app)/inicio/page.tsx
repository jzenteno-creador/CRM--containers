import { EmptyState } from "@/components/fd/empty-state";
import { PageHeader } from "@/components/fd/page-header";

// Placeholder de M0: el dashboard real (KPIs de costo, charts, actividad) llega en M7.
// El patrón de página completo (PageHeader + contrato de 4 estados) está demostrado
// en /design.
export default function InicioPage() {
  return (
    <>
      <PageHeader title="Inicio" />
      <div className="fd-panel">
        <EmptyState icon="ti-layout-dashboard" title="El dashboard llega en M7">
          Acá van a vivir los KPIs de plata (costo detention mes/YTD, contenedores en riesgo, stock de
          vacíos, demora promedio) alimentados por views de Supabase, con costo por naviera en barras y
          tendencia mensual en línea.
        </EmptyState>
      </div>
    </>
  );
}
