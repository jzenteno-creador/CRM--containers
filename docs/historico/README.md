# Histórico — procesos cerrados

Documentos de trabajo de fases ya terminadas. **No son la fuente de verdad de nada vivo**:
se conservan porque explican *por qué* la DB y el código quedaron como quedaron, y varios
son la evidencia de gates que se aprobaron o se rebotaron.

La fuente de verdad viva es `spec.md`, `docs/v2/CONTEXT.md` y `crm-v2/AGENTS.md`.

| Archivo | Qué es | Estado |
|---|---|---|
| `HANDOFF-M4-B1..B4`, `-B3A`, `-B3A-APLICADO`, `-B3B`, `-B3-PARCIAL`, `-CIERRE` | Handoffs por bloque de M4 (Admin, ayuda/tooltips) | Cerrado |
| `EXPLORE-M4.md`, `PLAN-M4.html` | Exploración y plan de M4 | Cerrado |
| `GATE-025.md` | Gate de la migración 025 (fix P1 del write a plata). Aplicada en prod como `20260713160000` | Cerrado |
| `FIX-P1-BAKEOFF.md` | Bake-off empírico de los 3 fixes candidatos al P1 de CP3 → ganó el fix C | Cerrado |
| `CP3-VERIFY.md` | VERIFY final de M10. **Veredicto FAIL**; el P1 que lo motivó se corrigió con la 025 | Cerrado |
| `AUDIT-4-DEFINER-RPCS.md` | Auditoría de las 4 RPCs SECURITY DEFINER de más impacto en costo | Cerrado |
| `audit-20260705.md` | Auditoría fase 1 (findings D-01…D-0n, incluye el D-02 del backup) | Cerrado |
| `moneypath-plan-20260705.md` | Plan del money-path | Cerrado |
| `flight-deck-reskin-20260704.md` | Plan del re-skin Flight Deck (v1) | Cerrado |
| `HANDOFF-cross-ssb-workspace-20260712-drift.md` | Drift entre este repo y ssb-workspace | Cerrado |

## Lo que NO está acá

- **El código del v1** (`crm-detention/`) y el export del schema v1 (`db/schema/`): dados de
  baja el 2026-07-31. Recuperables con `git checkout v1-prototipo -- crm-detention db`.
- **`docs/fix-p1/025_fix_p1_rpc_executor.sql`**: era un duplicado byte a byte de
  `crm-v2/supabase/migrations/025_fix_p1_rpc_executor.sql`. Se borró el duplicado; la
  migración viva es la del directorio de migraciones.
- **Borradores del Dow Summit y fuentes del caso de negocio**: fuera del repo, en
  `/home/jzenteno/projects/_archivo-crm-containers/2026-07-31/`. Los entregables finales
  quedaron en `docs/dow-summit-2026/` y `docs/caso-negocio/`.
