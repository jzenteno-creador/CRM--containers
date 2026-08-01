# Auditoría integral — CRM Detention de Contenedores
**2026-07-31 · rama `v2-rebuild` (`3c2df3d`+) · prod: crm-detention.vercel.app · DB: schema `crm` @ `cctuowthpnstvdgjuomq`**

> Método: 6 agentes Sonnet en paralelo (arquitectura/calidad, seguridad, DB/migraciones,
> lógica de plata, UI/runtime, longevidad) sobre el 100% del código de `crm-v2/` y las 36
> migraciones + verificaciones en vivo read-only contra prod (advisors, tamaños, conteos)
> + lectura completa del PDF enviado a Dow (23 págs). Síntesis y cruce: Fable (loop
> principal). Cero writes, cero DDL, cero deploys.

---

## 1. Veredicto ejecutivo

**El sistema es sólido donde más importa y frágil donde nadie miró.** El motor de costos
de exportación —lo que se validó contra 2.922 liquidaciones de Omar al 95,8%— está bien
construido: fuente única de conteo de días, `numeric` sin floats, tarifas sin solapes,
waivers acotados matemáticamente, front 100% passthrough. La calidad de línea es alta:
`tsc` y lint en cero, strict mode, cero `console.log`/`any`/TODOs en `src/`, manejo de
errores consistente en ~35 páginas.

Los problemas reales están en tres frentes:

1. **El módulo de Importación (migración 032) salió sin la revisión que tuvo el resto** —
   tiene 2 huecos de autorización cross-planta, no tiene waiver ni corrección de cerradas,
   y su costo realizado se calcula pero no se muestra en ningún lado. Coincide con la deuda
   ya anotada: el reviewer estricto de M5 nunca corrió sobre ese bloque.
2. **Tres promesas de la presentación a Dow no tienen respaldo en el código**: idioma
   ES/PT/EN "como configuración" (cero infraestructura i18n), "actualización en tiempo
   real" (cero Realtime; hay un badge "EN VIVO" que no está conectado a nada), y el
   "resumen periódico automático por correo" (no existe).
3. **No hay red de seguridad**: cero tests ejecutables (los golden files de plata están
   huérfanos), cero CI, y el sistema depende de servicios free-tier sin monitoreo de
   límites ni alertas de fallo. Para un sistema pensado a años vista, ese es el riesgo
   estructural más grande.

Nada de lo encontrado indica corrupción de datos activa. Prod hoy: 2.959 operaciones expo,
0 impo, 0 bookings, 0 incidencias, 3 usuarios activos, 46 MB de 500 MB.

---

## 2. P1 — Fallos que corregir antes de operar en serio

### 2.1 Seguridad / autorización (módulo Importación, migración 032)
`[CONFIANZA: por construcción — análisis estático, pendiente de ejercitar en harness]`

| # | Fallo | Evidencia | Escenario |
|---|---|---|---|
| A | `crm_crear_orden_impo` no ata `planta_destino_id` al operador | 032 ~L475-522: toma la planta del payload, solo valida rol; policies `with check (true)` sin backstop `to authenticated` | Operador de Planta A crea órdenes que aparecen en la cola de Planta B. En expo esto es imposible (la RLS de `movimientos_planta` scopea incluso corriendo como executor); en impo esa red nunca se creó |
| B | `crm_confirmar_ingreso_planta_impo` y `crm_registrar_salida_devolucion_impo` no chequean rol ni planta | 032 L690-773: solo `estado='activo'`, UPDATE por UUID sin scope | Cualquier usuario activo muta operaciones de otra planta si conoce el UUID. Mitigado hoy: el UUID ajeno no se filtra por ninguna vista — pero el invariante "operadores planta-scoped" no está defendido por nada en esas 2 rutas. Las otras 2 RPCs de la MISMA migración sí lo hacen bien |
| C | Policies permisivas de la 004 nunca se droppearon | 025 revocó grants pero dejó las policies vivas (la 030 sí limpió las suyas) | Si una migración futura re-otorga el grant por error, se reabre el P1 de CP3 **peor**: la policy de INSERT permite fijar `sin_cargo`/`waiver_dias` directo, y el guard-trigger solo cubre UPDATE |

**Fix A/B**: mismo patrón que ya usan `crm_confirmar_retiro_terminal`/`crm_confirmar_devolucion_impo`
(SELECT previo scopeado + forzar/validar planta del operador). **Fix C**: `drop policy` × 5,
patrón de la 030. Todo junto es una migración chica + verificación en harness.

### 2.2 Lógica de plata

| # | Fallo | Evidencia | Estado en prod (verificado en vivo) |
|---|---|---|---|
| D | `aplica_carga_peligrosa` se carga y se muestra pero el motor lo **ignora** en todos los cálculos; el índice de vigencia única tampoco lo distingue | 002/026 + Admin→Tarifas; ningún WHERE lo usa | **ACTIVO**: 459/730 vigentes de origen y 963/1441 de destino tienen `peligrosa=true` (en ARG: 10 de 14). La única tarifa vigente de la mayoría de las navieras está marcada "peligrosa" y se aplica a TODOS los contenedores. Decisión de negocio requerida: ¿el flag es anotación del contrato (inofensivo) o condición de aplicación (el motor cobra mal)? |
| E | Impo sin `waiver` ni `corregir_operacion_cerrada` | 032: cero matches; expo los tiene (020/021) | Latente (0 ops impo), pero la presentación promete impo desde el día 1 del piloto. Es exactamente el caso de la regla "falta la RPC" |
| F | Costo realizado de impo invisible: `vista_kpi_resumen_impo.costo_mes/ytd` se calcula y hasta se trae al dashboard, pero nunca se lee; `/reportes` solo exporta expo | `inicio/page.tsx:189-190` (tarjetas sin calificador "expo"), `reportes` `SELECT_BASE` | Latente hoy; el día que cierre la primera impo con demurrage, ese dólar no aparece en ningún número ni Excel del sistema |

### 2.3 Promesas a Dow sin respaldo (ver §4 para el cruce completo)

| # | Promesa (PDF) | Realidad |
|---|---|---|
| G | "idioma (español, portugués e inglés) son configuración, no código" (pág. 20) | Cero i18n: sin librería, sin diccionarios, strings en español en ~90 archivos, `es-AR`+TZ Argentina hardcodeados en ≥10 puntos. Hoy es reescritura transversal, no un flag |
| H | "actualización en tiempo real" (págs. 9 y 20) | Cero Supabase Realtime en el código. Fetch al montar + refetch al foco. El shell muestra un badge **"EN VIVO"** pulsante en `/inicio` sin ningún mecanismo detrás — un monitor de pared queda stale horas |
| I | "resumen periódico automático por correo a la gerencia" (págs. 9 y 20) | No existe (deuda n8n conocida) |

### 2.4 Infraestructura / runtime

| # | Fallo | Fix |
|---|---|---|
| J | Next 16.2.10 con 3 CVEs HIGH (middleware bypass, DoS y SSRF en Server Actions); mitigado porque no usamos ni middleware ni Server Actions | `npm install next@16.2.12` (patch, sin breaking) + deploy |
| K | Bucket `crm-incidencias` (evidencia de reclamos = plata en disputas) **sin** `file_size_limit` ni `allowed_mime_types`, y las fotos suben **sin comprimir** desde el celu (8-15 MB posibles). El bucket del PoC desechable sí tiene todo (5 MB, jpeg/png, resize 1280px). Está al revés | Migración espejo de la 036 + compresión client-side reutilizando `capturarFrame()` |
| L | Rail de navegación desktop clipea: ~714 px de contenido mínimo en un `position:fixed` sin `overflow-y`; una laptop 1366×768 tiene ~590-640 px útiles → últimas solapas inalcanzables. Es la resolución típica de la laptop del pitch | 1 línea CSS (`overflow-y:auto`) + verificación visual |
| M | Cero tests ejecutables + cero CI: `tests/golden-costos.json` (43 casos de plata) no lo consume nadie; ninguna verificación automática entre un refactor y prod | Vitest + workflow CI (`lint`+`tsc`+`build`+golden) |
| N | Sin `engines` en package.json ni pin de Node: la versión la decide el default de Vercel, que cambia cada 1-2 años → build futuro puede fallar sin tocar código | `"engines": {"node": ">=20.9.0"}` + fijar en dashboard |

---

## 3. P2 — Deudas con riesgo real

**Plata / motor**
- Semáforo de impo en modo split ignora el exceso ya devengado del reloj de demurrage: una op con USD 300 ya generados puede mostrarse **verde** tras el retiro (032 L1206-1209).
- KPIs mes/YTD imputan el 100% del costo a la fecha de devolución, sin prorrateo: una op que cruza el 31/12 carga todo al año nuevo. Consistente, pero distorsiona la lectura mensual — documentar o prorratear.
- Cambio de tarifa a mitad de ciclo nunca parte el cálculo (toda la op cobra la tarifa vigente al retiro). Si el contrato real factura por tramos, subfacturamos tras cada suba. **Confirmar contra una factura real de naviera** — es la deuda MOTOR↔NAVIERA de siempre.
- Régimen `cargados`/`sin_uso` seleccionable en Admin pero el motor hardcodea `vacios` — fila queda inerte sin aviso (hoy 0 filas así en prod, verificado).
- "VENCE > 5 DÍAS" hardcodeado en el Excel Omar vs umbral configurable. Hoy coincide de casualidad (config real = 5, verificado en vivo); si Admin lo cambia, el Excel miente.
- Tarifa de origen usa el país de la planta destino como proxy del país de retiro — inofensivo con 100% Argentina, bomba de tiempo idéntica a la que la 026 desactivó, para el primer cross-border.
- TOCTOU en `crm_registrar_waiver` (dos supervisores simultáneos pueden exceder el exceso auditado; `costo_neto` queda protegido por el clamp) — falta `FOR UPDATE`/advisory lock.

**Seguridad**
- `/api/vision/scan` sin rate limiting server-side: cualquier cuenta (incluso `pendiente_aprobacion` — el gate de estado no aplica ahí) puede quemar créditos Roboflow en loop.
- TOCTOU del dedup del modo vivo (sin constraint único que lo respalde).
- `prefijos_restringidos`: escritura directa citando una sección "B6" de AGENTS.md **que no existe**. La RLS es correcta (supervisor+); falta la ratificación formal tuya (checkpoint pendiente desde D4) y el reflejo en el documento canónico.
- Bucket `incidencias` (v1, vacío) **público y listable** — advisor WARN en vivo. Borrarlo o privatizarlo.
- Protección de contraseñas filtradas (HIBP) desactivada en Auth — un toggle.

**DB / integridad**
- `operaciones_impo` sin CHECKs de coherencia de fechas (expo tiene 3) — la validación vive solo en las RPCs.
- Borrar un usuario desde el panel de Auth dispara cascade contra ~15 FKs `NO ACTION` → excepción opaca. Documentar que el hard-delete está bloqueado por diseño o trigger con mensaje claro.
- `monto_usd` de incidencias `numeric` sin escala (el resto usa `numeric(10,2)`).
- `bookings.fecha_corte` sin CHECK contra `etd` (se puede cargar invertido).
- RLS de `scan_pruebas` re-evalúa `auth.uid()` por fila (antipatrón initplan, advisor WARN) — `(select auth.uid())`, 2 líneas.

**UI / runtime**
- Buscador global ⌘K: 3 afordances activos en el shell que llevan a "se conecta con M5" — y M5 ya pasó. Conectarlo o quitarlo.
- `parar()` del modo vivo sin `AbortController`: el POST en vuelo sigue gastando datos móviles y cómputo tras "Detener" (respuesta descartada correctamente, sin leak).
- Fetches sin `.limit()` defensivo: importación (4 secciones), prefijos (2 queries), ingreso/egreso.
- Filtro de naviera en bookings es client-side sobre un dataset ya capado a 500 → puede mostrar lista incompleta sin aviso (contenedores lo resuelve server-side; copiar ese patrón).
- Badge de alertas dice "primeras 500" pero el dataset combinado expo+impo puede llegar a ~1000.

**Proceso / plataforma**
- `xlsx@0.18.5` congelado para siempre en npm con CVEs sin fix (SheetJS ya no publica ahí). Hoy solo escribimos (no explotable); cualquier feature futura de "importar Excel" NO debe usar `npm install xlsx`. Además está en `dependencies` y solo lo usa un script ya ejecutado.
- Backup: sin alerta activa de fallo (si la password rota, muere en silencio hasta que alguien mire Actions); retención 90 días = cero defensa contra corrupción detectada tarde; `pg_dump 17` pineado que habrá que bumpear cuando Supabase migre a PG 18; restore jamás ensayado y el dump no trae GRANTs (el modelo de seguridad entero).
- Roboflow: workspace `jzs-workspace` — cuenta personal, no de organización. Bus factor.

---

## 4. Cruce contra la presentación enviada a Dow (PDF, 2026-07-31)

La vara que fija el propio documento (pág. 9): *"El alcance funcional ya está construido,
por lo que las 8 semanas son de puesta en marcha y adopción, no de desarrollo"* — y los
7 módulos *"disponibles desde el inicio del piloto con ajustes mínimos"*.

| Promesa | Estado real | Riesgo si Dow selecciona |
|---|---|---|
| (1) Free time expo: tanda, ISO 6346, cálculo diario, semáforo, sin-cargo trazados | ✅ Construido y validado (95,8% vs Omar) | Bajo. Cerrar D (peligrosa) antes |
| (2) Ciclo completo impo con reglas por naviera | ⚠️ Construido pero sin waiver/corrección (E), costo invisible (F), semáforo split engañoso, y los huecos de authz (A/B). 0 ops reales lo han ejercitado | **Alto** — es "construido sin estrenar". Necesita el paquete impo completo + smoke antes del piloto |
| (3) Visión en portón | ✅ Framing honesto: "etapa posterior al piloto". El PoC existe y funciona | Bajo. El OCR real nunca se probó con foto de producción (pendiente tuyo desde el 18/07) |
| (4) Bookings y roleo, alertas de corte | ⚠️ Construido, 0 filas reales; filtro de naviera puede ocultar datos (P2) | Medio — smoke con datos reales |
| (5) Incidencias con fotos y reclamo | ⚠️ Construido; bucket sin límites ni compresión (K) | Medio |
| (6) Prefijos restringidos + barrido | ✅ Construido; falta tu ratificación formal del "supervisor+" (P2) | Bajo |
| (7a) Excel con filtros | ✅ `/reportes` es configurable de verdad (columnas+filtros server-side) | Bajo |
| (7b) **Resumen periódico automático por correo** | ❌ No existe | **Alto** — es la pieza que también sostiene el criterio de éxito "ningún vencimiento sin alerta previa": si nadie abre la app, hoy no hay alerta que llegue sola |
| "Actualización en **tiempo real**" | ❌ Cero Realtime; badge "EN VIVO" sin respaldo | **Alto** en demo/pitch: es visible y es falsable en vivo |
| "Idioma ES/PT/EN = configuración, no código" | ❌ Cero i18n | Medio-alto: irrelevante para el piloto (Bahía Blanca, español), crítico para la promesa de réplica LATAM que es el corazón del pitch de escalabilidad |
| "Auditoría completa de cambios" | ✅ expo vía RPCs+timeline · ⚠️ impo sin RPC de corrección = sin rastro posible | Medio |
| "Posibilidad de conexión por API" | ⚠️ Redactado como "posibilidad" — no hay API pública, pero PostgREST+RPCs son una base real. Defendible si se pregunta | Bajo |
| **4 KPIs medidos mensualmente** (pág. 14): costo/mes/naviera · días estadía y demora · % dentro de free time · cobertura de trazabilidad | ⚠️ El 1º existe (`vista_kpi_costo_naviera`). Los otros 3 **no existen como métrica en el sistema** — son los números con los que se va a juzgar el piloto | **Alto** — comprometiste medición mensual de KPIs que hoy habría que calcular a mano |
| Preparación del piloto: "2 semanas: cargar histórico y configurar navieras/tarifas/free time" | ⚠️ Hoy es proceso de desarrollador (script m6 + carga manual de tarifas), no feature del producto. Falta el importador de tarifas (deuda M5 conocida) | Medio |
| "Replicable cambiando parámetros" | ⚠️ Multi-país estructural existe (026, 98 países); pero TZ Argentina hardcodeada, país de retiro por proxy, e i18n — la réplica real fuera de ARG hoy toca código | Medio (post-piloto) |

**Lectura estratégica**: la presentación es honesta en lo grande (visión como etapa
posterior, números reales, "posibilidad" de API) y está sobrevendida en cuatro puntos
concretos: tiempo real, correo automático, idioma y KPIs automáticos. Los cuatro son
construibles — dos de ellos (correo, KPIs) en días, no meses — pero conviene tenerlos
cerrados **antes del pitch**, porque son exactamente lo que un evaluador técnico de Dow
puede pedir ver en vivo.

---

## 5. Longevidad — qué se rompe solo, y cuándo

**Ya roto / rompible hoy**
- CVEs de Next (J) · bucket de incidencias sin límites (K) · rail en laptops 768p (L) · badge EN VIVO (H).

**Meses**
- Rotación de password de Supabase → backup muere **en silencio** (sin alerta de fallo).
- Cuenta personal de Roboflow (créditos/acceso) → escaneo OCR muere.
- Storage: cada foto de incidencia sin comprimir acerca el tope de 1 GB; sin monitoreo, el primer aviso será un upload fallido en planta.

**1-2 años**
- Vercel cambia su default de Node → build falla sin tocar código (N).
- Drift de dependencias: pins exactos que nadie bumpea + `xlsx` congelado con CVE permanente → fatiga de alertas.
- `scan_pruebas` sin purga + RLS por-fila → degradación gradual.

**3-5 años**
- Views KPI agregan sobre TODO el histórico cerrado en cada carga de `/inicio` (a 15-60k ops se siente; hoy 3k, instantáneo). Fix conocido: filtro en la base view o materialized view con refresh.
- Supabase migra el proyecto a PG 18 → `pg_dump 17` del backup deja de matchear.
- Google decommisiona el bucket de modelos TF.js → la solapa cámara muere (mirror local = ~1 MB).
- Retención 90 días del backup: cualquier corrupción detectada a >3 meses ya está en todos los backups disponibles. Falta un snapshot mensual de retención larga (Drive vía n8n, ya está en el stack).
- EOL de Postgres 17 (~2029-2030).

**Siempre**
- Cero tests/CI: la primera regresión de plata la detecta un humano mirando un número raro en prod, no una máquina. Para un sistema multi-año con mantenimiento esporádico, esta es la inversión #1.
- Bus factor: README de crm-v2 es el boilerplate de create-next-app; el conocimiento real vive en AGENTS.md/spec/docs — consolidar puertas de entrada. Nota: si la org de Supabase ya está en Pro, evaluar subir ESTE proyecto a Pro para el piloto — PITR resolvería D-02 de raíz.

---

## 6. Lo que está sólido (y conviene no tocar)

- Motor expo: fuente única de días (`dias_con_convencion`), `numeric` puro, sin huecos ni solapes de vigencia, waivers con clamp matemático (`costo_neto` jamás negativo), front passthrough.
- ISO 6346 correcto (tabla 10-38 salteando 11/22/33, dígito 10→0).
- Parseo de fechas "-03:00" consistente en TODOS los puntos que arman timestamptz (cero `new Date("YYYY-MM-DD")` sueltos — la lección del −1 día está aplicada).
- Modelo de escritura: 17 writes directos clasificados, todos sancionados (salvo el matiz prefijos); RPCs executor sin BYPASSRLS; grants fantasma barridos (033); cero XSS; secretos limpios; key de Roboflow redactada en todos los caminos.
- Cámara sin fugas en todos los caminos de error; focus-trap correcto; cero botones-ícono sin aria-label; TF.js/SheetJS lazy; estados loading/error/empty disciplinados en ~15 páginas.
- Proceso: migraciones auto-documentadas con decisiones y desvíos marcados; el barrido 032→033 es auditoría interna funcionando.

---

## 7. Plan propuesto (a tu decisión)

**Fase 0 — higiene inmediata (~1 día de trabajo, sin decisiones de negocio)**
1. `next@16.2.12` + deploy (J)
2. `overflow-y:auto` en el rail + verificación visual (L)
3. Quitar o conectar el badge "EN VIVO" (H, versión mínima: polling 60s como la campana)
4. Tab en el parser de pegado (bug real de 1 carácter)
5. `engines` + Node fijo en Vercel (N)
6. Límites+compresión en bucket `crm-incidencias` (K) · borrar/privatizar bucket `incidencias` v1
7. Drop de las 5 policies huérfanas de la 004 (C)
8. `(select auth.uid())` en scan_pruebas · HIBP on · gate `/design`

**Fase 1 — antes de cualquier piloto (1-2 semanas)**
9. Paquete impo completo: fix authz (A/B) + waiver/corrección (E) + costo visible en dashboard y reportes (F) + CHECKs de fechas — con harness y verificación independiente
10. Los 3 KPIs faltantes del piloto como views + página (días estadía/demora, % dentro de free time, cobertura) — es lo que Dow va a pedir ver
11. Correo gerencial automático (n8n ya está en el stack; cierra promesa + "ningún vencimiento sin alerta previa")
12. CI + golden tests ejecutables (M) — la red para todo lo anterior
13. Rate limit en `/api/vision/scan` + constraint del dedup
14. Decisiones tuyas: semántica de `aplica_carga_peligrosa` (D) · ratificación prefijos · validar contra UNA factura real de naviera (MOTOR↔NAVIERA — la deuda madre del motor)

**Fase 2 — para la réplica prometida (post-selección, planificable)**
15. i18n real (decisión estratégica: es transversal, ~90 archivos — dimensionar antes del pitch para responder con fechas honestas)
16. Realtime real o rewording honesto en UI y pitch
17. Importador Excel de tarifas (cierra "2 semanas de preparación" como feature)
18. País de retiro real + TZ por planta (pre-requisito de operar fuera de ARG)
19. Backup: alerta de fallo → n8n · snapshot mensual a Drive · ensayo de restore cronometrado · (o proyecto a Pro con PITR)

---

## 8. Confianza y límites de esta auditoría

- Los P1 de authz de impo (A/B/C) son **por construcción**: lectura estática de las 36
  migraciones, no ejercitados contra la DB (regla del proyecto: un invariante no probado
  contra el harness es una suposición — el paso natural es replicar el patrón del bake-off
  de CP3 antes del fix).
- Nada visual fue verificado en pantalla (browsers MCP rotos en WSL): el clipping del rail
  es aritmética de CSS, no captura.
- El golden set valida MOTOR↔EXCEL(Omar), no MOTOR↔NAVIERA — la factura real sigue siendo
  la única verdad no cruzada.
- Los 6 reportes de agentes declararon sus propias zonas no cubiertas (seeds completos de
  la 027, `npm run build` end-to-end, componentes fd menores, runtime real).
