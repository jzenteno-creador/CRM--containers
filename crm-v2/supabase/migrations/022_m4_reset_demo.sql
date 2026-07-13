-- ═══════════════════════════════════════════════════════════════════════════
-- 022 · M4 — RESET DEMO (borra datos operativos de crm.*, preserva semillas)
-- ═══════════════════════════════════════════════════════════════════════════
-- Directiva de producto: el cliente maneja las demos sin un dev. Pero es una
-- función DESTRUCTIVA → TRIPLE GUARD + gate humano antes de aplicar.
--
-- Guards:
--   1. rol = administrador activo (crm.perfil()).
--   2. crm.configuracion.modo_demo = true — apagás la clave y la RPC deja de
--      aceptar, SIN deploy (kill-switch de datos).
--   3. p_confirmacion debe ser exactamente 'RESET DEMO' (la UI la pide tipeada).
--   + Guard de render en el front: el botón solo aparece si NEXT_PUBLIC_DEMO_RESET=1.
--
-- GUARD ABSOLUTO DE ALCANCE: SOLO toca crm.*. Cero detention.*, public.*, auth.*.
-- Todas las sentencias son schema-cualificadas `crm.` y search_path fijado a ''.
--
-- Borra (orden FK-seguro — todas las FK son NO ACTION):
--   incidencia_fotos → incidencias → operacion_waivers → operacion_eventos →
--   movimientos_planta → operaciones → contenedores
-- PRESERVA semillas: navieras, freetime_origin, plantas, configuracion,
--   ayuda_contenido, Y usuarios.
--
-- auth.users: usuarios NO se borra → CERO huérfanos por construcción. La única
--   FK hacia auth es usuarios.auth_user_id → auth.users ON DELETE CASCADE, que
--   limpia en dirección auth→crm (nunca al revés). La RPC jamás toca auth.*.
--
-- Storage: las fotos de crm-incidencias no se borran por SQL (protect_delete).
--   El front borra los objetos vía Storage API ANTES de llamar esta RPC (requiere
--   una policy DELETE de admin en el bucket — ver 022b abajo, mismo gate).
--
-- ⚠️ NO APLICAR sin GO de John.
-- ═══════════════════════════════════════════════════════════════════════════

-- clave del kill-switch — arranca APAGADA (false). Se prende desde Admin.
insert into crm.configuracion (clave, valor)
values ('modo_demo', 'false'::jsonb)
on conflict (clave) do nothing;

create or replace function crm.crm_reset_demo(p_confirmacion text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_caller record;
  v_modo boolean;
  v_borradas jsonb;
  v_n_fotos int; v_n_inc int; v_n_wai int; v_n_evt int; v_n_mov int; v_n_ops int; v_n_cont int;
begin
  -- Guard 1: administrador activo
  select * into v_caller from crm.perfil();
  if v_caller.estado is distinct from 'activo' or v_caller.rol <> 'administrador' then
    raise exception 'el reset demo lo ejecuta solo un administrador activo';
  end if;

  -- Guard 2: modo_demo ON (kill-switch sin deploy)
  select (valor)::boolean into v_modo from crm.configuracion where clave = 'modo_demo';
  if v_modo is distinct from true then
    raise exception 'el modo demo está apagado: prendé crm.configuracion.modo_demo para habilitar el reset';
  end if;

  -- Guard 3: confirmación tipeada exacta
  if p_confirmacion is distinct from 'RESET DEMO' then
    raise exception 'confirmación inválida: tipeá exactamente RESET DEMO para confirmar';
  end if;

  -- Borrado en orden FK-seguro. SOLO crm.*. Preserva semillas + usuarios.
  delete from crm.incidencia_fotos;    get diagnostics v_n_fotos = row_count;
  delete from crm.incidencias;         get diagnostics v_n_inc  = row_count;
  delete from crm.operacion_waivers;   get diagnostics v_n_wai  = row_count;
  delete from crm.operacion_eventos;   get diagnostics v_n_evt  = row_count;
  delete from crm.movimientos_planta;  get diagnostics v_n_mov  = row_count;
  delete from crm.operaciones;         get diagnostics v_n_ops  = row_count;
  delete from crm.contenedores;        get diagnostics v_n_cont = row_count;

  v_borradas := jsonb_build_object(
    'incidencia_fotos', v_n_fotos, 'incidencias', v_n_inc,
    'operacion_waivers', v_n_wai, 'operacion_eventos', v_n_evt,
    'movimientos_planta', v_n_mov, 'operaciones', v_n_ops, 'contenedores', v_n_cont);

  -- auditoría del reset (no puede vivir en operacion_eventos: los borra el reset)
  update crm.configuracion
     set valor = jsonb_build_object('fecha', now(), 'usuario', v_caller.usuario_id,
                                    'borradas', v_borradas),
         updated_by = v_caller.usuario_id
   where clave = 'ultimo_reset_demo';
  if not found then
    insert into crm.configuracion (clave, valor, updated_by)
    values ('ultimo_reset_demo',
            jsonb_build_object('fecha', now(), 'usuario', v_caller.usuario_id, 'borradas', v_borradas),
            v_caller.usuario_id);
  end if;

  return jsonb_build_object('ok', true, 'borradas', v_borradas);
end $fn$;

revoke execute on function crm.crm_reset_demo(text) from public, anon;
grant  execute on function crm.crm_reset_demo(text) to authenticated;

comment on function crm.crm_reset_demo(text) is
  'RESET DEMO (022): borra datos operativos de crm.* (preserva navieras, '
  'freetime_origin, plantas, configuracion, ayuda_contenido, usuarios). Triple '
  'guard: admin activo + configuracion.modo_demo=true + p_confirmacion=''RESET DEMO''. '
  'El front además gatea el botón por NEXT_PUBLIC_DEMO_RESET. Auditoría en '
  'configuracion.ultimo_reset_demo (operacion_eventos se borra en el reset).';

-- ── 022b · policy DELETE de admin en el bucket crm-incidencias ──────────────
-- El front borra las fotos vía Storage API ANTES de llamar el reset (SQL no
-- puede: storage.protect_delete). Requiere que un admin pueda DELETE en el bucket.
create policy crm_incidencias_delete_admin on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'crm-incidencias'
    and (select p.estado = 'activo' and p.rol = 'administrador' from crm.perfil() p)
  );
