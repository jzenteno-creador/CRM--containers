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

## ⏸ BLOQUEADO EN JOHN (queda muy poco)
1. **HIBP** — Authentication → **Attack Protection** → "Prevent use of leaked passwords"
   (NO está en Policies ni Sign In; requiere plan Pro, que la org tiene).
2. Decisión **carga peligrosa**: sigue abierta (contrato: ¿tarifa/free time distinto para
   peligrosa?). Mientras: flag marcado "no usado por el motor" en Admin. Si se confirma
   diferenciación → desarrollo real (columna en contenedores + filtro en motor).
3. HIBP toggle en Supabase Auth (1 click, John ya tiene acceso al dashboard).
4. Bucket viejo `incidencias`: quedó privado e inerte; baja física desde dashboard.

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
- DB prod: migraciones **hasta 043** aplicadas y verificadas (037-043 todas de hoy). Front prod: deploy del Bloque
  3 (alineados). CI: verde. Backup: cron diario 03:00 AR operativo con alerta.
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
