-- ============================================================================
-- 004_operacion — M1 rebuild v2 CRM Detention
-- contenedores, operaciones, movimientos_planta, operacion_eventos,
-- incidencias, incidencia_fotos + guard ux_operacion_abierta + índices +
-- matriz RLS §2.2 del plan.
--
-- Diseño anti-recursión (42P17): las policies de movimientos_planta se
-- expresan DIRECTO por plantas (origen/destino vs perfil()), nunca
-- subconsultando operaciones; las de operaciones sí subconsultan
-- movimientos_planta (una sola dirección ⇒ no hay ciclo). Las de eventos/
-- incidencias/fotos heredan visibilidad vía EXISTS sobre operaciones (la RLS
-- de operaciones aplica dentro del subquery).
--
-- operacion_eventos: RLS ON y CERO policies de escritura — la app no puede
-- falsificar el timeline; solo escriben los triggers DEFINER de 005.
--
-- SECURITY DEFINER de esta migración (lista cerrada): crm_validar_reforzado.
--
-- Nota: el orden interno (tablas primero, policies de operaciones después de
-- movimientos_planta) responde a dependencias de objetos; todo nace con RLS
-- ON + policies en ESTA migración (§14.1).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- contenedores — MAESTRO: propiedades estables, registro único (§4)
-- Se crea automáticamente como side-effect de la tanda (§6.3.1); no hay
-- pantalla de alta. CHECK de formato ISO 6346 verificado contra v1
-- (0/2944 filas lo violan): red determinística extra bajo el parser.
-- ----------------------------------------------------------------------------
create table crm.contenedores (
  id                          uuid primary key default gen_random_uuid(),
  numero_contenedor           text not null unique
                              check (numero_contenedor ~ '^[A-Z]{4}[0-9]{7}$'),
  naviera_id                  uuid not null references crm.navieras(id),
  tipo                        text not null check (tipo in ('20DC', '40DC', '40HC')),
  reforzado_estado            text not null default 'confirmado_reforzado'
                              check (reforzado_estado in
                                ('pendiente_validacion', 'confirmado_reforzado',
                                 'confirmado_no_reforzado', 'discrepancia')),
  reforzado_validado_por      uuid references crm.usuarios(id),
  reforzado_fecha_validacion  timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index idx_cont_numero_trgm on crm.contenedores using gin (numero_contenedor gin_trgm_ops);
create index ix_contenedores_naviera on crm.contenedores (naviera_id);
create index ix_contenedores_reforzado_validado_por on crm.contenedores (reforzado_validado_por);
create index ix_contenedores_reforzado_estado on crm.contenedores (reforzado_estado);

create trigger trg_contenedores_upd
  before update on crm.contenedores
  for each row execute function crm.set_updated_at();

alter table crm.contenedores enable row level security;

-- Maestro legible por cualquier activo (§14.4)
create policy contenedores_select on crm.contenedores
  for select to authenticated
  using ((select p.estado = 'activo' from crm.perfil() p));

-- INSERT operador+ (lo ejerce la tanda, que es INVOKER); naviera/tipo válidos
-- los garantizan FK + CHECK. Sin UPDATE directo: reforzado solo vía RPC
-- DEFINER crm_validar_reforzado (supervisor+).
create policy contenedores_insert on crm.contenedores
  for insert to authenticated
  with check ((select p.estado = 'activo'
                 and p.rol in ('operador', 'supervisor', 'administrador')
                from crm.perfil() p));

grant select, insert on crm.contenedores to authenticated;

-- ----------------------------------------------------------------------------
-- operaciones — un ciclo de vida: retiro → cierre (§4, §5)
-- Sin estado 'cargado' (§18.1). Paridad v1: sin_cargo, producto, gmid,
-- observaciones + CHECKs de coherencia D-05.
-- ----------------------------------------------------------------------------
create table crm.operaciones (
  id                   uuid primary key default gen_random_uuid(),
  contenedor_id        uuid not null references crm.contenedores(id),
  retiro_de            text not null,
  booking_retiro       text,
  fecha_retiro         timestamptz not null,            -- arranca freetime
  planta_actual_id     uuid references crm.plantas(id), -- SOLO vía trigger de movimientos
  booking_asignado     text,
  buque                text,
  destino              text,
  orden                text,
  shp                  text,
  fecha_egreso_planta  timestamptz,
  tipo_cierre          text not null default 'pendiente'
                       check (tipo_cierre in ('embarcado', 'devuelto_vacio', 'pendiente')),
  fecha_devolucion     timestamptz,                     -- gate-in terminal = CORTA freetime
  estado               text not null default 'en_transito_a_planta'
                       check (estado in
                         ('en_transito_a_planta', 'en_planta',
                          'en_transito_a_terminal', 'cerrado', 'anulada')),
  anulada_motivo       text,
  anulada_por          uuid references crm.usuarios(id),
  sin_cargo            boolean not null default false,  -- paridad v1: costo 0 en views
  producto             text,
  gmid                 text,
  observaciones        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- D-05 v1: coherencia fecha/estado
  constraint ck_devolucion_post_retiro
    check (fecha_devolucion is null or fecha_devolucion >= fecha_retiro),
  constraint ck_cerrado_tiene_devolucion
    check (estado <> 'cerrado' or fecha_devolucion is not null),
  constraint ck_egreso_post_retiro
    check (fecha_egreso_planta is null or fecha_egreso_planta >= fecha_retiro)
);

-- GUARD §4: una operación abierta por contenedor
create unique index ux_operacion_abierta
  on crm.operaciones (contenedor_id)
  where estado not in ('cerrado', 'anulada');

create index ix_operaciones_contenedor on crm.operaciones (contenedor_id);
create index ix_operaciones_estado on crm.operaciones (estado);
create index ix_operaciones_fecha_retiro on crm.operaciones (fecha_retiro);
create index ix_operaciones_planta on crm.operaciones (planta_actual_id);
create index ix_operaciones_anulada_por on crm.operaciones (anulada_por);
create index idx_ops_estado_dev on crm.operaciones (estado, fecha_devolucion desc);
create index idx_ops_booking_ret_trgm on crm.operaciones using gin (booking_retiro gin_trgm_ops);
create index idx_ops_booking_asig_trgm on crm.operaciones using gin (booking_asignado gin_trgm_ops);
create index idx_ops_orden_trgm on crm.operaciones using gin (orden gin_trgm_ops);

create trigger trg_operaciones_upd
  before update on crm.operaciones
  for each row execute function crm.set_updated_at();

alter table crm.operaciones enable row level security;
-- (policies de operaciones más abajo: referencian movimientos_planta)

grant select, insert, update on crm.operaciones to authenticated;

-- ----------------------------------------------------------------------------
-- movimientos_planta (§4)
-- ----------------------------------------------------------------------------
create table crm.movimientos_planta (
  id                        uuid primary key default gen_random_uuid(),
  operacion_id              uuid not null references crm.operaciones(id),
  planta_origen_id          uuid references crm.plantas(id),  -- null = primer tramo desde depósito
  planta_destino_id         uuid not null references crm.plantas(id),
  medio                     text not null check (medio in ('camion', 'tren')),
  fecha_salida              timestamptz not null,
  fecha_llegada_confirmada  timestamptz,
  confirmado_por            uuid references crm.usuarios(id),
  estado                    text not null default 'en_transito'
                            check (estado in ('en_transito', 'confirmado')),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint ck_origen_distinto_destino
    check (planta_origen_id is distinct from planta_destino_id),
  constraint ck_llegada_post_salida
    check (fecha_llegada_confirmada is null or fecha_llegada_confirmada >= fecha_salida)
);

create index ix_movimientos_operacion on crm.movimientos_planta (operacion_id);
create index ix_mov_destino_estado on crm.movimientos_planta (planta_destino_id, estado);
create index ix_mov_origen on crm.movimientos_planta (planta_origen_id);
create index ix_mov_confirmado_por on crm.movimientos_planta (confirmado_por);

create trigger trg_movimientos_upd
  before update on crm.movimientos_planta
  for each row execute function crm.set_updated_at();

alter table crm.movimientos_planta enable row level security;

-- Scope DIRECTO por plantas (sin subquery a operaciones — anti 42P17)
create policy movimientos_select on crm.movimientos_planta
  for select to authenticated
  using (
    (select p.estado = 'activo'
       and ( p.rol in ('supervisor', 'administrador')
          or (p.rol = 'operador'
              and (planta_origen_id = p.planta_asignada_id
                or planta_destino_id = p.planta_asignada_id)))
      from crm.perfil() p)
  );

-- INSERT: operador solo tramos que nacen en su planta, o primer tramo
-- (origen NULL) hacia su planta — cierra la escritura ciega contra
-- operaciones ajenas (plan §2.2)
create policy movimientos_insert on crm.movimientos_planta
  for insert to authenticated
  with check (
    (select p.estado = 'activo'
       and ( p.rol in ('supervisor', 'administrador')
          or (p.rol = 'operador'
              and (planta_origen_id = p.planta_asignada_id
                or (planta_origen_id is null
                    and planta_destino_id = p.planta_asignada_id))))
      from crm.perfil() p)
  );

-- UPDATE (confirmación de llegada): operador solo con destino = su planta
create policy movimientos_update on crm.movimientos_planta
  for update to authenticated
  using (
    estado = 'en_transito'
    and (select p.estado = 'activo'
           and ( p.rol in ('supervisor', 'administrador')
              or (p.rol = 'operador' and planta_destino_id = p.planta_asignada_id))
          from crm.perfil() p)
  )
  with check (
    (select p.estado = 'activo'
       and ( p.rol in ('supervisor', 'administrador')
          or (p.rol = 'operador' and planta_destino_id = p.planta_asignada_id))
      from crm.perfil() p)
  );

grant select, insert, update on crm.movimientos_planta to authenticated;

-- ----------------------------------------------------------------------------
-- Policies de operaciones (ahora que movimientos_planta existe)
-- Operador: planta_actual = su planta ∨ ∃ movimiento en_transito hacia su
-- planta (fases de tránsito asociadas — §14.4). Supervisor/admin: todas.
-- ----------------------------------------------------------------------------
create policy operaciones_select on crm.operaciones
  for select to authenticated
  using (
    (select p.estado = 'activo'
       and ( p.rol in ('supervisor', 'administrador')
          or (p.rol = 'operador'
              and (planta_actual_id = p.planta_asignada_id
                or exists (
                     select 1 from crm.movimientos_planta m
                      where m.operacion_id = crm.operaciones.id
                        and m.estado = 'en_transito'
                        and m.planta_destino_id = p.planta_asignada_id))))
      from crm.perfil() p)
  );

-- INSERT: estado inicial válido y planta_actual_id NULL (la fija SOLO el
-- trigger de movimientos confirmados); el scope de planta del operador lo
-- impone el INSERT del movimiento en la misma transacción de la tanda.
create policy operaciones_insert on crm.operaciones
  for insert to authenticated
  with check (
    estado in ('en_transito_a_planta', 'en_planta')
    and planta_actual_id is null
    and tipo_cierre = 'pendiente'
    and fecha_egreso_planta is null
    and fecha_devolucion is null
    and (select p.estado = 'activo'
           and p.rol in ('operador', 'supervisor', 'administrador')
          from crm.perfil() p)
  );

-- UPDATE — una sola policy permissive (advisor multiple_permissive_policies):
-- USING: nadie toca cerradas/anuladas; operador solo en su planta.
-- WITH CHECK: operador nunca produce estado 'anulada' ni saca la operación de
-- su planta; anular queda para supervisor/admin (§7).
create policy operaciones_update on crm.operaciones
  for update to authenticated
  using (
    estado not in ('cerrado', 'anulada')
    and (select p.estado = 'activo'
           and ( p.rol in ('supervisor', 'administrador')
              or (p.rol = 'operador' and planta_actual_id = p.planta_asignada_id))
          from crm.perfil() p)
  )
  with check (
    (select p.estado = 'activo'
       and ( p.rol in ('supervisor', 'administrador')
          or (p.rol = 'operador'
              and estado <> 'anulada'
              and planta_actual_id = p.planta_asignada_id))
      from crm.perfil() p)
  );

-- ----------------------------------------------------------------------------
-- operacion_eventos — TIMELINE (§4). Poblada por TRIGGERS DEFINER (005).
-- CHECK incluye reapertura/correccion (paridad timeline v1 — decisión John).
-- ----------------------------------------------------------------------------
create table crm.operacion_eventos (
  id           uuid primary key default gen_random_uuid(),
  operacion_id uuid not null references crm.operaciones(id),
  tipo_evento  text not null check (tipo_evento in
               ('retiro', 'ingreso_planta', 'movimiento', 'carga', 'egreso',
                'devolucion', 'anulacion', 'incidencia', 'reapertura', 'correccion')),
  fecha        timestamptz not null default now(),
  usuario_id   uuid references crm.usuarios(id),  -- NULL si sistema
  detalle      jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index ix_eventos_operacion on crm.operacion_eventos (operacion_id, fecha);
create index ix_eventos_usuario on crm.operacion_eventos (usuario_id);

create trigger trg_eventos_upd
  before update on crm.operacion_eventos
  for each row execute function crm.set_updated_at();

alter table crm.operacion_eventos enable row level security;

-- SELECT hereda la visibilidad de la operación (la RLS de operaciones aplica
-- dentro del EXISTS). CERO policies de INSERT/UPDATE/DELETE: solo los
-- triggers DEFINER escriben — la app no puede falsificar el timeline.
create policy eventos_select on crm.operacion_eventos
  for select to authenticated
  using (
    (select p.estado = 'activo' from crm.perfil() p)
    and exists (select 1 from crm.operaciones o where o.id = operacion_id)
  );

grant select on crm.operacion_eventos to authenticated;

-- ----------------------------------------------------------------------------
-- incidencias (§4)
-- ----------------------------------------------------------------------------
create table crm.incidencias (
  id           uuid primary key default gen_random_uuid(),
  operacion_id uuid not null references crm.operaciones(id),
  tipo         text not null check (tipo in ('averia_sufrida', 'averia_recepcionada', 'otro')),
  descripcion  text,
  fecha        timestamptz not null default now(),
  usuario_id   uuid references crm.usuarios(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index ix_incidencias_operacion on crm.incidencias (operacion_id);
create index ix_incidencias_usuario on crm.incidencias (usuario_id);

create trigger trg_incidencias_upd
  before update on crm.incidencias
  for each row execute function crm.set_updated_at();

alter table crm.incidencias enable row level security;

create policy incidencias_select on crm.incidencias
  for select to authenticated
  using (
    (select p.estado = 'activo' from crm.perfil() p)
    and exists (select 1 from crm.operaciones o where o.id = operacion_id)
  );

-- INSERT operador+ sobre operación visible (el EXISTS hereda el scope de
-- planta); la atribución no es falsificable (usuario_id propio o NULL)
create policy incidencias_insert on crm.incidencias
  for insert to authenticated
  with check (
    (select p.estado = 'activo'
       and p.rol in ('operador', 'supervisor', 'administrador')
       and (usuario_id is null or usuario_id = p.usuario_id)
      from crm.perfil() p)
    and exists (select 1 from crm.operaciones o where o.id = operacion_id)
  );

create policy incidencias_update on crm.incidencias
  for update to authenticated
  using ((select p.estado = 'activo' and p.rol in ('supervisor', 'administrador')
           from crm.perfil() p))
  with check ((select p.estado = 'activo' and p.rol in ('supervisor', 'administrador')
                from crm.perfil() p));

grant select, insert, update on crm.incidencias to authenticated;

-- ----------------------------------------------------------------------------
-- incidencia_fotos (§4) — los objetos viven en el bucket privado
-- crm-incidencias (migración 009)
-- ----------------------------------------------------------------------------
create table crm.incidencia_fotos (
  id            uuid primary key default gen_random_uuid(),
  incidencia_id uuid not null references crm.incidencias(id),
  storage_path  text not null,
  uploaded_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index ix_fotos_incidencia on crm.incidencia_fotos (incidencia_id);

create trigger trg_fotos_upd
  before update on crm.incidencia_fotos
  for each row execute function crm.set_updated_at();

alter table crm.incidencia_fotos enable row level security;

create policy fotos_select on crm.incidencia_fotos
  for select to authenticated
  using (
    (select p.estado = 'activo' from crm.perfil() p)
    and exists (select 1 from crm.incidencias i where i.id = incidencia_id)
  );

create policy fotos_insert on crm.incidencia_fotos
  for insert to authenticated
  with check (
    (select p.estado = 'activo'
       and p.rol in ('operador', 'supervisor', 'administrador')
      from crm.perfil() p)
    and exists (select 1 from crm.incidencias i where i.id = incidencia_id)
  );

grant select, insert on crm.incidencia_fotos to authenticated;

-- ----------------------------------------------------------------------------
-- crm_validar_reforzado — SECURITY DEFINER (lista cerrada). contenedores no
-- tiene policy de UPDATE: esta RPC es la única vía, supervisor+ (§7).
-- ----------------------------------------------------------------------------
create or replace function crm.crm_validar_reforzado(
  p_contenedor uuid,
  p_estado text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller record;
begin
  select * into v_caller from crm.perfil();
  if v_caller.estado is distinct from 'activo'
     or v_caller.rol not in ('supervisor', 'administrador') then
    raise exception 'validar reforzado requiere supervisor o administrador activo';
  end if;
  if p_estado is null or p_estado not in
     ('pendiente_validacion', 'confirmado_reforzado', 'confirmado_no_reforzado', 'discrepancia') then
    raise exception 'estado de reforzado inválido: %', p_estado;
  end if;

  update crm.contenedores
     set reforzado_estado = p_estado,
         reforzado_validado_por = v_caller.usuario_id,
         reforzado_fecha_validacion = now()
   where id = p_contenedor;

  if not found then
    raise exception 'contenedor no encontrado';
  end if;
end $$;

grant execute on function crm.crm_validar_reforzado(uuid, text) to authenticated;
