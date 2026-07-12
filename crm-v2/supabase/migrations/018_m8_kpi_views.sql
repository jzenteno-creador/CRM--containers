-- ============================================================================
-- 018_m8_kpi_views — Dashboard (Inicio) M8 · 4 views de KPI
--
-- ÚNICO módulo del run con DDL. SCOPE: schema crm ÚNICAMENTE.
--   detention / public / auth / storage / realtime / supabase_migrations NO se
--   tocan. El hardening de la 015 (anon sin grants, default privileges) NO se
--   toca: cada view acá otorga SELECT SOLO a authenticated, nunca a anon ni a
--   service_role explícito.
--
-- CADA view: WITH (security_invoker = true) — el scope por planta del operador
--   lo aplica la RLS de crm.operaciones sola (mismo contrato §14.8 que
--   vista_alertas). GRANT SELECT ... TO authenticated.
--
-- Fuente única de la fórmula de costo realizado: la view BASE
--   vista_kpi_costos_cerradas. Las otras 3 agregan sobre ella y/o sobre
--   vista_alertas. Cero recálculo de la fórmula fuera de la base.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) vista_kpi_costos_cerradas — BASE. Materializa el COSTO REALIZADO de las
--    operaciones CERRADAS.
--
--    Costo realizado = GREATEST(0, dias_estadia(retiro, devolucion) - dias_libres)
--                      * tarifa_usd_dia, con la tarifa VIGENTE A fecha_retiro
--    (mismo LATERAL que vista_alertas: naviera + regimen='vacios' + rango de
--    vigencia, la más reciente que aplique).
--      · sin_cargo=true                          ⇒ 0
--      · sin freetime vigente o !cobra_detention ⇒ NULL (SUM lo ignora; queda
--                                                   fuera de todas las sumas)
--    dias_estadia es AR-inclusivo (retiro = día 1). La naviera vive en
--    contenedores.naviera_id (operaciones no la tiene).
-- ----------------------------------------------------------------------------
create view crm.vista_kpi_costos_cerradas
with (security_invoker = true)
as
select
  o.id                as operacion_id,
  c.naviera_id,
  n.nombre            as naviera,
  o.planta_actual_id,
  o.fecha_retiro,
  o.fecha_devolucion,
  crm.dias_estadia(o.fecha_retiro, o.fecha_devolucion) as dias_estadia,
  ft.dias_libres,
  ft.tarifa_usd_dia,
  o.sin_cargo,
  case
    when o.sin_cargo then 0::numeric
    when ft.dias_libres is null or not n.cobra_detention_origen then null::numeric
    else greatest(0, crm.dias_estadia(o.fecha_retiro, o.fecha_devolucion) - ft.dias_libres)::numeric
         * ft.tarifa_usd_dia
  end as costo_realizado
from crm.operaciones o
join crm.contenedores c on c.id = o.contenedor_id
join crm.navieras n on n.id = c.naviera_id
left join lateral (
  select f.dias_libres, f.tarifa_usd_dia
    from crm.freetime_origin f
   where f.naviera_id = c.naviera_id
     and f.regimen = 'vacios'
     and (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date >= f.vigente_desde
     and (f.vigente_hasta is null
       or (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date <= f.vigente_hasta)
   order by f.vigente_desde desc
   limit 1
) ft on true
where o.estado = 'cerrado'
  and o.fecha_devolucion is not null;

grant select on crm.vista_kpi_costos_cerradas to authenticated;


-- ----------------------------------------------------------------------------
-- 2) vista_kpi_resumen — 1 fila con los KPIs de cabecera del dashboard.
--    Agrega sobre la base (realizado) y sobre vista_alertas (abierto).
--      · costo_mes  = realizado de cerradas con fecha_devolucion en el MES AR
--                     corriente.
--      · costo_ytd  = realizado de cerradas con fecha_devolucion en el AÑO AR
--                     corriente.
--      · costo_abierto_proyectado = SUM(costo_proyectado) de vista_alertas
--                     (se devenga HOY, al centavo con /alertas).
--      · en_riesgo_rojo / _amarillo = counts del semáforo de vista_alertas.
--      · stock_vacios = count(*) de vista_alertas (ciclo abierto = retirado
--                     sin devolver/embarcar).
--      · demora_promedio_dias = AVG(dias_estadia) de las cerradas YTD, a 1 dec.
--    El agregado sin GROUP BY devuelve SIEMPRE 1 fila: con DB vacía, sumas → 0
--    (COALESCE) y demora → NULL. El front la consume con .single().
-- ----------------------------------------------------------------------------
create view crm.vista_kpi_resumen
with (security_invoker = true)
as
select
  coalesce(sum(cc.costo_realizado) filter (
    where date_trunc('month', (cc.fecha_devolucion at time zone 'America/Argentina/Buenos_Aires')::date)
        = date_trunc('month', crm.hoy_ar())
  ), 0)::numeric as costo_mes,

  coalesce(sum(cc.costo_realizado) filter (
    where date_trunc('year', (cc.fecha_devolucion at time zone 'America/Argentina/Buenos_Aires')::date)
        = date_trunc('year', crm.hoy_ar())
  ), 0)::numeric as costo_ytd,

  (select coalesce(sum(va.costo_proyectado), 0)::numeric from crm.vista_alertas va)
    as costo_abierto_proyectado,

  (select count(*) from crm.vista_alertas va where va.estado_semaforo = 'rojo')
    as en_riesgo_rojo,

  (select count(*) from crm.vista_alertas va where va.estado_semaforo = 'amarillo')
    as en_riesgo_amarillo,

  (select count(*) from crm.vista_alertas va)
    as stock_vacios,

  round(avg(cc.dias_estadia) filter (
    where date_trunc('year', (cc.fecha_devolucion at time zone 'America/Argentina/Buenos_Aires')::date)
        = date_trunc('year', crm.hoy_ar())
  ), 1) as demora_promedio_dias
from crm.vista_kpi_costos_cerradas cc;

grant select on crm.vista_kpi_resumen to authenticated;


-- ----------------------------------------------------------------------------
-- 3) vista_kpi_costo_naviera — costo por naviera: realizado YTD + proyectado
--    abierto + total. FULL OUTER JOIN por nombre de naviera (vista_alertas solo
--    expone el nombre, no el id). Solo navieras con realizado>0 o proyectado>0.
--    Orden por costo_total desc (barras del dashboard).
-- ----------------------------------------------------------------------------
create view crm.vista_kpi_costo_naviera
with (security_invoker = true)
as
with realizado as (
  select cc.naviera, sum(cc.costo_realizado) as costo_realizado_ytd
    from crm.vista_kpi_costos_cerradas cc
   where date_trunc('year', (cc.fecha_devolucion at time zone 'America/Argentina/Buenos_Aires')::date)
       = date_trunc('year', crm.hoy_ar())
   group by cc.naviera
),
proyectado as (
  select va.naviera, sum(va.costo_proyectado) as costo_proyectado_abierto
    from crm.vista_alertas va
   group by va.naviera
)
select
  coalesce(r.naviera, p.naviera) as naviera,
  coalesce(r.costo_realizado_ytd, 0)::numeric      as costo_realizado_ytd,
  coalesce(p.costo_proyectado_abierto, 0)::numeric as costo_proyectado_abierto,
  (coalesce(r.costo_realizado_ytd, 0) + coalesce(p.costo_proyectado_abierto, 0))::numeric
    as costo_total
from realizado r
full outer join proyectado p on p.naviera = r.naviera
where coalesce(r.costo_realizado_ytd, 0) > 0
   or coalesce(p.costo_proyectado_abierto, 0) > 0
order by costo_total desc;

grant select on crm.vista_kpi_costo_naviera to authenticated;


-- ----------------------------------------------------------------------------
-- 4) vista_kpi_tendencia_mensual — serie de los últimos 12 meses AR (mes = día
--    1 del mes AR), con costo realizado y cantidad de cerradas por mes.
--    generate_series produce los 12 meses SIEMPRE (incluso vacíos, con 0) para
--    que el front dibuje la línea completa sin huecos.
-- ----------------------------------------------------------------------------
create view crm.vista_kpi_tendencia_mensual
with (security_invoker = true)
as
with meses as (
  select generate_series(
           date_trunc('month', crm.hoy_ar()) - interval '11 months',
           date_trunc('month', crm.hoy_ar()),
           interval '1 month'
         )::date as mes
),
cerradas_por_mes as (
  select
    date_trunc('month', (cc.fecha_devolucion at time zone 'America/Argentina/Buenos_Aires')::date)::date as mes,
    sum(cc.costo_realizado) as costo_realizado,
    count(*)                as cerradas
  from crm.vista_kpi_costos_cerradas cc
  where (cc.fecha_devolucion at time zone 'America/Argentina/Buenos_Aires')::date
        >= (date_trunc('month', crm.hoy_ar()) - interval '11 months')::date
  group by 1
)
select
  m.mes,
  coalesce(c.costo_realizado, 0)::numeric as costo_realizado,
  coalesce(c.cerradas, 0)::bigint         as cerradas
from meses m
left join cerradas_por_mes c on c.mes = m.mes
order by m.mes;

grant select on crm.vista_kpi_tendencia_mensual to authenticated;
