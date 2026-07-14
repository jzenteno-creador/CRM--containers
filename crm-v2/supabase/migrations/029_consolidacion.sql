-- ═══════════════════════════════════════════════════════════════════════════
-- 029 · M5 — CONSOLIDACIÓN (llenos/vacíos): crm.productos, crm.consolidaciones,
-- operaciones.estado_carga, RPCs crm_consolidar/crm_desconsolidar, extensión
-- de crm_crear_tanda_retiro, vista_carga_actual.
--
-- Contexto de negocio: Dow usa contenedores en planta como depósito — se
-- consolida mercadería adentro (contenedor pasa a "lleno", productos
-- identificados por GMID + lotes) y eventualmente se desconsolida ("vacío").
--
-- Decisión D3 (John): esto es INFORMATIVO. NO selecciona tarifa, NO corta el
-- reloj de detention — el motor sigue usando regimen='vacios' hardcodeado en
-- vista_alertas/vista_kpi_*. Valor: stock + trazabilidad, nada más. Por eso
-- estado_carga vive en operaciones como columna de solo lectura para el motor
-- de costos (ninguna view del §10/§9 la referencia).
--
-- Patrón de escritura: mismo que 028 (bookings) — RPC-only, SECURITY DEFINER
-- owner=crm_rpc_executor (rol sin BYPASSRLS, ver 025). Ni productos ni
-- consolidaciones tienen policies de escritura ni grants para `authenticated`;
-- el único camino de escritura son las 3 RPCs nuevas + la extensión de
-- crm_crear_tanda_retiro (que ya corre con ese owner desde la 025).
--
-- Columnas legacy `crm.operaciones.producto`/`gmid` (paridad v1, texto libre):
-- quedan CONGELADAS — snapshot muerto, ninguna RPC/view de 029 las lee ni
-- escribe. El trigger guard_operaciones_campos (019) sigue bloqueando su
-- edición por operador; no se toca.
-- ═══════════════════════════════════════════════════════════════════════════

-- Re-asegurar membresía (idempotente, mismo motivo que 028: el ALTER OWNER de
-- las RPCs nuevas necesita que `current_user` sea miembro de crm_rpc_executor).
grant crm_rpc_executor to current_user;

-- ═══ A · crm.productos (catálogo GMID) ════════════════════════════════════
create table crm.productos (
  id          uuid primary key default gen_random_uuid(),
  gmid        text not null unique check (length(trim(gmid)) > 0),
  descripcion text not null check (length(trim(descripcion)) > 0),
  activo      boolean not null default true,
  creado_por  uuid references crm.usuarios(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_productos_updated
  before update on crm.productos
  for each row execute function crm.set_updated_at();

alter table crm.productos enable row level security;

-- Lectura: cualquier activo (maestro-like, §14.4 — catálogo Dow, independiente
-- de planta, igual que navieras/freetime/plantas/ayuda).
create policy productos_select on crm.productos
  for select to authenticated
  using ((select p.estado = 'activo' from crm.perfil() p));

-- Escritura: CERO policies/grants para `authenticated` (mismo patrón D4 de
-- 028). Único camino: crm_crear_producto (SECURITY DEFINER owner=executor).
create policy productos_insert_executor on crm.productos
  for insert to crm_rpc_executor
  with check (true);

grant select on crm.productos to authenticated;
grant select, insert on crm.productos to crm_rpc_executor;

comment on table crm.productos is
  'Catálogo de productos Dow (GMID) para consolidación (M5-029). RPC-only alta '
  '(crm_crear_producto); sin UPDATE — editar descripción requiere RPC nueva, '
  'no está en la lista sancionada de 029.';

-- ═══ B · crm.consolidaciones (líneas de carga, append-only + soft-close) ══
create table crm.consolidaciones (
  id                 uuid primary key default gen_random_uuid(),
  operacion_id       uuid not null references crm.operaciones(id),
  producto_id        uuid not null references crm.productos(id),
  cantidad_bolsas    integer not null check (cantidad_bolsas > 0),
  lote               text,
  vigente            boolean not null default true,
  registrado_por     uuid references crm.usuarios(id),
  desconsolidada_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index ix_consolidaciones_operacion_vigente
  on crm.consolidaciones (operacion_id)
  where vigente;

create trigger trg_consolidaciones_updated
  before update on crm.consolidaciones
  for each row execute function crm.set_updated_at();

alter table crm.consolidaciones enable row level security;

-- Lectura: activo + operación visible bajo SU PROPIA RLS. Mismo idioma que
-- `eventos_select` (005/028): el EXISTS contra crm.operaciones corre sujeto a
-- la RLS de esa tabla (executor sin BYPASSRLS ⇒ operador solo ve sus plantas),
-- así que consolidaciones queda planta-scopeada TRANSITIVAMENTE sin duplicar
-- la lógica de planta acá. Refuerzo sobre el pedido original ("SELECT perfil
-- activo") para cumplir §14.4 (una línea de carga es información de planta,
-- no un maestro global como productos).
create policy consolidaciones_select on crm.consolidaciones
  for select to authenticated
  using (
    (select p.estado = 'activo' from crm.perfil() p)
    and exists (select 1 from crm.operaciones o where o.id = consolidaciones.operacion_id)
  );

create policy consolidaciones_insert_executor on crm.consolidaciones
  for insert to crm_rpc_executor
  with check (true);

create policy consolidaciones_update_executor on crm.consolidaciones
  for update to crm_rpc_executor
  using (true)
  with check (true);

grant select on crm.consolidaciones to authenticated;
grant select, insert, update on crm.consolidaciones to crm_rpc_executor;

comment on table crm.consolidaciones is
  'Líneas de carga por operación (M5-029). Append-only con soft-close: '
  'desconsolidar marca vigente=false + desconsolidada_at, nunca DELETE. '
  'RPC-only (crm_consolidar/crm_desconsolidar).';

-- ═══ C · crm.operaciones.estado_carga (D3 — informativo) ══════════════════
alter table crm.operaciones
  add column estado_carga text not null default 'vacio'
    check (estado_carga in ('vacio', 'lleno'));

comment on column crm.operaciones.estado_carga is
  'informativo (D3, 029): NO selecciona tarifa ni corta el reloj de detention — '
  'el motor de costos sigue usando regimen=''vacios'' hardcodeado en '
  'vista_alertas/vista_kpi_*. Solo trazabilidad de stock (lleno/vacío), '
  'mutado por crm_consolidar/crm_desconsolidar y opcionalmente al alta '
  '(crm_crear_tanda_retiro header.estado_carga).';

comment on column crm.operaciones.producto is
  'CONGELADO (029): superseded por crm.productos/consolidaciones. Snapshot '
  'muerto de paridad v1 — ninguna RPC/view de 029 lo lee ni escribe.';

comment on column crm.operaciones.gmid is
  'CONGELADO (029): superseded por crm.productos/consolidaciones. Snapshot '
  'muerto de paridad v1 — ninguna RPC/view de 029 lo lee ni escribe.';

-- ═══ D · RPCs nuevas (SECURITY DEFINER owner crm_rpc_executor) ═══════════

-- D.1 crm_crear_producto — alta, rol operador+. Normaliza upper(trim(gmid)).
create or replace function crm.crm_crear_producto(
  p_gmid        text,
  p_descripcion text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_perfil      record;
  v_gmid        text := upper(trim(p_gmid));
  v_descripcion text := trim(p_descripcion);
  v_id          uuid;
  v_existente   record;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo'
     or v_perfil.rol is null
     or v_perfil.rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'crear producto requiere operador, supervisor o administrador';
  end if;

  if v_gmid is null or length(v_gmid) = 0 then
    raise exception 'el GMID es obligatorio';
  end if;
  if v_descripcion is null or length(v_descripcion) = 0 then
    raise exception 'la descripción es obligatoria';
  end if;

  insert into crm.productos (gmid, descripcion, creado_por)
  values (v_gmid, v_descripcion, v_perfil.usuario_id)
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    select id, descripcion, activo into v_existente from crm.productos where gmid = v_gmid;
    raise exception 'producto_duplicado'
      using hint = format('Ya existe el producto GMID %s (id=%s, descripcion=%s, activo=%s)',
                           v_gmid, v_existente.id, v_existente.descripcion, v_existente.activo);
end $fn$;

revoke all on function crm.crm_crear_producto(text, text) from public, anon;
grant execute on function crm.crm_crear_producto(text, text) to authenticated;

-- D.2 crm_consolidar — agrega N líneas a una operación en_planta. Incremental:
-- si ya estaba llena, las líneas nuevas se suman; si estaba vacía, pasa a
-- lleno. Todo-o-nada: valida TODAS las líneas antes de escribir nada.
create or replace function crm.crm_consolidar(
  p_operacion_id uuid,
  p_lineas       jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_perfil          record;
  v_linea            jsonb;
  v_producto_id      uuid;
  v_cantidad         integer;
  v_lote             text;
  v_gmid             text;
  v_detalle          jsonb := '[]'::jsonb;
  v_n_lineas         integer := 0;
  v_total_vigentes   integer;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo'
     or v_perfil.rol is null
     or v_perfil.rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'consolidar requiere operador, supervisor o administrador';
  end if;

  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'la consolidación no tiene líneas';
  end if;

  -- Pasada de validación (todo-o-nada): ninguna escritura hasta que las N
  -- líneas sean válidas.
  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_producto_id := nullif(v_linea ->> 'producto_id', '')::uuid;
    v_cantidad    := nullif(v_linea ->> 'cantidad_bolsas', '')::integer;
    if v_producto_id is null then
      raise exception 'línea sin producto_id';
    end if;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'cantidad_bolsas inválida para el producto %', v_producto_id;
    end if;
    if not exists (select 1 from crm.productos pr where pr.id = v_producto_id and pr.activo) then
      raise exception 'producto inexistente o inactivo: %', v_producto_id;
    end if;
  end loop;

  -- Anti-carrera + validación de estado en un solo UPDATE (patrón 028): la
  -- RLS de operaciones_update aplica acá (executor sin BYPASSRLS) — un
  -- operador de otra planta o una operación fuera de en_planta ⇒ 0 filas.
  update crm.operaciones
     set estado_carga = 'lleno'
   where id = p_operacion_id
     and estado = 'en_planta';
  if not found then
    raise exception 'la operación no existe, no está a tu alcance, o no está en planta';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_producto_id := (v_linea ->> 'producto_id')::uuid;
    v_cantidad    := (v_linea ->> 'cantidad_bolsas')::integer;
    v_lote        := nullif(trim(v_linea ->> 'lote'), '');

    insert into crm.consolidaciones (operacion_id, producto_id, cantidad_bolsas, lote, registrado_por)
    values (p_operacion_id, v_producto_id, v_cantidad, v_lote, v_perfil.usuario_id);

    select gmid into v_gmid from crm.productos where id = v_producto_id;
    v_detalle := v_detalle || jsonb_build_object(
      'gmid', v_gmid, 'cantidad_bolsas', v_cantidad, 'lote', v_lote);
    v_n_lineas := v_n_lineas + 1;
  end loop;

  select count(*) into v_total_vigentes
    from crm.consolidaciones
   where operacion_id = p_operacion_id and vigente;

  insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
  values (p_operacion_id, 'carga', now(), v_perfil.usuario_id,
          jsonb_build_object('accion', 'consolidar', 'lineas', v_detalle,
                              'total_lineas_vigentes', v_total_vigentes));

  return jsonb_build_object(
    'operacion_id', p_operacion_id, 'estado_carga', 'lleno',
    'lineas_agregadas', v_n_lineas, 'total_lineas_vigentes', v_total_vigentes);
end $fn$;

revoke all on function crm.crm_consolidar(uuid, jsonb) from public, anon;
grant execute on function crm.crm_consolidar(uuid, jsonb) to authenticated;

-- D.3 crm_desconsolidar — cierra TODAS las líneas vigentes de la operación
-- (soft-close) y la marca vacía. Exige en_planta + estado_carga='lleno'.
create or replace function crm.crm_desconsolidar(
  p_operacion_id uuid,
  p_motivo       text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_perfil   record;
  v_cerradas integer;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo'
     or v_perfil.rol is null
     or v_perfil.rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'desconsolidar requiere operador, supervisor o administrador';
  end if;

  update crm.operaciones
     set estado_carga = 'vacio'
   where id = p_operacion_id
     and estado = 'en_planta'
     and estado_carga = 'lleno';
  if not found then
    raise exception 'la operación no existe, no está a tu alcance, no está en planta, o ya está vacía';
  end if;

  update crm.consolidaciones
     set vigente = false,
         desconsolidada_at = now()
   where operacion_id = p_operacion_id
     and vigente;
  get diagnostics v_cerradas = row_count;

  insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
  values (p_operacion_id, 'carga', now(), v_perfil.usuario_id,
          jsonb_build_object('accion', 'desconsolidar', 'motivo', p_motivo,
                              'lineas_cerradas', v_cerradas));

  return jsonb_build_object(
    'operacion_id', p_operacion_id, 'estado_carga', 'vacio', 'lineas_cerradas', v_cerradas);
end $fn$;

revoke all on function crm.crm_desconsolidar(uuid, text) from public, anon;
grant execute on function crm.crm_desconsolidar(uuid, text) to authenticated;

-- Owner → crm_rpc_executor para las 3 RPCs nuevas (mismo procedimiento que
-- 025/028: el nuevo owner necesita CREATE en el schema para el alter owner en
-- Supabase; se concede temporal y se revoca después).
grant create on schema crm to crm_rpc_executor;
do $$
declare
  fn text;
  sigs text[] := array[
    'crm.crm_crear_producto(text, text)',
    'crm.crm_consolidar(uuid, jsonb)',
    'crm.crm_desconsolidar(uuid, text)'
  ];
begin
  foreach fn in array sigs loop
    execute format('alter function %s owner to crm_rpc_executor', fn);
  end loop;
end $$;
revoke create on schema crm from crm_rpc_executor;

-- ═══ E · Extender crm_crear_tanda_retiro (preserva TODO lo de la 028; owner
-- crm_rpc_executor se preserva al hacer CREATE OR REPLACE — mismo patrón
-- verificado en 028) ════════════════════════════════════════════════════
-- Header acepta estado_carga opcional ('vacio' default | 'lleno' — caso raro:
-- movimiento entre plantas de contenedores ya llenos). Se aplica a TODAS las
-- operaciones de la tanda. Sin líneas de producto en el alta (D3: se
-- consolidan después desde la ficha si hace falta).
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

-- ═══ F · vista_carga_actual (utilitaria, security_invoker) ════════════════
-- Por operación con líneas vigentes: array agregado de {gmid, descripcion,
-- cantidad_bolsas, lote} + total_bolsas. Usada por ficha/listados sin N+1.
-- Planta-scopeada transitivamente: security_invoker=true ⇒ agrega sobre filas
-- ya filtradas por la RLS de crm.consolidaciones/crm.productos del caller.
create or replace view crm.vista_carga_actual
with (security_invoker = true) as
select
  c.operacion_id,
  jsonb_agg(
    jsonb_build_object(
      'gmid', p.gmid,
      'descripcion', p.descripcion,
      'cantidad_bolsas', c.cantidad_bolsas,
      'lote', c.lote
    )
    order by p.gmid, c.lote nulls first
  ) as lineas,
  sum(c.cantidad_bolsas)::integer as total_bolsas
from crm.consolidaciones c
join crm.productos p on p.id = c.producto_id
where c.vigente
group by c.operacion_id;

grant select on crm.vista_carga_actual to authenticated;

comment on view crm.vista_carga_actual is
  'Carga vigente por operación (M5-029), security_invoker=true. Solo filas '
  'con al menos una línea vigente — el caller consume con fallback a "sin carga".';

-- ═══ G · refrescar cache de PostgREST ══════════════════════════════════════
notify pgrst, 'reload schema';
