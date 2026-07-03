# SESSION_HANDOFF — CRM Detention de Contenedores

**Fecha:** 2026-07-03 · **Proyecto:** Crm-containers · **Rama:** master · **Último commit:** fix CrmNav/embed FK

## Qué se construyó (one-shot autónomo, DONE local completo)

CRM funcional Next.js 16 + TS + Tailwind 4 + Supabase, corriendo en `crm-detention/` contra datos reales. **Los 5 criterios DONE verificados E2E en browser:**
1. ✅ Login por rol: admin/supervisor/operador (operador scoped a BAHIA, sin solapa Admin)
2. ✅ Ciclo completo en UI: tanda de retiro (2 contenedores DEMU, ISO 6346 validado) → confirmar ingreso a planta → salida embarcada con asignación por lote → confirmación gate-in → cerrado con timeline `retiro→ingreso_planta→carga→egreso→devolucion`
3. ✅ Alertas: semáforo 16🔴/15🟡, orden por días restantes, costo proyectado USD 5.945
4. ✅ Freetime versionado desde Admin: MSC 15d@50 → cerrada con `vigente_hasta`, nueva 12d@60 vigente (nunca UPDATE)
5. ✅ Dashboard con números reales: YTD USD 434.805, stock 50, demora prom. 17,8d, barras por naviera + tendencia mensual

Review multi-agente: 7/7 módulos aprobados contra spec (workflow evaluator-optimizer).

## Cómo correr

```bash
cd crm-detention && npm install && npm run dev   # → localhost:3000 (quedó corriendo)
```
Sin `.env` — URL + anon key embebidos en `src/lib/supabase.ts` (decisión del brief: demo interno).

**Usuarios demo:** `admin@ssb.demo`/`admin123` · `supervisor@ssb.demo`/`super123` · `operador@ssb.demo`/`opera123`

## Backend (decisión clave)

- **Supabase host: `cctuowthpnstvdgjuomq`** (ssb-export-dashboard) — el proyecto dedicado del spec fue IMPOSIBLE: límite de 2 proyectos free alcanzado (`xkppkzfxgtfsmfooozsm` colisionaba: ya tiene `operaciones`/`contenedores`/`navieras`). Tablas 100% aditivas con nombres limpios del spec; migración a proyecto dedicado = re-aplicar las 2 migrations (`crm_detention_schema`, `crm_detention_rpcs`) + re-correr `import_demo.py`.
- Schema: 10 tablas (text+CHECK, timestamptz, soft delete, guard índice único parcial, trigger `planta_actual_id`) + `vista_alertas` + `vista_costos_cerrados` (días en `America/Argentina/Buenos_Aires`, retiro = día 0) + 9 RPCs `crm_*` (tandas transaccionales, versionado freetime, dashboard agregado).
- Demo data: 2804 ops cerradas del historial real + 82 abiertas sintéticas (ISO 6346 válido) + 11.4k eventos + 17 incidencias. Bucket storage `incidencias` público + realtime en operaciones/movimientos/incidencias.

## Decisiones / desvíos documentados

- Costos históricos ~5% bajo el Excel (556.990 vs 585.185): criterio spec "día 0" vs conteo inclusivo del Excel. Consistente en toda la app.
- Freetime con 2 versiones seed para HAPAG (14d→21d) y ZIM (7d→21d): la histórica matchea el historial, la vigente el xlsx — el versionado quedó demostrable con datos reales.
- Auth liviana por cookie (tabla `usuarios`, password plano) en vez de Supabase Auth — seguridad OFF por diseño, funcionalidad de roles completa.
- Estado `cargado` existe en el CHECK y en demo data (5 ops); el flujo de egreso va directo en_planta→en_transito_a_terminal (§14.1 del spec quedó plegado en egreso).
- KPI "costo mes" = USD 0 es correcto (sin cierres en julio aún); considerar KPI "mes anterior" para el demo.

## ⚠ ACCIONES HUMANAS PENDIENTES

1. **Deploy Vercel** (único bloqueo): `! npx vercel login` → luego `cd crm-detention && npx vercel --prod --yes`. Fallback demostrable: `npm run dev` local ya verificado.
2. Opcional: proyecto Supabase dedicado (pausar/upgrade un proyecto free) → migrar con las migrations.

## Gaps conocidos

- Carga masiva de fotos de incidencias probada solo a nivel código (upload no ejercitado E2E).
- Realtime verificado por suscripción, no con segundo cliente concurrente.
- gh CLI no instalado; deploy sería vía Vercel CLI directo (sin GitHub).

## Próximos pasos sugeridos

1. Vercel login + deploy (5 min).
2. Smoke test de John del flujo completo con los 3 roles.
3. Demo al dueño → feedback → congelar spec v2.
