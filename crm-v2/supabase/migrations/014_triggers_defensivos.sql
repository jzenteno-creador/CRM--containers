-- ============================================================================
-- 014 — Triggers de auth.users DEFENSIVOS (condición de John, 2026-07-08)
--
-- Contexto (addendum §21): auth.users es COMPARTIDA por todo el proyecto
-- cctuowthpnstvdgjuomq. Un RAISE no capturado en crm.handle_new_user /
-- crm.bootstrap_admin aborta el INSERT/UPDATE de GoTrue → bloquea el signup o
-- la confirmación de email de TODO el proyecto, no solo del CRM v2. Regla
-- permanente: ningún trigger del CRM sobre auth.users puede propagar
-- excepciones — captura total + RAISE WARNING (queda en los logs de Postgres).
--
-- Trade-off documentado: si handle_new_user traga un error, el signup SUCEDE
-- pero el usuario queda sin fila en crm.usuarios → la app lo muestra como
-- "pendiente" genérico (mi_estado_cuenta devuelve NULLs) y NO aparece en el
-- panel de solicitudes. Es el modo de degradación elegido: proteger el auth
-- compartido vale más que ese caso borde (detectable por el WARNING en logs;
-- reparación manual: insertar la fila espejo). Idem bootstrap_admin: si falla,
-- la confirmación de email del usuario NO se bloquea; el bootstrap se puede
-- re-disparar re-confirmando o por reparación manual de la clave.
--
-- Sin cambios de lógica: mismos cuerpos que 003, envueltos en bloque
-- begin/exception. Lista DEFINER sin cambios (misma función, mismo nombre).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- handle_new_user — AFTER INSERT ON auth.users (§12.1) — ahora defensivo
-- ----------------------------------------------------------------------------
create or replace function crm.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into crm.usuarios (auth_user_id, email, nombre)
    values (
      new.id,
      new.email,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
               split_part(new.email, '@', 1))
    )
    on conflict (auth_user_id) do nothing;
  exception when others then
    -- JAMÁS abortar el signup del proyecto compartido (condición §21/014).
    raise warning 'crm.handle_new_user: fila espejo NO creada para % (%: %)',
      new.id, sqlstate, sqlerrm;
  end;
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- bootstrap_admin — AFTER UPDATE OF email_confirmed_at (Decisión 8) — defensivo
-- ----------------------------------------------------------------------------
create or replace function crm.bootstrap_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bootstrap text;
begin
  begin
    -- solo la transición sin-confirmar → confirmado dispara la evaluación
    if new.email_confirmed_at is null or old.email_confirmed_at is not null then
      return new;
    end if;

    -- clave consumida (valor json null) ⇒ v_bootstrap NULL ⇒ no-op
    select valor #>> '{}' into v_bootstrap
      from crm.configuracion
     where clave = 'admin_bootstrap_email';

    if v_bootstrap is null or lower(new.email) is distinct from lower(v_bootstrap) then
      return new;
    end if;

    if exists (
      select 1 from crm.usuarios u
       where u.rol = 'administrador'
         and u.estado_cuenta = 'activo'
         and u.auth_user_id <> new.id
    ) then
      return new;
    end if;

    update crm.usuarios
       set rol = 'administrador',
           estado_cuenta = 'activo',
           fecha_aprobacion = now()
     where auth_user_id = new.id
       and estado_cuenta = 'pendiente_aprobacion';

    if found then
      update crm.configuracion
         set valor = 'null'::jsonb
       where clave = 'admin_bootstrap_email';
    end if;
  exception when others then
    -- JAMÁS abortar la confirmación de email del proyecto compartido.
    raise warning 'crm.bootstrap_admin: evaluación fallida para % (%: %)',
      new.id, sqlstate, sqlerrm;
  end;
  return new;
end $$;

-- ACL: CREATE OR REPLACE preserva la ACL existente (NO re-otorga a PUBLIC — eso
-- solo pasa en un CREATE nuevo). El REVOKE va igual como defensa-en-profundidad,
-- idempotente y alineado con la regla 010. Estas funciones de trigger no son
-- invocables por API igual; el REVOKE cierra cualquier grant heredado.
revoke execute on function crm.handle_new_user() from public, anon, authenticated;
revoke execute on function crm.bootstrap_admin() from public, anon, authenticated;
