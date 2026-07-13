-- ═══════════════════════════════════════════════════════════════════════════
-- 019 · M4 BLOQUE 1 — motor versionado + waiver + fixes operativos (F0 + F1)
-- ═══════════════════════════════════════════════════════════════════════════
-- GO de John: 2026-07-12 (EXPLORE+PLAN aprobado, decisiones 1-7 resueltas).
-- ⚠️ ESTA MIGRACIÓN NO SE APLICA sin el GO explícito de John post-gate.
-- Gate de cálculo obligatorio (VERIFIER independiente, BEGIN…ROLLBACK):
--   crm-v2/tests/golden-costos.json — 43 casos del Excel histórico.
--
-- Contenido:
--   A. freetime_origin: convencion_conteo + cobra_detention_origen VERSIONADOS
--   B. Primitivas de días: dias_con_convencion() · dias_facturables()
--   C. Waiver (decisión 4 de John): la naviera absorbe costo — 3 números
--      (bruto / absorbido / neto), auditable, supervisor+. sin_cargo queda
--      deprecado (compat: se interpreta como waiver total).
--   D. Views de plata: exponen costo_bruto / costo_absorbido / costo_neto.
--      costo_proyectado / costo_realizado = NETO (compatibilidad exacta:
--      sin waivers en la DB, todo número existente queda IDÉNTICO).
--   E. H1 · crm_crear_tanda_retiro — Opción B: savepoint por contenedor,
--      inserción parcial, resultado por fila con motivo accionable.
--   F. plantas: DROP del CHECK hardcodeado + activa (baja lógica) + write
--      policies admin (decisión 3: universo libre, validación en UI).
--   G. get_pendientes: compromiso CP1 — las alertas del operador incluyen
--      ops en tránsito HACIA su planta.
--
-- REGLA DURA cumplida: nada que re-calcule plata del pasado es un flag
-- mutable. Convención y cobra viven en la fila versionada de la tarifa.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ A · freetime_origin: parámetros de negocio VERSIONADOS ═══════════════

-- A.1 convención de conteo — hereda vigente_desde/hasta y scoping por naviera.
--     Default = la convención actual (+1, retiro = día 1), validada 2.804/2.804
--     contra el Excel histórico (docs/EXPLORE-M4.md F0-2). Cero cambio de números.
alter table crm.freetime_origin
  add column convencion_conteo text not null default 'retiro_dia_1'
  constraint ck_freetime_convencion
  check (convencion_conteo in ('retiro_dia_1', 'retiro_dia_0'));

-- A.2 cobra_detention_origen pasa a versionado. Hoy es un flag mutable en
--     navieras que la view de costos CERRADOS evalúa en vivo → togglearlo
--     re-calcula plata del pasado (hallazgo F2-1). Backfill desde el maestro.
alter table crm.freetime_origin add column cobra_detention_origen boolean;

update crm.freetime_origin f
   set cobra_detention_origen = n.cobra_detention_origen
  from crm.navieras n
 where n.id = f.naviera_id;

alter table crm.freetime_origin
  alter column cobra_detention_origen set not null,
  alter column cobra_detention_origen set default true;

comment on column crm.navieras.cobra_detention_origen is
  'DEPRECADO (019): las views ya no lo leen. La verdad versionada vive en '
  'freetime_origin.cobra_detention_origen. Se conserva solo como default de '
  'UI al crear la primera tarifa de una naviera nueva.';

comment on column crm.freetime_origin.convencion_conteo is
  'Convención de conteo de estadía, versionada con la tarifa. retiro_dia_1 = '
  'el día del retiro cuenta como día 1 (validado 2.804/2.804 vs Excel).';


-- ═══ B · primitivas de días ═══════════════════════════════════════════════

-- B.1 aritmética pura — ÚNICA definición del offset (las views y las RPCs
--     componen esta función; el literal +1/+0 no se repite en ningún lado).
create or replace function crm.dias_con_convencion(
  p_desde timestamptz, p_hasta timestamptz, p_convencion text
) returns integer
language sql immutable
set search_path to ''
as $$
  select ((p_hasta at time zone 'America/Argentina/Buenos_Aires')::date
        - (p_desde at time zone 'America/Argentina/Buenos_Aires')::date)
       + case p_convencion when 'retiro_dia_1' then 1 else 0 end
$$;

revoke execute on function crm.dias_con_convencion(timestamptz, timestamptz, text) from public, anon;
grant  execute on function crm.dias_con_convencion(timestamptz, timestamptz, text) to authenticated;

-- B.2 resolución por naviera — convención vigente A LA FECHA DE RETIRO.
--     Sin tarifa vigente → NULL (las views ya tratan NULL como 'neutro').
create or replace function crm.dias_facturables(
  p_fecha_retiro timestamptz, p_hasta timestamptz,
  p_naviera uuid, p_regimen text default 'vacios'
) returns integer
language sql stable
set search_path to ''
as $$
  select crm.dias_con_convencion(p_fecha_retiro, p_hasta, f.convencion_conteo)
    from crm.freetime_origin f
   where f.naviera_id = p_naviera
     and f.regimen = p_regimen
     and (p_fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date >= f.vigente_desde
     and (f.vigente_hasta is null
          or (p_fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date <= f.vigente_hasta)
   order by f.vigente_desde desc
   limit 1
$$;

revoke execute on function crm.dias_facturables(timestamptz, timestamptz, uuid, text) from public, anon;
grant  execute on function crm.dias_facturables(timestamptz, timestamptz, uuid, text) to authenticated;

-- B.3 dias_estadia queda como wrapper DEPRECADO de la convención histórica
--     (compat para cualquier caller externo; las views de 019 ya no la usan).
create or replace function crm.dias_estadia(p_desde timestamptz, p_hasta timestamptz)
returns integer
language sql immutable
set search_path to ''
as $$
  select crm.dias_con_convencion(p_desde, p_hasta, 'retiro_dia_1')
$$;

comment on function crm.dias_estadia(timestamptz, timestamptz) is
  'DEPRECADO (019): usar dias_facturables() (resuelve convención versionada por '
  'naviera) o dias_con_convencion(). Este wrapper fija retiro_dia_1.';


-- ═══ C · waiver — la naviera absorbe costo (decisión 4 de John) ═══════════
-- Semántica real de las "extensiones" del Excel: NO son días libres extra,
-- es la naviera comiéndose el costo por un error propio. Tres números:
--   costo_bruto     = lo que generó la operación
--   costo_absorbido = lo que absorbió la naviera (con motivo y respaldo)
--   costo_neto      = lo que SSB efectivamente paga
-- Waiver PARCIAL permitido (waiver_dias < exceso). Waiver total = dias >= exceso.

-- C.1 campos (all-or-none coherente; referencia opcional)
alter table crm.operaciones
  add column waiver_dias            integer,
  add column waiver_motivo          text,
  add column waiver_referencia      text,
  add column waiver_registrado_por  uuid references crm.usuarios(id),
  add column waiver_fecha           timestamptz;

alter table crm.operaciones
  add constraint ck_waiver_dias_positivo check (waiver_dias is null or waiver_dias > 0),
  add constraint ck_waiver_coherente check (
    (waiver_dias is null and waiver_motivo is null and waiver_referencia is null
     and waiver_registrado_por is null and waiver_fecha is null)
    or
    (waiver_dias is not null and waiver_motivo is not null
     and waiver_registrado_por is not null and waiver_fecha is not null)
  );

create index ix_operaciones_waiver_por on crm.operaciones (waiver_registrado_por)
  where waiver_registrado_por is not null;

comment on column crm.operaciones.sin_cargo is
  'DEPRECADO (019): usar waiver_dias (waiver total = waiver_dias >= exceso). '
  'Compat: sin_cargo=true se interpreta como waiver total en las views.';

-- C.2 el waiver es un evento auditable del timeline
alter table crm.operacion_eventos drop constraint operacion_eventos_tipo_evento_check;
alter table crm.operacion_eventos add constraint operacion_eventos_tipo_evento_check
  check (tipo_evento in ('retiro','ingreso_planta','movimiento','carga','egreso',
                         'devolucion','anulacion','incidencia','reapertura',
                         'correccion','waiver'));

-- C.3 RPC sancionada — supervisor+. SECURITY DEFINER porque el caso real es
--     registrar el waiver sobre una operación CERRADA (las 43+7 del histórico
--     llegaron post-cierre) y la policy de UPDATE excluye cerradas.
create or replace function crm.crm_registrar_waiver(
  p_operacion uuid, p_dias integer, p_motivo text, p_referencia text default null
) returns void
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_caller record;
  v_op record;
begin
  select * into v_caller from crm.perfil();
  if v_caller.estado is distinct from 'activo'
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

  update crm.operaciones
     set waiver_dias           = p_dias,
         waiver_motivo         = trim(p_motivo),
         waiver_referencia     = nullif(trim(p_referencia), ''),
         waiver_registrado_por = v_caller.usuario_id,
         waiver_fecha          = now()
   where id = p_operacion;
  -- el evento 'waiver' lo inserta el trigger evt_operacion_update (C.4):
  -- un solo camino de auditoría, cubre también un UPDATE directo.
end $fn$;

revoke execute on function crm.crm_registrar_waiver(uuid, integer, text, text) from public, anon;
grant  execute on function crm.crm_registrar_waiver(uuid, integer, text, text) to authenticated;

-- C.4 auditoría en el trigger (único camino: cubre RPC y UPDATE directo)
create or replace function crm.evt_operacion_update()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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

  -- waiver es plata (019 · decisión 4): evento con el detalle completo.
  if new.waiver_dias is distinct from old.waiver_dias then
    insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
    values (new.id, 'waiver', now(), v_usuario,
            jsonb_build_object('dias_anterior', old.waiver_dias,
                               'dias', new.waiver_dias,
                               'motivo', new.waiver_motivo,
                               'referencia', new.waiver_referencia));
  end if;

  return new;
end $function$;

-- C.5 el operador no toca plata por UPDATE directo (extiende el guard existente)
create or replace function crm.guard_operaciones_campos()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if (select p.rol from crm.perfil() p) = 'operador'
     and (new.sin_cargo is distinct from old.sin_cargo
       or new.producto is distinct from old.producto
       or new.gmid is distinct from old.gmid
       or new.waiver_dias is distinct from old.waiver_dias
       or new.waiver_motivo is distinct from old.waiver_motivo
       or new.waiver_referencia is distinct from old.waiver_referencia
       or new.waiver_registrado_por is distinct from old.waiver_registrado_por
       or new.waiver_fecha is distinct from old.waiver_fecha) then
    raise exception 'sin_cargo/producto/gmid/waiver solo los edita supervisor o administrador';
  end if;
  return new;
end $function$;


-- ═══ D · views de plata: bruto / absorbido / neto ═════════════════════════
-- Compatibilidad EXACTA: costo_proyectado y costo_realizado ahora son el NETO.
-- Sin waivers cargados (DB actual), neto == cálculo viejo, dígito por dígito.
-- Columnas nuevas APPENDED al final (requisito de CREATE OR REPLACE VIEW).

create or replace view crm.vista_alertas with (security_invoker = true) as
select
  o.id                    as operacion_id,
  c.id                    as contenedor_id,
  c.numero_contenedor,
  p.nombre                as planta_actual,
  n.nombre                as naviera,
  o.estado,
  o.fecha_retiro,
  o.sin_cargo,
  d.dias                  as dias_transcurridos,
  d.dias                  as dias_estadia,
  ft.dias_libres,
  case when ft.dias_libres is not null then ft.dias_libres - d.dias
       else null::integer end                       as dias_restantes,
  ft.tarifa_usd_dia,
  m.costo_neto            as costo_proyectado,       -- compat: proyectado = NETO
  case
    when ft.dias_libres is null or not ft.cobra_detention_origen then 'neutro'
    when (ft.dias_libres - d.dias) < 0               then 'rojo'
    when (ft.dias_libres - d.dias) <= cfg.umbral     then 'amarillo'
    else 'verde'
  end                     as estado_semaforo,
  m.costo_bruto,
  m.costo_absorbido,
  m.costo_neto,
  o.waiver_dias
from crm.operaciones o
join crm.contenedores c on c.id = o.contenedor_id
join crm.navieras n     on n.id = c.naviera_id
left join crm.plantas p on p.id = o.planta_actual_id
cross join lateral (
  select coalesce((select (valor ->> 'dias')::integer
                     from crm.configuracion
                    where clave = 'umbral_alerta_amarillo'), 3) as umbral
) cfg
left join lateral (
  select f.dias_libres, f.tarifa_usd_dia, f.convencion_conteo, f.cobra_detention_origen
    from crm.freetime_origin f
   where f.naviera_id = c.naviera_id
     and f.regimen = 'vacios'
     and (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date >= f.vigente_desde
     and (f.vigente_hasta is null
          or (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date <= f.vigente_hasta)
   order by f.vigente_desde desc
   limit 1
) ft on true
cross join lateral (
  select crm.dias_con_convencion(o.fecha_retiro, now(),
                                 coalesce(ft.convencion_conteo, 'retiro_dia_1')) as dias
) d
cross join lateral (
  select
    case when ft.dias_libres is null or not ft.cobra_detention_origen then null::numeric
         else greatest(0, d.dias - ft.dias_libres)::numeric * ft.tarifa_usd_dia
    end as costo_bruto,
    case when ft.dias_libres is null or not ft.cobra_detention_origen then null::numeric
         else least(
                case when o.sin_cargo then greatest(0, d.dias - ft.dias_libres)
                     else coalesce(o.waiver_dias, 0) end,
                greatest(0, d.dias - ft.dias_libres)
              )::numeric * ft.tarifa_usd_dia
    end as costo_absorbido,
    case when o.sin_cargo then 0::numeric              -- compat exacta con la view vieja
         when ft.dias_libres is null or not ft.cobra_detention_origen then null::numeric
         else (greatest(0, d.dias - ft.dias_libres)
               - least(coalesce(o.waiver_dias, 0), greatest(0, d.dias - ft.dias_libres))
              )::numeric * ft.tarifa_usd_dia
    end as costo_neto
) m
where o.estado not in ('cerrado', 'anulada');

create or replace view crm.vista_kpi_costos_cerradas with (security_invoker = true) as
select
  o.id                    as operacion_id,
  c.naviera_id,
  n.nombre                as naviera,
  o.planta_actual_id,
  o.fecha_retiro,
  o.fecha_devolucion,
  d.dias                  as dias_estadia,
  ft.dias_libres,
  ft.tarifa_usd_dia,
  o.sin_cargo,
  m.costo_neto            as costo_realizado,        -- compat: realizado = NETO
  m.costo_bruto,
  m.costo_absorbido,
  m.costo_neto,
  o.waiver_dias
from crm.operaciones o
join crm.contenedores c on c.id = o.contenedor_id
join crm.navieras n     on n.id = c.naviera_id
left join lateral (
  select f.dias_libres, f.tarifa_usd_dia, f.convencion_conteo, f.cobra_detention_origen
    from crm.freetime_origin f
   where f.naviera_id = c.naviera_id
     and f.regimen = 'vacios'
     and (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date >= f.vigente_desde
     and (f.vigente_hasta is null
          or (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date <= f.vigente_hasta)
   order by f.vigente_desde desc
   limit 1
) ft on true
cross join lateral (
  select crm.dias_con_convencion(o.fecha_retiro, o.fecha_devolucion,
                                 coalesce(ft.convencion_conteo, 'retiro_dia_1')) as dias
) d
cross join lateral (
  select
    case when ft.dias_libres is null or not ft.cobra_detention_origen then null::numeric
         else greatest(0, d.dias - ft.dias_libres)::numeric * ft.tarifa_usd_dia
    end as costo_bruto,
    case when ft.dias_libres is null or not ft.cobra_detention_origen then null::numeric
         else least(
                case when o.sin_cargo then greatest(0, d.dias - ft.dias_libres)
                     else coalesce(o.waiver_dias, 0) end,
                greatest(0, d.dias - ft.dias_libres)
              )::numeric * ft.tarifa_usd_dia
    end as costo_absorbido,
    case when o.sin_cargo then 0::numeric
         when ft.dias_libres is null or not ft.cobra_detention_origen then null::numeric
         else (greatest(0, d.dias - ft.dias_libres)
               - least(coalesce(o.waiver_dias, 0), greatest(0, d.dias - ft.dias_libres))
              )::numeric * ft.tarifa_usd_dia
    end as costo_neto
) m
where o.estado = 'cerrado' and o.fecha_devolucion is not null;

-- Grants de views (regla §14 + decidido sesión 13: NUNCA a anon).
-- Las 4 views derivadas (resumen / costo_naviera / tendencia) no cambian:
-- leen costo_realizado, que sigue existiendo (ahora = neto).
revoke all on crm.vista_alertas, crm.vista_kpi_costos_cerradas from public, anon;
grant select on crm.vista_alertas, crm.vista_kpi_costos_cerradas to authenticated;


-- ═══ E · H1 — crm_crear_tanda_retiro, Opción B (decisión 5) ═══════════════
-- Sin pre-check bajo RLS (punto ciego cross-planta) y sin helper DEFINER:
-- el árbitro único es ux_operacion_abierta (RLS-blind), capturado POR
-- CONTENEDOR con savepoint implícito → inserción PARCIAL. Resuelve además
-- la carrera concurrente (dos supervisores, misma tanda) por el mismo camino.
create or replace function crm.crm_crear_tanda_retiro(p jsonb)
returns jsonb
language plpgsql
set search_path to ''
as $function$
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
  v_rechazadas int := 0;
  v_resultados jsonb := '[]'::jsonb;
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
  -- valores de header validados ACÁ para que un check_violation dentro del
  -- loop solo pueda significar "número de contenedor inválido" (mensaje por
  -- fila veraz). Espejan los CHECK de contenedores.tipo y movimientos.medio.
  if v_tipo not in ('20DC', '40DC', '40HC') then
    raise exception 'tipo de contenedor inválido: %', v_tipo;
  end if;
  if v_medio not in ('camion', 'tren') then
    raise exception 'medio inválido: %', v_medio;
  end if;

  for v_item in select * from jsonb_array_elements(p -> 'contenedores') loop
    v_num := upper(v_item ->> 'numero');
    v_reforzado := coalesce((v_item ->> 'reforzado')::boolean, true);

    -- savepoint por contenedor: un fallo deja a ESTE contenedor afuera,
    -- atómicamente (maestro + operación + movimiento), y el loop sigue.
    begin
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
      insert into crm.operaciones (id, contenedor_id, retiro_de, booking_retiro, fecha_retiro, estado)
      values (v_op_id, v_cont_id, v_retiro_de, v_booking, v_fecha,
              case when v_confirma then 'en_planta' else 'en_transito_a_planta' end);

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
      v_resultados := v_resultados || jsonb_build_object(
        'numero', v_num, 'estado', 'aceptado', 'operacion_id', v_op_id, 'motivo', null,
        'motivo_texto', null);

    exception
      when unique_violation then
        -- ux_operacion_abierta (RLS-blind): cubre colisión visible, colisión
        -- cross-planta invisible al operador Y la carrera concurrente.
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

  return jsonb_build_object(
    'creadas', v_creadas,
    'rechazadas', v_rechazadas,
    'resultados', v_resultados);
end $function$;

revoke execute on function crm.crm_crear_tanda_retiro(jsonb) from public, anon;
grant  execute on function crm.crm_crear_tanda_retiro(jsonb) to authenticated;


-- ═══ F · plantas: universo libre + baja lógica + escritura admin ══════════
-- Decisión 3 de John: DROP del CHECK ('BAHIA','ABBOTT'). ⚠️ Cambio de una
-- sola vía: creada la tercera planta, el CHECK viejo no se puede reponer.
-- La validación de nombres vive en la UI; la DB conserva unique + no-vacío.
alter table crm.plantas drop constraint plantas_nombre_check;
alter table crm.plantas add constraint ck_plantas_nombre_no_vacio
  check (length(trim(nombre)) > 0);

-- baja lógica (hard-delete imposible: FKs RESTRICT desde operaciones,
-- movimientos_planta ×2 y usuarios). El front filtra pickers por activa=true.
alter table crm.plantas add column activa boolean not null default true;

-- policies espejo de navieras (002:71-80) — solo admin activo escribe
create policy plantas_insert_admin on crm.plantas
  for insert to authenticated
  with check ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p));

create policy plantas_update_admin on crm.plantas
  for update to authenticated
  using      ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p))
  with check ((select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p));

-- sin DELETE (coherente con el hardening 015: la baja es activa=false)
grant insert, update on crm.plantas to authenticated;


-- ═══ G · get_pendientes: compromiso CP1 (campana) ═════════════════════════
-- La categoría 'alertas' del operador ahora incluye las ops en tránsito
-- HACIA su planta (planta_actual_id es NULL en tránsito → quedaban afuera).
-- Mismo predicado que operaciones_select y pendientes_ingreso: un solo patrón.
-- El resto de la función queda idéntico. Badge del front = SOLO rojos (dec. 6).
create or replace function crm.get_pendientes()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  v_caller record;
  v_planta uuid;
  v_result jsonb;
begin
  select * into v_caller from crm.perfil();
  if v_caller.estado is distinct from 'activo' then
    raise exception 'cuenta no activa';
  end if;

  v_planta := case when v_caller.rol = 'operador' then v_caller.planta_asignada_id end;

  v_result := jsonb_build_object(
    'pendientes_ingreso', (
      select count(*)
        from crm.operaciones o
       where o.estado = 'en_transito_a_planta'
         and (v_planta is null or exists (
                select 1 from crm.movimientos_planta m
                 where m.operacion_id = o.id
                   and m.estado = 'en_transito'
                   and m.planta_destino_id = v_planta))),
    'pendientes_devolucion', (
      select count(*)
        from crm.operaciones o
       where o.estado = 'en_transito_a_terminal'
         and (v_planta is null or o.planta_actual_id = v_planta)),
    'alertas', (
      select jsonb_build_object(
               'amarillo', count(*) filter (where a.estado_semaforo = 'amarillo'),
               'rojo',     count(*) filter (where a.estado_semaforo = 'rojo'))
        from crm.vista_alertas a
        join crm.operaciones o on o.id = a.operacion_id
       where v_planta is null
          or o.planta_actual_id = v_planta
          or exists (select 1 from crm.movimientos_planta m
                      where m.operacion_id = o.id
                        and m.estado = 'en_transito'
                        and m.planta_destino_id = v_planta))
  );

  if v_caller.rol in ('supervisor', 'administrador') then
    v_result := v_result || jsonb_build_object(
      'reforzados_pendientes', (
        select count(*)
          from crm.contenedores
         where reforzado_estado in ('pendiente_validacion', 'discrepancia')));
  end if;

  if v_caller.rol = 'administrador' then
    v_result := v_result || jsonb_build_object(
      'solicitudes_acceso', (
        select count(*)
          from crm.usuarios
         where estado_cuenta = 'pendiente_aprobacion'));
  end if;

  return v_result;
end $function$;

revoke execute on function crm.get_pendientes() from public, anon;
grant  execute on function crm.get_pendientes() to authenticated;


-- ═══ H · crm_nueva_version_freetime: firma extendida ══════════════════════
-- Suma p_convencion y p_cobra (DEFAULT NULL = heredar de la versión vigente;
-- primera versión de una naviera → retiro_dia_1 / true). El call actual del
-- front (7 args nombrados) sigue funcionando sin cambios.
drop function if exists crm.crm_nueva_version_freetime(uuid, integer, boolean, text, numeric, date, text);

create function crm.crm_nueva_version_freetime(
  p_naviera uuid, p_dias integer, p_peligrosa boolean, p_tipo text,
  p_tarifa numeric, p_desde date, p_regimen text default 'vacios',
  p_convencion text default null, p_cobra boolean default null
) returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_caller record;
  v_id uuid;
  v_prev record;
  v_convencion text;
  v_cobra boolean;
begin
  select * into v_caller from crm.perfil();
  if v_caller.estado is distinct from 'activo' or v_caller.rol is distinct from 'administrador' then
    raise exception 'solo un administrador activo puede versionar tarifas';
  end if;

  if p_naviera is null then raise exception 'naviera obligatoria'; end if;
  if p_regimen is null or p_regimen not in ('vacios', 'cargados', 'sin_uso') then
    raise exception 'régimen inválido: %', p_regimen;
  end if;
  if p_tipo is null or p_tipo not in ('Detention', 'Demurrage', 'Combined') then
    raise exception 'tipo inválido: %', p_tipo;
  end if;
  if p_dias is null or p_dias < 0 then raise exception 'días libres inválidos: %', p_dias; end if;
  if p_tarifa is null or p_tarifa < 0 then raise exception 'tarifa inválida: %', p_tarifa; end if;
  if p_desde is null then raise exception 'fecha de vigencia obligatoria'; end if;
  if p_convencion is not null and p_convencion not in ('retiro_dia_1', 'retiro_dia_0') then
    raise exception 'convención de conteo inválida: %', p_convencion;
  end if;

  select * into v_prev
    from crm.freetime_origin
   where naviera_id = p_naviera and regimen = p_regimen and vigente_hasta is null
   limit 1;

  -- herencia: sin parámetro explícito, la versión nueva conserva la convención
  -- y el cobra de la vigente (o los defaults del sistema si es la primera)
  v_convencion := coalesce(p_convencion, v_prev.convencion_conteo, 'retiro_dia_1');
  v_cobra      := coalesce(p_cobra, v_prev.cobra_detention_origen, true);

  -- idempotencia: misma versión ⇒ devolver la existente
  if v_prev.id is not null
     and v_prev.vigente_desde = p_desde
     and v_prev.dias_libres = p_dias
     and v_prev.tarifa_usd_dia = p_tarifa
     and v_prev.tipo = p_tipo
     and v_prev.aplica_carga_peligrosa = p_peligrosa
     and v_prev.convencion_conteo = v_convencion
     and v_prev.cobra_detention_origen = v_cobra then
    return v_prev.id;
  end if;

  if v_prev.id is not null and p_desde <= v_prev.vigente_desde then
    raise exception 'la vigencia nueva (%) debe ser posterior al inicio de la versión vigente (%)',
      p_desde, v_prev.vigente_desde;
  end if;

  if v_prev.id is not null then
    update crm.freetime_origin set vigente_hasta = p_desde - 1 where id = v_prev.id;
  end if;

  insert into crm.freetime_origin
    (naviera_id, regimen, dias_libres, aplica_carga_peligrosa, tipo,
     tarifa_usd_dia, vigente_desde, vigente_hasta, convencion_conteo, cobra_detention_origen)
  values
    (p_naviera, p_regimen, p_dias, p_peligrosa, p_tipo, p_tarifa, p_desde, null,
     v_convencion, v_cobra)
  returning id into v_id;

  return v_id;
end $function$;

revoke execute on function crm.crm_nueva_version_freetime(uuid, integer, boolean, text, numeric, date, text, text, boolean) from public, anon;
grant  execute on function crm.crm_nueva_version_freetime(uuid, integer, boolean, text, numeric, date, text, text, boolean) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN 019 · Post-aplicación (fuera de esta migración, bloque siguiente):
--   front de F1 (tanda fila-por-fila, campana solo-rojos, plantas CRUD +
--   pickers activa=true, modal de tarifas con convención/cobra) — DDL primero,
--   UI después (el retorno nuevo de la tanda es superset: la UI vieja degrada
--   bien leyendo 'creadas').
-- ═══════════════════════════════════════════════════════════════════════════
