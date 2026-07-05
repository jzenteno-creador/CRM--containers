-- generado desde cctuowthpnstvdgjuomq el 2026-07-05, read-only export
-- Funciones del schema detention

CREATE OR REPLACE FUNCTION detention.crm_anular_operacion(p_operacion_id uuid, p_motivo text, p_usuario uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'detention', 'public'
AS $function$
begin
  update operaciones set estado = 'anulada', anulada_motivo = p_motivo, anulada_por = p_usuario
    where id = p_operacion_id and estado not in ('cerrado','anulada');
  if not found then
    raise exception 'La operación no está abierta (no se puede anular)';
  end if;
  insert into operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
  values (p_operacion_id, 'anulacion', now(), p_usuario, jsonb_build_object('motivo', p_motivo));
end $function$

CREATE OR REPLACE FUNCTION detention.crm_confirmar_devolucion(p_operacion_ids uuid[], p_fecha timestamp with time zone, p_usuario uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'detention', 'public'
AS $function$
declare v_n int := 0; v_op uuid;
begin
  foreach v_op in array p_operacion_ids loop
    update operaciones set fecha_devolucion = p_fecha, estado = 'cerrado'
      where id = v_op and estado = 'en_transito_a_terminal';
    if found then
      insert into operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
      values (v_op, 'devolucion', p_fecha, p_usuario, jsonb_build_object('corta_freetime', true));
      v_n := v_n + 1;
    end if;
  end loop;
  return jsonb_build_object('cerradas', v_n);
end $function$

CREATE OR REPLACE FUNCTION detention.crm_confirmar_ingreso_planta(p_operacion_ids uuid[], p_fecha timestamp with time zone, p_medio text, p_usuario uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'detention', 'public'
AS $function$
declare v_n int := 0; v_op uuid;
begin
  foreach v_op in array p_operacion_ids loop
    update movimientos_planta
      set estado = 'confirmado', fecha_llegada_confirmada = p_fecha,
          medio = coalesce(p_medio, medio), confirmado_por = p_usuario
      where operacion_id = v_op and estado = 'en_transito';
    update operaciones set estado = 'en_planta' where id = v_op and estado = 'en_transito_a_planta';
    -- D-04 (2026-07-05): solo evento+conteo si la operación transicionó (evita duplicados por carrera)
    if found then
      insert into operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
      values (v_op, 'ingreso_planta', p_fecha, p_usuario, jsonb_build_object('medio', p_medio));
      v_n := v_n + 1;
    end if;
  end loop;
  return jsonb_build_object('confirmadas', v_n);
end $function$

CREATE OR REPLACE FUNCTION detention.crm_confirmar_movimiento()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'detention', 'public'
AS $function$
begin
  if new.estado = 'confirmado' and (tg_op = 'INSERT' or old.estado is distinct from 'confirmado') then
    update operaciones set planta_actual_id = new.planta_destino_id, updated_at = now()
      where id = new.operacion_id;
  end if;
  return new;
end $function$

CREATE OR REPLACE FUNCTION detention.crm_crear_tanda_retiro(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'detention', 'public'
AS $function$
declare
  v_naviera uuid := (p->'header'->>'naviera_id')::uuid;
  v_tipo text := p->'header'->>'tipo';
  v_retiro_de text := p->'header'->>'retiro_de';
  v_planta uuid := (p->'header'->>'planta_destino_id')::uuid;
  v_booking text := p->'header'->>'booking_retiro';
  v_fecha timestamptz := (p->'header'->>'fecha_retiro')::timestamptz;
  v_confirma bool := coalesce((p->'header'->>'confirma_ingreso')::bool, false);
  v_medio text := coalesce(p->'header'->>'medio', 'camion');
  v_usuario uuid := nullif(p->>'usuario_id','')::uuid;
  v_item jsonb;
  v_num text;
  v_reforzado bool;
  v_cont_id uuid;
  v_op_id uuid;
  v_creadas int := 0;
  v_abiertos text[] := '{}';
begin
  -- guard previo: contenedores con ciclo abierto (mensaje claro para la UI)
  select coalesce(array_agg(c.numero_contenedor), '{}') into v_abiertos
  from jsonb_array_elements(p->'contenedores') it
  join contenedores c on c.numero_contenedor = upper(it->>'numero')
  join operaciones o on o.contenedor_id = c.id and o.estado not in ('cerrado','anulada');
  if array_length(v_abiertos, 1) > 0 then
    raise exception 'Contenedores con ciclo abierto: %', array_to_string(v_abiertos, ', ');
  end if;

  for v_item in select * from jsonb_array_elements(p->'contenedores') loop
    v_num := upper(v_item->>'numero');
    v_reforzado := coalesce((v_item->>'reforzado')::bool, true);

    select id into v_cont_id from contenedores where numero_contenedor = v_num;
    if v_cont_id is null then
      insert into contenedores (numero_contenedor, naviera_id, tipo, reforzado_estado)
      values (v_num, v_naviera, v_tipo,
              case when v_reforzado then 'confirmado_reforzado' else 'confirmado_no_reforzado' end)
      returning id into v_cont_id;
    end if;
    -- si ya existía, naviera/tipo quedan los del maestro (registro único, estables)

    insert into operaciones (contenedor_id, retiro_de, booking_retiro, fecha_retiro, estado)
    values (v_cont_id, v_retiro_de, v_booking, v_fecha,
            case when v_confirma then 'en_planta' else 'en_transito_a_planta' end)
    returning id into v_op_id;

    insert into movimientos_planta (operacion_id, planta_origen_id, planta_destino_id, medio,
                                    fecha_salida, fecha_llegada_confirmada, confirmado_por, estado)
    values (v_op_id, null, v_planta, v_medio, v_fecha,
            case when v_confirma then v_fecha end,
            case when v_confirma then v_usuario end,
            case when v_confirma then 'confirmado' else 'en_transito' end);

    insert into operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
    values (v_op_id, 'retiro', v_fecha, v_usuario,
            jsonb_build_object('retiro_de', v_retiro_de, 'booking_retiro', v_booking));
    if v_confirma then
      insert into operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
      values (v_op_id, 'ingreso_planta', v_fecha, v_usuario, jsonb_build_object('medio', v_medio));
    end if;
    v_creadas := v_creadas + 1;
  end loop;

  return jsonb_build_object('creadas', v_creadas);
end $function$

CREATE OR REPLACE FUNCTION detention.crm_dashboard(p_planta uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'detention', 'public'
AS $function$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_mes date := date_trunc('month', v_hoy)::date;
  v_anio date := date_trunc('year', v_hoy)::date;
  result jsonb;
begin
  select jsonb_build_object(
    'costo_mes', coalesce((select round(sum(costo_usd)) from vista_costos_cerrados v
        join operaciones o on o.id = v.operacion_id
        where (v.fecha_devolucion at time zone 'America/Argentina/Buenos_Aires')::date >= v_mes
          and (p_planta is null or o.planta_actual_id = p_planta)), 0),
    'costo_ytd', coalesce((select round(sum(costo_usd)) from vista_costos_cerrados v
        join operaciones o on o.id = v.operacion_id
        where (v.fecha_devolucion at time zone 'America/Argentina/Buenos_Aires')::date >= v_anio
          and (p_planta is null or o.planta_actual_id = p_planta)), 0),
    'costo_historial', coalesce((select round(sum(costo_usd)) from vista_costos_cerrados v
        join operaciones o on o.id = v.operacion_id
        where (p_planta is null or o.planta_actual_id = p_planta)), 0),
    'historial_desde', (select to_char(min((v.fecha_devolucion at time zone 'America/Argentina/Buenos_Aires')::date), 'YYYY-MM')
        from vista_costos_cerrados v
        join operaciones o on o.id = v.operacion_id
        where (p_planta is null or o.planta_actual_id = p_planta)),
    'costo_proyectado_abiertas', coalesce((select round(sum(a.costo_proyectado)) from vista_alertas a
        join operaciones o on o.id = a.operacion_id
        where (p_planta is null or o.planta_actual_id = p_planta)), 0),
    'en_riesgo', (select count(*) from vista_alertas a join operaciones o on o.id = a.operacion_id
        where a.estado_semaforo in ('rojo','amarillo')
          and (p_planta is null or o.planta_actual_id = p_planta)),
    'vencidos', (select count(*) from vista_alertas a join operaciones o on o.id = a.operacion_id
        where a.estado_semaforo = 'rojo' and (p_planta is null or o.planta_actual_id = p_planta)),
    'por_vencer', (select count(*) from vista_alertas a join operaciones o on o.id = a.operacion_id
        where a.estado_semaforo = 'amarillo' and (p_planta is null or o.planta_actual_id = p_planta)),
    'stock_vacios', (select count(*) from operaciones o
        where o.estado = 'en_planta' and (p_planta is null or o.planta_actual_id = p_planta)),
    'en_transito_a_planta', (select count(*) from operaciones o where o.estado = 'en_transito_a_planta'),
    'en_transito_a_terminal', (select count(*) from operaciones o
        where o.estado = 'en_transito_a_terminal' and (p_planta is null or o.planta_actual_id = p_planta)),
    'demora_promedio', coalesce((select round(avg(demora), 1) from vista_costos_cerrados v
        join operaciones o on o.id = v.operacion_id
        where v.demora > 0 and (p_planta is null or o.planta_actual_id = p_planta)), 0),
    'estadia_promedio', coalesce((select round(avg(estadia), 1) from vista_costos_cerrados v
        join operaciones o on o.id = v.operacion_id
        where (p_planta is null or o.planta_actual_id = p_planta)), 0),
    'estadia_promedio_abiertas', coalesce((select round(avg(a.dias_estadia), 1) from vista_alertas a
        join operaciones o on o.id = a.operacion_id
        where (p_planta is null or o.planta_actual_id = p_planta)), 0),
    'costo_por_naviera', coalesce((select jsonb_agg(t) from (
        select v.naviera, round(sum(v.costo_usd)) as costo
        from vista_costos_cerrados v join operaciones o on o.id = v.operacion_id
        where (p_planta is null or o.planta_actual_id = p_planta)
        group by v.naviera order by costo desc nulls last) t), '[]'::jsonb),
    'tendencia_mensual', coalesce((select jsonb_agg(t order by t.mes) from (
        select to_char(date_trunc('month', (v.fecha_devolucion at time zone 'America/Argentina/Buenos_Aires')::date), 'YYYY-MM') as mes,
               round(sum(v.costo_usd)) as costo
        from vista_costos_cerrados v join operaciones o on o.id = v.operacion_id
        where (p_planta is null or o.planta_actual_id = p_planta)
        group by 1) t), '[]'::jsonb)
  ) into result;
  return result;
end $function$

CREATE OR REPLACE FUNCTION detention.crm_mover_entre_plantas(p_operacion_id uuid, p_destino uuid, p_medio text, p_fecha_salida timestamp with time zone, p_confirmar boolean, p_fecha_llegada timestamp with time zone, p_usuario uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'detention', 'public'
AS $function$
declare v_origen uuid;
begin
  select planta_actual_id into v_origen from operaciones
    where id = p_operacion_id and estado in ('en_planta','cargado');
  if not found then
    raise exception 'La operación no está en planta';
  end if;
  insert into movimientos_planta (operacion_id, planta_origen_id, planta_destino_id, medio,
                                  fecha_salida, fecha_llegada_confirmada, confirmado_por, estado)
  values (p_operacion_id, v_origen, p_destino, p_medio, p_fecha_salida,
          case when p_confirmar then coalesce(p_fecha_llegada, p_fecha_salida) end,
          case when p_confirmar then p_usuario end,
          case when p_confirmar then 'confirmado' else 'en_transito' end);
  insert into operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
  values (p_operacion_id, 'movimiento', p_fecha_salida, p_usuario,
          jsonb_build_object('destino_id', p_destino, 'medio', p_medio, 'confirmado', p_confirmar));
end $function$

-- D-01 (2026-07-05): scopea el cierre por naviera+régimen, parametriza p_regimen,
-- valida entradas + coherencia de fecha (insert-only, sin ventana 0-día), idempotente.
CREATE OR REPLACE FUNCTION detention.crm_nueva_version_freetime(p_naviera uuid, p_dias integer, p_peligrosa boolean, p_tipo text, p_tarifa numeric, p_desde date, p_regimen text DEFAULT 'vacios')
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'detention', 'public'
AS $function$
declare v_id uuid; v_prev record;
begin
  if p_regimen is null or p_regimen not in ('vacios','cargados','sin_uso') then raise exception 'régimen inválido: %', p_regimen; end if;
  if p_tipo   is null or p_tipo   not in ('Detention','Demurrage','Combined') then raise exception 'tipo inválido: %', p_tipo; end if;
  if p_dias   is null or p_dias < 0 then raise exception 'días libres inválidos: %', p_dias; end if;
  if p_tarifa is null or p_tarifa < 0 then raise exception 'tarifa inválida: %', p_tarifa; end if;
  if p_desde  is null then raise exception 'fecha de vigencia obligatoria'; end if;
  select * into v_prev from freetime_origin where naviera_id = p_naviera and regimen = p_regimen and vigente_hasta is null limit 1;
  if v_prev.id is not null and v_prev.vigente_desde = p_desde and v_prev.dias_libres = p_dias and v_prev.tarifa_usd_dia = p_tarifa and v_prev.tipo = p_tipo and v_prev.aplica_carga_peligrosa = p_peligrosa then return v_prev.id; end if;
  if v_prev.id is not null and p_desde <= v_prev.vigente_desde then raise exception 'la vigencia nueva (%) debe ser posterior al inicio de la versión vigente (%)', p_desde, v_prev.vigente_desde; end if;
  if v_prev.id is not null then update freetime_origin set vigente_hasta = p_desde - 1 where id = v_prev.id; end if;
  insert into freetime_origin (naviera_id, regimen, dias_libres, aplica_carga_peligrosa, tipo, tarifa_usd_dia, vigente_desde, vigente_hasta)
  values (p_naviera, p_regimen, p_dias, p_peligrosa, p_tipo, p_tarifa, p_desde, null)
  returning id into v_id;
  return v_id;
end $function$

CREATE OR REPLACE FUNCTION detention.crm_registrar_salida_planta(p_operacion_ids uuid[], p_tipo_cierre text, p_fecha timestamp with time zone, p_asignacion jsonb, p_usuario uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'detention', 'public'
AS $function$
declare v_n int := 0; v_op uuid;
begin
  if p_tipo_cierre not in ('embarcado','devuelto_vacio') then
    raise exception 'tipo_cierre inválido: %', p_tipo_cierre;
  end if;
  foreach v_op in array p_operacion_ids loop
    update operaciones set
      tipo_cierre = p_tipo_cierre,
      fecha_egreso_planta = p_fecha,
      estado = 'en_transito_a_terminal',
      booking_asignado = case when p_tipo_cierre = 'embarcado' then p_asignacion->>'booking_asignado' else booking_asignado end,
      buque    = case when p_tipo_cierre = 'embarcado' then p_asignacion->>'buque' else buque end,
      destino  = case when p_tipo_cierre = 'embarcado' then p_asignacion->>'destino' else destino end,
      orden    = case when p_tipo_cierre = 'embarcado' then p_asignacion->>'orden' else orden end,
      shp      = case when p_tipo_cierre = 'embarcado' then p_asignacion->>'shp' else shp end
    where id = v_op and estado in ('en_planta','cargado');
    if found then
      if p_tipo_cierre = 'embarcado' then
        insert into operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
        values (v_op, 'carga', p_fecha, p_usuario, p_asignacion);
      end if;
      insert into operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
      values (v_op, 'egreso', p_fecha, p_usuario, jsonb_build_object('tipo_cierre', p_tipo_cierre));
      v_n := v_n + 1;
    end if;
  end loop;
  return jsonb_build_object('salidas', v_n);
end $function$

CREATE OR REPLACE FUNCTION detention.crm_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'detention', 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$

CREATE OR REPLACE FUNCTION detention.crm_validar_reforzado(p_contenedor uuid, p_estado text, p_usuario uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'detention', 'public'
AS $function$
begin
  update contenedores set reforzado_estado = p_estado,
    reforzado_validado_por = p_usuario, reforzado_fecha_validacion = now()
    where id = p_contenedor;
end $function$

-- F-02 (2026-07-05): reversa contable de un cierre por error. Revierte cerrado→en_transito_a_terminal,
-- limpia fecha_devolucion y deja evento 'reapertura' con motivo. ux_operacion_abierta protege contra
-- reabrir si el contenedor ya tiene otro ciclo abierto (unique_violation).
CREATE OR REPLACE FUNCTION detention.crm_reabrir_operacion(p_operacion uuid, p_usuario uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'detention', 'public'
AS $function$
begin
  if p_motivo is null or length(trim(p_motivo)) = 0 then raise exception 'motivo obligatorio para reabrir'; end if;
  update operaciones set estado='en_transito_a_terminal', fecha_devolucion=null, updated_at=now()
   where id = p_operacion and estado='cerrado';
  if not found then raise exception 'la operación no está cerrada (no se puede reabrir)'; end if;
  insert into operacion_eventos(operacion_id, tipo_evento, fecha, usuario_id, detalle)
   values (p_operacion, 'reapertura', now(), p_usuario, jsonb_build_object('motivo', p_motivo));
end $function$

-- F-03 (2026-07-05): edición auditada de datos de asignación/fechas. Whitelist de campos, deja
-- evento 'correccion' con snapshot anterior→nuevo. Los CHECKs de D-05 validan las fechas.
CREATE OR REPLACE FUNCTION detention.crm_corregir_operacion(p_operacion uuid, p_usuario uuid, p_campos jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'detention', 'public'
AS $function$
declare v_op operaciones; v_anterior jsonb;
  v_allowed text[] := ARRAY['booking_asignado','buque','destino','orden','shp','fecha_retiro','fecha_egreso_planta','fecha_devolucion'];
begin
  select * into v_op from operaciones where id = p_operacion;
  if not found then raise exception 'operación no encontrada'; end if;
  if p_campos is null or p_campos = '{}'::jsonb then raise exception 'no hay campos para corregir'; end if;
  if exists (select 1 from jsonb_object_keys(p_campos) k where k <> all(v_allowed)) then
    raise exception 'campo no editable en la corrección'; end if;
  select jsonb_object_agg(k, to_jsonb(v_op)->k) into v_anterior from jsonb_object_keys(p_campos) k;
  update operaciones set
    booking_asignado = case when p_campos ? 'booking_asignado' then nullif(p_campos->>'booking_asignado','') else booking_asignado end,
    buque = case when p_campos ? 'buque' then nullif(p_campos->>'buque','') else buque end,
    destino = case when p_campos ? 'destino' then nullif(p_campos->>'destino','') else destino end,
    orden = case when p_campos ? 'orden' then nullif(p_campos->>'orden','') else orden end,
    shp = case when p_campos ? 'shp' then nullif(p_campos->>'shp','') else shp end,
    fecha_retiro = case when p_campos ? 'fecha_retiro' then (p_campos->>'fecha_retiro')::timestamptz else fecha_retiro end,
    fecha_egreso_planta = case when p_campos ? 'fecha_egreso_planta' then nullif(p_campos->>'fecha_egreso_planta','')::timestamptz else fecha_egreso_planta end,
    fecha_devolucion = case when p_campos ? 'fecha_devolucion' then nullif(p_campos->>'fecha_devolucion','')::timestamptz else fecha_devolucion end,
    updated_at = now()
  where id = p_operacion;
  insert into operacion_eventos(operacion_id, tipo_evento, fecha, usuario_id, detalle)
  values (p_operacion, 'correccion', now(), p_usuario, jsonb_build_object('cambios', p_campos, 'anterior', v_anterior));
end $function$
