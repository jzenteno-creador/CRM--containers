import { describe, it, expect } from "vitest";
import golden from "./golden-costos.json";

// ─────────────────────────────────────────────────────────────────────────
// Oráculo de test para el motor de costos de detention.
//
// La FUENTE DE VERDAD sigue siendo la SQL (crm.dias_con_convencion /
// crm.vista_alertas / crm.vista_kpi_costos_cerradas, migración
// supabase/migrations/019_m4_b1_motor_waiver_fixes.sql). Lo de acá abajo es
// una reimplementación en TS, A PROPÓSITO, para poder correr los 43 casos
// del golden JSON sin levantar Postgres — si la SQL cambia, este oráculo
// hay que actualizarlo a mano, no al revés.
//
// dias_con_convencion(desde, hasta, convencion) — migración 019 líneas 68-77:
//   select ((hasta at time zone 'AR')::date - (desde at time zone 'AR')::date)
//        + case p_convencion when 'retiro_dia_1' then 1 else 0 end
// El golden JSON no trae columna de convención por caso — _meta.regla_validada
// confirma que los 43 casos usan la convención default ('retiro_dia_1',
// retiro = día 1), la misma que valida 2804/2804 filas del Excel histórico.
//
// Modelo de costos — _meta.modelo_costos del propio JSON (idéntico al CASE
// de las views, sección D de la migración 019):
//   bruto     = max(0, estadia - dias_libres) * tarifa
//   absorbido = min(waiver_dias ?? 0, exceso) * tarifa
//   neto      = bruto - absorbido
// ─────────────────────────────────────────────────────────────────────────

type Convencion = "retiro_dia_1" | "retiro_dia_0";

/** Oráculo de crm.dias_con_convencion() — ver comentario de cabecera. */
function diasConConvencion(
  fechaDesdeYmd: string,
  fechaHastaYmd: string,
  convencion: Convencion = "retiro_dia_1",
): number {
  const [ay, am, ad] = fechaDesdeYmd.split("-").map(Number);
  const [by, bm, bd] = fechaHastaYmd.split("-").map(Number);
  const desde = Date.UTC(ay, am - 1, ad);
  const hasta = Date.UTC(by, bm - 1, bd);
  const diffDias = Math.round((hasta - desde) / 86_400_000);
  return diffDias + (convencion === "retiro_dia_1" ? 1 : 0);
}

interface CasoGolden {
  caso_id: string;
  categoria: string;
  contenedor: string;
  tarifa_historica: { dias_libres: number; tarifa_usd_dia: number };
  fecha_retiro: string;
  fecha_devolucion: string;
  estadia_esperada: number;
  exceso_esperado: number;
  waiver_dias: number | null;
  costo_bruto_esperado: number;
  costo_absorbido_esperado: number;
  costo_neto_esperado: number;
  costo_excel: number;
}

interface CostoOracle {
  estadia: number;
  exceso: number;
  bruto: number;
  absorbido: number;
  neto: number;
}

/** Oráculo del CASE de costo_bruto/absorbido/neto — ver comentario de cabecera. */
function calcularCosto(caso: CasoGolden): CostoOracle {
  const { dias_libres, tarifa_usd_dia } = caso.tarifa_historica;
  const estadia = diasConConvencion(caso.fecha_retiro, caso.fecha_devolucion);
  const exceso = Math.max(0, estadia - dias_libres);
  const bruto = exceso * tarifa_usd_dia;
  const absorbido = Math.min(caso.waiver_dias ?? 0, exceso) * tarifa_usd_dia;
  const neto = bruto - absorbido;
  return { estadia, exceso, bruto, absorbido, neto };
}

const casos = golden.casos as CasoGolden[];

describe("golden-costos.json — estructura", () => {
  it("trae 43 casos, cada uno con los campos que el oráculo necesita", () => {
    expect(casos).toHaveLength(43);
    for (const c of casos) {
      expect(typeof c.caso_id).toBe("string");
      expect(typeof c.fecha_retiro).toBe("string");
      expect(typeof c.fecha_devolucion).toBe("string");
      expect(typeof c.tarifa_historica.dias_libres).toBe("number");
      expect(typeof c.tarifa_historica.tarifa_usd_dia).toBe("number");
      expect(typeof c.estadia_esperada).toBe("number");
      expect(typeof c.exceso_esperado).toBe("number");
      expect(typeof c.costo_bruto_esperado).toBe("number");
      expect(typeof c.costo_absorbido_esperado).toBe("number");
      expect(typeof c.costo_neto_esperado).toBe("number");
    }
  });

  it("caso_id es único en las 43 filas", () => {
    const ids = new Set(casos.map((c) => c.caso_id));
    expect(ids.size).toBe(43);
  });

  it("categorías presentes: muestra, waiver-total, vto-extendido-costo-estandar, borde, dentro-freetime", () => {
    const categorias = new Set(casos.map((c) => c.categoria));
    expect(categorias).toEqual(
      new Set(["muestra", "waiver-total", "vto-extendido-costo-estandar", "borde", "dentro-freetime"]),
    );
  });
});

describe("golden-costos.json — oráculo TS vs. los 43 casos esperados", () => {
  it.each(casos.map((c) => [c.caso_id, c] as const))("%s", (_id, caso) => {
    const r = calcularCosto(caso);
    expect(r.estadia, "estadia").toBe(caso.estadia_esperada);
    expect(r.exceso, "exceso").toBe(caso.exceso_esperado);
    expect(r.bruto, "costo_bruto").toBeCloseTo(caso.costo_bruto_esperado, 6);
    expect(r.absorbido, "costo_absorbido").toBeCloseTo(caso.costo_absorbido_esperado, 6);
    expect(r.neto, "costo_neto").toBeCloseTo(caso.costo_neto_esperado, 6);
  });
});

describe("golden-costos.json — coherencia interna por categoría", () => {
  it("categoría 'waiver-total': el waiver cubre TODO el exceso → neto = 0 y absorbido = bruto", () => {
    const totales = casos.filter((c) => c.categoria === "waiver-total");
    expect(totales.length).toBeGreaterThan(0);
    for (const c of totales) {
      expect(c.waiver_dias, `${c.caso_id}: waiver_dias`).not.toBeNull();
      expect(c.waiver_dias, `${c.caso_id}: waiver cubre el exceso completo`).toBeGreaterThanOrEqual(
        c.exceso_esperado,
      );
      expect(c.costo_neto_esperado, `${c.caso_id}: neto 0`).toBe(0);
      expect(c.costo_absorbido_esperado, `${c.caso_id}: absorbido == bruto`).toBe(c.costo_bruto_esperado);
    }
  });

  it("categoría 'dentro-freetime': estadía no supera los días libres → exceso y neto en 0", () => {
    const dentro = casos.filter((c) => c.categoria === "dentro-freetime");
    expect(dentro.length).toBeGreaterThan(0);
    for (const c of dentro) {
      expect(c.estadia_esperada, c.caso_id).toBeLessThanOrEqual(c.tarifa_historica.dias_libres);
      expect(c.exceso_esperado, c.caso_id).toBe(0);
      expect(c.costo_neto_esperado, c.caso_id).toBe(0);
    }
  });

  it("sin waiver (waiver_dias null): costo_absorbido_esperado es siempre 0 y neto == bruto", () => {
    for (const c of casos.filter((c) => c.waiver_dias === null)) {
      expect(c.costo_absorbido_esperado, c.caso_id).toBe(0);
      expect(c.costo_neto_esperado, c.caso_id).toBe(c.costo_bruto_esperado);
    }
  });

  it("exceso_esperado == max(0, estadia_esperada - dias_libres) en las 43 filas", () => {
    for (const c of casos) {
      expect(c.exceso_esperado, c.caso_id).toBe(
        Math.max(0, c.estadia_esperada - c.tarifa_historica.dias_libres),
      );
    }
  });
});
