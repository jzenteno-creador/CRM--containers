-- ============================================================================
-- 007_views_notificaciones — M1 rebuild v2 CRM Detention
-- vista_alertas (§10 + Decisión 2 + Decisión 7) + usuarios_publicos
-- (Decisión 6) + get_pendientes() (§13).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- vista_alertas — security_invoker (§14.8): la RLS de las tablas base scopea
-- las filas por rol/planta del caller.
--   · días: crm.dias_estadia (Decisión 2 — inclusiva, retiro = día 1)
--   · lookup de tarifa: versión vigente a fecha_retiro, regimen='vacios'
--     (Decisión 4)
--   · semáforo con 4to estado 'neutro' (Decisión 7): naviera sin freetime
--     vigente o que no cobra detention en origen — nunca "verde eterno"
--   · sin_cargo ⇒ costo 0; cobra_detention_origen=false ⇒ costo NULL
--   · umbral amarillo desde configuracion (§18.2, default 3)
-- ----------------------------------------------------------------------------
create view crm.vista_alertas
with (security_invoker = true)
as
select
  o.id as operacion_id,
  c.id as contenedor_id,
  c.numero_contenedor,
  p.nombre as planta_actual,
  n.nombre as naviera,
  o.estado,
  o.fecha_retiro,
  o.sin_cargo,
  crm.dias_estadia(o.fecha_retiro, now()) as dias_transcurridos,
  crm.dias_estadia(o.fecha_retiro, now()) as dias_estadia,
  ft.dias_libres,
  case
    when ft.dias_libres is not null
    then ft.dias_libres - crm.dias_estadia(o.fecha_retiro, now())
  end as dias_restantes,
  ft.tarifa_usd_dia,
  case
    when o.sin_cargo then 0::numeric
    when ft.dias_libres is null or not n.cobra_detention_origen then null::numeric
    else greatest(0, crm.dias_estadia(o.fecha_retiro, now()) - ft.dias_libres)::numeric
         * ft.tarifa_usd_dia
  end as costo_proyectado,
  case
    when ft.dias_libres is null or not n.cobra_detention_origen then 'neutro'
    when ft.dias_libres - crm.dias_estadia(o.fecha_retiro, now()) < 0 then 'rojo'
    when ft.dias_libres - crm.dias_estadia(o.fecha_retiro, now()) <= cfg.umbral then 'amarillo'
    else 'verde'
  end as estado_semaforo
from crm.operaciones o
join crm.contenedores c on c.id = o.contenedor_id
join crm.navieras n on n.id = c.naviera_id
left join crm.plantas p on p.id = o.planta_actual_id
cross join lateral (
  select coalesce(
    (select (valor ->> 'dias')::integer
       from crm.configuracion
      where clave = 'umbral_alerta_amarillo'), 3) as umbral
) cfg
left join lateral (
  select f.dias_libres, f.tarifa_usd_dia
    from crm.freetime_origin f
   where f.naviera_id = c.naviera_id
     and f.regimen = 'vacios'
     and (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date >= f.vigente_desde
     and (f.vigente_hasta is null
       or (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date <= f.vigente_hasta)
   order by f.vigente_desde desc
   limit 1
) ft on true
where o.estado not in ('cerrado', 'anulada');

grant select on crm.vista_alertas to authenticated;

-- ----------------------------------------------------------------------------
-- usuarios_publicos — Decisión 6: view OWNER-BASED (SIN security_invoker),
-- excepción DOCUMENTADA al §14.8. Motivo: con invoker + policy "propia fila",
-- un operador resolvería UN solo nombre y los joins de confirmado_por /
-- anulada_por / aprobado_por nacerían muertos. Superficie mínima: SOLO
-- (id, nombre), gateada a callers activos (perfil() refleja la sesión, no al
-- owner). security_barrier evita que un predicado hostil se evalúe antes que
-- el gate.
-- ----------------------------------------------------------------------------
create view crm.usuarios_publicos
with (security_barrier = true)
as
select u.id, u.nombre
from crm.usuarios u
where (select p.estado from crm.perfil() p) = 'activo';

grant select on crm.usuarios_publicos to authenticated;

-- ----------------------------------------------------------------------------
-- get_pendientes — §13: fuente única de notificaciones. SECURITY DEFINER
-- (lista cerrada) + guard activo primera línea + scope de planta para
-- operador resuelto ADENTRO (una RPC DEFINER bypasea RLS: el §14.3/§14.4 se
-- cumple acá o no se cumple).
-- Categorías por rol (§13): operador (su planta) / supervisor / admin.
-- ----------------------------------------------------------------------------
create or replace function crm.get_pendientes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller record;
  v_planta uuid;
  v_result jsonb;
begin
  select * into v_caller from crm.perfil();
  if v_caller.estado is distinct from 'activo' then
    raise exception 'cuenta no activa';
  end if;

  v_planta := case when v_caller.rol = 'operador' then v_caller.planta_asignada_id end;

  v_result := jsonb_build_object(
    'pendientes_ingreso', (
      select count(*)
        from crm.operaciones o
       where o.estado = 'en_transito_a_planta'
         and (v_planta is null or exists (
                select 1 from crm.movimientos_planta m
                 where m.operacion_id = o.id
                   and m.estado = 'en_transito'
                   and m.planta_destino_id = v_planta))),
    'pendientes_devolucion', (
      select count(*)
        from crm.operaciones o
       where o.estado = 'en_transito_a_terminal'
         and (v_planta is null or o.planta_actual_id = v_planta)),
    'alertas', (
      select jsonb_build_object(
               'amarillo', count(*) filter (where a.estado_semaforo = 'amarillo'),
               'rojo',     count(*) filter (where a.estado_semaforo = 'rojo'))
        from crm.vista_alertas a
        join crm.operaciones o on o.id = a.operacion_id
       where (v_planta is null or o.planta_actual_id = v_planta))
  );

  if v_caller.rol in ('supervisor', 'administrador') then
    v_result := v_result || jsonb_build_object(
      'reforzados_pendientes', (
        select count(*)
          from crm.contenedores
         where reforzado_estado in ('pendiente_validacion', 'discrepancia')));
  end if;

  if v_caller.rol = 'administrador' then
    v_result := v_result || jsonb_build_object(
      'solicitudes_acceso', (
        select count(*)
          from crm.usuarios
         where estado_cuenta = 'pendiente_aprobacion'));
  end if;

  return v_result;
end $$;

grant execute on function crm.get_pendientes() to authenticated;
