-- 039: Importación — waiver acumulativo + corrección de cerradas + neto en views
-- (auditoría 2026-07-31, P1-E del paquete impo; GO de John en la misma sesión)
--
-- Cierra el hueco "falta la RPC": impo llegó a prod sin equivalente de
-- crm_registrar_waiver/crm_anular_waiver (021) ni crm_corregir_operacion_cerrada (020).
-- Si la naviera absorbía días o una fecha se tipeaba mal en una cerrada, no había
-- camino sancionado — y la regla de la casa prohíbe el write directo.
--
-- PATRÓN DE SEGURIDAD (espejo EXACTO de expo, auditado en docs/historico/
-- AUDIT-4-DEFINER-RPCS.md y ratificado en AGENTS.md): las RPCs de waiver/corrección
-- son SECURITY DEFINER owner=postgres, guards de rol supervisor/administrador en el
-- cuerpo, y el control real es la AUDITORÍA (motivo obligatorio + evento en el
-- timeline). Los supervisores son globales por decisión explícita de John.
-- Mejora sobre expo: advisory lock por operación en registrar (cierra desde el día 1
-- el TOCTOU que en expo quedó anotado como P3).

-- ═══ (1) El CHECK de tipo_evento no incluía 'waiver' ═══
alter table crm.operacion_impo_eventos
  drop constraint operacion_impo_eventos_tipo_evento_check;
alter table crm.operacion_impo_eventos
  add constraint operacion_impo_eventos_tipo_evento_check check (tipo_evento in
    ('arribo', 'retiro_terminal', 'ingreso_planta',
     'salida_devolucion', 'devolucion', 'anulacion',
     'incidencia', 'correccion', 'waiver'));

-- ═══ (2) Tabla de waivers impo — espejo byte a byte de operacion_waivers (021) ═══
create table crm.operacion_impo_waivers (
  id                 uuid primary key default gen_random_uuid(),
  operacion_impo_id  uuid not null references crm.operaciones_impo(id),
  dias               integer not null check (dias > 0),
  motivo             text not null check (length(trim(motivo)) > 0),
  referencia         text,
  registrado_por     uuid not null references crm.usuarios(id),
  created_at         timestamptz not null default now(),
  estado             text not null default 'vigente' check (estado in ('vigente', 'anulado')),
  anulado_motivo     text,
  anulado_por        uuid references crm.usuarios(id),
  anulado_fecha      timestamptz,
  constraint ck_waiver_impo_anulacion_coherente check (
    (estado = 'vigente' and anulado_motivo is null and anulado_por is null and anulado_fecha is null)
    or
    (estado = 'anulado' and anulado_motivo is not null and anulado_por is not null and anulado_fecha is not null)
  )
);

create index ix_waivers_impo_operacion      on crm.operacion_impo_waivers (operacion_impo_id, estado);
create index ix_waivers_impo_registrado_por on crm.operacion_impo_waivers (registrado_por);

alter table crm.operacion_impo_waivers enable row level security;

-- SELECT-only para authenticated (visibilidad transitiva de la operación); escritura
-- SOLO vía las RPCs DEFINER owner=postgres de abajo (bypasan RLS — patrón expo 021).
create policy waivers_impo_select on crm.operacion_impo_waivers
  for select to authenticated
  using (
    (select p.estado = 'activo' from crm.perfil() p)
    and exists (select 1 from crm.operaciones_impo oi where oi.id = operacion_impo_id)
  );

grant select on crm.operacion_impo_waivers to authenticated;

comment on table crm.operacion_impo_waivers is
  'Waivers acumulativos de importación (039): días que la naviera absorbe. '
  'RPC-only (crm_registrar_waiver_impo / crm_anular_waiver_impo). Espejo de '
  'operacion_waivers (021).';

-- ═══ (3) Helpers ═══
create or replace function crm.waiver_impo_total_vigente(p_operacion uuid)
returns integer
language sql stable
set search_path to ''
as $$
  select coalesce(sum(dias), 0)::integer
    from crm.operacion_impo_waivers
   where operacion_impo_id = p_operacion and estado = 'vigente'
$$;

revoke execute on function crm.waiver_impo_total_vigente(uuid) from public, anon;
grant  execute on function crm.waiver_impo_total_vigente(uuid) to authenticated;

-- NOTA DE ORDEN: crm.exceso_actual_impo se crea al FINAL del archivo (después de las
-- views de la sección 7) porque es `language sql` — su cuerpo se valida al crearla y
-- referencia `costo_bruto`, columna que recién existe tras el replace de las views.
-- Las RPCs plpgsql de abajo pueden referenciarla antes (plpgsql no valida objetos al
-- CREATE), pero ninguna corre hasta que la migración completa termina.

-- ═══ (4) crm_registrar_waiver_impo — espejo de crm_registrar_waiver (021) ═══
create function crm.crm_registrar_waiver_impo(
  p_operacion_impo uuid, p_dias integer, p_motivo text, p_referencia text default null
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
     or v_caller.rol is null
     or v_caller.rol not in ('supervisor', 'administrador') then
    raise exception 'el waiver es plata: solo supervisor o administrador';
  end if;

  if p_dias is null or p_dias <= 0 then
    raise exception 'días de waiver inválidos: %', p_dias;
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'motivo obligatorio: el waiver es plata y queda auditado';
  end if;

  select * into v_op from crm.operaciones_impo where id = p_operacion_impo;
  if v_op.id is null then
    raise exception 'operación de importación inexistente';
  end if;
  if v_op.estado = 'anulada' then
    raise exception 'una operación anulada no lleva waiver';
  end if;

  -- Cierra el TOCTOU que expo tiene anotado (P3): dos supervisores simultáneos
  -- serializan acá antes de leer el total vigente.
  perform pg_advisory_xact_lock(hashtext('waiver_impo:' || p_operacion_impo::text));

  v_exceso := crm.exceso_actual_impo(p_operacion_impo);
  if v_exceso is null then
    raise exception 'la operación no tiene tarifa vigente que genere costo: no hay nada que absorber';
  end if;

  v_total := crm.waiver_impo_total_vigente(p_operacion_impo);
  if v_total + p_dias > v_exceso then
    raise exception 'el waiver acumulado (% + % = % días) superaría los días excedidos (%): la naviera no puede absorber más costo del que existe',
      v_total, p_dias, v_total + p_dias, v_exceso;
  end if;

  insert into crm.operacion_impo_waivers (operacion_impo_id, dias, motivo, referencia, registrado_por)
  values (p_operacion_impo, p_dias, trim(p_motivo), nullif(trim(p_referencia), ''), v_caller.usuario_id)
  returning id into v_id;

  insert into crm.operacion_impo_eventos (operacion_impo_id, tipo_evento, fecha, usuario_id, detalle)
  values (p_operacion_impo, 'waiver', now(), v_caller.usuario_id,
          jsonb_build_object('accion', 'registrado', 'waiver_id', v_id,
                             'dias', p_dias, 'motivo', trim(p_motivo),
                             'referencia', nullif(trim(p_referencia), ''),
                             'total_vigente_antes', v_total,
                             'total_vigente_despues', v_total + p_dias));
  return v_id;
end $fn$;

revoke execute on function crm.crm_registrar_waiver_impo(uuid, integer, text, text) from public, anon;
grant  execute on function crm.crm_registrar_waiver_impo(uuid, integer, text, text) to authenticated;

-- ═══ (5) crm_anular_waiver_impo — espejo de crm_anular_waiver (021) ═══
create function crm.crm_anular_waiver_impo(p_waiver uuid, p_motivo text)
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
     or v_caller.rol is null
     or v_caller.rol not in ('supervisor', 'administrador') then
    raise exception 'anular un waiver es plata: solo supervisor o administrador';
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'motivo obligatorio para anular un waiver';
  end if;

  select * into v_w from crm.operacion_impo_waivers where id = p_waiver;
  if v_w.id is null then
    raise exception 'waiver inexistente';
  end if;
  if v_w.estado = 'anulado' then
    raise exception 'el waiver ya está anulado';
  end if;

  v_total := crm.waiver_impo_total_vigente(v_w.operacion_impo_id);

  update crm.operacion_impo_waivers
     set estado = 'anulado',
         anulado_motivo = trim(p_motivo),
         anulado_por = v_caller.usuario_id,
         anulado_fecha = now()
   where id = p_waiver;

  insert into crm.operacion_impo_eventos (operacion_impo_id, tipo_evento, fecha, usuario_id, detalle)
  values (v_w.operacion_impo_id, 'waiver', now(), v_caller.usuario_id,
          jsonb_build_object('accion', 'anulado', 'waiver_id', p_waiver,
                             'dias', v_w.dias, 'motivo_anulacion', trim(p_motivo),
                             'total_vigente_antes', v_total,
                             'total_vigente_despues', v_total - v_w.dias));
end $fn$;

revoke execute on function crm.crm_anular_waiver_impo(uuid, text) from public, anon;
grant  execute on function crm.crm_anular_waiver_impo(uuid, text) to authenticated;

-- ═══ (6) crm_corregir_operacion_impo_cerrada — espejo de la 020 ═══
-- Whitelist: SOLO las 3 fechas de la operación (los textos logísticos de impo viven en
-- el encabezado de la orden, que sigue sin RPC de edición — fuera de alcance acá).
create function crm.crm_corregir_operacion_impo_cerrada(
  p_operacion_impo uuid, p_campo text, p_valor text, p_motivo text
) returns void
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_caller record;
  v_op crm.operaciones_impo%rowtype;
  v_arribo timestamptz;
  v_anterior text;
  v_fecha timestamptz;
begin
  select * into v_caller from crm.perfil();
  if v_caller.estado is distinct from 'activo'
     or v_caller.rol is null
     or v_caller.rol not in ('supervisor', 'administrador') then
    raise exception 'corregir una cerrada es plata: solo supervisor o administrador';
  end if;

  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'motivo obligatorio: la corrección es plata y queda auditada';
  end if;

  if p_campo not in ('fecha_retiro_terminal', 'fecha_ingreso_planta', 'fecha_devolucion') then
    raise exception 'campo no corregible por esta vía: %', p_campo;
  end if;

  select * into v_op from crm.operaciones_impo where id = p_operacion_impo;
  if v_op.id is null then
    raise exception 'operación de importación inexistente';
  end if;
  if v_op.estado <> 'cerrado' then
    raise exception 'esta RPC corrige solo operaciones CERRADAS (estado actual: %)', v_op.estado;
  end if;

  select fecha_arribo_terminal into v_arribo from crm.ordenes_impo where id = v_op.orden_id;

  begin
    v_fecha := p_valor::timestamptz;
  exception when others then
    raise exception 'fecha inválida para %: % (formato esperado: ISO, ej. 2026-07-10T12:00:00-03:00)', p_campo, p_valor;
  end;
  if v_fecha is null then
    raise exception 'una cerrada no puede quedar sin %', p_campo;
  end if;

  v_anterior := (case p_campo
                   when 'fecha_retiro_terminal' then v_op.fecha_retiro_terminal
                   when 'fecha_ingreso_planta'  then v_op.fecha_ingreso_planta
                   else                              v_op.fecha_devolucion
                 end)::text;

  -- Coherencia con mensaje claro ANTES del CHECK críptico. Reglas:
  -- arribo <= retiro <= ingreso (si hay) y retiro <= devolución.
  if p_campo = 'fecha_retiro_terminal' then
    if v_fecha < v_arribo then
      raise exception 'el retiro (%) no puede ser anterior al arribo a terminal (%)', v_fecha, v_arribo;
    end if;
    if v_op.fecha_ingreso_planta is not null and v_op.fecha_ingreso_planta < v_fecha then
      raise exception 'el retiro corregido (%) dejaría el ingreso a planta (%) antes del retiro', v_fecha, v_op.fecha_ingreso_planta;
    end if;
    if v_op.fecha_devolucion < v_fecha then
      raise exception 'el retiro corregido (%) dejaría la devolución (%) antes del retiro', v_fecha, v_op.fecha_devolucion;
    end if;
  elsif p_campo = 'fecha_ingreso_planta' then
    if v_op.fecha_retiro_terminal is not null and v_fecha < v_op.fecha_retiro_terminal then
      raise exception 'el ingreso a planta (%) no puede ser anterior al retiro (%)', v_fecha, v_op.fecha_retiro_terminal;
    end if;
  else -- fecha_devolucion
    if v_op.fecha_retiro_terminal is not null and v_fecha < v_op.fecha_retiro_terminal then
      raise exception 'la devolución (%) no puede ser anterior al retiro (%)', v_fecha, v_op.fecha_retiro_terminal;
    end if;
    if v_fecha < v_arribo then
      raise exception 'la devolución (%) no puede ser anterior al arribo (%)', v_fecha, v_arribo;
    end if;
  end if;

  -- guard de no-op: mismo instante en otro formato no es una corrección.
  if v_fecha is not distinct from (case p_campo
        when 'fecha_retiro_terminal' then v_op.fecha_retiro_terminal
        when 'fecha_ingreso_planta'  then v_op.fecha_ingreso_planta
        else                              v_op.fecha_devolucion end) then
    raise exception 'el valor nuevo es idéntico al actual — nada que corregir';
  end if;

  update crm.operaciones_impo set
    fecha_retiro_terminal = case when p_campo = 'fecha_retiro_terminal' then v_fecha else fecha_retiro_terminal end,
    fecha_ingreso_planta  = case when p_campo = 'fecha_ingreso_planta'  then v_fecha else fecha_ingreso_planta  end,
    fecha_devolucion      = case when p_campo = 'fecha_devolucion'      then v_fecha else fecha_devolucion      end
  where id = p_operacion_impo;

  insert into crm.operacion_impo_eventos (operacion_impo_id, tipo_evento, fecha, usuario_id, detalle)
  values (p_operacion_impo, 'correccion', now(), v_caller.usuario_id,
          jsonb_build_object('campo', p_campo,
                             'anterior', v_anterior,
                             'nuevo', p_valor,
                             'motivo', trim(p_motivo)));
end $fn$;

revoke execute on function crm.crm_corregir_operacion_impo_cerrada(uuid, text, text, text) from public, anon;
grant  execute on function crm.crm_corregir_operacion_impo_cerrada(uuid, text, text, text) to authenticated;

-- ═══ (7) Views con waiver: dias_waiver + costo_bruto nuevos; costo_proyectado /
-- costo_realizado pasan a NETO (clamp LEAST(waiver, exceso), jamás negativo — espejo
-- exacto de la semántica expo 021). vista_kpi_resumen_impo hereda el neto sin cambios
-- (suma costo_realizado). El semáforo NO considera waivers (conservador: la op con
-- exceso sigue roja aunque la naviera absorba — el waiver es un hecho contable, no
-- borra el riesgo operativo; mismo criterio que expo).
create or replace view crm.vista_alertas_impo
with (security_invoker = true) as
select
  oi.id                      as operacion_impo_id,
  ord.numero_orden,
  c.numero_contenedor,
  n.nombre                   as naviera,
  p.nombre                   as planta,
  oi.estado,
  ord.fecha_arribo_terminal,
  oi.fecha_retiro_terminal,
  oi.fecha_devolucion,
  mr.modo_reloj,
  d.dias_demurrage_transcurridos,
  d.dias_detention_transcurridos,
  d.dias_combined_transcurridos,
  ft.dias_demurrage          as dias_libres_demurrage,
  ft.dias_detention          as dias_libres_detention,
  ft.dias_combined           as dias_libres_combined,
  ft.tarifa_dry_usd_dia,
  e.exceso_total,
  m.costo_proyectado,
  e.estado_semaforo,
  e.dias_restantes,
  -- Columnas nuevas de la 039 AL FINAL: create or replace view no permite
  -- intercalar — y así el contrato de columnas existente queda intacto.
  wv.dias_waiver,
  m.costo_bruto
from crm.operaciones_impo oi
join crm.ordenes_impo ord   on ord.id = oi.orden_id
join crm.contenedores c     on c.id = oi.contenedor_id
join crm.navieras n         on n.id = ord.naviera_id
left join crm.plantas p     on p.id = ord.planta_destino_id
cross join lateral (
  select coalesce((select valor ->> 'modo' from crm.configuracion where clave = 'impo_regla_relojes'), 'auto') as modo
) cfg
left join lateral (
  select f.dias_combined, f.dias_demurrage, f.dias_detention,
         f.tarifa_dry_usd_dia, f.convencion_conteo
    from crm.freetime_destino f
   where f.naviera_id = ord.naviera_id
     and (p.pais_id is null or f.pais_id = p.pais_id)
     and f.hub is null
     and (ord.fecha_arribo_terminal at time zone 'America/Argentina/Buenos_Aires')::date >= f.vigente_desde
     and (f.vigente_hasta is null
          or (ord.fecha_arribo_terminal at time zone 'America/Argentina/Buenos_Aires')::date <= f.vigente_hasta)
   order by f.vigente_desde desc
   limit 1
) ft on true
cross join lateral (
  select
    case
      when cfg.modo = 'auto'
       and ft.dias_demurrage is not null and ft.dias_detention is not null
       and (ft.dias_demurrage + ft.dias_detention) > 0
      then 'split' else 'combined'
    end as modo_reloj
) mr
cross join lateral (
  select
    case when mr.modo_reloj = 'split'
      then crm.dias_con_convencion(ord.fecha_arribo_terminal,
             coalesce(oi.fecha_retiro_terminal, now()),
             coalesce(ft.convencion_conteo, 'retiro_dia_1'))
      else null::integer
    end as dias_demurrage_transcurridos,
    case when mr.modo_reloj = 'split' and oi.fecha_retiro_terminal is not null
      then crm.dias_con_convencion(oi.fecha_retiro_terminal,
             coalesce(oi.fecha_devolucion, now()),
             coalesce(ft.convencion_conteo, 'retiro_dia_1'))
      else null::integer
    end as dias_detention_transcurridos,
    case when mr.modo_reloj = 'combined'
      then crm.dias_con_convencion(ord.fecha_arribo_terminal,
             coalesce(oi.fecha_devolucion, now()),
             coalesce(ft.convencion_conteo, 'retiro_dia_1'))
      else null::integer
    end as dias_combined_transcurridos
) d
cross join lateral (
  select coalesce((select (valor ->> 'dias')::integer
                     from crm.configuracion
                    where clave = 'umbral_alerta_amarillo'), 3) as umbral
) cfgu
cross join lateral (
  select coalesce(sum(w.dias), 0)::integer as dias_waiver
    from crm.operacion_impo_waivers w
   where w.operacion_impo_id = oi.id and w.estado = 'vigente'
) wv
cross join lateral (
  select
    case
      when mr.modo_reloj = 'combined' then (ft.dias_combined is null or ft.tarifa_dry_usd_dia is null)
      else (ft.dias_demurrage is null or ft.dias_detention is null or ft.tarifa_dry_usd_dia is null)
    end as sin_tarifa,
    case
      when mr.modo_reloj = 'combined' then
        greatest(0, coalesce(d.dias_combined_transcurridos, 0) - coalesce(ft.dias_combined, 0))
      else
        greatest(0, coalesce(d.dias_demurrage_transcurridos, 0) - coalesce(ft.dias_demurrage, 0))
        + greatest(0, coalesce(d.dias_detention_transcurridos, 0) - coalesce(ft.dias_detention, 0))
    end as exceso_total,
    case
      when mr.modo_reloj = 'combined' then ft.dias_combined - d.dias_combined_transcurridos
      when oi.fecha_retiro_terminal is null then ft.dias_demurrage - d.dias_demurrage_transcurridos
      else ft.dias_detention - d.dias_detention_transcurridos
    end as dias_restantes_raw
) x
cross join lateral (
  select
    x.exceso_total,
    x.dias_restantes_raw as dias_restantes,
    case
      when x.sin_tarifa then 'neutro'
      when x.dias_restantes_raw < 0 or x.exceso_total > 0 then 'rojo'
      when x.dias_restantes_raw <= cfgu.umbral then 'amarillo'
      else 'verde'
    end as estado_semaforo
) e
cross join lateral (
  select
    case when e.estado_semaforo = 'neutro' then null::numeric
         else e.exceso_total::numeric * ft.tarifa_dry_usd_dia
    end as costo_bruto,
    case when e.estado_semaforo = 'neutro' then null::numeric
         else greatest(0, e.exceso_total - least(wv.dias_waiver, e.exceso_total))::numeric
              * ft.tarifa_dry_usd_dia
    end as costo_proyectado
) m
where oi.estado not in ('cerrado', 'anulada');

grant select on crm.vista_alertas_impo to authenticated;

create or replace view crm.vista_kpi_costos_cerradas_impo
with (security_invoker = true) as
select
  oi.id                      as operacion_impo_id,
  ord.naviera_id,
  n.nombre                   as naviera,
  ord.planta_destino_id,
  p.nombre                   as planta,
  ord.fecha_arribo_terminal,
  oi.fecha_retiro_terminal,
  oi.fecha_devolucion,
  mr.modo_reloj,
  d.dias_demurrage_transcurridos,
  d.dias_detention_transcurridos,
  d.dias_combined_transcurridos,
  ft.dias_demurrage          as dias_libres_demurrage,
  ft.dias_detention          as dias_libres_detention,
  ft.dias_combined           as dias_libres_combined,
  ft.tarifa_dry_usd_dia,
  e.exceso_total,
  m.costo_realizado,
  -- Columnas nuevas de la 039 al final (mismo criterio que en vista_alertas_impo).
  wv.dias_waiver,
  m.costo_bruto
from crm.operaciones_impo oi
join crm.ordenes_impo ord   on ord.id = oi.orden_id
join crm.contenedores c     on c.id = oi.contenedor_id
join crm.navieras n         on n.id = ord.naviera_id
left join crm.plantas p     on p.id = ord.planta_destino_id
cross join lateral (
  select coalesce((select valor ->> 'modo' from crm.configuracion where clave = 'impo_regla_relojes'), 'auto') as modo
) cfg
left join lateral (
  select f.dias_combined, f.dias_demurrage, f.dias_detention,
         f.tarifa_dry_usd_dia, f.convencion_conteo
    from crm.freetime_destino f
   where f.naviera_id = ord.naviera_id
     and (p.pais_id is null or f.pais_id = p.pais_id)
     and f.hub is null
     and (ord.fecha_arribo_terminal at time zone 'America/Argentina/Buenos_Aires')::date >= f.vigente_desde
     and (f.vigente_hasta is null
          or (ord.fecha_arribo_terminal at time zone 'America/Argentina/Buenos_Aires')::date <= f.vigente_hasta)
   order by f.vigente_desde desc
   limit 1
) ft on true
cross join lateral (
  select
    case
      when cfg.modo = 'auto'
       and ft.dias_demurrage is not null and ft.dias_detention is not null
       and (ft.dias_demurrage + ft.dias_detention) > 0
      then 'split' else 'combined'
    end as modo_reloj
) mr
cross join lateral (
  select
    case when mr.modo_reloj = 'split'
      then crm.dias_con_convencion(ord.fecha_arribo_terminal,
             coalesce(oi.fecha_retiro_terminal, now()),
             coalesce(ft.convencion_conteo, 'retiro_dia_1'))
      else null::integer
    end as dias_demurrage_transcurridos,
    case when mr.modo_reloj = 'split' and oi.fecha_retiro_terminal is not null
      then crm.dias_con_convencion(oi.fecha_retiro_terminal,
             coalesce(oi.fecha_devolucion, now()),
             coalesce(ft.convencion_conteo, 'retiro_dia_1'))
      else null::integer
    end as dias_detention_transcurridos,
    case when mr.modo_reloj = 'combined'
      then crm.dias_con_convencion(ord.fecha_arribo_terminal,
             coalesce(oi.fecha_devolucion, now()),
             coalesce(ft.convencion_conteo, 'retiro_dia_1'))
      else null::integer
    end as dias_combined_transcurridos
) d
cross join lateral (
  select coalesce(sum(w.dias), 0)::integer as dias_waiver
    from crm.operacion_impo_waivers w
   where w.operacion_impo_id = oi.id and w.estado = 'vigente'
) wv
cross join lateral (
  select
    case
      when mr.modo_reloj = 'combined' then (ft.dias_combined is null or ft.tarifa_dry_usd_dia is null)
      else (ft.dias_demurrage is null or ft.dias_detention is null or ft.tarifa_dry_usd_dia is null)
    end as sin_tarifa,
    case
      when mr.modo_reloj = 'combined' then
        greatest(0, coalesce(d.dias_combined_transcurridos, 0) - coalesce(ft.dias_combined, 0))
      else
        greatest(0, coalesce(d.dias_demurrage_transcurridos, 0) - coalesce(ft.dias_demurrage, 0))
        + greatest(0, coalesce(d.dias_detention_transcurridos, 0) - coalesce(ft.dias_detention, 0))
    end as exceso_total
) e
cross join lateral (
  select
    case when e.sin_tarifa then null::numeric
         else e.exceso_total::numeric * ft.tarifa_dry_usd_dia
    end as costo_bruto,
    case when e.sin_tarifa then null::numeric
         else greatest(0, e.exceso_total - least(wv.dias_waiver, e.exceso_total))::numeric
              * ft.tarifa_dry_usd_dia
    end as costo_realizado
) m
where oi.estado = 'cerrado' and oi.fecha_devolucion is not null;

grant select on crm.vista_kpi_costos_cerradas_impo to authenticated;

-- ═══ (8) Helper de exceso — DESPUÉS de las views (ver nota de orden en la sección 3) ═══
-- Exceso actual de una operación impo (abierta o cerrada), con la MISMA resolución
-- split/combined que las views — se lee DE las views (fuente única, cero duplicación
-- de la lógica de relojes). NULL si no hay tarifa que genere costo (sin_tarifa) o la
-- operación no existe. SECURITY DEFINER owner=postgres: las views son security_invoker
-- y este helper necesita verlas completas sin depender del scope del caller (los
-- waivers son supervisor+, globales por diseño).
create or replace function crm.exceso_actual_impo(p_operacion uuid)
returns integer
language sql stable
security definer
set search_path to ''
as $$
  select case when v.costo_bruto is null then null else v.exceso_total end
    from (
      select exceso_total, costo_bruto from crm.vista_alertas_impo where operacion_impo_id = p_operacion
      union all
      select exceso_total, costo_bruto from crm.vista_kpi_costos_cerradas_impo where operacion_impo_id = p_operacion
      limit 1
    ) v
$$;

revoke execute on function crm.exceso_actual_impo(uuid) from public, anon;
grant  execute on function crm.exceso_actual_impo(uuid) to authenticated;
