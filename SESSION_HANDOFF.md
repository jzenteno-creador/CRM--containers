# Handoff de sesión — 2026-07-08 (sesión 9: REBUILD v2 — Fase 3, M0→M2 + hallazgo de seguridad)

**Rama al cierre:** `v2/m2-auth` (13+ commits sobre M2) · base `v2-rebuild` (M0+M1 mergeados, CP1 aprobado) · `master` intacta (= v1).
**Modelo sugerido para retomar:** el próximo paso es ejecución+verificación (correr SQL, §14.10, verify E2E) → **Opus o Sonnet alcanza**; la decisión de seguridad ya está tomada. M3+ build → estándar.

---

## 🔴 BLOQUEO ÚNICO PARA RETOMAR — SQL que corre JOHN en el SQL Editor del dashboard

Proyecto Supabase `cctuowthpnstvdgjuomq` → SQL Editor (corre como `postgres`, sin el guard del MCP que auto-deniega escrituras de infra prod):

```sql
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, crm';
NOTIFY pgrst, 'reload config';
```

**Rollback** (10 s): `ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, detention, crm'; NOTIFY pgrst, 'reload config';`

**⚠️ Qué hace este SQL, explícito (decisión de John: Opción A, "apagar v1 ahora"):**
- **Saca `detention` de la Data API → el browser de v1 (crm-detention.vercel.app) se queda SIN API.** v1 deja de leer/escribir: pantallas rotas (ingreso/egreso/alertas/admin/etc. muestran error). **Los datos NO se tocan** — siguen en la base, solo dejan de ser alcanzables por la API pública. Aceptado porque v1 es uso interno solo de John y v2 la reemplaza.
- **Agrega `crm`** → v2 puede hablar con su base (lo que M2+ necesita).
- `public` y `graphql_public` quedan → ssb-export-dashboard (en `public`) sigue sin cambios.
- No escribe sobre `detention` (solo lo quita de exposición → respeta §21).

**Estado actual VIVO (verificado 2026-07-08):** el Save del dashboard NO persistió — `pg_db_role_setting` de `authenticator` = `pgrst.db_schemas = public, graphql_public, detention` (crm NO figura). Por eso el SQL de arriba es necesario: el dashboard no toma, hay que hacerlo por SQL.

### 🟡 ALTERNATIVA si John decide NO romper v1 (RLS sobre detention)

RLS "con el patrón de crm" (keyed en `auth.uid()`) **es imposible en detention**: v1 no usa Supabase Auth (login propio con password en texto plano contra `detention.usuarios`, cookie base64; cada request llega como rol `anon`). Sin `auth.uid()`, la única RLS escribible es `USING(true)` (no protege — el atacante tiene la misma anon key pública que la app) o `USING(false)` (rompe v1). A nivel DB, `anon`-app y `anon`-atacante son el mismo principal. Menú real si NO se rompe v1:
- **Opción B — lockdown read-only:** `REVOKE INSERT, UPDATE ON ALL TABLES IN SCHEMA detention FROM anon, authenticated;` (mantener SELECT + mantener detention expuesto). v1 queda **solo-lectura** (mirar sí, escribir no); corta el tampering anónimo; la LECTURA de todo el dato sigue abierta a quien tenga la anon key. Interino hasta el cutover. Requiere OK explícito de John (toca detention, §21).
- **Protección real manteniendo v1 funcional** = darle identidad Supabase Auth (reescribir su login) o un proxy server-side con service role → esfuerzo sobre una app que se reemplaza. No recomendado.
- Detalle completo en `docs/v2/plan-remediacion-detention.md`.

**Apenas John corra el SQL de Opción A (o elija B), el próximo Claude verifica:** `detention` anónimo → HTTP 406; `crm` anónimo → 200. Con la anon key `sb_publishable_mgVDKvuCNwEG26GOLL2-fg_g4o3gEE4`, URL `https://cctuowthpnstvdgjuomq.supabase.co/rest/v1`.

---

## HECHO (esta sesión)

- **M0** (scaffold + design system Flight Deck completo): mergeado a `v2-rebuild`, verificado (build/tsc/lint + smoke visual browser real).
- **M1** (schema `crm` + RLS + triggers + seeds): 11 migraciones (001–011), **CP1 APROBADO** por John, re-verificado en vivo por reviewer independiente. HAPAG=14 días (011, decisión de John).
- **M2** (auth + aprobación): código completo + **2 reviews APROBADOS** (el base y el de adiciones). Falta SOLO el verify E2E (gated por exposición de crm).
- **Hallazgo de seguridad detention** (elevado por John): auditado con evidencia; plan presentado; Opción A aprobada; SQL pendiente de que lo corra John.
- **Condición #4 de John (auto-reparación):** migración 016 `crm.sync_mi_usuario()` + integración en `session.tsx` (llamada al login antes de `perfil()`). Aplicada y revisada.
- **Triggers de auth defensivos** (condición #2 de John): migración 014 — `handle_new_user`/`bootstrap_admin` capturan toda excepción (un RAISE ahí bloqueaba el signup de TODO el proyecto compartido). Aplicada y revisada.
- **Consolidaciones pre-M3 #11 y #12:** GateFrame/CardIcon/FormAlert extraídos al design system; acciones por fila a `ghost`. Aplicadas y revisadas.
- **Protocolo Fable 5** instalado en `docs/v2/WORKSTYLE-fable5.md` (versionado).
- **Reporte de CP1 corregido:** crm está protegido por RLS, NO por ausencia de grants (auto-expose otorgó CRUD+DELETE a anon/authenticated sobre las 14 objetos).

## DECISIONES (de John, esta sesión)

- **Infra v2 = schema `crm` en el proyecto compartido `cctuowthpnstvdgjuomq`** (no proyecto dedicado; límite de 2 free). `detention`/`public` intocables. Addendum §21 en `spec.md`.
- **detention → Opción A** (des-exponer, apagar v1). v1 es uso interno solo de John; v2 la reemplaza.
- Fórmula de días inclusiva (retiro = día 1); paquete de paridad v1 completo; semáforo `neutro`; `usuarios_publicos` owner-based; bootstrap por trigger post-confirmación; HAPAG=14.
- "Automatically expose new tables" → DESACTIVADO por John (tabla nueva = exposición explícita).

## HALLAZGOS (abiertos)

1. **detention RLS-off + expuesto** (el hueco): anon puede leer/escribir ~2.952 operaciones reales vía la anon key pública del bundle. **Sigue vivo hasta que John corra el SQL.** Único consumidor por API = browser de v1 (inventariado, Regla 6). El backup (`.github/workflows/backup-detention.yml`) usa conexión directa → inmune. n8n apunta a otro proyecto.
2. **Riesgo residual declarado:** la corrección 014/016 está verificada por lectura + catálogo, no por un signup real que caiga en el catch (gated por crm sin exponer) → se prueba en el verify E2E. No se abrió el host de cada credencial n8n (MCP redacta el secreto).
3. Backlog no bloqueante en `docs/v2/backlog-pulido.md` (12 items) + bucket `incidencias` de v1 es público (advisor).

## ESTADO (migraciones en la DB `crm`)

Aplicadas y verificadas: 001–014, 016. **015 (hardening de grants) PREPARADO pero NO aplicado** — se aplica DESPUÉS del test §14.10 (para probar que la RLS bloquea a anon CON los grants presentes, no confundir con grant-absence). Archivo: `crm-v2/supabase/migrations/015_hardening_grants_crm.sql`.

## PRÓXIMO PASO (orden exacto, autónomo tras el SQL de John)

1. John corre el SQL de Opción A (o decide B). Avisa "listo".
2. Verificar flip: `detention` anon → 406; `crm` anon → 200.
3. **Test §14.10** anónimo sobre las 12 tablas + 2 views de crm: con la anon key, cada una debe dar 0 filas o permiso denegado (probar que la RLS bloquea CON grants presentes).
4. **Aplicar 015** (hardening): revocar grants de anon + DELETE de authenticated. Re-verificar que authenticated conserva SELECT/INSERT/UPDATE y anon queda en USAGE-solo. (El MCP puede auto-denegar; si pasa, va por SQL Editor o apply_migration.)
5. **Verify E2E de M2** (verifier): registro→confirmación→espera→aprobación→login. **Check puntual de John:** bootstrap = match exacto de email + one-shot (nunca "primer registrado = admin"), probado con una 2da cuenta que queda pendiente y NO lee nada. Incluye probar auto-reparación (sync_mi_usuario) y PKCE-vs-implicit del callback (backlog #7).
6. **CP2** (checkpoint): mostrar el flujo funcionando → merge `v2/m2-auth` → `v2-rebuild`.
7. Recién ahí: **M3 (Ingreso)** — orden §17. Las consolidaciones pre-M3 ya están hechas.

## Contexto no obvio

- **Regla de oro §21:** v2 escribe SOLO en schema `crm` + bucket `crm-incidencias` + triggers `crm_*` de auth.users. Los subagentes (`.claude/agents/`) lo tienen grabado.
- Canal de migraciones: archivo en `crm-v2/supabase/migrations/` + MCP `apply_migration` (mismo contenido). Regla ACL: cada función nueva necesita `REVOKE EXECUTE FROM PUBLIC, anon` explícito (default de Postgres es aditivo).
- MCP auto-deniega escrituras de infra prod (ALTER ROLE, etc.) → van por SQL Editor de John.
- MCP playwright/chrome-devtools ROTOS en WSL → verify visual = skill agent-browser (clicks nativos vía eval).
- Cupo Fable agotado esta sesión → se pasó a Opus 4.8. Nada del spec depende del modelo.
