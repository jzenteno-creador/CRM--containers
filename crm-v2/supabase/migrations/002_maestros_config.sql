-- ============================================================================
-- 002_maestros_config — M1 rebuild v2 CRM Detention
-- Maestros: plantas, navieras, freetime_origin (versionado), configuracion,
-- ayuda_contenido. Regla §14.1: cada tabla nace con RLS ON + policies en esta
-- misma migración.
--
-- Matriz RLS (plan §2.2):
--   plantas                → SELECT activo; escritura: nadie
--   navieras               → SELECT activo; INSERT/UPDATE admin
--   freetime_origin        → SELECT activo; SIN policies de escritura
--                            (versionado solo vía crm_nueva_version_freetime,
--                             SECURITY DEFINER con check de rol — evita
--                             vigencias solapadas en el money-path)
--   configuracion          → SELECT activo; INSERT/UPDATE admin
--   ayuda_contenido        → SELECT activo; INSERT/UPDATE admin
-- Sin DELETE para roles de app en ninguna tabla (soft delete §4).
--
-- Nota de dependencias: configuracion.updated_by referencia crm.usuarios,
-- que nace en 003 — la FK se agrega allá.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- plantas
-- ----------------------------------------------------------------------------
create table crm.plantas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique check (nombre in ('BAHIA', 'ABBOTT')),
  codigo     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_plantas_upd
  before update on crm.plantas
  for each row execute function crm.set_updated_at();

alter table crm.plantas enable row level security;

create policy plantas_select on crm.plantas
  for select to authenticated
  using ((select p.estado = 'activo' from crm.perfil() p));

grant select on crm.plantas to authenticated;

-- Seed (el CHECK fija el universo; códigos = paridad v1)
insert into crm.plantas (nombre, codigo) values
  ('BAHIA', 'BAH'),
  ('ABBOTT', 'ABB');

-- ----------------------------------------------------------------------------
-- navieras
-- ----------------------------------------------------------------------------
create table crm.navieras (
  id                      uuid primary key default gen_random_uuid(),
  nombre                  text not null unique,
  cobra_detention_origen  boolean not null default true,  -- paridad v1: costo NULL si false
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger trg_navieras_upd
  before update on crm.navieras
  for each row execute function crm.set_updated_at();

alter table crm.navieras enable row level security;

create policy navieras_select on crm.navieras
  for select to authenticated
  using ((select p.estado = 'activo' from crm.perfil() p));

create policy navieras_insert_admin on crm.navieras
  for insert to authenticated
  with check ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p));

create policy navieras_update_admin on crm.navieras
  for update to authenticated
  using ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p))
  with check ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p));

grant select, insert, update on crm.navieras to authenticated;

-- ----------------------------------------------------------------------------
-- freetime_origin — VERSIONADO: nunca UPDATE de tarifa, siempre fila nueva
-- (cerrando la anterior). Escritura EXCLUSIVA vía crm_nueva_version_freetime.
-- ----------------------------------------------------------------------------
create table crm.freetime_origin (
  id                      uuid primary key default gen_random_uuid(),
  naviera_id              uuid not null references crm.navieras(id),
  pais                    text not null default 'ARGENTINA',
  regimen                 text not null default 'vacios'
                          check (regimen in ('vacios', 'cargados', 'sin_uso')),
  dias_libres             integer not null check (dias_libres >= 0),
  aplica_carga_peligrosa  boolean not null default false,
  tipo                    text not null check (tipo in ('Detention', 'Demurrage', 'Combined')),
  tarifa_usd_dia          numeric(10,2) not null check (tarifa_usd_dia >= 0),
  vigente_desde           date not null,
  vigente_hasta           date,          -- null = vigente
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint ck_vigencia_coherente
    check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

-- D-10 v1: una sola versión vigente por (naviera, régimen) — cierra la carrera
-- concurrente de crm_nueva_version_freetime (Decisión 4: regimen es clave)
create unique index ux_freetime_vigente
  on crm.freetime_origin (naviera_id, regimen)
  where vigente_hasta is null;

create index ix_freetime_naviera
  on crm.freetime_origin (naviera_id, vigente_desde desc);

create trigger trg_freetime_upd
  before update on crm.freetime_origin
  for each row execute function crm.set_updated_at();

alter table crm.freetime_origin enable row level security;

create policy freetime_select on crm.freetime_origin
  for select to authenticated
  using ((select p.estado = 'activo' from crm.perfil() p));

-- SIN policies de INSERT/UPDATE: la única vía de escritura para roles de app
-- es la RPC DEFINER de abajo. El grant de tabla queda en SELECT solamente.
grant select on crm.freetime_origin to authenticated;

-- ----------------------------------------------------------------------------
-- configuracion — key-value editable desde Admin (§4)
-- ----------------------------------------------------------------------------
create table crm.configuracion (
  clave      text primary key,
  valor      jsonb not null,
  updated_by uuid,  -- FK a crm.usuarios se agrega en 003
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_configuracion_upd
  before update on crm.configuracion
  for each row execute function crm.set_updated_at();

alter table crm.configuracion enable row level security;

create policy configuracion_select on crm.configuracion
  for select to authenticated
  using ((select p.estado = 'activo' from crm.perfil() p));

create policy configuracion_insert_admin on crm.configuracion
  for insert to authenticated
  with check ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p));

create policy configuracion_update_admin on crm.configuracion
  for update to authenticated
  using ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p))
  with check ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p));

grant select, insert, update on crm.configuracion to authenticated;

-- Seeds (§4 + Decisión 8: el trigger de bootstrap de 003 lee
-- admin_bootstrap_email y lo consume tras el uso)
insert into crm.configuracion (clave, valor) values
  ('umbral_alerta_amarillo', '{"dias": 3}'::jsonb),
  ('dominios_sugeridos', '["ssbint.com"]'::jsonb),
  ('admin_bootstrap_email', '"jzenteno@ssbint.com"'::jsonb);

-- ----------------------------------------------------------------------------
-- ayuda_contenido — banco de consultas editable desde Admin (§15)
-- ----------------------------------------------------------------------------
create table crm.ayuda_contenido (
  id           uuid primary key default gen_random_uuid(),
  seccion      text not null check (seccion in
               ('ingreso', 'egreso', 'contenedores', 'alertas', 'incidencias',
                'admin', 'dashboard', 'faq')),
  titulo       text not null,
  contenido_md text not null,
  orden        integer not null default 0,
  publicado    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index ix_ayuda_seccion on crm.ayuda_contenido (seccion, orden);

create trigger trg_ayuda_upd
  before update on crm.ayuda_contenido
  for each row execute function crm.set_updated_at();

alter table crm.ayuda_contenido enable row level security;

create policy ayuda_select on crm.ayuda_contenido
  for select to authenticated
  using ((select p.estado = 'activo' from crm.perfil() p));

create policy ayuda_insert_admin on crm.ayuda_contenido
  for insert to authenticated
  with check ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p));

create policy ayuda_update_admin on crm.ayuda_contenido
  for update to authenticated
  using ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p))
  with check ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p));

grant select, insert, update on crm.ayuda_contenido to authenticated;

-- ----------------------------------------------------------------------------
-- crm_nueva_version_freetime — SECURITY DEFINER (lista cerrada del plan).
-- Única vía de escritura de freetime_origin: valida entradas, cierra la
-- versión vigente (vigente_hasta = p_desde - 1) e inserta la nueva.
-- Idempotente; scoped por (naviera, régimen). Guard primera línea (§14.8).
-- ----------------------------------------------------------------------------
create or replace function crm.crm_nueva_version_freetime(
  p_naviera uuid,
  p_dias integer,
  p_peligrosa boolean,
  p_tipo text,
  p_tarifa numeric,
  p_desde date,
  p_regimen text default 'vacios')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller record;
  v_id uuid;
  v_prev record;
begin
  select * into v_caller from crm.perfil();
  if v_caller.estado is distinct from 'activo' or v_caller.rol is distinct from 'administrador' then
    raise exception 'solo un administrador activo puede versionar tarifas';
  end if;

  if p_naviera is null then raise exception 'naviera obligatoria'; end if;
  if p_regimen is null or p_regimen not in ('vacios', 'cargados', 'sin_uso') then
    raise exception 'régimen inválido: %', p_regimen;
  end if;
  if p_tipo is null or p_tipo not in ('Detention', 'Demurrage', 'Combined') then
    raise exception 'tipo inválido: %', p_tipo;
  end if;
  if p_dias is null or p_dias < 0 then raise exception 'días libres inválidos: %', p_dias; end if;
  if p_tarifa is null or p_tarifa < 0 then raise exception 'tarifa inválida: %', p_tarifa; end if;
  if p_desde is null then raise exception 'fecha de vigencia obligatoria'; end if;

  select * into v_prev
    from crm.freetime_origin
   where naviera_id = p_naviera and regimen = p_regimen and vigente_hasta is null
   limit 1;

  -- idempotencia: misma versión ⇒ devolver la existente
  if v_prev.id is not null
     and v_prev.vigente_desde = p_desde
     and v_prev.dias_libres = p_dias
     and v_prev.tarifa_usd_dia = p_tarifa
     and v_prev.tipo = p_tipo
     and v_prev.aplica_carga_peligrosa = p_peligrosa then
    return v_prev.id;
  end if;

  if v_prev.id is not null and p_desde <= v_prev.vigente_desde then
    raise exception 'la vigencia nueva (%) debe ser posterior al inicio de la versión vigente (%)',
      p_desde, v_prev.vigente_desde;
  end if;

  if v_prev.id is not null then
    update crm.freetime_origin set vigente_hasta = p_desde - 1 where id = v_prev.id;
  end if;

  insert into crm.freetime_origin
    (naviera_id, regimen, dias_libres, aplica_carga_peligrosa, tipo,
     tarifa_usd_dia, vigente_desde, vigente_hasta)
  values
    (p_naviera, p_regimen, p_dias, p_peligrosa, p_tipo, p_tarifa, p_desde, null)
  returning id into v_id;

  return v_id;
end $$;

grant execute on function crm.crm_nueva_version_freetime(uuid, integer, boolean, text, numeric, date, text)
  to authenticated;
