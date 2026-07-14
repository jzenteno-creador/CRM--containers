-- ═══════════════════════════════════════════════════════════════════════════
-- 031 · M5/B — PREFIJOS RESTRINGIDOS (Dow container screen) + barrido
-- retroactivo + ayuda de bookings/prefijos (GO de John, 2026-07-14)
--
-- Contexto de negocio: Dow publica un "container screen" — prefijos de 4
-- letras que NO deben usarse (armadores sancionados). Omar lo actualiza desde
-- la intranet de Dow ~julio y diciembre. Pedido explícito de John:
--   1. Tabla administrable (crm.prefijos_restringidos).
--   2. Validación al ingreso expo/impo: warning FUERTE, NO bloqueo duro — el
--      contenedor puede ya estar retirado y frenarlo en la DB no ayuda.
--   3. BARRIDO RETROACTIVO: un contenedor ya cargado en planta puede quedar
--      en infracción si su prefijo pasa a restringido DESPUÉS del retiro, sin
--      que nadie lo note. `vista_stock_prefijos_restringidos` lo resuelve
--      como vista derivada (siempre actual, sin snapshot que se pudra).
--
-- ⚠️ DESVÍO DOCUMENTADO (marcar FUERTE al orquestador/John): el punto 3 del
-- prompt original describe "escritura directa admin-only" como default de la
-- letra D4, pero John pidió EN LA MISMA conversación que la solapa de
-- prefijos la opere Omar — que es supervisor, no admin. El plan M5 §7 ya
-- resuelve esta tensión con default supervisor+ (mismo criterio que
-- crm.depositos.crm_crear_deposito, que es operador+, y crm.navieras, que ya
-- da INSERT/UPDATE directo a `authenticated` con policy... pero acá restringido
-- a supervisor+ porque es una lista de compliance, no un catálogo abierto).
-- Esta migración habilita INSERT/UPDATE directo a supervisor+ (no solo admin).
-- Si John prefiere admin-only estricto, es un one-liner: cambiar el `in
-- ('supervisor','administrador')` de las dos policies de abajo a
-- `= 'administrador'`.
--
-- Patrón: mismo que 023/025/028/029/030. No se crean funciones SECURITY
-- DEFINER nuevas en esta migración (crm_crear_tanda_retiro se extiende vía
-- CREATE OR REPLACE, que preserva owner=crm_rpc_executor automáticamente —
-- no hace falta ALTER OWNER ni el grant de membresía).
-- ⚠️ NO APLICAR sin GO de John. DDL sobre operaciones (money path adyacente,
-- vía la extensión de crm_crear_tanda_retiro).
-- ═══════════════════════════════════════════════════════════════════════════

-- Nota de replay: esta migración NO crea funciones SECURITY DEFINER nuevas
-- (solo CREATE OR REPLACE sobre una función existente, que preserva su owner
-- automáticamente), así que el grant de membresía de 025 no hace falta acá.
-- Se deja comentado el patrón por si algún día esta migración se re-aplica
-- sola sobre una DB fresca donde esa membresía todavía no exista:
-- grant crm_rpc_executor to current_user;

-- ═══ 1 · crm.prefijos_restringidos ═════════════════════════════════════════

create table crm.prefijos_restringidos (
  id         uuid primary key default gen_random_uuid(),
  prefijo    text not null unique check (prefijo ~ '^[A-Z]{4}$'),
  activo     boolean not null default true,
  nota       text,                                    -- fuente/motivo
  creado_por uuid references crm.usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table crm.prefijos_restringidos is
  'Dow container screen (§ D4, John 2026-07-14): prefijos de 4 letras que NO '
  'deben usarse. activo=false = retirado del listado (soft, se conserva '
  'histórico). Consumida por crm_crear_tanda_retiro (auto-incidencia) y por '
  'crm.vista_stock_prefijos_restringidos (barrido retroactivo).';

create trigger trg_prefijos_restringidos_updated
  before update on crm.prefijos_restringidos
  for each row execute function crm.set_updated_at();

alter table crm.prefijos_restringidos enable row level security;

create policy prefijos_restringidos_select on crm.prefijos_restringidos
  for select to authenticated
  using ((select p.estado = 'activo' from crm.perfil() p));

-- DESVÍO DOCUMENTADO (ver cabecera): supervisor+ en vez de admin-only estricto
-- de la letra D4 — John pidió que la opere Omar (supervisor).
create policy prefijos_restringidos_insert on crm.prefijos_restringidos
  for insert to authenticated
  with check ((select p.estado = 'activo' and p.rol in ('supervisor', 'administrador')
                 from crm.perfil() p));

create policy prefijos_restringidos_update on crm.prefijos_restringidos
  for update to authenticated
  using      ((select p.estado = 'activo' and p.rol in ('supervisor', 'administrador')
                 from crm.perfil() p))
  with check ((select p.estado = 'activo' and p.rol in ('supervisor', 'administrador')
                 from crm.perfil() p));

-- Sin DELETE: baja lógica vía activo=false (soft delete, §4).
grant select, insert, update on crm.prefijos_restringidos to authenticated;

-- ═══ 2 · Seed desde detention.prefijos_restringidos (37 filas legacy) ══════
-- Lectura de referencia de v1 permitida (§21); escritura SOLO en crm.
-- Estructura legacy real (verificada, db/schema/02_tables.sql):
--   prefijo text PK, armador text NOT NULL,
--   estado text default 'vigente' check in ('vigente','retirado_de_lista'),
--   nota text, created_at timestamptz.
-- Mapeo: activo = (estado='vigente'). nota se ENRIQUECE con el armador (la
-- columna crm.prefijos_restringidos.nota es "fuente/motivo" — el armador ES
-- el motivo real de la restricción Dow, perderlo sería tirar la info más
-- útil de la fila); cuando el legacy trae nota propia (siempre es el motivo
-- de baja "Fuera del listado restringido desde ...") se concatena.
-- Filtro regex ^[A-Z]{4}$ tras upper/trim: las 37 filas legacy ya vienen en
-- ese formato (verificado por muestreo completo antes de escribir esto) —
-- se espera 0 exclusiones; el ON CONFLICT protege de duplicados si se
-- re-corre.
insert into crm.prefijos_restringidos (prefijo, activo, nota)
select
  upper(trim(lp.prefijo)),
  (lp.estado = 'vigente'),
  'Armador: ' || lp.armador ||
    case when lp.nota is not null and length(trim(lp.nota)) > 0
         then ' — ' || lp.nota
         else ' — Migrado de v1 (2026-07-14)'
    end
from detention.prefijos_restringidos lp
where upper(trim(lp.prefijo)) ~ '^[A-Z]{4}$'
on conflict (prefijo) do nothing;

-- ═══ 3 · vista_stock_prefijos_restringidos — EL BARRIDO RETROACTIVO ════════
-- Derivada, siempre actual: no hay snapshot que se desactualice. Si un
-- prefijo pasa a activo=true HOY, todo contenedor ya en planta con ese
-- prefijo aparece acá sin ningún job de mantenimiento.
create view crm.vista_stock_prefijos_restringidos
with (security_invoker = true) as
select
  o.id                        as operacion_id,
  c.numero_contenedor,
  left(c.numero_contenedor, 4) as prefijo,
  pr.nota                     as nota_prefijo,
  n.nombre                    as naviera,
  p.nombre                    as planta,
  o.estado,
  o.estado_carga,
  o.fecha_retiro
from crm.operaciones o
join crm.contenedores c on c.id = o.contenedor_id
join crm.navieras n     on n.id = c.naviera_id
left join crm.plantas p on p.id = o.planta_actual_id
join crm.prefijos_restringidos pr
  on pr.prefijo = left(c.numero_contenedor, 4) and pr.activo
where o.estado not in ('cerrado', 'anulada');

comment on view crm.vista_stock_prefijos_restringidos is
  'barrido retroactivo B6 — derivada, siempre actual; la 032 (impo) hará UNION '
  'con operaciones_impo. security_invoker=true: hereda el scope por planta de '
  'operaciones_select (operador ve su planta, supervisor/admin ven todas).';

grant select on crm.vista_stock_prefijos_restringidos to authenticated;

-- Índice de apoyo: EVALUADO y descartado a este volumen. El join usa
-- left(numero_contenedor,4) sin índice funcional, pero el driving set es
-- crm.operaciones filtrado por estado NOT IN ('cerrado','anulada') — hoy
-- 13 filas (verificado), realista 14-100 en producción real. Un scan de ese
-- tamaño contra 37 prefijos es sub-milisegundo. Si el volumen de operaciones
-- abiertas crece a miles, agregar:
--   create index ix_contenedores_prefijo on crm.contenedores (left(numero_contenedor, 4));
-- (no se agrega ahora — YAGNI a este volumen, documentado para revisar en M8/KPI).

-- ═══ 4 · Extender crm_crear_tanda_retiro (preserva TODO lo de 006/019/023/
-- 028/029/030 — owner crm_rpc_executor se preserva automáticamente por
-- CREATE OR REPLACE, mismo patrón verificado en 028/029/030) ═══════════════
-- Por cada contenedor cuyo prefijo esté en prefijos_restringidos activos:
-- la operación se crea IGUAL (warning, no bloqueo duro — el contenedor puede
-- ya estar retirado) + auto-incidencia tipo='prefijo_restringido' (mismo
-- patrón que la auto-incidencia 'no_reforzado' de la 030: INSERT directo,
-- no vía crm_crear_incidencia, porque esa RPC exige numero_orden que acá no
-- aplica — es AUTO). El trigger trg_incidencia_evt inserta el evento de
-- timeline igual que cualquier otra alta, sin duplicar código acá.
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

-- ═══ 5 · Ayuda: destrabar 'bookings' + 'prefijos' y aplicar el seed de M5B3 ═
-- El seed crm-v2/supabase/seeds-ayuda/m5b3_bookings.sql (ya escrito por el
-- bloque B3 de UI) quedó bloqueado esperando este ALTER — se aplica UNA sola
-- vez acá, coherente, sin duplicar el ALTER que el propio archivo documenta
-- en su cabecera (ese ALTER está comentado en el archivo, no ejecutable).
alter table crm.ayuda_contenido drop constraint ayuda_contenido_seccion_check;
alter table crm.ayuda_contenido add constraint ayuda_contenido_seccion_check
  check (seccion in ('ingreso', 'egreso', 'contenedores', 'alertas', 'incidencias',
                      'admin', 'dashboard', 'faq', 'bookings', 'prefijos'));

-- ── contenido de crm-v2/supabase/seeds-ayuda/m5b3_bookings.sql (íntegro) ───

-- ── sección: bookings ────────────────────────────────────────────────────────
delete from crm.ayuda_contenido where seccion = 'bookings' and nivel = 'seccion';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('bookings', '¿Qué es la solapa Bookings?',
   E'Los retiros de exportación se cargan contra un **booking** de la naviera: un cupo con **ETD** (fecha de zarpe) que ocupa lugar en un buque. La solapa **Bookings** muestra, para cada booking de retiro activo, cuántos contenedores todavía están **en planta** sin embarcar y qué tan cerca está su ETD — con semáforo.\n\nEsto reemplaza el control manual que se hacía a mano cada viernes: si el ETD se acerca y quedan contenedores en planta, hay que **rolear** el booking (mismo booking, nuevo ETD/buque) o **reasignar** esos contenedores a otro booking con más margen.',
   1),

  ('bookings', 'Cómo leer el semáforo',
   E'Cada fila tiene un semáforo de **cuatro** estados, sobre el booking completo (no sobre un contenedor individual):\n\n- 🔴 **Vencido** — el ETD ya pasó y todavía quedan contenedores en planta sin embarcar: hay que actuar ya (rolear o reasignar).\n- 🟡 **Por vencer** — quedan pocos días para el ETD (umbral configurable) y hay contenedores en planta.\n- 🟢 **En plazo** — hay contenedores en planta pero el ETD todavía está lejos.\n- ⚪ **Sin pendientes** — no hay contenedores en planta para este booking (ya se embarcaron todos, o todavía no llegó ninguno): no hace falta ninguna acción.\n\nLa tabla ordena por **días a ETD**, con lo más urgente arriba.',
   2),

  ('bookings', 'Rolear un booking',
   E'**Rolear** es cuando la naviera cambia el ETD (y a veces el buque) de un booking que ya existe, manteniendo el mismo número.\n\n1. Tocá **Rolear** en la fila del booking.\n2. Cargá el **nuevo ETD** (obligatorio) y, si cambió, el **nuevo buque**.\n3. El **motivo** es opcional, pero queda registrado en el historial de cada operación abierta que cuelga de ese booking.\n4. Al confirmar, el sistema anota el roleo en el historial de cada contenedor todavía en planta con ese booking — nadie pierde trazabilidad de por qué cambió la fecha.',
   3),

  ('bookings', 'Reasignar contenedores a otro booking',
   E'**Reasignar** mueve contenedores de un booking a otro — típico cuando un booking se va a vencer y conviene pasar sus contenedores a uno con más margen.\n\n1. Tocá **Reasignar** en la fila del booking de origen.\n2. Tildá los contenedores que querés mover (los que están en planta, colgados de ese booking).\n3. Elegí el **booking destino** — tiene que ser un booking de retiro activo; si no existe todavía, lo creás ahí mismo con su ETD.\n4. Elegí el **motivo** (roleo de naviera, corrección u otro) y, si hace falta, un detalle.\n5. Confirmá: cada contenedor reasignado queda registrado en su historial con el booking anterior y el nuevo.\n\nSi algún contenedor ya no está disponible (otro usuario lo movió mientras tanto), el sistema reasigna el resto igual y te avisa cuáles quedaron afuera.',
   4),

  ('bookings', 'De dónde salen los bookings',
   E'Los bookings de **retiro** se crean desde la solapa **Ingreso**, al elegir la naviera de una tanda nueva (o acá mismo, al reasignar contenedores a un booking que todavía no existe). Los bookings de **embarque** se crean desde **Egreso**, al asignar el embarque de un lote. Ningún booking se edita a mano fuera de estos flujos: el ETD solo cambia con un **roleo**, y queda auditado.',
   5);

-- ── campo: booking de retiro en Ingreso ────────────────────────────────────
delete from crm.ayuda_contenido where nivel = 'campo' and clave = 'ingreso.booking_retiro';

insert into crm.ayuda_contenido (seccion, nivel, clave, titulo, contenido_md, orden, publicado) values
  ('ingreso', 'campo', 'ingreso.booking_retiro', 'Booking de retiro',
   E'El cupo de la naviera donde entra este contenedor — define el **ETD** (fecha de zarpe) contra la que se controla el freetime de expo. Es **obligatorio**: elegilo del catálogo de bookings activos de esta naviera, o creá uno nuevo ahí mismo si todavía no existe. Seguilo desde la solapa **Bookings**: si se acerca el ETD y el contenedor sigue en planta, hay que rolear el booking o reasignarlo a otro.',
   5, true);

-- ═══ 6 · refrescar cache de PostgREST ═══════════════════════════════════════
notify pgrst, 'reload schema';
