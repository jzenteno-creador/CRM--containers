-- ═══════════════════════════════════════════════════════════════════════════
-- 050 · service_role: SELECT sobre las vistas de costos cerrados (APLICADA 2026-08-03)
-- ═══════════════════════════════════════════════════════════════════════════
-- El informe ejecutivo v3 (workflow zTQW5xdg2CEYSmG3) calcula la sección "qué
-- protegió el sistema" desde bruto−neto de las cerradas (waivers documentados).
-- Ampliación EXPLÍCITA del patrón 042/049: dos vistas, solo SELECT.
grant select on crm.vista_kpi_costos_cerradas to service_role;
grant select on crm.vista_kpi_costos_cerradas_impo to service_role;
notify pgrst, 'reload schema';
