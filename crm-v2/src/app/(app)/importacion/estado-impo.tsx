// Badge de estado de operación de IMPORTACIÓN (M5 B2, migración 032) — mismo patrón
// que contenedores/estado-operacion.tsx (EXPO), pero con su propio mapa de tonos: el
// ciclo de importación tiene una máquina de estados separada (tablas propias, RLS y
// vistas paralelas — decisión ya tomada en el plan M5, no se unifica con `operaciones`):
// en_terminal → en_transito_a_planta → en_planta → en_transito_devolucion → cerrado|anulada.
// Reusado por /importacion (planilla de pendientes) y /alertas (columna EXPO/IMPO fusionada).

import { Badge, type BadgeTone } from "@/components/fd/badge";
import { ESTADO_IMPO_LABELS } from "@/lib/format";

export const ESTADO_IMPO_TONE: Record<string, BadgeTone> = {
  en_terminal: "amarillo",
  en_transito_a_planta: "amarillo",
  en_planta: "verde",
  en_transito_devolucion: "amarillo",
  cerrado: "neutro",
  anulada: "rojo",
};

export function EstadoImpoBadge({ estado }: { estado: string }) {
  return <Badge tone={ESTADO_IMPO_TONE[estado] ?? "neutro"}>{ESTADO_IMPO_LABELS[estado] ?? estado}</Badge>;
}
