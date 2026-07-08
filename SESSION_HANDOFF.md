# Handoff de sesión — 2026-07-08 (sesión 9: REBUILD v2 — Fase 3, M0+M1+M2)

**Rama al cierre:** `v2/m2-auth` @ `a5d3cc1` · base `v2-rebuild` @ `be097ca` · `master` intacta (= v1).
**Handoff previo (sesión 8, Fase 2 v1):** preservado en git history (commit `a5d3cc1`).

## Resumen

Arrancó el **rebuild v2** según `spec.md` v2.1 (John lo entregó esta sesión; addendum §21 firmado con su decisión de infra). Se completaron **M0** (scaffold + design system Flight Deck completo, mergeado a `v2-rebuild`) y **M1** (schema `crm` + RLS + triggers + seeds — **CP1 APROBADO** por John), y **M2** (auth + aprobación) quedó código-completo y aprobado por review. La sesión pausa con el **verify E2E de M2 pendiente de 2 toggles manuales de John** en el dashboard de Supabase. Próximo hito: CP2.

## Cambios realizados

- `spec.md`: v2.1 en la raíz + addendum §21 (decisión John: v2 vive en **schema `crm` del proyecto compartido `cctuowthpnstvdgjuomq`** — sin proyecto nuevo por límite de 2 free; `detention` (v1) y `public` (ssb-export-dashboard) intocables).
- `.claude/agents/`: schema-builder, ui-builder, reviewer, verifier — con reglas §14/§21, estándar de interfaz, lista cerrada de SECURITY DEFINER y convenciones sancionadas durante los reviews.
- `crm-v2/`: app Next 16 + TS + Tailwind 4 nueva. M0: 22 componentes fd/ (todos con estados en `/design`, dev-only), shell (rail/bottom-nav), login + espera con calidad de portada. M2: registro/login/reset/callback wireados, sesión vía RPC `perfil()` (jamás metadata), `/admin/solicitudes` (aprobar rol+planta, rechazar con motivo, suspender, warning de dominio §12.4).
- `crm-v2/supabase/migrations/001–013`: TODO el DDL aplicado vía MCP con mirror en git. 12 tablas (RLS total), vista_alertas (día 1 inclusivo + neutro), RPCs operativas INVOKER, timeline por triggers DEFINER, bucket `crm-incidencias`, seeds (14 navieras/tarifas, config, FAQ+ayuda admin), fix ACL (010), HAPAG=14 días (011, decisión CP1), `mi_estado_cuenta()` (012).
- `docs/v2/`: `CONTEXT.md` (reglas de convivencia), `plan-m0-m1.md` (aprobado, rev.2 post-verificación adversarial de 26 findings), `cp1-entregable.md` (+addendum decisiones CP1), `backlog-pulido.md` (12 items), `screenshots/m0/`.

## Decisiones tomadas (todas de John, registradas en docs)

- Rebuild v2 deliberado con v1 viva como demo; **premisa corregida: v1 NO está en uso operativo, data descartable** → cutover simplificado (DROP `detention` + swap dominio).
- Fórmula de días **inclusiva (retiro = día 1)** como v1/Excel — el "día 0" del spec queda desmentido.
- **HAPAG LLOYD = 14 días** (el Excel estaba mal); ZIM queda Excel 21d/$25 (la versión 0d/$84 de la disputa NO entra sin confirmación).
- Paridad v1 paquete completo (regimen/sin_cargo/cobra_detention_origen/producto/gmid/observaciones con su lógica).
- Campana: incluir tránsito hacia la planta del operador (fix comprometido en M6).
- Convenciones fijadas: naming (dominio español espejando DB, estructura inglés), acciones por fila `ghost` (primary solo en modal), `maxHeight` obligatorio en tablas operativas.

## Estado actual

- `v2-rebuild` = M0 + M1 mergeados y verificados (CP1 aprobado; RLS re-verificada en vivo por reviewer independiente: anon 56/56 sin privilegios).
- `v2/m2-auth` (SIN mergear, 13 commits): M2 completo + review APROBADO. Build/tsc/lint limpios.
- DB `crm` en `cctuowthpnstvdgjuomq`: 13 migraciones aplicadas, 0 usuarios, seeds listos. `.env.local` de crm-v2 con la publishable key nueva (gitignored).
- v1 (`detention` + crm-detention.vercel.app) intacta.

## Próximos pasos

1. **John: 2 toggles en dashboard Supabase** (proyecto `cctuowthpnstvdgjuomq`): (a) Project Settings → Data API → Exposed schemas → agregar `crm` — SIN esto el front no habla con PostgREST (PGRST106); (b) Authentication → activar Leaked Password Protection.
2. **Verify E2E de M2** (verifier): registro→confirmación→espera→aprobación→login + panel admin con datos reales + PKCE-vs-implicit del callback (backlog #7). El bootstrap admin se prueba acá: John se registra con jzenteno@ssbint.com, confirma email → queda admin automático.
3. **CP2** (checkpoint humano): mostrar el flujo funcionando. Después merge de `v2/m2-auth` → `v2-rebuild`.
4. Pre-M3: consolidar `GateFrame`/alert-box al design system (backlog #11) y ajustar Aprobar a ghost (backlog #12). Después M3 (Ingreso) → M4… orden §17.

## Contexto no obvio

- **Regla de oro §21 (addendum):** v2 escribe SOLO en schema `crm` + bucket `crm-incidencias` + triggers `crm_*` de auth.users. Los agentes tienen esto grabado; el reviewer rebota violaciones.
- Migraciones: canal único archivo `crm-v2/supabase/migrations/` + MCP `apply_migration`. Regla ACL: cada función nueva necesita `REVOKE EXECUTE FROM PUBLIC, anon` explícito (el default de Postgres es aditivo — hallazgo M1, fix 010).
- Lista SECURITY DEFINER cerrada (en schema-builder.md regla 8) — `mi_estado_cuenta()` es la única sin guard de activo (sirve a no-activos, superficie mínima).
- MCP playwright/chrome-devtools ROTOS en este WSL — verify visual = skill agent-browser con clicks nativos vía eval (memoria del proyecto).
- Patrón lint `set-state-in-effect`: setState detrás de await vía IIFE async en effects (patrón de la casa, ver admin/solicitudes).
- El cupo de la ventana Fable va hasta el 12/07; si se agota → `/model claude-opus-4-8` y el loop sigue (spec §17).
