-- Rollback 050 — la sección "plata protegida" del informe mensual fallaría con
-- permission denied (el resto del informe y el snapshot no se ven afectados).
revoke select on crm.vista_kpi_costos_cerradas from service_role;
revoke select on crm.vista_kpi_costos_cerradas_impo from service_role;
notify pgrst, 'reload schema';
