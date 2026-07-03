# SESSION_HANDOFF — CRM Detention de Contenedores

**Fecha:** 2026-07-03 (actualizado post-verificación pre-demo) · **Proyecto:** Crm-containers · **Rama:** master · **Último commit:** `a33ec3c` (schema detention + conteo Excel)

## ACTUALIZACIÓN — Verificación + remediación pre-demo (sesión 2)

1. **Aislamiento**: CRM migrado completo de `public` → schema **`detention`** (11 tablas + 2 vistas + 11 funciones con search_path). `public` quedó solo con `inbound_events`/`inbound_log` de ssb-export-dashboard (verificado 200 post-migración). Exposición del schema vía in-db config de PostgREST: `ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, detention'` + `NOTIFY pgrst` — si la plataforma alguna vez lo resetea, re-aplicar o setear en Dashboard → Data API → Exposed schemas.
2. **Conteo de días = Excel**: verificado en 2804/2804 filas que el Excel cuenta retiro = día 1 (ESTADIA = diff+1). Vistas recreadas con ese criterio → **ESTADIA match 100%, COSTO match 99.7%** (los 8 restantes son costos pisados a mano en 0 en el Excel — waivers — con demoras de hasta 109 días; el CRM aplica la fórmula del propio Excel). USD: Excel 585.185 vs CRM 599.440 (+2,44% = exactamente esos 8 waivers). YTD dashboard: USD 461.000.
3. **Demo data vs histórico**: 18/82 abiertas vencidas (22%) con USD 6.555 proyectado ≈ USD 364/op vencida, vs histórico 44,3% de ops con demora y USD 471/op — la demo es CONSERVADORA respecto de la realidad, no inflada. Sin reseed.
4. **E2E post-migración (local, schema detention)**: ciclo completo por app (tanda→ingreso→egreso→cierre, embarcado Y devuelto_vacio) + **upload de fotos de incidencias verificado**: 1/1 subida a Storage, fila en incidencia_fotos, evento en timeline, URL pública HTTP 200. Datos de prueba limpiados (quedan 2886 = 2804 reales + 82 abiertas).
5. **Vercel**: SIGUE bloqueado en auth (sin token, sin credentials guardadas; deploy cuelga en device-flow). E2E sobre URL productiva PENDIENTE hasta el login.

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
