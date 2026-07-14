-- ============================================================================
-- 025_fix_p1_rpc_executor — PROPUESTA · NO APLICADA (espera GO de John)
--
-- Cierra el P1 de CP3: un operador aprobado reescribe campos de plata
-- (fecha_retiro/fecha_devolucion/naviera_id/estado) por PATCH crudo a PostgREST,
-- salteando las RPC y su auditoría. Root cause: grant DML default-ABIERTO a
-- `authenticated` sobre operaciones/movimientos_planta/contenedores; el guard
-- era una blocklist parcial. El pilar "todo por RPC" nunca estuvo enforced en la DB.
--
-- ESTRATEGIA (opción C del bake-off — ganadora empírica, docs/FIX-P1-BAKEOFF.md):
-- default-deny ESTRUCTURAL sin re-derivar autorización.
--   1. REVOKE INSERT/UPDATE de `authenticated` sobre las 3 tablas de plata
--      → el PATCH/INSERT crudo muere a nivel de grant (42501 permission denied),
--        incluida cualquier COLUMNA o forma de escritura futura.
--   2. Las 6 RPCs operativas pasan a SECURITY DEFINER con OWNER = crm_rpc_executor,
--      un rol SIN BYPASSRLS. Corren con el grant del executor (pueden escribir)
--      PERO siguen sujetas a la RLS de 004 — que scopea por rol+planta usando
--      auth.uid() del usuario REAL (preservado a través del borde DEFINER).
--      EL CUERPO DE LAS RPC NO SE TOCA: el scoping lo sigue haciendo la RLS,
--      exactamente como hoy. Cero authz imperativa = cero riesgo de olvidar un check.
--
-- POR QUÉ NO un DEFINER naive (owner=postgres): postgres bypassa la RLS → las 6
-- RPCs (que dependen de la RLS para el scope de planta, ver 006) quedarían sin
-- scope → un operador de una planta operaría sobre ops de otra. ESCALADA REAL,
-- confirmada en el harness (cerradas=1 cross-planta). El executor sin BYPASSRLS
-- lo evita (cerradas=0), con el mismo default-deny.
--
-- VERIFICADO EN HARNESS (Postgres embebido, replay 001-024 + este archivo):
--   · raw PATCH fecha_retiro / estado / columna nueva → 42501 (cerrado)
--   · raw INSERT operacion / movimiento / contenedor  → 42501 (cerrado)
--   · RPC in-scope (confirmar_devolucion, crear_tanda) → funciona
--   · RPC cross-planta (op de otra planta)            → cerradas=0 (SIN escalada)
--   · auth.uid()/perfil() bajo DEFINER owner=executor  → devuelve el usuario real
--
-- REVERSIBILIDAD: un solo `grant insert, update ... to authenticated` + revertir
-- owner/security de las 6 funciones vuelve al estado previo.
--
-- FUERA DE ALCANCE (ya seguros o intencionales, no tocar acá):
--   · freetime_origin / operacion_waivers / operacion_eventos: SELECT-only para
--     authenticated (sin hueco).
--   · RPCs ya SECURITY DEFINER (waiver, corregir_cerrada, validar_reforzado,
--     nueva_version_freetime): son paths de admin/sup con guard propio; siguen igual.
--   · incidencias / incidencia_fotos: write directo SANCIONADO (AGENTS.md) — no se toca.
-- ============================================================================

-- 1) Rol ejecutor: sin login, sin BYPASSRLS. Miembro de `authenticated` para que
--    las policies `TO authenticated` le apliquen (RLS = enforcement de planta).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'crm_rpc_executor') then
    create role crm_rpc_executor nologin;   -- INHERIT por default (verificado en harness)
  end if;
end $$;

-- El rol de migración (postgres en Supabase, NO superusuario) tiene que ser MIEMBRO de
-- crm_rpc_executor para poder asignarle el owner de las funciones (SET ROLE). Se DEJA
-- concedido: futuras migraciones/rollbacks de estas 6 funciones también lo necesitan.
-- (En el harness postgres es superusuario y no lo necesita, pero es idempotente ahí.)
grant crm_rpc_executor to current_user;

grant authenticated to crm_rpc_executor;

grant usage on schema crm, extensions to crm_rpc_executor;
grant select on all tables in schema crm to crm_rpc_executor;
grant execute on all functions in schema crm to crm_rpc_executor;

-- Grants de ESCRITURA que necesitan las 6 RPCs (y SOLO esas escrituras):
grant insert, update on crm.operaciones        to crm_rpc_executor;
grant insert, update on crm.movimientos_planta to crm_rpc_executor;
grant insert          on crm.contenedores       to crm_rpc_executor;

-- 2) Las 6 RPCs operativas → SECURITY DEFINER, owner = executor. Cuerpo intacto.
-- Postgres exige que el NUEVO owner tenga CREATE en el schema para el alter owner (en
-- Supabase el rol de migración no es superusuario y sí lo chequea). Se concede temporal
-- y se REVOCA después (el executor es nologin; least-privilege).
grant create on schema crm to crm_rpc_executor;
do $$
declare
  fn text;
  sigs text[] := array[
    'crm.crm_crear_tanda_retiro(jsonb)',
    'crm.crm_confirmar_ingreso_planta(uuid[], timestamptz, text)',
    'crm.crm_registrar_salida_planta(uuid[], text, timestamptz, jsonb)',
    'crm.crm_confirmar_devolucion(uuid[], timestamptz)',
    'crm.crm_mover_entre_plantas(uuid, uuid, text, timestamptz, boolean, timestamptz)',
    'crm.crm_anular_operacion(uuid, text)'
  ];
begin
  foreach fn in array sigs loop
    execute format('alter function %s owner to crm_rpc_executor', fn);
    execute format('alter function %s security definer', fn);
  end loop;
end $$;
revoke create on schema crm from crm_rpc_executor;

-- 3) Cerrar la puerta: REVOKE del write directo de `authenticated`. SELECT queda.
revoke insert, update on crm.operaciones        from authenticated;
revoke insert, update on crm.movimientos_planta from authenticated;
revoke insert          on crm.contenedores       from authenticated;

-- Nota: tras esto, `crm_rpc_executor` es el ÚNICO no-superusuario con INSERT/UPDATE
-- sobre las tablas de plata, y solo se lo usa como owner de las 6 RPCs DEFINER.
-- Cualquier PATCH directo de la anon/publishable key (rol authenticated) → 42501.

-- ============================================================================
-- P2 · usuarios_publicos (advisor 0010 — SECURITY DEFINER view)
-- ----------------------------------------------------------------------------
-- ⚠️ DESVÍO MEDIDO del pedido "security_invoker=true": se probó en el harness y
-- ROMPE la app. `usuarios_publicos` es la única fuente de (id,nombre) de TODOS los
-- usuarios activos para los joins de la UI ("por {nombre}", confirmado_por — §14.6).
--   · Con security_invoker=true, el operador ve SOLO su propia fila (n=1 vs n=4 medido) →
--     los nombres de otros usuarios quedan en blanco. El join se rompe.
--   · Column-grants (GRANT SELECT (id,nombre)) tampoco sirven: el panel Admin lee
--     email/rol/estado_cuenta de `usuarios` directo → los perdería.
-- El leak de la view DEFINER es SOLO nombres — que §14.6 quiere visibles. La proyección
-- a (id,nombre) + el guard de caller activo son el límite de seguridad; no expone más.
-- Por eso se MANTIENE SECURITY DEFINER, como excepción DOCUMENTADA a §14.8. Silenciar el
-- advisor 0010 del todo requeriría convertirla en función DEFINER + cambiar los 3
-- `.from("usuarios_publicos")` del front a `.rpc(...)` — un deploy, fuera de alcance de esta
-- migración (decisión de John).
-- Verificado (CP3): la view ya proyecta SOLO (id, nombre) y filtra por caller activo — no hay
-- recorte que hacer. NO se re-crea (evita perder `security_barrier=true`); solo se comenta.
comment on view crm.usuarios_publicos is
  'SECURITY DEFINER intencional (§14.6): expone id+nombre de usuarios activos para joins de UI. '
  'security_invoker rompe el join (medido, CP3); el leak es solo nombres. Excepción documentada a §14.8.';

-- Refrescar el schema cache de PostgREST tras el cambio de ownership/security de las RPCs
-- (imprescindible si se aplica por un canal que no notifica solo, como execute_sql raw).
notify pgrst, 'reload schema';
