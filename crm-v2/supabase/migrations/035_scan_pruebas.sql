-- ═══════════════════════════════════════════════════════════════════════════
-- 035 · SCAN_PRUEBAS — tabla de PRUEBA para escaneos OCR de contenedores
--       (decisión explícita de John, 2026-07-18)
--
-- Qué es: banco de pruebas DESECHABLE para testear el OCR de siglas de
-- contenedor (sigla leída, check-digit, confianza del modelo, imagen). NO es
-- productiva, NO toca plata, NO tiene auditoría. Por eso — y sólo por eso — se
-- sanciona ESCRITURA DIRECTA (INSERT/DELETE) bajo RLS, sin RPC. Es la
-- excepción, no el patrón: toda tabla con impacto de costo o timeline sigue
-- siendo RPC-only (AGENTS.md, regla-cero-update-crudo).
--
-- SCOPE: UN solo objeto nuevo en el schema crm. NO toca detention (v1), public
--   (pipelines EDI), auth/storage/realtime/supabase_migrations, ni ningún otro
--   schema. Cero DDL fuera de crm.scan_pruebas.
--
-- SIN FKs a NADA (ni auth.users, ni crm.usuarios, ni tablas de M5). La
-- pertenencia se resuelve con auth.uid() puro — las policies NO hacen subquery
-- a crm.usuarios / crm.perfil(). `usuario_id` es un uuid libre que por default
-- toma auth.uid() en el alta.
--
-- RLS: activada. INSERT (fila propia), SELECT (compartido — banco de pruebas,
--   decisión John), DELETE (sólo filas propias). SIN policy de UPDATE (nadie
--   updatea).
--
-- Grants: default-deny para anon/PUBLIC; authenticated obtiene EXACTAMENTE
--   select+insert+delete; se REVOCAN explícitamente update/references/trigger/
--   truncate aunque un CREATE TABLE no los otorgue a authenticated (en este
--   proyecto pg_default_acl de crm está vacío → un objeto nuevo grantea sólo a
--   su owner; el revoke explícito es defense-in-depth contra grants fantasma).
-- ═══════════════════════════════════════════════════════════════════════════

create table crm.scan_pruebas (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null default auth.uid(),
  sigla_leida        text,
  check_digit_valido boolean,
  confianza          numeric,
  modelo_usado       text,
  imagen_url         text,
  created_at         timestamptz not null default now()
);

comment on table crm.scan_pruebas is
  'TABLA DE PRUEBA — datos desechables de testeo de OCR, no productiva';

alter table crm.scan_pruebas enable row level security;

-- INSERT: authenticated crea SÓLO filas propias (usuario_id = su auth.uid()).
-- El default de columna ya pone auth.uid(); el with check lo hace ley.
create policy scan_pruebas_insert on crm.scan_pruebas
  for insert to authenticated
  with check (usuario_id = auth.uid());

-- SELECT: banco de pruebas compartido — cualquier autenticado lee todo
-- (decisión explícita de John: datos desechables de test, sin PII).
create policy scan_pruebas_select on crm.scan_pruebas
  for select to authenticated
  using (true);

-- DELETE: sólo filas propias. Sin policy de UPDATE (nadie updatea).
create policy scan_pruebas_delete on crm.scan_pruebas
  for delete to authenticated
  using (usuario_id = auth.uid());

-- Grants — default-deny explícito + mínimo privilegio para authenticated.
revoke all on crm.scan_pruebas from anon;
revoke all on crm.scan_pruebas from public;
grant select, insert, delete on crm.scan_pruebas to authenticated;
-- Revoke explícito de lo que NO debe tener, aunque un CREATE TABLE no lo
-- otorgue (grants fantasma / default privileges — lección real del proyecto).
revoke update, references, trigger, truncate on crm.scan_pruebas from authenticated;

-- PostgREST no ve la tabla nueva sin esto → PGRST205 y el front muere.
notify pgrst, 'reload schema';
