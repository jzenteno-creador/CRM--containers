# M5 — Plan maestro refinado · Impo, Bookings, Multi-región
**CRM Detention v2 · rama `v2-rebuild` · 2026-07-14 · Fable 5 (orquestador) + Sonnet (workers)**

> Refinamiento del `PLAN-M5-IMPO-BOOKINGS-MULTIREGION.md` de John, cruzado contra evidencia real:
> 3 agentes de exploración (Excels, DB live `cctuowthpnstvdgjuomq`, front crm-v2) + query directa a
> `freetime_origin` vigente. Estado: **GO de John 2026-07-14 — dudas D1–D7 RESUELTAS (ver §15)**.
> Ejecución autónoma en curso: Fable orquesta, Sonnet workers, verifier independiente por bloque.

---

## 0. Qué cambió respecto del plan original (evidencia → decisión)

| # | Evidencia encontrada | Impacto en el plan |
|---|---|---|
| 1 | Excels traen **730 / 1441** filas reales (las "732/1443" incluían 2 filas de footer basura por hoja: fila vacía + `"No filters applied"`) | Conteos del verifier ajustados; el seed filtra el footer |
| 2 | **684 filas de destino traen Combined Y split simultáneos**, y en el 78% `Combined ≠ Dem + Det` — son políticas independientes, no derivables | La regla "split si viene, Combined si no" necesita cubrir el caso "vienen ambos" (§3, duda D2). Se guardan los 3 campos tal cual |
| 3 | MSC destino Argentina trae `Combined=21, Dem=0, Det=0` | La regla de relojes debe tratar split `0/0` como "no split" (guard `> 0`) |
| 4 | Origen trae columna **`Freetime Type`** (Combined/Detention/Demurrage) que varía por fila dentro de la misma naviera | `freetime_origin` **ya tiene** la columna `tipo` con ese mismo check ✓ — el seed la puebla tal cual |
| 5 | Countries **no son ISO puros**: `SPAIN (Barcelona)`, `U.A.E Hub`, `CHINA (SHANGHAI DIT HUB)`... | Modelo: `pais` base normalizado + columna `hub` nullable (§2) |
| 6 | Suppliers mezclan navieras y forwarders — y `crm.navieras` **ya los mezcla hoy** (DHL, DSV, CEVA, DP World entre las 14 existentes) | Sumar `tipo_proveedor` + flag `activa` para no ensuciar los combos operativos (§2, duda D5) |
| 7 | **Tarifas planas** — 0 lanes con más de una fila ⇒ no hay tiers por rango de días | Motor simple: 1 rate escalar por lane+equipo. Sin tabla de tiers |
| 8 | DB vigente verificada: Maersk **14** ✓, Hapag **14** ✓ (fix 011), CMA **18** ✗, ZIM **21** ✗, **MSC 15** ⚠ | Corrección pendiente real = CMA y ZIM. MSC 15→14 es duda D1 |
| 9 | **Gotcha motor multi-región**: `ux_freetime_vigente` es `(naviera_id, regimen)` y el LATERAL JOIN de `vista_alertas`/`vista_kpi_costos_cerradas` **no filtra por `pais`** — con 2 países cargados la vista tomaría cualquier tarifa | B1 DEBE cambiar el índice único + los 2 LATERAL JOINs, o el multi-región es un bug latente |
| 10 | `detention.prefijos_restringidos` (legacy, read-only) tiene **37 filas reales** | B6 seedea desde ahí (lectura de referencia permitida por §21) — Omar no arranca de cero |
| 11 | `ComboboxCreatable` ya existe y es el único combobox (filtro y creatable según `onCreate`) | B3/B4 cero componentes nuevos |
| 12 | `/auth/actualizar-password` **ya existe** (246 líneas, maneja tokens y link vencido); falta SOLO el branch `PASSWORD_RECOVERY` en `src/lib/session.tsx:108` | B8.1 es un fix de ~15 líneas, no una página nueva |
| 13 | Patrón **snapshot text + FK** ya existe en el repo (`retiro_de` congelado + `retiro_de_id`→`depositos`, fix 023) | B3 usa el mismo patrón para `booking_retiro`/`booking_asignado` |
| 14 | `operaciones.producto`/`gmid` existen como texto legacy (congeladas por trigger guard) | B4 las supersede con catálogo + líneas; quedan como snapshot congelado (patrón del repo) |
| 15 | `incidencias` hoy es escritura directa sancionada con deuda **BE-03** (alta no atómica) | B5 agrega `monto_usd`/reclamo ⇒ propongo pasarla a RPC-only (resuelve BE-03) — duda D6 |
| 16 | Existe pipeline EDI 301/304 en schema `public` (bookings_301: 763 filas, cron cada minuto) | NO se toca en M5. Anotado en deuda: integración futura bookings EDI ↔ `crm.bookings` |
| 17 | `AGENTS.md` dice "migración 025 pendiente de aplicar" pero la 025 **está aplicada y verificada** (registrada `20260713160000`) | B0 corrige la línea |

---

## 1. B0 — Sincronizar repo (previo a todo)

Commit atómico `chore: sync repo with prod (migration 025 + gate docs)`:
- `crm-v2/supabase/migrations/025_fix_p1_rpc_executor.sql`
- `docs/GATE-025.md` · `docs/FIX-P1-BAKEOFF.md` · `docs/CP3-VERIFY.md` · `docs/AUDIT-4-DEFINER-RPCS.md` · `docs/fix-p1/`
- `SESSION_HANDOFF.md`, `crm-v2/AGENTS.md` modificados — **y actualizar en AGENTS.md la línea "025 pendiente de aplicar" → aplicada 2026-07-13** (evidencia #17)
- Este plan (`docs/M5-PLAN-MAESTRO.md`) + el plan original de John.

Excluir: PDFs/Excels del caso de negocio y Dow Summit (ruido ajeno al rebuild; los dos Excels de free time
SÍ se versionan — son la fuente del seed → moverlos a `docs/m5/fuentes/`).

**Reset demo al inicio de B1** (datos actuales = test de John, confirmado 2026-07-14): simplifica el
reseed de tarifas sin histórico que preservar.

## 2. B1 — Contrato global de free time + multi-región

### Modelo (decisiones tomadas)
- **`crm.paises`** (catálogo): `id, nombre` (país base normalizado, UNIQUE), `region` check
  (`LATAM|EMEAI|APAC|NAM`), `activo`. Seed desde los países base de ambos Excels. Alta desde Admin
  (caso Brasil). Escritura directa sancionada estilo `plantas` (maestro sin plata) — requiere sanción D4.
- **Normalización de country**: `'SPAIN (Barcelona)'` → `pais=SPAIN` + **`hub='Barcelona'`** (columna
  nullable en las tablas de tarifas). El motor solo usa filas `hub IS NULL` (los hubs se guardan por
  completitud del contrato, no aplican a la operación actual). Mapping de normalización documentado en el seed.
- **`crm.plantas`**: + `pais_id` FK default ARGENTINA.
- **`crm.navieras`**: + `tipo_proveedor` check (`naviera|forwarder`) + `activa` bool. Los ~20 suppliers
  nuevos del contrato entran `activa=false` (duda D5): los combos operativos (Ingreso/Egreso/Impo) filtran
  `activa=true`; Admin/tarifas muestran todo. Mapping de nombres vs las 14 existentes vía
  `configuracion.alias_navieras_historico` + mapping explícito (evita duplicar MSC/ZIM/Hapag por variantes de nombre).
- **`crm.freetime_origin`** (extender, ya versionada): + `pais_id` FK (migrar la columna `pais` text actual),
  + `hub` text null, + `freetime_reefer` int, + `tarifa_reefer_usd_dia` numeric. `tipo` y
  `aplica_carga_peligrosa` ya existen ✓. **Índice único vigente pasa a
  `(naviera_id, regimen, pais_id, coalesce(hub,''))  WHERE vigente_hasta IS NULL`**.
- **`crm.freetime_destino`** (nueva, misma filosofía versionada + `convencion_conteo`): `naviera_id`,
  `pais_id`, `hub` null, `dias_combined` null, `dias_demurrage` null, `dias_detention` null,
  `aplica_carga_peligrosa` **nullable** (5.6% de filas sin dato), `tarifa_dry_usd_dia` null,
  `tarifa_reefer_usd_dia` null, `freetime_reefer` null, vigencias. Los 3 campos de días se guardan
  **tal cual vienen** (evidencia #2: Combined no es derivable). RLS: SELECT para activos; escritura solo
  vía RPC de versionado (patrón `crm_nueva_version_freetime`, extendida o gemela para destino).
- **Motor origen — fix del gotcha #9**: los LATERAL JOIN de `vista_alertas` y `vista_kpi_costos_cerradas`
  suman `and f.pais_id = <pais de la planta de la operación> and f.hub is null`. Mismo cambio en
  `dias_facturables`/`exceso_actual` si aplica.
- **Corrección Argentina** (D1 resuelta — set EXACTO): CMA 18→14, ZIM 21→14, MSC 15→14. Maersk y Hapag
  ya en 14, NADA MÁS se toca; el resto de líneas a valor contrato. Se seedea el contrato tal cual y en las
  3 filas ajustadas se deja **`nota`** (columna nueva text null en ambas tablas de tarifas) documentando el
  valor original del contrato + "ajuste operativo confirmado por O. Pérez 2026-07-13" — así el próximo
  Excel del cliente no pisa el ajuste sin que se note.
  ⚠ cierre definitivo vía MOTOR↔NAVIERA con factura real (acción John, deuda previa).
- **Admin tarifas**: la página existente (`admin/tarifas/page.tsx`) gana pestaña Origen/Destino, **filtro
  de país con ARGENTINA como default**, búsqueda por naviera/destino, edición versionada por fila.
  Importador de Excel con diff = **deuda anotada**, no se construye.

### Seed (verificable)
- Origen: 730 filas (footer excluido). Destino: 1441 (footer excluido; 3 filas Hyundai sin ningún dato de
  días se seedean con días null → semáforo `neutro`, documentadas).
- Regimen: todo entra como `vacios` (el Excel no trae esa dimensión; el motor hoy solo consume `vacios`).

## 3. B2 — Módulo Importación (requiere B1)

### Decisión estructural: tablas separadas (no unificar con `operaciones`)
La máquina de estados expo (`en_transito_a_planta→en_planta→en_transito_a_terminal→cerrado`) está horneada
en RPCs con guards anti-carrera, RLS, triggers y 6 vistas. Impo tiene estados y relojes distintos. Unificar
= tocar todo lo existente (riesgo de regresión alto); separar = módulo paralelo limpio que replica patrones.

- **`crm.ordenes_impo`** (cabecera): `numero_orden`, `naviera_id`, `booking_bl`, `buque` null,
  `fecha_arribo_terminal`, `planta_destino_id`.
- **`crm.operaciones_impo`** (detalle, 1–4 por orden): `orden_id` FK, `contenedor_id` FK (reutiliza el
  maestro `contenedores`), `fecha_retiro_terminal` null (default compartida, editable por fila),
  `fecha_ingreso_planta` null, `fecha_devolucion` null, `estado` check
  (`en_terminal|en_transito_a_planta|en_planta|en_transito_devolucion|cerrado|anulada`), anulación soft.
- **Guard "un ciclo abierto por contenedor" cross expo/impo**: índice único parcial en cada tabla + check
  cruzado dentro de las RPCs de alta con `pg_advisory_xact_lock(hashtext(contenedor_id::text))` (los dos
  altas pasan por RPC, el lock elimina la carrera entre tablas).
- **Timeline**: `crm.operacion_impo_eventos` espejo de `operacion_eventos` (triggers propios; cero riesgo
  sobre los triggers expo existentes). El componente `Timeline` del front se reutiliza tal cual.
- **RPCs owner `crm_rpc_executor` desde el día 1** (regla dura #1): `crm_crear_orden_impo`,
  `crm_confirmar_retiro_terminal`, `crm_confirmar_ingreso_planta_impo`, `crm_confirmar_devolucion_impo`,
  `crm_anular_operacion_impo`. Grants: cero write directo de `authenticated` sobre las 3 tablas nuevas.
- **Motor destino** (`vista_alertas_impo` + vista de cerradas impo):
  - Un reloj (Combined): arribo → devolución (o `now()`), inclusive, vs `dias_combined`.
  - Dos relojes: demurrage = arribo → retiro terminal vs `dias_demurrage`; detention = retiro → devolución
    vs `dias_detention`. Costo = suma de ambos excesos × la **misma** `tarifa_dry_usd_dia` (el contrato trae
    UN rate por lane, no rates separados — evidencia #7).
  - **Regla de selección parametrizada** en `configuracion` (`impo_regla_relojes`), default propuesto:
    split si `dias_demurrage`/`dias_detention` no nulos **y** `dem+det > 0` (guard evidencia #3);
    si no, Combined. Caso "ambos con valores >0" = duda D2. Ajustable sin migración de datos.
  - Timezone AR + regla inclusiva heredadas (`dias_con_convencion`). ⚠ VERIFY con primera liquidación real.
- **UI**: solapa **Importación** espejo de Ingreso/Egreso (Fase 1 alta de orden: encabezado una vez + filas
  con pegado/tipeo, ISO 6346, prefijos B6, defaults por fila; Fase 2 pendientes: confirmar retiro/ingreso/
  devolución con selección múltiple). Copia el patrón canónico de página del repo.
- **Alertas**: impo entra en la solapa Alertas existente con columna EXPO/IMPO (front mergea las 2 vistas
  o vista UNION `vista_alertas_combinada` — decide el worker con el reviewer). Dashboard: KPI impo separado + total combinado.

## 4. B3 — Bookings expo (ficticios, roleo, reasignación)

- **`crm.bookings`**: `numero` + `naviera_id` (UNIQUE compuesto), `etd` **NOT NULL**, `fecha_corte` null,
  `buque` null, `tipo` check (`retiro|embarque`), `estado` check (`activo|cancelado|cumplido`), `notas`.
  **Escritura RPC-only** (propuesta, duda D4): `crm_crear_booking` (alta inline), `crm_rolear_booking`
  (nuevo ETD/buque + evento), `crm_reasignar_contenedores_booking` (motivo check `roleo_naviera|correccion|otro`
  + evento por contenedor). Sin UPDATE directo — el roleo ES auditoría, mismo argumento del fix P1.
- **`operaciones`**: + `booking_retiro_id` FK null + `booking_asignado_id` FK null; los campos texto
  existentes quedan como snapshot congelado (patrón `retiro_de`, evidencia #13).
- **Ingreso**: `crm_crear_tanda_retiro` v2 exige booking (alta inline `ComboboxCreatable` con **ETD
  obligatorio** — modal mínimo al crear). Egreso: `booking_asignado` igual, con descuento de saldo.
- **`vista_bookings_saldo`**: bookings de retiro activos, contenedores restantes en planta, ETD, días a
  ETD, semáforo con umbral `configuracion.umbral_alerta_booking` (default 4 — sin hardcode, regla dura #3).
- **Vista Bookings** (página nueva) + alerta "pedir roleo" integrada en solapa Alertas.
- Eventos de roleo/reasignación → `operacion_eventos` de cada contenedor afectado (extensión del check
  `tipo_evento` con `roleo` y `reasignacion_booking`) con quién/cuándo/motivo.

## 5. B4 — Consolidación / llenos-vacíos

- **`crm.productos`**: `gmid` UNIQUE (clave Dow) + `descripcion`. Alta inline `ComboboxCreatable` vía RPC
  `crm_crear_producto` (patrón depositos).
- **`crm.consolidaciones`**: `operacion_id`, `producto_id`, `cantidad_bolsas`, `lote` null — N líneas por
  operación (multi-producto/multi-lote desde el día 1, UI empieza simple).
- **`operaciones.estado_carga`** check (`vacio|lleno`) default `vacio`. Cambios SOLO vía RPCs
  `crm_consolidar(operacion_id, lineas jsonb)` / `crm_desconsolidar(operacion_id)` → evento `carga` en timeline
  (el tipo ya existe en el check). Ingreso de tanda: default vacío + opción lleno (caso inter-planta).
- **Informativo, no tarifario** (v1): no toca el motor ni el `regimen` — duda D3.
- Ficha del contenedor: acciones Consolidar/Desconsolidar en `contenedores/[id]/acciones.tsx`. Listados,
  ficha y reportes muestran lleno/vacío + producto(s).

## 6. B5 — Incidencias ampliadas

- Tipos nuevos en el check: `lavado_exigido`, `dano_refaccion`, `no_reforzado` (+ los 3 actuales).
- Columnas nuevas: `numero_orden` null, `monto_usd` null, `responsable` null (texto libre o naviera),
  `estado_reclamo` check (`sin_reclamo|abierta|reclamada|resuelta`) default `sin_reclamo`,
  `resultado` check (`recuperado|no_recuperado`) null, `fecha_reclamo`/`fecha_resolucion` null.
- **FK dual**: `operacion_id` null + `operacion_impo_id` null + check exactly-one (aplican a expo e impo).
- **Pasan a RPC-only** (propuesta, duda D6): `crm_crear_incidencia` (atómica con fotos → resuelve BE-03) +
  `crm_actualizar_reclamo` (transiciones válidas + evento). Con `monto_usd` la tabla pasa a ser "de plata".
- **No reforzado al retiro**: destildar "reforzado" en la tanda → `crm_crear_tanda_retiro` auto-genera
  incidencia `no_reforzado` + alerta. Notificación email (n8n) = deuda anotada.

## 7. B6 — Prefijos restringidos (AMPLIADO por John en el GO)

- **`crm.prefijos_restringidos`**: `prefijo` char(4) UNIQUE, `activo`, `nota` null, fechas.
  **Seed desde `detention.prefijos_restringidos` (37 filas, lectura legacy OK §21)** — evidencia #10.
- **Solapa propia** (pedido explícito de John, NO un rincón de Admin): página dedicada para cargar y
  actualizar la lista (Omar la refresca ~julio y diciembre). Escritura directa sancionada (D4: GO),
  RLS admin-only… ⚠ ajuste: si la solapa es de Omar (operador/supervisor), la policy de escritura va a
  supervisor+ — decide el worker contra el rol real de Omar, con default supervisor+.
- Validación al pegar (ingreso expo E impo): warning fuerte por fila + confirmación explícita; si confirma,
  la RPC de alta genera incidencia tipo `prefijo_restringido` (se suma al check de B5). No bloqueo duro.
- **NUEVO — Barrido retroactivo sobre el stock** (pedido explícito de John): al actualizar la lista, y
  también a demanda (botón), detectar contenedores YA cargados (expo abiertas + impo abiertas) cuyo
  prefijo pasó a restringido → alerta visible (integra solapa Alertas) + incidencia. Motivo operativo:
  hoy un contenedor en planta puede quedar en infracción sin que nadie lo vea entre julio y diciembre.
  Implementación: vista `vista_stock_prefijos_restringidos` (join stock abierto × prefijos activos) —
  la alerta es derivada, no un snapshot; el "barrido" es gratis y siempre actual.

## 8. B7 — Réplica del Excel de Omar (requiere B4; columnas booking requieren B3)

- Export multihoja desde Reportes (SheetJS ya integrado, `import("xlsx")` dinámico): hoja **General**
  (stock en planta, columnas espejo del Excel de Omar: contenedor, naviera, retiro de, planta, tipo,
  reforzado, fecha retiro, vencimiento, alerta, booking, estadía, días libres, demora, costo, lleno/vacío,
  producto(s), observaciones) + **Vencidos** + **Próximos a vencer** (umbral desde DB) + **Vacíos a vencer**.
- Botón manual v1. Envío automático martes/jueves vía n8n = deuda anotada.
- Aceptación: Omar compara contra su Excel sin traducir columnas.

## 9. B8 — Fixes + tarea paralela

1. **Password recovery**: branch `event === "PASSWORD_RECOVERY"` en `src/lib/session.tsx:108` → router a
   `/auth/actualizar-password` (la página ya existe y funciona — evidencia #12). ~15 líneas + test manual.
2. **Cleanup**: revocar `contenedores:UPDATE` de `authenticated` (cosmético: hoy ya está bloqueado de facto
   por ausencia de policy UPDATE — cierra la ventana por si alguien crea una policy mañana).
3. **Dow Summit form rework** — **PRIMERA TAREA de M5** (cambio de prioridad de John: corre ANTES de B0,
   en worker dedicado con contexto propio; se entrega el .md y se sigue con B0/B1 sin esperar review):
   - Rehacer preguntas + respuestas de `Dow-Summit-2026-Respuestas-Formulario.md` (PT) y `-ES.md` (ES) —
     se mantienen los dos idiomas.
   - Incorporar el alcance nuevo: multi-región (escalable a Brasil y otros países), exportación E
     importación, contrato global de free time, gestión de bookings y roleo, incidencias con reclamo,
     prefijos restringidos.
   - **Regla dura**: NO revelar que el sistema existe/está construido/funciona — todo como propuesta a
     desarrollar. Tono de negocio, conciso, sin tecnicismos ni referencias a infra desplegada.
   - **Fuente de números**: `COSTOS POR DETENTION SEMANAL 2024-2025-2026 - REPORTE.xlsx` (validado con
     Omar) — los costos se presentan como medición operativa propia (planilla), no como output de sistema.
   - Salida: **SOLO .md, NADA de PDF** (el PDF se genera después con OK explícito de John).

---

## 10. Orden, dependencias y migraciones pre-asignadas

```
B0 → B1 → { B3 ∥ B4 ∥ B5 ∥ B6 } → B2 → B7 → B8.1/B8.2 → deploy manual John
                                                B8.3 corre en paralelo desde el inicio
```

**Regla anti-colisión**: las migraciones DB son SECUENCIALES aunque el front vaya en paralelo — un solo
schema-builder activo por vez, números pre-asignados:

| Nº | Bloque | Contenido |
|----|--------|-----------|
| 026 | B1 | paises + plantas.pais_id + navieras.{tipo_proveedor,activa} + freetime_origin ext + freetime_destino + fix índice/vistas + RPC versionado destino |
| 027 | B1 | seed contrato global (730 + 1441) + corrección ARG |
| 028 | B3 | bookings + FKs en operaciones + RPCs + vista saldo + tanda v2 |
| 029 | B4 | productos + consolidaciones + estado_carga + RPCs |
| 030 | B5 | incidencias ext + FK dual + RPCs (BE-03) |
| 031 | B6 | prefijos_restringidos + seed legacy + hook en tanda |
| 032 | B2 | ordenes_impo + operaciones_impo + eventos + RPCs executor + vistas motor destino |
| 033 | — | reserva (ajustes post-verify) |

Dependencias duras: B2←B1 (motor destino), B7←B4+B3 (columnas). B3-B6: DB secuencial (028→031),
front paralelizable después de su migración.

## 11. Orquestación de agentes (ejecución autónoma post-GO)

- **Fable 5 = orquestador**: no escribe código de bloques; despacha, revisa outputs, gatea.
- **Workers Sonnet**: `schema-builder` (migraciones, uno por vez), `ui-builder` (front por bloque,
  paralelizable), agente docs para B8.3.
- **Por bloque**: IMPLEMENT (worker) → REVIEW (`reviewer` read-only contra spec §14/§21 + AGENTS.md +
  este plan) → VERIFY (`verifier` independiente, queries propias contra DB live, evidencia ejecutada —
  nunca el mismo agente que implementó; regla dura #6).
- **Contexto por worker**: cada prompt de worker es autocontenido (extracto del bloque + patrones del repo
  + reglas duras). Los workers NO heredan esta conversación.

## 12. Verificación de cierre (antes del smoke de John)

- Build + lint + typecheck + navegación de rutas nuevas.
- Verifier por bloque, con queries propias:
  - Seed: **730 origen / 1441 destino** (evidencia #1) ± filas documentadas; 3 filas Hyundai días-null en neutro.
  - Corrección ARG vigente: CMA=14, ZIM=14 (± MSC según D1); Maersk/Hapag=14 sin tocar.
  - Multi-región: 2 tarifas misma naviera distinto país → la vista elige por país de la planta (anti-gotcha #9).
  - Motor impo: 3 casos sintéticos (Combined sin demora / Combined con demora / split dem+det) con
    aritmética exacta a mano.
  - Guard cross expo/impo: mismo contenedor con ciclo expo abierto rechaza orden impo (y viceversa).
  - Saldo de booking correcto tras egreso parcial; roleo deja evento con motivo.
  - Ciclo completo incidencia con reclamo (crear → reclamar → resolver con monto).
  - Prefijo restringido: warning + incidencia al confirmar.
  - Anon key: 401/42501 sobre todas las tablas nuevas (checklist §14.10).
- Checksums expo: recalcular post-reset y documentar (los previos 70/19/$28.630 dejan de aplicar).
- Deploy manual `npx vercel deploy --prod --yes` (mecanismo confirmado en AGENTS.md). Smoke de John en prod:
  tanda expo completa, orden impo completa, roleo + reasignación, incidencia con reclamo, export Excel Omar.

## 13. Deuda anotada (NO se construye en M5)

1. Importador de Excel de tarifas con diff contra vigente (Admin).
2. Envío automático del reporte Omar martes/jueves (n8n).
3. Notificación email automática de incidencia `no_reforzado` (n8n).
4. Integración bookings EDI 301 (`public.bookings_301`, 763 filas) ↔ `crm.bookings`.
5. Reefer operativo (datos ya seedeados, motor no los consume).
6. Hubs de destino en el motor (filas guardadas, `hub IS NULL` es lo único que aplica hoy).

## 14. ⚠ VERIFY pendientes (no bloquean; van al handoff)

1. Regla inclusiva en destino (asumida = origen; validar con primera liquidación impo).
2. Regla de relojes destino (D2) — validar con liquidación real.
3. MOTOR↔NAVIERA con factura real expo (acción John, deuda previa).
4. Aprobación usuarios pendientes (operez@, jsrojas@) — acción John.
5. Sandbox `gate-019-sandbox` (~USD 10/mes) — borrar del Dashboard si vive (acción John).

---

## 15. RESOLUCIONES D1–D7 — GO de John (2026-07-14)

| # | Resolución de John |
|---|--------------------|
| **D1** | **MSC → 14.** Set de cambios EXACTO: CMA 18→14, ZIM 21→14, MSC 15→14. Maersk y Hapag ya en 14. NADA MÁS se toca; forwarders y no operativas (CEVA, DHL, DSV, DP World, Expeditors, EVERGREEN, ONE, LOG-IN, SCAN GLOBAL) a valor contrato. **Seedear el contrato tal cual + en las 3 filas ajustadas dejar NOTA documentando (a) el valor original del contrato y (b) que el 14 es ajuste operativo confirmado por O. Pérez 2026-07-13** — para que el próximo Excel del cliente no pise el ajuste sin que se note. ⇒ las tablas de tarifas ganan columna `nota` text null |
| **D2** | **SÍ** como propuesto (split gana si >0; 0/0 o null → Combined). Guardar los 3 campos tal cual, sin recalcular, sin afinar más la regla (hoy no toca plata). **REQUISITO entregable: días libres origen Y destino EDITABLES desde Admin, versionado** |
| **D3** | **Informativo.** Lleno/vacío NO selecciona tarifa ni corta el reloj — el costo corre hasta la devolución, esté lleno o vacío. Motor sigue `regimen='vacios'`. Valor: stock + trazabilidad de producto (contenedor como depósito) |
| **D4** | **SÍ**: bookings RPC-only; `paises` y `prefijos_restringidos` escritura directa sancionada, RLS admin-only (⚠ si la solapa de prefijos la opera Omar y no es admin, la policy de escritura va a supervisor+ — validar rol real, ver §7). **+ AMPLIACIÓN B6**: solapa propia + validación expo/impo + **barrido retroactivo sobre stock** (§7) |
| **D5** | **SÍ.** Suppliers no operativos entran `activa=false` |
| **D6** | **SÍ, RPC-only** — pero `monto_usd` NULLABLE y estimativo ("a veces se conoce y a veces no; lo importante es registrar el evento"). **Obligatorio en el alta: tipo, fecha, contenedor, número de orden.** El monto se carga después o nunca; la UI NO bloquea el alta por falta de monto. El RPC se justifica porque el monto se edita a lo largo de la vida de la incidencia (estimado → facturado → reclamado → recuperado) y cada edición deja rastro (evento) |
| **D7** | **PT + ES** se mantienen. **B8.3 pasa a PRIMERA tarea** (antes de B0), worker dedicado con contexto propio, salida SOLO .md (PDF después, con OK explícito de John), se entrega y se sigue sin esperar review. Fuente de números: `COSTOS POR DETENTION SEMANAL 2024-2025-2026 - REPORTE.xlsx` validado con Omar (ver §9.3) |

**Orden efectivo post-GO**: B8.3 (worker paralelo, arranca YA) → B0 → B1 → {B3∥B4∥B5∥B6} → B2 → B7 → B8.1/B8.2 → deploy manual.
