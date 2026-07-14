-- ═══════════════════════════════════════════════════════════════════════════
-- 028 · M5 B3 — BOOKINGS EXPO: entidad, RPCs de roleo/reasignación, saldo
-- ═══════════════════════════════════════════════════════════════════════════
-- Contexto (Omar, reunión 2026-07-13): los retiros se hacen con bookings
-- ficticios de la naviera que ocupan lugar en un buque con ETD. Cuando se
-- acerca la salida y quedan contenedores en planta, se pide "roleo" (mismo
-- booking, nuevo ETD/buque) o se reasignan contenedores a otro booking. Hoy
-- Omar lo controla a mano cada viernes; acá el sistema lo reemplaza con
-- saldo + semáforo + auditoría en el timeline.
--
-- Decisión D4 (John): bookings es RPC-only. El roleo/reasignación son actos
-- de auditoría (motivo obligatorio + evento), no ediciones libres — por eso
-- `crm.bookings` nace SIN policies de escritura para `authenticated` (ni
-- siquiera el GRANT). El único camino de escritura es el mismo patrón que
-- cerró el P1 de CP3 (migración 025): RPCs SECURITY DEFINER con
-- owner = crm_rpc_executor (rol sin BYPASSRLS) + policies/grants scopeados a
-- ese rol interno, nunca a `authenticated`. Esto es una AMPLIACIÓN del
-- patrón 025 (que solo cubría operaciones/movimientos_planta/contenedores),
-- no una excepción a él.
--
-- booking_retiro/booking_asignado (text) en operaciones quedan CONGELADOS
-- como snapshot (mismo patrón retiro_de/retiro_de_id de la 023): la verdad
-- pasa a booking_retiro_id/booking_asignado_id. Sin backfill (datos de test,
-- texto libre que no matchea ningún booking real — quedan con FK null,
-- documentado, igual que 023).
-- ═══════════════════════════════════════════════════════════════════════════

-- Re-asegurar membresía (idempotente, mismo comentario que 025: futuras
-- migraciones que alteren owner de RPCs del executor la necesitan).
grant crm_rpc_executor to current_user;

-- ═══ A · crm.bookings ══════════════════════════════════════════════════════
create table crm.bookings (
  id          uuid primary key default gen_random_uuid(),
  numero      text not null check (length(trim(numero)) > 0),
  naviera_id  uuid not null references crm.navieras(id),
  etd         date not null,
  fecha_corte date,
  buque       text,
  tipo        text not null default 'retiro' check (tipo in ('retiro', 'embarque')),
  estado      text not null default 'activo' check (estado in ('activo', 'cancelado', 'cumplido')),
  notas       text,
  creado_por  uuid references crm.usuarios(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (naviera_id, numero)
);

create trigger trg_bookings_updated
  before update on crm.bookings
  for each row execute function crm.set_updated_at();

alter table crm.bookings enable row level security;

-- Lectura: cualquier activo (maestro-like, §14.4).
create policy bookings_select on crm.bookings
  for select to authenticated
  using ((select p.estado = 'activo' from crm.perfil() p));

-- Escritura: CERO policies para `authenticated` (D4) — ni siquiera se le
-- concede el GRANT de INSERT/UPDATE más abajo. Las únicas policies de
-- escritura matchean al rol interno `crm_rpc_executor`: solo aplican cuando
-- el current_user real es ese rol, es decir, DENTRO de una función
-- SECURITY DEFINER que lo tiene por owner. Ninguna sesión de usuario normal
-- (autenticada con la publishable key) puede alcanzar este camino ni por
-- policy ni por grant.
create policy bookings_insert_executor on crm.bookings
  for insert to crm_rpc_executor
  with check (true);

create policy bookings_update_executor on crm.bookings
  for update to crm_rpc_executor
  using (true)
  with check (true);

grant select on crm.bookings to authenticated;
grant select, insert, update on crm.bookings to crm_rpc_executor;

comment on table crm.bookings is
  'Bookings ficticios/reales de retiro y embarque (M5 B3). RPC-only: sin policies de escritura para authenticated (decisión D4).';

-- ═══ B · FKs en operaciones (snapshot congelado, patrón 023) ══════════════
alter table crm.operaciones
  add column booking_retiro_id   uuid references crm.bookings(id),
  add column booking_asignado_id uuid references crm.bookings(id);

create index ix_operaciones_booking_retiro   on crm.operaciones (booking_retiro_id);
create index ix_operaciones_booking_asignado on crm.operaciones (booking_asignado_id);

comment on column crm.operaciones.booking_retiro is
  'CONGELADO (028): snapshot texto. La verdad vive en booking_retiro_id → crm.bookings.';
comment on column crm.operaciones.booking_asignado is
  'CONGELADO (028): snapshot texto. La verdad vive en booking_asignado_id → crm.bookings.';

-- ═══ C · tipo_evento: + roleo, reasignacion_booking ═══════════════════════
alter table crm.operacion_eventos drop constraint operacion_eventos_tipo_evento_check;
alter table crm.operacion_eventos add constraint operacion_eventos_tipo_evento_check
  check (tipo_evento in (
    'retiro', 'ingreso_planta', 'movimiento', 'carga', 'egreso', 'devolucion',
    'anulacion', 'incidencia', 'reapertura', 'correccion', 'waiver',
    'roleo', 'reasignacion_booking'
  ));

-- ═══ D · operacion_eventos: habilitar INSERT solo para crm_rpc_executor ══
-- Necesario porque crm_rolear_booking / crm_reasignar_contenedores_booking
-- escriben eventos DIRECTO (no vía trigger: el roleo cambia la fila del
-- booking, no una fila de operaciones, así que no hay UPDATE que dispare un
-- trigger existente; y la reasignación necesita el motivo/detalle del
-- parámetro de la RPC, no reconstruible desde OLD/NEW). Hasta ahora
-- operacion_eventos solo se escribía desde triggers owner=postgres
-- (bypassa RLS). Mismo criterio que bookings: policy scopeada al rol
-- interno, `authenticated` sigue sin poder insertar eventos a mano (RLS
-- default-deny: no hay policy de INSERT para authenticated).
create policy eventos_insert_executor on crm.operacion_eventos
  for insert to crm_rpc_executor
  with check (true);

grant insert on crm.operacion_eventos to crm_rpc_executor;

-- ═══ E · RPCs nuevas (SECURITY DEFINER owner crm_rpc_executor) ═══════════

-- E.1 crm_crear_booking — alta, rol operador+.
create or replace function crm.crm_crear_booking(
  p_numero      text,
  p_naviera_id  uuid,
  p_etd         date,
  p_tipo        text default 'retiro',
  p_fecha_corte date default null,
  p_buque       text default null,
  p_notas       text default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_perfil    record;
  v_numero    text := upper(trim(p_numero));
  v_id        uuid;
  v_existente record;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo'
     or v_perfil.rol is null
     or v_perfil.rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'crear booking requiere operador, supervisor o administrador';
  end if;

  if v_numero is null or length(v_numero) = 0 then
    raise exception 'el número de booking es obligatorio';
  end if;
  if p_naviera_id is null or not exists (select 1 from crm.navieras where id = p_naviera_id) then
    raise exception 'naviera inexistente';
  end if;
  if p_etd is null then
    raise exception 'el ETD es obligatorio';
  end if;
  if p_tipo not in ('retiro', 'embarque') then
    raise exception 'tipo de booking inválido: %', p_tipo;
  end if;

  insert into crm.bookings (numero, naviera_id, etd, fecha_corte, buque, tipo, notas, creado_por)
  values (v_numero, p_naviera_id, p_etd, p_fecha_corte, nullif(trim(p_buque), ''), p_tipo,
          nullif(trim(p_notas), ''), v_perfil.usuario_id)
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    select id, etd, buque, estado into v_existente
      from crm.bookings where naviera_id = p_naviera_id and numero = v_numero;
    raise exception 'booking_duplicado'
      using hint = format('Ya existe el booking %s para esta naviera (id=%s, etd=%s, buque=%s, estado=%s)',
                           v_numero, v_existente.id, v_existente.etd,
                           coalesce(v_existente.buque, '-'), v_existente.estado);
end $fn$;

revoke all on function crm.crm_crear_booking(text, uuid, date, text, date, text, text) from public, anon;
grant execute on function crm.crm_crear_booking(text, uuid, date, text, date, text, text) to authenticated;

-- E.2 crm_rolear_booking — mismo booking, nuevo ETD/buque + evento 'roleo'
-- en cada operación abierta colgada de él. Rol operador+.
create or replace function crm.crm_rolear_booking(
  p_booking_id  uuid,
  p_nuevo_etd   date,
  p_nuevo_buque text default null,
  p_motivo      text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_perfil        record;
  v_booking       record;
  v_etd_anterior  date;
  v_buque_anterior text;
  v_buque_nuevo   text;
  v_op            record;
  v_n             int := 0;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo'
     or v_perfil.rol is null
     or v_perfil.rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'rolear booking requiere operador, supervisor o administrador';
  end if;
  if p_nuevo_etd is null then
    raise exception 'el nuevo ETD es obligatorio';
  end if;

  select * into v_booking from crm.bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'booking inexistente';
  end if;
  if v_booking.estado <> 'activo' then
    raise exception 'el booking no está activo (estado=%)', v_booking.estado;
  end if;
  if v_booking.tipo <> 'retiro' then
    raise exception 'solo se rolean bookings de tipo retiro';
  end if;

  v_etd_anterior   := v_booking.etd;
  v_buque_anterior := v_booking.buque;
  v_buque_nuevo    := coalesce(nullif(trim(p_nuevo_buque), ''), v_buque_anterior);

  update crm.bookings
     set etd = p_nuevo_etd,
         buque = v_buque_nuevo
   where id = p_booking_id;

  for v_op in
    select o.id from crm.operaciones o
     where o.booking_retiro_id = p_booking_id
       and o.estado not in ('cerrado', 'anulada')
  loop
    insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
    values (v_op.id, 'roleo', now(), v_perfil.usuario_id,
            jsonb_build_object(
              'booking', v_booking.numero,
              'etd_anterior', v_etd_anterior, 'etd_nuevo', p_nuevo_etd,
              'buque_anterior', v_buque_anterior, 'buque_nuevo', v_buque_nuevo,
              'motivo', p_motivo));
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('operaciones_anotadas', v_n);
end $fn$;

revoke all on function crm.crm_rolear_booking(uuid, date, text, text) from public, anon;
grant execute on function crm.crm_rolear_booking(uuid, date, text, text) to authenticated;

-- E.3 crm_reasignar_contenedores_booking — mueve operaciones a otro booking
-- de retiro + evento 'reasignacion_booking' por operación. Rol operador+,
-- motivo categórico obligatorio + detalle libre opcional.
create or replace function crm.crm_reasignar_contenedores_booking(
  p_operacion_ids       uuid[],
  p_booking_destino_id  uuid,
  p_motivo              text,
  p_detalle             text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_perfil      record;
  v_destino     record;
  v_op_id       uuid;
  v_op          record;
  v_reasignadas int := 0;
  v_rechazadas  jsonb := '[]'::jsonb;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo'
     or v_perfil.rol is null
     or v_perfil.rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'reasignar contenedores requiere operador, supervisor o administrador';
  end if;
  if p_motivo is null or p_motivo not in ('roleo_naviera', 'correccion', 'otro') then
    raise exception 'motivo inválido (roleo_naviera|correccion|otro)';
  end if;
  if p_operacion_ids is null or array_length(p_operacion_ids, 1) is null then
    raise exception 'no se indicaron operaciones a reasignar';
  end if;

  select * into v_destino from crm.bookings where id = p_booking_destino_id;
  if v_destino.id is null then
    raise exception 'booking destino inexistente';
  end if;
  if v_destino.estado <> 'activo' then
    raise exception 'el booking destino no está activo (estado=%)', v_destino.estado;
  end if;
  if v_destino.tipo <> 'retiro' then
    raise exception 'el booking destino debe ser de tipo retiro';
  end if;

  foreach v_op_id in array p_operacion_ids loop
    select o.id, o.estado, o.booking_retiro_id, o.booking_retiro
      into v_op
      from crm.operaciones o where o.id = v_op_id;

    if v_op.id is null then
      v_rechazadas := v_rechazadas || jsonb_build_object('id', v_op_id, 'motivo', 'operacion_inexistente');
      continue;
    end if;
    if v_op.estado in ('cerrado', 'anulada') then
      v_rechazadas := v_rechazadas || jsonb_build_object('id', v_op_id, 'motivo', 'operacion_cerrada');
      continue;
    end if;
    if v_op.booking_retiro_id = p_booking_destino_id then
      v_rechazadas := v_rechazadas || jsonb_build_object('id', v_op_id, 'motivo', 'ya_asignado_al_destino');
      continue;
    end if;

    update crm.operaciones
       set booking_retiro_id = p_booking_destino_id,
           booking_retiro    = v_destino.numero
     where id = v_op_id
       and estado not in ('cerrado', 'anulada');

    if found then
      insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
      values (v_op_id, 'reasignacion_booking', now(), v_perfil.usuario_id,
              jsonb_build_object(
                'booking_anterior', coalesce(
                  (select numero from crm.bookings where id = v_op.booking_retiro_id),
                  v_op.booking_retiro),
                'booking_nuevo', v_destino.numero,
                'motivo', p_motivo, 'detalle', p_detalle));
      v_reasignadas := v_reasignadas + 1;
    else
      -- anti-carrera: cambió de estado entre el SELECT y el UPDATE, o quedó
      -- fuera del scope de planta de la RLS (operador de otra planta).
      v_rechazadas := v_rechazadas || jsonb_build_object('id', v_op_id, 'motivo', 'no_disponible');
    end if;
  end loop;

  return jsonb_build_object('reasignadas', v_reasignadas, 'rechazadas', v_rechazadas);
end $fn$;

revoke all on function crm.crm_reasignar_contenedores_booking(uuid[], uuid, text, text) from public, anon;
grant execute on function crm.crm_reasignar_contenedores_booking(uuid[], uuid, text, text) to authenticated;

-- Owner → crm_rpc_executor para las 3 RPCs nuevas (mismo procedimiento que
-- 025: el nuevo owner necesita CREATE en el schema para el alter owner en
-- Supabase; se concede temporal y se revoca después).
grant create on schema crm to crm_rpc_executor;
do $$
declare
  fn text;
  sigs text[] := array[
    'crm.crm_crear_booking(text, uuid, date, text, date, text, text)',
    'crm.crm_rolear_booking(uuid, date, text, text)',
    'crm.crm_reasignar_contenedores_booking(uuid[], uuid, text, text)'
  ];
begin
  foreach fn in array sigs loop
    execute format('alter function %s owner to crm_rpc_executor', fn);
  end loop;
end $$;
revoke create on schema crm from crm_rpc_executor;

-- ═══ F · Extender RPCs existentes (owner crm_rpc_executor — se preserva al
-- hacer CREATE OR REPLACE; verificado post-apply) ═════════════════════════

-- F.1 crm_crear_tanda_retiro: header.booking_id (uuid) — fuente de verdad si
-- viene. Compat: si NO viene pero sí booking_retiro texto (front viejo), se
-- acepta como snapshot puro (FK null); la obligatoriedad la impone el front
-- nuevo mandando header.require_booking=true.
create or replace function crm.crm_crear_tanda_retiro(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_perfil record;
  v_naviera uuid := (p -> 'header' ->> 'naviera_id')::uuid;
  v_tipo text := p -> 'header' ->> 'tipo';
  v_retiro_de_id uuid := nullif(p -> 'header' ->> 'retiro_de_id', '')::uuid;
  v_retiro_de text := p -> 'header' ->> 'retiro_de';
  v_planta uuid := (p -> 'header' ->> 'planta_destino_id')::uuid;
  v_booking_id uuid := nullif(p -> 'header' ->> 'booking_id', '')::uuid;
  v_require_booking boolean := coalesce((p -> 'header' ->> 'require_booking')::boolean, false);
  v_booking_texto text := p -> 'header' ->> 'booking_retiro';
  v_booking_row record;
  v_fecha timestamptz := (p -> 'header' ->> 'fecha_retiro')::timestamptz;
  v_confirma boolean := coalesce((p -> 'header' ->> 'confirma_ingreso')::boolean, false);
  v_medio text := coalesce(p -> 'header' ->> 'medio', 'camion');
  v_item jsonb;
  v_num text;
  v_reforzado boolean;
  v_cont_id uuid;
  v_op_id uuid;
  v_creadas int := 0;
  v_rechazadas int := 0;
  v_resultados jsonb := '[]'::jsonb;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo' then
    raise exception 'cuenta no activa';
  end if;

  -- resolver depósito (023): si viene el id, es la fuente de verdad.
  if v_retiro_de_id is not null then
    select nombre into v_retiro_de from crm.depositos where id = v_retiro_de_id and activo;
    if v_retiro_de is null then
      raise exception 'depósito inexistente o inactivo';
    end if;
  end if;

  if v_naviera is null or v_tipo is null or v_retiro_de is null
     or v_planta is null or v_fecha is null then
    raise exception 'encabezado incompleto (naviera, tipo, retiro_de, planta_destino, fecha_retiro)';
  end if;
  if p -> 'contenedores' is null or jsonb_array_length(p -> 'contenedores') = 0 then
    raise exception 'la tanda no tiene contenedores';
  end if;
  if v_tipo not in ('20DC', '40DC', '40HC') then
    raise exception 'tipo de contenedor inválido: %', v_tipo;
  end if;
  if v_medio not in ('camion', 'tren') then
    raise exception 'medio inválido: %', v_medio;
  end if;

  -- resolver booking (028): booking_id es la fuente de verdad si viene.
  if v_booking_id is not null then
    select * into v_booking_row from crm.bookings where id = v_booking_id;
    if v_booking_row.id is null then
      raise exception 'booking inexistente';
    end if;
    if v_booking_row.estado <> 'activo' then
      raise exception 'el booking no está activo (estado=%)', v_booking_row.estado;
    end if;
    if v_booking_row.tipo <> 'retiro' then
      raise exception 'el booking debe ser de tipo retiro';
    end if;
    if v_booking_row.naviera_id <> v_naviera then
      raise exception 'booking_naviera_mismatch: el booking % no pertenece a la naviera indicada', v_booking_row.numero;
    end if;
    v_booking_texto := v_booking_row.numero;
  elsif v_require_booking then
    raise exception 'booking_id es obligatorio para esta tanda';
  end if;

  for v_item in select * from jsonb_array_elements(p -> 'contenedores') loop
    v_num := upper(v_item ->> 'numero');
    v_reforzado := coalesce((v_item ->> 'reforzado')::boolean, true);
    begin
      select id into v_cont_id from crm.contenedores where numero_contenedor = v_num;
      if v_cont_id is null then
        v_cont_id := gen_random_uuid();
        insert into crm.contenedores (id, numero_contenedor, naviera_id, tipo, reforzado_estado)
        values (v_cont_id, v_num, v_naviera, v_tipo,
                case when v_reforzado then 'confirmado_reforzado'
                     else 'confirmado_no_reforzado' end);
      end if;

      v_op_id := gen_random_uuid();
      insert into crm.operaciones
        (id, contenedor_id, retiro_de, retiro_de_id, booking_retiro, booking_retiro_id, fecha_retiro, estado)
      values
        (v_op_id, v_cont_id, v_retiro_de, v_retiro_de_id, v_booking_texto, v_booking_id, v_fecha,
         case when v_confirma then 'en_planta' else 'en_transito_a_planta' end);

      insert into crm.movimientos_planta
        (operacion_id, planta_origen_id, planta_destino_id, medio,
         fecha_salida, fecha_llegada_confirmada, confirmado_por, estado)
      values
        (v_op_id, null, v_planta, v_medio, v_fecha,
         case when v_confirma then v_fecha end,
         case when v_confirma then v_perfil.usuario_id end,
         case when v_confirma then 'confirmado' else 'en_transito' end);

      v_creadas := v_creadas + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'numero', v_num, 'estado', 'aceptado', 'operacion_id', v_op_id, 'motivo', null,
        'motivo_texto', null);
    exception
      when unique_violation then
        v_rechazadas := v_rechazadas + 1;
        v_resultados := v_resultados || jsonb_build_object(
          'numero', v_num, 'estado', 'rechazado', 'operacion_id', null,
          'motivo', 'ciclo_abierto',
          'motivo_texto', format('%s ya tiene un ciclo abierto — escalá a tu supervisor', v_num));
      when check_violation then
        v_rechazadas := v_rechazadas + 1;
        v_resultados := v_resultados || jsonb_build_object(
          'numero', v_num, 'estado', 'rechazado', 'operacion_id', null,
          'motivo', 'numero_invalido',
          'motivo_texto', format('%s no es un número de contenedor válido (formato AAAA1234567)', v_num));
    end;
  end loop;

  return jsonb_build_object('creadas', v_creadas, 'rechazadas', v_rechazadas, 'resultados', v_resultados);
end $function$;

revoke all on function crm.crm_crear_tanda_retiro(jsonb) from public, anon;
grant execute on function crm.crm_crear_tanda_retiro(jsonb) to authenticated;

-- F.2 crm_registrar_salida_planta: p_asignacion.booking_id (uuid, opcional).
-- Si viene, valida activo + tipo (embarque O retiro — embarques reales
-- llegan como bookings reales) y setea booking_asignado_id + snapshot.
create or replace function crm.crm_registrar_salida_planta(
  p_operacion_ids uuid[],
  p_tipo_cierre text,
  p_fecha timestamptz,
  p_asignacion jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_perfil record;
  v_n int := 0;
  v_op uuid;
  v_booking_id uuid := nullif(p_asignacion ->> 'booking_id', '')::uuid;
  v_booking_row record;
  v_booking_texto text := p_asignacion ->> 'booking_asignado';
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

  if v_booking_id is not null then
    select * into v_booking_row from crm.bookings where id = v_booking_id;
    if v_booking_row.id is null then
      raise exception 'booking inexistente';
    end if;
    if v_booking_row.estado <> 'activo' then
      raise exception 'el booking no está activo (estado=%)', v_booking_row.estado;
    end if;
    if v_booking_row.tipo not in ('embarque', 'retiro') then
      raise exception 'tipo de booking inválido para egreso';
    end if;
    v_booking_texto := v_booking_row.numero;
  end if;

  foreach v_op in array p_operacion_ids loop
    update crm.operaciones
       set tipo_cierre = p_tipo_cierre,
           fecha_egreso_planta = p_fecha,
           estado = 'en_transito_a_terminal',
           booking_asignado = case when p_tipo_cierre = 'embarcado'
                                   then v_booking_texto
                                   else booking_asignado end,
           booking_asignado_id = case when p_tipo_cierre = 'embarcado'
                                   then v_booking_id else booking_asignado_id end,
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
end $function$;

revoke all on function crm.crm_registrar_salida_planta(uuid[], text, timestamptz, jsonb) from public, anon;
grant execute on function crm.crm_registrar_salida_planta(uuid[], text, timestamptz, jsonb) to authenticated;

-- ═══ G · vista_bookings_saldo + umbral de configuración ═══════════════════
insert into crm.configuracion (clave, valor)
values ('umbral_alerta_booking', '{"dias": 4}'::jsonb)
on conflict (clave) do nothing;

create or replace view crm.vista_bookings_saldo
with (security_invoker = true) as
select
  b.id as booking_id,
  b.numero,
  n.nombre as naviera,
  b.etd,
  b.fecha_corte,
  b.buque,
  coalesce(ep.n, 0) as contenedores_en_planta,
  coalesce(tot.n, 0) as contenedores_totales,
  (b.etd - crm.hoy_ar()) as dias_a_etd,
  case
    when coalesce(ep.n, 0) = 0 then 'neutro'
    when (b.etd - crm.hoy_ar()) < 0 then 'rojo'
    when (b.etd - crm.hoy_ar()) <= cfg.umbral then 'amarillo'
    else 'verde'
  end as estado_semaforo
from crm.bookings b
join crm.navieras n on n.id = b.naviera_id
cross join lateral (
  select coalesce((select (configuracion.valor ->> 'dias')::integer
                      from crm.configuracion
                     where configuracion.clave = 'umbral_alerta_booking'), 4) as umbral
) cfg
left join lateral (
  select count(*) as n from crm.operaciones o
   where o.booking_retiro_id = b.id and o.estado = 'en_planta'
) ep on true
left join lateral (
  select count(*) as n from crm.operaciones o
   where o.booking_retiro_id = b.id and o.estado <> 'anulada'
) tot on true
where b.tipo = 'retiro' and b.estado = 'activo';

grant select on crm.vista_bookings_saldo to authenticated;

-- ═══ H · refrescar cache de PostgREST ═════════════════════════════════════
notify pgrst, 'reload schema';
