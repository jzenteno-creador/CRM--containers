-- ═══════════════════════════════════════════════════════════════════════════
-- 047 · ANTI-SSRF — allowlist de push services en push_suscripciones
-- ═══════════════════════════════════════════════════════════════════════════
-- Hallazgo MEDIA de la auditoría de seguridad 2026-08-02: crm_push_subscribe
-- (046) acepta cualquier texto como endpoint. Una cuenta activa podía registrar
-- una URL interna (ej. metadata service) y el envío diario le hacía POST ciego
-- server-side desde Vercel. Fix en dos capas: este CHECK (bloquea el write, la
-- RPC lo hereda) + revalidación del mismo allowlist en /api/push/enviar (el
-- route no confía en el contenido de la tabla).
-- Pre-check en prod: 0 filas existentes violan el CHECK (2 suscripciones FCM).

alter table crm.push_suscripciones
  add constraint ck_push_endpoint_service check (
    endpoint like 'https://fcm.googleapis.com/%'
    or endpoint like 'https://updates.push.services.mozilla.com/%'
    or endpoint like 'https://web.push.apple.com/%'
    or endpoint ~ '^https://[a-z0-9.-]+\.notify\.windows\.com/'
  );

comment on constraint ck_push_endpoint_service on crm.push_suscripciones is
  'Anti-SSRF: solo endpoints de push services conocidos (FCM/Mozilla/Apple/WNS). Espejo en /api/push/enviar.';
