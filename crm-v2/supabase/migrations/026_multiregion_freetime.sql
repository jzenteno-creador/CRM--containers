-- ============================================================================
-- 026_multiregion_freetime — M5 rebuild v2 CRM Detention
--
-- SSB es exportador: hoy freetime_origin describe SOLO el freetime de retiro
-- de vacíos en Argentina, y el motor (vista_alertas / vista_kpi_costos_cerradas)
-- resuelve la tarifa vigente por (naviera, régimen, fecha) SIN filtrar por país.
-- Con 14 filas — todas ARGENTINA — nunca se notó. En cuanto exista una segunda
-- fila de otro país para la misma naviera/régimen, el LATERAL puede elegir
-- CUALQUIERA de las dos (bug latente, confirmado no ejercitado hasta ahora).
--
-- Esta migración:
--   1. crm.paises — maestro de países con región (LATAM/EMEAI/APAC/NAM).
--   2. crm.plantas.pais_id — cada planta pertenece a un país (hoy: ARGENTINA).
--   3. crm.navieras.tipo_proveedor / .activa — clasificación naviera/forwarder
--      (paridad Excel; la 027 hace el mapping real, acá solo el DDL).
--   4. crm.freetime_origin: pais_id (reemplaza la columna `pais` text, que no
--      se usaba en ningún lookup — verificado con pg_depend + grep del front,
--      cero referencias), hub, freetime_reefer, tarifa_reefer_usd_dia, nota.
--      Unicidad de vigencia pasa a (naviera, régimen, país, hub).
--   5. crm.freetime_destino — tabla NUEVA, misma filosofía versionada, para el
--      freetime en el país de DESTINO (el reloj arranca en el arribo, no en el
--      retiro). Combined/Demurrage/Detention se guardan TAL CUAL el contrato:
--      Combined NO es derivable de dem+det (78% de mismatch medido en el
--      contrato real) — three-column money-path, no lógica derivada.
--   6. crm_nueva_version_freetime extendida (pais/hub/reefer/nota, DEFAULT
--      NULL salvo país que default ARGENTINA — compat total con el front M9
--      actual, que solo manda los 9 parámetros originales).
--   7. crm_nueva_version_freetime_destino — RPC espejo, sin legacy que cuidar
--      (tabla nueva), p_pais obligatorio.
--   8. Fix del motor: las 2 vistas base ahora filtran freetime_origin por el
--      país de la planta actual de la operación (y hub nacional = NULL, único
--      caso que existe hoy). Con datos 100% ARGENTINA el resultado es
--      IDÉNTICO al pre-migración (snapshot tomado y comparado — ver reporte).
--
-- Guard §14.8: ambas RPC son SECURITY DEFINER owner postgres (mismo patrón que
-- la crm_nueva_version_freetime actual — NO se migran a crm_rpc_executor, esa
-- lista es exclusiva de las 6 RPCs operativas de la 025). Primera línea =
-- guard de rol admin activo, igual que la existente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) crm.paises
-- ----------------------------------------------------------------------------
create table crm.paises (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique check (length(trim(nombre)) > 0),
  region     text not null check (region in ('LATAM', 'EMEAI', 'APAC', 'NAM')),
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_paises_upd
  before update on crm.paises
  for each row execute function crm.set_updated_at();

alter table crm.paises enable row level security;

create policy paises_select on crm.paises
  for select to authenticated
  using ((select p.estado = 'activo' from crm.perfil() p));

create policy paises_insert_admin on crm.paises
  for insert to authenticated
  with check ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p));

create policy paises_update_admin on crm.paises
  for update to authenticated
  using ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p))
  with check ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p));

-- Escritura directa desde Admin = SANCIONADA (John, 2026-07-14, D4 del plan M5):
-- maestro sin impacto en costo, mismo patrón que navieras/plantas/depositos.
grant select, insert, update on crm.paises to authenticated;

insert into crm.paises (nombre, region) values ('ARGENTINA', 'LATAM');
-- El resto de los países los seedea la 027 (mapping del Excel de contratos).

-- ----------------------------------------------------------------------------
-- 2) crm.plantas — pais_id (todas las plantas existentes son de ARGENTINA)
-- ----------------------------------------------------------------------------
alter table crm.plantas
  add column pais_id uuid references crm.paises(id);

update crm.plantas
   set pais_id = (select id from crm.paises where nombre = 'ARGENTINA');

alter table crm.plantas
  alter column pais_id set not null;

-- ----------------------------------------------------------------------------
-- 3) crm.navieras — tipo_proveedor / activa (DDL solo; la 027 clasifica)
-- ----------------------------------------------------------------------------
alter table crm.navieras
  add column tipo_proveedor text not null default 'naviera'
    check (tipo_proveedor in ('naviera', 'forwarder')),
  add column activa boolean not null default true;

-- ----------------------------------------------------------------------------
-- 4) crm.freetime_origin — multi-región + reefer + nota; drop de `pais` text
-- ----------------------------------------------------------------------------
alter table crm.freetime_origin
  add column pais_id                uuid references crm.paises(id),
  add column hub                    text,
  add column freetime_reefer        integer check (freetime_reefer >= 0),
  add column tarifa_reefer_usd_dia  numeric(10,2) check (tarifa_reefer_usd_dia >= 0),
  add column nota                   text;

comment on column crm.freetime_origin.nota is
  'documenta ajustes operativos vs contrato — ej. ARG 14 días confirmado O. Pérez 2026-07-13';

update crm.freetime_origin
   set pais_id = (select id from crm.paises where nombre = 'ARGENTINA');

alter table crm.freetime_origin
  alter column pais_id set not null;

drop index crm.ux_freetime_vigente;

create unique index ux_freetime_vigente
  on crm.freetime_origin (naviera_id, regimen, pais_id, coalesce(hub, ''))
  where vigente_hasta is null;

-- Verificado: pg_depend sin dependientes de la columna `pais` fuera de sí misma;
-- grep del front (crm-v2/src) y de las migraciones 002-025 sin referencias.
alter table crm.freetime_origin
  drop column pais;

-- ----------------------------------------------------------------------------
-- 5) crm.freetime_destino — versionado, freetime en el país de destino
-- ----------------------------------------------------------------------------
create table crm.freetime_destino (
  id                      uuid primary key default gen_random_uuid(),
  naviera_id              uuid not null references crm.navieras(id),
  pais_id                 uuid not null references crm.paises(id),
  hub                     text,
  dias_combined           integer check (dias_combined >= 0),
  dias_demurrage          integer check (dias_demurrage >= 0),
  dias_detention          integer check (dias_detention >= 0),
  aplica_carga_peligrosa  boolean,  -- nullable a propósito: 5.6% del contrato no trae el dato
  tarifa_dry_usd_dia      numeric(10,2) check (tarifa_dry_usd_dia >= 0),
  tarifa_reefer_usd_dia   numeric(10,2) check (tarifa_reefer_usd_dia >= 0),
  freetime_reefer         integer check (freetime_reefer >= 0),
  convencion_conteo       text not null default 'retiro_dia_1'
                          check (convencion_conteo in ('retiro_dia_1', 'retiro_dia_0')),
  nota                    text,
  vigente_desde           date not null,
  vigente_hasta           date,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint ck_vigencia_coherente
    check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

comment on column crm.freetime_destino.convencion_conteo is
  'retiro_dia_1 = el primer día del reloj cuenta como día 1; para destino el reloj arranca en el arribo';

comment on table crm.freetime_destino is
  'dias_combined/demurrage/detention se guardan TAL CUAL el contrato — Combined '
  'NO es derivable de demurrage+detention (78% de mismatch medido). Sin lógica derivada.';

create unique index ux_freetime_destino_vigente
  on crm.freetime_destino (naviera_id, pais_id, coalesce(hub, ''))
  where vigente_hasta is null;

create index ix_freetime_destino_naviera
  on crm.freetime_destino (naviera_id, vigente_desde desc);

create trigger trg_freetime_destino_upd
  before update on crm.freetime_destino
  for each row execute function crm.set_updated_at();

alter table crm.freetime_destino enable row level security;

create policy freetime_destino_select on crm.freetime_destino
  for select to authenticated
  using ((select p.estado = 'activo' from crm.perfil() p));

-- SIN policies de INSERT/UPDATE — igual que freetime_origin: la única vía de
-- escritura es la RPC DEFINER de abajo (más el seed de la 027).
grant select on crm.freetime_destino to authenticated;

-- ----------------------------------------------------------------------------
-- 6) crm_nueva_version_freetime — extendida (pais/hub/reefer/nota)
--    DROP + CREATE (no REPLACE): cambia la aridad, así que un REPLACE
--    dejaría las 2 firmas coexistiendo (ambigüedad para llamadas nombradas).
--    Los 5 parámetros nuevos van al final con DEFAULT, y p_pais tiene DEFAULT
--    'ARGENTINA' — el front M9 actual (9 parámetros, sin tocar) sigue andando
--    exactamente igual: crea/versiona SIEMPRE en ARGENTINA, hub nacional.
-- ----------------------------------------------------------------------------
drop function if exists
  crm.crm_nueva_version_freetime(uuid, integer, boolean, text, numeric, date, text, text, boolean);

create function crm.crm_nueva_version_freetime(
  p_naviera uuid,
  p_dias integer,
  p_peligrosa boolean,
  p_tipo text,
  p_tarifa numeric,
  p_desde date,
  p_regimen text default 'vacios',
  p_convencion text default null,
  p_cobra boolean default null,
  p_pais text default 'ARGENTINA',
  p_hub text default null,
  p_freetime_reefer integer default null,
  p_tarifa_reefer_usd_dia numeric default null,
  p_nota text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller record;
  v_id uuid;
  v_prev record;
  v_convencion text;
  v_cobra boolean;
  v_pais_id uuid;
  v_hub text;
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
  if p_convencion is not null and p_convencion not in ('retiro_dia_1', 'retiro_dia_0') then
    raise exception 'convención de conteo inválida: %', p_convencion;
  end if;
  if p_freetime_reefer is not null and p_freetime_reefer < 0 then
    raise exception 'freetime reefer inválido: %', p_freetime_reefer;
  end if;
  if p_tarifa_reefer_usd_dia is not null and p_tarifa_reefer_usd_dia < 0 then
    raise exception 'tarifa reefer inválida: %', p_tarifa_reefer_usd_dia;
  end if;
  if p_pais is null then raise exception 'país obligatorio'; end if;

  select id into v_pais_id from crm.paises where nombre = p_pais and activo;
  if v_pais_id is null then raise exception 'país inválido o inactivo: %', p_pais; end if;

  v_hub := nullif(trim(p_hub), '');

  select * into v_prev
    from crm.freetime_origin
   where naviera_id = p_naviera and regimen = p_regimen
     and pais_id = v_pais_id and coalesce(hub, '') = coalesce(v_hub, '')
     and vigente_hasta is null
   limit 1;

  -- herencia: sin parámetro explícito, la versión nueva conserva la convención
  -- y el cobra de la vigente (o los defaults del sistema si es la primera).
  -- freetime_reefer/tarifa_reefer/nota NO heredan: son valores de tarifa (como
  -- dias_libres/tarifa_usd_dia), se re-declaran cada versión — NULL explícito
  -- significa "esta versión no trae ese dato", no "igual que la anterior".
  v_convencion := coalesce(p_convencion, v_prev.convencion_conteo, 'retiro_dia_1');
  v_cobra      := coalesce(p_cobra, v_prev.cobra_detention_origen, true);

  -- idempotencia: misma versión ⇒ devolver la existente
  if v_prev.id is not null
     and v_prev.vigente_desde = p_desde
     and v_prev.dias_libres = p_dias
     and v_prev.tarifa_usd_dia = p_tarifa
     and v_prev.tipo = p_tipo
     and v_prev.aplica_carga_peligrosa = p_peligrosa
     and v_prev.convencion_conteo = v_convencion
     and v_prev.cobra_detention_origen = v_cobra
     and v_prev.freetime_reefer is not distinct from p_freetime_reefer
     and v_prev.tarifa_reefer_usd_dia is not distinct from p_tarifa_reefer_usd_dia
     and v_prev.nota is not distinct from p_nota then
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
     tarifa_usd_dia, vigente_desde, vigente_hasta, convencion_conteo, cobra_detention_origen,
     pais_id, hub, freetime_reefer, tarifa_reefer_usd_dia, nota)
  values
    (p_naviera, p_regimen, p_dias, p_peligrosa, p_tipo, p_tarifa, p_desde, null,
     v_convencion, v_cobra, v_pais_id, v_hub, p_freetime_reefer, p_tarifa_reefer_usd_dia, p_nota)
  returning id into v_id;

  return v_id;
end $$;

revoke all on function crm.crm_nueva_version_freetime(
  uuid, integer, boolean, text, numeric, date, text, text, boolean, text, text, integer, numeric, text
) from public, anon;
grant execute on function crm.crm_nueva_version_freetime(
  uuid, integer, boolean, text, numeric, date, text, text, boolean, text, text, integer, numeric, text
) to authenticated;

-- ----------------------------------------------------------------------------
-- 7) crm_nueva_version_freetime_destino — espejo, tabla nueva sin legacy
-- ----------------------------------------------------------------------------
create function crm.crm_nueva_version_freetime_destino(
  p_naviera uuid,
  p_pais text,
  p_desde date,
  p_hub text default null,
  p_dias_combined integer default null,
  p_dias_demurrage integer default null,
  p_dias_detention integer default null,
  p_peligrosa boolean default null,
  p_tarifa_dry_usd_dia numeric default null,
  p_tarifa_reefer_usd_dia numeric default null,
  p_freetime_reefer integer default null,
  p_convencion text default 'retiro_dia_1',
  p_nota text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller record;
  v_id uuid;
  v_prev record;
  v_pais_id uuid;
  v_hub text;
begin
  select * into v_caller from crm.perfil();
  if v_caller.estado is distinct from 'activo' or v_caller.rol is distinct from 'administrador' then
    raise exception 'solo un administrador activo puede versionar tarifas';
  end if;

  if p_naviera is null then raise exception 'naviera obligatoria'; end if;
  if p_desde is null then raise exception 'fecha de vigencia obligatoria'; end if;
  if p_pais is null then raise exception 'país obligatorio'; end if;

  select id into v_pais_id from crm.paises where nombre = p_pais and activo;
  if v_pais_id is null then raise exception 'país inválido o inactivo: %', p_pais; end if;

  if p_convencion is null or p_convencion not in ('retiro_dia_1', 'retiro_dia_0') then
    raise exception 'convención de conteo inválida: %', p_convencion;
  end if;
  if p_dias_combined is not null and p_dias_combined < 0 then
    raise exception 'días combined inválidos: %', p_dias_combined;
  end if;
  if p_dias_demurrage is not null and p_dias_demurrage < 0 then
    raise exception 'días demurrage inválidos: %', p_dias_demurrage;
  end if;
  if p_dias_detention is not null and p_dias_detention < 0 then
    raise exception 'días detention inválidos: %', p_dias_detention;
  end if;
  if p_tarifa_dry_usd_dia is not null and p_tarifa_dry_usd_dia < 0 then
    raise exception 'tarifa dry inválida: %', p_tarifa_dry_usd_dia;
  end if;
  if p_tarifa_reefer_usd_dia is not null and p_tarifa_reefer_usd_dia < 0 then
    raise exception 'tarifa reefer inválida: %', p_tarifa_reefer_usd_dia;
  end if;
  if p_freetime_reefer is not null and p_freetime_reefer < 0 then
    raise exception 'freetime reefer inválido: %', p_freetime_reefer;
  end if;

  v_hub := nullif(trim(p_hub), '');

  select * into v_prev
    from crm.freetime_destino
   where naviera_id = p_naviera and pais_id = v_pais_id
     and coalesce(hub, '') = coalesce(v_hub, '')
     and vigente_hasta is null
   limit 1;

  -- idempotencia: misma versión ⇒ devolver la existente
  if v_prev.id is not null
     and v_prev.vigente_desde = p_desde
     and v_prev.dias_combined is not distinct from p_dias_combined
     and v_prev.dias_demurrage is not distinct from p_dias_demurrage
     and v_prev.dias_detention is not distinct from p_dias_detention
     and v_prev.aplica_carga_peligrosa is not distinct from p_peligrosa
     and v_prev.tarifa_dry_usd_dia is not distinct from p_tarifa_dry_usd_dia
     and v_prev.tarifa_reefer_usd_dia is not distinct from p_tarifa_reefer_usd_dia
     and v_prev.freetime_reefer is not distinct from p_freetime_reefer
     and v_prev.convencion_conteo = p_convencion
     and v_prev.nota is not distinct from p_nota then
    return v_prev.id;
  end if;

  if v_prev.id is not null and p_desde <= v_prev.vigente_desde then
    raise exception 'la vigencia nueva (%) debe ser posterior al inicio de la versión vigente (%)',
      p_desde, v_prev.vigente_desde;
  end if;

  if v_prev.id is not null then
    update crm.freetime_destino set vigente_hasta = p_desde - 1 where id = v_prev.id;
  end if;

  insert into crm.freetime_destino
    (naviera_id, pais_id, hub, dias_combined, dias_demurrage, dias_detention,
     aplica_carga_peligrosa, tarifa_dry_usd_dia, tarifa_reefer_usd_dia, freetime_reefer,
     convencion_conteo, nota, vigente_desde, vigente_hasta)
  values
    (p_naviera, v_pais_id, v_hub, p_dias_combined, p_dias_demurrage, p_dias_detention,
     p_peligrosa, p_tarifa_dry_usd_dia, p_tarifa_reefer_usd_dia, p_freetime_reefer,
     p_convencion, p_nota, p_desde, null)
  returning id into v_id;

  return v_id;
end $$;

revoke all on function crm.crm_nueva_version_freetime_destino(
  uuid, text, date, text, integer, integer, integer, boolean, numeric, numeric, integer, text, text
) from public, anon;
grant execute on function crm.crm_nueva_version_freetime_destino(
  uuid, text, date, text, integer, integer, integer, boolean, numeric, numeric, integer, text, text
) to authenticated;

-- ----------------------------------------------------------------------------
-- 8) Fix del motor — vista_alertas / vista_kpi_costos_cerradas
--
-- ÚNICO cambio real: el LATERAL que resuelve freetime_origin ahora exige
-- f.pais_id = p.pais_id (país de la planta actual de la operación) y
-- f.hub is null (tarifa nacional — único caso que existe hoy).
--
-- Edge case preservado a propósito: si la operación TODAVÍA no tiene
-- planta_actual_id (o.planta_actual_id / p.pais_id es NULL — ventana entre
-- crear_tanda_retiro y el primer ingreso confirmado a planta), el filtro de
-- país se DESACTIVA (p.pais_id is null or f.pais_id = p.pais_id) y el lookup
-- se comporta EXACTAMENTE como antes de esta migración (solo naviera+régimen+
-- fecha). Es la semántica pre-existente para ese caso — no se inventa una
-- nueva regla para una situación que la vista de hoy nunca distinguió.
--
-- vista_kpi_costos_cerradas NO tenía join a crm.plantas — se agrega (left
-- join, no cambia ninguna columna de salida) solo para tener p.pais_id
-- disponible en su propio LATERAL.
--
-- Snapshot pre-migración (13 operaciones abiertas, todas ARGENTINA):
--   costo_proyectado por operación sin cambios — ver reporte de verificación.
-- Las vistas KPI dependientes (vista_kpi_costo_naviera, vista_kpi_resumen,
-- vista_kpi_tendencia_mensual) NO se recrean: agregan sobre columnas que no
-- cambiaron de nombre/tipo, CREATE OR REPLACE de las 2 vistas base no las
-- invalida.
-- ----------------------------------------------------------------------------
create or replace view crm.vista_alertas with (security_invoker = true) as
select
  o.id                    as operacion_id,
  c.id                    as contenedor_id,
  c.numero_contenedor,
  p.nombre                as planta_actual,
  n.nombre                as naviera,
  o.estado,
  o.fecha_retiro,
  o.sin_cargo,
  d.dias                  as dias_transcurridos,
  d.dias                  as dias_estadia,
  ft.dias_libres,
  case when ft.dias_libres is not null then ft.dias_libres - d.dias
       else null::integer end                       as dias_restantes,
  ft.tarifa_usd_dia,
  m.costo_neto            as costo_proyectado,
  case
    when ft.dias_libres is null or not ft.cobra_detention_origen then 'neutro'
    when (ft.dias_libres - d.dias) < 0               then 'rojo'
    when (ft.dias_libres - d.dias) <= cfg.umbral     then 'amarillo'
    else 'verde'
  end                     as estado_semaforo,
  m.costo_bruto,
  m.costo_absorbido,
  m.costo_neto,
  nullif(w.total, 0)      as waiver_dias
from crm.operaciones o
join crm.contenedores c on c.id = o.contenedor_id
join crm.navieras n     on n.id = c.naviera_id
left join crm.plantas p on p.id = o.planta_actual_id
cross join lateral (
  select coalesce((select (valor ->> 'dias')::integer
                     from crm.configuracion
                    where clave = 'umbral_alerta_amarillo'), 3) as umbral
) cfg
left join lateral (
  select f.dias_libres, f.tarifa_usd_dia, f.convencion_conteo, f.cobra_detention_origen
    from crm.freetime_origin f
   where f.naviera_id = c.naviera_id
     and f.regimen = 'vacios'
     and (p.pais_id is null or f.pais_id = p.pais_id)
     and f.hub is null
     and (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date >= f.vigente_desde
     and (f.vigente_hasta is null
          or (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date <= f.vigente_hasta)
   order by f.vigente_desde desc
   limit 1
) ft on true
cross join lateral (
  select crm.dias_con_convencion(o.fecha_retiro, now(),
                                 coalesce(ft.convencion_conteo, 'retiro_dia_1')) as dias
) d
cross join lateral (
  select coalesce(sum(ow.dias) filter (where ow.estado = 'vigente'), 0)::integer as total
    from crm.operacion_waivers ow
   where ow.operacion_id = o.id
) w
cross join lateral (
  select
    case when ft.dias_libres is null or not ft.cobra_detention_origen then null::numeric
         else greatest(0, d.dias - ft.dias_libres)::numeric * ft.tarifa_usd_dia
    end as costo_bruto,
    case when ft.dias_libres is null or not ft.cobra_detention_origen then null::numeric
         else least(
                case when o.sin_cargo then greatest(0, d.dias - ft.dias_libres)
                     else w.total end,
                greatest(0, d.dias - ft.dias_libres)
              )::numeric * ft.tarifa_usd_dia
    end as costo_absorbido,
    case when o.sin_cargo then 0::numeric
         when ft.dias_libres is null or not ft.cobra_detention_origen then null::numeric
         else (greatest(0, d.dias - ft.dias_libres)
               - least(w.total, greatest(0, d.dias - ft.dias_libres))
              )::numeric * ft.tarifa_usd_dia
    end as costo_neto
) m
where o.estado not in ('cerrado', 'anulada');

create or replace view crm.vista_kpi_costos_cerradas with (security_invoker = true) as
select
  o.id                    as operacion_id,
  c.naviera_id,
  n.nombre                as naviera,
  o.planta_actual_id,
  o.fecha_retiro,
  o.fecha_devolucion,
  d.dias                  as dias_estadia,
  ft.dias_libres,
  ft.tarifa_usd_dia,
  o.sin_cargo,
  m.costo_neto            as costo_realizado,
  m.costo_bruto,
  m.costo_absorbido,
  m.costo_neto,
  nullif(w.total, 0)      as waiver_dias
from crm.operaciones o
join crm.contenedores c on c.id = o.contenedor_id
join crm.navieras n     on n.id = c.naviera_id
left join crm.plantas p on p.id = o.planta_actual_id
left join lateral (
  select f.dias_libres, f.tarifa_usd_dia, f.convencion_conteo, f.cobra_detention_origen
    from crm.freetime_origin f
   where f.naviera_id = c.naviera_id
     and f.regimen = 'vacios'
     and (p.pais_id is null or f.pais_id = p.pais_id)
     and f.hub is null
     and (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date >= f.vigente_desde
     and (f.vigente_hasta is null
          or (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date <= f.vigente_hasta)
   order by f.vigente_desde desc
   limit 1
) ft on true
cross join lateral (
  select crm.dias_con_convencion(o.fecha_retiro, o.fecha_devolucion,
                                 coalesce(ft.convencion_conteo, 'retiro_dia_1')) as dias
) d
cross join lateral (
  select coalesce(sum(ow.dias) filter (where ow.estado = 'vigente'), 0)::integer as total
    from crm.operacion_waivers ow
   where ow.operacion_id = o.id
) w
cross join lateral (
  select
    case when ft.dias_libres is null or not ft.cobra_detention_origen then null::numeric
         else greatest(0, d.dias - ft.dias_libres)::numeric * ft.tarifa_usd_dia
    end as costo_bruto,
    case when ft.dias_libres is null or not ft.cobra_detention_origen then null::numeric
         else least(
                case when o.sin_cargo then greatest(0, d.dias - ft.dias_libres)
                     else w.total end,
                greatest(0, d.dias - ft.dias_libres)
              )::numeric * ft.tarifa_usd_dia
    end as costo_absorbido,
    case when o.sin_cargo then 0::numeric
         when ft.dias_libres is null or not ft.cobra_detention_origen then null::numeric
         else (greatest(0, d.dias - ft.dias_libres)
               - least(w.total, greatest(0, d.dias - ft.dias_libres))
              )::numeric * ft.tarifa_usd_dia
    end as costo_neto
) m
where o.estado = 'cerrado' and o.fecha_devolucion is not null;

-- Grants ya vigentes desde 021 (revoke all from public/anon; grant select to
-- authenticated) — CREATE OR REPLACE VIEW conserva el ACL del objeto, no hace
-- falta repetirlo.

notify pgrst, 'reload schema';
