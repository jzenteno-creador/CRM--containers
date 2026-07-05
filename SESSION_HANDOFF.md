# SESSION_HANDOFF — CRM Detention de Contenedores

**Fecha:** 2026-07-05 (sesión 7: Fase 2 APPLY — money-path aplicado + frontend/UX)
**Rama:** `feat/fase2-apply` (desde `feat/fase2-etapa0`) · SIN mergear a master.
**Handoff previo (auditoría + Etapa 0 + diseño money-path):** en git history de este archivo.

---

## Estado actual

**Rama `feat/fase2-apply`: 18 commits nuevos vs master**, build de Next VERDE (`npm run build` OK, 13 rutas), typecheck limpio, dev server corriendo en `localhost:3000`. **Nada mergeado a master.**

### Backend / money-path (aplicado a la DB de prod + `db/schema/` sincronizado)
Cada cambio de SQL se auto-verificó en `BEGIN…ROLLBACK` contra datos reales ANTES de aplicar. D-01 pasó además verificación adversarial (sesión previa).
- `f9b7ce3` **D-01 + D-10**: `crm_nueva_version_freetime` scopea el cierre por naviera+régimen, parametriza `p_regimen`, valida entradas/fecha, idempotente + índice único parcial `ux_freetime_vigente`. Front (admin) pasa el régimen.
- `2fa8b24` **D-04**: `crm_confirmar_ingreso_planta` con `IF FOUND` (no más eventos duplicados por carrera).
- `e4a02a9` **D-05**: 3 CHECKs de coherencia fecha/estado en `operaciones`.
- `5397897` **F-02 + FE-01**: RPC `crm_reabrir_operacion` (reversa contable, sup+) + `ConfirmDialog` reutilizable; el anular ahora confirma.
- `39c902d` **F-03**: RPC `crm_corregir_operacion` (edición auditada, sup+) + panel en la ficha.
- `6e910a2` **BE-03**: RPC `crm_registrar_incidencia` atómica + **backfill de 13 eventos** de timeline faltantes (additive, verificado).

### Frontend / UX (solo código, en branch)
- `10f8127` **F-01**: helper `descargarCSV` (BOM UTF-8).
- `caa8a3a` **egreso**: FE-01 (confirmación de lote), FE-02 (selección cross-página), FE-03 (scope planta fase 2), FE-06 (debounce realtime).
- `494e761` **ingreso**: FE-09 (fail-visible prefijos DOW), F-12 (planta fija operador), FE-03 (scope fase 2), FE-06.
- `caa6b86` **contenedores**: FE-04 (orden por columna), FE-09 (fail-visible freetime), FE-06.
- `8c8c5de` **historial**: F-09 (totales del filtro, suma client-side), F-01 (export CSV), FE-04 (orden).
- `40a387c` **alertas**: FE-04 (orden client-side), F-01 (export CSV), FE-06.
- `f0ab62e` **inicio**: FE-07 (label umbral configurable), FE-06.
- `82a0e89` **FE-05**: command palette ⌘K busca también cerradas.

---

## Excluido a propósito (NO se tocó)
- **Parte B (restore de datos ZIM):** NO ejecutada — mutación irreversible, backup aún no activo, espera confirmación de rama A/B. SQL listo en `docs/plans/moneypath-plan-20260705.md`.
- **F-06 (brecha 2,4x) y día-1/día-0 (NT-1):** diferidos (Excel = fuente de verdad).
- **Los 5 NO-TOCAR** del audit: intactos.
- **BE-01 (auth server-side), D-07, D-06/D-09/BE-04, F-08, D-08:** no en el scope de este run (ver plan money-path para su diseño).

---

## Caveats a smoke-testear (los propios agents los marcaron)
1. **contenedores — orden por naviera/planta:** usa `referencedTable` sobre embeds que NO son `!inner`; puede que no reordene las filas padre. Verificar en pantalla; si no ordena, marcar esos embeds `!inner` (ojo nullability). El orden por estado/retiro/contenedor sí es seguro.
2. **command palette — cerradas sin scope de planta:** `vista_costos_cerrados` no expone `planta_actual`, así que un operador ve cerradas de todas las plantas al buscar. Aceptable o requiere cambio de DB.
3. **Verificación visual pendiente:** no se abrió browser (el dev pega contra prod — BE-02). Mirar: modales de confirmación en egreso, botones reabrir/corregir en la ficha, export CSV (sup+), headers ordenables, pill de planta en ingreso.

---

## Lo que le toca a John
1. **Smoke test visual** de los puntos de arriba (app corriendo en `localhost:3000`; para levantarla: `cd crm-detention && npm run dev`).
2. **Setear secret `SUPABASE_DB_URL`** (repo → Settings → Secrets → Actions) para activar el backup — precondición de la Parte B.
3. **Confirmar rama A/B de la Parte B** (¿`sin_uso` 0d@$84 de ZIM es legítima?) para el restore de datos.
4. **Mergear/deployar** `feat/fase2-apply` cuando el smoke test cierre (esto también deploya el login sin credenciales demo).
5. **Working tree sin commitear:** `SESSION_HANDOFF.md`, `docs/audit/`, `docs/plans/` (decidir si versionarlos).

---

## Money-path — referencia rápida
- Estado ZIM en prod SIGUE corrupto (`vacios 0d@$84` espuria vigente) — la Parte B lo arregla, no se corrió. Cero daño vivo (0 ops ZIM abiertas).
- Todas las RPCs nuevas/cambiadas están versionadas en `db/schema/05_functions.sql`; índices en `03_indexes.sql`; CHECKs y CHECK de tipo_evento en `02_tables.sql`.
- Los 5 NO-TOCAR: trío RPC+`ux_operacion_abierta`+día-1 · búsqueda dual-query de Contenedores · advisors de índices · CRUD de plantas · clases globales de `globals.css`.
