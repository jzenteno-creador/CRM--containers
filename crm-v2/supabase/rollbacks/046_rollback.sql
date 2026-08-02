-- Rollback 046 — push_suscripciones. Reversible sin pérdida operativa: las
-- suscripciones se regeneran solas cuando cada usuario vuelve a activar las
-- notificaciones desde el menú. El front tolera la ausencia de las RPCs (el
-- toggle muestra "No se pudo guardar la suscripción" y no rompe nada más).
drop function if exists crm.crm_push_subscribe(text, text, text, text);
drop function if exists crm.crm_push_unsubscribe(text);
drop table if exists crm.push_suscripciones;
notify pgrst, 'reload schema';
