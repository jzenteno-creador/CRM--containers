-- Rollback de la 043 — neutralizador, nunca destructivo. Correr solo con GO de John.
-- alter table crm.bookings drop constraint if exists ck_booking_corte_antes_de_etd;
-- drop trigger if exists trg_usuarios_guard_delete on crm.usuarios;
-- drop index if exists crm.ix_freetime_origin_pais;
-- drop index if exists crm.ix_freetime_destino_pais;
-- El tipo de monto_usd NO se revierte: numeric(12,2) es un subconjunto de numeric,
-- volver atrás no recupera nada (no había datos) y reintroduce la inconsistencia.
select 'rollback 043: comentado — ver cabecera' as nota;
