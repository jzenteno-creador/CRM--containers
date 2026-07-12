-- ============================================================================
-- 017 — INFRA: exponer el schema `crm` en la Data API (PostgREST)  [2026-07-08]
--
-- Flip de Opción A (aprobado por John): saca `detention` de la Data API y agrega
-- `crm`. Efecto: v1 (crm-detention.vercel.app) queda SIN API pública (uso interno
-- solo de John, reemplazada por v2). Los DATOS de detention NO se tocan — solo
-- dejan de ser alcanzables por PostgREST. `public`/`graphql_public` quedan
-- (ssb-export-dashboard intacto). Respeta §21 (no escribe sobre detention).
--
-- POR QUÉ ES UN ALTER ROLE Y NO EL DASHBOARD: PostgREST lee la config in-db del
-- rol `authenticator`. Existía `pgrst.db_schemas=public, graphql_public, detention`
-- fijado a NIVEL DE ROL, que pisa el "Save" del dashboard (por eso nunca tomó).
-- La única vía que persiste es reescribir el GUC del rol.
--
-- CANAL: aplicada por MCP apply_migration (el guard de infra prod vive en
-- execute_sql, NO en apply_migration — verificado con un probe reversible
-- `ALTER ROLE authenticator SET application_name`). John NO abrió el SQL Editor.
--
-- LAS DOS NOTIFY SON OBLIGATORIAS:
--   reload config → PostgREST relee db_schemas del rol (ve `crm`).
--   reload schema → rebuildea el cache de tablas; sin esto `crm` no aparece
--                   aunque la config ya lo liste (falso-negativo al diagnosticar).
--
-- ORDEN FUERA DE SECUENCIA (A PROPÓSITO): la 015 (hardening de grants) aterriza
-- DESPUÉS de esta 017, no antes. Secuencia: 017 expone crm → test §14.10 (la RLS
-- bloquea a anon CON los grants presentes) → recién ahí 015 revoca los grants.
-- Aplicar 015 antes de la 017 rompería esa prueba (confundiría "RLS bloquea" con
-- "no hay grant").
--
-- ROLLBACK (simétrico, ~10 s, mismo canal apply_migration) — revive v1 sin perder
-- v2 (restaura detention y mantiene crm):
--   ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, detention, crm';
--   NOTIFY pgrst, 'reload config';
--   NOTIFY pgrst, 'reload schema';
-- ============================================================================

ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, crm';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
