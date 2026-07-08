-- ============================================================================
-- 010_fix_function_acl — M1 rebuild v2 CRM Detention
-- Corrección detectada por la mini-auditoría RLS/RPC (§2.3.3):
--
-- El `alter default privileges ... in schema crm revoke execute on functions
-- from public` de la migración 001 NO tiene efecto: los default privileges
-- por-schema son ADITIVOS al default global y no pueden quitar el EXECUTE a
-- PUBLIC built-in de Postgres (pg_default_acl no registra entrada para crm).
-- Consecuencia observada: anon podía EJECUTAR las RPCs (los guards internos
-- de cada función contuvieron el acceso — respondieron 'cuenta no activa' /
-- 'solo un administrador...' sin exponer datos — pero la superficie ACL
-- quedaba más ancha que el diseño de mínimo privilegio del plan §0).
--
-- Fix: REVOKE explícito sobre todas las funciones existentes del schema crm.
-- Se conservan los GRANT EXECUTE explícitos a authenticated ya emitidos.
--
-- REGLA PARA MIGRACIONES FUTURAS (M3+): toda función nueva en crm debe
-- cerrar con `revoke execute on function ... from public;` + su grant
-- explícito — el default de Postgres vuelve a regalar EXECUTE a PUBLIC en
-- cada CREATE FUNCTION.
-- ============================================================================

revoke execute on all functions in schema crm from public, anon;

-- Nota: service_role queda también sin EXECUTE ni grants de tabla en crm
-- (mínimo privilegio; el digest F2 de n8n pedirá su grant puntual cuando
-- exista — documentado en el entregable CP1).
