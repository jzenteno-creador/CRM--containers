-- ============================================================================
-- 015 — Hardening de grants de crm (defense-in-depth, decisión CP1 2026-07-08)
--
-- "Automatically expose new tables" (ya apagado) otorgó SELECT/INSERT/UPDATE/
-- DELETE a anon Y authenticated sobre las 14 objetos de crm. Lo que protege crm
-- es la RLS (§14), NO la ausencia de grants — pero defense-in-depth exige que
-- anon no tenga ni superficie que intentar, y que authenticated no tenga DELETE
-- (no existe policy DELETE en crm: anulación = UPDATE, así que el grant es
-- superficie inútil). El plan M1 quería anon con CERO grants.
--
-- ORDEN: esta migración se aplica DESPUÉS del test §14.10 (probar que la RLS
-- bloquea a anon CON los grants presentes) — no antes, para no confundir
-- "RLS bloquea" con "no hay grant".
--
-- anon conserva USAGE ON SCHEMA crm (sancionado por el plan; USAGE no da datos).
-- authenticated conserva SELECT/INSERT/UPDATE; la RLS restringe QUÉ filas. Los
-- grants más amplios que la matriz §7 son inertes bajo RLS; DELETE se revoca por
-- higiene, no por necesidad.
-- ============================================================================

-- anon: cero acceso de datos al schema crm (todo requiere sesión activa).
revoke all on all tables in schema crm from anon;
revoke execute on all functions in schema crm from anon, public;

-- authenticated: sin DELETE (no hay policy DELETE en crm).
revoke delete on all tables in schema crm from authenticated;
