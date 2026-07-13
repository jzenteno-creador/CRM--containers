-- ═══════════════════════════════════════════════════════════════════════════
-- 021 · M4 — WAIVER ACUMULATIVO (decisión de John, cierre B2: opción b, SUMA)
-- ═══════════════════════════════════════════════════════════════════════════
-- Razón: con el modelo 019 (REEMPLAZA), la naviera autoriza 3 días y después
-- 2 más; el operario carga 2 y BORRA los 3 anteriores sin darse cuenta — esos
-- 3 días absorbidos pasan a ser costo de SSB. El sistema acumula; no se le
-- pide aritmética mental al operario.
--
-- Modelo: cada waiver es un REGISTRO propio (motivo, referencia, quién, cuándo),
-- anulable individualmente (sup+, con motivo) sin tocar a los demás.
-- dias_absorbidos_total = SUM(dias) de los waivers VIGENTES, capado al exceso.
--
-- Compatibilidad:
--   · crm_registrar_waiver conserva LA MISMA FIRMA (la UI actual sigue andando;
--     ahora suma en vez de pisar).
--   · Las views conservan la columna waiver_dias — pasa a ser el TOTAL vigente.
--   · operaciones.waiver_* quedan CONGELADAS (deprecadas, no se dropean; el
--     CHECK all-or-none se retira para que nada nuevo dependa de ellas).
--   · Los waivers existentes migran como primer registro SIN cambiar números.
--
-- ⚠️ NO APLICAR sin GO de John. La UI de HISTORIAL de waivers debe deployarse
-- en el MISMO run que aplique esta migración (la ficha actual muestra
-- motivo/referencia desde operaciones.*, que quedan congeladas).
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ A · tabla de waivers ═════════════════════════════════════════════════

create table crm.operacion_waivers (
  id             uuid primary key default gen_random_uuid(),
  operacion_id   uuid not null references crm.operaciones(id),
  dias           integer not null check (dias > 0),
  motivo         text not null check (length(trim(motivo)) > 0),
  referencia     text,
  registrado_por uuid not null references crm.usuarios(id),
  created_at     timestamptz not null default now(),
  estado         text not null default 'vigente' check (estado in ('vigente', 'anulado')),
  anulado_motivo text,
  anulado_por    uuid references crm.usuarios(id),
  anulado_fecha  timestamptz,
  constraint ck_waiver_anulacion_coherente check (
    (estado = 'vigente' and anulado_motivo is null and anulado_por is null and anulado_fecha is null)
    or
    (estado = 'anulado' and anulado_motivo is not null and anulado_por is not null and anulado_fecha is not null)
  )
);

create index ix_waivers_operacion on crm.operacion_waivers (operacion_id, estado);
create index ix_waivers_registrado_por on crm.operacion_waivers (registrado_por);
create index ix_waivers_anulado_por on crm.operacion_waivers (anulado_por) where anulado_por is not null;

alter table crm.operacion_waivers enable row level security;

-- lectura: cualquier usuario activo, scopeada por la visibilidad de la operación
-- (mismo patrón que eventos_select). ESCRITURA: nadie — solo las RPCs DEFINER.
create policy waivers_select on crm.operacion_waivers
  for select to authenticated
  using (
    (select p.estado = 'activo' from crm.perfil() p)
    and exists (select 1 from crm.operaciones o where o.id = operacion_waivers.operacion_id)
  );

grant select on crm.operacion_waivers to authenticated;

-- ═══ B · migración de datos: waivers 019 → primer registro ════════════════
-- "Sin cambiar ningún número": el total vigente post-migración = waiver_dias
-- que ya tenía cada operación.
insert into crm.operacion_waivers
  (operacion_id, dias, motivo, referencia, registrado_por, created_at, estado)
select id, waiver_dias, waiver_motivo, waiver_referencia, waiver_registrado_por,
       coalesce(waiver_fecha, now()), 'vigente'
  from crm.operaciones
 where waiver_dias is not null;

-- columnas legacy: congeladas. Se retira el CHECK all-or-none para que la RPC
-- nueva no tenga que mantenerlas; quedan como snapshot histórico pre-021.
alter table crm.operaciones drop constraint ck_waiver_coherente;

comment on column crm.operaciones.waiver_dias is
  'CONGELADO (021): snapshot pre-021. La verdad vive en crm.operacion_waivers '
  '(suma de vigentes). Las views ya no leen esta columna.';

-- ═══ C · helper del total vigente + guard de exceso ═══════════════════════

create or replace function crm.waiver_total_vigente(p_operacion uuid)
returns integer
language sql stable
set search_path to ''
as $$
  select coalesce(sum(dias), 0)::integer
    from crm.operacion_waivers
   where operacion_id = p_operacion and estado = 'vigente'
$$;

revoke execute on function crm.waiver_total_vigente(uuid) from public, anon;
grant  execute on function crm.waiver_total_vigente(uuid) to authenticated;

-- exceso actual de una operación (días facturables − libres, piso 0), con la
-- MISMA resolución de tarifa vigente-a-fecha-de-retiro que usan las views.
-- NULL si no hay tarifa vigente o la naviera no cobra (neutro).
create or replace function crm.exceso_actual(p_operacion uuid)
returns integer
language sql stable
set search_path to ''
as $$
  select greatest(0, crm.dias_con_convencion(o.fecha_retiro,
                       coalesce(o.fecha_devolucion, now()), f.convencion_conteo)
                     - f.dias_libres)
    from crm.operaciones o
    join crm.contenedores c on c.id = o.contenedor_id
    join lateral (
      select f2.dias_libres, f2.convencion_conteo, f2.cobra_detention_origen
        from crm.freetime_origin f2
       where f2.naviera_id = c.naviera_id
         and f2.regimen = 'vacios'
         and (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date >= f2.vigente_desde
         and (f2.vigente_hasta is null
              or (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date <= f2.vigente_hasta)
       order by f2.vigente_desde desc
       limit 1
    ) f on true
   where o.id = p_operacion
     and f.cobra_detention_origen
$$;

revoke execute on function crm.exceso_actual(uuid) from public, anon;
grant  execute on function crm.exceso_actual(uuid) to authenticated;

-- ═══ D · RPCs ═════════════════════════════════════════════════════════════

-- D.1 registrar — MISMA FIRMA que 019 (compat UI); ahora SUMA y devuelve el id.
-- DROP obligatorio: la 019 la definió RETURNS void y CREATE OR REPLACE no puede
-- cambiar el tipo de retorno (defecto bloqueante detectado por el gate del
-- VERIFIER 2026-07-13; el gate corrió con exactamente este fix).
drop function if exists crm.crm_registrar_waiver(uuid, integer, text, text);

create function crm.crm_registrar_waiver(
  p_operacion uuid, p_dias integer, p_motivo text, p_referencia text default null
) returns uuid
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_caller record;
  v_op record;
  v_exceso integer;
  v_total integer;
  v_id uuid;
begin
  select * into v_caller from crm.perfil();
  if v_caller.estado is distinct from 'activo'
     or v_caller.rol not in ('supervisor', 'administrador') then
    raise exception 'el waiver es plata: solo supervisor o administrador';
  end if;

  if p_dias is null or p_dias <= 0 then
    raise exception 'días de waiver inválidos: %', p_dias;
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'motivo obligatorio: el waiver es plata y queda auditado';
  end if;

  select * into v_op from crm.operaciones where id = p_operacion;
  if v_op.id is null then
    raise exception 'operación inexistente';
  end if;
  if v_op.estado = 'anulada' then
    raise exception 'una operación anulada no lleva waiver';
  end if;
  if v_op.sin_cargo then
    raise exception 'la operación está marcada sin cargo (modelo deprecado): ya absorbe todo el exceso, no admite waivers';
  end if;

  v_exceso := crm.exceso_actual(p_operacion);
  if v_exceso is null then
    raise exception 'la operación no tiene tarifa vigente que genere costo: no hay nada que absorber';
  end if;

  v_total := crm.waiver_total_vigente(p_operacion);
  if v_total + p_dias > v_exceso then
    raise exception 'el waiver acumulado (% + % = % días) superaría los días excedidos (%): la naviera no puede absorber más costo del que existe',
      v_total, p_dias, v_total + p_dias, v_exceso;
  end if;

  insert into crm.operacion_waivers (operacion_id, dias, motivo, referencia, registrado_por)
  values (p_operacion, p_dias, trim(p_motivo), nullif(trim(p_referencia), ''), v_caller.usuario_id)
  returning id into v_id;

  insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
  values (p_operacion, 'waiver', now(), v_caller.usuario_id,
          jsonb_build_object('accion', 'registrado', 'waiver_id', v_id,
                             'dias', p_dias, 'motivo', trim(p_motivo),
                             'referencia', nullif(trim(p_referencia), ''),
                             'total_vigente_antes', v_total,
                             'total_vigente_despues', v_total + p_dias));
  return v_id;
end $fn$;

revoke execute on function crm.crm_registrar_waiver(uuid, integer, text, text) from public, anon;
grant  execute on function crm.crm_registrar_waiver(uuid, integer, text, text) to authenticated;

-- D.2 anular UN waiver (si la naviera se retracta) — sin tocar a los demás.
create or replace function crm.crm_anular_waiver(p_waiver uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_caller record;
  v_w record;
  v_total integer;
begin
  select * into v_caller from crm.perfil();
  if v_caller.estado is distinct from 'activo'
     or v_caller.rol not in ('supervisor', 'administrador') then
    raise exception 'anular un waiver es plata: solo supervisor o administrador';
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'motivo obligatorio para anular un waiver';
  end if;

  select * into v_w from crm.operacion_waivers where id = p_waiver;
  if v_w.id is null then
    raise exception 'waiver inexistente';
  end if;
  if v_w.estado = 'anulado' then
    raise exception 'el waiver ya está anulado';
  end if;

  v_total := crm.waiver_total_vigente(v_w.operacion_id);

  update crm.operacion_waivers
     set estado = 'anulado',
         anulado_motivo = trim(p_motivo),
         anulado_por = v_caller.usuario_id,
         anulado_fecha = now()
   where id = p_waiver;

  insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
  values (v_w.operacion_id, 'waiver', now(), v_caller.usuario_id,
          jsonb_build_object('accion', 'anulado', 'waiver_id', p_waiver,
                             'dias', v_w.dias, 'motivo_anulacion', trim(p_motivo),
                             'total_vigente_antes', v_total,
                             'total_vigente_despues', v_total - v_w.dias));
end $fn$;

revoke execute on function crm.crm_anular_waiver(uuid, text) from public, anon;
grant  execute on function crm.crm_anular_waiver(uuid, text) to authenticated;

-- ═══ E · views: absorbido = suma de waivers VIGENTES (capada al exceso) ════
-- Misma estructura/orden de columnas que 019; cambia SOLO la fuente del waiver:
-- coalesce(o.waiver_dias,0) → w.total (lateral). La columna waiver_dias de las
-- views pasa a ser el TOTAL vigente (int, null si 0 — mismo shape para la UI).

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
left join lateral (
  select f.dias_libres, f.tarifa_usd_dia, f.convencion_conteo, f.cobra_detention_origen
    from crm.freetime_origin f
   where f.naviera_id = c.naviera_id
     and f.regimen = 'vacios'
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

revoke all on crm.vista_alertas, crm.vista_kpi_costos_cerradas from public, anon;
grant select on crm.vista_alertas, crm.vista_kpi_costos_cerradas to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN 021 · Con la aplicación (próximo run, GO de John) va OBLIGATORIO:
--   · UI de HISTORIAL de waivers en la ficha (lista de registros + anular
--     individual sup+) — la ficha actual lee motivo/referencia de las columnas
--     congeladas de operaciones y quedaría stale.
--   · Actualizar el aviso del modal ("reemplaza" → "se suma al acumulado").
-- ═══════════════════════════════════════════════════════════════════════════
