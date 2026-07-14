// Compartido del módulo Incidencias (M7 + B5): opciones del Select construidas desde el
// mapa único TIPO_INCIDENCIA_LABELS (lib/format — lo comparte el timeline de la ficha,
// cero strings duplicados) + badges tonales únicos para que el mismo tipo/estado se vea
// idéntico en el alta, el historial y el panel de gestión de reclamo + nombre del bucket
// PRIVADO de Storage + thumbnail de foto reutilizable (tabla e historial y modal de
// gestión comparten el mismo componente).
//
// ⚠️ Bucket: SOLO `crm-incidencias` (privado, servido por signed URLs). El bucket
// `incidencias` público es un residuo v1 y está PROHIBIDO (plan M7 — regla dura 1).

import { Badge, type BadgeTone } from "@/components/fd/badge";
import { SkeletonBlock } from "@/components/fd/skeleton-row";
import { ESTADO_RECLAMO_LABELS, RESULTADO_RECLAMO_LABELS, TIPO_INCIDENCIA_LABELS } from "@/lib/format";

export const BUCKET_INCIDENCIAS = "crm-incidencias";

// Tipos MANUALES (B5, migración 030): `no_reforzado` y `prefijo_restringido` los
// autogenera el sistema (crm_crear_tanda_retiro / validación de prefijo) — NUNCA se
// ofrecen en el alta manual. Orden fijo (no el de inserción del mapa) — el pedido del
// módulo: sufrida, recepcionada, lavado, daño, otro.
const TIPO_INCIDENCIA_MANUAL = [
  "averia_sufrida",
  "averia_recepcionada",
  "lavado_exigido",
  "dano_refaccion",
  "otro",
] as const;

export const TIPO_INCIDENCIA_OPTIONS: { value: string; label: string }[] = TIPO_INCIDENCIA_MANUAL.map((value) => ({
  value,
  label: TIPO_INCIDENCIA_LABELS[value],
}));

// Todos los tipos (manuales + automáticos) — para el filtro del historial, que sí debe
// poder mostrar/filtrar los autogenerados.
export const TIPO_INCIDENCIA_OPTIONS_ALL: { value: string; label: string }[] = Object.entries(
  TIPO_INCIDENCIA_LABELS,
).map(([value, label]) => ({ value, label }));

// sufrida/daño-con-refacción = crítico bajo custodia propia (rojo) · recepcionada = aviso
// (amarillo) · lavado = evento de plata sin daño (accent) · otro/automáticos = neutro.
const TIPO_TONE: Record<string, BadgeTone> = {
  averia_sufrida: "rojo",
  averia_recepcionada: "amarillo",
  otro: "neutro",
  lavado_exigido: "accent",
  dano_refaccion: "rojo",
  no_reforzado: "neutro",
  prefijo_restringido: "neutro",
};

export function TipoIncidenciaBadge({ tipo }: { tipo: string }) {
  return <Badge tone={TIPO_TONE[tipo] ?? "neutro"}>{TIPO_INCIDENCIA_LABELS[tipo] ?? tipo}</Badge>;
}

/* ---------- estado del reclamo (B5, migración 030) ---------- */

export const ESTADO_RECLAMO_OPTIONS: { value: string; label: string }[] = Object.entries(ESTADO_RECLAMO_LABELS).map(
  ([value, label]) => ({ value, label }),
);

/**
 * sin_reclamo=neutro · abierta=amarillo · reclamada=accent (azul del set) · resuelta:
 * verde si recuperado, rojo si no_recuperado (rojo también si por algún motivo no hay
 * resultado aún — no debería pasar, el CHECK de la tabla lo impide).
 */
export function EstadoReclamoBadge({ estado, resultado }: { estado: string; resultado: string | null }) {
  const tone: BadgeTone =
    estado === "resuelta"
      ? resultado === "recuperado"
        ? "verde"
        : "rojo"
      : estado === "reclamada"
        ? "accent"
        : estado === "abierta"
          ? "amarillo"
          : "neutro";
  const label =
    estado === "resuelta" && resultado
      ? `${ESTADO_RECLAMO_LABELS[estado]} · ${RESULTADO_RECLAMO_LABELS[resultado] ?? resultado}`
      : (ESTADO_RECLAMO_LABELS[estado] ?? estado);
  return <Badge tone={tone}>{label}</Badge>;
}

/* ---------- thumbnail de foto (skeleton mientras se firma / placeholder si falla) ---------- */

/** Resultado de firmar un path: url lista, o error para el placeholder tolerante. */
export type FotoUrl = { url: string | null; error: string | null };

export function FotoThumb({
  urlInfo,
  nombre,
  onOpen,
  size = 30,
}: {
  /** undefined = la firma del batch todavía no llegó. */
  urlInfo: FotoUrl | undefined;
  nombre: string;
  onOpen: (url: string) => void;
  size?: number;
}) {
  if (urlInfo === undefined) {
    return <SkeletonBlock width={size} height={size} style={{ borderRadius: 6, display: "inline-block" }} />;
  }
  if (urlInfo.url === null) {
    return (
      <span
        title={`No se pudo cargar la foto: ${urlInfo.error ?? "enlace inválido"}`}
        aria-label="foto no disponible"
        style={{
          width: size,
          height: size,
          display: "inline-grid",
          placeItems: "center",
          borderRadius: 6,
          border: "1px solid var(--color-border-strong)",
          background: "var(--color-surface-2)",
          color: "var(--color-text-faint)",
          fontSize: 14,
        }}
      >
        <i className="ti ti-photo-off" aria-hidden />
      </span>
    );
  }
  const url = urlInfo.url;
  return (
    <button
      type="button"
      aria-label={`ver foto de ${nombre}`}
      onClick={(e) => {
        e.stopPropagation(); // la fila/panel puede tener su propio click; el thumb abre aparte
        onOpen(url);
      }}
      style={{
        width: size,
        height: size,
        minHeight: 0,
        padding: 0,
        borderRadius: 6,
        border: "1px solid var(--color-border-strong)",
        overflow: "hidden",
        background: "var(--color-surface-2)",
        cursor: "zoom-in",
        flexShrink: 0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs efímeras de Storage, next/image no aplica */}
      <img src={url} alt={`foto de ${nombre}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </button>
  );
}
