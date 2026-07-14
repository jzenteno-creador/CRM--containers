-- ═══════════════════════════════════════════════════════════════════════════
-- 032 · M5 — MÓDULO IMPORTACIÓN (bloque más grande de M5)
--
-- Ciclo impo: arribo a terminal → retiro de terminal (con mercadería) →
-- ingreso a planta → devolución del vacío (corta el reloj). Una orden trae
-- 1-4 contenedores con arribo común (mismo buque); retiros escalonados
-- (mismo día, distintas horas). Motor de costos usa freetime_destino (026):
-- Combined (un reloj arribo→devolución) o Demurrage+Detention (dos relojes:
-- arribo→retiro y retiro→devolución), MISMA tarifa dry por día para ambos
-- relojes split (el contrato trae un solo rate por lane).
--
-- Tablas SEPARADAS de expo (máquina de estados propia, RLS/triggers/vistas
-- paralelos) — decisión ya tomada en el plan M5, no se unifica con
-- operaciones/operacion_eventos.
--
-- Patrón de escritura: mismo que 025/028/029/030/031 — RPC-only, SECURITY
-- DEFINER owner = crm_rpc_executor (rol sin BYPASSRLS). Se OMITE
-- `grant crm_rpc_executor to current_user` (ya persiste desde 025 — verificado
-- con pg_auth_members antes de escribir esta migración; repetirlo corta la
-- conexión del MCP, según nota operativa de John).
--
-- Regla de relojes (D2, plan M5): split gana si dias_demurrage/dias_detention
-- NO son null Y (dem+det) > 0; si no, Combined. Parametrizada en
-- crm.configuracion (impo_regla_relojes, default {"modo":"auto"}) — SOLO
-- 'auto' está implementado en esta migración; cualquier otro valor de `modo`
-- cae al branch Combined por default (documentado en las vistas del motor;
-- agregar modos explícitos nuevos es tarea de una migración futura, fuera de
-- alcance de D2).
--
-- Guard cross expo/impo: pg_advisory_xact_lock(hashtext(contenedor_id::text))
-- en las RPCs de alta de AMBOS módulos + chequeo del otro lado + índice único
-- parcial por tabla (ux_operacion_abierta ya existía; ux_operacion_impo_abierta
-- nace acá).
--
-- Conteo: crm.dias_con_convencion (019) con la convención de la fila de
-- freetime_destino (convencion_conteo, default retiro_dia_1). Para impo el
-- "día 1" es el arribo para el reloj 1 (demurrage/combined) y el retiro para
-- el reloj 2 (detention) — la MISMA función aplicada dos veces con anclas
-- distintas, sin duplicar lógica de conteo.
--
-- DESVÍO DOCUMENTADO (evento sin columna persistida): `operaciones_impo` NO
-- tiene columna para la fecha de "salida hacia devolución" (el DDL del plan
-- solo trae fecha_retiro_terminal/fecha_ingreso_planta/fecha_devolucion). El
-- trigger evt_operacion_impo_update no puede reconstruir esa fecha desde
-- OLD/NEW (no hay columna que cambie de null a not-null para esa transición).
-- Mismo patrón que 028 (crm_rolear_booking / crm_reasignar_contenedores_booking:
-- INSERT directo del evento desde la RPC cuando "no reconstruible desde
-- OLD/NEW"): crm_registrar_salida_devolucion_impo inserta el evento
-- 'salida_devolucion' DIRECTO (no vía trigger), con el p_fecha del caller.
-- Requiere policy de INSERT para crm_rpc_executor en operacion_impo_eventos
-- (igual que 028 la agregó para operacion_eventos).
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ A · crm.ordenes_impo ══════════════════════════════════════════════════
create table crm.ordenes_impo (
  id                     uuid primary key default gen_random_uuid(),
  numero_orden           text not null unique check (length(trim(numero_orden)) > 0),
  naviera_id             uuid not null references crm.navieras(id),
  booking_bl             text,
  buque                  text,
  fecha_arribo_terminal  timestamptz not null,
  planta_destino_id      uuid not null references crm.plantas(id),
  creado_por             uuid references crm.usuarios(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index ix_ordenes_impo_naviera      on crm.ordenes_impo (naviera_id);
create index ix_ordenes_impo_planta       on crm.ordenes_impo (planta_destino_id);
create index ix_ordenes_impo_fecha_arribo on crm.ordenes_impo (fecha_arribo_terminal);
create index ix_ordenes_impo_creado_por   on crm.ordenes_impo (creado_por);

create trigger trg_ordenes_impo_upd
  before update on crm.ordenes_impo
  for each row execute function crm.set_updated_at();

alter table crm.ordenes_impo enable row level security;

-- SELECT: operador scopeado por planta_destino (como movimientos_planta,
-- comparación directa contra p.planta_asignada_id); supervisor/admin global.
create policy ordenes_impo_select on crm.ordenes_impo
  for select to authenticated
  using (
    (select p.estado = 'activo'
       and ( p.rol in ('supervisor', 'administrador')
          or (p.rol = 'operador' and planta_destino_id = p.planta_asignada_id))
      from crm.perfil() p)
  );

-- Escritura: RPC-only (crm_crear_orden_impo). Sin UPDATE — no hay RPC de
-- edición de encabezado en este bloque (mínimo privilegio; se agrega en una
-- migración futura si hace falta editar booking_bl/buque post-alta).
create policy ordenes_impo_insert_executor on crm.ordenes_impo
  for insert to crm_rpc_executor
  with check (true);

grant select on crm.ordenes_impo to authenticated;
grant select, insert on crm.ordenes_impo to crm_rpc_executor;

comment on table crm.ordenes_impo is
  'Encabezado de orden de importación (M5-032): arribo común (mismo buque), '
  '1-4 contenedores. RPC-only (crm_crear_orden_impo). Sin UPDATE en este bloque.';

-- ═══ B · crm.operaciones_impo ══════════════════════════════════════════════
create table crm.operaciones_impo (
  id                     uuid primary key default gen_random_uuid(),
  orden_id               uuid not null references crm.ordenes_impo(id),
  contenedor_id          uuid not null references crm.contenedores(id),
  fecha_retiro_terminal  timestamptz,
  fecha_ingreso_planta   timestamptz,
  fecha_devolucion       timestamptz,
  estado                 text not null default 'en_terminal'
                         check (estado in
                           ('en_terminal', 'en_transito_a_planta', 'en_planta',
                            'en_transito_devolucion', 'cerrado', 'anulada')),
  anulada_motivo         text,
  anulada_por            uuid references crm.usuarios(id),
  observaciones          text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
  -- Sin CHECK de coherencia de fechas a propósito (retiro>=arribo,
  -- devolucion>=retiro): se valida en las RPCs, no acá — los datos reales
  -- pueden tener horarios raros (mismo criterio que el brief pidió).
);

-- GUARD (§4/D2): una operación de importación abierta por contenedor.
create unique index ux_operacion_impo_abierta
  on crm.operaciones_impo (contenedor_id)
  where estado not in ('cerrado', 'anulada');

create index ix_operaciones_impo_orden        on crm.operaciones_impo (orden_id);
create index ix_operaciones_impo_contenedor   on crm.operaciones_impo (contenedor_id);
create index ix_operaciones_impo_estado       on crm.operaciones_impo (estado);
create index ix_operaciones_impo_anulada_por  on crm.operaciones_impo (anulada_por);

create trigger trg_operaciones_impo_upd
  before update on crm.operaciones_impo
  for each row execute function crm.set_updated_at();

alter table crm.operaciones_impo enable row level security;

-- SELECT: espejo de operaciones — operador por planta DE LA ORDEN (no hay
-- movimientos_planta para impo, un solo planta_destino por orden);
-- supervisor/admin global.
create policy operaciones_impo_select on crm.operaciones_impo
  for select to authenticated
  using (
    exists (
      select 1
        from crm.perfil() p
        join crm.ordenes_impo oi on oi.id = operaciones_impo.orden_id
       where p.estado = 'activo'
         and ( p.rol in ('supervisor', 'administrador')
            or (p.rol = 'operador' and oi.planta_destino_id = p.planta_asignada_id))
    )
  );

create policy operaciones_impo_insert_executor on crm.operaciones_impo
  for insert to crm_rpc_executor
  with check (true);

create policy operaciones_impo_update_executor on crm.operaciones_impo
  for update to crm_rpc_executor
  using (true)
  with check (true);

grant select on crm.operaciones_impo to authenticated;
grant select, insert, update on crm.operaciones_impo to crm_rpc_executor;

comment on table crm.operaciones_impo is
  'Ciclo de vida de importación por contenedor (M5-032): en_terminal → '
  'en_transito_a_planta → en_planta → en_transito_devolucion → cerrado|anulada. '
  'RPC-only. Guard cross con crm.operaciones vía advisory lock en las RPCs de alta.';

-- ═══ C · crm.operacion_impo_eventos — TIMELINE, espejo de operacion_eventos ═
create table crm.operacion_impo_eventos (
  id                 uuid primary key default gen_random_uuid(),
  operacion_impo_id  uuid not null references crm.operaciones_impo(id),
  tipo_evento        text not null check (tipo_evento in
                     ('arribo', 'retiro_terminal', 'ingreso_planta',
                      'salida_devolucion', 'devolucion', 'anulacion',
                      'incidencia', 'correccion')),
  fecha              timestamptz not null default now(),
  usuario_id         uuid references crm.usuarios(id),
  detalle            jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index ix_eventos_impo_operacion on crm.operacion_impo_eventos (operacion_impo_id, fecha);
create index ix_eventos_impo_usuario   on crm.operacion_impo_eventos (usuario_id);

create trigger trg_eventos_impo_upd
  before update on crm.operacion_impo_eventos
  for each row execute function crm.set_updated_at();

alter table crm.operacion_impo_eventos enable row level security;

-- SELECT hereda visibilidad de la operación (RLS de operaciones_impo aplica
-- dentro del EXISTS). INSERT: los triggers DEFINER owner=postgres bypasan RLS
-- (no necesitan policy); crm_registrar_salida_devolucion_impo (owner=executor,
-- ver cabecera) SÍ la necesita para su INSERT directo del evento
-- 'salida_devolucion' — mismo patrón que 028 con operacion_eventos.
create policy eventos_impo_select on crm.operacion_impo_eventos
  for select to authenticated
  using (
    (select p.estado = 'activo' from crm.perfil() p)
    and exists (select 1 from crm.operaciones_impo oi where oi.id = operacion_impo_id)
  );

create policy eventos_impo_insert_executor on crm.operacion_impo_eventos
  for insert to crm_rpc_executor
  with check (true);

grant select on crm.operacion_impo_eventos to authenticated;
grant insert on crm.operacion_impo_eventos to crm_rpc_executor;

-- C.1 · evt_operacion_impo_insert — AFTER INSERT: evento 'arribo', fecha =
-- fecha_arribo_terminal de la orden (arribo común a todos los contenedores).
-- SECURITY DEFINER owner=postgres (bypasa RLS para escribir en otra tabla) —
-- mismo patrón/lista cerrada que 005 (evt_operacion_insert), SIN guard de
-- perfil activo: el trigger corre como side-effect de un INSERT que YA pasó
-- por la RLS/RPC gateada de operaciones_impo; no toma ninguna decisión de
-- autorización propia (idéntico criterio a evt_operacion_insert de 005).
create or replace function crm.evt_operacion_impo_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orden record;
begin
  select numero_orden, fecha_arribo_terminal into v_orden
    from crm.ordenes_impo where id = new.orden_id;

  insert into crm.operacion_impo_eventos (operacion_impo_id, tipo_evento, fecha, usuario_id, detalle)
  values (
    new.id, 'arribo', coalesce(v_orden.fecha_arribo_terminal, now()),
    (select p.usuario_id from crm.perfil() p),
    jsonb_build_object('orden_id', new.orden_id, 'numero_orden', v_orden.numero_orden)
  );
  return new;
end $$;

create trigger trg_op_impo_evt_insert
  after insert on crm.operaciones_impo
  for each row execute function crm.evt_operacion_impo_insert();

-- Hallazgo AL VERIFICAR (mismo fenómeno fantasma que la sección J más abajo):
-- el default-privilege "revoke execute on functions from public" de 001 ya
-- NO se propaga a objetos nuevos del schema crm — sin este REVOKE explícito,
-- evt_operacion_impo_insert quedaba ejecutable por anon/authenticated (el
-- advisor de seguridad lo marcó WARN). No explotable en la práctica (una
-- función `returns trigger` no se puede invocar fuera de un trigger —
-- Postgres tira error), pero viola "anon sin ningún grant" (§21). El trigger
-- sigue disparando igual: el disparo automático no exige EXECUTE del rol que
-- hace el DML, solo el grant sobre la tabla.
revoke all on function crm.evt_operacion_impo_insert() from public, anon, authenticated;

-- C.2 · evt_operacion_impo_update — AFTER UPDATE: retiro_terminal /
-- ingreso_planta / devolucion (columnas que pasan de null a not-null) +
-- anulacion (transición de estado). NO cubre 'salida_devolucion' (sin columna
-- persistida — ver DESVÍO en la cabecera; esa RPC inserta el evento directo).
create or replace function crm.evt_operacion_impo_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select p.usuario_id from crm.perfil() p);
begin
  if old.fecha_retiro_terminal is null and new.fecha_retiro_terminal is not null then
    insert into crm.operacion_impo_eventos (operacion_impo_id, tipo_evento, fecha, usuario_id, detalle)
    values (new.id, 'retiro_terminal', new.fecha_retiro_terminal, v_usuario, '{}'::jsonb);
  end if;

  if old.fecha_ingreso_planta is null and new.fecha_ingreso_planta is not null then
    insert into crm.operacion_impo_eventos (operacion_impo_id, tipo_evento, fecha, usuario_id, detalle)
    values (new.id, 'ingreso_planta', new.fecha_ingreso_planta, v_usuario, '{}'::jsonb);
  end if;

  if old.fecha_devolucion is null and new.fecha_devolucion is not null then
    insert into crm.operacion_impo_eventos (operacion_impo_id, tipo_evento, fecha, usuario_id, detalle)
    values (new.id, 'devolucion', new.fecha_devolucion, v_usuario, jsonb_build_object('corta_reloj', true));
  end if;

  if new.estado = 'anulada' and old.estado is distinct from 'anulada' then
    insert into crm.operacion_impo_eventos (operacion_impo_id, tipo_evento, fecha, usuario_id, detalle)
    values (new.id, 'anulacion', now(), v_usuario, jsonb_build_object('motivo', new.anulada_motivo));
  end if;

  return new;
end $$;

create trigger trg_op_impo_evt_update
  after update on crm.operaciones_impo
  for each row execute function crm.evt_operacion_impo_update();

-- Mismo fix que evt_operacion_impo_insert arriba.
revoke all on function crm.evt_operacion_impo_update() from public, anon, authenticated;

-- ═══ D · Incidencias — FK dual (operacion_id | operacion_impo_id) ══════════
alter table crm.incidencias
  alter column operacion_id drop not null;

alter table crm.incidencias
  add column operacion_impo_id uuid references crm.operaciones_impo(id);

alter table crm.incidencias
  add constraint incidencias_op_dual_exactly_one
  check (num_nonnulls(operacion_id, operacion_impo_id) = 1);

comment on column crm.incidencias.operacion_id is
  'FK a crm.operaciones. NULLABLE desde la 032: exactamente uno de '
  '(operacion_id, operacion_impo_id) debe estar seteado — ver CHECK '
  'incidencias_op_dual_exactly_one.';

comment on column crm.incidencias.operacion_impo_id is
  'FK a crm.operaciones_impo (032). Exactamente uno de '
  '(operacion_id, operacion_impo_id) debe estar seteado.';

-- Simetría con ix_incidencias_operacion (004) — hallado por el advisor de
-- performance tras aplicar (unindexed_foreign_keys).
create index ix_incidencias_operacion_impo on crm.incidencias (operacion_impo_id);

-- SELECT: extender con el lado impo (OR). Recrea la policy de 004 (única
-- policy SELECT de incidencias).
drop policy incidencias_select on crm.incidencias;

create policy incidencias_select on crm.incidencias
  for select to authenticated
  using (
    (select p.estado = 'activo' from crm.perfil() p)
    and (
      (operacion_id is not null
        and exists (select 1 from crm.operaciones o where o.id = operacion_id))
      or
      (operacion_impo_id is not null
        and exists (select 1 from crm.operaciones_impo oi where oi.id = operacion_impo_id))
    )
  );

-- evt_incidencia (005/030): dual-aware — inserta en operacion_eventos u
-- operacion_impo_eventos según cuál FK está seteada. Mismo owner (postgres,
-- DEFINER, bypasa RLS) y misma firma (returns trigger) — CREATE OR REPLACE
-- preserva el binding del trigger AFTER INSERT ON incidencias.
create or replace function crm.evt_incidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.operacion_id is not null then
    insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
    values (new.operacion_id, 'incidencia', new.fecha,
            coalesce(new.usuario_id, (select p.usuario_id from crm.perfil() p)),
            jsonb_build_object('tipo', new.tipo, 'descripcion', new.descripcion));
  elsif new.operacion_impo_id is not null then
    insert into crm.operacion_impo_eventos (operacion_impo_id, tipo_evento, fecha, usuario_id, detalle)
    values (new.operacion_impo_id, 'incidencia', new.fecha,
            coalesce(new.usuario_id, (select p.usuario_id from crm.perfil() p)),
            jsonb_build_object('tipo', new.tipo, 'descripcion', new.descripcion));
  end if;
  return new;
end $$;

-- crm_crear_incidencia: DROP + CREATE (cambia la aridad — agrega
-- p_operacion_impo_id al final con default null; mismo criterio que 026 con
-- crm_nueva_version_freetime: un REPLACE dejaría 2 firmas coexistiendo).
-- p_operacion_id sigue SIN default (compat total con los callers actuales que
-- lo pasan siempre); para impo el caller manda p_operacion_id=null y
-- p_operacion_impo_id=<uuid>, vía parámetros nombrados (PostgREST lo soporta).
drop function if exists
  crm.crm_crear_incidencia(uuid, text, timestamptz, text, text, numeric, text, jsonb);

create function crm.crm_crear_incidencia(
  p_operacion_id      uuid,
  p_tipo              text,
  p_fecha             timestamptz,
  p_numero_orden      text,
  p_descripcion       text default null,
  p_monto_usd         numeric default null,
  p_responsable       text default null,
  p_fotos             jsonb default '[]'::jsonb,
  p_operacion_impo_id uuid default null
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

  if num_nonnulls(p_operacion_id, p_operacion_impo_id) <> 1 then
    raise exception 'operacion_exactly_one: indicá exactamente una de operacion_id / operacion_impo_id (nunca ambas, nunca ninguna)';
  end if;

  -- Existencia + alcance: corre bajo crm_rpc_executor (sin BYPASSRLS) →
  -- hereda la RLS de operaciones_select / operaciones_impo_select
  -- (planta-scope para operador, global para supervisor/admin).
  if p_operacion_id is not null then
    if not exists (select 1 from crm.operaciones o where o.id = p_operacion_id) then
      raise exception 'operacion_fuera_de_alcance: operación inexistente o fuera de tu alcance';
    end if;
  else
    if not exists (select 1 from crm.operaciones_impo oi where oi.id = p_operacion_impo_id) then
      raise exception 'operacion_fuera_de_alcance: operación de importación inexistente o fuera de tu alcance';
    end if;
  end if;

  if p_monto_usd is not null and p_monto_usd < 0 then
    raise exception 'monto_usd no puede ser negativo';
  end if;

  insert into crm.incidencias
    (operacion_id, operacion_impo_id, tipo, descripcion, fecha, usuario_id, numero_orden, monto_usd, responsable)
  values
    (p_operacion_id, p_operacion_impo_id, p_tipo, p_descripcion, p_fecha, v_perfil.usuario_id,
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

revoke all on function crm.crm_crear_incidencia(uuid, text, timestamptz, text, text, numeric, text, jsonb, uuid) from public, anon;
grant execute on function crm.crm_crear_incidencia(uuid, text, timestamptz, text, text, numeric, text, jsonb, uuid) to authenticated;

-- ═══ E · RPCs impo (owner crm_rpc_executor, guards perfil/rol, search_path='') ═

-- E.1 · crm_crear_orden_impo — alta de orden + N operaciones_impo en_terminal.
-- Guard cross (advisory lock + chequeo crm.operaciones abiertas) + auto-
-- incidencia prefijo_restringido (patrón 031, vía FK impo).
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

revoke all on function crm.crm_crear_orden_impo(jsonb) from public, anon;
grant execute on function crm.crm_crear_orden_impo(jsonb) to authenticated;

-- E.2 · crm_confirmar_retiro_terminal — [{operacion_impo_id, fecha}] (retiros
-- escalonados: fecha editable por fila). en_terminal + fecha>=arribo →
-- en_transito_a_planta.
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
  if v_perfil.estado is distinct from 'activo' then
    raise exception 'cuenta no activa';
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

revoke all on function crm.crm_confirmar_retiro_terminal(jsonb) from public, anon;
grant execute on function crm.crm_confirmar_retiro_terminal(jsonb) to authenticated;

-- E.3 · crm_confirmar_ingreso_planta_impo — en_transito_a_planta → en_planta.
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
  v_n int := 0;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo' then
    raise exception 'cuenta no activa';
  end if;
  if p_fecha is null then
    raise exception 'fecha de ingreso a planta obligatoria';
  end if;
  if p_operacion_impo_ids is null or array_length(p_operacion_impo_ids, 1) is null then
    raise exception 'no se indicaron operaciones';
  end if;

  foreach v_op in array p_operacion_impo_ids loop
    update crm.operaciones_impo
       set estado = 'en_planta',
           fecha_ingreso_planta = p_fecha
     where id = v_op
       and estado = 'en_transito_a_planta';
    if found then
      v_n := v_n + 1;
    end if;
  end loop;

  return jsonb_build_object('confirmadas', v_n);
end $fn$;

revoke all on function crm.crm_confirmar_ingreso_planta_impo(uuid[], timestamptz) from public, anon;
grant execute on function crm.crm_confirmar_ingreso_planta_impo(uuid[], timestamptz) to authenticated;

-- E.4 · crm_registrar_salida_devolucion_impo — en_planta → en_transito_devolucion.
-- Inserta el evento 'salida_devolucion' DIRECTO (ver DESVÍO, cabecera).
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
  v_n int := 0;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo' then
    raise exception 'cuenta no activa';
  end if;
  if p_fecha is null then
    raise exception 'fecha de salida hacia devolución obligatoria';
  end if;
  if p_operacion_impo_ids is null or array_length(p_operacion_impo_ids, 1) is null then
    raise exception 'no se indicaron operaciones';
  end if;

  foreach v_op in array p_operacion_impo_ids loop
    update crm.operaciones_impo
       set estado = 'en_transito_devolucion'
     where id = v_op
       and estado = 'en_planta';
    if found then
      v_n := v_n + 1;
      insert into crm.operacion_impo_eventos (operacion_impo_id, tipo_evento, fecha, usuario_id, detalle)
      values (v_op, 'salida_devolucion', p_fecha, v_perfil.usuario_id, '{}'::jsonb);
    end if;
  end loop;

  return jsonb_build_object('salidas', v_n);
end $fn$;

revoke all on function crm.crm_registrar_salida_devolucion_impo(uuid[], timestamptz) from public, anon;
grant execute on function crm.crm_registrar_salida_devolucion_impo(uuid[], timestamptz) to authenticated;

-- E.5 · crm_confirmar_devolucion_impo — en_transito_devolucion → cerrado
-- (CORTA EL RELOJ). Valida fecha >= retiro/arribo.
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
  if v_perfil.estado is distinct from 'activo' then
    raise exception 'cuenta no activa';
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

revoke all on function crm.crm_confirmar_devolucion_impo(uuid[], timestamptz) from public, anon;
grant execute on function crm.crm_confirmar_devolucion_impo(uuid[], timestamptz) to authenticated;

-- E.6 · crm_anular_operacion_impo — soft delete, supervisor+, motivo obligatorio.
create or replace function crm.crm_anular_operacion_impo(
  p_operacion_impo_id uuid,
  p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $fn$
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

  update crm.operaciones_impo
     set estado = 'anulada',
         anulada_motivo = p_motivo,
         anulada_por = v_perfil.usuario_id
   where id = p_operacion_impo_id
     and estado not in ('cerrado', 'anulada');
  if not found then
    raise exception 'la operación no está abierta (no se puede anular)';
  end if;
end $fn$;

revoke all on function crm.crm_anular_operacion_impo(uuid, text) from public, anon;
grant execute on function crm.crm_anular_operacion_impo(uuid, text) to authenticated;

-- Owner → crm_rpc_executor para las funciones DEFINER nuevas de esta migración
-- (crm_crear_orden_impo + las 5 RPCs de transición + crm_crear_incidencia,
-- que se recreó por DROP+CREATE y perdió su owner). Mismo procedimiento que
-- 025/028/029/030: el nuevo owner necesita CREATE en el schema para el alter
-- owner en Supabase; se concede temporal y se revoca después. El grant de
-- membresía (`grant crm_rpc_executor to current_user`) se OMITE — ya persiste
-- desde 025 (verificado con pg_auth_members antes de esta migración).
grant create on schema crm to crm_rpc_executor;
do $$
declare
  fn text;
  sigs text[] := array[
    'crm.crm_crear_orden_impo(jsonb)',
    'crm.crm_confirmar_retiro_terminal(jsonb)',
    'crm.crm_confirmar_ingreso_planta_impo(uuid[], timestamptz)',
    'crm.crm_registrar_salida_devolucion_impo(uuid[], timestamptz)',
    'crm.crm_confirmar_devolucion_impo(uuid[], timestamptz)',
    'crm.crm_anular_operacion_impo(uuid, text)',
    'crm.crm_crear_incidencia(uuid, text, timestamptz, text, text, numeric, text, jsonb, uuid)'
  ];
begin
  foreach fn in array sigs loop
    execute format('alter function %s owner to crm_rpc_executor', fn);
  end loop;
end $$;
revoke create on schema crm from crm_rpc_executor;

-- ═══ F · Extender crm_crear_tanda_retiro — guard cross (impo→expo) ═════════
-- Preserva TODO lo de 006/019/023/028/029/030/031 (owner crm_rpc_executor se
-- preserva por CREATE OR REPLACE). Único cambio: advisory lock + rechazo si
-- el contenedor tiene un ciclo de IMPORTACIÓN abierto, insertado justo
-- después de resolver/crear el contenedor y antes de intentar el INSERT en
-- operaciones (que sigue siendo el backstop del ciclo EXPO vía unique_violation).
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
  v_prefijo text;
  v_prefijo_restringido boolean;
  v_reforzado boolean;
  v_cont_id uuid;
  v_op_id uuid;
  v_creadas int := 0;
  v_rechazadas int := 0;
  v_incidencias_auto int := 0;
  v_prefijos_restringidos_detectados int := 0;
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
    v_prefijo := left(v_num, 4);
    select exists(
      select 1 from crm.prefijos_restringidos pr
       where pr.prefijo = v_prefijo and pr.activo
    ) into v_prefijo_restringido;
    begin
      select id into v_cont_id from crm.contenedores where numero_contenedor = v_num;
      if v_cont_id is null then
        v_cont_id := gen_random_uuid();
        insert into crm.contenedores (id, numero_contenedor, naviera_id, tipo, reforzado_estado)
        values (v_cont_id, v_num, v_naviera, v_tipo,
                case when v_reforzado then 'confirmado_reforzado'
                     else 'confirmado_no_reforzado' end);
      end if;

      -- Guard cross (032, D2 del plan M5): advisory lock por contenedor +
      -- rechazo si tiene un ciclo de IMPORTACIÓN abierto. El backstop del
      -- ciclo EXPO (ux_operacion_abierta) lo captura el unique_violation de
      -- abajo, sin cambios.
      perform pg_advisory_xact_lock(hashtext(v_cont_id::text));

      if exists (
        select 1 from crm.operaciones_impo oi
         where oi.contenedor_id = v_cont_id
           and oi.estado not in ('cerrado', 'anulada')
      ) then
        v_rechazadas := v_rechazadas + 1;
        v_resultados := v_resultados || jsonb_build_object(
          'numero', v_num, 'estado', 'rechazado', 'operacion_id', null,
          'motivo', 'ciclo_abierto_impo',
          'motivo_texto', format('%s tiene un ciclo de importación abierto — no se puede iniciar un retiro de exportación', v_num),
          'prefijo_restringido', v_prefijo_restringido);
        continue;
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

      if v_prefijo_restringido then
        insert into crm.incidencias
          (operacion_id, tipo, descripcion, fecha, usuario_id, numero_orden)
        values
          (v_op_id, 'prefijo_restringido',
           format('Prefijo %s restringido por Dow container screen (auto)', v_prefijo),
           v_fecha, v_perfil.usuario_id, null);
        v_incidencias_auto := v_incidencias_auto + 1;
        v_prefijos_restringidos_detectados := v_prefijos_restringidos_detectados + 1;
      end if;

      v_creadas := v_creadas + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'numero', v_num, 'estado', 'aceptado', 'operacion_id', v_op_id, 'motivo', null,
        'motivo_texto', null, 'prefijo_restringido', v_prefijo_restringido);
    exception
      when unique_violation then
        v_rechazadas := v_rechazadas + 1;
        v_resultados := v_resultados || jsonb_build_object(
          'numero', v_num, 'estado', 'rechazado', 'operacion_id', null,
          'motivo', 'ciclo_abierto',
          'motivo_texto', format('%s ya tiene un ciclo abierto — escalá a tu supervisor', v_num),
          'prefijo_restringido', v_prefijo_restringido);
      when check_violation then
        v_rechazadas := v_rechazadas + 1;
        v_resultados := v_resultados || jsonb_build_object(
          'numero', v_num, 'estado', 'rechazado', 'operacion_id', null,
          'motivo', 'numero_invalido',
          'motivo_texto', format('%s no es un número de contenedor válido (formato AAAA1234567)', v_num),
          'prefijo_restringido', v_prefijo_restringido);
    end;
  end loop;

  return jsonb_build_object('creadas', v_creadas, 'rechazadas', v_rechazadas,
                             'incidencias_auto', v_incidencias_auto,
                             'prefijos_restringidos_detectados', v_prefijos_restringidos_detectados,
                             'resultados', v_resultados);
end $function$;

-- CREATE OR REPLACE preserva owner (crm_rpc_executor) y grants existentes
-- (revoke all from public/anon + grant execute to authenticated de la 025) —
-- no hace falta repetirlos.

-- ═══ G · Motor destino — vista_alertas_impo + vista_kpi_costos_cerradas_impo ═
-- LATERAL a freetime_destino: naviera = ORDENES_IMPO.naviera_id (el reloj es
-- del contrato de la orden, NO del maestro del contenedor — un contenedor
-- puede reusarse bajo otra naviera). pais = plantas.pais_id (de la planta
-- destino), hub IS NULL, vigencia a fecha_arribo_terminal. Regla de relojes
-- según configuracion.impo_regla_relojes (modo 'auto' = D2 del plan M5).
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
      when x.dias_restantes_raw < 0 then 'rojo'
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
  m.costo_realizado
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
    end as costo_realizado
) m
where oi.estado = 'cerrado' and oi.fecha_devolucion is not null;

grant select on crm.vista_kpi_costos_cerradas_impo to authenticated;

-- ═══ H · vista_kpi_resumen_impo — espejo mínimo del resumen expo ═══════════
create or replace view crm.vista_kpi_resumen_impo
with (security_invoker = true) as
select
  coalesce(sum(cc.costo_realizado) filter (
    where date_trunc('month', (cc.fecha_devolucion at time zone 'America/Argentina/Buenos_Aires')::date)
        = date_trunc('month', crm.hoy_ar())
  ), 0)::numeric as costo_mes,

  coalesce(sum(cc.costo_realizado) filter (
    where date_trunc('year', (cc.fecha_devolucion at time zone 'America/Argentina/Buenos_Aires')::date)
        = date_trunc('year', crm.hoy_ar())
  ), 0)::numeric as costo_ytd,

  (select coalesce(sum(va.costo_proyectado), 0)::numeric from crm.vista_alertas_impo va)
    as costo_abierto_proyectado,

  (select count(*) from crm.vista_alertas_impo va where va.estado_semaforo = 'rojo')
    as en_riesgo_rojo,

  (select count(*) from crm.vista_alertas_impo va where va.estado_semaforo = 'amarillo')
    as en_riesgo_amarillo,

  (select count(*) from crm.vista_alertas_impo va)
    as abiertas_total
from crm.vista_kpi_costos_cerradas_impo cc;

grant select on crm.vista_kpi_resumen_impo to authenticated;

-- ═══ I · vista_stock_prefijos_restringidos — UNION expo + impo ═════════════
-- Columna `ambito` agregada AL FINAL (CREATE OR REPLACE VIEW admite agregar
-- columnas al final sin romper consumidores existentes). Verificado contra
-- crm-v2/src (solo lectura, sin tocarlo): los 2 consumers
-- (prefijos/page.tsx, alertas/page.tsx) usan .select() con lista EXPLÍCITA de
-- columnas, ninguno referencia `ambito` ni usa `select("*")` — 100% seguro.
create or replace view crm.vista_stock_prefijos_restringidos
with (security_invoker = true) as
select
  o.id                         as operacion_id,
  c.numero_contenedor,
  left(c.numero_contenedor, 4) as prefijo,
  pr.nota                      as nota_prefijo,
  n.nombre                     as naviera,
  p.nombre                     as planta,
  o.estado,
  o.estado_carga,
  o.fecha_retiro,
  'EXPO'::text                 as ambito
from crm.operaciones o
join crm.contenedores c on c.id = o.contenedor_id
join crm.navieras n     on n.id = c.naviera_id
left join crm.plantas p on p.id = o.planta_actual_id
join crm.prefijos_restringidos pr
  on pr.prefijo = left(c.numero_contenedor, 4) and pr.activo
where o.estado not in ('cerrado', 'anulada')

union all

select
  oi.id                         as operacion_id,
  c.numero_contenedor,
  left(c.numero_contenedor, 4)  as prefijo,
  pr.nota                       as nota_prefijo,
  n.nombre                      as naviera,
  p.nombre                      as planta,
  oi.estado,
  null::text                    as estado_carga,
  oi.fecha_retiro_terminal      as fecha_retiro,
  'IMPO'::text                  as ambito
from crm.operaciones_impo oi
join crm.contenedores c   on c.id = oi.contenedor_id
join crm.ordenes_impo ord on ord.id = oi.orden_id
join crm.navieras n       on n.id = ord.naviera_id
left join crm.plantas p   on p.id = ord.planta_destino_id
join crm.prefijos_restringidos pr
  on pr.prefijo = left(c.numero_contenedor, 4) and pr.activo
where oi.estado not in ('cerrado', 'anulada');

comment on view crm.vista_stock_prefijos_restringidos is
  'barrido retroactivo B6 (031) — UNION expo+impo desde la 032. `ambito` '
  '(EXPO|IMPO) agregada al final, columna trailing, sin romper select() '
  'explícitos existentes. security_invoker=true: hereda el scope por planta '
  'de operaciones_select / operaciones_impo_select.';

-- CREATE OR REPLACE VIEW preserva el ACL (grant select to authenticated de
-- la 031) — no hace falta repetirlo.

-- ═══ J · B8.2 — cerrar ventana vestigial de UPDATE en contenedores ═════════
-- Hallazgo AL VERIFICAR (no documentado en ninguna migración previa): pese a
-- que 004 solo otorgó `select, insert` y ninguna migración posterior otorgó
-- `update` explícito, `authenticated` TIENE hoy privilegio UPDATE real sobre
-- crm.contenedores (confirmado con information_schema.role_table_grants) —
-- mismo patrón fantasma en freetime_origin/usuarios/operacion_eventos/
-- navieras/plantas/configuracion/ayuda_contenido/depositos/paises/
-- prefijos_restringidos/vista_alertas (probablemente un default-ACL que
-- existió al crear el schema y luego se retiró sin revocar lo ya otorgado —
-- pg_default_acl hoy no tiene ninguna entrada para el schema `crm`). NO
-- explotable hoy: contenedores no tiene policy de UPDATE (RLS default-deny
-- ⇒ 0 filas), freetime_origin/usuarios/operacion_eventos tampoco tienen
-- policies de escritura, y las de navieras/plantas/configuracion/etc. exigen
-- rol admin/supervisor. Cerrar TODAS esas ventanas fantasma es una decisión
-- de mínimo privilegio más amplia que este bloque — FUERA DE ALCANCE de la
-- 032 (solo se pidió contenedores); flagueado en el reporte final para John.
revoke update on crm.contenedores from authenticated;

-- ═══ K · configuracion: impo_regla_relojes ══════════════════════════════════
insert into crm.configuracion (clave, valor)
values ('impo_regla_relojes', '{"modo":"auto"}'::jsonb)
on conflict (clave) do nothing;

-- ═══ L · refrescar cache de PostgREST ══════════════════════════════════════
notify pgrst, 'reload schema';
