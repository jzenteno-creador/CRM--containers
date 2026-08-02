# Handoff de sesión — 2026-07-31/08-01 (maratón) · CRM Detention v2 · rama v2-rebuild

## Resumen
UNA sesión, cuatro capítulos: (1) limpieza integral del repo + P1 del backup que respaldaba
el schema muerto; (2) **auditoría integral con 6 agentes** (informe:
`docs/auditoria-integral-2026-07-31.md`) + cruce contra el PDF enviado a Dow; (3) John
aprobó TODO el plan → **implementación autónoma de los 4 bloques** (migraciones 037-040
aplicadas con harness, 3 deploys a prod, CI nuevo verde, 101 tests); (4) descubrimiento y
reparación de que **el backup JAMÁS había funcionado** (25/25 corridas fallidas desde el
07/07) → hoy existe el primer backup real del proyecto.
(El handoff de la limpieza matutina quedó en la historia git de este archivo.)

## ✅ EN PRODUCCIÓN (deploys verificados con URL 200)

**Bloque 1 — higiene**: Next 16.2.12 (3 CVEs cerrados) · engines Node fijado · rail con
scroll (1366×768) · pegado con tabs · compresión de fotos de incidencias · AbortController
en modo vivo · /design solo admin · aviso "peligrosa = dato informativo" en Admin→Tarifas.

**Bloque 2 — importación completa**: migración **038** (operador NO crea órdenes en otra
planta; 2 RPCs con guard rol+planta — la RLS del SELECT previo es el candado real, medido;
3 CHECKs de fechas; semáforo split honesto: exceso devengado ⇒ rojo) + migración **039**
(waiver acumulativo impo espejo de 021 CON advisory lock anti-TOCTOU, anulación, corrección
de cerradas whitelist 3 fechas, views con costo NETO + costo_bruto + dias_waiver al final,
CHECK de eventos con 'waiver'). Harness T1-T10 y T1-T9 PASS pre-apply, smoke post-apply.
Front: dashboard combinado expo+impo + pestaña Importación en /reportes.

**Bloque 4 — red de seguridad**: **101 tests** (ISO 6346 con ancla canónica, fechas AR,
43 golden de plata con oráculo TS) · **CI verde** en primera corrida (lint+tsc+test+build,
push y PR) · rate limit 50/min por usuario en /api/vision/scan · **BACKUP FUNCIONANDO**:
3 causas apiladas cazadas en validación end-to-end (gpg sin tty desde el día 1 → secret
SUPABASE_DB_URL que nunca existió (John lo cargó hoy) → wrapper pg_dump 16 vs server 17)
→ run 30672413156 SUCCESS, artifact `crm-db-backup-20260731-2316` (2.0 MB, crm+detention).
Aviso de fallo por mail vía n8n ya activo (probado en vivo). Todo cherry-pickeado a master.

**Bloque 3 — pitch**: migración **040** `vista_kpi_piloto_mensual` (KPIs 2-3-4 del
formulario Dow; calibrada ANTES de crear: 54,4% dentro del free time vs 56% del PDF —
delta = CMA 14vs18 días de M6 + activas en el denominador del PDF, documentado en la
migración) · sección "KPIs del piloto" en /inicio (4 cards + tabla 12 meses) · refresco
automático 60s en /inicio y /alertas con badge honesto · buscador ⌘K conectado de verdad
(expo abiertas/cerradas + impo).

## ✅ SEGUNDA TANDA (GO de John 2026-08-01, "no voy a hacer nada manual")
- **Restore drill AUTOMATIZADO Y ENSAYADO** (`.github/workflows/restore-drill.yml`, en
  master): levanta un Postgres 17 descartable, baja el último backup, restaura
  cronometrado y verifica datos + policies + grants + **que el motor siga calculando
  plata**. Falla fuerte si algo no sobrevive, avisa por n8n. Run 30674909035: **2.959 ops
  intactas, 1.331 con costo, <1s**. Cierra D-02 completo. Hallazgos codificados en el
  workflow: los ROLES son objetos de cluster (no viajan en el dump — crear antes), los
  GRANTS no viajan (`--no-privileges`, reaplicar desde migrations), `auth.uid()` necesita
  stub, `pg_trgm` antes de los índices trigram. Correr tras cada cambio grande de schema.
- **Migración 041 APLICADA**: advisory lock en `crm_registrar_waiver` (expo) — cierra el
  TOCTOU que impo ya tenía cubierto; guards `rol is null or rol not in (...)` en 6 RPCs
  (con rol NULL el NOT IN evaluaba NULL y el guard NO rechazaba). Harness T1-T3 PASS,
  owners verificados (postgres en las 4 de expo, executor en las 2 de impo).
- **Snapshot mensual a Drive VIVO Y PUBLICADO** (n8n `zTQW5xdg2CEYSmG3`): 1° de cada mes
  4AM, baja el artifact y lo sube a Drive (retención larga vs. los 90 días de GH).
  Probado en vivo: `crm-db-backup-20260731-2316.zip` ya está en el Drive de John.
  Credencial `GitHub PAT (backup CRM)` (`iBh8prhKKIrEOhYz`) creada con autorización
  explícita de John.
- **Robustez del front deployada**: caps con badge en importación/prefijos/ingreso/egreso;
  /bookings con naviera+búsqueda server-side (y 2 bugs cazados en el camino: dropdown de
  navieras desde catálogo, y ReasignarModal con fetch propio — con filtro activo no se
  podía rolear a otra naviera); badge de /alertas con conteo real por fuente; fechas como
  date-cells en los exports de /reportes (expo e impo) vía `ymdADate` compartido.
- **README de crm-v2 real** (era el boilerplate de create-next-app).
- `_archivo/` movida ADENTRO del repo y versionada (pedido de John).

## ✅ TERCERA TANDA (2026-08-01, "seguí trabajando")
- **CORREO DIARIO VIVO Y PUBLICADO** — n8n `NvpzO39XqZrTU6UD`, proyecto *export proyect*
  (ahí viven las 2 credenciales), timezone AR fijado, 7AM. Primer envío real verificado:
  "37 en rojo, 0 en amarillo · USD 21.280 proyectado". El draft viejo (`hdDDj5BLJt5wNESm`,
  proyecto personal) quedó ARCHIVADO. John creó la credencial `supabase-crm-containers`.
- **Migración 042 (+042b/c) APLICADA — hallazgo de seguridad serio**: al conectar el mail
  salió `permission denied for schema crm` (service_role nunca tuvo USAGE). Al ir a
  otorgarlo apareció que service_role **SÍ tenía INSERT/UPDATE/DELETE sobre 14 objetos,
  incluidas operaciones/contenedores/freetime_origin** — grants fantasma del default-ACL
  (misma clase que barrió la 033), inertes solo por faltar la USAGE. Otorgar USAGE a secas
  los habría ACTIVADO: escritura cruda a plata bypassando RLS con la service key.
  Orden deliberado: revoke total → USAGE → SELECT mínimo. Las vistas son security_invoker,
  así que hizo falta además SELECT sobre las 11 tablas base + EXECUTE sobre
  dias_con_convencion/hoy_ar, todo enumerado por dependencia real (pg_depend), no a ojo.
  Verificación 12/12: LEE lo del resumen, NO ESCRIBE NADA, NO EJECUTA RPCs de plata.
- **Migración 043 APLICADA** (higiene P3, harness T1-T2 PASS): monto_usd → numeric(12,2);
  CHECK fecha_corte ≤ etd en bookings; índices por país en freetime_origin/destino;
  **trigger guard en el borrado de usuarios** — antes tiraba un error de FK ilegible, ahora
  nombra tabla y cantidad de referencias y explica que la baja es lógica. El chequeo
  recorre pg_constraint: cubre las 20 FKs actuales y las futuras solo.
- **2 P2 más cerrados**: el "5" del Excel de Omar ahora interpola el umbral real (con el
  valor de hoy el archivo sale IDÉNTICO al de Omar — la fidelidad que pidió John se
  conserva; si cambia, el rótulo sigue al dato); los regímenes `cargados`/`sin_uso` quedan
  deshabilitados en Admin→Tarifas con el motivo a la vista (el motor usa 'vacios' fijo).
- **gate-019-sandbox BORRADO** por John (verificado vacío antes: 0 tablas de usuario, 0
  usuarios, 0 migraciones) · bucket viejo `incidencias` BORRADO por John.

## ✅ CUARTA TANDA (2026-08-01, "hacé lo que puedas independientemente")
- **Importador de tarifas por Excel EN PROD** (`admin/tarifas/importar-excel.tsx`): cierra
  la promesa del pitch de que preparar el piloto es CONFIGURACIÓN, no desarrollo. 3 pasos
  (cargar → preview fila por fila con ✅/⚠️/❌ → importar), encabezados con sinónimos,
  plantilla descargable, tope 500 filas, escritura 100% por `crm_nueva_version_freetime`
  secuencial. El preview SIMULA el efecto atómico de la RPC contra las vigentes, así una
  fila duplicada del mismo archivo se compara contra lo que dejaría la anterior. Solo
  ORIGEN (destino no tiene régimen y usa 3 contadores: es otro desarrollo).
- **Carga peligrosa: DECIDIDA** — John (2026-08-01): la operación NO diferencia condiciones.
  El flag queda como anotación de contrato; copy de Admin actualizado y AGENTS.md documenta
  qué haría falta si algún contrato futuro sí diferenciara (dato a nivel contenedor + filtro
  en views + rehacer `ux_freetime_vigente`, que hoy NO incluye el flag → cargar una
  "peligrosa" CIERRA la normal en vez de coexistir).
- **Barrido de advisors post-todo**: 47 lints vs 45 al empezar. El delta son los 2 warnings
  esperables del patrón DEFINER por las RPCs nuevas; el WARN del bucket público
  DESAPARECIÓ (John lo borró). Cero problemas nuevos introducidos.
- **i18n MEDIDO** (para responderle a Dow con un número real, no una estimación): ~730
  textos de UI en 82 archivos + 27 puntos de formato es-AR + 95 textos de ayuda en la DB +
  **39 mensajes de error escritos en español DENTRO de las RPCs** (esto último es lo que
  nadie ve venir: traducirlos exige devolver códigos en vez de frases y toca funciones de
  plata). Total realista: **4-5 semanas**. Recomendación: no empezarlo hasta que Dow lo
  confirme — el piloto es en español y una migración transversal a medias no aporta nada.
- **`_archivo/` adentro del repo** y `docs/Modelo LOGIN VGM SISTEMA E-Cargo.xlsx`
  gitignoreado (queda local, pedido de John).

## ✅ QUINTA TANDA (2026-08-02, "seguí" / "continue" + tarea Android)
- **Motor drill EN MASTER Y VERDE** (`.github/workflows/motor-drill.yml`): restaura el
  último backup en Postgres 17 descartable y corre `crm-v2/tests/golden-motor.sql` — los
  43 casos golden contra la **view real**, no el oráculo TS. Veredictos:
  OK / DIVERGENCIA_CONOCIDA / REGRESION (falla el job) / FALTA. Primer run: 36 exactos +
  7 divergencias conocidas (categoría `devuelto_vacio`: el golden dice waiver-total, la
  view cobra — son las 11 operaciones waiver pendientes de decisión de John,
  USD ~14-15,5k).
- **Migración 044 APLICADA — P1 nuevo cazado post-auditoría**: `exceso_actual` re-resolvía
  la tarifa con su propio LATERAL SIN filtro de país → con el contrato global de 40 países,
  **191 de 200 operaciones daban distinto que las views**. Es el tope de los waivers: el
  primer waiver real de Omar habría salido mal topeado. Fix: leer DE las views (fuente
  única). Hash del costo total pre/post IDÉNTICO (`1f070fb9…`, USD 621.285) — el fix no
  movió un centavo del cálculo. **Migración 045**: `dias_facturables` deprecada (mismo
  defecto, cero consumidores). Regla "fuente única" documentada en AGENTS.md.
- **Multi-región documentada como NOT-NOW** en AGENTS.md: la única deuda real es la TZ
  hardcodeada (45 puntos); Brasil comparte offset, solo importa MX/CO/PE cerca de
  medianoche. Plan de 4 pasos escrito; no ejecutar sin operación fuera de AR/BR.
- **📱 APP ANDROID CONSTRUIDA, FIRMADA E INSTALADA EN EL S25 DE JOHN** ("me encanta").
  Arquitectura PWA+TWA: manifest + sw.js (navegación network-only: jamás plata vieja) +
  /offline + **/privacidad (Ley 25.326)** + íconos → deploy prod; `assetlinks.json` con la
  huella real del certificado (verificada idéntica vía apksigner). Bubblewrap 1.25 con
  toolchain propio en `~/.bubblewrap/` (JDK 17 Temurin + build-tools 36.1.0 + symlink
  legacy `tools/bin`). Package `com.ssbint.crmdetention`. **Release GitHub
  `app-android-v1.0.0`** con APK (1,0 MB) y AAB. Keystore + password SOLO locales en
  `android/` (gitignored). **Kit Play Store completo en `android/PLAY-STORE.md`** (ficha,
  Data Safety, IARC, prueba cerrada, paso post-subida de Play App Signing) + gráfico
  destacado 1024×500 generado.

## ✅ SEXTA TANDA (2026-08-02, "mejorala" + "todas" + "requerimientos de Google Store, todos")
- **Aviso de versión nueva EN PROD**: build sellado (NEXT_PUBLIC_BUILD_ID; gotcha:
  VERCEL_GIT_COMMIT_SHA en CLI deploys es STRING VACÍO → `||`, no `??`), /api/version,
  UpdateAlert compara al volver a primer plano y cada 15 min → aviso persistente con
  botón Actualizar. Demo disparada con deploy encadenado.
- **Pasada mobile EN PROD** (relevamiento por agente + fixes): tab bar de app (Inicio ·
  Alertas con contador rojo · Ingreso · Escanear directo a cámara · hoja "Más" con el
  resto + buscador) reemplaza la tira scrolleable de 13 solapas; store compartido
  `lib/pendientes` (un poller para campana y barra); piso táctil `.fd-btn` 44px
  !important en ≤640 (había botones de 18-23px: el inline pisaba la regla global);
  `.fd-iconbtn` 40px; **viewport-fit=cover** (sin él TODOS los env(safe-area-inset-*)
  valían 0 — estaban inertes). Tablas ya OK (DataTable trae overflow-x).
- **Cumplimiento Google Play COMPLETO (lado técnico)**: página pública /eliminar-cuenta
  (política de Datos del Usuario: qué se borra, qué se conserva y por qué, 30 días) +
  link desde /privacidad + ítem "Eliminar mi cuenta" en el menú de la app (la política
  exige ambos accesos). targetSdk 36 ≥ exigencia 2026. Kit administrativo ya estaba
  (PLAY-STORE.md).
- **APK v1.1.0** (release `app-android-v1.1.0`, misma firma → se instala ENCIMA):
  shortcuts del ícono (Alertas/Escanear/Ingreso — el crash escapeGradleString de v1.0
  era el formato web-manifest; el correcto es ShortcutInfo con chosenIconUrl) +
  `enableNotifications: true` (POST_NOTIFICATIONS). Gotcha: bubblewrap update deja
  versionName vacío → parchear app/build.gradle antes del build.
- **PUSH DEL RESUMEN DIARIO VIVO** (ejecución 36851 verde de punta a punta):
  migración **046 APLICADA** (push_suscripciones RPC-only; authenticated sin SELECT;
  service_role SELECT+DELETE solo acá; gotcha medido: ON CONFLICT DO UPDATE exige
  policy de SELECT del executor aunque "solo escriba") · /api/push/enviar en Vercel
  (VAPID privada solo en env; secreto compartido; 401 sin secreto verificado) ·
  sw.js con push+notificationclick · menú "Activar notificaciones" con confirmación
  local inmediata · workflow n8n v2 publicado (rama ¿Hay rojos?→suscripciones→envío→
  limpieza de vencidas 404/410; push SOLO con rojos, el mail no cambia). Credencial
  "CRM push secret" (CBFdmSD9nNPjyBjS) transferida al proyecto por API (la CLI 1.9.3
  no tiene transfer; PUT /credentials/:id/transfer → 204).
- Executor SIN CREATE en schema crm en prod (algo lo revocó post-030) → la 046 lo
  otorga y lo revoca al final; patrón para futuras migraciones con alter owner.

## ✅ SÉPTIMA TANDA (2026-08-02, seguridad "todos los requerimientos" + optimización "todas" + apertura de marca)
- **Auditoría de seguridad integral** (3 agentes + advisors + verificación propia): CERO
  ALTOS. Informe: `docs/auditoria-seguridad-2026-08-02.md`. Fixes APLICADOS: anti-SSRF
  en 2 capas (migración **047** CHECK allowlist push-services + revalidación en route,
  ambas verificadas), 5 headers de seguridad en prod, timingSafeEqual, caps de payload,
  notificationclick solo paths propios. APK **v1.2.0** (allowBackup=false, release
  publicado). HIBP: NO disponible (plan free — la memoria "org Pro" era de la OTRA org);
  mitigación real: aprobación manual de cuentas.
- **Optimización (medida, no teoría)**: subset propio de Tabler **825 KB → 23 KB** (−97%,
  CDN eliminado; scripts/subset-tabler.mjs — gotcha: GSUB de Tabler rota, se dropea) ·
  caché de catálogos con TTL 5min + invalidaciones (20 sitios; las consultas históricas
  con filas inactivas quedaron a propósito sin caché) · prefetchFieldHelp en lote (6→1
  requests por form) · ficha de contenedor: 5 awaits en fila india → Promise.all
  (~400-600ms) · CSP Report-Only activa (self + Supabase; promover tras observación).
  DB advisors performance: todo INFO, nada urgente a escala actual.
- **Apertura de marca (pedido "algo disruptivo, vale 10.000")**: BootSplash Flight Deck —
  contenedor dibujándose en trazos cian + reloj ámbar del ícono + wordmark SSB·DETENTION
  con línea de escaneo; max(carga, 1.4s), reduced-motion → estática. Reemplaza el
  skeleton del gate. **Pendiente de smoke visual de John** (nada de esto se vio en
  pantalla real).
- **Push VERIFICADO con John en vivo**: suscripción real (2 dispositivos), envío
  enviadas:2, notificación de confirmación vista en el S25. Detalle abierto: aparece
  atribuida a "Chrome" — v1.0 no declaraba el DelegationService; con v1.1+ instalada se
  corrige cuando Chrome refresca su registro (arranque en frío / forzar detención de
  Chrome). Cosmético.
- **REGLA nueva (feedback John)**: la app registra costo DEVENGADO; pagado/facturado NO
  está modelado — jamás cargar waivers para reconciliar. Futuro: módulo validación de
  facturas de naviera (memoria `costo-devengado-vs-facturado`).

## ⏸ BLOQUEADO EN JOHN (queda muy poco)
1. ~~HIBP~~ **NO DISPONIBLE — plan free** (John lo intentó 2026-08-02: pide Pro; la
   memoria "la org tiene Pro" era de la OTRA org, no la de cctuowth). Mitigación real
   vigente: toda cuenta nueva exige aprobación manual de un admin — una contraseña
   filtrada sola no da acceso. Retomar si algún día se upgradea el plan.
2. ~~Decisión waivers `devuelto_vacio`~~ **RESUELTO por John (2026-08-02): NO se cargan.**
   La app registra costo DEVENGADO; pagado/facturado no está modelado — cargar waivers
   sin evidencia sería inventar un hecho comercial. Las 7 divergencias del motor drill
   quedan como CONOCIDAS permanentes. **Desarrollo futuro (idea de John): módulo de
   validación de facturas de naviera** — match factura vs contenedores contra las views
   de costo, semáforo por línea (coincide / de más → reclamo / no esperado / sin factura).
3. **Backup del keystore Android a Drive**: `android/crm-ssb.keystore` +
   `keystore-password.txt` — SOLO existen en su disco.
4. **Google Play (si quiere)**: cuenta dev (USD 25, personal vs organización — ver
   `android/PLAY-STORE.md` §0), 2+ capturas desde el S25, usuario de revisión para Google.
   Tras subir: pasar la huella de Play App Signing → Claude la agrega al assetlinks.

## Pendientes de trabajo (no bloqueados)
- ~~UI de waiver/corrección impo~~ ✅ **HECHA Y EN PROD** (2026-08-01):
  `importacion/acciones-plata.tsx`, botón "Plata" por fila en las 4 secciones, gate
  supervisor+admin doble. La corrección de fechas queda construida pero inalcanzable desde
  ese entry point (la página solo lista estados abiertos) — deliberado, el modal es
  reusable el día que exista una vista de cerradas.
- **Verificación visual**: John la hace él (dicho 2026-08-01). Nada de lo deployado se vio
  en pantalla real — todo el análisis fue estático. Mirar especialmente: rail en laptop
  1366×768, sección KPIs del piloto en /inicio, ⌘K, pestaña Importación en /reportes.
- Deudas P2/P3 del informe no incluidas en los bloques (fetch caps, prorrateo KPI,
  tarifa por tramos MOTOR↔NAVIERA, i18n, Realtime real, importador Excel de tarifas):
  ver `docs/auditoria-integral-2026-07-31.md` §3/§7 fase 2.

## Decisiones de John HOY (todas ejecutadas)
- GO a todo el plan de la auditoría; trabajo autónomo con multiagentes y modelos baratos.
- Migraciones y deploys a prod autorizados ("autorizado todo").
- Prefijos: supervisor+admin RATIFICADO → AGENTS.md actualizado (cierra D4).
- Correo diario: a jzenteno@ solo, destinatarios configurables después.
- Vercel Node 22.x fijado (dashboard) · secret SUPABASE_DB_URL cargado · proyecto Supabase
  renombrado a `crm-containers` · `gate-019-sandbox` identificado como borrable (~USD 10/mes).

## Estado técnico exacto
- `v2-rebuild` == origin (HEAD tras docs de ratificación); `master` == origin con los 4
  cherry-picks de infra (fix schema crm, aviso n8n, fix pg_dump 17, restore-drill). Working tree limpio
  salvo untracked de John (`docs/Modelo LOGIN VGM SISTEMA E-Cargo.xlsx` — sin clasificar,
  John no explicó qué es).
- DB prod: migraciones **hasta 046** aplicadas y verificadas. Front prod: PWA completa
  (manifest/sw con push/offline/privacidad/eliminar-cuenta/assetlinks) + pasada mobile +
  aviso de versión. CI: verde. Backup: cron diario 03:00 AR + motor drill en master.
- Android: release **`app-android-v1.1.0`** (misma huella `9A:2E:…:F2:B9`; shortcuts +
  notificaciones), toolchain en `~/.bubblewrap/`, config en `android/twa-manifest.json`.
- n8n: mail diario v2 con rama push (`NvpzO39XqZrTU6UD`), snapshot mensual, credencial
  push `CBFdmSD9nNPjyBjS` en proyecto *export proyect*. VAPID en env de Vercel (público/
  privado/subject) + PUSH_ENDPOINT_SECRET (mismo valor en la credencial n8n).
- n8n: 2 workflows ACTIVOS del CRM — mail diario `NvpzO39XqZrTU6UD` (7AM, proyecto
  *export proyect*) y snapshot mensual `zTQW5xdg2CEYSmG3` (día 1, 4AM). Draft viejo archivado.

## Contexto no obvio (lecciones del día)
- **El fix sugerido por un auditor puede romper prod**: el DROP de las policies huérfanas
  (004) habría matado las RPCs — el rebind (`ALTER POLICY ... TO crm_rpc_executor`) fue el
  fix correcto. Verificar SIEMPRE contra pg_policies + harness antes de aplicar fixes de
  terceros (incluidos agentes propios).
- **perfil() matchea por `auth_user_id`, no por `usuarios.id`** — simular contexto en
  harness requiere el uuid de auth.users.
- **`create or replace view` NO permite intercalar columnas** — las nuevas van AL FINAL.
- **Los runners de GH ya traen keyring PGDG y pg_dump 16**: gpg necesita `--batch --yes` y
  pg_dump 17 ruta explícita `/usr/lib/postgresql/17/bin/pg_dump`.
- **GHA `schedule:` corre solo desde la rama default (master)** — todo fix de workflow
  necesita cherry-pick; el dispatch manual desde otra rama da verde y engaña.
- El rechazo cross-planta en RPCs impo sale como `estado_no_valido` (RLS oculta la fila),
  no `fuera_de_alcance` — es deseable (no filtra existencia) y está documentado en la 038.
- n8n: NINGUNA credencial existente apunta al proyecto del CRM — "supabase-ssb-inbox-service"
  es xkppk (schema inbox_triage no existe en cctuowth, verificado).
