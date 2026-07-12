-- ============================================================================
-- 015_rollback.sql — Reversa EXACTA de 015_hardening_grants_crm.sql
--
-- CUÁNDO USARLO: si un assert post-015 (verifier tier distinto) falla —
--   en particular 3.2 (sup GET operaciones ⇒ 200 + filas) o 3.3 (sup GET
--   vista_alertas ⇒ 200 + ≥1 fila). Aplicar INMEDIATAMENTE con apply_migration
--   para restaurar el estado de grants previo a la 015.
--
-- NO se aplica en el flujo normal. Vive fuera de migrations/ para que
-- `supabase db push` / apply_migration no lo corra por accidente.
--
-- ESTADO CAPTURADO ANTES DE LA 015 (pg_class.relacl, 2026-07-12):
--   Los 14 objetos de crm (12 tablas + 2 views: usuarios_publicos, vista_alertas)
--   tenían relacl idéntico:
--     {postgres=arwdDxtm/postgres, authenticated=arwd/postgres,
--      anon=arwd/postgres, service_role=arwd/postgres}
--   es decir anon y authenticated con INSERT, SELECT, UPDATE, DELETE (a,r,w,d).
--   pg_default_acl de crm: VACÍO. anon SIN EXECUTE en toda función de crm.
--
-- Los GRANT de abajo reconstruyen EXACTAMENTE ese relacl (a,r,w,d para anon y
-- authenticated en las 14 relaciones). No se reconstruye nada sobre funciones
-- (anon nunca tuvo EXECUTE) ni sobre default privileges (estaban vacíos: la
-- 015 hizo REVOKE de algo inexistente = no-op, no hay nada que reponer).
-- ============================================================================

-- Restaura anon = arwd sobre las 14 relaciones (tablas + views).
grant select, insert, update, delete on all tables in schema crm to anon;

-- Restaura authenticated = arwd (repone DELETE en las 12 tablas + vista_alertas,
-- y repone INSERT/UPDATE/DELETE en la view usuarios_publicos).
grant select, insert, update, delete on all tables in schema crm to authenticated;

-- Funciones: sin cambios que revertir (anon nunca tuvo EXECUTE en crm).
-- Default privileges: sin cambios que revertir (pg_default_acl de crm estaba vacío).
