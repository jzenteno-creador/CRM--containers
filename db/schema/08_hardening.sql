-- generado desde cctuowthpnstvdgjuomq el 2026-07-05, hardening aplicado (ítem 0.4 Fase 2)
-- Estado de grants del rol anon/authenticated tras el REVOKE de DELETE/TRUNCATE.
-- Contexto: la app va directo a Supabase con la anon key (sin BE-01 server-side todavía),
-- por eso conserva SELECT/INSERT/UPDATE + EXECUTE. Se le sacan solo los verbos destructivos.
-- Verificado read-only: la app NO emite ningún .delete()/.remove() y las 11 RPCs (SECURITY
-- INVOKER) no hacen DELETE/TRUNCATE internamente — el revoke no rompe ninguna operación real.

-- APLICADO 2026-07-05 (execute_sql, no vía migration):
REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA detention FROM anon, authenticated;

-- Corta la causa raíz: el default privilege del owner 'postgres' hacía que cada tabla nueva
-- naciera con grant completo (incluido DELETE/TRUNCATE) para anon/authenticated.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA detention
  REVOKE DELETE, TRUNCATE ON TABLES FROM anon, authenticated;

-- Estado resultante verificado (information_schema.role_table_grants):
--   anon          → INSERT, REFERENCES, SELECT, TRIGGER, UPDATE   (sin DELETE/TRUNCATE)
--   authenticated → INSERT, REFERENCES, SELECT, TRIGGER, UPDATE   (sin DELETE/TRUNCATE)
--   service_role  → intacto (canal server-side confiable)

-- PENDIENTE (no aplicado acá): rotación de la anon key committeada. El proyecto ya tiene una
-- publishable key nueva (sb_publishable_...) habilitada en paralelo → permite migrar sin
-- downtime. Requiere setear NEXT_PUBLIC_SUPABASE_* en Vercel + quitar el fallback hardcodeado
-- de src/lib/supabase.ts + deploy, y recién ahí desactivar la key legacy. Ver handoff.
