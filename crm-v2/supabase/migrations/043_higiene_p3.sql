-- 043: higiene P3 del informe de auditoría (2026-07-31) — GO de John 2026-08-01
--
-- Cuatro deudas menores, todas verificadas como ausentes antes de escribir esto.
-- `bookings` e `incidencias` tienen 0 filas hoy (medido) → agregar constraints es
-- riesgo cero: no hay dato existente que pueda violarlas.

-- ═══ (1) monto_usd sin escala fija ═══
-- El resto de la plata del sistema usa numeric(N,2) (tarifas: numeric(10,2)).
-- `incidencias.monto_usd` quedó como numeric a secas: aceptaba 3+ decimales que el
-- resto del sistema no espera. 12,2 da margen para reclamos grandes.
alter table crm.incidencias
  alter column monto_usd type numeric(12,2);

-- ═══ (2) bookings: el corte no puede ser posterior al ETD ═══
-- La fecha de corte documental/de carga siempre precede (o iguala) la salida del
-- buque. Sin este CHECK se podía cargar invertido y el semáforo de saldo mentía.
alter table crm.bookings
  add constraint ck_booking_corte_antes_de_etd
    check (fecha_corte is null or etd is null or fecha_corte <= etd);

-- ═══ (3) Índices por país en las tarifas ═══
-- Admin → Tarifas filtra por país (`.eq("pais_id", …)`) sobre 730 filas de origen y
-- 1.441 de destino. El único índice que incluía pais_id es el único parcial de
-- vigencia (`where vigente_hasta is null`), que no cubre la consulta del historial
-- completo (soloVigentes=false).
create index if not exists ix_freetime_origin_pais  on crm.freetime_origin  (pais_id);
create index if not exists ix_freetime_destino_pais on crm.freetime_destino (pais_id);

-- ═══ (4) Borrar un usuario con historial: error legible en vez de críptico ═══
-- Borrar un usuario desde el panel de Auth de Supabase cascadea a `crm.usuarios`
-- (única FK con CASCADE del schema, migración 003) y ahí choca contra ~18 FKs
-- NO ACTION → excepción de FK ilegible, borrado abortado a medias.
-- El patrón soportado es el borrado LÓGICO (`set_estado_usuario('suspendido')`).
-- Este trigger lo dice con todas las letras ANTES de que Postgres tire el error feo.
--
-- El chequeo es DINÁMICO (recorre pg_constraint): una FK nueva a `usuarios` en una
-- migración futura queda cubierta sola, sin tener que acordarse de tocar esto.
create or replace function crm.guard_usuarios_delete()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  r record;
  v_n bigint;
  v_refs text := '';
begin
  for r in
    select c.conrelid::regclass::text as tabla,
           (select a.attname from pg_attribute a
             where a.attrelid = c.conrelid and a.attnum = c.conkey[1]) as columna
      from pg_constraint c
     where c.contype = 'f'
       and c.confrelid = 'crm.usuarios'::regclass
  loop
    execute format('select count(*) from %s where %I = $1', r.tabla, r.columna)
      into v_n using old.id;
    if v_n > 0 then
      v_refs := v_refs || format('%s.%s (%s), ', r.tabla, r.columna, v_n);
    end if;
  end loop;

  if v_refs <> '' then
    raise exception
      'No se puede borrar el usuario %: tiene historial operativo en %. Usá la baja lógica (Admin → Solicitudes → suspender, o crm.set_estado_usuario) — el historial de quién hizo qué es auditoría y no se borra.',
      old.email, rtrim(v_refs, ', ');
  end if;

  return old;
end $fn$;

drop trigger if exists trg_usuarios_guard_delete on crm.usuarios;
create trigger trg_usuarios_guard_delete
  before delete on crm.usuarios
  for each row execute function crm.guard_usuarios_delete();

revoke execute on function crm.guard_usuarios_delete() from public, anon, authenticated;
