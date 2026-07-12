// Compartido del módulo Incidencias (M7): opciones del Select construidas desde el
// mapa único TIPO_INCIDENCIA_LABELS (lib/format — lo comparte el timeline de la ficha,
// cero strings duplicados) + badge tonal único para que el mismo tipo se vea idéntico
// en el alta y en el historial + nombre del bucket PRIVADO de Storage.
//
// ⚠️ Bucket: SOLO `crm-incidencias` (privado, servido por signed URLs). El bucket
// `incidencias` público es un residuo v1 y está PROHIBIDO (plan M7 — regla dura 1).

import { Badge, type BadgeTone } from "@/components/fd/badge";
import { TIPO_INCIDENCIA_LABELS } from "@/lib/format";

export const BUCKET_INCIDENCIAS = "crm-incidencias";

// orden de inserción del mapa = orden del Select (sufrida, recepcionada, otro)
export const TIPO_INCIDENCIA_OPTIONS: { value: string; label: string }[] = Object.entries(
  TIPO_INCIDENCIA_LABELS,
).map(([value, label]) => ({ value, label }));

// sufrida = daño bajo custodia propia (crítico) / recepcionada = llegó dañado (aviso)
const TIPO_TONE: Record<string, BadgeTone> = {
  averia_sufrida: "rojo",
  averia_recepcionada: "amarillo",
  otro: "neutro",
};

export function TipoIncidenciaBadge({ tipo }: { tipo: string }) {
  return <Badge tone={TIPO_TONE[tipo] ?? "neutro"}>{TIPO_INCIDENCIA_LABELS[tipo] ?? tipo}</Badge>;
}
