-- 042: service_role — barrido de grants fantasma + acceso MÍNIMO para el mail diario
-- (auditoría 2026-07-31 / implementación 2026-08-01, GO de John)
--
-- CONTEXTO. El workflow n8n del resumen diario (7AM) necesita leer 3 vistas del schema
-- `crm` con la service key. Al conectarlo apareció `permission denied for schema crm`:
-- **service_role nunca tuvo USAGE sobre `crm`**.
--
-- HALLAZGO al ir a otorgarlo: service_role SÍ tenía INSERT/UPDATE/DELETE sobre 14
-- objetos de `crm` — incluidas las tablas de plata (`operaciones`, `contenedores`,
-- `movimientos_planta`, `freetime_origin`). Grants fantasma de la misma clase que la 033
-- barrió para `authenticated`: heredados del default-ACL de creación del schema, nunca
-- otorgados por ninguna migración.
--
-- Hoy son LETRA MUERTA (sin USAGE no se llega a la tabla), pero otorgar USAGE a secas
-- los habría ACTIVADO de golpe — y service_role bypassa RLS, así que sería un camino de
-- escritura cruda a las tablas de plata para cualquiera con la service key. Contradice
-- el pilar "cero UPDATE crudo, todo por RPC".
--
-- POR ESO EL ORDEN IMPORTA: primero se revoca todo, después se abre la puerta y se
-- otorga SELECT SOLO sobre las 3 vistas que el mail necesita. Estado final: service_role
-- estrictamente MÁS restringido que antes en todo, salvo por esas 3 lecturas.
--
-- NOTA de mantenimiento: los default privileges de Supabase vuelven a otorgar sobre
-- objetos NUEVOS. Si una migración futura crea tablas en `crm`, revisar los grants de
-- service_role (mismo chequeo que ya se hace para authenticated).

revoke all on all tables    in schema crm from service_role;
revoke all on all functions in schema crm from service_role;
revoke all on all sequences in schema crm from service_role;

grant usage on schema crm to service_role;

-- Solo lectura, solo lo que consume el resumen diario.
grant select on crm.vista_alertas             to service_role;
grant select on crm.vista_alertas_impo        to service_role;
grant select on crm.vista_kpi_piloto_mensual  to service_role;

-- ── AMPLIACIÓN (misma sesión, tras probar el workflow) ────────────────────────
-- Las 3 vistas son `security_invoker = true`: se ejecutan con los privilegios del
-- LLAMADOR sobre las tablas base. Con solo el SELECT de las vistas, la consulta
-- rebotaba con `permission denied for table operaciones`.
-- Se agrega SELECT (solo lectura) sobre las 11 tablas base de las que dependen —
-- enumeradas por dependencia real (pg_rewrite/pg_depend), no a ojo. La postura
-- final de service_role sobre `crm` queda: LEE lo que alimenta el resumen diario,
-- NO ESCRIBE NADA, NO EJECUTA NINGUNA RPC.
grant select on
  crm.operaciones, crm.operaciones_impo, crm.ordenes_impo, crm.contenedores,
  crm.navieras, crm.plantas, crm.configuracion,
  crm.freetime_origin, crm.freetime_destino,
  crm.operacion_waivers, crm.operacion_impo_waivers,
  crm.vista_kpi_costos_cerradas
to service_role;
