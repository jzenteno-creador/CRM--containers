-- ============================================================================
-- 036_rollback — neutraliza 036_storage_scan_comprobantes.sql
--
-- CUÁNDO: si un assert post-036 falla (policy de más/menos, mención a
--   anon/public, scope que se escapa del bucket crm-scan-comprobantes, o el
--   bucket quedó public=true). Aplicar INMEDIATAMENTE con apply_migration. No
--   corre en el flujo normal; vive fuera de migrations/ para que
--   `supabase db push` / apply_migration no lo ejecute solo.
--
-- POR QUÉ NO borra el bucket ni los objetos: prohibición absoluta de esta
--   sesión (nunca DROP/TRUNCATE/DELETE FROM en ningún schema). El objetivo del
--   rollback es CERRAR el agujero de permisos, no destruir datos. Dropear las 3
--   policies deja el bucket SIN superficie de acceso para authenticated (RLS de
--   storage.objects sigue ON → sin policy que aplique, authenticated no puede
--   insert/select/delete en él). El teardown total del bucket + sus objetos
--   queda como acción MANUAL sancionada de John.
--
-- SCOPE: sólo las 3 policies crm_scan_comprobantes_* sobre storage.objects. NO
--   toca la fila del bucket, NO toca los buckets/policies de incidencias ni
--   crm-incidencias, NO toca ningún otro objeto ni schema.
-- ============================================================================

drop policy if exists crm_scan_comprobantes_insert on storage.objects;
drop policy if exists crm_scan_comprobantes_select on storage.objects;
drop policy if exists crm_scan_comprobantes_delete on storage.objects;
