-- ============================================================================
-- 015 — Hardening de grants del schema crm (defense-in-depth, CP1 2026-07-08)
--
-- QUÉ CIERRA
--   "Automatically expose new tables" (ya apagado) otorgó a,r,w,d (INSERT,
--   SELECT, UPDATE, DELETE) a anon Y a authenticated sobre los 14 objetos de
--   crm (12 tablas + 2 views: usuarios_publicos, vista_alertas). Lo que protege
--   crm es la RLS (§14), NO la ausencia de grants — pero defense-in-depth exige
--   que anon no tenga ni superficie que intentar, y que authenticated no tenga
--   DELETE (no existe policy DELETE en crm: la anulación es UPDATE, así que el
--   grant DELETE es superficie inútil). El plan M1 quería anon con CERO grants.
--
-- ORDEN FUERA DE SECUENCIA (015 después de 017, a propósito)
--   La 017 expuso el schema crm en PostgREST. El test §14.10 (probar que la RLS
--   bloquea a anon CON los grants presentes) se corrió el 2026-07-12: 14/14 sin
--   leak. Recién DESPUÉS se aplica esta 015, para no confundir "la RLS bloquea"
--   con "no hay grant". Por eso el número 015 es menor que 017 pero se aplica
--   después en el ledger.
--
-- SCOPE: schema crm ÚNICAMENTE. detention / public / schedule 304 / auth /
--   storage / realtime NO se tocan. Todos los REVOKE/ALTER van con IN SCHEMA crm
--   o nombran objetos crm.* explícitos.
--
-- USAGE: anon CONSERVA USAGE ON SCHEMA crm (sancionado por el contrato del plan;
--   USAGE no entrega datos, sólo permite resolver nombres — sin grants de tabla
--   no se lee nada). authenticated conserva SELECT/INSERT/UPDATE; la RLS
--   restringe QUÉ filas. security_invoker de usuarios_publicos NO se toca (el
--   SECURITY DEFINER es intencional).
-- ============================================================================

-- anon: cero acceso de datos al schema crm (todo requiere sesión activa).
revoke all privileges on all tables    in schema crm from anon;   -- incluye las 2 views
revoke all privileges on all sequences in schema crm from anon;
revoke all privileges on all functions in schema crm from anon;   -- ninguna RPC pre-login

-- authenticated: sin DELETE (no hay policy DELETE en crm; anulación = UPDATE).
revoke delete on all tables in schema crm from authenticated;

-- usuarios_publicos es una view SECURITY DEFINER auto-updatable: authenticated
-- sólo debe LEERLA, nunca escribirla a través de ella.
revoke insert, update, delete on crm.usuarios_publicos from authenticated;

-- Higiene a futuro: objetos nuevos en crm NO re-otorgan a anon por default.
alter default privileges in schema crm revoke all on tables    from anon;
alter default privileges in schema crm revoke all on sequences from anon;

-- NOTA: USAGE de anon sobre el schema crm SE MANTIENE (decisión del contrato).
