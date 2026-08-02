-- 045: `dias_facturables` queda DEPRECADA y sin EXECUTE (2026-08-02)
--
-- Tiene el MISMO defecto que la 044 corrigió en exceso_actual: re-resuelve la tarifa
-- por su cuenta y NO filtra por país (con 40 países vigentes, agarra cualquiera).
-- Diferencia: no la usa NADIE — verificado sobre las funciones del schema, las views
-- y todo crm-v2/src. Es código muerto con un bug de plata adentro: una trampa para
-- quien la encuentre y la crea confiable.
--
-- No se dropea (regla de la casa: neutralizar, no destruir). Se le quita el EXECUTE a
-- `authenticated` — con eso deja de ser invocable vía PostgREST — y el comentario deja
-- dicho qué usar en su lugar.

revoke execute on function crm.dias_facturables(timestamptz, timestamptz, uuid, text) from authenticated;

comment on function crm.dias_facturables(timestamptz, timestamptz, uuid, text) is
  'DEPRECADA (045, 2026-08-02) — NO USAR. Re-resuelve la tarifa sin filtrar por país: '
  'con 40 países con tarifa vigente devuelve días de otro país (mismo defecto que la 044 '
  'corrigió en exceso_actual, donde estaba midiendo 191/200 casos mal). Sin consumidores '
  'al momento de deprecarla. Para días facturables usar las views (vista_alertas / '
  'vista_kpi_costos_cerradas), que son la fuente única del motor.';
