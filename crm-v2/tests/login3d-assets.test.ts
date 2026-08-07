// Guardia de regresión del port 3D: si alguien regenera texturas en ~/work/crm-3d y
// copia mal, esto lo agarra antes que el browser (un 404 de textura no rompe la carga:
// el gate de reveal sale por timeout y el contenedor aparece incompleto, silencioso).
import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "public", "3d");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("assets 3D del login", () => {
  it("las 8 texturas definitorias (TEX_QUE_DEFINEN del gate) existen", () => {
    const files = walk(ROOT).map((p) => p.replace(ROOT, ""));
    for (const name of [
      "side-wall-right_albedo_ssb",
      "side-wall-left_albedo_ssb",
      "door-leaf-right_albedo_ssb",
      "door-leaf-left_albedo_ssb",
      "paint-body-navy_albedo_brand",
      "decal-white_albedo_brand",
      "paint-accent-orange_albedo_brand",
      "csc-plate",
    ]) {
      expect(files.some((f) => f.includes(name) && f.endsWith(".webp")), name).toBe(true);
    }
  });

  it("todo es webp (nada de png a medio convertir)", () => {
    const rest = walk(ROOT).filter((f) => !f.endsWith(".webp"));
    expect(rest).toEqual([]);
  });
});
