# Auditoría de seguridad integral — 2026-08-02

**Alcance**: frontend web (crm-v2), rutas de servidor (/api/*), base de datos (advisors + grants), paquete Android (APK v1.1.0) y requisitos de seguridad de Google Play. Ejecutada con 3 agentes en paralelo + verificación propia contra prod. Todos los fixes aplicados el mismo día.

## Veredicto general

**Sin hallazgos ALTOS.** 2 MEDIOS (ambos corregidos y verificados en prod), 4 BAJOS (3 corregidos, 1 documentado), resto INFO/fortalezas.

## Hallazgos y estado

| Sev | Hallazgo | Estado |
|---|---|---|
| MEDIA | **SSRF vía suscripciones push**: `crm_push_subscribe` aceptaba cualquier URL como endpoint; el envío diario le hacía POST ciego server-side | ✅ **CORREGIDO en 2 capas**: migración **047** (CHECK allowlist FCM/Mozilla/Apple/WNS en la tabla — verificado con harness: endpoint interno → `check_violation`, FCM → acepta) + revalidación del mismo allowlist en `/api/push/enviar` (verificado en prod: 169.254.169.254 → `fallidas:1` sin fetch) |
| MEDIA | **Sin headers de seguridad HTTP** (solo HSTS de la plataforma) | ✅ **CORREGIDO**: `next.config.ts headers()` — HSTS explícito, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (cámara solo propia, mic/geo bloqueados). Verificados en prod los 5 |
| BAJA | Secreto push comparado con `!==` (timing attack teórico) | ✅ CORREGIDO: `timingSafeEqual` sobre SHA-256 (longitud fija) |
| BAJA | Sin tope de trabajo en `/api/push/enviar` (array sin cap) | ✅ CORREGIDO: cap 500 suscripciones + títulos/cuerpos/URL con límite de largo |
| BAJA | `notificationclick` navegaba a la URL del payload sin validar | ✅ CORREGIDO: solo paths propios (`/...`, nunca `//` ni absolutas) en sw.js Y en el server |
| BAJA | `allowBackup=true` en el APK (default de Bubblewrap) | 📋 DOCUMENTADO: riesgo bajo en TWA (casi sin storage propio); se endurece en el próximo rebuild del APK — no amerita reinstalación sola |
| WARN | Protección de contraseñas filtradas (HIBP) desactivada | ⏸ **JOHN**: Supabase → Authentication → Attack Protection → 1 toggle |
| INFO | CSP completa ausente | 📋 FUTURO deliberado: exige allowlist (jsdelivr/Supabase/Roboflow) + pasada de prueba en vivo; documentado en next.config.ts |
| INFO | `/api/version` expone build id sin auth | Por diseño (identificador opaco, repo privado, no-store) |

## Advisors de base de datos (50 lints)

- 1 ERROR `usuarios_publicos` SECURITY DEFINER → **excepción documentada** en AGENTS.md (proyección id+nombre, "arreglarla" rompe la UI)
- 44 WARN "DEFINER ejecutable por authenticated" → **es la arquitectura** (RPC-only con guards internos auditados, migraciones 025/030/038/039/041/046)
- 3 INFO en schema `public` → del otro proyecto que comparte la base (intocable por regla)

## Google Play — checklist de seguridad (todo ✓)

targetSdk 36 · firma v1/v2/v3 verificada · permisos mínimos (solo POST_NOTIFICATIONS) · sin cleartext · sin debuggable · componentes exportados solo los requeridos por TWA · huella del cert == assetlinks.json · keystore fuera de git, password con permisos 600 · política de privacidad pública · eliminación de cuenta web + in-app.

## Fortalezas destacadas del front (para el informe a terceros)

Cero sinks de XSS (sin `dangerouslySetInnerHTML`/`innerHTML`/`eval` en todo src/); Markdown renderizado por AST a React (jamás HTML crudo) con filtro de esquemas (`javascript:` cae a texto); sin secretos en el bundle (solo claves públicas por diseño); la API key de Roboflow se redacta de todas las respuestas; uploads con validación de tipo y tamaño; service worker que no cachea datos jamás; sin open redirects; `window.open` con noopener.
