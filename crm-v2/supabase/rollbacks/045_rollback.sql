-- Rollback de la 045: devolver el EXECUTE reexpone una función con un bug de plata
-- conocido (tarifa sin filtro de país) que no usa nadie. Si aun así hace falta:
--   grant execute on function crm.dias_facturables(timestamptz, timestamptz, uuid, text) to authenticated;
select 'rollback 045: ver cabecera' as nota;
