# CONTEXT — Rebuild v2 CRM Detention

> Leído por los subagentes (.claude/agents/) al inicio de cada tarea. Fuente de verdad funcional: `spec.md` (raíz).

## Proyectos Supabase

| Ambiente | project_id | Regla |
|---|---|---|
| **v1 PRODUCCIÓN** | `cctuowthpnstvdgjuomq` | ⛔ INTOCABLE (§21.1). Solo lectura de referencia. Ninguna migración/seed/escritura de v2 apunta acá. |
| **v2 (rebuild)** | _pendiente de creación — se completa al crear el proyecto vía MCP con costo confirmado por John_ | Único destino de migraciones y seeds de v2. |

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
