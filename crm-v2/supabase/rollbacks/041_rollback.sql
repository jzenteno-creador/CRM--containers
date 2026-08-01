-- Rollback de la 041 — NO se provee: revertir significa REABRIR el TOCTOU del waiver
-- expo y volver a guards de rol que no rechazan con rol NULL. Los cuerpos de la 041 son
-- estrictamente más seguros y funcionalmente equivalentes (harness T1-T3 PASS).
-- Si de verdad hiciera falta: los cuerpos previos están en 006 (anular), 020 (corregir),
-- 021 (waiver/anular waiver) y 032/038 (las dos impo).
select 'rollback 041: intencionalmente vacío — ver cabecera' as nota;
