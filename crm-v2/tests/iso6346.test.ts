import { describe, it, expect } from "vitest";
import {
  calcularDigito,
  normalizarNumero,
  validarISO6346,
  parsearListaContenedores,
} from "@/lib/iso6346";

// ─────────────────────────────────────────────────────────────────────────
// calcularDigito / validarISO6346 — dígito verificador ISO 6346
// ─────────────────────────────────────────────────────────────────────────

describe("calcularDigito / validarISO6346 — casos reales", () => {
  // CSQU3054383 es el ejemplo canónico de ISO 6346 (Wikipedia y la mayoría de
  // los validadores públicos lo usan como ground truth) — NO calculado por
  // nuestra propia implementación, sirve de ancla externa independiente.
  it("CSQU3054383 (ejemplo canónico ISO 6346) es válido, dígito 3", () => {
    expect(calcularDigito("CSQU305438")).toBe(3);
    expect(validarISO6346("CSQU3054383")).toBeNull();
  });

  // MSKU6543211 y TEMU1234565 fueron calculados A MANO siguiendo el algoritmo
  // documentado (suma ponderada 2^posición mod 11, letra→valor 10..38 saltando
  // 11/22/33), NO llamando a calcularDigito — evita que el test sea tautológico.
  it("MSKU6543211 (Maersk, dígito calculado a mano) es válido", () => {
    expect(calcularDigito("MSKU654321")).toBe(1);
    expect(validarISO6346("MSKU6543211")).toBeNull();
  });

  it("TEMU1234565 (dígito calculado a mano) es válido", () => {
    expect(calcularDigito("TEMU123456")).toBe(5);
    expect(validarISO6346("TEMU1234565")).toBeNull();
  });

  it("CSQU3054380 (dígito incorrecto, correcto es 3) se rechaza con el motivo esperado", () => {
    expect(validarISO6346("CSQU3054380")).toBe("dígito verificador incorrecto (esperado 3)");
  });

  it("MSKU6543210 (dígito incorrecto, correcto es 1) se rechaza", () => {
    expect(validarISO6346("MSKU6543210")).toBe("dígito verificador incorrecto (esperado 1)");
  });

  it("TEMU1234561 (dígito incorrecto, correcto es 5) se rechaza", () => {
    expect(validarISO6346("TEMU1234561")).toBe("dígito verificador incorrecto (esperado 5)");
  });

  it("formato inválido (longitud/forma) se rechaza antes de calcular el dígito", () => {
    expect(validarISO6346("MSKU65432")).toBe("formato inválido (esperado: 4 letras + 7 dígitos)");
    expect(validarISO6346("MSKU654321111")).toBe("formato inválido (esperado: 4 letras + 7 dígitos)");
    expect(validarISO6346("12KU6543211")).toBe("formato inválido (esperado: 4 letras + 7 dígitos)");
    expect(calcularDigito("MSKU65432")).toBeNull(); // base de 9 chars, no matchea /^[A-Z]{4}\d{6}$/
  });

  it("normaliza minúsculas y espacios/guiones antes de validar (mismo resultado que el número prolijo)", () => {
    expect(validarISO6346("msku 654321-1")).toBeNull();
    expect(validarISO6346("  csqu3054383  ")).toBeNull();
  });
});

describe("calcularDigito — la tabla ISO salta los múltiplos de 11 (11, 22, 33)", () => {
  // Cada caso aísla UNA letra en una posición de peso conocido, con el resto
  // en 'A' (valor 10) y dígitos en 0. El valor esperado se computa a mano
  // asumiendo el salto; si la tabla NO saltara el múltiplo, el resultado
  // sería otro dígito (documentado en el comentario de cada caso) — así el
  // test realmente falla si alguien "simplifica" la tabla a 10..35 sin saltos.

  it("A=10 en las 4 posiciones de letra (base AAAA000000) → dígito 7", () => {
    // suma = 10*(2^0+2^1+2^2+2^3) = 150 · 150 mod 11 = 7 · 7 mod 10 = 7
    expect(calcularDigito("AAAA000000")).toBe(7);
  });

  it("B=12 (salta 11): AAAA→BAAA en la posición de peso 2^0 → dígito 9, no 8", () => {
    // suma = 12*1 + 10*2 + 10*4 + 10*8 = 152 · 152 mod 11 = 9 · mod 10 = 9
    // si B valiera 11 (sin salto): suma=151 → 151 mod 11 = 8 → dígito 8 (distinto)
    expect(calcularDigito("BAAA000000")).toBe(9);
  });

  it("L=23 (salta 22): AALA en la posición de peso 2^1 → dígito 0, no 9", () => {
    // suma = 10*1 + 23*2 + 10*4 + 10*8 = 176 · 176 mod 11 = 0 · mod 10 = 0
    // si L valiera 22 (sin salto): suma=174 → 174 mod 11 = 9 → dígito 9 (distinto)
    expect(calcularDigito("ALAA000000")).toBe(0);
  });

  it("V=34 (salta 33): AAVA en la posición de peso 2^2 → dígito 4, no 0", () => {
    // suma = 10*1 + 10*2 + 34*4 + 10*8 = 246 · 246 mod 11 = 4 · mod 10 = 4
    // si V valiera 33 (sin salto): suma=242 → 242 mod 11 = 0 → dígito 0 (distinto)
    expect(calcularDigito("AAVA000000")).toBe(4);
  });
});

describe("calcularDigito — resto 10 se representa como dígito 0 (regla ISO)", () => {
  it("AAAA000006: (total mod 11) = 10 → dígito verificador 0, NUNCA '10'", () => {
    // suma = 150 (AAAA) + 6*2^9 (último dígito, peso 512) = 150 + 3072 = 3222
    // 3222 mod 11 = 10 (11*292=3212, resto 10) · (10) mod 10 = 0
    expect(calcularDigito("AAAA000006")).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// normalizarNumero
// ─────────────────────────────────────────────────────────────────────────

describe("normalizarNumero", () => {
  it("pasa a mayúsculas y quita espacios y guiones", () => {
    expect(normalizarNumero("msku 654321-1")).toBe("MSKU6543211");
    expect(normalizarNumero("  csqu-305438-3  ")).toBe("CSQU3054383");
  });

  it("es no-op sobre un número ya prolijo", () => {
    expect(normalizarNumero("CSQU3054383")).toBe("CSQU3054383");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// parsearListaContenedores — separadores \n , ; \t (regresión del fix de hoy)
// ─────────────────────────────────────────────────────────────────────────

describe("parsearListaContenedores", () => {
  it("parsea separado por saltos de línea", () => {
    const out = parsearListaContenedores("CSQU3054383\nMSKU6543211\nTEMU1234565");
    expect(out.map((c) => c.numero)).toEqual(["CSQU3054383", "MSKU6543211", "TEMU1234565"]);
    expect(out.every((c) => c.error === null)).toBe(true);
  });

  it("parsea separado por comas", () => {
    const out = parsearListaContenedores("CSQU3054383,MSKU6543211,TEMU1234565");
    expect(out.map((c) => c.numero)).toEqual(["CSQU3054383", "MSKU6543211", "TEMU1234565"]);
  });

  it("parsea separado por punto y coma", () => {
    const out = parsearListaContenedores("CSQU3054383;MSKU6543211;TEMU1234565");
    expect(out.map((c) => c.numero)).toEqual(["CSQU3054383", "MSKU6543211", "TEMU1234565"]);
  });

  it("REGRESIÓN (fix de hoy, P2): parsea separado por tabs — una fila de Excel pegada da N contenedores, no 1 inválido", () => {
    const filaExcel = "CSQU3054383\tMSKU6543211\tTEMU1234565";
    const out = parsearListaContenedores(filaExcel);
    expect(out).toHaveLength(3);
    expect(out.map((c) => c.numero)).toEqual(["CSQU3054383", "MSKU6543211", "TEMU1234565"]);
    expect(out.every((c) => c.error === null)).toBe(true);
    // antes del fix, el string completo (con tabs pegados) se trataba como UN
    // solo token y fallaba el formato — esto es exactamente lo que no debe volver a pasar.
    expect(out).not.toHaveLength(1);
  });

  it("mezcla de separadores (tab + coma + salto de línea + punto y coma) en el mismo texto", () => {
    const texto = "CSQU3054383\tMSKU6543211,TEMU1234565\n CSQU3054383;MSKU6543211";
    const out = parsearListaContenedores(texto);
    // CSQU3054383 y MSKU6543211 se repiten → dedup (Set por número normalizado)
    expect(out.map((c) => c.numero)).toEqual(["CSQU3054383", "MSKU6543211", "TEMU1234565"]);
    expect(out).toHaveLength(3);
  });

  it("tokens vacíos (separadores consecutivos, líneas en blanco) se descartan sin generar filas fantasma", () => {
    const out = parsearListaContenedores("CSQU3054383\n\n\n,,,;;;\t\tMSKU6543211\n   \n");
    expect(out.map((c) => c.numero)).toEqual(["CSQU3054383", "MSKU6543211"]);
  });

  it("minúsculas y espacios alrededor de cada token se normalizan igual que un token prolijo", () => {
    const out = parsearListaContenedores("  csqu3054383  \n msku 654321-1 ");
    expect(out.map((c) => c.numero)).toEqual(["CSQU3054383", "MSKU6543211"]);
    expect(out.every((c) => c.error === null)).toBe(true);
  });

  it("números inválidos quedan en la lista CON el motivo de error (no se descartan)", () => {
    const out = parsearListaContenedores("CSQU3054380\nMSKU6543211");
    expect(out).toHaveLength(2);
    expect(out[0].numero).toBe("CSQU3054380");
    expect(out[0].error).toBe("dígito verificador incorrecto (esperado 3)");
    expect(out[1].error).toBeNull();
  });

  it("string vacío o solo separadores da lista vacía", () => {
    expect(parsearListaContenedores("")).toEqual([]);
    expect(parsearListaContenedores("\n\n,,;;\t\t   ")).toEqual([]);
  });
});
