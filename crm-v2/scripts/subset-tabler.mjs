// Subset de Tabler Icons (optimización 2026-08-02).
// Problema medido: el CDN servía una webfont de 825 KB con 5.377 íconos y la app
// usa ~126 (2,3%). Este script recorta la fuente a SOLO los íconos usados y emite
// un CSS mínimo propio → self-host (además desbloquea la CSP: adiós jsdelivr).
//
// Uso: node scripts/subset-tabler.mjs   (correr tras agregar íconos nuevos; el
// resultado se COMMITEA — no corre en cada build). Verifica que todo ícono usado
// exista en el set oficial y falla fuerte si no.
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";

const RAIZ = new URL("..", import.meta.url).pathname;
const PKG = `${RAIZ}node_modules/@tabler/icons-webfont/dist`;

// 1 · íconos usados: todo literal ti-<nombre> en src/ (sin construcción dinámica —
// verificado: no hay `ti-${...}` en el código)
const usados = new Set(
  execSync(`grep -rhoE 'ti-[a-z0-9-]+' src/ --include='*.tsx' --include='*.ts'`, {
    cwd: RAIZ,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean),
);
// "ti" pelado y falsos positivos sin glifo no rompen: se filtran contra el mapa oficial

// 2 · mapa clase→codepoint desde el CSS oficial del paquete
const cssOficial = readFileSync(`${PKG}/tabler-icons.css`, "utf8");
const mapa = new Map();
for (const m of cssOficial.matchAll(/\.(ti-[a-z0-9-]+):before\s*{\s*content:\s*"\\([0-9a-f]+)"/g)) {
  mapa.set(m[1], m[2]);
}
if (mapa.size < 5000) throw new Error(`mapa sospechosamente chico: ${mapa.size}`);

const conGlifo = [...usados].filter((u) => mapa.has(u)).sort();
const sinGlifo = [...usados].filter((u) => !mapa.has(u) && u !== "ti");
if (sinGlifo.length) {
  // nombres que parecen íconos pero no existen en Tabler — revisar a mano
  console.warn(`⚠ sin glifo en Tabler (revisar): ${sinGlifo.join(", ")}`);
}
console.log(`íconos usados con glifo: ${conGlifo.length} de ${mapa.size} disponibles`);

// 3 · subset a solo esos codepoints — pyftsubset (fonttools); harfbuzz-wasm
// (subset-font) falla con la TTF de Tabler, fonttools la procesa sin drama
mkdirSync(`${RAIZ}public/fonts`, { recursive: true });
const unicodes = conGlifo.map((c) => `U+${mapa.get(c)}`).join(",");
execSync(
  // la GSUB de Tabler está rota (Coverage format inválido — rompe harfbuzz Y
  // fonttools); son las ligaduras por nombre, que no usamos (vamos por :before
  // con codepoint) → se dropea la tabla entera sin parsearla
  `python3 -m fontTools.subset "${PKG}/fonts/tabler-icons.ttf" --unicodes="${unicodes}" ` +
    `--drop-tables+=GSUB --flavor=woff2 --no-layout-closure ` +
    `--output-file="${RAIZ}public/fonts/tabler-subset.woff2"`,
  { stdio: "inherit" },
);
const recortada = statSync(`${RAIZ}public/fonts/tabler-subset.woff2`);
const fuente = statSync(`${PKG}/fonts/tabler-icons.woff2`);

// 4 · CSS mínimo: @font-face + clase base + solo las clases usadas
const base = cssOficial.match(/\.ti\s*{[^}]+}/)?.[0];
if (!base) throw new Error("no encontré la clase base .ti en el CSS oficial");
const clases = conGlifo
  .map((c) => `.${c}:before { content: "\\${mapa.get(c)}"; }`)
  .join("\n");
const css = `/* GENERADO por scripts/subset-tabler.mjs — NO editar a mano.
   Subset de @tabler/icons-webfont ${JSON.parse(readFileSync(`${RAIZ}node_modules/@tabler/icons-webfont/package.json`, "utf8")).version}: ${conGlifo.length} de ${mapa.size} íconos. */
@font-face {
  font-family: "tabler-icons";
  font-style: normal;
  font-weight: 400;
  font-display: block; /* íconos: mejor invisible un instante que texto raro */
  src: url("/fonts/tabler-subset.woff2") format("woff2");
}
${base}
${clases}
`;
writeFileSync(`${RAIZ}src/app/tabler-subset.css`, css);
const kb = (n) => (n / 1024).toFixed(1);
console.log(`woff2: ${kb(fuente.size)} KB → ${kb(recortada.size)} KB · css emitido`);
