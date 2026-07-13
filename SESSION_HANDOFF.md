# Handoff de sesión — 2026-07-13 · CRM Detention v2 · rama v2-rebuild

## Resumen

Sesión larga de M4 sobre el CRM v2 (schema `crm` en Supabase `cctuowthpnstvdgjuomq`).
Arrancó con EXPLORE+PLAN (docs/EXPLORE-M4.md + PLAN-M4.html) y ejecutó cuatro bloques de
IMPLEMENT con gate humano entre cada uno: B1 (motor versionado + waiver + H1 + plantas +
campana), B2 (front F1 + corrección de cerradas F-02), B3 (waiver acumulativo + reset demo
+ depósitos + ayuda/tooltips M10) y B4 (reporting Excel + combobox global + sidebar).
**Todo aplicado y deployado**: migraciones 019-024 en prod, front en crm-detention.vercel.app,
DB operativamente en cero. Cada cambio de plata pasó gate en harness/branch + verifier
independiente (evaluador ≠ optimizador).

## Cambios realizados

- **Migración 019** (prod): convención de conteo + cobra_detention_origen VERSIONADOS en
  freetime_origin · dias_facturables() · modelo waiver (bruto/absorbido/neto) · H1
  (crm_crear_tanda_retiro con inserción parcial + resultado por contenedor) · plantas
  CRUD-ready (DROP CHECK + activa + policies) · get_pendientes con CP1.
- **Migración 020** (prod): crm_corregir_operacion_cerrada (F-02, sup+, whitelist, auditado).
- **Migración 021** (prod): waiver ACUMULATIVO — tabla operacion_waivers, cada waiver
  registro propio anulable individual, guard total ≤ exceso; sin_cargo/waiver_* congelados.
- **Migración 022** (prod): crm_reset_demo triple guard (admin + modo_demo + confirmación
  tipeada), solo crm.*, preserva semillas+usuarios. CORRIDO una vez para dejar DB en cero.
- **Migración 023** (prod): catálogo crm.depositos (10 canónicos del Excel) + FK retiro_de_id
  + RPCs crear/similares(fuzzy)/fusionar + tanda retrocompatible.
- **Migración 024** (prod): ayuda_contenido nivel/clave + crm_ayuda_valores + seeds m3-m9
  reescritos + 13 tooltips de campo con números interpolados desde la DB.
- **Front** (deployado, HEAD 80b3c78): UI de waivers en ficha, combobox de depósitos con
  creación inline, /ayuda + editor Admin + FieldHelp, reporting /reportes con export xlsx,
  combobox tipeable en 7 selects, sidebar colapsable en cookie.
- **crm-v2/AGENTS.md**: regla de escritura sancionada (RPC-only en tablas de plata; lista de
  maestros con write directo: navieras/plantas/depositos/configuracion/incidencias/ayuda);
  tipos_contenedor y medios QUEDAN EN CÓDIGO (decisión de John).

## Decisiones tomadas

- **Regla de días CONFIRMADA**: día 1 inclusivo (2.804/2.804 vs Excel). El spec.md:234 y un
  comentario en tanda-form.tsx decían "día 0" — CORREGIDOS. La convención pasó a versionada.
- **Waiver = SUMA (opción b de John)**: no reemplaza; el operario no hace aritmética mental.
- **Reset demo triple guard** + kill-switch modo_demo apagado por defecto.
- **REGLA DURA reforzada**: cero UPDATE crudo sobre tablas de plata; si falta la RPC, el
  output es "falta la RPC" (persistida en memoria regla-cero-update-crudo).
- **tipos/medios quedan en código** (CHECKs de integridad, no configurables).
- **Presupuesto**: los techos por-agente son inexigibles (los agentes erran 3-4x su
  auto-estimación); la contención real es 1 ítem grande = 1 run. Se sostuvo en B3/B4.

## Estado actual

- Migraciones 001-024 en prod. Front en producción (todas las solapas + /reportes + /ayuda).
- DB operativamente en CERO (reset corrido) — lista para la primera tanda REAL de John.
- Motor de plata validado contra el Excel (43/43 goldens + no-regresión 0 diffs + gate de
  cálculo en cada cambio). Waiver acumulativo verificado 3+2=5 contra Excel.
- Ayuda M10 completa: instructivos de las 7 solapas + tooltips por campo con números
  interpolados (nunca hardcodeados).

## Próximos pasos

1. **Smoke visual de John** (B4): export xlsx real desde /reportes, esquinas de modales tras
   el cambio de overflow en modal.tsx (ConfirmDialog), rail expandido y su persistencia.
2. **Cargar la primera tanda REAL** en /ingreso (la DB está en cero a propósito).
3. **ERD** (Bloque restante): FALTA la referencia visual de John para arrancar.
4. Reporting: si se quiere, `vista_reporte` dedicada (DDL, GO futuro) uniría open+closed en
   una sola fuente — hoy el reporte mergea base + views por operacion_id (sin DDL).

## Contexto no obvio

- **⚠️ MOTOR↔NAVIERA sigue ABIERTO**: el motor está validado contra el Excel, pero el Excel
  se valida contra sí mismo. Falta cruzar UNA liquidación real de detention de una naviera
  contra una operación cerrada del histórico — el insumo (la factura) es de John. Un
  off-by-one heredado del Excel sería invisible (sobreestimar → factura más barata → nadie
  reclama).
- **⚠️ Sandbox `gate-019-sandbox` (ref `gnygffoynwtxpkehmxal`)**: quedó de un intento de gate
  fallido, factura ~USD 10/mes, el MCP no puede borrarlo → John lo borra del Dashboard.
- **Branching de Supabase ROTO** en el proyecto compartido (drift de public.inbound_events,
  workstream ssb-export-dashboard) → los gates de DDL se corren en Postgres LOCAL embebido
  (scratchpad/pgrun/) o proyecto sandbox temporal, nunca branch. Ver memoria
  infra-drift-branching-roto + HANDOFF-cross-ssb-workspace-20260712-drift.md.
- Handoffs por bloque: docs/HANDOFF-M4-{B1,B2,CIERRE,B3A,B3B,B4}.md. Estado durable en
  .claude/state/progress-m4.md.
- pg_trgm vive en el schema `extensions` en Supabase (no public) — calificar
  extensions.similarity() en funciones con search_path=''.
