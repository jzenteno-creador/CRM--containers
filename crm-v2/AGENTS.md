<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Regla de escritura a la DB (sancionada por John, 2026-07-13)

Toda la lógica de negocio vive en Supabase (RPCs + views). El front muestra, no calcula,
y NUNCA escribe directo sobre tablas de plata.

- **PROHIBIDO sin excepción**: `.insert/.update/.delete/.upsert` desde el cliente sobre
  `operaciones`, `operacion_eventos`, `operacion_waivers`, `freetime_origin`,
  `contenedores`, `movimientos_planta`, `incidencias`, `incidencia_fotos`. Todo pasa por
  RPC. Si la RPC no cubre un caso, el output es "falta la RPC" — jamás un write directo
  (regla reforzada tras el B1).
- **SANCIONADO explícitamente** (única lista permitida de escritura directa, siempre
  detrás de las policies de rol): `navieras`, `plantas` (maestros sin impacto en costo —
  `cobra_detention_origen` del maestro es solo default de UI desde la 019),
  `depositos` (maestro sin impacto en costo — catálogo de retiro, 023; el alta inline
  desde /ingreso pasa por `crm_crear_deposito`, pero el CRUD de Admin inserta/actualiza
  directo, mismo patrón que navieras/plantas), `configuracion` (operativa, no toca
  costo), `ayuda_contenido` (contenido de ayuda/tooltips;
  editor de Admin §15.4, sancionado en el brief M4 B3-B; los números del copy se
  interpolan vía `crm_ayuda_valores`, nunca se escriben a mano), `paises` (maestro sin
  impacto en costo — región LATAM/EMEAI/APAC/NAM, migración 026 M5, decisión explícita
  de John 2026-07-14 D4 del plan M5; mismo patrón INSERT/UPDATE admin que
  navieras/plantas/depositos — `freetime_origin`/`freetime_destino` siguen SIN policies
  de escritura, exclusivo vía `crm_nueva_version_freetime`/`_destino`).
- **`incidencias` + `incidencia_fotos` SALIERON de la lista sancionada en la migración 030
  (D6, John 2026-07-14).** Antes tenían escritura directa (alta de M7, con la deuda BE-03:
  no atómico). Desde la 030 son **RPC-only**: alta atómica incidencia+fotos vía
  `crm_crear_incidencia`, fotos adicionales vía `crm_agregar_fotos_incidencia`, ciclo de
  reclamo (monto/responsable/estado_reclamo/resultado, cada edición con rastro en el
  timeline) vía `crm_actualizar_reclamo`. `crm_crear_tanda_retiro` también auto-crea
  incidencias `tipo='no_reforzado'` (INSERT directo, corre como `crm_rpc_executor`) por
  cada contenedor `reforzado=false` de la tanda. `authenticated` perdió INSERT/UPDATE en
  ambas tablas — queda SELECT.
- **`scan_pruebas` ENTRÓ a la lista sancionada (migración 035, decisión explícita de John
  2026-07-18 — PoC escaneo OCR).** TABLA DE PRUEBA (comment en la tabla lo declara): datos
  desechables, sin impacto en costo, CERO FKs, CERO referencias a M5. Escritura directa bajo
  RLS: INSERT con `with check (usuario_id = auth.uid())` (lo hace el route handler
  `/api/vision/scan` reenviando el Bearer del usuario — sin service role), DELETE solo filas
  propias ("limpiar mis escaneos"), SELECT compartido para authenticated, SIN policy de
  UPDATE. Las policies usan SOLO `auth.uid()` — sin gate de `estado_cuenta='activo'`: una
  cuenta pendiente/rechazada con JWT vigente puede leer/insertar en ESTA tabla (aceptado
  para fase de prueba; ratificación pendiente de John en checkpoint). NO volcar PII acá.
- Agregar una tabla a la lista sancionada requiere decisión explícita de John — un PASS
  de verifier no crea excepciones.
- **Enforcement a nivel DB (fix P1 de CP3, migración 025 — APLICADA en prod 2026-07-13,
  registrada `20260713160000`, verificada por 3 verifiers — docs/GATE-025.md):** la regla
  "PROHIBIDO" de arriba ya no vive solo en el front. La 025 hace `REVOKE INSERT/UPDATE` de
  `authenticated` sobre `operaciones`/`movimientos_planta`/`contenedores` y pasa las 6 RPCs
  operativas a `SECURITY DEFINER owner = crm_rpc_executor` (rol sin BYPASSRLS → la RLS sigue
  scopeando por planta). Un PATCH crudo de la anon key → `42501`. Ver docs/FIX-P1-BAKEOFF.md.
  La migración 030 (registrada `20260714180000`) extiende el mismo enforcement a
  `incidencias`/`incidencia_fotos`: `REVOKE INSERT/UPDATE` de `authenticated`, policies de
  escritura scopeadas a `crm_rpc_executor`, 3 RPCs nuevas DEFINER owner=executor. Verificado
  en vivo con la anon key: POST/SELECT REST y RPC → `401`/`42501` (`docs` no generado, ver
  evidencia en la sesión que aplicó la 030).

# Excepción DOCUMENTADA a §14.8 — usuarios_publicos es SECURITY DEFINER a propósito (CP3, 2026-07-13)

La view `crm.usuarios_publicos` (proyecta SOLO `id, nombre`) es **SECURITY DEFINER, NO
security_invoker**, como excepción documentada a §14.8 ("views siempre security_invoker").
**RAZÓN MEDIDA** (CP3, harness — docs/GATE-025.md §2.5): con `security_invoker=true` un operador
ve SOLO su propia fila (n=1 vs n=4) → los nombres de otros usuarios quedan en blanco y el join
de la UI (`"por {nombre}"`, `confirmado_por`) se **ROMPE**. Column-grants `(id,nombre)` tampoco
sirven: el panel Admin lee `email/rol/estado_cuenta` de `usuarios` directo (solicitudes/page.tsx:300).
El leak de la view es SOLO nombres, que §14.6 quiere visibles; la proyección a `(id,nombre)` + el
guard de caller activo son el límite de seguridad. **NO la "arregles" a security_invoker — rompe el
sistema.** Silenciar el advisor 0010 del todo requiere convertirla en función DEFINER + cambiar los
3 `.from("usuarios_publicos")` del front a `.rpc(...)` (un deploy).

# Supervisores GLOBALES — decisión explícita de John (CP3, 2026-07-13)

Los roles `supervisor` y `administrador` NO son planta-scoped: ven y operan sobre las dos plantas
(BAHIA y ABBOTT). Es intencional (spec §7 / §14.4; en la RLS de 004, `operaciones_select/update` usan
`p.rol in ('supervisor','administrador')` SIN condición de planta). Razón: SSB tiene 2 plantas y un
supervisor necesita ver las dos. Los operadores SÍ son planta-scoped.

Consecuencia (auditada en CP3, `docs/AUDIT-4-DEFINER-RPCS.md`): las 4 RPCs de más plata que corren
como DEFINER owner=postgres (waiver, corrección de cerradas, validar_reforzado, versionado de tarifas)
dejan a un supervisor operar cross-planta. **NO es un bug, es el diseño.** El control del waiver/corrección
NO es la RLS, es la **AUDITORÍA**: motivo obligatorio + evento en el timeline + quién y cuándo. Un waiver
indebido queda registrado. **NO "arregles" esto scopeando supervisores por planta sin decisión explícita
de John** — hoy los supervisores ni siquiera tienen `planta_asignada_id` (es null para ellos).

# Constantes que QUEDAN EN CÓDIGO (decisión de John, 2026-07-13)

`contenedores.tipo` (20DC/40DC/40HC) y `movimientos_planta.medio` (camion/tren)
son CHECKs de integridad sobre tablas de plata, NO configurables por Admin. Razón:
el histórico usa 3 tipos y 2 medios, estables hace un año; cambiar una garantía
permanente por flexibilidad que se usa una vez cada tres años es mal negocio. Un tipo
nuevo = migración de 5 minutos. NO dropear estos CHECKs para hacerlos "configurables".

Sí es configurable: `depositos` (retiro_de) — catálogo con alta inline del operador
(023), porque es texto libre de alta frecuencia y su valor es evitar la fragmentación
(Exolgan/EXOLGAN/...), no una barrera de integridad.
