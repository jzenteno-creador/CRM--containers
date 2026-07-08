-- ============================================================================
-- 006_rpcs_operativas — M1 rebuild v2 CRM Detention
-- crm_crear_tanda_retiro, crm_confirmar_ingreso_planta,
-- crm_registrar_salida_planta, crm_confirmar_devolucion,
-- crm_mover_entre_plantas, crm_anular_operacion.
--
-- Adaptadas de v1 con los cambios del plan:
--   · SECURITY INVOKER: la RLS aplica ADENTRO (el scope de planta y los
--     permisos por rol los imponen las policies de 004, no la función).
--   · Sin inserts manuales de eventos: el timeline lo escriben los triggers
--     DEFINER de 005.
--   · Sin estado 'cargado' (§18.1).
--   · usuario_id derivado de la sesión vía perfil() — nunca parámetro
--     falsificable.
--   · Sin RETURNING sobre filas recién insertadas de operaciones: los uuid se
--     generan ANTES del INSERT (la fila nueva con planta_actual_id NULL no
--     matchea el SELECT del operador ⇒ RETURNING fallaría con 42501).
--   · El guard previo de ciclo abierto puede NO ver operaciones de otras
--     plantas (RLS): el backstop real es ux_operacion_abierta, capturado como
--     unique_violation con mensaje claro.
-- Los guards explícitos de estado/rol al inicio son UX (mensaje claro);
-- la enforcement es RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- crm_crear_tanda_retiro — Ingreso F1 (§6.1). p = {header:{...}, contenedores:[...]}
-- ----------------------------------------------------------------------------
create or replace function crm.crm_crear_tanda_retiro(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_perfil record;
  v_naviera uuid := (p -> 'header' ->> 'naviera_id')::uuid;
  v_tipo text := p -> 'header' ->> 'tipo';
  v_retiro_de text := p -> 'header' ->> 'retiro_de';
  v_planta uuid := (p -> 'header' ->> 'planta_destino_id')::uuid;
  v_booking text := p -> 'header' ->> 'booking_retiro';
  v_fecha timestamptz := (p -> 'header' ->> 'fecha_retiro')::timestamptz;
  v_confirma boolean := coalesce((p -> 'header' ->> 'confirma_ingreso')::boolean, false);
  v_medio text := coalesce(p -> 'header' ->> 'medio', 'camion');
  v_item jsonb;
  v_num text;
  v_reforzado boolean;
  v_cont_id uuid;
  v_op_id uuid;
  v_creadas int := 0;
  v_abiertos text[] := '{}';
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo' then
    raise exception 'cuenta no activa';
  end if;
  if v_naviera is null or v_tipo is null or v_retiro_de is null
     or v_planta is null or v_fecha is null then
    raise exception 'encabezado incompleto (naviera, tipo, retiro_de, planta_destino, fecha_retiro)';
  end if;
  if p -> 'contenedores' is null or jsonb_array_length(p -> 'contenedores') = 0 then
    raise exception 'la tanda no tiene contenedores';
  end if;

  -- guard previo con mensaje claro (solo ve lo que la RLS deja ver;
  -- el backstop es ux_operacion_abierta más abajo)
  select coalesce(array_agg(distinct c.numero_contenedor), '{}') into v_abiertos
    from jsonb_array_elements(p -> 'contenedores') it
    join crm.contenedores c on c.numero_contenedor = upper(it ->> 'numero')
    join crm.operaciones o on o.contenedor_id = c.id
                          and o.estado not in ('cerrado', 'anulada');
  if array_length(v_abiertos, 1) > 0 then
    raise exception 'Contenedores con ciclo abierto: %', array_to_string(v_abiertos, ', ');
  end if;

  for v_item in select * from jsonb_array_elements(p -> 'contenedores') loop
    v_num := upper(v_item ->> 'numero');
    v_reforzado := coalesce((v_item ->> 'reforzado')::boolean, true);

    select id into v_cont_id from crm.contenedores where numero_contenedor = v_num;
    if v_cont_id is null then
      v_cont_id := gen_random_uuid();
      insert into crm.contenedores (id, numero_contenedor, naviera_id, tipo, reforzado_estado)
      values (v_cont_id, v_num, v_naviera, v_tipo,
              case when v_reforzado then 'confirmado_reforzado'
                   else 'confirmado_no_reforzado' end);
    end if;
    -- si ya existía, naviera/tipo quedan los del maestro (registro único §6.3.1)

    v_op_id := gen_random_uuid();
    begin
      insert into crm.operaciones (id, contenedor_id, retiro_de, booking_retiro, fecha_retiro, estado)
      values (v_op_id, v_cont_id, v_retiro_de, v_booking, v_fecha,
              case when v_confirma then 'en_planta' else 'en_transito_a_planta' end);
    exception when unique_violation then
      raise exception 'El contenedor % ya tiene un ciclo abierto', v_num;
    end;

    -- primer tramo depósito → planta; con toggle nace confirmado (§6.1) y el
    -- trigger DEFINER fija planta_actual + evento ingreso_planta
    insert into crm.movimientos_planta
      (operacion_id, planta_origen_id, planta_destino_id, medio,
       fecha_salida, fecha_llegada_confirmada, confirmado_por, estado)
    values
      (v_op_id, null, v_planta, v_medio, v_fecha,
       case when v_confirma then v_fecha end,
       case when v_confirma then v_perfil.usuario_id end,
       case when v_confirma then 'confirmado' else 'en_transito' end);

    v_creadas := v_creadas + 1;
  end loop;

  return jsonb_build_object('creadas', v_creadas);
end $$;

grant execute on function crm.crm_crear_tanda_retiro(jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- crm_confirmar_ingreso_planta — Ingreso F2 (§6.1)
-- ----------------------------------------------------------------------------
create or replace function crm.crm_confirmar_ingreso_planta(
  p_operacion_ids uuid[],
  p_fecha timestamptz,
  p_medio text default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_perfil record;
  v_n int := 0;
  v_op uuid;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo' then
    raise exception 'cuenta no activa';
  end if;
  if p_fecha is null then
    raise exception 'fecha de llegada obligatoria';
  end if;

  foreach v_op in array p_operacion_ids loop
    update crm.movimientos_planta
       set estado = 'confirmado',
           fecha_llegada_confirmada = p_fecha,
           medio = coalesce(p_medio, medio),
           confirmado_por = v_perfil.usuario_id
     where operacion_id = v_op
       and estado = 'en_transito';

    -- D-04 v1: solo evento+conteo si la operación transicionó (anti-carrera)
    update crm.operaciones
       set estado = 'en_planta'
     where id = v_op
       and estado = 'en_transito_a_planta';
    if found then
      v_n := v_n + 1;
    end if;
  end loop;

  return jsonb_build_object('confirmadas', v_n);
end $$;

grant execute on function crm.crm_confirmar_ingreso_planta(uuid[], timestamptz, text) to authenticated;

-- ----------------------------------------------------------------------------
-- crm_registrar_salida_planta — Egreso F1 (§6.2): salida + asignación por
-- lote si embarca. NO corta freetime.
-- ----------------------------------------------------------------------------
create or replace function crm.crm_registrar_salida_planta(
  p_operacion_ids uuid[],
  p_tipo_cierre text,
  p_fecha timestamptz,
  p_asignacion jsonb default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_perfil record;
  v_n int := 0;
  v_op uuid;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo' then
    raise exception 'cuenta no activa';
  end if;
  if p_tipo_cierre not in ('embarcado', 'devuelto_vacio') then
    raise exception 'tipo_cierre inválido: %', p_tipo_cierre;
  end if;
  if p_fecha is null then
    raise exception 'fecha de salida obligatoria';
  end if;

  foreach v_op in array p_operacion_ids loop
    update crm.operaciones
       set tipo_cierre = p_tipo_cierre,
           fecha_egreso_planta = p_fecha,
           estado = 'en_transito_a_terminal',
           booking_asignado = case when p_tipo_cierre = 'embarcado'
                                   then p_asignacion ->> 'booking_asignado'
                                   else booking_asignado end,
           buque   = case when p_tipo_cierre = 'embarcado'
                          then p_asignacion ->> 'buque' else buque end,
           destino = case when p_tipo_cierre = 'embarcado'
                          then p_asignacion ->> 'destino' else destino end,
           orden   = case when p_tipo_cierre = 'embarcado'
                          then p_asignacion ->> 'orden' else orden end,
           shp     = case when p_tipo_cierre = 'embarcado'
                          then p_asignacion ->> 'shp' else shp end
     where id = v_op
       and estado = 'en_planta';
    if found then
      v_n := v_n + 1;
    end if;
  end loop;

  return jsonb_build_object('salidas', v_n);
end $$;

grant execute on function crm.crm_registrar_salida_planta(uuid[], text, timestamptz, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- crm_confirmar_devolucion — Egreso F2 (§6.2): CORTA el freetime y cierra.
-- ----------------------------------------------------------------------------
create or replace function crm.crm_confirmar_devolucion(
  p_operacion_ids uuid[],
  p_fecha timestamptz)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_perfil record;
  v_n int := 0;
  v_op uuid;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo' then
    raise exception 'cuenta no activa';
  end if;
  if p_fecha is null then
    raise exception 'fecha de devolución obligatoria';
  end if;

  foreach v_op in array p_operacion_ids loop
    update crm.operaciones
       set fecha_devolucion = p_fecha,
           estado = 'cerrado'
     where id = v_op
       and estado = 'en_transito_a_terminal';
    if found then
      v_n := v_n + 1;
    end if;
  end loop;

  return jsonb_build_object('cerradas', v_n);
end $$;

grant execute on function crm.crm_confirmar_devolucion(uuid[], timestamptz) to authenticated;

-- ----------------------------------------------------------------------------
-- crm_mover_entre_plantas — acción en la ficha (§18.4)
-- ----------------------------------------------------------------------------
create or replace function crm.crm_mover_entre_plantas(
  p_operacion_id uuid,
  p_destino uuid,
  p_medio text,
  p_fecha_salida timestamptz,
  p_confirmar boolean default false,
  p_fecha_llegada timestamptz default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_perfil record;
  v_origen uuid;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo' then
    raise exception 'cuenta no activa';
  end if;

  select planta_actual_id into v_origen
    from crm.operaciones
   where id = p_operacion_id
     and estado = 'en_planta';
  if not found then
    raise exception 'La operación no está en planta';
  end if;
  if v_origen = p_destino then
    raise exception 'la planta destino es la misma que la actual';
  end if;

  insert into crm.movimientos_planta
    (operacion_id, planta_origen_id, planta_destino_id, medio,
     fecha_salida, fecha_llegada_confirmada, confirmado_por, estado)
  values
    (p_operacion_id, v_origen, p_destino, p_medio, p_fecha_salida,
     case when p_confirmar then coalesce(p_fecha_llegada, p_fecha_salida) end,
     case when p_confirmar then v_perfil.usuario_id end,
     case when p_confirmar then 'confirmado' else 'en_transito' end);
end $$;

grant execute on function crm.crm_mover_entre_plantas(uuid, uuid, text, timestamptz, boolean, timestamptz) to authenticated;

-- ----------------------------------------------------------------------------
-- crm_anular_operacion — soft delete (§11). Supervisor+ (lo impone la policy
-- operaciones_update: WITH CHECK del operador excluye estado 'anulada').
-- ----------------------------------------------------------------------------
create or replace function crm.crm_anular_operacion(
  p_operacion_id uuid,
  p_motivo text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_perfil record;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo' then
    raise exception 'cuenta no activa';
  end if;
  if v_perfil.rol not in ('supervisor', 'administrador') then
    raise exception 'anular requiere supervisor o administrador';
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'motivo obligatorio para anular';
  end if;

  update crm.operaciones
     set estado = 'anulada',
         anulada_motivo = p_motivo,
         anulada_por = v_perfil.usuario_id
   where id = p_operacion_id
     and estado not in ('cerrado', 'anulada');
  if not found then
    raise exception 'La operación no está abierta (no se puede anular)';
  end if;
end $$;

grant execute on function crm.crm_anular_operacion(uuid, text) to authenticated;
