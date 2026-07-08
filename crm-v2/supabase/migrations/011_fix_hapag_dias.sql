-- 011 — Corrección de seed: HAPAG LLOYD = 14 días libres (decisión de John, CP1 2026-07-08)
--
-- La discrepancia v1↔Excel reportada en el entregable CP1 (v1: 14 días · Excel: 21)
-- la resolvió John en CP1: "son 14 días" — la v1 tenía el valor correcto y el Excel
-- queda desmentido en este punto. ZIM queda como Excel (21d/$25): la versión 0d/$84
-- de la disputa NO entra salvo confirmación de negocio (se agregaría desde Admin,
-- versionada vía crm_nueva_version_freetime).
--
-- Se corrige con UPDATE directo (excepción documentada a "nunca UPDATE de tarifa"):
-- esto es la corrección de un error de SEED pre-go-live (cero operaciones en la DB),
-- no un cambio de tarifa del negocio. Versionarlo dejaría vigente el valor erróneo
-- para retiros históricos entre 2025-05-01 y hoy.

update crm.freetime_origin f
set dias_libres = 14
from crm.navieras n
where f.naviera_id = n.id
  and n.nombre = 'HAPAG LLOYD'
  and f.regimen = 'vacios'
  and f.vigente_hasta is null
  and f.dias_libres = 21;

-- Guard: si el UPDATE no tocó exactamente 1 fila, abortar la migración.
do $$
declare v_dias int;
begin
  select f.dias_libres into v_dias
  from crm.freetime_origin f
  join crm.navieras n on n.id = f.naviera_id
  where n.nombre = 'HAPAG LLOYD' and f.regimen = 'vacios' and f.vigente_hasta is null;
  if v_dias is distinct from 14 then
    raise exception 'HAPAG LLOYD esperado 14 días vigentes, encontrado: %', v_dias;
  end if;
end $$;
