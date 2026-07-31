-- 040: KPIs del piloto Dow — los 3 comprometidos en el formulario que faltaban
-- (auditoría 2026-07-31, gap "4 KPIs medidos mensualmente"; GO de John)
--
-- El formulario (pág. 14 del PDF enviado) compromete 4 KPIs mensuales. El 1º
-- (costo por mes y naviera) ya existía (vista_kpi_costo_naviera, 018). Esta
-- migración agrega los otros 3 sobre la fuente única ya validada
-- (vista_kpi_costos_cerradas, 95,8% match vs Omar):
--   KPI 2: días promedio/mediana de estadía y de demora por contenedor
--   KPI 3: % de contenedores devueltos dentro del free time
--   KPI 4: cobertura de trazabilidad (numerador medible; ver nota)
--
-- CALIBRACIÓN CONTRA EL BASELINE DEL PDF (medido en prod 2026-07-31 antes de crear
-- la view): histórico completo da 1.591/2.922 = 54,4% dentro del free time y
-- estadía mediana 13; el PDF dice 1.661/2.960 = 56% y mediana 14. La diferencia
-- es explicable y CONOCIDA: (a) las 116 ops CMA 2025 donde Omar liquidó con 18
-- días libres vs los 14 cargados en el sistema (decisión de negocio pendiente de
-- John desde M6), (b) el PDF contó también las 37 activas en el denominador.
-- Si Dow pregunta por el delta, esta es la respuesta.
--
-- NOTA KPI 4 (cobertura): el denominador real ("todos los contenedores que movió
-- la operación física") vive FUERA del sistema — el propio formulario dice que la
-- línea de base se releva en las primeras semanas del piloto. La view expone el
-- NUMERADOR medible: contenedores trazados por mes, con el desglose de los que no
-- facturan estadía (sin_cargo), que son justamente los que hoy nadie controla.
--
-- Solo EXPO por ahora: impo tiene 0 operaciones; cuando opere, se agrega la view
-- espejo sobre vista_kpi_costos_cerradas_impo (documentado, no silencioso).

create or replace view crm.vista_kpi_piloto_mensual
with (security_invoker = true) as
select
  date_trunc('month', (cc.fecha_devolucion at time zone 'America/Argentina/Buenos_Aires')::date)::date
                                                          as mes,
  count(*)::integer                                       as cerradas,
  count(*) filter (where cc.dias_estadia <= cc.dias_libres)::integer
                                                          as dentro_freetime,
  round(100.0 * count(*) filter (where cc.dias_estadia <= cc.dias_libres)
        / nullif(count(*), 0), 1)                         as pct_dentro_freetime,
  round(avg(cc.dias_estadia), 1)                          as estadia_promedio,
  (percentile_cont(0.5) within group (order by cc.dias_estadia))::numeric(6,1)
                                                          as estadia_mediana,
  round(avg(greatest(0, cc.dias_estadia - cc.dias_libres)), 1)
                                                          as demora_promedio,
  (percentile_cont(0.5) within group
     (order by greatest(0, cc.dias_estadia - cc.dias_libres)))::numeric(6,1)
                                                          as demora_mediana,
  count(*) filter (where cc.sin_cargo)::integer           as trazados_sin_cargo,
  coalesce(sum(cc.costo_neto), 0)::numeric                as costo_neto_mes
from crm.vista_kpi_costos_cerradas cc
group by 1;

grant select on crm.vista_kpi_piloto_mensual to authenticated;
-- Regla de la casa (caso vac_* 2026-07-15): todo objeto nuevo en el schema nace
-- con writes de authenticated por default privileges — revoke explícito SIEMPRE.
-- (Una view agregada no es auto-updatable, pero la higiene no se negocia.)
revoke insert, update, delete, references, trigger, truncate
  on crm.vista_kpi_piloto_mensual from authenticated, anon;

comment on view crm.vista_kpi_piloto_mensual is
  'KPIs 2-3-4 del piloto Dow (040): estadía/demora promedio y mediana, % dentro '
  'del free time, trazados sin_cargo — por mes de devolución (AR). Fuente única: '
  'vista_kpi_costos_cerradas. Baseline histórico medido 2026-07-31: 54,4% dentro '
  '(delta vs 56% del PDF = CMA 14vs18 + activas, documentado en la migración).';
