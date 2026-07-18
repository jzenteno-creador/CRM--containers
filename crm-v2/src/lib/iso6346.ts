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

/** Dígito verificador de una base de 10 caracteres (4 letras + 6 dígitos): suma
 * ponderada 2^posición módulo 11, el resto 10 vale 0. Null si el formato no da. */
export function calcularDigito(base10: string): number | null {
  if (!/^[A-Z]{4}\d{6}$/.test(base10)) return null;
  let total = 0;
  for (let i = 0; i < 10; i++) {
    const ch = base10[i];
    const val = /[A-Z]/.test(ch) ? LETTER_VALUES[ch] : parseInt(ch, 10);
    total += val * Math.pow(2, i);
  }
  return (total % 11) % 10;
}

/** Valida formato + dígito verificador ISO 6346. Devuelve null si es válido, o el motivo. */
export function validarISO6346(raw: string): string | null {
  const num = normalizarNumero(raw);
  if (!/^[A-Z]{4}\d{7}$/.test(num)) {
    return "formato inválido (esperado: 4 letras + 7 dígitos)";
  }
  const calc = calcularDigito(num.slice(0, 10));
  const verificador = parseInt(num[10], 10);
  if (calc !== verificador) {
    return `dígito verificador incorrecto (esperado ${calc})`;
  }
  return null;
}

export interface ParsedContainer {
  numero: string;
  error: string | null;
}

// ---- Extracción de sigla desde ruido OCR (PoC escaneo, 2026-07-18) ----
// EasyOCR devuelve TODO el texto del contenedor (medidas, tara, marca…), a veces con
// la sigla partida en 2-3 fragmentos ("TCNU" / "132918" / "8"). Acá se pesca la sigla
// y se valida. Regla de producto (John): si el dígito leído no coincide con el
// calculado, la lectura se marca "revisar" — NUNCA se descarta ni se da por buena.
// Caso real que motiva esto: un "8" final leído como "1B".

export type SiglaExtraida = {
  /** Sigla reconstruida de 11 posiciones; la 11ª es "?" si el OCR no dio un dígito. */
  sigla: string;
  /** Base de 10 (dueño + categoría U/J/Z + serie). */
  base: string;
  /** Carácter leído en la posición del verificador ("?" si no hubo dígito legible). */
  digitoLeido: string;
  /** Dígito que corresponde por módulo 11. */
  digitoCalculado: number;
  /** true SOLO si leído === calculado. Mismatch o "?" ⇒ false (revisar). */
  valido: boolean;
};

/** Busca la sigla en textos candidatos (recognized_text completo, joins de fragmentos
 * en distinto orden…). Cada candidato se compacta a A-Z0-9 (el OCR mete espacios en el
 * medio) y se barre con regex 3 letras + [UJZ] + 6 dígitos + un carácter siguiente
 * (dígito legible, o basura tipo "1B" ⇒ "?"). La 4ª letra se limita a U/J/Z (ISO 6346)
 * para no pescar palabras sueltas del resto del texto. Prioridad: primera coincidencia
 * VÁLIDA; si no hay ninguna, la primera a secas (queda marcada para revisar). */
export function extraerSigla(candidatos: string[]): SiglaExtraida | null {
  let primera: SiglaExtraida | null = null;
  const vistos = new Set<string>();

  for (const crudo of candidatos) {
    if (!crudo) continue;
    const texto = crudo.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const re = /([A-Z]{3}[UJZ])(\d{6})(.?)/g;
    for (let m = re.exec(texto); m !== null; m = re.exec(texto)) {
      const base = m[1] + m[2];
      const digitoLeido = m[3] && /\d/.test(m[3]) ? m[3] : "?";
      const digitoCalculado = calcularDigito(base);
      if (digitoCalculado === null) continue;
      const sigla = base + digitoLeido;
      if (vistos.has(sigla)) continue;
      vistos.add(sigla);
      const cand: SiglaExtraida = {
        sigla,
        base,
        digitoLeido,
        digitoCalculado,
        valido: digitoLeido === String(digitoCalculado),
      };
      if (cand.valido) return cand;
      primera = primera ?? cand;
    }
  }
  return primera;
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
