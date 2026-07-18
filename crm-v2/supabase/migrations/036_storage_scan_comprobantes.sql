-- ============================================================================
-- 036_storage_scan_comprobantes — CRM Detention v2, PoC escaneo OCR
-- Bucket PRIVADO `crm-scan-comprobantes` para las fotos-comprobante del
-- escaneo de siglas de contenedor + policies sobre storage.objects.
-- Decisión explícita de John 2026-07-18 (segunda sesión).
--
-- Objetos fuera del schema crm (sancionados, prefijo crm_):
--   fila en storage.buckets: crm-scan-comprobantes (privado, 5 MiB, jpeg/png)
--   policies en storage.objects:
--     crm_scan_comprobantes_insert / _select / _delete
--
-- Convención de path: <auth.uid()>/<archivo> — el primer folder DEBE ser el
-- uuid del caller. Cada usuario sube y borra sólo en SU carpeta; la lectura es
-- compartida entre authenticated.
--
-- ── DIFERENCIA DELIBERADA con la 009 (crm-incidencias) ──────────────────────
-- Acá NO va gate de `crm.perfil()` ni de `estado = 'activo'`. Es INTENCIONAL,
-- decisión explícita de John: estas policies son el ESPEJO del RLS de
-- `crm.scan_pruebas` (035), que usa `auth.uid()` PELADO — aislamiento por
-- usuario, cero subquery a crm.usuarios / crm.perfil(), cero referencias a M5.
-- Consecuencia asumida: una cuenta pendiente/rechazada con JWT vigente puede
-- leer/insertar/borrar en ESTE bucket, igual que en la tabla scan_pruebas. La
-- ratificación del acceso de cuentas no-activas está PENDIENTE en checkpoint y
-- cubre tabla + bucket JUNTOS. NO "corregir" agregando perfil()/estado acá:
-- rompería la consistencia tabla↔bucket que John pidió.
--
-- SIN policy de UPDATE (nadie updatea un comprobante; se sube uno nuevo).
--
-- SCOPE: cero contacto con los buckets/policies preexistentes (`incidencias`
--   v1, `crm-incidencias` v2 M7 — ambos INTOCABLES). Cero DDL fuera de la fila
--   nueva en storage.buckets + las 3 policies nuevas en storage.objects. No
--   toca crm/detention/public/auth/realtime/supabase_migrations.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crm-scan-comprobantes', 'crm-scan-comprobantes', false, 5242880, array['image/jpeg','image/png'])
on conflict (id) do nothing;

-- INSERT: cada usuario sube SÓLO a su carpeta <auth.uid()>/…
create policy crm_scan_comprobantes_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'crm-scan-comprobantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: lectura compartida entre authenticated — espejo del SELECT using(true)
-- de crm.scan_pruebas (banco de pruebas, sin PII).
create policy crm_scan_comprobantes_select on storage.objects
  for select to authenticated
  using (bucket_id = 'crm-scan-comprobantes');

-- DELETE: cada usuario borra SÓLO lo propio ("limpiar mis registros").
create policy crm_scan_comprobantes_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'crm-scan-comprobantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
