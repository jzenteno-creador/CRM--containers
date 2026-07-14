-- ═══════════════════════════════════════════════════════════════════════════
-- 030 · M5/B — INCIDENCIAS AMPLIADAS + RPC-ONLY (D6, John 2026-07-14)
--
-- Contexto de negocio: las incidencias pasan a cubrir el ciclo de plata. Al
-- devolver un vacío a veces exigen lavado (se paga y luego se reclama) o hay
-- daños con costo de refacción. El monto NULLABLE es estimativo y se edita a
-- lo largo de la vida del reclamo (estimado → facturado → reclamado →
-- recuperado); "lo importante es registrar el evento" (John). Cada edición
-- deja rastro en el timeline de la operación.
--
-- Obligatorio en el alta MANUAL: tipo, fecha, contenedor (vía operación),
-- número de orden. `crm.incidencias` sale de la lista sancionada de escritura
-- directa (AGENTS.md) y pasa a RPC-only — resuelve BE-03 (alta no atómica de
-- incidencia+fotos): una sola llamada a crm_crear_incidencia escribe ambas
-- en la misma transacción.
--
-- Patrón de escritura: mismo que 028/029 — RPC-only, SECURITY DEFINER owner
-- = crm_rpc_executor (rol sin BYPASSRLS, ver 025). authenticated pierde
-- INSERT/UPDATE directo sobre incidencias/incidencia_fotos; el único camino
-- de escritura son las 3 RPCs nuevas + la extensión de crm_crear_tanda_retiro
-- (auto-alta de incidencia `no_reforzado`).
--
-- NOTA (dual FK operacion_id/operaciones_impo): NO va en esta migración —
-- operaciones_impo todavía no existe (la agrega el bloque B2 / migración 032,
-- con el check exactly-one). `operacion_id` queda NOT NULL como está hoy,
-- con un comentario avisando del trabajo pendiente.
-- ═══════════════════════════════════════════════════════════════════════════

-- Re-asegurar membresía (idempotente, mismo motivo que 028/029: el ALTER
-- OWNER de las RPCs nuevas necesita que `current_user` sea miembro de
-- crm_rpc_executor).
grant crm_rpc_executor to current_user;

-- ═══ A · Ampliar crm.incidencias ══════════════════════════════════════════

alter table crm.incidencias
  drop constraint incidencias_tipo_check;

alter table crm.incidencias
  add constraint incidencias_tipo_check check (
    tipo in (
      'averia_sufrida', 'averia_recepcionada', 'otro',
      'lavado_exigido', 'dano_refaccion', 'no_reforzado', 'prefijo_restringido'
    )
  );

alter table crm.incidencias
  add column numero_orden     text,
  add column monto_usd        numeric check (monto_usd >= 0),
  add column responsable      text,
  add column estado_reclamo   text not null default 'sin_reclamo'
                                 check (estado_reclamo in ('sin_reclamo', 'abierta', 'reclamada', 'resuelta')),
  add column resultado        text check (resultado in ('recuperado', 'no_recuperado')),
  add column fecha_reclamo    timestamptz,
  add column fecha_resolucion timestamptz,
  add constraint incidencias_resuelta_exige_resultado
    check (estado_reclamo <> 'resuelta' or resultado is not null);

comment on column crm.incidencias.operacion_id is
  'FK a crm.operaciones (NOT NULL). PENDIENTE (bloque B2, migración 032): pasará a FK dual '
  '(operaciones | operaciones_impo, CHECK exactly-one) cuando exista operaciones_impo. '
  'Fuera de alcance de la 030 — no tocar acá.';

comment on column crm.incidencias.numero_orden is
  'Obligatorio SOLO en el alta manual — lo exige crm_crear_incidencia (validación de '
  'aplicación, no un NOT NULL de columna) porque las incidencias AUTO del sistema '
  '(ej. no_reforzado desde crm_crear_tanda_retiro) pueden no tener orden todavía.';

comment on column crm.incidencias.monto_usd is
  'Estimativo y editable con rastro (D6, John 2026-07-14): "el monto a veces se conoce y a '
  'veces no; lo importante es registrar el evento". Cada cambio vía crm_actualizar_reclamo '
  'inserta un evento de timeline con {de,a}.';

comment on column crm.incidencias.estado_reclamo is
  'Ciclo del reclamo: sin_reclamo→abierta→reclamada→resuelta, sin saltos ni retrocesos. '
  'Mutado SOLO por crm_actualizar_reclamo (transición de estado = supervisor+).';

comment on table crm.incidencias is
  'RPC-only desde la 030 (D6, John 2026-07-14): alta vía crm_crear_incidencia (atómica con '
  'sus fotos — resuelve BE-03), fotos adicionales vía crm_agregar_fotos_incidencia, reclamo '
  'vía crm_actualizar_reclamo. authenticated pierde INSERT/UPDATE directo — queda SELECT.';

comment on table crm.incidencia_fotos is
  'RPC-only desde la 030 (D6): alta vía crm_crear_incidencia / crm_agregar_fotos_incidencia. '
  'authenticated pierde INSERT/UPDATE directo — queda SELECT.';

-- ═══ B · RPC-only: revocar escritura directa, policies scopeadas a executor ═

drop policy incidencias_insert on crm.incidencias;
drop policy incidencias_update on crm.incidencias;
drop policy fotos_insert on crm.incidencia_fotos;

-- Autorización real vive DENTRO de cada RPC (rol + estado + scope vía RLS
-- transitiva sobre crm.operaciones, mismo patrón que consolidaciones/029).
-- Las policies del executor son deliberadamente permisivas: el gate es el
-- cuerpo de la función, no la policy.
create policy incidencias_insert_executor on crm.incidencias
  for insert to crm_rpc_executor
  with check (true);

create policy incidencias_update_executor on crm.incidencias
  for update to crm_rpc_executor
  using (true)
  with check (true);

create policy fotos_insert_executor on crm.incidencia_fotos
  for insert to crm_rpc_executor
  with check (true);

revoke insert, update on crm.incidencias      from authenticated;
revoke insert, update on crm.incidencia_fotos from authenticated;

grant insert, update on crm.incidencias to crm_rpc_executor;
-- Solo INSERT para fotos: ninguna RPC de esta migración actualiza una foto ya
-- subida (mínimo privilegio — §21). Si a futuro hace falta reemplazar/editar
-- una foto, se agrega el grant + policy en esa migración.
grant insert on crm.incidencia_fotos to crm_rpc_executor;

-- ═══ C · RPCs nuevas (owner crm_rpc_executor) ══════════════════════════════

-- C.1 · crm_crear_incidencia — alta atómica (incidencia + N fotos), rol
-- operador+. Obligatorios: tipo válido, fecha, operación a alcance (vía RLS
-- transitiva de crm.operaciones), numero_orden no vacío. El evento de alta lo
-- cubre el trigger existente trg_incidencia_evt/evt_incidencia (AFTER INSERT
-- ON crm.incidencias) — no se duplica acá.
create or replace function crm.crm_crear_incidencia(
  p_operacion_id uuid,
  p_tipo         text,
  p_fecha        timestamptz,
  p_numero_orden text,
  p_descripcion  text default null,
  p_monto_usd    numeric default null,
  p_responsable  text default null,
  p_fotos        jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_perfil       record;
  v_numero_orden text := nullif(trim(p_numero_orden), '');
  v_id           uuid;
  v_foto         jsonb;
  v_path         text;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo'
     or v_perfil.rol is null
     or v_perfil.rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'crear incidencia requiere operador, supervisor o administrador';
  end if;

  if p_tipo is null or p_tipo not in (
       'averia_sufrida', 'averia_recepcionada', 'otro',
       'lavado_exigido', 'dano_refaccion', 'no_reforzado', 'prefijo_restringido') then
    raise exception 'tipo de incidencia inválido: %', p_tipo;
  end if;

  if p_fecha is null then
    raise exception 'la fecha es obligatoria';
  end if;

  if v_numero_orden is null then
    raise exception 'numero_orden_requerido: el número de orden es obligatorio en el alta manual de incidencias';
  end if;

  -- Existencia + alcance: este SELECT corre bajo crm_rpc_executor (sin
  -- BYPASSRLS) → hereda la RLS de operaciones_select (planta-scope para
  -- operador, global para supervisor/admin). Mismo patrón que 029.
  if not exists (select 1 from crm.operaciones o where o.id = p_operacion_id) then
    raise exception 'operacion_fuera_de_alcance: operación inexistente o fuera de tu alcance';
  end if;

  if p_monto_usd is not null and p_monto_usd < 0 then
    raise exception 'monto_usd no puede ser negativo';
  end if;

  insert into crm.incidencias
    (operacion_id, tipo, descripcion, fecha, usuario_id, numero_orden, monto_usd, responsable)
  values
    (p_operacion_id, p_tipo, p_descripcion, p_fecha, v_perfil.usuario_id,
     v_numero_orden, p_monto_usd, nullif(trim(p_responsable), ''))
  returning id into v_id;

  if p_fotos is not null and jsonb_typeof(p_fotos) = 'array' then
    for v_foto in select * from jsonb_array_elements(p_fotos) loop
      v_path := case jsonb_typeof(v_foto)
                  when 'string' then trim(both '"' from v_foto::text)
                  else nullif(trim(v_foto ->> 'storage_path'), '')
                end;
      if v_path is not null and length(v_path) > 0 then
        insert into crm.incidencia_fotos (incidencia_id, storage_path)
        values (v_id, v_path);
      end if;
    end loop;
  end if;

  return v_id;
end $fn$;

revoke all on function crm.crm_crear_incidencia(uuid, text, timestamptz, text, text, numeric, text, jsonb) from public, anon;
grant execute on function crm.crm_crear_incidencia(uuid, text, timestamptz, text, text, numeric, text, jsonb) to authenticated;

-- C.2 · crm_agregar_fotos_incidencia — rol operador+, incidencia existente y
-- a alcance (misma transitividad de RLS vía incidencias_select →
-- operaciones_select).
create or replace function crm.crm_agregar_fotos_incidencia(
  p_incidencia_id uuid,
  p_fotos         jsonb
)
returns int
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_perfil record;
  v_row    record;
  v_foto   jsonb;
  v_path   text;
  v_n      int := 0;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo'
     or v_perfil.rol is null
     or v_perfil.rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'agregar fotos requiere operador, supervisor o administrador';
  end if;

  select * into v_row from crm.incidencias where id = p_incidencia_id;
  if v_row.id is null then
    raise exception 'incidencia inexistente o fuera de alcance';
  end if;

  if p_fotos is null or jsonb_typeof(p_fotos) <> 'array' or jsonb_array_length(p_fotos) = 0 then
    raise exception 'no se indicaron fotos';
  end if;

  for v_foto in select * from jsonb_array_elements(p_fotos) loop
    v_path := case jsonb_typeof(v_foto)
                when 'string' then trim(both '"' from v_foto::text)
                else nullif(trim(v_foto ->> 'storage_path'), '')
              end;
    if v_path is not null and length(v_path) > 0 then
      insert into crm.incidencia_fotos (incidencia_id, storage_path)
      values (p_incidencia_id, v_path);
      v_n := v_n + 1;
    end if;
  end loop;

  if v_n = 0 then
    raise exception 'ninguna foto válida en el payload';
  end if;

  return v_n;
end $fn$;

revoke all on function crm.crm_agregar_fotos_incidencia(uuid, jsonb) from public, anon;
grant execute on function crm.crm_agregar_fotos_incidencia(uuid, jsonb) to authenticated;

-- C.3 · crm_actualizar_reclamo — monto/responsable: operador+. Transición de
-- estado_reclamo (y, atado a ella, `resultado`, que solo se setea al
-- resolver): supervisor+ — consistente con la vieja policy de UPDATE de
-- incidencias (supervisor/administrador). Transiciones válidas:
-- sin_reclamo→abierta→reclamada→resuelta, sin saltos ni retrocesos.
-- `resuelta` EXIGE `resultado` (reforzado también por CHECK de tabla,
-- incidencias_resuelta_exige_resultado). Cada llamada exitosa inserta UN
-- evento 'incidencia' con detalle {accion:'reclamo', incidencia_id, cambios,
-- nota} — el rastro pedido por John. Sin cambios efectivos → error
-- 'sin_cambios'. Una nota sin cambios de campo también cuenta como cambio
-- válido (permite dejar una anotación sin forzar un valor artificial).
create or replace function crm.crm_actualizar_reclamo(
  p_incidencia_id  uuid,
  p_estado_reclamo text default null,
  p_resultado      text default null,
  p_monto_usd      numeric default null,
  p_responsable    text default null,
  p_nota           text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_perfil            record;
  v_row               record;
  v_next              text;
  v_cambios           jsonb := '{}'::jsonb;
  v_algo              boolean := false;
  v_nuevo_estado      text;
  v_nuevo_resultado   text;
  v_nuevo_monto       numeric;
  v_nuevo_responsable text;
  v_responsable_trim  text := nullif(trim(p_responsable), '');
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo'
     or v_perfil.rol is null
     or v_perfil.rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'actualizar reclamo requiere operador, supervisor o administrador';
  end if;

  select * into v_row from crm.incidencias where id = p_incidencia_id;
  if v_row.id is null then
    raise exception 'incidencia inexistente o fuera de alcance';
  end if;

  v_nuevo_estado      := v_row.estado_reclamo;
  v_nuevo_resultado   := v_row.resultado;
  v_nuevo_monto       := v_row.monto_usd;
  v_nuevo_responsable := v_row.responsable;

  -- Transición de estado: solo supervisor+.
  if p_estado_reclamo is not null and p_estado_reclamo is distinct from v_row.estado_reclamo then
    if v_perfil.rol not in ('supervisor', 'administrador') then
      raise exception 'cambiar el estado del reclamo requiere supervisor o administrador';
    end if;
    if p_estado_reclamo not in ('sin_reclamo', 'abierta', 'reclamada', 'resuelta') then
      raise exception 'estado_reclamo inválido: %', p_estado_reclamo;
    end if;
    v_next := case v_row.estado_reclamo
                when 'sin_reclamo' then 'abierta'
                when 'abierta'     then 'reclamada'
                when 'reclamada'   then 'resuelta'
                else null
              end;
    if v_next is null or p_estado_reclamo <> v_next then
      raise exception 'transicion_invalida: % -> % no permitida (esperada: %)',
        v_row.estado_reclamo, p_estado_reclamo, coalesce(v_next, '(terminal)');
    end if;
    v_nuevo_estado := p_estado_reclamo;
    v_cambios := v_cambios || jsonb_build_object('estado_reclamo',
      jsonb_build_object('de', v_row.estado_reclamo, 'a', p_estado_reclamo));
    v_algo := true;
  end if;

  -- Resultado: atado a la transición a 'resuelta' — mismo gate (supervisor+).
  if p_resultado is not null and p_resultado is distinct from v_row.resultado then
    if v_perfil.rol not in ('supervisor', 'administrador') then
      raise exception 'cambiar el resultado del reclamo requiere supervisor o administrador';
    end if;
    if p_resultado not in ('recuperado', 'no_recuperado') then
      raise exception 'resultado inválido: %', p_resultado;
    end if;
    if v_nuevo_estado <> 'resuelta' then
      raise exception 'el resultado solo se setea al resolver el reclamo (estado_reclamo=resuelta)';
    end if;
    v_nuevo_resultado := p_resultado;
    v_cambios := v_cambios || jsonb_build_object('resultado',
      jsonb_build_object('de', v_row.resultado, 'a', p_resultado));
    v_algo := true;
  end if;

  if v_nuevo_estado = 'resuelta' and v_nuevo_resultado is null then
    raise exception 'resolver_exige_resultado: resolver el reclamo exige resultado (recuperado|no_recuperado)';
  end if;

  -- monto_usd / responsable: operador+ (ya validado arriba).
  if p_monto_usd is not null and p_monto_usd is distinct from v_row.monto_usd then
    if p_monto_usd < 0 then
      raise exception 'monto_usd no puede ser negativo';
    end if;
    v_nuevo_monto := p_monto_usd;
    v_cambios := v_cambios || jsonb_build_object('monto_usd',
      jsonb_build_object('de', v_row.monto_usd, 'a', p_monto_usd));
    v_algo := true;
  end if;

  if v_responsable_trim is not null and v_responsable_trim is distinct from v_row.responsable then
    v_nuevo_responsable := v_responsable_trim;
    v_cambios := v_cambios || jsonb_build_object('responsable',
      jsonb_build_object('de', v_row.responsable, 'a', v_nuevo_responsable));
    v_algo := true;
  end if;

  if p_nota is not null and length(trim(p_nota)) > 0 then
    v_algo := true;
  end if;

  if not v_algo then
    raise exception 'sin_cambios: no se indicó ningún cambio efectivo';
  end if;

  update crm.incidencias
     set estado_reclamo   = v_nuevo_estado,
         resultado        = v_nuevo_resultado,
         monto_usd        = v_nuevo_monto,
         responsable      = v_nuevo_responsable,
         fecha_reclamo    = case when v_nuevo_estado = 'reclamada' and v_row.fecha_reclamo is null
                                  then now() else v_row.fecha_reclamo end,
         fecha_resolucion = case when v_nuevo_estado = 'resuelta' and v_row.fecha_resolucion is null
                                  then now() else v_row.fecha_resolucion end
   where id = p_incidencia_id;
  if not found then
    raise exception 'no se pudo actualizar la incidencia (fuera de alcance)';
  end if;

  insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
  values (v_row.operacion_id, 'incidencia', now(), v_perfil.usuario_id,
          jsonb_build_object('accion', 'reclamo', 'incidencia_id', p_incidencia_id,
                              'cambios', v_cambios, 'nota', p_nota));

  return jsonb_build_object(
    'incidencia_id', p_incidencia_id, 'estado_reclamo', v_nuevo_estado,
    'resultado', v_nuevo_resultado, 'monto_usd', v_nuevo_monto,
    'responsable', v_nuevo_responsable, 'cambios', v_cambios);
end $fn$;

revoke all on function crm.crm_actualizar_reclamo(uuid, text, text, numeric, text, text) from public, anon;
grant execute on function crm.crm_actualizar_reclamo(uuid, text, text, numeric, text, text) to authenticated;

-- Owner → crm_rpc_executor para las 3 RPCs nuevas (mismo procedimiento que
-- 028/029: el nuevo owner necesita CREATE en el schema para el alter owner en
-- Supabase; se concede temporal y se revoca después).
grant create on schema crm to crm_rpc_executor;
do $$
declare
  fn text;
  sigs text[] := array[
    'crm.crm_crear_incidencia(uuid, text, timestamptz, text, text, numeric, text, jsonb)',
    'crm.crm_agregar_fotos_incidencia(uuid, jsonb)',
    'crm.crm_actualizar_reclamo(uuid, text, text, numeric, text, text)'
  ];
begin
  foreach fn in array sigs loop
    execute format('alter function %s owner to crm_rpc_executor', fn);
  end loop;
end $$;
revoke create on schema crm from crm_rpc_executor;

-- ═══ D · Extender crm_crear_tanda_retiro (preserva TODO lo de 006/019/028/029;
-- owner crm_rpc_executor se preserva al hacer CREATE OR REPLACE — mismo
-- patrón verificado en 028/029) ════════════════════════════════════════════
-- Por cada contenedor de la tanda con reforzado=false: auto-crea una
-- incidencia tipo='no_reforzado' sobre la operación recién creada (fecha =
-- fecha_retiro, numero_orden = null porque es AUTO, usuario = el de la
-- sesión). INSERT directo (no vía crm_crear_incidencia: esa RPC exige
-- numero_orden en el alta manual, que acá no aplica) — el trigger
-- trg_incidencia_evt sigue insertando el evento de timeline igual que
-- cualquier otra alta. Se cuenta en el jsonb de resultado.
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
  v_estado_carga text := coalesce(nullif(p -> 'header' ->> 'estado_carga', ''), 'vacio');
  v_item jsonb;
  v_num text;
  v_reforzado boolean;
  v_cont_id uuid;
  v_op_id uuid;
  v_creadas int := 0;
  v_rechazadas int := 0;
  v_incidencias_auto int := 0;
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
  if v_estado_carga not in ('vacio', 'lleno') then
    raise exception 'estado_carga inválido: %', v_estado_carga;
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
        (id, contenedor_id, retiro_de, retiro_de_id, booking_retiro, booking_retiro_id, fecha_retiro, estado, estado_carga)
      values
        (v_op_id, v_cont_id, v_retiro_de, v_retiro_de_id, v_booking_texto, v_booking_id, v_fecha,
         case when v_confirma then 'en_planta' else 'en_transito_a_planta' end, v_estado_carga);

      insert into crm.movimientos_planta
        (operacion_id, planta_origen_id, planta_destino_id, medio,
         fecha_salida, fecha_llegada_confirmada, confirmado_por, estado)
      values
        (v_op_id, null, v_planta, v_medio, v_fecha,
         case when v_confirma then v_fecha end,
         case when v_confirma then v_perfil.usuario_id end,
         case when v_confirma then 'confirmado' else 'en_transito' end);

      if not v_reforzado then
        insert into crm.incidencias
          (operacion_id, tipo, descripcion, fecha, usuario_id, numero_orden)
        values
          (v_op_id, 'no_reforzado', 'Contenedor retirado sin refuerzo (auto)', v_fecha,
           v_perfil.usuario_id, null);
        v_incidencias_auto := v_incidencias_auto + 1;
      end if;

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

  return jsonb_build_object('creadas', v_creadas, 'rechazadas', v_rechazadas,
                             'incidencias_auto', v_incidencias_auto, 'resultados', v_resultados);
end $function$;

-- CREATE OR REPLACE preserva owner (crm_rpc_executor) y grants existentes
-- (revoke all from public/anon + grant execute to authenticated de la 025) —
-- no hace falta repetirlos.

-- ═══ E · refrescar cache de PostgREST ══════════════════════════════════════
notify pgrst, 'reload schema';
