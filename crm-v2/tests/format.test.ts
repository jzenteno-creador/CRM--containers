import { describe, it, expect } from "vitest";
import { fmtFechaDia, fmtFecha, fmtFechaHora, fmtHora, fmtUSD, fmtUSDTarifa, fmtUSDCompact } from "@/lib/format";

// NOTA — helpers NO testeados acá porque dependen de now() sin inyección
// (Date actual de la máquina, no del argumento): hoyAR(), diasDesde(), y por
// transitividad diasEstadia() (llama a diasDesde() internamente). Testearlos
// sin mockear el reloj del sistema daría un test no determinista o falso-verde.
// Si se necesita cubrirlos, requiere vi.setSystemTime() — fuera de este pase.

// ─────────────────────────────────────────────────────────────────────────
// fmtFechaDia — LA lección del −1 día en Argentina.
// Columnas DATE ('YYYY-MM-DD' sin hora): pasar por `new Date("YYYY-MM-DD")`
// las interpreta como medianoche UTC, y en AR (UTC-3, sin DST) el
// toLocaleDateString con timeZone las corre un día para atrás. fmtFechaDia
// evita el problema DEL TODO: parsea el string a mano, nunca instancia Date.
// El test que importa es que el día NO se mueva, para ninguna fecha.
// ─────────────────────────────────────────────────────────────────────────

describe("fmtFechaDia — fecha plana YYYY-MM-DD, sin correrse un día", () => {
  it("no corre el día: 2026-01-01 sigue siendo 01, no 31/12", () => {
    expect(fmtFechaDia("2026-01-01")).toBe("01/01/26");
  });

  it("no corre el día en un mes cualquiera (2026-03-13)", () => {
    expect(fmtFechaDia("2026-03-13")).toBe("13/03/26");
  });

  it("no corre el día en el último día del año (2025-12-31)", () => {
    expect(fmtFechaDia("2025-12-31")).toBe("31/12/25");
  });

  it("no corre el día en un 29 de febrero de año bisiesto (2028-02-29)", () => {
    expect(fmtFechaDia("2028-02-29")).toBe("29/02/28");
  });

  it("año se recorta a 2 dígitos (slice(2))", () => {
    expect(fmtFechaDia("1999-07-04")).toBe("04/07/99");
  });

  it("null/undefined/'' devuelven el placeholder '—'", () => {
    expect(fmtFechaDia(null)).toBe("—");
    expect(fmtFechaDia(undefined)).toBe("—");
    expect(fmtFechaDia("")).toBe("—");
  });

  it("un string sin guiones (no da [y,m,d]) se devuelve tal cual (guard, no explota)", () => {
    expect(fmtFechaDia("notadate")).toBe("notadate");
    expect(fmtFechaDia("2026")).toBe("2026");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// fmtFecha / fmtFechaHora / fmtHora — timestamptz (con hora/offset) → AR.
// A diferencia de fmtFechaDia, estas SÍ pasan por Date porque el input trae
// hora real; son puras igual (dependen solo del argumento, no de now()).
// El caso interesante es el borde de medianoche AR (UTC-3): un ISO en UTC
// que cae en la medianoche AR debe mostrar el día AR, no el día UTC.
// ─────────────────────────────────────────────────────────────────────────

describe("fmtFecha — timestamptz → DD/MM/YY en zona AR", () => {
  it("02:00 UTC del 1/1 es 23:00 AR del 31/12 (un día antes) — respeta el borde de TZ", () => {
    expect(fmtFecha("2026-01-01T02:00:00Z")).toBe("31/12/25");
  });

  it("03:00 UTC del 1/1 es exactamente medianoche AR del 1/1", () => {
    expect(fmtFecha("2026-01-01T03:00:00Z")).toBe("01/01/26");
  });

  it("null/undefined devuelven '—'", () => {
    expect(fmtFecha(null)).toBe("—");
    expect(fmtFecha(undefined)).toBe("—");
  });
});

describe("fmtFechaHora — timestamptz → DD/MM/YY HH:mm en zona AR", () => {
  it("formatea fecha y hora juntas en AR", () => {
    // 2026-03-13T15:30:00Z → AR (UTC-3) = 12:30 del mismo día. El sufijo
    // a. m./p. m. exacto depende de los datos ICU del runtime (varía entre
    // versiones de Node) — se chequea el prefijo estable, no el string completo.
    expect(fmtFechaHora("2026-03-13T15:30:00Z")).toContain("13/03/26, 12:30");
  });

  it("null/undefined devuelven '—'", () => {
    expect(fmtFechaHora(null)).toBe("—");
    expect(fmtFechaHora(undefined)).toBe("—");
  });
});

describe("fmtHora — solo HH:mm (h23), vacío en medianoche exacta AR", () => {
  it("medianoche exacta AR (03:00 UTC) da vacío, no '00:00'", () => {
    expect(fmtHora("2026-01-01T03:00:00Z")).toBe("");
  });

  it("un minuto después de medianoche AR ya muestra hora", () => {
    expect(fmtHora("2026-01-01T03:01:00Z")).toBe("00:01");
  });

  it("hora normal en formato h23 (tarde)", () => {
    // 22:45 UTC → AR (UTC-3) = 19:45
    expect(fmtHora("2026-03-13T22:45:00Z")).toBe("19:45");
  });

  it("null/undefined devuelven string vacío", () => {
    expect(fmtHora(null)).toBe("");
    expect(fmtHora(undefined)).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Formateo de números (USD)
// ─────────────────────────────────────────────────────────────────────────

describe("fmtUSD — redondeado, sin decimales", () => {
  it("redondea al entero más cercano", () => {
    expect(fmtUSD(2205)).toBe("USD 2.205");
    expect(fmtUSD(315.4)).toBe("USD 315");
    expect(fmtUSD(315.6)).toBe("USD 316");
  });

  it("null/undefined devuelven placeholder", () => {
    expect(fmtUSD(null)).toBe("USD —");
    expect(fmtUSD(undefined)).toBe("USD —");
  });

  it("cero se formatea como USD 0, no como placeholder", () => {
    expect(fmtUSD(0)).toBe("USD 0");
  });
});

describe("fmtUSDTarifa — exacto, sin redondear (enteros sin decimales, no-enteros con 2)", () => {
  it("entero sin decimales", () => {
    expect(fmtUSDTarifa(55)).toBe("USD 55");
  });

  it("no entero con 2 decimales", () => {
    expect(fmtUSDTarifa(55.5)).toBe("USD 55,50");
  });

  it("null/undefined devuelven placeholder", () => {
    expect(fmtUSDTarifa(null)).toBe("USD —");
    expect(fmtUSDTarifa(undefined)).toBe("USD —");
  });
});

describe("fmtUSDCompact — compacto para labels de charts (k / M)", () => {
  it("por debajo de 1000 usa fmtUSD sin compactar", () => {
    expect(fmtUSDCompact(875)).toBe("USD 875");
  });

  it("miles se compactan con sufijo k", () => {
    expect(fmtUSDCompact(7350)).toBe("USD 7,4 k");
  });

  it("millones se compactan con sufijo M", () => {
    expect(fmtUSDCompact(2_100_000)).toBe("USD 2,1 M");
  });

  it("null/undefined devuelven placeholder", () => {
    expect(fmtUSDCompact(null)).toBe("USD —");
    expect(fmtUSDCompact(undefined)).toBe("USD —");
  });

  it("negativos también compactan (abs para decidir la escala)", () => {
    expect(fmtUSDCompact(-7350)).toBe("USD -7,4 k");
  });
});
