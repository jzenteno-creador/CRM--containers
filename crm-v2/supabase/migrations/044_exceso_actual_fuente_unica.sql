-- 044: P1 — `exceso_actual()` resolvía la tarifa SIN filtrar por país
-- (hallado 2026-08-02 al trabajar el frente de multi-región; GO de John)
--
-- ══ EL PROBLEMA ══════════════════════════════════════════════════════════════
-- `crm.exceso_actual(operacion)` es el tope de los waivers de EXPORTACIÓN: la RPC
-- `crm_registrar_waiver` la usa para rechazar un waiver mayor al exceso real.
--
-- Su LATERAL de tarifa (migración 021) filtra por naviera + régimen + vigencia,
-- pero **NO por país** — mientras las views (`vista_alertas`,
-- `vista_kpi_costos_cerradas`) sí lo hacen. Con 40 países con tarifa vigente
-- cargada (contrato global, migración 027), el `order by vigente_desde desc limit 1`
-- termina resolviendo la tarifa de un país cualquiera.
--
-- MEDIDO en prod antes de escribir esto: sobre 200 operaciones cerradas con costo,
-- `exceso_actual()` **difiere del exceso de la view en 191**. No es teórico.
--
-- Consecuencia práctica (todavía no observada porque hay 0 waivers cargados): el
-- día que un supervisor registre un waiver legítimo, el tope se calcula con los
-- días libres de otro país → o lo rechaza con un mensaje confuso ("no tiene tarifa
-- vigente que genere costo") o lo topea mal.
--
-- ══ EL FIX ═══════════════════════════════════════════════════════════════════
-- Dejar de duplicar la resolución de tarifa: que `exceso_actual` LEA DE LAS VIEWS,
-- que son la fuente única del motor. Es exactamente el patrón que ya usa
-- `exceso_actual_impo` (migración 039) — que por eso nació sin este problema.
--
-- Con esto, el tope del waiver y el costo que ve el usuario SIEMPRE coinciden, por
-- construcción y no por coincidencia. Y cuando el día de mañana la resolución de
-- tarifa cambie (multi-país real, tramos, lo que sea), cambia en UN solo lugar.
--
-- Semántica preservada: NULL cuando no hay tarifa que genere costo — las views ya
-- devuelven `costo_bruto is null` en ese caso (semáforo 'neutro' / sin_tarifa), y
-- la RPC de waiver sigue rechazando con su mensaje de siempre.
-- `sin_cargo` (modelo deprecado): la view ya lo trata; la RPC además lo rechaza antes.

create or replace function crm.exceso_actual(p_operacion uuid)
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select case when v.costo_bruto is null then null else v.exceso end
    from (
      -- abierta
      select greatest(0, va.dias_estadia - va.dias_libres) as exceso, va.costo_bruto
        from crm.vista_alertas va
       where va.operacion_id = p_operacion
      union all
      -- cerrada
      select greatest(0, cc.dias_estadia - cc.dias_libres) as exceso, cc.costo_bruto
        from crm.vista_kpi_costos_cerradas cc
       where cc.operacion_id = p_operacion
      limit 1
    ) v
$$;

revoke execute on function crm.exceso_actual(uuid) from public, anon;
grant  execute on function crm.exceso_actual(uuid) to authenticated;

comment on function crm.exceso_actual(uuid) is
  'Exceso de días facturables de una operación de exportación (044). Lee DE LAS VIEWS '
  '(fuente única del motor) en vez de re-resolver la tarifa — la versión anterior (021) '
  'no filtraba por país y difería de las views en 191 de 200 casos medidos. Espejo de '
  'crm.exceso_actual_impo.';
