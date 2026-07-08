// Validación ISO 6346 (dígito verificador de contenedores) — portado de v1 (probado en prod)

const LETTER_VALUES: Record<string, number> = {};
"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((ch, i) => {
  // valores 10..38 salteando múltiplos de 11 (11, 22, 33)
  const vals = [10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34, 35, 36, 37, 38];
  LETTER_VALUES[ch] = vals[i];
});

export function normalizarNumero(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, "");
}

/** Valida formato + dígito verificador ISO 6346. Devuelve null si es válido, o el motivo. */
export function validarISO6346(raw: string): string | null {
  const num = normalizarNumero(raw);
  if (!/^[A-Z]{4}\d{7}$/.test(num)) {
    return "formato inválido (esperado: 4 letras + 7 dígitos)";
  }
  const cuerpo = num.slice(0, 10);
  const verificador = parseInt(num[10], 10);
  let total = 0;
  for (let i = 0; i < 10; i++) {
    const ch = cuerpo[i];
    const val = /[A-Z]/.test(ch) ? LETTER_VALUES[ch] : parseInt(ch, 10);
    total += val * Math.pow(2, i);
  }
  const calc = (total % 11) % 10;
  if (calc !== verificador) {
    return `dígito verificador incorrecto (esperado ${calc})`;
  }
  return null;
}

export interface ParsedContainer {
  numero: string;
  error: string | null;
}

/** Parsea una lista pegada (uno por línea, o separados por coma/espacio). */
export function parsearListaContenedores(texto: string): ParsedContainer[] {
  const vistos = new Set<string>();
  const out: ParsedContainer[] = [];
  for (const tok of texto.split(/[\n,;]+/)) {
    const raw = tok.trim();
    if (!raw) continue;
    const numero = normalizarNumero(raw);
    if (vistos.has(numero)) continue;
    vistos.add(numero);
    out.push({ numero, error: validarISO6346(numero) });
  }
  return out;
}
