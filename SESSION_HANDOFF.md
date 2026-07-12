# Handoff de sesión — 2026-07-12 (sesión 11: MERGE + DEPLOY A PROD + verify → CP2 EN PRODUCCIÓN)

**Rama al cierre:** `v2-rebuild` (mergeada desde `v2/m2-auth`; +3 commits de deploy sobre el cierre de sesión 10). `master` intacta (= v1 histórico).
**Estado macro: CRM v2 EN PRODUCCIÓN.** `https://crm-detention.vercel.app` sirve v2 (schema `crm`). v1 quedó reemplazada. Los 9 asserts D1–D9 del run en PASS.

---

## 🟢 QUÉ HAY EN PROD

- **URL:** https://crm-detention.vercel.app · **deployment activo:** `crm-detention-adjf8w138` (dpl con el fix del ⌘K).
- **Commit desplegado:** `5a6caae` (HEAD de `v2-rebuild`). Deploy por CLI (`npx vercel deploy --prod --yes`) — el proyecto Vercel `crm-detention` ahora apunta a `crm-v2/` (antes servía el v1 re-skin).
- **Rollback si hiciera falta:** `dpl_5cXYpy82AnHnygRRgsW1pbDJdKqx` (v1 re-skin, el que estaba antes de este run).
- **Env vars de prod** (proyecto estaba VACÍO): `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` cargadas.

## QUÉ HABÍA ANTES (ITEM 0)

Prod servía un **v1 re-skin** (dpl_5cXYpy82, 2026-07-06) que leía del schema `detention`. **Estaba ROTO desde el 2026-07-08**: la 017 des-expuso `detention` de PostgREST → todo dato daba 406. El deploy de este run lo reemplazó por v2.

## HECHO (sesión 11)

- **Merge** `v2/m2-auth` → `v2-rebuild` (fast-forward, sin conflictos) + `npm run build` limpio. Push de ambas ramas a origin.
- **Limpieza pre-deploy** (D9): `crm.operaciones`/`contenedores`/`eventos` = 0 (era basura de test anulada).
- **Deploy** a prod + verify E2E contra la URL pública (agent-browser).
- **2 fixes de 404 de rutas M3+** (John los cazó en el smoke):
  1. `c79270a` — sidebar: solapas no construidas → `<span>` atenuado (mata el prefetch de `<Link>`).
  2. `5a6caae` — el 404 imperativo restante: **`⌘K` navegaba a `/alertas`** por `router.push` (sin `?_rsc=`). Fuente de verdad única `lib/nav.ts` (`ROUTE_BUILT` + `isRouteBuilt`) que consultan sidebar, palette y footer de ayuda. Al construir un módulo M3+, poné su ruta en `true` y se reactiva en los 3 lados.
- **D7 verificado en prod:** registro 200 → email confirmado por link real (303) → sign-in → pendiente devuelve `200+[]` en las 4 superficies.
- **D8 (John):** aprobó una cuenta pendiente desde /admin → pasó a leer. ✔
- **Cleanup de seguridad URGENTE:** la cuenta de prueba de D8 (`test-crmv2-d7@mailinator.com`) quedó **administrador con casilla en Mailinator** (bandeja pública) → con `/recuperar` era un vector de escalada a admin. **Borrada.** Verificado con body: `auth.users=1`, `crm.usuarios=1`, `test-crmv2-*=0`, única fila `jzenteno@ssbint.com` admin activo.

## ESTADO — D1–D9

| D | assert | estado |
|---|---|---|
| D1 | merge + build local | PASS |
| D2 | deploy prod READY | PASS (adjf8w138) |
| D3 | GET / → 200, carga | PASS |
| D4 | login admin → dashboard | PASS (smoke de John) |
| D5 | consola: 0 · 406 / 0 · 401 | PASS (tras los 2 fixes de 404 de ruta) |
| D6 | dashboard en cero sin errores | PASS (smoke de John) |
| D7 | registro → pendiente no lee | PASS (verificado en prod) |
| D8 | aprobación admin → lee | PASS (smoke de John) |
| D9 | sin basura de test | PASS (auth.users=1, crm en cero) |

## PRÓXIMO PASO

- **M3 (Ingreso)** en sesión nueva. §14.1 del spec seguía abierto pendiente del feedback de CP2 — ahora que v2 está en prod y John lo validó, se puede definir. TIER: build estándar (Sonnet/Opus); el reviewer/verifier habituales.
- **Backlog cosmético** (no bloqueante): cuando M3+ construya cada ruta, poné su flag en `ROUTE_BUILT` (`crm-v2/src/lib/nav.ts`) a `true`.

## Contexto no obvio (persiste)

- **Deploy v2 = proyecto Vercel `crm-detention`** (`crm-v2/.vercel/project.json`). Deploy manual: `cd crm-v2 && npx vercel deploy --prod --yes`. Auth de Vercel CLI en `~/.local/share/com.vercel.cli/` (jzenteno-9227).
- Regla §21: v2 escribe SOLO en schema `crm`. `detention` READ-ONLY. Migraciones + rollbacks en `crm-v2/supabase/{migrations,rollbacks}/`.
- Usuarios de test por SQL: token-cols de `auth.users` en `''` (no NULL) o el sign-in da 500. Verify link usa `token=`, no `token_hash=`. GoTrue rechaza `@example.com` y rate-limita el envío de emails (~1/h por casilla).
- Crear usuarios/admins en la DB de prod está (correctamente) bloqueado por el clasificador de permisos — cualquier cuenta de test la aprueba/crea John, o se hace read-only.
- 3 untracked de negocio sin decidir (no van al repo del CRM): `Caso-de-Negocio-*.pdf`, `Presentacion-*.html` → Drive; `HANDOFF-cross-ssb-workspace-*.md` → repo ssb-workspace.
