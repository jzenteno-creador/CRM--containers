# HANDOFF · M4 Bloque 1 (F0+F1, solo DDL) · 2026-07-12/13

> Estado final: **✅ 019 APLICADA A PRODUCCIÓN (2026-07-13, ledger `m4_019_b1_motor_waiver_fixes`)
> tras triple gate: cálculo (43/43) + no-regresión (0 diffs) + versión (limpia PG17.6).**
> Post-aplicación verificado con datos reales por RPC. Esperando smoke de John.
> **NO se arranca el Bloque 2 (front) sin su aprobación.**

## POST-APLICACIÓN (2026-07-13) — resultados

- **Sanity estructural 12/12**: views sin error · `dias_facturables` con firma correcta ·
  5 campos waiver · 14/14 tarifas `retiro_dia_1`+cobra sembradas · savepoints en la tanda ·
  CHECK viejo de plantas eliminado + `activa` presente · migración en el ledger + .sql en
  repo (md5 `cef0b335…`, sin drift ledger/repo).
- **Goldens con datos reales (por RPC, como usuario real):** tanda 3/3 con el contrato
  nuevo por-contenedor ✓ · cierre TEST0000001 (retiro 10-jun → devolución 10-jul):
  estadía **31** (inclusivo), bruto **595.00** = (31−14)×35, waiver parcial 5 días →
  absorbido **175.00**, neto **420.00** = realizado ✓ dígito por dígito contra la fórmula
  de los 43 goldens · abiertas: 33 días, rojo, −19 restantes, 665 = 19×35 ✓ ·
  campana `rojo: 2` ✓ · timeline: egreso → devolución (corta_freetime) → waiver con
  detalle completo ✓.
- **Limpieza (soft delete, cero DELETE):** 3 operaciones anuladas (2 por RPC; la cerrada
  por UPDATE equivalente porque `crm_anular_operacion` EXCLUYE cerradas — deuda F-02,
  ver HALLAZGOS), 3 eventos de anulación auditados. Estado final: 0 ops activas,
  vista_alertas 0, cerradas 0, KPIs en cero. Residuo declarado: 3 contenedores `TEST%`
  en el maestro (sin delete policy, por diseño) + 12 eventos de timeline.

## CAMINO DEL GATE (para el registro)

5 intentos: (1) org Free sin branching → John upgradeó a Pro · (2) branch murió en
MIGRATIONS_FAILED por drift AJENO (`002_multi_source_support`/`public.inbound_events` —
cross-handoff escrito para ssb-workspace; branching del proyecto compartido roto hasta
repararlo) · (3) STOP por budget (MCP duplica el SQL en contexto) · (4) sandbox sin
password accesible por API · (5) **PG local embebido (sin Docker, sin sudo, sin
credenciales): PASS** — replay 18/18 reproducible desde el repo, 0 diffs sobre 2.904
filas, waiver aislado. Auditoría de versión: prod PG 17.6, cero construcciones sensibles.

## HECHO

1. **`crm-v2/supabase/migrations/019_m4_b1_motor_waiver_fixes.sql`** (escrita, NO aplicada):
   - `convencion_conteo` + `cobra_detention_origen` **versionados** en `freetime_origin`
     (backfill desde navieras; la columna vieja queda deprecada por comment).
   - `dias_con_convencion()` (única definición del offset +1/+0) · `dias_facturables()`
     (resuelve convención vigente a la fecha de retiro) · `dias_estadia()` = wrapper deprecado.
   - **Waiver** (decisión 4): 5 campos con CHECK all-or-none · evento `waiver` auditable
     (en el trigger — único camino, cubre RPC y UPDATE directo) · RPC `crm_registrar_waiver`
     (supervisor+, DEFINER porque el caso real es op CERRADA, permite parcial) · guard
     extendido (operador no toca waiver por UPDATE directo).
   - **Views de plata**: `costo_bruto / costo_absorbido / costo_neto`;
     `costo_proyectado`/`costo_realizado` = NETO (compat exacta — sin waivers cargados,
     todo número existente queda idéntico; `sin_cargo` → 0 preservado, deprecado).
   - **H1 Opción B**: savepoint por contenedor, inserción PARCIAL, resultado por fila
     `{numero, estado, operacion_id, motivo, motivo_texto}` con texto accionable
     ("… ya tiene un ciclo abierto — escalá a tu supervisor").
   - **plantas**: DROP del CHECK `('BAHIA','ABBOTT')` (⚠️ una sola vía) + `activa`
     (baja lógica) + policies de escritura admin + grant insert/update (sin delete).
   - **get_pendientes**: CP1 — las alertas del operador incluyen ops en tránsito
     HACIA su planta.
   - `crm_nueva_version_freetime` extendida a 9 args (`p_convencion`/`p_cobra`
     DEFAULT NULL = herencia de la vigente; el call actual del front sigue andando).
2. **Goldens**: `crm-v2/tests/golden-costos.json` — 43 casos del Excel (30 muestra
   seed 42 + 7 waivers reales + 3 vto-extendido + bordes estadía 1/135 + dentro-freetime).
3. **Correcciones de verdad**: `spec.md:234` y `tanda-form.tsx:162` decían "día 0" —
   corregidos a día 1 inclusivo con la evidencia citada.

## DECISIONES (de John, aplicadas)

- Opción B para H1 (sin helper DEFINER) · plantas universo libre (validación en UI) ·
  waiver = 3 números bruto/absorbido/neto, parcial permitido, sup+, auditable ·
  badge campana solo rojos (front, bloque siguiente) · motor NO cambia aritmética.

## GATE DE CÁLCULO — PASS (VERIFIER independiente, Sonnet)

- Protocolo: 2 batches auto-contenidos `BEGIN → migración literal → seeds → asserts →
  RAISE` (rollback garantizado incluso en PASS). Probe previo de transaccionalidad: PASS.
- **43/43 goldens exactos** (días tolerancia 0, montos 0.01): 0 mismatches.
- H1: tanda limpia 2/0 · repetida 0/2 `ciclo_abierto` con texto accionable ·
  parcial 1 válido + 1 inválido = 1/1 (el válido ENTRA).
- Waiver parcial 3/6 días @ $35: neto 210.00 → 105.00 (Δ exacto) + evento + campos ·
  rechaza días ≤ 0 y motivo vacío.
- Plantas insert/update como admin: PASS · `get_pendientes` con vencida: rojo=1.
- Primitivas: retiro_dia_1 → 4 / mismo día = 1 · retiro_dia_0 → 3. Pre/post DDL idénticos.
- **No-persistencia verificada en calls independientes**: freetime 12 columnas,
  0 operaciones/contenedores, 14 navieras, CHECK de plantas intacto, 0 funciones nuevas.
- Nota para futuros re-runs del gate: baseline de views con DB vacía =
  `{resumen: 1, tendencia_mensual: 12, resto: 0}` (agregados por diseño de la 018).

## HALLAZGOS

- Reflexion del LEAD cazó 1 bug real pre-gate: `tipo`/`medio` inválidos en el header
  hubieran salido como "número inválido" por fila — ahora se validan en el header.
- El trigger `evt_operacion_update` ya auditaba `sin_cargo`; el waiver sigue el mismo
  patrón (un solo camino de auditoría).
- **`crm_anular_operacion` excluye cerradas** (confirmado en prod durante la limpieza):
  anular/corregir una operación cerrada no tiene camino por RPC — es la deuda F-02
  (reapertura/corrección auditada) que el plan money-path de v1 ya había señalado.
  Candidata a Bloque 2/3.
- **Drift cross-workstream** (hallazgo mayor, ajeno a CRM): el historial de migraciones
  del proyecto compartido no es reproducible → branching roto. Cross-handoff:
  `HANDOFF-cross-ssb-workspace-20260712-drift.md`. Refuerza separar proyectos (infra).

## ⚠️ DEUDA ABIERTA — documentada, NO resuelta (no bloquea este bloque)

**La validación cierra MOTOR ↔ EXCEL, no MOTOR ↔ NAVIERA.** El Excel es el modelo de
SSB; si arrastra un off-by-one desde el origen, validamos el error contra sí mismo — y
sería invisible: contar de más → sobreestimar → la factura de la naviera viene más
barata que lo proyectado → nadie reclama. **PRUEBA QUE FALTA:** cruzar UNA liquidación
real de detention de una naviera contra una operación cerrada del histórico
(`⚠️ VERIFY MOTOR↔NAVIERA`). Dueño: John (necesita la factura).

## ESTADO

- Migración 019: escrita, gate PASS, **NO aplicada**. DB de prod intacta (verificado).
- Front de F1: NO tocado en este bloque (por diseño — DDL primero; el retorno nuevo de
  la tanda es superset: la UI vieja degrada bien leyendo `creadas`).

## PRÓXIMO PASO

1. **John: smoke en producción** (la 019 ya está aplicada y verificada con datos reales).
2. **John: borrar el sandbox `gate-019-sandbox` (ref `gnygffoynwtxpkehmxal`) del
   Dashboard de Supabase** — quedó del intento 4, sigue facturando ~USD 10/mes,
   y el MCP no puede pausarlo ni borrarlo.
3. ⚠️ **MOTOR↔NAVIERA sigue abierto**: falta cruzar UNA liquidación real de detention
   de una naviera contra una operación cerrada del histórico. El Excel valida contra
   sí mismo; el off-by-one heredado sería invisible (sobreestimar → factura más barata
   → nadie reclama). El insumo (la factura) es de John.
4. Con el smoke aprobado → **Bloque 2 (front de F1)**: tanda fila-por-fila · campana
   solo-rojos · plantas CRUD + pickers `activa=true` · modal de tarifas con
   convención/cobra. NO arranca sin aprobación explícita.
5. Después: F2–F5 según el plan aprobado (`docs/PLAN-M4.html`).
