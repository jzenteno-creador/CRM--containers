import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Port 3D del login: módulos vanilla verificados en ~/work/crm-3d, se mueven, no se editan.
    "src/components/auth/container-model.js",
    "src/components/auth/container-scene.js",
  ]),
]);

export default eslintConfig;
