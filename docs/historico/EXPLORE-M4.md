# EXPLORE M4 — CRM Detention v2

> Sesión 14 · 2026-07-12 · EXPLORE+PLAN (cero DDL, cero deploy; `execute_sql` solo lectura).
> Entregable hermano: `docs/PLAN-M4.html` (visual). Gate humano de John entre PLAN e IMPLEMENT.
> DB viva consultada: proyecto Supabase `cctuowthpnstvdgjuomq`, schema `crm`, 2026-07-12.

---

## F0 · Regla de días — ARBITRADO CON EVIDENCIA [LEAD/Fable, sin delegar]

### HALLAZGO F0-1 · El motor cuenta INCLUSIVO: el día del retiro es el día 1 — y está BIEN

**Evidencia (live, 2026-07-12):** `pg_get_functiondef('crm.dias_estadia')`:

```sql
CREATE OR REPLACE FUNCTION crm.dias_estadia(p_desde timestamptz, p_hasta timestamptz)
 RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $$
  select ((p_hasta at time zone 'America/Argentina/Buenos_Aires')::date
        - (p_desde at time zone 'America/Argentina/Buenos_Aires')::date) + 1
$$
```

**Los 3 ejemplos numéricos de la regla vigente:**

| Caso | Cuenta | Resultado |
|---|---|---|
| Retiro lunes 2026-07-06 → devolución jueves 2026-07-09 | (9−6)+1 — cuentan AMBAS puntas | **4 días** |
| Retiro y devolución el mismo día | (0)+1 | **1 día** |
| HAPAG (14 libres, $25/día): retiro 2025-09-25 → dev 2025-10-23 (fila real `FANU3683334` del Excel) | estadía 29 · demora 29−14=15 | **USD 375** (con día-0 daría 350) |

Con N días libres, el último día sin cargo es `retiro + (N−1)`. El día N+1-ésimo de calendario ya factura.

### HALLAZGO F0-2 · El Excel histórico valida el conteo inclusivo al 100%

Fuente: `DETENTION HISTORIAL DE CONTENEDORES AÑO-DE AGOSTO 2025-2026.xlsx` (raíz del repo, hoja `DETENTION DE AGOSTO 2025 A 2026`, 2.804 filas con contenedor). Columnas detectadas dinámicamente por header (CONTENEDORES=0, FECHA DE RETIRO=6, FECHA DE VENCIMIENTO=7, ESTADIA=14, DIAS LIBRES=15, DEMORA=16, COSTOS USD=18, FECHA DE DEVOLUCION=20). Script reproducible con `openpyxl`, seed 42.

| Test | Regla verificada | Resultado |
|---|---|---|
| B | `ESTADIA = (FECHA DE DEVOLUCION − FECHA DE RETIRO) + 1` | **2.804/2.804 (100%)** · variante sin +1: 0 |
| muestra | 30 filas al azar (seed 42), listado completo abajo | **30/30 match** |
| A | `FECHA DE VENCIMIENTO = RETIRO + DIAS LIBRES − 1` (inclusivo) | **2.761/2.804 (98,5%)** · variante exclusiva: 0 · otro: 43 |
| C | `DEMORA = ESTADIA − DIAS LIBRES` | 2.803/2.804 |
| D | `COSTOS USD = max(0, DEMORA) × VALOR UNIT` | 2.796/2.804 (7 con demora>0 y costo 0 = waiver/sin cargo; 1 fila sucia) |

**Conclusión:** el Excel — fuente de verdad del negocio — cuenta el día del retiro como día 1, sin excepción. Coincide con la reconciliación NT-1 del audit v1 (`docs/plans/moneypath-plan-20260705.md:227`: view vs Excel por hash MD5; brecha día-0/día-1 cuantificada en USD 42.455 — ese es el costo de equivocarse de convención).

### HALLAZGO F0-3 · La FAQ en producción es CONSISTENTE con el motor. El que miente es el spec

`crm.ayuda_contenido` (live), sección `faq`:
- Orden 1, "¿Qué arranca y qué corta el free time?": *"la fecha de retiro cuenta como **día 1**"* — literal.
- Orden 2, "¿Cómo se calculan los días y el costo proyectado?": *"contando el día del retiro como día 1"* + fórmula `máx(0, días transcurridos − días libres) × tarifa` — idéntica a las views.

**No hay mentira en producción**: motor, Excel y FAQ dicen lo mismo. Los desalineados son:
- `spec.md:234`: comentario `-- America/Argentina/Buenos_Aires, fecha_retiro = día 0` → **FALSO**, corregir el spec (el spec está congelado: la corrección requiere tu GO).
- `ingreso/tanda-form.tsx:162`: comentario `// … fecha_retiro = día 0 del freetime` — **el mismo error conceptual en código de aplicación** (detectado por el VERIFIER independiente; no afecta el cálculo, es solo comentario, pero IMPLEMENT debe corregir AMBOS, no solo el spec).
- El modelo mental de John ("se retira hoy, corre desde mañana") → contradicho por su propio Excel, 2.804 de 2.804 veces.

**El motor NO se toca en sus números.** Lo que falta es que la convención sea *configurable versionada* (F0-5) — hoy está fundida en el código de una función, y eso viola la directiva de producto.

### HALLAZGO F0-4 (lateral) · 43 extensiones de vencimiento caso-por-caso que v2 no modela

Los 43 outliers del TEST A son MAERSK (41) y ZIM (2), **todos con vencimiento MÁS TARDE** que `retiro + libres − 1` (extensiones de +7 a +79 días). Es un comportamiento real del negocio (1,5% de las operaciones): la naviera extiende el vencimiento para un contenedor puntual. En v2, `crm.operaciones` no tiene override de días libres ni de vencimiento (evidencia: `information_schema.columns` live — solo existe `sin_cargo boolean`, todo-o-nada). Los 7 casos del TEST D (demora positiva, costo 0) sí mapean a `sin_cargo`.

**⚠️ PREGUNTA PARA JOHN:** ¿modelamos "extensión de vencimiento" por operación (días extra + motivo + quién la otorgó)? Hoy el equivalente sería marcar `sin_cargo`, que borra TODO el costo en vez de correr el vencimiento.

### HALLAZGO F0-5 · Diseño: convención de conteo VERSIONADA en `freetime_origin` + `crm.dias_facturables()`

**Regla dura que cumple este diseño:** nada que re-calcule plata del pasado puede ser un flag mutable. La convención vive en la MISMA fila versionada que `dias_libres` y `tarifa_usd_dia` → cambiarla = crear una versión nueva con `vigente_desde`; toda operación histórica sigue resolviendo su versión vieja. Un UPDATE del admin no puede tocar el pasado (y el índice único parcial de vigencia + la RPC de versionado ya existentes gobiernan el ciclo).

**DDL propuesto (NO ejecutar — va a IMPLEMENT con GO):**

```sql
ALTER TABLE crm.freetime_origin
  ADD COLUMN convencion_conteo text NOT NULL DEFAULT 'retiro_dia_1'
  CHECK (convencion_conteo IN ('retiro_dia_1','retiro_dia_0'));
-- backfill implícito por DEFAULT: las 14 filas vigentes quedan en 'retiro_dia_1',
-- que es lo que el Excel valida al 100%. Cero cambio de números.
```

```sql
CREATE FUNCTION crm.dias_facturables(
  p_fecha_retiro timestamptz, p_hasta timestamptz,
  p_naviera uuid, p_regimen text DEFAULT 'vacios'
) RETURNS integer LANGUAGE sql STABLE SET search_path TO ''
AS $$
  SELECT ((p_hasta AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
        - (p_fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)
        + CASE f.convencion_conteo WHEN 'retiro_dia_1' THEN 1 ELSE 0 END
  FROM crm.freetime_origin f
  WHERE f.naviera_id = p_naviera AND f.regimen = p_regimen
    AND (p_fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires')::date >= f.vigente_desde
    AND (f.vigente_hasta IS NULL
         OR (p_fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires')::date <= f.vigente_hasta)
  ORDER BY f.vigente_desde DESC LIMIT 1
$$;
-- STABLE (lee tabla), no IMMUTABLE. Misma resolución de vigencia que el LATERAL de las views.
-- Sin versión vigente → NULL → las views ya tratan NULL como 'neutro'. Coherente.
```

- `crm.dias_estadia` queda como primitiva de calendario pura (no sabe de navieras) o se deprecia tras migrar las views — decisión de IMPLEMENT.
- `crm_nueva_version_freetime` suma `p_convencion text DEFAULT 'retiro_dia_1'` (misma técnica del DEFAULT que mantuvo compatible el call del front en v1/D-01).
- Admin UI: la convención se muestra y edita como un campo más del versionado de tarifas existente (`/admin/tarifas`), con label humano: "¿El día del retiro cuenta como día 1?".

**Alternativas rechazadas:**
- Flag global en `crm.configuracion` → mutable, re-calcula el pasado entero con un UPDATE. Prohibido por la regla dura.
- Dos booleanos (`cuenta_dia_retiro`, `cuenta_dia_devolucion`) → sobre-ingeniería: el negocio conoce exactamente dos convenciones; el CHECK es extensible si aparece una tercera.
- Columna en `navieras` (no versionada) → mismo problema del flag: sin `vigente_desde`, cambiarla reescribe la historia.

### IMPACTO F0 · qué se toca cuando `dias_facturables` reemplace a `dias_estadia`

Evidencia: `pg_get_viewdef` live de las 6 views (2026-07-12).

| Objeto | Uso actual de `dias_estadia` | Cambio |
|---|---|---|
| `vista_alertas` | 5 llamadas (dias_transcurridos, dias_estadia, dias_restantes, costo_proyectado, semáforo) — además ya hace el LATERAL a freetime | reemplazo directo; el LATERAL se absorbe en la función |
| `vista_kpi_costos_cerradas` | 2 llamadas (dias_estadia, costo_realizado) | ídem |
| `vista_kpi_resumen` / `vista_kpi_costo_naviera` / `vista_kpi_tendencia_mensual` | derivan de las dos anteriores | sin cambio propio; heredan |
| `get_pendientes()` | cuenta semáforos desde `vista_alertas` | sin cambio propio |
| Front (medidores de freetime, egreso) | inventario en curso (scout F2/F3) | según inventario |
| FAQ / seeds de ayuda | copy afirma "día 1" hardcodeado | pasa a interpolarse — F3 |

**RIESGO:** regresión numérica masiva si la migración de views se hace sin red. **Mitigación obligatoria:** el GATE DE CÁLCULO de CP3 (F5) con goldens derivados de este F0 — la muestra de 30 (seed 42), los 7 sin_cargo y 2-3 extensiones como casos negativos documentados. Los goldens los produce F0, no el motor.

---

## F2 · Admin configurable — inventario, clasificación y reset demo [LEAD clasifica; scout Haiku barrió código+schema]

> Test de clasificación aplicado sin excepción: **¿tocarlo re-calcula plata del pasado? → (a) versionado.**

### HALLAZGO F2-1 · `cobra_detention_origen` es un flag MUTABLE que re-calcula plata del pasado — viola la regla dura HOY

**EVIDENCIA:** `navieras.cobra_detention_origen` es una columna editable por el admin (modal de navieras, `admin/navieras/page.tsx:56`), y `vista_kpi_costos_cerradas` la evalúa EN VIVO: `WHEN ft.dias_libres IS NULL OR NOT n.cobra_detention_origen THEN NULL` (pg_get_viewdef live 2026-07-12; `018_m8_kpi_views.sql:49`). Si el admin togglea el flag de una naviera, **el costo realizado de todas sus operaciones cerradas cambia retroactivamente** (NULL ↔ monto).
**PROPUESTA:** mover `cobra_detention_origen` a `crm.freetime_origin` como atributo versionado (es un término comercial que cambia en el tiempo, igual que la tarifa). La columna de `navieras` queda deprecada tras migrar. **[DDL]**
**RIESGO:** medio — toca las mismas views que F0; conviene hacerlo en el MISMO pase de migración de views que `dias_facturables` (un solo re-verify, un solo gate).

### HALLAZGO F2-2 · `plantas` está doblemente bloqueada: sin write policy Y con CHECK que hardcodea los nombres

**EVIDENCIA:** `plantas_nombre_check` = `CHECK (nombre = ANY (ARRAY['BAHIA','ABBOTT']))` (pg_constraint live; `002_maestros_config.sql:27`). Aunque F1 diseñe la write policy, el admin NUNCA podría crear una tercera planta: el CHECK lo prohíbe a nivel DDL. Es la violación más literal de la directiva de producto.
**PROPUESTA:** `DROP CONSTRAINT plantas_nombre_check` + write policy de F1 + (si hace falta baja) columna `activa boolean` para soft-delete — el DELETE físico rompería FKs históricas de `operaciones.planta_actual_id` / `movimientos_planta`. **[DDL — va junto con F1]**

### HALLAZGO F2-3 · `retiro_de` (depósito de retiro) es TEXTO LIBRE — typos van directo a la DB

**EVIDENCIA:** `ingreso/tanda-form.tsx:160` — `retiro_de: retiroDe.trim()`, input de texto sin catálogo; la columna no tiene CHECK (information_schema live). "PTN" / "ptn" / "Ptn " serían tres depósitos distintos para cualquier agrupación futura.
**PROPUESTA:** maestro de depósitos configurable (lista en `crm.configuracion` clave `depositos` — no amerita tabla propia con este volumen) + Combobox de F4 en el form. **(b) mutable** — no entra en el cálculo de costo. **[DDL: solo seed de la clave nueva]**

### Clasificación completa (inventario: 24 CHECKs live + barrido TS del scout)

**(a) CONFIGURABLE VERSIONADO** — afecta cálculos históricos; NUNCA update:

| Constante | Hoy | Diseño |
|---|---|---|
| Convención de conteo (+1) | fundida en `crm.dias_estadia` | `freetime_origin.convencion_conteo` — F0-5 **[DDL]** |
| `dias_libres` / `tarifa_usd_dia` / `tipo` / `aplica_carga_peligrosa` | ✅ ya versionados en `freetime_origin` | sin cambio |
| `cobra_detention_origen` | ❌ flag mutable en `navieras` (F2-1) | migrar a `freetime_origin` **[DDL]** |

**(b) CONFIGURABLE MUTABLE** — operativo/cosmético; UPDATE OK, editable en Admin:

| Constante | Hoy | Diseño |
|---|---|---|
| `umbral_alerta_amarillo` | ✅ en `configuracion` | ya OK; nota (precisada por el VERIFIER): la view tiene fallback `3` (`COALESCE(...,3)`, 007:58) pero el front es tolerante-a-null (`alertas/page.tsx:116-117`: sin config, oculta la leyenda — NO duplica el 3). Dos criterios distintos ante config faltante — unificar en IMPLEMENT |
| Tipos de contenedor (`20DC/40DC/40HC`) | CHECK `004:35` + duplicado en `tanda-form.tsx:31` | lista en `configuracion.tipos_contenedor`; DROP CHECK, validación por RPC/trigger contra la lista **[DDL]** — tipo no entra al costo |
| Depósitos (`retiro_de`) | texto libre (F2-3) | lista `configuracion.depositos` + Combobox |
| Medios (`camion/tren`) | CHECK `004:147` + `tanda-form.tsx:32` | candidato (b), prioridad baja — mismo patrón que tipos |
| Tipos de incidencia | CHECK `004:320` + labels `format.ts:134` | candidato (b), prioridad baja |
| Plantas (filas) | doble bloqueo (F2-2) | write policy F1 + DROP CHECK **[DDL]** |
| Dominios sugeridos de registro | ✅ ya en config (FAQ admin №5) | sin cambio |
| `modo_demo` | no existe | clave nueva para el reset (abajo) |

**(c) QUEDA EN CÓDIGO** — con justificación:

| Constante | Justificación |
|---|---|
| Máquina de estados (`operaciones.estado`, `movimientos.estado`, `tipo_cierre`, `tipo_evento`, `reforzado_estado`, `rol`, `estado_cuenta`) | cada valor tiene lógica asociada (RPCs, triggers, flujos de UI); "configurarlos" sin código no significa nada. Los CHECKs se quedan. |
| `regimen` (`vacios/cargados/sin_uso`) fijo en las views (007:64, 018:61) | v2 modela SOLO el ciclo de vacíos (§14.1 plegado). Si el negocio abre ciclos cargados, régimen pasa a ser dato de la operación (modelado, no configuración). |
| TZ `America/Argentina/Buenos_Aires` (15+ ocurrencias — conteo del VERIFIER: 001:57/72/73, 007:65/67, 018 ×7, `format.ts:1,5`, entre otras) | cambiarla re-interpreta timestamps históricos; negocio AR-only. **Nota DRY:** las views deberían componer `hoy_ar()`/`dias_estadia()` en vez de repetir el literal — higiene para el MISMO pase de F0 sobre esas views. |
| Semáforo, labels, tones, `FETCH_CAP` (500/200), `TOP_NAVIERAS` 8, `MES_CORTO` | presentación pura, sin semántica de negocio. |
| `ayuda_contenido.seccion` CHECK | estructura de la app; lo extiende F3 (nivel `campo`) **[DDL de F3]**. |

### UI de Admin para (a) y (b)

- **(a):** ya existe la pantalla correcta — `/admin/tarifas` (versionado). Se suman `convencion_conteo` y `cobra_detention_origen` al modal de nueva versión. Cero pantalla nueva.
- **(b):** `/admin/configuracion` se reorganiza en secciones: **Alertas** (umbral, ya existe) · **Catálogos** (tipos de contenedor, depósitos, medios, tipos de incidencia — editor de lista simple) · **Demo** (toggle `modo_demo` + botón reset, abajo).

### RESET DEMO — diseño con triple guard

**RPC `crm.crm_reset_demo(p_confirmacion text)`** (SECURITY DEFINER, search_path fijado, REVOKE de anon/public):
1. **Guard rol:** `crm.perfil()` debe devolver `rol='administrador'` y `estado='activo'` — si no, raise.
2. **Guard modo:** `configuracion.modo_demo` debe ser `true` — apagás la clave y la RPC deja de aceptar, sin deploy.
3. **Guard confirmación:** `p_confirmacion` debe ser exactamente `'RESET DEMO'` — la UI la pide tipeada; la RPC la re-valida server-side.
4. **Guard render:** el botón solo se renderiza si `NEXT_PUBLIC_DEMO_RESET=1` en Vercel (env var).

**Alcance (GUARD ABSOLUTO — solo `crm.*`):** DELETE en orden FK-seguro (las FKs son todas NO ACTION — pg_constraint live): `incidencia_fotos → incidencias → operacion_eventos → movimientos_planta → operaciones → contenedores`. **PRESERVA:** `navieras`, `freetime_origin`, `plantas`, `configuracion`, `ayuda_contenido` **y `usuarios`**.

**auth.users resuelto con evidencia:** `usuarios` NO se borra en el reset → cero huérfanos por construcción. La única FK hacia `auth` es `usuarios.auth_user_id → auth.users ON DELETE CASCADE` (pg_constraint live: `confdeltype='c'`) — la dirección de limpieza es auth→crm, no al revés: si algún día John borra cuentas desde el Dashboard, `crm.usuarios` se limpia solo. La RPC jamás toca `auth.*`, `detention.*` ni `public.*`.

**Storage:** las fotos de `crm-incidencias` no se pueden borrar por SQL (`storage.protect_delete()` — caso real de los 2 blobs de la sesión 13). Diseño: el front borra los objetos vía Storage API **antes** de llamar la RPC (requiere DELETE policy para administrador en el bucket **[DDL]**); la RPC devuelve el conteo de filas borradas y deja rastro en `configuracion.ultimo_reset_demo = {fecha, usuario}` (la auditoría no puede vivir en `operacion_eventos` porque el reset los borra).

**RIESGO:** es la función más peligrosa del sistema por definición. Mitigaciones: los 4 guards + verificación en IMPLEMENT de que un `search_path` fijado y schema-cualificado hace imposible tocar otro schema + test en rollback que confirme que las 6 tablas semilla quedan intactas.

---

## F3 · Ayuda M10 + tooltips por campo [CONSTRUCTOR Sonnet, verificado contra F0]

### HALLAZGO F3-1 · Migración 019: patrón resuelto, sin bloqueos de contenido tras F0

Los 7 seeds pendientes ya usan el patrón idempotente de la 013 (`delete where seccion=X` + insert; `seeds-ayuda/m3_ingreso.sql:12` etc.). `m9_admin.sql` va último: su bloque `admin` **subsume** al de la 013 (verificado línea a línea). Correr 019 dos veces es no-op.

**Cruce con F0 (esto cambió respecto del diseño del constructor):** el copy "el día del retiro cuenta" de `m6_alertas.sql:15` y el "día 1" de la FAQ en prod (`008_seeds.sql:104,107`) son **CORRECTOS** — F0 validó la convención inclusiva al 100% contra el Excel. **No hace falta la migración correctiva retroactiva** que el constructor propuso como contingencia. Queda como mejora (no bloqueante): cuando la convención sea versionada por naviera (F0-5), el fraseo global "día 1" debe volverse neutro o interpolado — va en el mismo pase que los tooltips.
**Sí sigue vigente:** el umbral "default 3" citado en texto plano en TRES lugares (`008:110` en prod, `m6_alertas.sql:11`, `m9_admin.sql:48` el rango 1-30) — migrar a interpolación `{{alertas.umbral_dias}}` al aplicar 019.

### HALLAZGO F3-2 · /ayuda: la infraestructura ya la espera; falta solo la página

- `nav.ts:14` tiene `"/ayuda": false` en `ROUTE_BUILT`; el tab del rail y el footer del HelpPanel ya linkean condicionalmente (`shell.tsx:33,132-138`). Construir la página + flipear un booleano activa toda la navegación.
- **Cero dependencia nueva:** `fd/markdown.tsx:163-215` ya es un renderer markdown completo sin `dangerouslySetInnerHTML`; la RLS de lectura ya está (`ayuda_select`, `002:190-192`).
- El botón "?" del header muestra HOY un placeholder fijo (`shell.tsx:38-44,141`) — el wiring es: mapear tab activo → `seccion`, query por sección, y el footer pasa `/ayuda?seccion=<activa>`.
- **Empty states §15.3: YA resueltos en los módulos** (el ejemplo del spec está casi verbatim en `egreso/page.tsx:716-719`; patrón en las 5 solapas con `fd/empty-state.tsx` que fuerza copy instructivo). Lo que falta: los 2 empty states de la PROPIA /ayuda (búsqueda sin resultados; sección despublicada).

### HALLAZGO F3-3 · El editor de ayuda en Admin NO existe — y el spec §15.4 lo exige

`spec.md:303`: "Editable desde Admin… actualizar la ayuda no requiere deploy". No hay `admin/ayuda/` (verificado). La DB ya tiene las policies de escritura (`002:194-201`). Hoy, cambiar UNA palabra de la ayuda = dev + SQL + migración: violación directa de la directiva de producto.
**PROPUESTA:** `admin/ayuda/page.tsx` con el patrón de `admin/tarifas`: lista por sección, edición in-place (título, textarea con preview `<Markdown>`, orden, toggle publicado), sin DELETE (despublicar, consistente con "no se borran" de navieras).

### HALLAZGO F3-4 · Tooltips por campo: modelo B (columnas `nivel`+`clave`) + `<FieldHelp>` + interpolación

- **Modelo [DDL]:** `ALTER TABLE ayuda_contenido ADD nivel text NOT NULL DEFAULT 'seccion' CHECK (nivel IN ('seccion','campo'))`, `ADD clave text` + unique parcial sobre `clave`. 100% retrocompatible (filas existentes quedan `nivel='seccion'`). Rechazadas: clave-en-titulo (mezcla identificador técnico con presentación) y tabla nueva (duplica RLS y editor).
- **Componente:** `fd/field-help.tsx` nuevo (el `Tooltip` de `dropdown.tsx:157-208` es de una línea, `white-space:nowrap`, sin `aria-describedby` — no sirve tal cual). Ícono con `tabIndex`, on-hover Y on-focus, `useId()` + `aria-describedby` inyectado al `<input>` real vía prop `helpKey` en `Field`.
- **Interpolación:** sintaxis `{{namespace.clave}}` con whitelist en código; sustitución ANTES del parser de markdown. Dos naturalezas: globales (`alertas.umbral_dias` → provider con una query a `configuracion`) y por-naviera versionadas (`freetime.dias_libres`, `freetime.tarifa_usd_dia` → requieren `navieraId` en contexto del form; sin contexto, fraseo neutro "los días libres de tu naviera" — NUNCA el número de una naviera arbitraria). **PROHIBIDO números de negocio en texto plano** en todo `contenido_md` de nivel campo.
- **Inventario:** 14 campos [FECHA] detectados; copy propuesto para los 7 críticos (los que arrancan/cortan el reloj: `ingreso.fecha_retiro`, `egreso.fecha_devolucion`, etc. — ya redactables en firme porque F0 cerró la convención) + 31 claves listadas para el resto.

**RIESGO F3:** el CHECK de `seccion` y el modelo `nivel/clave` son DDL sobre una tabla con contenido real en prod — migración propia (020), separada de la 019 (que es DML puro).

---

## F4 · UX operativa [CONSTRUCTOR Sonnet]

### HALLAZGO F4-1 · Combobox: solo 2 de los 21 `<Select>` lo justifican — y sin dependencia nueva

De 19 ocurrencias (conteo corregido por el VERIFIER; el constructor reportó 21), solo **naviera** (en `ingreso/tanda-form.tsx:269` y `admin/tarifas/page.tsx:540`) califica: es el único catálogo que el admin hace crecer, y el problema real es que "MSC"/"ONE" están entre paréntesis al final del label — el typeahead nativo no los encuentra. Los otros 19 son enums de 2-5 opciones (sobre-ingeniería migrarlos).
**PROPUESTA:** `Combobox<T>` propio en `fd/fields.tsx` (~80 líneas, patrón WAI-ARIA): el repo YA implementa filtro+teclado en `fd/command-palette.tsx:132-144` — cero cmdk, cero shadcn (0 ocurrencias en package.json), consistente con el design system.

### HALLAZGO F4-2 · Sidebar persistente: la variante expandida NO existe — son dos trabajos, no un toggle

El rail es ancho fijo 60px solo-íconos (`shell.tsx:145-165`, `globals.css:234-238`); bajo 900px lo reemplaza el bottombar. Hay que (a) dibujar la variante expandida (~200px, icon+label, sin tooltip) y (b) persistir en **cookie** `fd_sidebar` (SSR-safe): `(app)/layout.tsx` es Server Component y puede leerla — **OJO Next 16.2.10: `cookies()` es async** (`await cookies()`, verificado contra los docs del propio node_modules) y usarla opta la ruta a dynamic rendering (aceptable: la ruta ya es dinámica por sesión). Default = colapsado (estado actual, cero regresión). Solo desktop; el breakpoint 900px sigue mandando.

### HALLAZGO F4-3 · Búsqueda global: la UI YA está construida — falta SOLO la función de datos

`fd/command-palette.tsx` (⌘K) ya tiene debounce, grupos, teclado y render con semáforo; `shell.tsx:126` la monta SIN prop `search` (por eso muestra placeholder). Y la query exacta del spec §11 **ya existe en prod** en `contenedores/page.tsx:141-184` (dos queries paralelas por la gramática `or=()` de PostgREST + merge por id + `normalizarNumero()`). Los 4 índices trigram ya existen desde M1 (`004:46,126-128`). RLS ya scopea por planta — cero lógica de roles propia.
**PROPUESTA:** extraer esa lógica a `lib/search-operaciones.ts`, límite ~8 resultados + footer "ver todos", `shell.tsx` pasa `<CommandPalette search={...} />`. **Front-only, cero DDL.**

### HALLAZGO F4-4 · Export Excel: solo Contenedores y Alertas; `xlsx` es dependencia nueva

`xlsx` (SheetJS) no está en package.json. Pantallas: **Contenedores** y **Alertas** (DataTable con filtros activos; `vista_alertas` ya calculó todo) — exportan exactamente lo visible (el array ya filtrado en pantalla), NO un refetch. Inicio/KPIs no (son charts, no filas); colas de ingreso/egreso no (transitorias). Columnas = accessor paralelo `ExportColumn<T>` con valores planos (el `render()` devuelve JSX). Cero DDL, cero RPC nueva.
**RIESGO:** peso del bundle de xlsx (~600-900KB) — evaluar build mínimo en IMPLEMENT; y la dupla Column/ExportColumn es deuda de sincronización manual (opción B: `exportValue` opcional en `Column<T>`, toca `data-table.tsx`).

---

## F1 · Fixes operativos [ARQUITECTO-DDL Opus xhigh; cross-check live del LEAD]

### HALLAZGO F1-1 · H1 confirmado con matiz: el punto ciego es del pre-check (RLS); el que mata la tanda y nombra UNO es el backstop

**EVIDENCIA (repo + live coinciden, 2026-07-12):**
- La RPC es `security invoker` → el pre-check corre bajo RLS (`006_rpcs_operativas.sql:31,64-73`); el propio encabezado lo admite (`006:18-20`). Para un operador, `operaciones_select` (`004:223-236`) oculta las ops abiertas de otras plantas → el pre-check pasa limpio aunque haya colisión cross-planta. (Matiz: cuando las colisiones SÍ son visibles, el pre-check lista TODAS — `array_to_string(v_abiertos, ', ')`.)
- El árbitro real es `ux_operacion_abierta` (índice único parcial, `004:116-118`) — los índices no respetan RLS. Al dispararse, el handler `when unique_violation then raise` (`006:89-96`) propaga → **rollback de TODA la tanda**, mensaje con UN solo contenedor.
- La UI muestra ese error crudo en un único `FormAlert` (`tanda-form.tsx:171-177,452`).
- **Camino peor:** 10 contenedores, el #7 colisiona en la otra planta → 1-6 insertados y revertidos → el operador ve solo "#7" y re-pega los 10. N colisiones cross-planta = N tandas perdidas.

**PROPUESTA — dos opciones evaluadas, recomendación B:**

- **Opción A (la del brief):** helper `crm_contenedores_con_ciclo_abierto(text[])` SECURITY DEFINER (STABLE, search_path pinneado, REVOKE public/anon) que devuelve SOLO los números que colisionan (números que el caller ya tipeó — cero fuga de planta/booking ajeno) + inserción parcial.
- **Opción B (recomendada por el arquitecto, avalada por el LEAD):** **sin pre-check** — envolver el cuerpo completo de CADA contenedor (upsert maestro + operación + movimiento) en un `begin/exception` propio (savepoint implícito de plpgsql): la `unique_violation` revierte SOLO ese contenedor y el loop sigue, registrando el rechazo. **Argumento decisivo:** ante dos supervisores cargando la misma tanda en simultáneo, el pre-check de A lee estado committed y no ve la carrera — el árbitro termina siendo el índice igual; A no compra nada que B no dé, y agrega superficie DEFINER que hay que endurecer. B = un solo mecanismo (el índice, RLS-blind) para los tres frentes: committed, cross-planta y carrera.

**Contrato nuevo de la RPC** (misma firma `(p jsonb)` → grants/callers intactos; retorno superset del actual `{creadas}`):
```json
{ "creadas": 3, "rechazadas": 1, "resultados": [
    { "numero": "MSKU1234565", "estado": "aceptado",  "operacion_id": "…", "motivo": null },
    { "numero": "TCLU1234563", "estado": "rechazado", "operacion_id": null,
      "motivo": "ciclo_abierto", "motivo_texto": "Ya tiene un ciclo abierto en el sistema" } ] }
```
**UI [FRONT]:** detalle fila por fila (verde aceptado / rojo con motivo), toast con el conteo, y el textarea se recompone dejando SOLO los rechazados. Orden de release: **DDL primero** (retorno superset degrada bien en la UI vieja), front después.

**RIESGO:** reescritura de una RPC de money-path — reversible re-aplicando el cuerpo de la 006. Tests obligatorios en VERIFY: tanda limpia · colisión a mitad de lista · colisión cross-planta invisible · doble carga concurrente. Peligro específico: savepoint mal armado que deje una op sin su movimiento (por eso el `begin/exception` envuelve el cuerpo COMPLETO del contenedor).

### HALLAZGO F1-2 · Plantas: doble bloqueo (sin write policy + CHECK de nombres) — diseño completo

**EVIDENCIA:** solo policy/grant de SELECT (`002:39-43`; la matriz de la 002:8 dice "escritura: nadie") + `CHECK (nombre IN ('BAHIA','ABBOTT'))` (`002:27`) + sin columna de baja (`002:25-31`). Hard-delete imposible: FKs desde `operaciones`, `movimientos_planta` (×2) y `usuarios`, todas RESTRICT.
**PROPUESTA [DDL]:** (1) `DROP` del CHECK de nombres → `CHECK (length(trim(nombre)) > 0)` conservando el `unique`; (2) `ADD COLUMN activa boolean NOT NULL DEFAULT true` (soft-delete); (3) policies `plantas_insert_admin`/`plantas_update_admin` espejo de las de navieras (`002:71-80`); (4) `GRANT insert, update` — SIN delete, coherente con el hardening de la 015. **[FRONT]:** CRUD en `/admin/plantas` + **filtrar pickers por `activa=true`** (si no, "desactivar" no tiene efecto visible — follow-up obligatorio, no opcional).
**RIESGO:** el DROP del CHECK es de una sola vía (creada la tercera planta, no se puede re-poner). Es el precio de la directiva de producto — decisión explícita de John.

### HALLAZGO F1-3 · Campana: el compromiso CP1 exige DDL (la categoría `alertas` excluye los inbound del operador)

**EVIDENCIA (live + repo):** `get_pendientes()` es SECURITY DEFINER y `vista_alertas` es security_invoker → dentro de la DEFINER, la view resuelve al owner (bypassa RLS): **el `WHERE` manual de la función es la ÚNICA compuerta de scope** (principio documentado en `007:95-97`; el WHERE puntual a tocar está en `007:140`). Ese WHERE filtra `o.planta_actual_id = v_planta`, y una op `en_transito_a_planta` tiene `planta_actual_id = NULL` → los contenedores que vienen HACIA la planta del operador no cuentan en sus alertas, aunque ya acumulan freetime. El patrón correcto ya existe en `pendientes_ingreso` (`007:120-128`).
**PROPUESTA:** **[DDL]** ampliar el predicado de `alertas` con `OR EXISTS (movimiento en_transito hacia v_planta)` — espejo exacto de `operaciones_select`; re-emitir REVOKE/GRANT post-replace (regla 010:17-23). **[FRONT]** hook `usePendientes()`: refresh en mount + focus + visibilitychange + intervalo 60s solo con pestaña visible (v2 no usa Realtime); badge = accionables (`ingreso + devolución + rojo + reforzados + solicitudes`), amarillo va dentro del popover; cap `9+`; navegación por categoría (ingreso→`/ingreso`, devolución→`/egreso`, alertas→`/alertas`, reforzados→`/contenedores`, solicitudes→`/admin/solicitudes`).
**VERIFY del arquitecto RESUELTO por el LEAD:** `/alertas` hoy NO lee `?semaforo=` (grep live: el filtro es estado client-side sin `searchParams`) → el deep-link con semáforo pre-filtrado es un agregado front trivial que va en el mismo cambio. La validación de reforzados sí vive en `/contenedores` (`[id]/acciones.tsx:37`).
**RIESGO:** bajo — ensanche aditivo de un COUNT, sin cambio de exposición (contadores, predicado idéntico al de la RLS). Front: limpiar el intervalo en unmount; si la RPC falla, sin badge y en silencio.

---

## F5 · Solapa ERD + CP3 [CONSTRUCTOR Sonnet; correcciones del LEAD]

### HALLAZGO F5-1 · ERD: SVG propio (NO React Flow) + JSON commiteado generado pre-commit

- **React Flow descartado con números:** `@xyflow/react` = ~59 KB gzip + zustand + 4 paquetes d3 transitivos, contra el precedente explícito del repo (`fd/charts.tsx:1-6`: "SVG propio con tokens Flight Deck, SIN librería") para un grafo estático de 12 nodos. Cards absolutely-positioned + paths bezier en SVG + pan/zoom a mano; click expande columnas.
- **Script `crm-v2/scripts/generate-erd-schema.mjs`:** devDependency `pg`, corre MANUAL pre-commit (no en `next build` — Vercel no tiene ni debe tener conexión directa a Postgres), lee `information_schema` + `pg_constraint` del schema `crm`, escribe `admin/erd/schema.json` commiteado. Credencial: env var nueva `CRM_ERD_DB_URL` SOLO en `.env.local` (gitignored, verificado `.gitignore:33-35`). Disciplina: PR que toca `migrations/*.sql` debe regenerar el JSON — si no, el diagrama miente en silencio.
- **Hallazgo de seguridad real:** en todas las rutas admin existentes, el gate de UI es cosmético porque los DATOS los sirve RLS. En `/admin/erd` eso deja de valer: `schema.json` iría en el bundle del cliente — un operador que inspeccione el chunk JS lee la topología completa del schema. Metadata de bajo riesgo, pero contradice el estándar del propio repo. **Recomendación: route handler server-side** (`GET /api/admin/erd/schema` validando rol) — barato y consistente con §14.
- **Layout:** ⚠️ **falta tu referencia visual** — propuesta de arranque: posiciones curadas a mano agrupadas por dominio (Identidad / Maestros / Operación / Historial, el orden del spec §4), reemplazable cuando la traigas. Alternativa: dagre en el script (nunca en el browser).

### HALLAZGO F5-2 · CP3: checklist ejecutable + corrección del LEAD sobre el estado de la auditoría RLS

- **VERIFY final:** build limpio · smoke E2E por rol×solapa (8 solapas × 3 roles) vía **agent-browser** (los MCP de browser están rotos en WSL — memoria de proyecto) · empty states vs §15 · pulido visual con capturas (lección specificity: nunca "se ve bien" por lectura de código).
- **Auditoría RLS:** el conteo real a auditar es **18 objetos (12 tablas + 6 views)**, no los 14 del test de la 015. **Corrección del LEAD al constructor:** las 4 views KPI de la 018 SÍ pasaron verificación anónima al cierre de sesión 13 (`SESSION_HANDOFF.md:21-22` — `anon_sel=false` en las 4, por catálogo y por REST 401), pero en una pasada separada y sin reporte commiteado. CP3 re-corre TODO en un solo harness auditable: GET con anon key contra los 18 objetos + POST/PATCH de rechazo en 2-3 tablas + test de scope por planta (operador BAHIA no ve filas ABBOTT), con reporte `docs/v2/cp3-rls-audit-<fecha>.md`.
- **GATE DE CÁLCULO (requisito nuevo, no negociable):** harness `verify-golden-costos.mjs` contra `crm-v2/tests/golden-costos.json`. **Los goldens ya existen: los produjo F0** — la muestra de 30 filas (seed 42) + los 7 casos sin_cargo + 2-3 outliers de extensión como negativos documentados. El harness inserta la tarifa histórica correspondiente (ejercitando el lookup vigente-a-fecha-de-retiro), crea la operación por las MISMAS RPCs que usa un operador (nunca INSERT directo), lee el costo calculado por la DB y compara contra el JSON. 100% match = PASS; un mismatch = FAIL bloqueante de CP3. G1–G7 probaron flujo; esto prueba aritmética contra la realidad del Excel.
- **Nota de precisión:** "§14.10" no existe como subsección literal — es el ítem 10 de la lista §14 (`spec.md:294`).

### HALLAZGO F5-3 · Drift de CONTEXT.md — diff exacto propuesto

`docs/v2/CONTEXT.md:15` ("crm-detention.vercel.app es de v1 — no deployar ahí") y `:17` ("pendiente exponer crm en Data API") quedaron obsoletos: v2 sirve en ese dominio desde la promoción de Flight Deck y la 017 ya expuso el schema. El diff completo (dominio ✅ v2 + Data API resuelta + estado de build 18 migraciones) está listo para aplicar en IMPLEMENT — riesgo de no corregirlo: un subagente que lea CONTEXT.md rechaza un deploy legítimo o "resuelve" un paso ya hecho.

---

## CIERRE DEL EXPLORE

**Verificado LIVE (2026-07-12, proyecto `cctuowthpnstvdgjuomq`, solo lectura):** definición de `crm.dias_estadia`, `crm_crear_tanda_retiro`, `get_pendientes`, `hoy_ar` (pg_get_functiondef) · las 6 views (pg_get_viewdef) · 24 CHECK constraints y 19 FKs con sus reglas ON DELETE (pg_constraint) · columnas de `operaciones` y `freetime_origin` (information_schema) · 12 filas de `ayuda_contenido` · 14 tarifas vigentes (ZIM limpia: 21d@$25 desde 2026-07-01) · Excel histórico completo (2.804 filas, openpyxl, seed 42 reproducible).

**Asumido (no verificado):** que el Excel es efectivamente la fuente de verdad del negocio (mandato del brief) · que los 43 outliers de vencimiento son extensiones otorgadas y no errores de tipeo (patrón consistente: todos posteriores, MAERSK/ZIM) · que la carga real de v2 empieza post-M4 (sin datos operativos que migrar en este paso).

**⚠️ VERIFY pendiente (bloqueado en John):** referencia visual del ERD (F5-1) · decisión route handler vs UI-gate para `/admin/erd` · connection string `CRM_ERD_DB_URL` · rama de la pregunta F0-4 (¿modelar extensiones de vencimiento?) · confirmación de la Opción B para H1 · política del badge (¿amarillo cuenta?) · plantas: ¿universo realmente libre? (el DROP del CHECK es de una sola vía).

**Autocrítica (bug class cazado en el propio output):**
- *F0:* busqué el error de "validar el motor contra sí mismo" — por eso los tests A–D usan SOLO columnas del Excel entre sí (vencimiento vs libres, estadía vs fechas), nunca `dias_estadia()` como referencia. También caçé el sesgo de confirmación del brief (que afirmaba que el motor estaba mal): el veredicto salió al revés de lo esperado y lo sostuve con 2.804/2.804.
- *F2:* el riesgo de clasificar por intuición — cada (a) pasó el test "¿re-calcula plata del pasado?" contra la definición REAL de las views (por eso `cobra_detention_origen` saltó de "flag inocente" a hallazgo (a)).
- *Integración F1–F5:* el bug class "subagente que afirma sin evidencia" — dos correcciones aplicadas: la auditoría RLS de las 018 (el constructor no conocía el handoff) y el matiz del pre-check de H1 (lista todas las visibles, no una).

**Riesgo residual en una frase:** el diseño de `dias_facturables` versionado toca las 2 views de plata y sus 4 derivadas en un solo pase — sin el gate de cálculo de CP3 ejecutado ANTES y DESPUÉS de esa migración, una regresión numérica podría pasar silenciosa; el gate no es opcional.

**Auditoría independiente (VERIFIER, Sonnet, evaluador ≠ productor):** ~70 citas file:line verificadas contra el repo (65 exactas; 5 con línea corrida o imprecisión, todas corregidas en esta versión del doc — ninguna de severidad ALTA) · **re-ejecución independiente del Excel con script propio: los 5 números coinciden dígito por dígito** (2.804/2.804 · 30/30 seed 42 · 2.761/2.804 con 43 outliers = 41 MAERSK + 2 ZIM, 100% "later" · 2.803/2.804 · 2.796 con 7 waivers) · SQL sketches sin errores bloqueantes · hallazgo propio del verifier incorporado: el comentario "día 0" duplicado en `tanda-form.tsx:162`.
