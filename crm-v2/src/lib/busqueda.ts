// Datasource del buscador global ⌘K (P2, auditoría 2026-07-31 — command-palette.tsx
// mostraba "la búsqueda se conecta con el módulo de operaciones (M5)" sin cablear
// nada). Conecta contra las 3 fuentes de contenedores vivas del repo, en paralelo:
// - vista_alertas: ciclos EXPO abiertos (freetime en seguimiento) — misma view de
//   /alertas, CERO cálculo acá, solo se copian columnas ya resueltas por la DB.
// - operaciones (estado=cerrado) + contenedor embebido !inner: ciclos EXPO cerrados —
//   mismo patrón de embed + ilike que la búsqueda server-side de /contenedores
//   (src/app/(app)/contenedores/page.tsx), sin booking/orden acá porque la promesa de
//   la palette es "buscar contenedor", no la planilla completa.
// - vista_alertas_impo: ciclos IMPO abiertos. Sin ficha individual en v1 (igual que en
//   /alertas): el resultado navega a /importacion, no a /contenedores/{id} — limitación
//   documentada, no un bug.
//
// Cada fuente es TOLERANTE de forma independiente (mismo criterio que /alertas con
// vista_alertas_impo): si una query falla, esa fuente devuelve [] — nunca tumba las
// otras dos ni lanza hacia el caller.

import type { PaletteResult } from "@/components/fd/command-palette";
import type { EstadoSemaforo } from "@/components/fd/status-badge";
import { normalizarNumero } from "@/lib/iso6346";
import { getSupabase } from "@/lib/supabase";

/** Tope por fuente (3 fuentes × 10 = 30 resultados máx. en pantalla, agrupados). */
const LIMIT_POR_FUENTE = 10;

/** Mínimo de caracteres para disparar la búsqueda (gate real, no cosmético — evita
 * pegarle a la DB por cada tecla de un término de 1-2 letras). Lo aplica también
 * command-palette.tsx antes de llamar acá; se repite como defensa en profundidad. */
export const MIN_QUERY_LEN = 3;

const SEMAFORO_LABEL: Record<EstadoSemaforo, string> = {
  rojo: "vencido",
  amarillo: "por vencer",
  verde: "en freetime",
  neutro: "sin tarifa",
};

// Contrato real de crm.vista_alertas (mismo pg_get_viewdef que consume /alertas) —
// acá solo se seleccionan las columnas que necesita un resultado de la palette.
type ExpoAbiertaRow = {
  operacion_id: string;
  contenedor_id: string;
  numero_contenedor: string;
  naviera: string | null;
  planta_actual: string | null;
  estado_semaforo: EstadoSemaforo;
  dias_restantes: number | null;
};

// Embed de crm.operaciones (mismo SELECT que /contenedores, recortado a lo que usa
// esta fuente: sin booking/orden, sin estado_carga).
type ExpoCerradaRow = {
  id: string;
  contenedor: { id: string; numero_contenedor: string; naviera: { nombre: string } | null } | null;
  planta_actual: { nombre: string } | null;
};

// Contrato real de crm.vista_alertas_impo (mismo que consume /alertas).
type ImpoAbiertaRow = {
  operacion_impo_id: string;
  numero_contenedor: string;
  naviera: string | null;
  planta: string | null;
  estado_semaforo: EstadoSemaforo;
  dias_restantes: number | null;
};

async function buscarExpoAbiertas(term: string): Promise<PaletteResult[]> {
  const { data, error } = await getSupabase()
    .from("vista_alertas")
    .select("operacion_id, contenedor_id, numero_contenedor, naviera, planta_actual, estado_semaforo, dias_restantes")
    .ilike("numero_contenedor", `%${term}%`)
    .order("dias_restantes", { ascending: true, nullsFirst: false })
    .limit(LIMIT_POR_FUENTE);
  if (error) return [];
  return (data as unknown as ExpoAbiertaRow[]).map((r) => ({
    id: `expo-abierta-${r.operacion_id}`,
    group: "Expo · abiertas",
    numeroContenedor: r.numero_contenedor,
    meta: [r.naviera, r.planta_actual, r.dias_restantes != null ? `${r.dias_restantes} d restantes` : null]
      .filter((v): v is string => Boolean(v))
      .join(" · "),
    semaforo: r.estado_semaforo,
    href: `/contenedores/${r.contenedor_id}`,
  }));
}

async function buscarExpoCerradas(term: string): Promise<PaletteResult[]> {
  const { data, error } = await getSupabase()
    .from("operaciones")
    .select(
      "id, contenedor:contenedores!inner(id, numero_contenedor, naviera:navieras(nombre)), planta_actual:plantas(nombre)",
    )
    .eq("estado", "cerrado")
    .ilike("contenedor.numero_contenedor", `%${term}%`)
    .order("fecha_retiro", { ascending: false })
    .limit(LIMIT_POR_FUENTE);
  if (error) return [];
  return (data as unknown as ExpoCerradaRow[])
    .filter((r) => r.contenedor !== null)
    .map((r) => ({
      id: `expo-cerrada-${r.id}`,
      group: "Expo · cerradas",
      numeroContenedor: r.contenedor!.numero_contenedor,
      meta: [r.contenedor!.naviera?.nombre, r.planta_actual?.nombre, "cerrada"]
        .filter((v): v is string => Boolean(v))
        .join(" · "),
      href: `/contenedores/${r.contenedor!.id}`,
    }));
}

async function buscarImpoAbiertas(term: string): Promise<PaletteResult[]> {
  const { data, error } = await getSupabase()
    .from("vista_alertas_impo")
    .select("operacion_impo_id, numero_contenedor, naviera, planta, estado_semaforo, dias_restantes")
    .ilike("numero_contenedor", `%${term}%`)
    .order("dias_restantes", { ascending: true, nullsFirst: false })
    .limit(LIMIT_POR_FUENTE);
  if (error) return [];
  return (data as unknown as ImpoAbiertaRow[]).map((r) => ({
    id: `impo-abierta-${r.operacion_impo_id}`,
    group: "Impo · abiertas",
    numeroContenedor: r.numero_contenedor,
    meta: [r.naviera, r.planta, SEMAFORO_LABEL[r.estado_semaforo]].filter((v): v is string => Boolean(v)).join(" · "),
    semaforo: r.estado_semaforo,
    // sin ficha individual de importación en v1 (ver /alertas: mismo criterio) — la
    // fila lleva al módulo, no a una ficha que no existe.
    href: "/importacion",
  }));
}

/**
 * Datasource inyectado en `<CommandPalette search={buscarContenedoresGlobal} />`
 * (shell.tsx). Busca por número de contenedor (ilike, case/espacios/guiones
 * normalizados) en las 3 fuentes de arriba, en paralelo, con tope de 10 resultados
 * por fuente. NUNCA lanza: cada fuente resuelve `[]` si falla — command-palette.tsx
 * ya envuelve esto en try/catch, pero acá no hace falta llegar a esa rama.
 */
export async function buscarContenedoresGlobal(termCrudo: string): Promise<PaletteResult[]> {
  // mismo saneo que /contenedores (sane): la palette solo despoja comas/paréntesis
  // antes de llamar acá, así que se repite el resto del set problemático + la
  // normalización ISO 6346 (mayúsculas, sin espacios/guiones) para que "msku 123"
  // matchee "MSKU0001234".
  const term = normalizarNumero(termCrudo.trim().replace(/[,()"'\\*]/g, ""));
  if (term.length < MIN_QUERY_LEN) return [];

  const [expoAbiertas, expoCerradas, impoAbiertas] = await Promise.all([
    buscarExpoAbiertas(term).catch(() => []),
    buscarExpoCerradas(term).catch(() => []),
    buscarImpoAbiertas(term).catch(() => []),
  ]);

  return [...expoAbiertas, ...expoCerradas, ...impoAbiertas];
}
