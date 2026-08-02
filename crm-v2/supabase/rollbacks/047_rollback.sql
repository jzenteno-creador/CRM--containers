-- Rollback 047 — quitar el allowlist de push services (deja la defensa solo en
-- la capa del route handler /api/push/enviar).
alter table crm.push_suscripciones drop constraint if exists ck_push_endpoint_service;
