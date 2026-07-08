-- ============================================================================
-- 009_storage_incidencias — M1 rebuild v2 CRM Detention
-- Bucket PRIVADO `crm-incidencias` (§14.9 adaptado por §21: el bucket
-- `incidencias` es de v1 — intocable) + policies sobre storage.objects.
--
-- Objetos fuera del schema crm (sancionados por el plan, prefijo crm_):
--   fila en storage.buckets: crm-incidencias
--   policies en storage.objects: crm_incidencias_select / crm_incidencias_insert
--
-- Convención de path: <incidencia_id>/<archivo> — la policy exige que el
-- primer folder sea el uuid de una incidencia VISIBLE para el caller (la RLS
-- de crm.incidencias aplica dentro del EXISTS y encadena hasta el scope de
-- planta de operaciones). Solo perfiles activos; sin UPDATE/DELETE de
-- objetos (§14.9: insert/select solamente).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('crm-incidencias', 'crm-incidencias', false)
on conflict (id) do nothing;

create policy crm_incidencias_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'crm-incidencias'
    and (select p.estado = 'activo' from crm.perfil() p)
    and exists (
      select 1 from crm.incidencias i
       where i.id::text = (storage.foldername(name))[1]
    )
  );

create policy crm_incidencias_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'crm-incidencias'
    and (select p.estado = 'activo' from crm.perfil() p)
    and exists (
      select 1 from crm.incidencias i
       where i.id::text = (storage.foldername(name))[1]
    )
  );
