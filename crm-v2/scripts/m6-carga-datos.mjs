#!/usr/bin/env node
// M6-data (2026-07-18): parser de carga de datos reales Dow-SSB a crm.* — genera los
// artefactos SQL que el orquestador ejecuta vía MCP (GATE #2 aprobado por John:
// staging + execute_sql como postgres, transaccional con asserts).
//
// NO toca la base: solo lee los Excel y escribe SQL + reportes en --out.
// Reglas sancionadas (GO John 2026-07-18, 7 decisiones): ver docs del plan M6-data.
//
// Uso: node scripts/m6-carga-datos.mjs --out /path/salida
//   [--control "../CONTROL DE VACIOS DOW-SSB 2025-2026 real.xlsx"]
//   [--costos "../COSTOS POR DETENTION SEMANAL 2024-2025-2026 - REPORTE.xlsx"]

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

// ---------- args ----------
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const OUT = args.out;
if (!OUT) {
  console.error("Falta --out <dir>");
  process.exit(1);
}
const CONTROL = args.control ?? "../CONTROL DE VACIOS DOW-SSB 2025-2026 real.xlsx";
const COSTOS = args.costos ?? "../COSTOS POR DETENTION SEMANAL 2024-2025-2026 - REPORTE.xlsx";

// ---------- constantes sancionadas ----------
const CORTE = "2026-07-18"; // devolución < CORTE ⇒ cerrada; ≥ o vacía ⇒ activa (regla §2)
const ESPERADO_TOTAL = 2959;
const ESPERADO_2025 = 1728;
const ESPERADO_2026 = 1231;
const ESPERADO_ACTIVAS = 37;
const CHUNK = 150;

// Excel → nombre exacto en crm.navieras (sin match ⇒ ABORT)
const NAVIERA_MAP = {
  MAERSK: "MAERSK",
  "CMA/MERCOSUL LINE": "CMA CGM",
  HAPAG: "HAPAG LLOYD",
  ZIM: "ZIM LINES",
};
// catálogo crm.depositos (verificado live) para resolver retiro_de_id por lower()
const DEPOSITOS_CATALOGO = [
  "Defibe", "Exolgan", "Gamma", "Gamma Logística", "Gamma Mujica",
  "Hiperbaires", "Huxley", "PTN", "Terminal 4", "TRP",
];
// matching sin acentos/case: "GAMMA LOGISTICA" (Excel) → "Gamma Logística" (catálogo)
const norm = (s) =>
  String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
const DEPOSITO_POR_NORM = new Map(DEPOSITOS_CATALOGO.map((d) => [norm(d), d]));

// ---------- helpers ----------
/** Serial Excel → 'YYYY-MM-DD' (SSF, sin pasar por Date: cero corrimientos de TZ). */
function serialADate(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  // por si alguna celda vino como texto dd/mm/yyyy
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
const sqlStr = (v) =>
  v === null || v === undefined || String(v).trim() === ""
    ? "null"
    : `'${String(v).trim().replace(/'/g, "''")}'`;
const limpio = (v) => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s === "" || s === "-" ? null : s;
};

// ---------- Fuente 1: HISTORIAL ----------
const wb = XLSX.readFile(CONTROL, { cellDates: false });
const filas = XLSX.utils.sheet_to_json(wb.Sheets["HISTORIAL,"], { defval: null });

const errores = [];
const advertencias = [];
const activas = [];
const depositosSinMatch = new Map();
const staging = [];
const numerosVistos = new Set();

filas.forEach((f, i) => {
  const filaN = i + 2; // 1-based + header, para reportar como en el Excel
  const numero = String(f["CONTENEDORES "] ?? "").trim().toUpperCase();
  if (!/^[A-Z]{4}[0-9]{7}$/.test(numero)) {
    errores.push(`fila ${filaN}: numero_contenedor inválido: "${numero}"`);
    return;
  }
  if (numerosVistos.has(numero)) {
    errores.push(`fila ${filaN}: contenedor repetido: ${numero}`);
    return;
  }
  numerosVistos.add(numero);

  const naviera = NAVIERA_MAP[String(f["NAVIERA"] ?? "").trim()];
  if (!naviera) {
    errores.push(`fila ${filaN}: naviera sin alias: "${f["NAVIERA"]}"`);
    return;
  }

  const plantaRaw = String(f["PLANTA"] ?? "").trim();
  let planta = plantaRaw;
  let obsExtra = null;
  if (plantaRaw === "BAHIA/ABBOTT") {
    planta = "BAHIA"; // decisión 1 del GO: BAHIA + observación
    obsExtra = "[Excel: BAHIA/ABBOTT]";
  }
  if (planta !== "BAHIA" && planta !== "ABBOTT") {
    errores.push(`fila ${filaN}: planta desconocida: "${plantaRaw}"`);
    return;
  }

  const tipo = String(f["TIPO"] ?? "").trim();
  if (!["20DC", "40DC", "40HC"].includes(tipo)) {
    errores.push(`fila ${filaN}: tipo inválido: "${tipo}"`);
    return;
  }
  const reforzado =
    String(f["REFORZADO"] ?? "").trim() === "REFORZADO"
      ? "confirmado_reforzado"
      : "confirmado_no_reforzado";

  const retiroDe = limpio(f["RETIRO DE "]);
  if (!retiroDe) {
    errores.push(`fila ${filaN}: RETIRO DE vacío`);
    return;
  }
  const depositoCatalogo = DEPOSITO_POR_NORM.get(norm(retiroDe)) ?? null;
  if (!depositoCatalogo) {
    depositosSinMatch.set(retiroDe, (depositosSinMatch.get(retiroDe) ?? 0) + 1);
  }

  const fechaRetiro = serialADate(f["FECHA DE RETIRO"]);
  if (!fechaRetiro) {
    errores.push(`fila ${filaN}: FECHA DE RETIRO ausente/ilegible: ${JSON.stringify(f["FECHA DE RETIRO"])}`);
    return;
  }
  // FECHA DE DEVOLUCION primaria; fallback DEVOLUCION DE VACIOS (plan §3)
  const fechaDev = serialADate(f["FECHA DE DEVOLUCION"]) ?? serialADate(f["DEVOLUCION DE VACIOS"]);
  if (fechaDev && fechaDev < fechaRetiro) {
    errores.push(`fila ${filaN}: devolución ${fechaDev} anterior al retiro ${fechaRetiro} (${numero})`);
    return;
  }

  const cargado = String(f["CARGADO"] ?? "").trim().toUpperCase() === "SI";
  const cerrada = fechaDev !== null && fechaDev < CORTE; // regla de corte §2
  const estado = cerrada ? "cerrado" : cargado ? "en_transito_a_terminal" : "en_planta";
  const tipoCierre = cerrada ? (cargado ? "embarcado" : "devuelto_vacio") : "pendiente";
  // ACTIVAS ⇒ fecha_devolucion NULL (semántica v2: devolución seteada = gate-in que
  // corta freetime; cargar la fecha futura del Excel rompería el evento de cierre real
  // — P2 del review pre-ejecución). La fecha del Excel queda en el reporte para John.
  const fechaDevCarga = cerrada ? fechaDev : null;

  const anio = Number(fechaRetiro.slice(0, 4));
  if (!cerrada) {
    activas.push({
      fila: filaN, numero, naviera, fechaRetiro,
      fechaDev: fechaDev ?? "(sin fecha)",
      cargado: cargado ? "SI" : "NO", estado,
    });
    if (anio < 2026) advertencias.push(`fila ${filaN}: ACTIVA con retiro ${anio} (${numero}) — esperado solo 2026`);
  }

  const obs = [limpio(f["OBSERVACIONES"]), obsExtra].filter(Boolean).join(" ") || null;

  staging.push({
    fila: filaN, numero, naviera, planta, tipo, reforzado,
    retiroDe, depositoCatalogo,
    bookingRetiro: limpio(f["BOOKING DE RETIRO"]),
    bookingAsignado: limpio(f["BOOKING ASIGNADO"]),
    buque: limpio(f["BUQUE"]), destino: limpio(f["DESTINO"]),
    orden: limpio(f["ORDEN"]), shp: limpio(f["SHP"]),
    estado, tipoCierre,
    estadoCarga: cargado ? "lleno" : "vacio",
    fechaRetiro, fechaDev: fechaDevCarga, fechaDevExcel: fechaDev, obs, anio,
    // referencia del Excel (NO se carga — para spot-check del verifier):
    excel: {
      estadia: f["ESTADIA"], diasLibres: f["DIAS LIBRES "], demora: f["DEMORA"],
      valorUnit: f["VALOR UNIT"], costos: f[" COSTOS usd "],
    },
  });
});

// ---------- asserts del parser (§2 verificado por John) ----------
const cerradas = staging.filter((s) => s.estado === "cerrado");
const conteos = {
  total: staging.length,
  cerradas: cerradas.length,
  activas: activas.length,
  por_anio: {
    2025: staging.filter((s) => s.anio === 2025).length,
    2026: staging.filter((s) => s.anio === 2026).length,
    otros: staging.filter((s) => s.anio !== 2025 && s.anio !== 2026).length,
  },
};
if (conteos.total !== ESPERADO_TOTAL) errores.push(`total ${conteos.total} ≠ esperado ${ESPERADO_TOTAL}`);
if (conteos.activas !== ESPERADO_ACTIVAS) errores.push(`activas ${conteos.activas} ≠ esperado ${ESPERADO_ACTIVAS}`);
if (conteos.por_anio[2025] !== ESPERADO_2025) errores.push(`retiros 2025: ${conteos.por_anio[2025]} ≠ ${ESPERADO_2025}`);
if (conteos.por_anio[2026] !== ESPERADO_2026) errores.push(`retiros 2026: ${conteos.por_anio[2026]} ≠ ${ESPERADO_2026}`);
if (conteos.por_anio.otros > 0) errores.push(`hay ${conteos.por_anio.otros} retiros fuera de 2025/2026`);

// ---------- Fuente 2: resumen de costos (verificación + referencia 2024) ----------
// Bloques horizontales por naviera (header en fila 0), filas 1..12 = meses ene..dic.
// El AÑO sale del NOMBRE de la hoja (dato verificado: la hoja 2026 tiene los seriales
// internos mal tipeados como 2025 — error humano de Omar; las celdas NO son la verdad).
const wbC = XLSX.readFile(COSTOS, { cellDates: false });
const resumen = {};
const discrepanciasInternas = [];
for (const hoja of wbC.SheetNames) {
  const anio = (hoja.match(/(\d{4})\s*$/) ?? [])[1];
  if (!anio) continue;
  const grid = XLSX.utils.sheet_to_json(wbC.Sheets[hoja], { header: 1, defval: null });
  const header = grid[0] ?? [];
  const bloques = [];
  header.forEach((celda, col) => {
    const t = typeof celda === "string" ? celda.trim() : "";
    // solo headers de NAVIERA: excluye "Total", "W1..W4" y agregados tipo "GRAND TOTAL"
    if (t && t !== "Total" && !/^W\d$/.test(t) && !/total/i.test(t)) {
      bloques.push({ naviera: t, col });
    }
  });
  resumen[anio] = {};
  for (const b of bloques) {
    const meses = {};
    for (let m = 1; m <= 12; m++) {
      const rowIdx = m; // fila 1 = enero … fila 12 = diciembre (posicional; los seriales internos NO se usan)
      const row = grid[rowIdx] ?? [];
      const total = Number(row[b.col + 5] ?? 0) || 0;
      const ws = [1, 2, 3, 4].map((w) => Number(row[b.col + w] ?? 0) || 0);
      const sumaW = ws.reduce((a, x) => a + x, 0);
      if (Math.abs(sumaW - total) > 0.01) {
        discrepanciasInternas.push(`${hoja} · ${b.naviera} · mes ${m}: W1-4 suman ${sumaW} pero Total=${total} (se usa Total)`);
      }
      meses[m] = total;
    }
    resumen[anio][b.naviera] = { meses, total_anual: Object.values(meses).reduce((a, x) => a + x, 0) };
  }
}
const referencia2024 = Object.values(resumen["2024"] ?? {}).reduce((a, b) => a + b.total_anual, 0);

// ---------- salida ----------
if (errores.length > 0) {
  console.error(`ABORT — ${errores.length} errores de validación:`);
  errores.slice(0, 30).forEach((e) => console.error("  · " + e));
  if (errores.length > 30) console.error(`  … y ${errores.length - 30} más`);
  process.exit(1);
}

fs.mkdirSync(path.join(OUT, "staging_chunks"), { recursive: true });

// 00-create.sql — staging transitoria SIN acceso de authenticated (lección grants fantasma)
fs.writeFileSync(
  path.join(OUT, "00-create.sql"),
  `-- M6 staging (transitoria — se dropea en 99-drop.sql)
drop table if exists crm.m6_staging;
create table crm.m6_staging (
  fila int primary key,
  numero text not null,
  naviera text not null,
  planta text not null,
  tipo text not null,
  reforzado text not null,
  retiro_de text not null,
  deposito_catalogo text,
  booking_retiro text, booking_asignado text,
  buque text, destino text, orden text, shp text,
  estado text not null, tipo_cierre text not null, estado_carga text not null,
  fecha_retiro date not null, fecha_devolucion date,
  observaciones text
);
revoke all on crm.m6_staging from authenticated, anon, public;
`,
);

// chunks de INSERT
const cols =
  "(fila, numero, naviera, planta, tipo, reforzado, retiro_de, deposito_catalogo, booking_retiro, booking_asignado, buque, destino, orden, shp, estado, tipo_cierre, estado_carga, fecha_retiro, fecha_devolucion, observaciones)";
for (let i = 0; i < staging.length; i += CHUNK) {
  const vals = staging.slice(i, i + CHUNK).map((s) =>
    `(${s.fila},${sqlStr(s.numero)},${sqlStr(s.naviera)},${sqlStr(s.planta)},${sqlStr(s.tipo)},${sqlStr(s.reforzado)},${sqlStr(s.retiroDe)},${sqlStr(s.depositoCatalogo)},${sqlStr(s.bookingRetiro)},${sqlStr(s.bookingAsignado)},${sqlStr(s.buque)},${sqlStr(s.destino)},${sqlStr(s.orden)},${sqlStr(s.shp)},${sqlStr(s.estado)},${sqlStr(s.tipoCierre)},${sqlStr(s.estadoCarga)},'${s.fechaRetiro}',${s.fechaDev ? `'${s.fechaDev}'` : "null"},${sqlStr(s.obs)})`,
  );
  const n = String(Math.floor(i / CHUNK) + 1).padStart(3, "0");
  fs.writeFileSync(
    path.join(OUT, "staging_chunks", `${n}.sql`),
    `insert into crm.m6_staging ${cols} values\n${vals.join(",\n")}\non conflict (fila) do nothing;\n`,
  );
}

// 50-finalize.sql — pase transaccional con asserts (≠ esperado ⇒ EXCEPTION ⇒ rollback)
fs.writeFileSync(
  path.join(OUT, "50-finalize.sql"),
  `-- M6 finalize: staging → contenedores + operaciones. TODO o NADA.
begin;

do $$
declare v int;
begin
  select count(*) into v from crm.m6_staging;
  if v <> ${ESPERADO_TOTAL} then raise exception 'staging=% esperado ${ESPERADO_TOTAL}', v; end if;
  select count(*) into v from crm.operaciones;
  if v <> 0 then raise exception 'operaciones no está vacía (%) — wipe primero o carga ya corrida', v; end if;
  select count(*) into v from crm.contenedores;
  if v <> 0 then raise exception 'contenedores no está vacía (%) — wipe primero', v; end if;
  -- catálogos completos ANTES de insertar (un join que no matchea perdería filas en silencio)
  select count(*) into v from crm.m6_staging s where not exists (select 1 from crm.navieras n where n.nombre = s.naviera);
  if v <> 0 then raise exception '% filas de staging con naviera sin catálogo', v; end if;
  select count(*) into v from crm.m6_staging s where not exists (select 1 from crm.plantas p where p.nombre = s.planta);
  if v <> 0 then raise exception '% filas de staging con planta sin catálogo', v; end if;
end $$;

insert into crm.contenedores (numero_contenedor, naviera_id, tipo, reforzado_estado)
select s.numero, n.id, s.tipo, s.reforzado
from crm.m6_staging s
join crm.navieras n on n.nombre = s.naviera
on conflict (numero_contenedor) do nothing;

-- decisión 7 del GO (sin timeline para las históricas): sin esto, trg_op_evt_insert
-- crearía un evento 'retiro' por cada una de las ${ESPERADO_TOTAL} filas (P1 del review
-- pre-ejecución). Se re-habilita al final de la MISMA transacción.
alter table crm.operaciones disable trigger trg_op_evt_insert;

insert into crm.operaciones
  (contenedor_id, retiro_de, retiro_de_id, booking_retiro, booking_asignado,
   buque, destino, orden, shp, fecha_retiro, fecha_devolucion,
   estado, tipo_cierre, estado_carga, planta_actual_id, sin_cargo, observaciones)
select
  c.id, s.retiro_de, d.id, s.booking_retiro, s.booking_asignado,
  s.buque, s.destino, s.orden, s.shp,
  (s.fecha_retiro::timestamp at time zone 'America/Argentina/Buenos_Aires'),
  (s.fecha_devolucion::timestamp at time zone 'America/Argentina/Buenos_Aires'),
  s.estado, s.tipo_cierre, s.estado_carga, p.id, false, s.observaciones
from crm.m6_staging s
join crm.contenedores c on c.numero_contenedor = s.numero
join crm.plantas p on p.nombre = s.planta
left join crm.depositos d on lower(d.nombre) = lower(s.deposito_catalogo);

alter table crm.operaciones enable trigger trg_op_evt_insert;

do $$
declare v int;
begin
  select count(*) into v from crm.operaciones;
  if v <> ${ESPERADO_TOTAL} then raise exception 'operaciones=% esperado ${ESPERADO_TOTAL}', v; end if;
  select count(*) into v from crm.operaciones where estado = 'cerrado';
  if v <> ${ESPERADO_TOTAL - ESPERADO_ACTIVAS} then raise exception 'cerradas=% esperado ${ESPERADO_TOTAL - ESPERADO_ACTIVAS}', v; end if;
  select count(*) into v from crm.operaciones where estado <> 'cerrado';
  if v <> ${ESPERADO_ACTIVAS} then raise exception 'activas=% esperado ${ESPERADO_ACTIVAS}', v; end if;
  select count(*) into v from crm.operaciones
    where extract(year from fecha_retiro at time zone 'America/Argentina/Buenos_Aires') = 2025;
  if v <> ${ESPERADO_2025} then raise exception 'retiros 2025=% esperado ${ESPERADO_2025}', v; end if;
  select count(*) into v from crm.operaciones
    where extract(year from fecha_retiro at time zone 'America/Argentina/Buenos_Aires') = 2026;
  if v <> ${ESPERADO_2026} then raise exception 'retiros 2026=% esperado ${ESPERADO_2026}', v; end if;
  select count(*) into v from crm.contenedores;
  if v <> ${ESPERADO_TOTAL} then raise exception 'contenedores=% esperado ${ESPERADO_TOTAL} (0%% recirculación verificada)', v; end if;
  -- decisión 7: cero eventos de timeline para las históricas (P1 del review)
  select count(*) into v from crm.operacion_eventos;
  if v <> 0 then raise exception 'operacion_eventos=% esperado 0 (decisión 7 — trigger no deshabilitado?)', v; end if;
  -- depósitos: el catálogo hardcodeado del parser vs el catálogo VIVO (P2 del review):
  -- si difieren, el left join degrada en silencio — este assert lo caza
  select count(*) into v from crm.operaciones where retiro_de_id is null;
  if v <> ${[...depositosSinMatch.values()].reduce((a, b) => a + b, 0)} then
    raise exception 'retiro_de_id null=% esperado ${[...depositosSinMatch.values()].reduce((a, b) => a + b, 0)} (catálogo de depósitos cambió vs parser)', v;
  end if;
end $$;

commit;
`,
);

fs.writeFileSync(path.join(OUT, "99-drop.sql"), "drop table if exists crm.m6_staging;\n");

// reportes
const reporte = {
  generado: new Date().toISOString(),
  fuentes: { control: CONTROL, costos: COSTOS },
  conteos,
  corte: CORTE,
  activas_para_revision_john: activas,
  depositos_sin_match: Object.fromEntries(depositosSinMatch),
  advertencias,
  referencia_2024_usd: referencia2024,
  resumen_costos_excel: resumen,
  discrepancias_internas_fuente2: discrepanciasInternas,
};
fs.writeFileSync(path.join(OUT, "reporte-carga.json"), JSON.stringify(reporte, null, 2));
// filas con los valores del Excel que NO se cargan (spot-check del verifier)
fs.writeFileSync(
  path.join(OUT, "filas-excel.json"),
  JSON.stringify(staging.map((s) => ({ fila: s.fila, numero: s.numero, naviera: s.naviera, anio: s.anio, fechaRetiro: s.fechaRetiro, fechaDev: s.fechaDevExcel, estado: s.estado, ...s.excel })), null, 2),
);

console.log("OK — staging chunks:", Math.ceil(staging.length / CHUNK), "· filas:", staging.length);
console.log("conteos:", JSON.stringify(conteos));
console.log("activas:", activas.length, "· depositos sin match:", JSON.stringify([...depositosSinMatch.entries()]));
console.log("referencia 2024 USD:", referencia2024);
console.log("advertencias:", advertencias.length, "· discrepancias internas F2:", discrepanciasInternas.length);
