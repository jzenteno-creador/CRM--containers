// Badge de estado de operación (M5): mapa ÚNICO estado→tono compartido por la
// planilla y la ficha, para que el mismo estado se vea idéntico en ambas pantallas.
// Tonos: en_planta=verde, tránsitos=amarillo, cerrado=neutro, anulada=rojo (plan M5).

import { Badge, type BadgeTone } from "@/components/fd/badge";
import { ESTADO_LABELS } from "@/lib/format";

export const ESTADO_OPERACION_TONE: Record<string, BadgeTone> = {
  en_transito_a_planta: "amarillo",
  en_planta: "verde",
  en_transito_a_terminal: "amarillo",
  cerrado: "neutro",
  anulada: "rojo",
};

export function EstadoOperacionBadge({ estado }: { estado: string }) {
  return <Badge tone={ESTADO_OPERACION_TONE[estado] ?? "neutro"}>{ESTADO_LABELS[estado] ?? estado}</Badge>;
}
