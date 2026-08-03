-- ═══════════════════════════════════════════════════════════════════════════
-- 049 · service_role: SELECT sobre vista_kpi_costo_naviera (APLICADA 2026-08-03)
-- ═══════════════════════════════════════════════════════════════════════════
-- El informe ejecutivo mensual (rama nueva del workflow n8n "Snapshot mensual",
-- zTQW5xdg2CEYSmG3) lee esta vista con service_role y el mínimo de la 042 no la
-- incluía → "permission denied" en el primer test. Ampliación EXPLÍCITA y
-- acotada del patrón 042: una vista, solo SELECT. Las tablas base ya estaban
-- otorgadas (042b); la vista es security_invoker así que con esto alcanza.
grant select on crm.vista_kpi_costo_naviera to service_role;
notify pgrst, 'reload schema';
