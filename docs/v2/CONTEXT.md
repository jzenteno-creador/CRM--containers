# CONTEXT — Rebuild v2 CRM Detention

> Leído por los subagentes (.claude/agents/) al inicio de cada tarea. Fuente de verdad funcional: `spec.md` (raíz).

## Supabase (addendum §21 del spec, 2026-07-08)

**Un solo proyecto: `cctuowthpnstvdgjuomq`.** v2 vive en el **schema `crm`** de ese proyecto.

| Superficie | Regla |
|---|---|
| schema `crm` + bucket `crm-incidencias` + triggers sobre `auth.users` | ✅ Único destino de escritura de v2. Todo DDL/DML schema-cualificado `crm.` |
| schema `detention` (v1 CRM, demo viva) | ⛔ Intocable para escritura. Lectura de referencia OK. |
| schema `public` (ssb-export-dashboard, EN USO) | ⛔ Intocable para escritura. |
| bucket `incidencias` | ⛔ Es de v1 — no tocar. |
| dominio crm-detention.vercel.app | ⛔ Es de v1 — no deployar ahí. |

Cliente v2: `db: { schema: 'crm' }` (patrón v1). `auth.users` verificada con 0 filas (2026-07-08): v2 se apropia de Auth sin conflicto. Paso manual de John pendiente: exponer `crm` en Data API (precondición del front M2+, no de las migraciones).

## Git

- `v2-rebuild` = branch de trabajo actual, y la única viva. Contiene toda la historia de `master`.
- `master` quedó congelada en `33ad084` (v1). **El cutover de `master` sigue pendiente** — decisión de John.
- Las branches por módulo (`v2/m0-scaffold`, `v2/m1-schema`, …) y las de features v1 se borraron el 2026-07-31: todas estaban contenidas en `v2-rebuild`, cero commits huérfanos.

## Código

- v2 vive en `crm-v2/`. **Es lo único que hay**: el código del v1 (`crm-detention/`) y el export del schema v1 (`db/schema/`) se dieron de baja el 2026-07-31.
- Para consultar el v1: `git checkout v1-prototipo -- crm-detention db` (tag de rescate), o `git show v1-prototipo:<path>`.
- Design system: Flight Deck — spec visual en `crm-detention/design_handoff_crm_detention/` **dentro del tag `v1-prototipo`** (README + tailwind.tokens.ts). Ya está portado a `crm-v2/src/app/globals.css`.
- El schema `detention` del v1 sigue vivo en la DB (solo se dio de baja el código) y se sigue respaldando — ver `docs/backup-db.md`.

## Deploy

- v2 → `npx vercel deploy --prod --yes` desde `crm-v2/`, SIEMPRE manual (no auto-deploya en push).
- ⚠️ El v1 compartía el mismo proyecto Vercel (`prj_xRmLlZJ3...`, `crm-detention`), así que un deploy parado en la carpeta equivocada pisaba producción. Con la baja del v1 ese riesgo desapareció: hay un solo `.vercel/` en el repo.

## Checkpoints humanos

- CP1 (post-M1): schema + RLS. · CP2 (post-M2): registro→aprobación→login. · CP3 (post-M10): VERIFY final + auditoría RLS §14.10 + pulido visual con capturas.
