-- ============================================================================
-- 035_rollback — neutraliza 035_scan_pruebas.sql
--
-- CUÁNDO: si un assert post-035 falla (RLS off, policy de más/menos, grant a
--   anon/public, grant residual de update/references/trigger/truncate a
--   authenticated, FK aparecida, o comment ausente). Aplicar INMEDIATAMENTE
--   con apply_migration. No se aplica en el flujo normal. Vive fuera de
--   migrations/ para que `supabase db push` / apply_migration no lo corra solo.
--
-- POR QUÉ NO "DROP TABLE": prohibición absoluta de esta sesión (nunca DROP
--   TABLE/VIEW/FUNCTION, TRUNCATE ni DELETE FROM en ningún schema). El objetivo
--   del rollback es CERRAR cualquier agujero de permisos, no destruir. Esta
--   reversa deja la tabla INERTE: RLS on, CERO grants para anon/authenticated/
--   public, SIN policies → nadie (salvo owner/superuser) la puede tocar. Un
--   teardown total de la relación (DROP) queda para una acción sancionada y
--   manual de John.
--
-- SCOPE: sólo crm.scan_pruebas. No toca ningún otro objeto ni schema.
-- ============================================================================

-- 1) Quitar toda superficie de lectura/escritura vía policies.
drop policy if exists scan_pruebas_insert on crm.scan_pruebas;
drop policy if exists scan_pruebas_select on crm.scan_pruebas;
drop policy if exists scan_pruebas_delete on crm.scan_pruebas;

-- 2) Revocar TODO grant de los roles de aplicación (cierra cualquier hueco).
revoke all on crm.scan_pruebas from authenticated;
revoke all on crm.scan_pruebas from anon;
revoke all on crm.scan_pruebas from public;

-- 3) RLS queda ON (tabla sin policies + sin grants = acceso nulo). Refrescar cache.
notify pgrst, 'reload schema';
