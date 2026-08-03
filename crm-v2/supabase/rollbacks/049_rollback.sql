-- Rollback 049 — el informe mensual volvería a fallar con permission denied
-- (el resto del workflow, snapshot a Drive, no se ve afectado).
revoke select on crm.vista_kpi_costo_naviera from service_role;
notify pgrst, 'reload schema';
