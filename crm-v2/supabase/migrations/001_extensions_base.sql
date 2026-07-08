-- ============================================================================
-- 001_extensions_base — M1 rebuild v2 CRM Detention
-- Schema `crm` + grants mínimos + helpers transversales.
--
-- Regla §21 (addendum 2026-07-08): v2 escribe EXCLUSIVAMENTE en el schema
-- `crm` de este proyecto compartido. `detention` (v1) y `public`
-- (ssb-export-dashboard) son intocables.
--
-- Desvío documentado: perfil() estaba mapeada a la migración 003 en el plan,
-- pero las policies de 002 (maestros) la referencian y CREATE POLICY exige
-- que la función exista. Al ser plpgsql, su referencia a crm.usuarios se
-- resuelve en runtime (crm.usuarios nace en 003, antes de cualquier uso).
-- ============================================================================

create schema crm;

-- PostgREST necesita USAGE sobre el schema expuesto para resolverlo.
-- anon NO recibe ningún grant de tabla/función: todo requiere sesión
-- (mínimo privilegio — plan §0).
grant usage on schema crm to anon, authenticated;

-- Mínimo privilegio para funciones: Postgres da EXECUTE a PUBLIC por default
-- en toda función nueva. Se revoca ese default para el schema crm: cada
-- GRANT EXECUTE del API de v2 es explícito.
alter default privileges for role postgres in schema crm
  revoke execute on functions from public;

-- pg_trgm ya está instalada en el proyecto (la usa v1); idempotente.
create extension if not exists pg_trgm;

-- ----------------------------------------------------------------------------
-- updated_at automático (convención §4: toda tabla lleva created_at/updated_at
-- + trigger set_updated_at)
-- ----------------------------------------------------------------------------
create or replace function crm.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- Helpers de fecha AR (§4: cómputos de días SIEMPRE en
-- America/Argentina/Buenos_Aires)
-- ----------------------------------------------------------------------------
create or replace function crm.hoy_ar()
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;

grant execute on function crm.hoy_ar() to authenticated;

-- ÚNICA definición del cómputo de días de estadía (Decisión 2 aprobada por
-- John: fórmula v1 INCLUSIVA — el día del retiro cuenta como día 1).
-- Consumida por vista_alertas y por toda lógica futura de costo.
create or replace function crm.dias_estadia(p_desde timestamptz, p_hasta timestamptz)
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
  select ((p_hasta at time zone 'America/Argentina/Buenos_Aires')::date
        - (p_desde at time zone 'America/Argentina/Buenos_Aires')::date) + 1
$$;

grant execute on function crm.dias_estadia(timestamptz, timestamptz) to authenticated;

-- ----------------------------------------------------------------------------
-- perfil() — §14.2: única fuente de identidad para las policies.
-- SECURITY DEFINER (en la lista cerrada del plan M0+M1) + STABLE +
-- search_path pinneado. Resuelve (usuario_id, rol, planta, estado) desde
-- auth.uid(). Si no hay sesión o no hay fila en crm.usuarios devuelve NULLs
-- (⇒ ninguna policy matchea).
-- ----------------------------------------------------------------------------
create or replace function crm.perfil(
  out usuario_id uuid,
  out rol text,
  out planta_asignada_id uuid,
  out estado text)
returns record
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  select u.id, u.rol, u.planta_asignada_id, u.estado_cuenta
    into usuario_id, rol, planta_asignada_id, estado
    from crm.usuarios u
   where u.auth_user_id = (select auth.uid());
end $$;

grant execute on function crm.perfil() to authenticated;
