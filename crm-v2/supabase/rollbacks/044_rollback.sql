-- Rollback de la 044 — NO se provee: volver a la versión de la 021 reintroduce el bug
-- (exceso_actual sin filtro de país → tope de waiver calculado con la tarifa de otro
-- país; medido: 191 de 200 operaciones daban distinto que las views).
-- El cuerpo previo está en crm-v2/supabase/migrations/021_m4_waiver_acumulativo.sql.
select 'rollback 044: intencionalmente vacío — ver cabecera' as nota;
