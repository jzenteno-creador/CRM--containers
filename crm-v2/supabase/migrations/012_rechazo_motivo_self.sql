-- ============================================================================
-- 012_rechazo_motivo_self — M2 rebuild v2 CRM Detention
-- Gap detectado por el ui-builder en M2: §12.3 exige que la cuenta RECHAZADA
-- vea el motivo del rechazo en la pantalla de espera, pero la RLS §14.3
-- (correcta y sin cambios: estado_cuenta <> 'activo' ⇒ ninguna policy
-- matchea) le impide leer su propia fila de crm.usuarios, y perfil() no
-- expone rechazo_motivo.
--
-- Solución: función NUEVA crm.mi_estado_cuenta(). NO se toca perfil() (las
-- policies dependen de ella: cambiar su tipo de retorno exige DROP y el DROP
-- encadena sobre todas las policies) ni ninguna policy existente.
--
-- ADICIÓN a la lista cerrada de SECURITY DEFINER (§14.8 / plan M0+M1):
--   mi_estado_cuenta — justificación:
--   * Devuelve SOLO (estado_cuenta, rechazo_motivo) de la fila PROPIA del
--     caller (auth_user_id = auth.uid()): dato propio, superficie mínima.
--   * Imposible vía policy: §14.3 exige que un no-activo no matchee NINGUNA
--     policy — cualquier policy de SELECT para no-activos la violaría.
--   * SIN guard de activo (excepción documentada, como perfil()): su
--     propósito ES servir a cuentas pendiente/rechazado/suspendido.
--   Lista actualizada en .claude/agents/schema-builder.md (regla 8) y
--   .claude/agents/reviewer.md (criterio 8).
--
-- Regla del fix 010: Postgres regala EXECUTE a PUBLIC en cada CREATE
-- FUNCTION (el default es aditivo) — se revoca explícito en ESTA migración.
-- ============================================================================

create or replace function crm.mi_estado_cuenta(
  out estado_cuenta text,
  out rechazo_motivo text)
returns record
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  select u.estado_cuenta, u.rechazo_motivo
    into estado_cuenta, rechazo_motivo
    from crm.usuarios u
   where u.auth_user_id = (select auth.uid());
end $$;

revoke execute on function crm.mi_estado_cuenta() from public, anon;
grant execute on function crm.mi_estado_cuenta() to authenticated;

-- ----------------------------------------------------------------------------
-- Backlog de pulido #4 (review M1, finding 1): el `alter default privileges
-- for role postgres in schema crm revoke execute on functions from public`
-- de la migración 001 fue un NO-OP — los default privileges por schema son
-- ADITIVOS al default global y no pueden quitar el EXECUTE built-in de
-- PUBLIC. El patrón VIGENTE es el del fix 010: toda función nueva en crm
-- cierra con REVOKE explícito from public, anon + GRANT explícito.
-- Se persiste como comment del schema para que la regla viva también en la
-- DB, no solo en el historial de migraciones.
-- ----------------------------------------------------------------------------
comment on schema crm is
  'CRM Detention v2 (rebuild). ACL de funciones: el ALTER DEFAULT PRIVILEGES '
  'de la migracion 001 fue no-op (los default privileges por schema son '
  'aditivos y no revocan el EXECUTE built-in de PUBLIC). Patron vigente = '
  'fix 010: toda funcion nueva cierra con REVOKE EXECUTE ... FROM public, '
  'anon + GRANT explicito a authenticated.';
