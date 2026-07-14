-- ═══════════════════════════════════════════════════════════════════════════
-- 034 · M5 — FIX: crm_actualizar_reclamo revienta en incidencias de IMPO
--
-- Hallazgo de la 033 (integración 030↔032): crm.crm_actualizar_reclamo (030)
-- inserta su evento de rastro en crm.operacion_eventos usando
-- v_row.operacion_id SIN condicional. Desde la 032, crm.incidencias.operacion_id
-- es NULLABLE (FK dual — incidencias_op_dual_exactly_one exige exactamente una
-- de operacion_id / operacion_impo_id). Un reclamo sobre una incidencia de
-- importación (operacion_id IS NULL) rompe con NOT NULL violation al insertar
-- en operacion_eventos.operacion_id.
--
-- Fix: CREATE OR REPLACE, mismo patrón que evt_incidencia (032, sección D) —
-- dual-aware: si v_row.operacion_id IS NOT NULL, evento a operacion_eventos
-- (como hoy); si no (operacion_impo_id seteado), evento a
-- operacion_impo_eventos con tipo_evento='incidencia' (ya está en su CHECK,
-- ver 032 sección C) y el MISMO detalle jsonb. Único cambio: el bloque INSERT
-- final. Cero cambios de firma, cero cambios de lógica de negocio (roles,
-- transiciones, validaciones) — CREATE OR REPLACE con signatura idéntica
-- preserva owner (crm_rpc_executor) y grants existentes (revoke all from
-- public/anon + grant execute to authenticated de la 030), verificado post-
-- replace igual.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function crm.crm_actualizar_reclamo(
  p_incidencia_id  uuid,
  p_estado_reclamo text default null,
  p_resultado      text default null,
  p_monto_usd      numeric default null,
  p_responsable    text default null,
  p_nota           text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_perfil            record;
  v_row               record;
  v_next              text;
  v_cambios           jsonb := '{}'::jsonb;
  v_algo              boolean := false;
  v_nuevo_estado      text;
  v_nuevo_resultado   text;
  v_nuevo_monto       numeric;
  v_nuevo_responsable text;
  v_responsable_trim  text := nullif(trim(p_responsable), '');
begin
  select * into v_perfil from crm.perfil();
  if v_perfil.estado is distinct from 'activo'
     or v_perfil.rol is null
     or v_perfil.rol not in ('operador', 'supervisor', 'administrador') then
    raise exception 'actualizar reclamo requiere operador, supervisor o administrador';
  end if;

  select * into v_row from crm.incidencias where id = p_incidencia_id;
  if v_row.id is null then
    raise exception 'incidencia inexistente o fuera de alcance';
  end if;

  v_nuevo_estado      := v_row.estado_reclamo;
  v_nuevo_resultado   := v_row.resultado;
  v_nuevo_monto       := v_row.monto_usd;
  v_nuevo_responsable := v_row.responsable;

  -- Transición de estado: solo supervisor+.
  if p_estado_reclamo is not null and p_estado_reclamo is distinct from v_row.estado_reclamo then
    if v_perfil.rol not in ('supervisor', 'administrador') then
      raise exception 'cambiar el estado del reclamo requiere supervisor o administrador';
    end if;
    if p_estado_reclamo not in ('sin_reclamo', 'abierta', 'reclamada', 'resuelta') then
      raise exception 'estado_reclamo inválido: %', p_estado_reclamo;
    end if;
    v_next := case v_row.estado_reclamo
                when 'sin_reclamo' then 'abierta'
                when 'abierta'     then 'reclamada'
                when 'reclamada'   then 'resuelta'
                else null
              end;
    if v_next is null or p_estado_reclamo <> v_next then
      raise exception 'transicion_invalida: % -> % no permitida (esperada: %)',
        v_row.estado_reclamo, p_estado_reclamo, coalesce(v_next, '(terminal)');
    end if;
    v_nuevo_estado := p_estado_reclamo;
    v_cambios := v_cambios || jsonb_build_object('estado_reclamo',
      jsonb_build_object('de', v_row.estado_reclamo, 'a', p_estado_reclamo));
    v_algo := true;
  end if;

  -- Resultado: atado a la transición a 'resuelta' — mismo gate (supervisor+).
  if p_resultado is not null and p_resultado is distinct from v_row.resultado then
    if v_perfil.rol not in ('supervisor', 'administrador') then
      raise exception 'cambiar el resultado del reclamo requiere supervisor o administrador';
    end if;
    if p_resultado not in ('recuperado', 'no_recuperado') then
      raise exception 'resultado inválido: %', p_resultado;
    end if;
    if v_nuevo_estado <> 'resuelta' then
      raise exception 'el resultado solo se setea al resolver el reclamo (estado_reclamo=resuelta)';
    end if;
    v_nuevo_resultado := p_resultado;
    v_cambios := v_cambios || jsonb_build_object('resultado',
      jsonb_build_object('de', v_row.resultado, 'a', p_resultado));
    v_algo := true;
  end if;

  if v_nuevo_estado = 'resuelta' and v_nuevo_resultado is null then
    raise exception 'resolver_exige_resultado: resolver el reclamo exige resultado (recuperado|no_recuperado)';
  end if;

  -- monto_usd / responsable: operador+ (ya validado arriba).
  if p_monto_usd is not null and p_monto_usd is distinct from v_row.monto_usd then
    if p_monto_usd < 0 then
      raise exception 'monto_usd no puede ser negativo';
    end if;
    v_nuevo_monto := p_monto_usd;
    v_cambios := v_cambios || jsonb_build_object('monto_usd',
      jsonb_build_object('de', v_row.monto_usd, 'a', p_monto_usd));
    v_algo := true;
  end if;

  if v_responsable_trim is not null and v_responsable_trim is distinct from v_row.responsable then
    v_nuevo_responsable := v_responsable_trim;
    v_cambios := v_cambios || jsonb_build_object('responsable',
      jsonb_build_object('de', v_row.responsable, 'a', v_nuevo_responsable));
    v_algo := true;
  end if;

  if p_nota is not null and length(trim(p_nota)) > 0 then
    v_algo := true;
  end if;

  if not v_algo then
    raise exception 'sin_cambios: no se indicó ningún cambio efectivo';
  end if;

  update crm.incidencias
     set estado_reclamo   = v_nuevo_estado,
         resultado        = v_nuevo_resultado,
         monto_usd        = v_nuevo_monto,
         responsable      = v_nuevo_responsable,
         fecha_reclamo    = case when v_nuevo_estado = 'reclamada' and v_row.fecha_reclamo is null
                                  then now() else v_row.fecha_reclamo end,
         fecha_resolucion = case when v_nuevo_estado = 'resuelta' and v_row.fecha_resolucion is null
                                  then now() else v_row.fecha_resolucion end
   where id = p_incidencia_id;
  if not found then
    raise exception 'no se pudo actualizar la incidencia (fuera de alcance)';
  end if;

  -- FIX 034 (dual-aware, patrón evt_incidencia/032): la incidencia cuelga de
  -- operacion_id (expo) O de operacion_impo_id (impo) — nunca ambas, nunca
  -- ninguna (incidencias_op_dual_exactly_one). El evento de rastro va a la
  -- tabla de timeline correspondiente.
  if v_row.operacion_id is not null then
    insert into crm.operacion_eventos (operacion_id, tipo_evento, fecha, usuario_id, detalle)
    values (v_row.operacion_id, 'incidencia', now(), v_perfil.usuario_id,
            jsonb_build_object('accion', 'reclamo', 'incidencia_id', p_incidencia_id,
                                'cambios', v_cambios, 'nota', p_nota));
  elsif v_row.operacion_impo_id is not null then
    insert into crm.operacion_impo_eventos (operacion_impo_id, tipo_evento, fecha, usuario_id, detalle)
    values (v_row.operacion_impo_id, 'incidencia', now(), v_perfil.usuario_id,
            jsonb_build_object('accion', 'reclamo', 'incidencia_id', p_incidencia_id,
                                'cambios', v_cambios, 'nota', p_nota));
  end if;

  return jsonb_build_object(
    'incidencia_id', p_incidencia_id, 'estado_reclamo', v_nuevo_estado,
    'resultado', v_nuevo_resultado, 'monto_usd', v_nuevo_monto,
    'responsable', v_nuevo_responsable, 'cambios', v_cambios);
end $function$;

-- CREATE OR REPLACE con signatura idéntica preserva owner (crm_rpc_executor)
-- y los grants existentes (revoke all from public/anon + grant execute to
-- authenticated, de la 030) — no hace falta repetirlos. Verificado post-apply
-- (ver evidencia de la sesión).

notify pgrst, 'reload schema';
