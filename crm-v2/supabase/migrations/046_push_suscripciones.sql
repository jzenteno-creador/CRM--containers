-- ═══════════════════════════════════════════════════════════════════════════
-- 046 · PUSH — suscripciones de notificaciones (resumen diario en el teléfono)
-- ═══════════════════════════════════════════════════════════════════════════
-- La app Android (TWA v1.1, enableNotifications) puede recibir Web Push. El
-- cliente se suscribe con la llave VAPID pública y guarda su suscripción acá;
-- el workflow n8n del mail diario la lee (service_role) y dispara el envío vía
-- /api/push/enviar (Vercel, llave VAPID privada + secreto compartido).
--
-- Seguridad:
--   · endpoint/p256dh/auth NO se exponen a authenticated (ni SELECT): con la
--     llave privada permiten enviar push cifrado a ese dispositivo. El cliente
--     no necesita leerlos — conoce su propia suscripción por pushManager.
--   · Escritura RPC-only (patrón 030): crm_push_subscribe / crm_push_unsubscribe
--     DEFINER owner=crm_rpc_executor (sin BYPASSRLS), guard de caller activo.
--   · service_role: SELECT (enviar) + DELETE (limpiar endpoints vencidos 404/410)
--     SOLO sobre esta tabla — ampliación explícita y acotada del mínimo de 042.
-- ═══════════════════════════════════════════════════════════════════════════

grant crm_rpc_executor to current_user;
-- alter function … owner to X exige que X tenga CREATE en el schema (en prod el
-- executor NO lo tiene — medido 2026-08-02, algo lo revocó post-030): se otorga
-- solo durante esta migración y se revoca al final.
grant create on schema crm to crm_rpc_executor;

-- ═══ A · tabla ═════════════════════════════════════════════════════════════
create table crm.push_suscripciones (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references crm.usuarios(id),
  endpoint   text not null unique check (length(endpoint) > 0),
  p256dh     text not null check (length(p256dh) > 0),
  auth       text not null check (length(auth) > 0),
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_push_suscripciones_usuario on crm.push_suscripciones (usuario_id);

create trigger trg_push_suscripciones_updated
  before update on crm.push_suscripciones
  for each row execute function crm.set_updated_at();

alter table crm.push_suscripciones enable row level security;

-- higiene: que no arrastre ningún default-ACL (lección 033/042)
revoke all on crm.push_suscripciones from public, anon, authenticated;

-- escritura solo vía RPCs (corren como crm_rpc_executor, la RLS le aplica)
-- OJO: la policy de SELECT es OBLIGATORIA aunque el executor "solo escriba" —
-- ON CONFLICT DO UPDATE necesita leer la fila en conflicto y el grant de SELECT
-- sin policy es default-deny → 42501 en el upsert (medido en harness 2026-08-02).
create policy push_susc_select_executor on crm.push_suscripciones
  for select to crm_rpc_executor using (true);
create policy push_susc_insert_executor on crm.push_suscripciones
  for insert to crm_rpc_executor with check (true);
create policy push_susc_update_executor on crm.push_suscripciones
  for update to crm_rpc_executor using (true) with check (true);
create policy push_susc_delete_executor on crm.push_suscripciones
  for delete to crm_rpc_executor using (true);

grant insert, update, delete, select on crm.push_suscripciones to crm_rpc_executor;

-- n8n (service_role bypassa RLS): leer para enviar, borrar endpoints muertos
grant select, delete on crm.push_suscripciones to service_role;

-- ═══ B · crm_push_subscribe — alta/actualización de la suscripción ═════════
-- Upsert por endpoint: si otro usuario inicia sesión en el mismo dispositivo,
-- la suscripción pasa a ser suya (el dispositivo es uno; el último login manda).
create function crm.crm_push_subscribe(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
) returns uuid
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_caller record;
  v_id uuid;
begin
  select * into v_caller from crm.perfil();
  if v_caller.usuario_id is null or v_caller.estado is distinct from 'activo' then
    raise exception 'cuenta_no_activa';
  end if;

  insert into crm.push_suscripciones (usuario_id, endpoint, p256dh, auth, user_agent)
  values (v_caller.usuario_id, p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
    set usuario_id = excluded.usuario_id,
        p256dh     = excluded.p256dh,
        auth       = excluded.auth,
        user_agent = excluded.user_agent
  returning id into v_id;

  return v_id;
end;
$fn$;

revoke execute on function crm.crm_push_subscribe(text, text, text, text) from public, anon;
grant execute on function crm.crm_push_subscribe(text, text, text, text) to authenticated;
alter function crm.crm_push_subscribe(text, text, text, text) owner to crm_rpc_executor;

-- ═══ C · crm_push_unsubscribe — baja de la suscripción propia ══════════════
create function crm.crm_push_unsubscribe(p_endpoint text) returns boolean
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_caller record;
  v_found boolean;
begin
  select * into v_caller from crm.perfil();
  if v_caller.usuario_id is null or v_caller.estado is distinct from 'activo' then
    raise exception 'cuenta_no_activa';
  end if;

  delete from crm.push_suscripciones
   where endpoint = p_endpoint and usuario_id = v_caller.usuario_id;
  v_found := found;
  return v_found;
end;
$fn$;

revoke execute on function crm.crm_push_unsubscribe(text) from public, anon;
grant execute on function crm.crm_push_unsubscribe(text) to authenticated;
alter function crm.crm_push_unsubscribe(text) owner to crm_rpc_executor;

-- menor privilegio: el executor no crea objetos fuera de migraciones
revoke create on schema crm from crm_rpc_executor;

notify pgrst, 'reload schema';
