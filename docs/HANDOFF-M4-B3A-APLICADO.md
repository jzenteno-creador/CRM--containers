# HANDOFF · M4 B3-A APLICADO (reset + depósitos + deploy) · 2026-07-13

> **Todo aplicado y verificado en prod. DB en cero. El smoke visual es tuyo.**

## HECHO (orden estricto: reset → depósitos → deploy)

### 1 · RESET (022) — APLICADO
- `apply_migration` OK. `modo_demo` prendido, `crm_reset_demo('RESET DEMO')` corrido,
  `modo_demo` apagado — **todo en una sola transacción** (el flag nunca quedó committeado
  en `true`; ventana armada = cero).
- **Borró:** 8 operaciones · 8 contenedores · 8 movimientos · 22 eventos · 1 waiver.
- **Verificado committeado:** operativo en cero (operaciones/contenedores/movimientos/
  eventos/waivers/incidencias = 0); **semillas intactas** (navieras 14, freetime_origin 14,
  plantas 2, ayuda_contenido 12, usuarios 1); **`modo_demo` = false**; **0 huérfanos** en
  auth.users (total 1 = el admin); auditoría en `configuracion.ultimo_reset_demo`.

### 2 · DEPÓSITOS (023) — APLICADO
- `apply_migration` OK (con el fix `extensions.similarity` que cazó el gate).
- **10 depósitos** sembrados: Defibe, Exolgan, Gamma, Gamma Logística, Gamma Mujica,
  Hiperbaires, Huxley, PTN, Terminal 4, TRP.
- FK `operaciones.retiro_de_id` operativa. Backfill sobre **0 filas** (DB en cero
  post-reset — sin filas que mapear, sin rarezas: confirmado).
- **Fuzzy en vivo:** `crm_depositos_similares('EXOLGAN SA')` → **Exolgan (0.727)** ·
  `('GAMA')` → Gamma. `extensions.similarity` funciona en prod.
- **Gamma×3 sigue SIN fusionar** — tu decisión, la tomás desde Admin → Depósitos → Fusionar.

### 3 · DEPLOY — HECHO
- `npx vercel deploy --prod --yes` → READY, crm-detention.vercel.app 200. Front con
  ComboboxCreatable + CRUD de depósitos + UI de waivers, todo en producción.

## SMOKE PREP — listo para probar en /ingreso (lo hacés vos)
- El combobox de depósitos filtra al tipear (10 opciones activas cargadas).
- Tipear un depósito nuevo ofrece "Crear «X»" con el pre-check de similares
  (probá "EXOLGAN SA" → te va a ofrecer usar Exolgan).
- Admin → Depósitos: renombrar, desactivar/reactivar, y **fusionar los Gamma** cuando decidas.
- La DB está en cero: la primera tanda real la cargás vos, ya con el catálogo de depósitos.

## ESTADO
- Migraciones en prod: 001-023 (021 waiver acumulativo, 022 reset, 023 depósitos).
- HEAD `0959731` pusheado + este run aplicó DDL (022/023 ya commiteadas antes).
- Prod PG 17.6. DB operativa en cero, semillas completas, 1 usuario (admin).

## RECORDATORIOS
- ⚠️ **MOTOR↔NAVIERA sigue abierto** — falta la liquidación real de una naviera.
- **Sandbox `gate-019-sandbox` (`gnygffoynwtxpkehmxal`)**: borralo del Dashboard si vive.
- **Bloque 4 / próximos:** Ayuda + tooltips (F3 — seeds verificados, ninguno dice "día 0",
  migración casi as-is + /ayuda + editor Admin + FieldHelp) · ERD (falta tu referencia
  visual) · reporting a Excel · combobox tipeable en el resto de los selects (el
  `<ComboboxCreatable>` ya es la base) · sidebar persistente.
