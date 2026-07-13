-- ═══════════════════════════════════════════════════════════════════════════
-- 020 · M4 BLOQUE 2 — F-02: corrección auditada de operaciones CERRADAS
-- ═══════════════════════════════════════════════════════════════════════════
-- Contexto (GO de John, apertura B2): una cerrada con un dato mal cargado
-- (típico: fecha de devolución equivocada) no tenía camino de corrección por
-- UI ni por RPC — el costo quedaba mal para siempre, o se tentaba el UPDATE
-- crudo (prohibido, precedente del B1).
--
-- Decisión: crm_corregir_operacion_cerrada (NO reabrir) — corrige el dato sin
-- re-transitar la máquina de estados y sin chocar con ux_operacion_abierta
-- (si el contenedor ya arrancó un ciclo nuevo, reabrir el viejo es imposible).
--
-- Reglas: supervisor+ · motivo OBLIGATORIO · whitelist de campos · evento
-- 'correccion' con anterior/nuevo/quién/porqué (tan auditable como el waiver).
-- Los KPIs se recalculan solos: las views leen de la tabla.
-- ⚠️ NO APLICAR sin GO explícito de John (post-gate en harness local).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function crm.crm_corregir_operacion_cerrada(
  p_operacion uuid, p_campo text, p_valor text, p_motivo text
) returns void
language plpgsql
security definer                      -- la policy de UPDATE excluye cerradas: este
set search_path to ''                 -- es el ÚNICO camino sancionado para tocarlas
as $fn$
declare
  v_caller record;
  v_op crm.operaciones%rowtype;
  v_anterior text;
  v_fecha timestamptz;
begin
  select * into v_caller from crm.perfil();
  if v_caller.estado is distinct from 'activo'
     or v_caller.rol not in ('supervisor', 'administrador') then
    raise exception 'corregir una cerrada es plata: solo supervisor o administrador';
  end if;

  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'motivo obligatorio: la corrección es plata y queda auditada';
  end if;

  -- whitelist explícita — NUNCA estado, contenedor, waiver (RPC propia) ni sin_cargo
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

  -- valor anterior (para el evento) + validación de tipo con mensaje legible
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
    -- coherencia con mensaje claro ANTES de que el CHECK dispare uno críptico
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

  -- guard de no-op: para fechas se compara el INSTANTE (no el string — el mismo
  -- momento en otro formato/zona no es una corrección); para texto, el valor.
  if (p_campo in ('fecha_retiro', 'fecha_egreso_planta', 'fecha_devolucion')
      and v_fecha is not distinct from (case p_campo
            when 'fecha_retiro'        then v_op.fecha_retiro
            when 'fecha_egreso_planta' then v_op.fecha_egreso_planta
            else                            v_op.fecha_devolucion end))
     or (p_campo not in ('fecha_retiro', 'fecha_egreso_planta', 'fecha_devolucion')
         and v_anterior is not distinct from nullif(trim(p_valor), '')) then
    raise exception 'el valor nuevo es idéntico al actual — nada que corregir';
  end if;

  -- un solo UPDATE estático (sin SQL dinámico): cada columna se toca solo si
  -- es la corregida. Los CHECK de la tabla siguen siendo la red final.
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

  -- auditoría: la corrección es plata. El trigger evt_operacion_update no
  -- cubre cambios genéricos de campo (sus ramas son transiciones de estado),
  -- así que el evento lo inserta la RPC — mismo shape que el 'correccion'
  -- de sin_cargo que ya emite el trigger.
  insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
  values (p_operacion, 'correccion', now(), v_caller.usuario_id,
          jsonb_build_object('campo', p_campo,
                             'anterior', v_anterior,
                             'nuevo', p_valor,
                             'motivo', trim(p_motivo)));
end $fn$;

revoke execute on function crm.crm_corregir_operacion_cerrada(uuid, text, text, text) from public, anon;
grant  execute on function crm.crm_corregir_operacion_cerrada(uuid, text, text, text) to authenticated;

comment on function crm.crm_corregir_operacion_cerrada(uuid, text, text, text) is
  'F-02 (020): corrección auditada de operaciones cerradas. Supervisor+, motivo '
  'obligatorio, whitelist de campos, evento correccion con anterior/nuevo. Las '
  'views de costos recalculan solas al leer la tabla.';
