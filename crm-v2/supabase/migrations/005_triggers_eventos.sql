-- ============================================================================
-- 005_triggers_eventos — M1 rebuild v2 CRM Detention
-- Timeline por triggers (§4: la app NO escribe eventos) + sincronización de
-- planta_actual + guard de columnas de dinero.
--
-- Regla de privilegios del plan: las funciones de trigger corren con los
-- privilegios del rol que disparó la sentencia — por eso TODA función de
-- trigger que escribe en OTRA tabla es SECURITY DEFINER (owner postgres
-- bypasea la RLS de operacion_eventos/operaciones, que no tienen policies de
-- escritura). Lista cerrada del plan: evt_operacion_insert,
-- evt_operacion_update, evt_movimiento, sync_planta_actual, evt_incidencia.
-- guard_operaciones_campos NO escribe otra tabla ⇒ SECURITY INVOKER.
--
-- Guard v1 en movimientos (cubre el tránsito corto §6.1, donde el movimiento
-- NACE confirmado): estado='confirmado' AND (INSERT OR old.estado IS
-- DISTINCT FROM 'confirmado').
--
-- usuario_id de los eventos: vía perfil() (sesión real); NULL si sistema.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- retiro — AFTER INSERT ON operaciones
-- ----------------------------------------------------------------------------
create or replace function crm.evt_operacion_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
  values (
    new.id, 'retiro', new.fecha_retiro,
    (select p.usuario_id from crm.perfil() p),
    jsonb_build_object('retiro_de', new.retiro_de, 'booking_retiro', new.booking_retiro)
  );
  return new;
end $$;

create trigger trg_op_evt_insert
  after insert on crm.operaciones
  for each row execute function crm.evt_operacion_insert();

-- ----------------------------------------------------------------------------
-- carga + egreso / devolucion / anulacion / cambio de sin_cargo —
-- AFTER UPDATE ON operaciones
-- ----------------------------------------------------------------------------
create or replace function crm.evt_operacion_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select p.usuario_id from crm.perfil() p);
begin
  -- salida de planta: carga (solo embarcado) + egreso
  if old.fecha_egreso_planta is null and new.fecha_egreso_planta is not null then
    if new.tipo_cierre = 'embarcado' then
      insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
      values (new.id, 'carga', new.fecha_egreso_planta, v_usuario,
              jsonb_build_object(
                'booking_asignado', new.booking_asignado, 'buque', new.buque,
                'destino', new.destino, 'orden', new.orden, 'shp', new.shp));
    end if;
    insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
    values (new.id, 'egreso', new.fecha_egreso_planta, v_usuario,
            jsonb_build_object('tipo_cierre', new.tipo_cierre));
  end if;

  -- devolución / ingreso a terminal (corta freetime)
  if old.fecha_devolucion is null and new.fecha_devolucion is not null then
    insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
    values (new.id, 'devolucion', new.fecha_devolucion, v_usuario,
            jsonb_build_object('corta_freetime', true));
  end if;

  -- anulación (soft delete §4)
  if new.estado = 'anulada' and old.estado is distinct from 'anulada' then
    insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
    values (new.id, 'anulacion', now(), v_usuario,
            jsonb_build_object('motivo', new.anulada_motivo));
  end if;

  -- sin_cargo es plata: nunca una mutación invisible (Decisión 4)
  if new.sin_cargo is distinct from old.sin_cargo then
    insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
    values (new.id, 'correccion', now(), v_usuario,
            jsonb_build_object('campo', 'sin_cargo',
                               'anterior', old.sin_cargo, 'nuevo', new.sin_cargo));
  end if;

  return new;
end $$;

create trigger trg_op_evt_update
  after update on crm.operaciones
  for each row execute function crm.evt_operacion_update();

-- ----------------------------------------------------------------------------
-- guard de columnas de dinero — BEFORE UPDATE ON operaciones (INVOKER:
-- no escribe otra tabla). Rechaza cambios de sin_cargo/producto/gmid si el
-- caller es operador (Decisión 4; supervisor/admin sí pueden).
-- ----------------------------------------------------------------------------
create or replace function crm.guard_operaciones_campos()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select p.rol from crm.perfil() p) = 'operador'
     and (new.sin_cargo is distinct from old.sin_cargo
       or new.producto is distinct from old.producto
       or new.gmid is distinct from old.gmid) then
    raise exception 'sin_cargo/producto/gmid solo los edita supervisor o administrador';
  end if;
  return new;
end $$;

create trigger trg_op_guard_campos
  before update on crm.operaciones
  for each row execute function crm.guard_operaciones_campos();

-- ----------------------------------------------------------------------------
-- movimiento / ingreso_planta — AFTER INSERT OR UPDATE ON movimientos_planta
--   'movimiento'      → INSERT de tramo con origen NOT NULL (registra la
--                        SALIDA con su fecha, como v1)
--   'ingreso_planta'  → movimiento con origen NULL que queda confirmado
--                        (guard v1: cubre el tránsito corto que nace
--                        confirmado y la confirmación posterior)
-- ----------------------------------------------------------------------------
create or replace function crm.evt_movimiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select p.usuario_id from crm.perfil() p);
begin
  if tg_op = 'INSERT' and new.planta_origen_id is not null then
    insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
    values (new.operacion_id, 'movimiento', new.fecha_salida, v_usuario,
            jsonb_build_object('origen_id', new.planta_origen_id,
                               'destino_id', new.planta_destino_id,
                               'medio', new.medio,
                               'confirmado', new.estado = 'confirmado'));
  end if;

  if new.estado = 'confirmado'
     and (tg_op = 'INSERT' or old.estado is distinct from 'confirmado')
     and new.planta_origen_id is null then
    insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
    values (new.operacion_id, 'ingreso_planta',
            coalesce(new.fecha_llegada_confirmada, now()), v_usuario,
            jsonb_build_object('medio', new.medio));
  end if;

  return new;
end $$;

create trigger trg_mov_eventos
  after insert or update on crm.movimientos_planta
  for each row execute function crm.evt_movimiento();

-- ----------------------------------------------------------------------------
-- planta_actual — AFTER INSERT OR UPDATE ON movimientos_planta (guard v1).
-- ÚNICA vía que fija operaciones.planta_actual_id (§4).
-- ----------------------------------------------------------------------------
create or replace function crm.sync_planta_actual()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = 'confirmado'
     and (tg_op = 'INSERT' or old.estado is distinct from 'confirmado') then
    update crm.operaciones
       set planta_actual_id = new.planta_destino_id,
           updated_at = now()
     where id = new.operacion_id;
  end if;
  return new;
end $$;

create trigger trg_mov_planta_actual
  after insert or update on crm.movimientos_planta
  for each row execute function crm.sync_planta_actual();

-- ----------------------------------------------------------------------------
-- incidencia — AFTER INSERT ON incidencias
-- ----------------------------------------------------------------------------
create or replace function crm.evt_incidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
  values (new.operacion_id, 'incidencia', new.fecha,
          coalesce(new.usuario_id, (select p.usuario_id from crm.perfil() p)),
          jsonb_build_object('tipo', new.tipo, 'descripcion', new.descripcion));
  return new;
end $$;

create trigger trg_incidencia_evt
  after insert on crm.incidencias
  for each row execute function crm.evt_incidencia();
