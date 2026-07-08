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

- `master` = v1 (libre para hotfixes). **No recibe nada de v2 hasta el cutover.**
- `v2-rebuild` = branch larga del rebuild. Branches por módulo (`v2/m0-scaffold`, `v2/m1-schema`, …) salen de ella y mergean a ella.

## Código

- v2 vive en `crm-v2/` (a crear en M0). `crm-detention/` es la v1: referencia de lectura, jamás se modifica.
- Design system: Flight Deck — spec visual en `crm-detention/design_handoff_crm_detention/` (README + tailwind.tokens.ts).
- Referencia de schema v1 (export read-only): `db/schema/*.sql`.

## Deploy

- v2 → proyecto Vercel NUEVO (a crear; nunca el dominio de producción v1). Deploy SIEMPRE manual de John: `npx vercel deploy --prod --yes` desde `crm-v2/`.

## Checkpoints humanos

- CP1 (post-M1): schema + RLS. · CP2 (post-M2): registro→aprobación→login. · CP3 (post-M10): VERIFY final + auditoría RLS §14.10 + pulido visual con capturas.
