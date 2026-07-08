-- ============================================================================
-- 016 — Auto-reparación de la fila espejo al login (condición de John, 2026-07-08)
--
-- Complemento del trigger defensivo (014): si crm.handle_new_user cae en su
-- catch (auth compartido protegido), el usuario queda en auth.users SIN fila en
-- crm.usuarios → "muerto" (perfil()/mi_estado_cuenta devuelven NULL, no aparece
-- en solicitudes, nadie se entera). Esta RPC reconstruye la fila espejo bajo
-- demanda: el session provider la llama tras el login, antes de perfil().
--
-- Seguridad: SECURITY DEFINER, solo crea la fila espejo del PROPIO caller
-- (auth.uid()) con estado pendiente_aprobacion y rol NULL — cero escalación
-- (no puede elegir rol ni estado). Idempotente (existe ⇒ no-op). Reconstruye
-- email/nombre desde auth.users (visible al owner). authenticated ejecuta;
-- public/anon revocados (regla ACL 010).
--
-- Agrega crm.sync_mi_usuario a la lista cerrada de SECURITY DEFINER.
-- ============================================================================

create or replace function crm.sync_mi_usuario()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_email  text;
  v_nombre text;
begin
  if v_uid is null then
    return;  -- sin sesión: nada que reparar
  end if;

  -- ya existe la fila espejo ⇒ no-op (caso normal, la creó handle_new_user)
  if exists (select 1 from crm.usuarios where auth_user_id = v_uid) then
    return;
  end if;

  -- reconstrucción: el trigger de signup falló y no dejó fila espejo
  select u.email,
         coalesce(nullif(trim(u.raw_user_meta_data ->> 'nombre'), ''),
                  split_part(u.email, '@', 1))
    into v_email, v_nombre
    from auth.users u
   where u.id = v_uid;

  if v_email is null then
    return;  -- defensivo: no debería ocurrir para una sesión válida
  end if;

  insert into crm.usuarios (auth_user_id, email, nombre)
  values (v_uid, v_email, v_nombre)
  on conflict (auth_user_id) do nothing;
end $$;

revoke execute on function crm.sync_mi_usuario() from public, anon;
grant execute on function crm.sync_mi_usuario() to authenticated;
