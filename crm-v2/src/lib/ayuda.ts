// Interpolación del copy de ayuda (M4 B3-B). Único lugar donde se sustituyen los
// placeholders {{key}} — reusado por /ayuda, el panel "?" del shell y <FieldHelp>.
//
// Contrato migración 024: el copy trae marcas como {{umbral}} o {{retiro_frase}}, y la
// RPC crm.crm_ayuda_valores(p_naviera, p_regimen) devuelve un jsonb con las FRASES YA
// COMPUESTAS (el número sale de la DB, o degrada a una frase genérica sin naviera). El
// front NUNCA compone la frase ni hardcodea un número: solo cambia cada {{key}} por su
// string antes de renderizar el Markdown.

// Espejo del jsonb de crm.crm_ayuda_valores(uuid, text). Todos opcionales: sin naviera,
// los valores por-naviera vienen null y sus *_frase ya traen el texto genérico.
export type AyudaValores = {
  umbral?: number | null;
  convencion?: string | null;
  retiro_frase?: string | null;
  devolucion_frase?: string | null;
  dias_libres?: number | null;
  tarifa_usd_dia?: number | null;
  dias_libres_frase?: string | null;
  tarifa_frase?: string | null;
};

// {{ key }} — letras/números/guion bajo; tolera espacios internos.
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Reemplaza cada `{{key}}` de `md` por `valores[key]` (como string).
 * - key desconocida, o valor null/undefined → deja el placeholder LITERAL (no rompe el copy).
 * - `valores` null/undefined (024 sin aplicar o RPC caída) → devuelve el copy tal cual;
 *   el consumidor decide si igual lo muestra. Nunca lanza.
 */
export function interpolarAyuda(md: string, valores: AyudaValores | null | undefined): string {
  if (!valores) return md;
  const dict = valores as Record<string, unknown>;
  return md.replace(PLACEHOLDER_RE, (literal, key: string) => {
    const val = dict[key];
    if (val === null || val === undefined) return literal;
    return String(val);
  });
}
