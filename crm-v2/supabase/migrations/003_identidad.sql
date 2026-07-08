-- ============================================================================
-- 003_identidad — M1 rebuild v2 CRM Detention
-- usuarios + RLS + handle_new_user + bootstrap admin (Decisión 8) + RPCs de
-- administración de cuentas (aprobar/rechazar/set_estado — §12/§13/§14.6).
--
-- SECURITY DEFINER de esta migración (todos en la lista cerrada del plan):
--   handle_new_user, bootstrap_admin (funciones de trigger sobre auth.users —
--   escriben en crm.usuarios/crm.configuracion), aprobar_usuario,
--   rechazar_usuario, set_estado_usuario. Toda DEFINER: search_path pinneado
--   + guard de perfil activo en la primera línea (los triggers de auth no
--   tienen caller de app: su "guard" es el evento de auth mismo).
--
-- Objetos fuera del schema crm (sancionados por el plan, prefijo crm_):
--   trigger crm_handle_new_user ON auth.users
--   trigger crm_bootstrap_admin ON auth.users
--
-- Desvío documentado: se agrega columna `rechazo_motivo` (§12.3 exige
-- rechazo CON motivo y el spec §4 no le da columna; sin ella el motivo del
-- rechazo no tendría dónde vivir).
-- ============================================================================

create table crm.usuarios (
  id                  uuid primary key default gen_random_uuid(),
  auth_user_id        uuid not null unique references auth.users(id) on delete cascade,
  email               text not null unique,
  nombre              text not null,
  rol                 text check (rol in ('operador', 'supervisor', 'administrador')),
  planta_asignada_id  uuid references crm.plantas(id),
  estado_cuenta       text not null default 'pendiente_aprobacion'
                      check (estado_cuenta in
                        ('pendiente_aprobacion', 'activo', 'rechazado', 'suspendido')),
  aprobado_por        uuid references crm.usuarios(id),
  fecha_aprobacion    timestamptz,
  rechazo_motivo      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- §18.3: operador siempre con planta asignada
  constraint ck_operador_con_planta
    check (not (rol = 'operador' and planta_asignada_id is null))
);

create index ix_usuarios_planta on crm.usuarios (planta_asignada_id);
create index ix_usuarios_aprobado_por on crm.usuarios (aprobado_por);
create index ix_usuarios_estado on crm.usuarios (estado_cuenta);

create trigger trg_usuarios_upd
  before update on crm.usuarios
  for each row execute function crm.set_updated_at();

alter table crm.usuarios enable row level security;

-- §14.6: cada uno lee su propia fila (solo si está activo — §14.3: pendiente/
-- rechazado/suspendido no leen NADA, la pantalla de espera se resuelve por
-- ausencia de fila); listado completo solo admin. UNA policy permissive por
-- (rol, acción) para no duplicar evaluación (advisor multiple_permissive_policies).
create policy usuarios_select on crm.usuarios
  for select to authenticated
  using (
    (auth_user_id = (select auth.uid()) and estado_cuenta = 'activo')
    or (select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p)
  );

-- SIN policies de INSERT/UPDATE/DELETE: el alta la hace el trigger de auth y
-- rol/estado/planta solo mutan vía las RPCs DEFINER de admin (§14.6).
grant select on crm.usuarios to authenticated;

-- FK diferida desde 002 (configuracion.updated_by → usuarios)
alter table crm.configuracion
  add constraint configuracion_updated_by_fkey
  foreign key (updated_by) references crm.usuarios(id);

create index ix_configuracion_updated_by on crm.configuracion (updated_by);

-- ----------------------------------------------------------------------------
-- handle_new_user — AFTER INSERT ON auth.users (§12.1)
-- Crea la fila espejo en crm.usuarios con estado pendiente_aprobacion.
-- Idempotente (ON CONFLICT DO NOTHING) y tolerante a config ausente (no lee
-- configuracion: el default de la tabla ya es pendiente).
-- ----------------------------------------------------------------------------
create or replace function crm.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into crm.usuarios (auth_user_id, email, nombre)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
             split_part(new.email, '@', 1))
  )
  on conflict (auth_user_id) do nothing;
  return new;
end $$;

create trigger crm_handle_new_user
  after insert on auth.users
  for each row execute function crm.handle_new_user();

-- ----------------------------------------------------------------------------
-- bootstrap_admin — AFTER UPDATE OF email_confirmed_at ON auth.users
-- (Decisión 8). Promueve a administrador activo SOLO si:
--   1. la fila transiciona de no-confirmado a confirmado (una sola vez),
--   2. el email coincide con configuracion.admin_bootstrap_email,
--   3. no existe OTRO administrador activo (guard primer-admin-único),
--   4. el usuario sigue pendiente_aprobacion.
-- Tras promover, consume la clave (valor = null) — un solo uso.
-- Cierra el vector de pre-registro: quien registre ese email sin ser John
-- nunca lo confirma (el inbox es de John).
-- ----------------------------------------------------------------------------
create or replace function crm.bootstrap_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bootstrap text;
begin
  -- solo la transición sin-confirmar → confirmado dispara la evaluación
  if new.email_confirmed_at is null or old.email_confirmed_at is not null then
    return new;
  end if;

  -- clave consumida (valor json null) ⇒ v_bootstrap NULL ⇒ no-op
  select valor #>> '{}' into v_bootstrap
    from crm.configuracion
   where clave = 'admin_bootstrap_email';

  if v_bootstrap is null or lower(new.email) is distinct from lower(v_bootstrap) then
    return new;
  end if;

  if exists (
    select 1 from crm.usuarios u
     where u.rol = 'administrador'
       and u.estado_cuenta = 'activo'
       and u.auth_user_id <> new.id
  ) then
    return new;
  end if;

  update crm.usuarios
     set rol = 'administrador',
         estado_cuenta = 'activo',
         fecha_aprobacion = now()
   where auth_user_id = new.id
     and estado_cuenta = 'pendiente_aprobacion';

  if found then
    update crm.configuracion
       set valor = 'null'::jsonb
     where clave = 'admin_bootstrap_email';
  end if;

  return new;
end $$;

create trigger crm_bootstrap_admin
  after update of email_confirmed_at on auth.users
  for each row execute function crm.bootstrap_admin();

-- ----------------------------------------------------------------------------
-- RPCs de administración de cuentas — SECURITY DEFINER, solo admin (§12, §13)
-- ----------------------------------------------------------------------------
create or replace function crm.aprobar_usuario(
  p_usuario_id uuid,
  p_rol text,
  p_planta_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller record;
begin
  select * into v_caller from crm.perfil();
  if v_caller.estado is distinct from 'activo' or v_caller.rol is distinct from 'administrador' then
    raise exception 'solo un administrador activo puede aprobar usuarios';
  end if;
  if p_rol is null or p_rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'rol inválido: %', p_rol;
  end if;
  if p_rol = 'operador' and p_planta_id is null then
    raise exception 'un operador requiere planta asignada (§18.3)';
  end if;

  update crm.usuarios
     set rol = p_rol,
         planta_asignada_id = p_planta_id,
         estado_cuenta = 'activo',
         aprobado_por = v_caller.usuario_id,
         fecha_aprobacion = now(),
         rechazo_motivo = null
   where id = p_usuario_id
     and estado_cuenta = 'pendiente_aprobacion';

  if not found then
    raise exception 'el usuario no está pendiente de aprobación';
  end if;
end $$;

grant execute on function crm.aprobar_usuario(uuid, text, uuid) to authenticated;

create or replace function crm.rechazar_usuario(
  p_usuario_id uuid,
  p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller record;
begin
  select * into v_caller from crm.perfil();
  if v_caller.estado is distinct from 'activo' or v_caller.rol is distinct from 'administrador' then
    raise exception 'solo un administrador activo puede rechazar usuarios';
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'motivo obligatorio para rechazar';
  end if;

  update crm.usuarios
     set estado_cuenta = 'rechazado',
         rechazo_motivo = p_motivo
   where id = p_usuario_id
     and estado_cuenta = 'pendiente_aprobacion';

  if not found then
    raise exception 'el usuario no está pendiente de aprobación';
  end if;
end $$;

grant execute on function crm.rechazar_usuario(uuid, text) to authenticated;

-- Suspensión / reactivación (§12.5): pierde acceso inmediato vía RLS,
-- sin borrar historial.
create or replace function crm.set_estado_usuario(
  p_usuario_id uuid,
  p_estado text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller record;
begin
  select * into v_caller from crm.perfil();
  if v_caller.estado is distinct from 'activo' or v_caller.rol is distinct from 'administrador' then
    raise exception 'solo un administrador activo puede cambiar estados de cuenta';
  end if;
  if p_estado is null or p_estado not in ('activo', 'suspendido') then
    raise exception 'estado inválido: % (solo activo|suspendido; pendientes van por aprobar/rechazar)', p_estado;
  end if;
  if p_usuario_id = v_caller.usuario_id then
    raise exception 'no podés cambiar tu propio estado de cuenta';
  end if;

  update crm.usuarios
     set estado_cuenta = p_estado
   where id = p_usuario_id
     and estado_cuenta in ('activo', 'suspendido');

  if not found then
    raise exception 'el usuario no está activo ni suspendido';
  end if;
end $$;

grant execute on function crm.set_estado_usuario(uuid, text) to authenticated;
