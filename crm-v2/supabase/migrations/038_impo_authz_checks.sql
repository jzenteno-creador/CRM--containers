-- 038: Importación — candados de autorización + CHECKs de fechas + semáforo honesto
-- (auditoría 2026-07-31, P1-A/P1-B/P2 del paquete impo; GO de John en la misma sesión)
--
-- Contexto: la 032 salió sin el review estricto que tuvo el resto de M5. Tres huecos:
--  (A) crm_crear_orden_impo tomaba planta_destino_id del payload sin atarlo al operador
--      — un operador de Planta A podía inyectar órdenes en la cola de Planta B. En expo
--      esto es imposible (la policy de movimientos_planta scopea incluso al executor);
--      en impo esa red no existe (policies del executor con check(true)).
--  (B) crm_confirmar_ingreso_planta_impo y crm_registrar_salida_devolucion_impo no
--      chequeaban rol NI planta — cualquier cuenta activa mutaba por UUID. Las otras
--      dos RPCs de la MISMA migración (retiro_terminal, devolucion_impo) sí lo hacen
--      con un SELECT previo scopeado: acá se replica ese patrón exacto.
--  (C) operaciones_impo no tenía ningún CHECK de coherencia de fechas (expo tiene 3)
--      y el semáforo en modo split mostraba VERDE con plata ya devengada del reloj
--      de demurrage.
-- Prod al momento de aplicar: 0 órdenes/operaciones impo (verificado) — cero riesgo
-- de filas existentes violando los CHECKs nuevos.

-- ═══ (C1) CHECKs de coherencia de fechas — espejo de los 3 de crm.operaciones ═══
alter table crm.operaciones_impo
  add constraint ck_impo_ingreso_post_retiro
    check (fecha_ingreso_planta is null or fecha_retiro_terminal is null
           or fecha_ingreso_planta >= fecha_retiro_terminal),
  add constraint ck_impo_devolucion_post_retiro
    check (fecha_devolucion is null or fecha_retiro_terminal is null
           or fecha_devolucion >= fecha_retiro_terminal),
  add constraint ck_impo_cerrado_tiene_devolucion
    check (estado <> 'cerrado' or fecha_devolucion is not null);

-- ═══ (A) crm_crear_orden_impo — el operador solo crea órdenes en SU planta ═══
-- Cambio quirúrgico: se agrega el guard de planta tras el guard de rol. El resto del
-- cuerpo es EXACTAMENTE el de la 032 (loop, advisory lock, guard cross expo, incidencias
-- auto por prefijo, shape del retorno — compat total con orden-form.tsx).
create or replace function crm.crm_crear_orden_impo(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_perfil record;
  v_numero_orden text := nullif(trim(p -> 'header' ->> 'numero_orden'), '');
  v_naviera uuid := (p -> 'header' ->> 'naviera_id')::uuid;
  v_booking_bl text := nullif(trim(p -> 'header' ->> 'booking_bl'), '');
  v_buque text := nullif(trim(p -> 'header' ->> 'buque'), '');
  v_fecha_arribo timestamptz := (p -> 'header' ->> 'fecha_arribo_terminal')::timestamptz;
  v_planta uuid := (p -> 'header' ->> 'planta_destino_id')::uuid;
  v_orden_id uuid;
  v_item jsonb;
  v_num text;
  v_tipo text;
  v_prefijo text;
  v_prefijo_restringido boolean;
  v_cont_id uuid;
  v_op_id uuid;
  v_creadas int := 0;
  v_rechazadas int := 0;
  v_incidencias_auto int := 0;
  v_prefijos_restringidos_detectados int := 0;
  v_resultados jsonb := '[]'::jsonb;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo'
     or v_perfil.rol is null
     or v_perfil.rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'crear orden de importación requiere operador, supervisor o administrador';
  end if;

  -- FIX 038 (P1-A): el planta-scoping del operador es invariante de AGENTS.md y acá
  -- no lo respalda ninguna policy (executor con check(true)) — se impone en el cuerpo,
  -- mismo criterio que aprobar_usuario. Supervisor/admin siguen globales (modelo expo).
  if v_perfil.rol = 'operador' then
    if v_perfil.planta_asignada_id is null then
      raise exception 'operador sin planta asignada: no puede crear órdenes de importación';
    end if;
    if v_planta is distinct from v_perfil.planta_asignada_id then
      raise exception 'planta_fuera_de_alcance: un operador solo puede crear órdenes para su planta asignada';
    end if;
  end if;

  if v_numero_orden is null or v_naviera is null or v_fecha_arribo is null or v_planta is null then
    raise exception 'encabezado incompleto (numero_orden, naviera_id, fecha_arribo_terminal, planta_destino_id)';
  end if;
  if p -> 'contenedores' is null or jsonb_array_length(p -> 'contenedores') = 0 then
    raise exception 'la orden no tiene contenedores';
  end if;

  begin
    insert into crm.ordenes_impo
      (numero_orden, naviera_id, booking_bl, buque, fecha_arribo_terminal, planta_destino_id, creado_por)
    values
      (v_numero_orden, v_naviera, v_booking_bl, v_buque, v_fecha_arribo, v_planta, v_perfil.usuario_id)
    returning id into v_orden_id;
  exception
    when unique_violation then
      raise exception 'numero_orden_duplicado: ya existe una orden de importación con el número %', v_numero_orden;
  end;

  for v_item in select * from jsonb_array_elements(p -> 'contenedores') loop
    v_num := upper(v_item ->> 'numero');
    v_tipo := v_item ->> 'tipo';
    v_prefijo := left(v_num, 4);
    select exists(
      select 1 from crm.prefijos_restringidos pr where pr.prefijo = v_prefijo and pr.activo
    ) into v_prefijo_restringido;

    begin
      select id into v_cont_id from crm.contenedores where numero_contenedor = v_num;
      if v_cont_id is null then
        v_cont_id := gen_random_uuid();
        insert into crm.contenedores (id, numero_contenedor, naviera_id, tipo)
        values (v_cont_id, v_num, v_naviera, v_tipo);
      end if;
      -- si ya existía, naviera/tipo quedan los del maestro (registro único §6.3.1)

      -- Guard cross (D2 del plan M5): advisory lock por contenedor + rechazo
      -- si tiene un ciclo de EXPORTACIÓN abierto. El backstop del ciclo IMPO
      -- (ux_operacion_impo_abierta) lo captura el unique_violation de abajo.
      perform pg_advisory_xact_lock(hashtext(v_cont_id::text));

      if exists (
        select 1 from crm.operaciones o
         where o.contenedor_id = v_cont_id
           and o.estado not in ('cerrado', 'anulada')
      ) then
        v_rechazadas := v_rechazadas + 1;
        v_resultados := v_resultados || jsonb_build_object(
          'numero', v_num, 'estado', 'rechazado', 'operacion_impo_id', null,
          'motivo', 'ciclo_abierto_expo',
          'motivo_texto', format('%s tiene un ciclo de exportación abierto — no se puede iniciar un ciclo de importación', v_num),
          'prefijo_restringido', v_prefijo_restringido);
        continue;
      end if;

      v_op_id := gen_random_uuid();
      insert into crm.operaciones_impo (id, orden_id, contenedor_id, estado)
      values (v_op_id, v_orden_id, v_cont_id, 'en_terminal');

      if v_prefijo_restringido then
        insert into crm.incidencias (operacion_impo_id, tipo, descripcion, fecha, usuario_id, numero_orden)
        values (v_op_id, 'prefijo_restringido',
                format('Prefijo %s restringido por Dow container screen (auto)', v_prefijo),
                v_fecha_arribo, v_perfil.usuario_id, v_numero_orden);
        v_incidencias_auto := v_incidencias_auto + 1;
        v_prefijos_restringidos_detectados := v_prefijos_restringidos_detectados + 1;
      end if;

      v_creadas := v_creadas + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'numero', v_num, 'estado', 'aceptado', 'operacion_impo_id', v_op_id, 'motivo', null,
        'motivo_texto', null, 'prefijo_restringido', v_prefijo_restringido);
    exception
      when unique_violation then
        v_rechazadas := v_rechazadas + 1;
        v_resultados := v_resultados || jsonb_build_object(
          'numero', v_num, 'estado', 'rechazado', 'operacion_impo_id', null,
          'motivo', 'ciclo_abierto_impo',
          'motivo_texto', format('%s ya tiene un ciclo de importación abierto', v_num),
          'prefijo_restringido', v_prefijo_restringido);
      when check_violation then
        v_rechazadas := v_rechazadas + 1;
        v_resultados := v_resultados || jsonb_build_object(
          'numero', v_num, 'estado', 'rechazado', 'operacion_impo_id', null,
          'motivo', 'numero_o_tipo_invalido',
          'motivo_texto', format('%s: número inválido (formato AAAA1234567) o tipo inválido (20DC|40DC|40HC)', v_num),
          'prefijo_restringido', v_prefijo_restringido);
    end;
  end loop;

  return jsonb_build_object('orden_id', v_orden_id, 'creadas', v_creadas, 'rechazadas', v_rechazadas,
                             'incidencias_auto', v_incidencias_auto,
                             'prefijos_restringidos_detectados', v_prefijos_restringidos_detectados,
                             'resultados', v_resultados);
end $function$;

-- ═══ (B1) crm_confirmar_ingreso_planta_impo — rol + planta + coherencia de fecha ═══
-- Patrón del SELECT previo scopeado: el mismo que crm_confirmar_retiro_terminal y
-- crm_confirmar_devolucion_impo (032) usan y estas dos RPCs no usaban.
-- Shape del retorno: {confirmadas} se mantiene (GrupoAccionSimple lee resultKey=
-- 'confirmadas'); se agregan rechazadas/resultados — aditivo, no rompe el front.
-- SEMÁNTICA DEL RECHAZO CROSS-PLANTA (medido en harness): el SELECT previo corre bajo
-- la RLS del executor (operaciones_impo_select scopea al operador por planta vía
-- membresía) — una operación de otra planta es INVISIBLE y el rechazo sale como
-- 'estado_no_valido', no 'fuera_de_alcance'. Eso es deseable (no filtra existencia
-- cross-planta). El if explícito de planta de abajo queda como defensa en profundidad
-- por si la policy SELECT cambiara algún día.
create or replace function crm.crm_confirmar_ingreso_planta_impo(
  p_operacion_impo_ids uuid[],
  p_fecha timestamptz)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_perfil record;
  v_op uuid;
  v_row record;
  v_n int := 0;
  v_rechazadas int := 0;
  v_resultados jsonb := '[]'::jsonb;
begin
  select * into v_perfil from crm.perfil();
  -- FIX 038 (P1-B): antes solo chequeaba estado de cuenta — ni rol ni planta.
  if v_perfil.estado is distinct from 'activo'
     or v_perfil.rol is null
     or v_perfil.rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'confirmar ingreso a planta requiere operador, supervisor o administrador';
  end if;
  if p_fecha is null then
    raise exception 'fecha de ingreso a planta obligatoria';
  end if;
  if p_operacion_impo_ids is null or array_length(p_operacion_impo_ids, 1) is null then
    raise exception 'no se indicaron operaciones';
  end if;

  foreach v_op in array p_operacion_impo_ids loop
    select oi.id as op_id, oi.fecha_retiro_terminal, ord.planta_destino_id
      into v_row
      from crm.operaciones_impo oi
      join crm.ordenes_impo ord on ord.id = oi.orden_id
     where oi.id = v_op
       and oi.estado = 'en_transito_a_planta';

    if v_row.op_id is null then
      v_rechazadas := v_rechazadas + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op, 'estado', 'rechazado', 'motivo', 'estado_no_valido');
      continue;
    end if;

    -- FIX 038: el operador solo confirma en SU planta (supervisor/admin globales).
    if v_perfil.rol = 'operador'
       and v_row.planta_destino_id is distinct from v_perfil.planta_asignada_id then
      v_rechazadas := v_rechazadas + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op, 'estado', 'rechazado', 'motivo', 'fuera_de_alcance');
      continue;
    end if;

    -- FIX 038: coherencia — el ingreso no puede ser anterior al retiro de terminal
    -- (el CHECK nuevo es la red final; acá el motivo legible).
    if v_row.fecha_retiro_terminal is not null and p_fecha < v_row.fecha_retiro_terminal then
      v_rechazadas := v_rechazadas + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op, 'estado', 'rechazado', 'motivo', 'fecha_anterior_a_retiro');
      continue;
    end if;

    update crm.operaciones_impo
       set estado = 'en_planta',
           fecha_ingreso_planta = p_fecha
     where id = v_op
       and estado = 'en_transito_a_planta';
    if found then
      v_n := v_n + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op, 'estado', 'confirmado', 'motivo', null);
    else
      v_rechazadas := v_rechazadas + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op, 'estado', 'rechazado', 'motivo', 'estado_no_valido');
    end if;
  end loop;

  return jsonb_build_object('confirmadas', v_n, 'rechazadas', v_rechazadas, 'resultados', v_resultados);
end $fn$;

-- ═══ (B2) crm_registrar_salida_devolucion_impo — rol + planta + coherencia ═══
-- Shape: {salidas} se mantiene (resultKey='salidas'); rechazadas/resultados aditivos.
create or replace function crm.crm_registrar_salida_devolucion_impo(
  p_operacion_impo_ids uuid[],
  p_fecha timestamptz)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_perfil record;
  v_op uuid;
  v_row record;
  v_n int := 0;
  v_rechazadas int := 0;
  v_resultados jsonb := '[]'::jsonb;
begin
  select * into v_perfil from crm.perfil();
  -- FIX 038 (P1-B): antes solo chequeaba estado de cuenta — ni rol ni planta.
  if v_perfil.estado is distinct from 'activo'
     or v_perfil.rol is null
     or v_perfil.rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'registrar salida a devolución requiere operador, supervisor o administrador';
  end if;
  if p_fecha is null then
    raise exception 'fecha de salida hacia devolución obligatoria';
  end if;
  if p_operacion_impo_ids is null or array_length(p_operacion_impo_ids, 1) is null then
    raise exception 'no se indicaron operaciones';
  end if;

  foreach v_op in array p_operacion_impo_ids loop
    select oi.id as op_id, oi.fecha_ingreso_planta, ord.planta_destino_id
      into v_row
      from crm.operaciones_impo oi
      join crm.ordenes_impo ord on ord.id = oi.orden_id
     where oi.id = v_op
       and oi.estado = 'en_planta';

    if v_row.op_id is null then
      v_rechazadas := v_rechazadas + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op, 'estado', 'rechazado', 'motivo', 'estado_no_valido');
      continue;
    end if;

    if v_perfil.rol = 'operador'
       and v_row.planta_destino_id is distinct from v_perfil.planta_asignada_id then
      v_rechazadas := v_rechazadas + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op, 'estado', 'rechazado', 'motivo', 'fuera_de_alcance');
      continue;
    end if;

    if v_row.fecha_ingreso_planta is not null and p_fecha < v_row.fecha_ingreso_planta then
      v_rechazadas := v_rechazadas + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op, 'estado', 'rechazado', 'motivo', 'fecha_anterior_a_ingreso');
      continue;
    end if;

    update crm.operaciones_impo
       set estado = 'en_transito_devolucion'
     where id = v_op
       and estado = 'en_planta';
    if found then
      v_n := v_n + 1;
      insert into crm.operacion_impo_eventos (operacion_impo_id, tipo_evento, fecha, usuario_id, detalle)
      values (v_op, 'salida_devolucion', p_fecha, v_perfil.usuario_id, '{}'::jsonb);
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op, 'estado', 'confirmado', 'motivo', null);
    end if;
  end loop;

  return jsonb_build_object('salidas', v_n, 'rechazadas', v_rechazadas, 'resultados', v_resultados);
end $fn$;

-- ═══ (C2) Semáforo honesto en modo split ═══
-- Bug (auditoría P2): tras el retiro, dias_restantes cambia al reloj de detention en 0
-- y el semáforo daba VERDE aunque el reloj de demurrage ya hubiera devengado plata.
-- Fix: exceso_total > 0 fuerza ROJO — si ya hay costo corriendo, la operación nunca
-- es "sin riesgo". dias_restantes sigue siendo "del reloj corriente" (informativo).
-- Única línea cambiada respecto de la 032: el CASE de estado_semaforo en el CTE e.
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
  e.dias_restantes
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
    -- Solo 'auto' está implementado; cualquier otro valor de cfg.modo cae acá
    -- al branch 'combined' por default (documentado en la cabecera).
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
      -- FIX 038: exceso ya devengado (típico: reloj demurrage vencido y reloj
      -- detention recién arrancando) => ROJO. Antes el CASE solo miraba el reloj
      -- corriente y una op con USD ya corriendo podía figurar verde.
      when x.dias_restantes_raw < 0 or x.exceso_total > 0 then 'rojo'
      when x.dias_restantes_raw <= cfgu.umbral then 'amarillo'
      else 'verde'
    end as estado_semaforo
) e
cross join lateral (
  select
    case when e.estado_semaforo = 'neutro' then null::numeric
         else e.exceso_total::numeric * ft.tarifa_dry_usd_dia
    end as costo_proyectado
) m
where oi.estado not in ('cerrado', 'anulada');

-- create or replace view preserva grants; se re-declara por claridad (idempotente).
grant select on crm.vista_alertas_impo to authenticated;
