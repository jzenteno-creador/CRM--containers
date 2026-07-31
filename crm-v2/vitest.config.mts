import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Config mínima: solo lo que los tests de tests/ necesitan.
// Alias "@/*" espeja tsconfig.json (paths) — sin esto, cualquier test que
// importe vía "@/lib/..." resuelve distinto que el resto de la app.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
