-- 037: hardening Bloque 1 (auditoría 2026-07-31, GO de John en la misma sesión)
-- APLICADA en prod el 2026-07-31 vía MCP apply_migration.
--
-- (1) Rebind de las 5 policies "huérfanas" de la 004: TO authenticated -> TO crm_rpc_executor.
--     NO se dropean (el fix ingenuo habría roto prod): sus predicados rol+planta via
--     crm.perfil() son los que autorizan y scopean a las RPCs (que corren como
--     crm_rpc_executor, hasta ahora matcheando por membresía en authenticated).
--     El rebind conserva el predicado byte a byte y cierra la reapertura accidental:
--     si un grant a authenticated vuelve por error, RLS ya no lo respalda.
--     Verificado en harness transaccional pre-apply (T1-T4: insert contenedor/operación/
--     movimiento + update operación PASAN como executor con claims reales de un supervisor
--     activo; authenticated puro -> 42501) y smoke post-apply idéntico.
alter policy operaciones_insert  on crm.operaciones        to crm_rpc_executor;
alter policy operaciones_update  on crm.operaciones        to crm_rpc_executor;
alter policy movimientos_insert  on crm.movimientos_planta to crm_rpc_executor;
alter policy movimientos_update  on crm.movimientos_planta to crm_rpc_executor;
alter policy contenedores_insert on crm.contenedores       to crm_rpc_executor;

-- (2) scan_pruebas: fix del antipatrón auth_rls_initplan (advisor WARN) —
--     (select auth.uid()) se evalúa una vez por query, no por fila.
alter policy scan_pruebas_insert on crm.scan_pruebas with check (usuario_id = (select auth.uid()));
alter policy scan_pruebas_delete on crm.scan_pruebas using (usuario_id = (select auth.uid()));

-- (3) Bucket de evidencia de reclamos: límites que el bucket de PoC (036) tenía y este no.
--     8 MiB de techo (el front comprime a ~<1MB; el techo es el cinturón, no la norma).
update storage.buckets
   set file_size_limit = 8388608,
       allowed_mime_types = array['image/jpeg','image/png','image/webp']
 where id = 'crm-incidencias';

-- (4) Bucket v1 'incidencias': era público, listable y con policy ALL para anon+authenticated
--     (hallazgo del harness, peor que el WARN del advisor), con 0 objetos.
--     El DELETE directo lo bloquea storage.protect_delete() -> queda PRIVADO e INERTE
--     (sin policies = cero acceso). Baja física: John desde dashboard (Storage ->
--     incidencias -> Delete bucket), acción sancionada manual.
drop policy if exists incidencias_demo_all on storage.objects;
update storage.buckets set public = false where id = 'incidencias';
