# HANDOFF · M4 Bloque 3-A (Depósitos + Reset demo) · 2026-07-13

> **Front de waivers DEPLOYADO. Depósitos (023) y reset (022) GATEADOS, esperando tu GO
> para aplicar.** Un solo ítem grande, como se pidió.

## HECHO

1. **DEPLOY del front** (UI de historial de waivers, `bb4ce2c`) → **en producción**
   (crm-detention.vercel.app, 200). Era el único paso con GO previo.
2. **Migración 023 — depósitos** (escrita, gateada, commiteada, **NO aplicada**):
   - `crm.depositos` sembrado del Excel: **12 valores crudos → 10 canónicos**. Fusiones
     confiables **reportadas**: `EXOLGAN`+`TERMINAL EXOLGAN`→Exolgan · `TERMINAL 4`+
     `TERMINAL 4/ABBOTT`→Terminal 4. **NO fusionados (tu decisión vía Admin):** Gamma,
     Gamma Logística, Gamma Mujica (posibles sucursales — no inventé).
   - `operaciones.retiro_de` → FK `retiro_de_id` (nullable), backfill best-effort con
     reporte (las filas de smoke/test no matchean y quedan NULL, no falla).
   - RPCs: `crm_crear_deposito` (operador+, alta inline), `crm_depositos_similares`
     (fuzzy trigram), `crm_fusionar_depositos` (admin, repunta por RPC — nunca UPDATE
     crudo), y `crm_crear_tanda_retiro` acepta `retiro_de_id` **retrocompatible**.
   - **UI:** `<ComboboxCreatable>` reutilizable (base del Bloque 4) + wire en Ingreso con
     creación inline y pre-check "¿quisiste decir Exolgan?" + CRUD Admin (renombrar/
     desactivar/reactivar/**fusionar**). Build + lint limpios. **Degrada solo** a Input de
     texto si la 023 no está aplicada (el front deployado NO se rompe).
3. **Migración 022 — reset demo** (escrita, gateada, **NO aplicada**): triple guard
   (admin activo + `modo_demo=true` + `p_confirmacion='RESET DEMO'` + env-var de render),
   solo `crm.*`, preserva semillas (incl. depósitos) + usuarios, sin huérfanos.

## GATES (VERIFIER independiente, harness local + read de prod)

- **023: FAIL → corregido → confirmado.** El verifier cazó un bug real: `similarity()`/`%`
  sin calificar bajo `search_path=''` con `pg_trgm` fuera de `pg_catalog` → el CREATE
  FUNCTION abortaba la migración entera. **Fix:** califiqué `extensions.similarity` /
  `operator(extensions.%)` (verifiqué en prod que `pg_trgm` vive en `extensions`, no en
  `public` como asumió el verifier — su fix también habría fallado). Confirmado con read
  en prod (`extensions.similarity('exolgan sa','Exolgan')`=0.727). Tests 1-6 de lógica:
  PASS (estructura, seed, fusión Exolgan, crear operador+, fuzzy, tanda retrocompatible).
  También endurecí el guard de rol NULL en `crm_crear_deposito` (robustez que marcó el gate).
- **022: PASS completo.** Los 3 guards rechazan; reset exitoso (en rollback) borra las 7
  tablas operativas y **preserva** navieras/freetime/plantas/depósitos/configuracion/
  ayuda/usuarios; auth.users sin cambio; scope solo-crm confirmado leyendo el cuerpo.

## DECISIÓN APLICADA (tuya)

`tipos_contenedor` y `medios` **quedan en código** (no se dropean los CHECKs de plata) —
documentado en `crm-v2/AGENTS.md` con tu razón. `depositos` agregado a la lista sancionada.

## PRÓXIMO PASO (tuyo)

1. **GO para aplicar 023** (depósitos) → `apply_migration`. Después, correr el backfill
   deja las filas de smoke/test en NULL (se limpian con el reset).
2. **GO para aplicar 022** (reset demo). Una vez aplicado, prendés `modo_demo=true` y
   corrés `crm_reset_demo('RESET DEMO')` para **dejar la DB en cero** (limpia las 5
   operaciones de tu smoke + los residuos de test). Acordate de apagar `modo_demo` después.
3. **GO para deployar** el front de depósitos (ComboboxCreatable + Admin) — ya commiteado
   y pusheado (`ed7824c`), sin deploy (cero deploy fuera del paso 1 ya hecho).
4. **Smoke visual** del combobox con creación inline + el CRUD de depósitos.
5. Confirmar/ajustar las fusiones de Gamma desde Admin → Depósitos → Fusionar.

## PRESUPUESTO — el patrón, otra vez

Verifier 139k + Constructor 221k = **360k** este run (un solo ítem grande). Auto-estimaron
mucho menos. **Confirma la conclusión: 1 ítem grande = 1 run, y aun así los agentes son
caros.** La UI de depósitos era pesada (componente reutilizable + 3 superficies).

## RECORDATORIOS

- ⚠️ **MOTOR↔NAVIERA sigue abierto** — falta la liquidación real de una naviera.
- **Bloque siguiente = Ayuda + tooltips** (F3): los 8 seeds ya verificados, ninguno dice
  "día 0"; migración de seeds aplicable casi as-is + /ayuda + editor Admin + FieldHelp.
- **Bloque 4** = ERD (falta tu referencia visual) + reporting Excel + combobox en el resto
  de los selects (el `<ComboboxCreatable>` ya es la base) + sidebar.
- **Sandbox `gate-019-sandbox` (`gnygffoynwtxpkehmxal`)**: borralo del Dashboard si vive.
- Prod: 5 en_planta de tu smoke + 3 anuladas de test + 1 waiver migrado de op anulada
  (invisible en views). El reset (022) los limpia todos cuando lo apliques.
