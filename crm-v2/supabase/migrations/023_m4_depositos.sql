-- ═══════════════════════════════════════════════════════════════════════════
-- 023 · M4 — DEPÓSITOS: catálogo de dónde se retira el contenedor
-- ═══════════════════════════════════════════════════════════════════════════
-- Objetivo (John): estandarizar el dato de retiro SIN frenar la operación. El
-- operario puede crear un depósito inline al cargar la tanda (rol operador+),
-- con pre-check fuzzy para no fragmentar (Exolgan/EXOLGAN/Exolgan S.A.).
--
-- Seed derivado del histórico (Excel, columna RETIRO DE): 12 valores crudos →
-- 10 canónicos. Fusiones confiables reportadas:
--   'EXOLGAN' + 'TERMINAL EXOLGAN'      → Exolgan
--   'TERMINAL 4' + 'TERMINAL 4/ABBOTT'  → Terminal 4  (/ABBOTT = planta, 1 fila)
-- NO fusionados (decisión de John vía Admin): Gamma / Gamma Logística / Gamma
--   Mujica — podrían ser sucursales o depósitos físicos distintos; no se inventa.
--
-- retiro_de (text) queda como snapshot CONGELADO; la verdad pasa a retiro_de_id.
-- crm_crear_tanda_retiro se vuelve retrocompatible: acepta retiro_de_id (nuevo)
-- o retiro_de text (front viejo) — degrada bien durante el deploy.
--
-- ⚠️ NO APLICAR sin GO de John. DDL sobre operaciones (money path adyacente).
-- ⚠️ Prod tiene filas de smoke/test cuyo retiro_de NO matchea el catálogo real:
--    el backfill las deja retiro_de_id = NULL y las REPORTA (no falla). El reset
--    demo (022) las limpia. La carga masiva del histórico (F2) resolverá el FK
--    por lookup al importar los 2.804.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ A · tabla + trigram para el fuzzy ════════════════════════════════════
create table crm.depositos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique check (length(trim(nombre)) > 0),
  codigo     text,
  activo     boolean not null default true,
  creado_por uuid references crm.usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_depositos_nombre_trgm on crm.depositos using gin (nombre gin_trgm_ops);

create trigger trg_depositos_updated
  before update on crm.depositos
  for each row execute function crm.set_updated_at();

alter table crm.depositos enable row level security;

-- lectura: cualquier activo. Escritura directa: admin (CRUD en Admin, patrón
-- navieras/plantas). Alta inline del operador: vía crm_crear_deposito (DEFINER).
create policy depositos_select on crm.depositos
  for select to authenticated
  using ((select p.estado = 'activo' from crm.perfil() p));

create policy depositos_insert_admin on crm.depositos
  for insert to authenticated
  with check ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p));

create policy depositos_update_admin on crm.depositos
  for update to authenticated
  using      ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p))
  with check ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p));

grant select, insert, update on crm.depositos to authenticated;  -- sin delete: baja lógica

-- ═══ B · seed canónico (10) ═══════════════════════════════════════════════
insert into crm.depositos (nombre) values
  ('PTN'), ('Terminal 4'), ('Defibe'), ('Exolgan'), ('Huxley'),
  ('Gamma'), ('Gamma Logística'), ('Gamma Mujica'), ('TRP'), ('Hiperbaires')
on conflict (nombre) do nothing;

-- ═══ C · FK en operaciones + backfill best-effort con reporte ═════════════
alter table crm.operaciones add column retiro_de_id uuid references crm.depositos(id);
create index ix_operaciones_retiro_de on crm.operaciones (retiro_de_id);

-- mapeo crudo→canónico del histórico (las 12 variantes del Excel). El backfill
-- de PROD solo afecta las pocas filas de smoke/test; las que no matchean quedan
-- NULL y se reportan (no se inventa un depósito para 'HIST'/'TEST-...').
do $$
declare
  v_map jsonb := jsonb_build_object(
    'PTN','PTN', 'TERMINAL 4','Terminal 4', 'TERMINAL 4/ABBOTT','Terminal 4',
    'DEFIBE','Defibe', 'EXOLGAN','Exolgan', 'TERMINAL EXOLGAN','Exolgan',
    'HUXLEY','Huxley', 'GAMMA','Gamma', 'GAMMA LOGISTICA','Gamma Logística',
    'GAMMA MUJICA','Gamma Mujica', 'TRP','TRP', 'HIPERBAIRES','Hiperbaires');
  v_sin_match record;
  v_lista text := '';
begin
  update crm.operaciones o
     set retiro_de_id = d.id
    from crm.depositos d
   where d.nombre = (v_map ->> upper(trim(o.retiro_de)))
     and o.retiro_de_id is null;

  -- reporte de no-matcheados (no falla: pueden ser filas de smoke/test)
  for v_sin_match in
    select distinct upper(trim(retiro_de)) as v, count(*) as n
      from crm.operaciones
     where retiro_de_id is null and retiro_de is not null
     group by 1
  loop
    v_lista := v_lista || format('  %s (%s filas)%s', v_sin_match.v, v_sin_match.n, chr(10));
  end loop;
  if v_lista <> '' then
    raise notice 'DEPÓSITOS · filas con retiro_de sin depósito (retiro_de_id=NULL, revisar/limpiar):%s%s', chr(10), v_lista;
  end if;
end $$;

comment on column crm.operaciones.retiro_de is
  'CONGELADO (023): snapshot texto. La verdad pasa a retiro_de_id → crm.depositos.';

-- ═══ D · RPCs ═════════════════════════════════════════════════════════════

-- D.1 depósitos parecidos (fuzzy) — para el pre-check de la UI antes de crear.
-- La lógica de similitud vive en la DB (el front no calcula).
-- pg_trgm vive en el schema `extensions` en Supabase (verificado en prod), no en
-- pg_catalog: con search_path='' hay que calificar similarity()/% o el CREATE
-- FUNCTION falla al validar el cuerpo (defecto que cazó el gate del VERIFIER).
create or replace function crm.crm_depositos_similares(p_nombre text)
returns table (id uuid, nombre text, activo boolean, similitud real)
language sql stable
set search_path to ''
as $$
  select d.id, d.nombre, d.activo, extensions.similarity(d.nombre, p_nombre) as similitud
    from crm.depositos d
   where d.nombre operator(extensions.%) p_nombre     -- umbral trigram default (0.3)
   order by extensions.similarity(d.nombre, p_nombre) desc
   limit 5
$$;

revoke execute on function crm.crm_depositos_similares(text) from public, anon;
grant  execute on function crm.crm_depositos_similares(text) to authenticated;

-- D.2 crear depósito inline — rol OPERADOR+ (el punto: no frenar la operación).
-- El pre-check fuzzy es responsabilidad de la UI (D.1); acá el unique enforcea
-- el duplicado EXACTO. Registra quién lo creó.
create or replace function crm.crm_crear_deposito(p_nombre text, p_codigo text default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_caller record;
  v_id uuid;
begin
  select * into v_caller from crm.perfil();
  -- `rol is null` explícito: NOT IN con NULL evalúa a NULL (no true) y el IF de
  -- plpgsql lo trata como falso → dejaría pasar un rol nulo (robustez, cazado por el gate).
  if v_caller.estado is distinct from 'activo'
     or v_caller.rol is null
     or v_caller.rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'cuenta no activa';
  end if;
  if p_nombre is null or length(trim(p_nombre)) = 0 then
    raise exception 'el nombre del depósito es obligatorio';
  end if;

  insert into crm.depositos (nombre, codigo, creado_por)
  values (trim(p_nombre), nullif(trim(p_codigo), ''), v_caller.usuario_id)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'ya existe un depósito con el nombre "%"', trim(p_nombre);
end $fn$;

revoke execute on function crm.crm_crear_deposito(text, text) from public, anon;
grant  execute on function crm.crm_crear_deposito(text, text) to authenticated;

-- D.3 fusionar depósitos (admin) — repunta operaciones del origen al destino y
-- desactiva el origen. Toca operaciones (plata) → SOLO por esta RPC, nunca UPDATE
-- crudo desde el front. Resuelve los duplicados de la semilla (ej. los Gamma).
create or replace function crm.crm_fusionar_depositos(p_origen uuid, p_destino uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_caller record;
  v_n int;
  v_o record; v_d record;
begin
  select * into v_caller from crm.perfil();
  if v_caller.estado is distinct from 'activo' or v_caller.rol <> 'administrador' then
    raise exception 'fusionar depósitos requiere administrador';
  end if;
  if p_origen = p_destino then
    raise exception 'origen y destino no pueden ser el mismo depósito';
  end if;
  select * into v_o from crm.depositos where id = p_origen;
  select * into v_d from crm.depositos where id = p_destino;
  if v_o.id is null or v_d.id is null then
    raise exception 'depósito origen o destino inexistente';
  end if;
  if not v_d.activo then
    raise exception 'el destino de la fusión debe estar activo';
  end if;

  update crm.operaciones set retiro_de_id = p_destino, retiro_de = v_d.nombre
   where retiro_de_id = p_origen;
  get diagnostics v_n = row_count;

  update crm.depositos set activo = false where id = p_origen;

  return jsonb_build_object('ok', true, 'operaciones_repunteadas', v_n,
                           'origen', v_o.nombre, 'destino', v_d.nombre);
end $fn$;

revoke execute on function crm.crm_fusionar_depositos(uuid, uuid) from public, anon;
grant  execute on function crm.crm_fusionar_depositos(uuid, uuid) to authenticated;

-- ═══ E · crm_crear_tanda_retiro: acepta retiro_de_id (retrocompatible) ════
-- Nuevo: header.retiro_de_id (uuid del depósito). Si viene, la RPC resuelve el
-- nombre y setea AMBOS (retiro_de_id + retiro_de texto para el snapshot). Si no
-- viene pero sí el retiro_de texto (front viejo pre-deploy), mantiene el
-- comportamiento anterior. Todo lo demás (savepoints, parcial) INTACTO.
create or replace function crm.crm_crear_tanda_retiro(p jsonb)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_perfil record;
  v_naviera uuid := (p -> 'header' ->> 'naviera_id')::uuid;
  v_tipo text := p -> 'header' ->> 'tipo';
  v_retiro_de_id uuid := nullif(p -> 'header' ->> 'retiro_de_id', '')::uuid;
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
  v_rechazadas int := 0;
  v_resultados jsonb := '[]'::jsonb;
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo' then
    raise exception 'cuenta no activa';
  end if;

  -- resolver depósito: si viene el id, es la fuente de verdad y deriva el texto.
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
      insert into crm.operaciones (id, contenedor_id, retiro_de, retiro_de_id, booking_retiro, fecha_retiro, estado)
      values (v_op_id, v_cont_id, v_retiro_de, v_retiro_de_id, v_booking, v_fecha,
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

revoke execute on function crm.crm_crear_tanda_retiro(jsonb) from public, anon;
grant  execute on function crm.crm_crear_tanda_retiro(jsonb) to authenticated;
