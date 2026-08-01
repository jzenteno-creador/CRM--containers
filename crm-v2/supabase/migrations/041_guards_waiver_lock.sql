-- 041: candado anti-carrera en waiver expo + guards de rol null-safe
-- (auditoría 2026-07-31, P3s de plata aprobados por John; GO 2026-08-01)
--
-- (1) crm_registrar_waiver (expo): dos supervisores simultáneos podían leer el mismo
--     total vigente y ambos insertar → total auditado > exceso real (el costo_neto
--     quedaba protegido por el clamp de la view, pero el historial mentía). Mismo
--     advisory lock que el waiver de impo (039) trae de fábrica.
-- (2) Guards "rol not in (...)" sin chequeo de NULL: con rol NULL el NOT IN evalúa
--     NULL y el IF no dispara → el guard NO rechaza. Hoy inexplotable (los flujos
--     sancionados nunca dejan rol NULL con cuenta activa), pero es la clase de bug
--     que el propio equipo ya cazó en la 023 — se cierra parejo en las 4 RPCs viejas
--     que lo tenían: crm_registrar_waiver, crm_anular_waiver,
--     crm_corregir_operacion_cerrada, crm_anular_operacion.
-- (3) crm_confirmar_retiro_terminal y crm_confirmar_devolucion_impo (032): solo
--     chequeaban estado de cuenta — se les agrega el guard de rol null-safe, espejo
--     de lo que la 038 hizo con sus dos hermanas (ingreso/salida).
--
-- CREATE OR REPLACE preserva owner y grants: waiver/corrección/anular expo quedan
-- owner=postgres (patrón auditado en AUDIT-4-DEFINER-RPCS); las impo quedan
-- owner=crm_rpc_executor. Los cuerpos son los vigentes con SOLO estos cambios.

-- ═══ (1)+(2a) crm_registrar_waiver — lock + guard null-safe ═══
create or replace function crm.crm_registrar_waiver(
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

  -- FIX 041: serializa registros concurrentes sobre la misma operación (TOCTOU
  -- anotado en la auditoría; mismo patrón que crm_registrar_waiver_impo de la 039).
  perform pg_advisory_xact_lock(hashtext('waiver:' || p_operacion::text));

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

-- ═══ (2b) crm_anular_waiver — guard null-safe (único cambio) ═══
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
     or v_caller.rol is null
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

-- ═══ (2c) crm_anular_operacion — guard null-safe (único cambio; sigue INVOKER) ═══
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
  if v_perfil.rol is null or v_perfil.rol not in ('supervisor', 'administrador') then
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

-- ═══ (2d) crm_corregir_operacion_cerrada — guard null-safe (único cambio) ═══
-- El cuerpo completo es el de la 020 tal cual; solo cambia la primera condición.
-- (Se replica entero porque CREATE OR REPLACE no permite parches parciales.)
create or replace function crm.crm_corregir_operacion_cerrada(
  p_operacion uuid, p_campo text, p_valor text, p_motivo text
) returns void
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_caller record;
  v_op crm.operaciones%rowtype;
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

  if p_campo not in ('fecha_retiro', 'fecha_egreso_planta', 'fecha_devolucion',
                     'booking_retiro', 'booking_asignado', 'buque', 'destino',
                     'orden', 'shp') then
    raise exception 'campo no corregible por esta vía: %', p_campo;
  end if;

  select * into v_op from crm.operaciones where id = p_operacion;
  if v_op.id is null then
    raise exception 'operación inexistente';
  end if;
  if v_op.estado <> 'cerrado' then
    raise exception 'esta RPC corrige solo operaciones CERRADAS (estado actual: %)', v_op.estado;
  end if;

  if p_campo in ('fecha_retiro', 'fecha_egreso_planta', 'fecha_devolucion') then
    begin
      v_fecha := p_valor::timestamptz;
    exception when others then
      raise exception 'fecha inválida para %: % (formato esperado: ISO, ej. 2026-07-10T12:00:00-03:00)', p_campo, p_valor;
    end;
    if v_fecha is null then
      raise exception 'una cerrada no puede quedar sin %', p_campo;
    end if;
    v_anterior := (case p_campo
                     when 'fecha_retiro'        then v_op.fecha_retiro
                     when 'fecha_egreso_planta' then v_op.fecha_egreso_planta
                     else                            v_op.fecha_devolucion
                   end)::text;
    if p_campo = 'fecha_devolucion' and v_fecha < v_op.fecha_retiro then
      raise exception 'la devolución (%) no puede ser anterior al retiro (%)', v_fecha, v_op.fecha_retiro;
    end if;
    if p_campo = 'fecha_retiro'
       and (v_op.fecha_devolucion < v_fecha
            or (v_op.fecha_egreso_planta is not null and v_op.fecha_egreso_planta < v_fecha)) then
      raise exception 'el retiro corregido (%) dejaría egreso/devolución antes del retiro', v_fecha;
    end if;
    if p_campo = 'fecha_egreso_planta' and v_fecha < v_op.fecha_retiro then
      raise exception 'el egreso (%) no puede ser anterior al retiro (%)', v_fecha, v_op.fecha_retiro;
    end if;
  else
    v_anterior := case p_campo
                    when 'booking_retiro'   then v_op.booking_retiro
                    when 'booking_asignado' then v_op.booking_asignado
                    when 'buque'            then v_op.buque
                    when 'destino'          then v_op.destino
                    when 'orden'            then v_op.orden
                    else                         v_op.shp
                  end;
  end if;

  if (p_campo in ('fecha_retiro', 'fecha_egreso_planta', 'fecha_devolucion')
      and v_fecha is not distinct from (case p_campo
            when 'fecha_retiro'        then v_op.fecha_retiro
            when 'fecha_egreso_planta' then v_op.fecha_egreso_planta
            else                            v_op.fecha_devolucion end))
     or (p_campo not in ('fecha_retiro', 'fecha_egreso_planta', 'fecha_devolucion')
         and v_anterior is not distinct from nullif(trim(p_valor), '')) then
    raise exception 'el valor nuevo es idéntico al actual — nada que corregir';
  end if;

  update crm.operaciones set
    fecha_retiro        = case when p_campo = 'fecha_retiro'        then v_fecha else fecha_retiro        end,
    fecha_egreso_planta = case when p_campo = 'fecha_egreso_planta' then v_fecha else fecha_egreso_planta end,
    fecha_devolucion    = case when p_campo = 'fecha_devolucion'    then v_fecha else fecha_devolucion    end,
    booking_retiro      = case when p_campo = 'booking_retiro'      then nullif(trim(p_valor), '') else booking_retiro   end,
    booking_asignado    = case when p_campo = 'booking_asignado'    then nullif(trim(p_valor), '') else booking_asignado end,
    buque               = case when p_campo = 'buque'               then nullif(trim(p_valor), '') else buque            end,
    destino             = case when p_campo = 'destino'             then nullif(trim(p_valor), '') else destino          end,
    orden               = case when p_campo = 'orden'               then nullif(trim(p_valor), '') else orden            end,
    shp                 = case when p_campo = 'shp'                 then nullif(trim(p_valor), '') else shp              end
  where id = p_operacion;

  insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
  values (p_operacion, 'correccion', now(), v_caller.usuario_id,
          jsonb_build_object('campo', p_campo,
                             'anterior', v_anterior,
                             'nuevo', p_valor,
                             'motivo', trim(p_motivo)));
end $fn$;

-- ═══ (3a) crm_confirmar_retiro_terminal — guard de rol null-safe (único cambio) ═══
create or replace function crm.crm_confirmar_retiro_terminal(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_perfil record;
  v_item jsonb;
  v_op_id uuid;
  v_fecha timestamptz;
  v_check record;
  v_n int := 0;
  v_rechazadas int := 0;
  v_resultados jsonb := '[]'::jsonb;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo'
     or v_perfil.rol is null
     or v_perfil.rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'confirmar retiro de terminal requiere operador, supervisor o administrador';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'no se indicaron operaciones a confirmar';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_op_id := nullif(v_item ->> 'operacion_impo_id', '')::uuid;
    v_fecha := nullif(v_item ->> 'fecha', '')::timestamptz;

    if v_op_id is null or v_fecha is null then
      v_rechazadas := v_rechazadas + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op_id, 'estado', 'rechazado', 'motivo', 'item_invalido');
      continue;
    end if;

    select oi.id as op_id, ord.fecha_arribo_terminal as fecha_arribo
      into v_check
      from crm.operaciones_impo oi
      join crm.ordenes_impo ord on ord.id = oi.orden_id
     where oi.id = v_op_id;

    if v_check.op_id is null then
      v_rechazadas := v_rechazadas + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op_id, 'estado', 'rechazado', 'motivo', 'fuera_de_alcance');
      continue;
    end if;

    if v_fecha < v_check.fecha_arribo then
      v_rechazadas := v_rechazadas + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op_id, 'estado', 'rechazado', 'motivo', 'fecha_anterior_a_arribo');
      continue;
    end if;

    update crm.operaciones_impo
       set estado = 'en_transito_a_planta',
           fecha_retiro_terminal = v_fecha
     where id = v_op_id
       and estado = 'en_terminal';

    if found then
      v_n := v_n + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op_id, 'estado', 'confirmado', 'motivo', null);
    else
      v_rechazadas := v_rechazadas + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op_id, 'estado', 'rechazado', 'motivo', 'estado_no_valido');
    end if;
  end loop;

  return jsonb_build_object('confirmadas', v_n, 'rechazadas', v_rechazadas, 'resultados', v_resultados);
end $fn$;

-- ═══ (3b) crm_confirmar_devolucion_impo — guard de rol null-safe (único cambio) ═══
create or replace function crm.crm_confirmar_devolucion_impo(
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
  if v_perfil.estado is distinct from 'activo'
     or v_perfil.rol is null
     or v_perfil.rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'confirmar devolución requiere operador, supervisor o administrador';
  end if;
  if p_fecha is null then
    raise exception 'fecha de devolución obligatoria';
  end if;
  if p_operacion_impo_ids is null or array_length(p_operacion_impo_ids, 1) is null then
    raise exception 'no se indicaron operaciones';
  end if;

  foreach v_op in array p_operacion_impo_ids loop
    select oi.id as op_id, oi.fecha_retiro_terminal, ord.fecha_arribo_terminal
      into v_row
      from crm.operaciones_impo oi
      join crm.ordenes_impo ord on ord.id = oi.orden_id
     where oi.id = v_op and oi.estado = 'en_transito_devolucion';

    if v_row.op_id is null then
      v_rechazadas := v_rechazadas + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op, 'estado', 'rechazado', 'motivo', 'estado_no_valido');
      continue;
    end if;

    if p_fecha < coalesce(v_row.fecha_retiro_terminal, v_row.fecha_arribo_terminal) then
      v_rechazadas := v_rechazadas + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op, 'estado', 'rechazado', 'motivo', 'fecha_anterior_a_retiro');
      continue;
    end if;

    update crm.operaciones_impo
       set estado = 'cerrado',
           fecha_devolucion = p_fecha
     where id = v_op
       and estado = 'en_transito_devolucion';

    if found then
      v_n := v_n + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'operacion_impo_id', v_op, 'estado', 'cerrado', 'motivo', null);
    end if;
  end loop;

  return jsonb_build_object('cerradas', v_n, 'rechazadas', v_rechazadas, 'resultados', v_resultados);
end $fn$;
