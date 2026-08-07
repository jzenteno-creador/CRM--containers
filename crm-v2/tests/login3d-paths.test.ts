// Los módulos 3D solo pueden referenciar texturas bajo /3d/ — una ruta relativa
// "assets/..." resolvería contra /login y daría 404 silencioso (gate por timeout,
// contenedor incompleto). El preview usaba <base href="/"> + rutas relativas; acá no.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(__dirname, "..", "src", "components", "auth");
const MODULES = ["container-model.js", "container-scene.js"].filter((f) =>
  existsSync(join(DIR, f)),
);

describe("rutas de texturas en los módulos 3D", () => {
  it.each(MODULES)("%s no referencia assets sin el prefijo /3d/", (file) => {
    const src = readFileSync(join(DIR, file), "utf8");
    // Solo miramos strings/templates que ARRANCAN el path (las rutas de filesystem
    // muertas en los campos `path` contienen /work/crm-3d/ y no matchean esto).
    const bad = src.match(/["'`](?:intake|assets)\//g) ?? [];
    expect(bad).toEqual([]);
  });

  it("container-model.js referencia /3d/", () => {
    const src = readFileSync(join(DIR, "container-model.js"), "utf8");
    expect(src.includes('"/3d/intake/')).toBe(true);
  });
});
