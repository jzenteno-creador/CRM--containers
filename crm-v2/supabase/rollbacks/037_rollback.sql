-- Rollback neutralizador de la 037 — NUNCA destructivo (regla de la casa).
-- Revierte cada pieza a su estado pre-037 EXACTO. Correr solo con GO explícito de John.
--
-- (1) Re-bind de las 5 policies a authenticated (estado 004-036). Los predicados no se
--     tocaron en la 037, así que el rebind inverso restaura el comportamiento previo
--     (executor vuelve a matchear por membresía; authenticated sigue sin grant desde 025).
alter policy operaciones_insert  on crm.operaciones        to authenticated;
alter policy operaciones_update  on crm.operaciones        to authenticated;
alter policy movimientos_insert  on crm.movimientos_planta to authenticated;
alter policy movimientos_update  on crm.movimientos_planta to authenticated;
alter policy contenedores_insert on crm.contenedores       to authenticated;

-- (2) scan_pruebas: volver al auth.uid() por fila (forma pre-037, funcionalmente idéntica).
alter policy scan_pruebas_insert on crm.scan_pruebas with check (usuario_id = auth.uid());
alter policy scan_pruebas_delete on crm.scan_pruebas using (usuario_id = auth.uid());

-- (3) crm-incidencias: quitar límites (estado pre-037: sin file_size_limit ni mimes).
update storage.buckets
   set file_size_limit = null, allowed_mime_types = null
 where id = 'crm-incidencias';

-- (4) Bucket 'incidencias': NO se recrea la policy demo ni se vuelve público — eso era el
--     hueco de seguridad, no un estado a restaurar. Si hiciera falta de verdad:
--     update storage.buckets set public = true where id = 'incidencias';
--     create policy incidencias_demo_all on storage.objects for all to anon, authenticated
--       using (bucket_id = 'incidencias');
