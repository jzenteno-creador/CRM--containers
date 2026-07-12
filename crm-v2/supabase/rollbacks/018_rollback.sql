-- ============================================================================
-- 018_rollback — revierte 018_m8_kpi_views (4 views de KPI del dashboard M8)
--
-- SCOPE: schema crm ÚNICAMENTE. No toca detention / public / auth / storage /
--   realtime / supabase_migrations. Solo DROP VIEW IF EXISTS de las 4 views
--   creadas por la 018, en ORDEN INVERSO de dependencias:
--     tendencia_mensual  → costo_naviera → resumen → costos_cerradas (base).
--   Las 3 primeras dependen de la base (costos_cerradas); resumen y
--   costo_naviera además leen vista_alertas (que NO se dropea acá).
--
-- Se escribe ANTES de aplicar la migración. Solo se aplica si un assert
-- post-migración falla.
-- ============================================================================

drop view if exists crm.vista_kpi_tendencia_mensual;
drop view if exists crm.vista_kpi_costo_naviera;
drop view if exists crm.vista_kpi_resumen;
drop view if exists crm.vista_kpi_costos_cerradas;
