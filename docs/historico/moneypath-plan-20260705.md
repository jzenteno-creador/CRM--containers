# Plan money-path / integridad — CRM Detention

**Fecha:** 2026-07-05 · **Modo:** diseño-only (read-only; cero ejecución). Referencia: `docs/audit/audit-20260705.md`.
**Estado de verificación:** todo lo que dice "verificado" corrió en `BEGIN…ROLLBACK` contra la DB real (`cctuowthpnstvdgjuomq`) sin persistir. El fix de D-01 pasó además una verificación adversarial independiente (Opus): **APROBADO CON RESERVAS**.

> Este doc convierte análisis en SQL/diffs listos-para-pegar. La ejecución se hace barato con Sonnet/Haiku, respetando el gate indicado en cada ítem. **No reconciliar la brecha 2,4x (F-06) ni tocar día-1/día-0 (NT-1): Excel = fuente de verdad.** Respetar los 5 NO-TOCAR del audit.

---

## PARTE B — Restaurar ZIM al estado pre-bug (corrección de datos)

### Contexto (del EXPLORE, confianza Alta — el bug es append-only en valores)
El 2026-07-04, `crm_nueva_version_freetime` para ZIM: cerró la `vacios 21d@$25` legítima **y** la `sin_uso 0d@$84`, e insertó una `vacios 0d@$84 Detention` espuria (hoy vigente). Los valores previos siguen intactos en la tabla, solo con `vigente_hasta` cerrado. **Daño vivo = 0** (0 ops ZIM abiertas; las 2 cerradas usan la `vacios 7@25` de 2026-01, no tocada). Riesgo solo prospectivo: un retiro ZIM ≥ 2026-07-04 saldría a 0d@$84 en vez de 21d@$25.

Filas involucradas (ids reales):
| id | régimen | días | tarifa | qué hacer |
|---|---|---|---|---|
| `6d9af181-1e15-4fcd-9da1-eb2d6def197a` | vacios | 0 | 84 | **eliminar** (espuria del bug) |
| `b9d375e7-8fbd-47ba-a41a-28f0f22d2a89` | vacios | 21 | 25 | **reabrir** (`vigente_hasta = NULL`) |
| `06ea3f11-6b2a-43d7-8ec4-99559efea166` | sin_uso | 0 | 84 | rama A: reabrir · rama B: dejar cerrada |

### ✅ Precondiciones OBLIGATORIAS (checklist — no correr el bloque sin las dos)
- [ ] **Backup activo y validado**: el GitHub Action `backup-detention` corrió al menos una vez con éxito (secret `SUPABASE_DB_URL` seteado). Ver `db/backup/README.md`.
- [ ] **Confirmación de John de la rama** (A o B): ¿la `sin_uso 0d@$84` es la tarifa legítima de devolución-de-vacío de ZIM? → rama A. ¿No / valores distintos? → rama B (o pasar valores correctos).
- [ ] Correr el bloque VERIFY (abajo) y confirmar el estado resultante ANTES del bloque real.
- [ ] Idealmente, aplicar **después** del fix D-01 (Parte A), para que futuras ediciones de ZIM no vuelvan a romper.

### SQL — RAMA A (sin_uso 0d@$84 es legítima → reabrir)
```sql
-- Atómico: todo o nada. Un solo bloque.
BEGIN;
DELETE FROM detention.freetime_origin WHERE id = '6d9af181-1e15-4fcd-9da1-eb2d6def197a';           -- espuria vacios 0@84
UPDATE detention.freetime_origin SET vigente_hasta = NULL WHERE id = 'b9d375e7-8fbd-47ba-a41a-28f0f22d2a89'; -- reabrir vacios 21@25
UPDATE detention.freetime_origin SET vigente_hasta = NULL WHERE id = '06ea3f11-6b2a-43d7-8ec4-99559efea166'; -- reabrir sin_uso 0@84
-- (el trigger crm_set_updated_at actualiza updated_at solo)
COMMIT;
```

### SQL — RAMA B (sin_uso no legítima → dejar cerrada)
```sql
BEGIN;
DELETE FROM detention.freetime_origin WHERE id = '6d9af181-1e15-4fcd-9da1-eb2d6def197a';           -- espuria vacios 0@84
UPDATE detention.freetime_origin SET vigente_hasta = NULL WHERE id = 'b9d375e7-8fbd-47ba-a41a-28f0f22d2a89'; -- reabrir vacios 21@25
-- sin_uso 06ea3f11 se deja como está (cerrada 2026-07-03→2026-07-03)
COMMIT;
```
> **Por qué borrar la espuria y reabrir en el mismo bloque:** borrar la `vacios 0@84` sin reabrir la `21@25` dejaría a ZIM sin ninguna `vacios` vigente → el semáforo/costo de todo retiro ZIM daría NULL. Peor que el bug. Van juntas o no van.

### VERIFY sin mutar (correr ANTES del bloque real — reemplazá `COMMIT` por `ROLLBACK`)
Resultado ya verificado (rollback, no persistió):

**Rama A** deja ZIM en:
| régimen | días | tarifa | vigencia | estado |
|---|---|---|---|---|
| vacios | 7 | 25 | 2025-05-01 → 2026-06-30 | cerrada (histórica) |
| vacios | 21 | 25 | 2026-07-01 → *null* | **VIGENTE** |
| sin_uso | 0 | 84 | 2026-07-03 → *null* | **VIGENTE** |

**Rama B**: idéntico salvo `sin_uso` sin versión vigente. Invariantes confirmados en ambas: 1 sola `vacios` vigente (21/25), 0 filas con `vigente_hasta < vigente_desde`, 0 filas espurias 0@84.

Bloque de verificación para pegar (rama A; para B, quitá el 3er UPDATE):
```sql
BEGIN;
DELETE FROM detention.freetime_origin WHERE id='6d9af181-1e15-4fcd-9da1-eb2d6def197a';
UPDATE detention.freetime_origin SET vigente_hasta=NULL WHERE id='b9d375e7-8fbd-47ba-a41a-28f0f22d2a89';
UPDATE detention.freetime_origin SET vigente_hasta=NULL WHERE id='06ea3f11-6b2a-43d7-8ec4-99559efea166';
SELECT regimen, dias_libres, tarifa_usd_dia, vigente_desde, vigente_hasta
FROM detention.freetime_origin f JOIN detention.navieras n ON n.id=f.naviera_id
WHERE n.nombre='ZIM' ORDER BY regimen, vigente_desde;
ROLLBACK;
```

**Gate:** confirmación de rama + backup validado. **Modelo de ejecución:** Haiku (es pegar 3 statements y verificar). **Reversibilidad:** alta (el backup previo permite volver; y el estado corrupto está documentado acá).

---

## FINDINGS MONEY-PATH / INTEGRIDAD (mayor a menor impacto)

### D-01 (Parte A) — Fix de `crm_nueva_version_freetime` · **verificado 2× + aprobado adversarial**
**Qué está roto:** el UPDATE de cierre no filtra por régimen (cierra todos los de la naviera) y el INSERT no pasa `regimen` (default 'vacios'). Cruza regímenes y corrompe tarifas. Ya rompió ZIM.
**Approach:** scopear el cierre a `naviera + mismo régimen`, parametrizar `p_regimen`, validar entradas y coherencia de fecha, idempotencia.
**Sketch del diff (DB):** `DROP` de la firma de 6 args + `CREATE` con `p_regimen text DEFAULT 'vacios'` (el DEFAULT mantiene compatible el call actual del front). Cuerpo final (incorpora las mejoras del verificador: valida `p_tipo`/`p_desde`, quita `updated_at` redundante):
```sql
DROP FUNCTION IF EXISTS detention.crm_nueva_version_freetime(uuid, integer, boolean, text, numeric, date);
CREATE FUNCTION detention.crm_nueva_version_freetime(
  p_naviera uuid, p_dias integer, p_peligrosa boolean, p_tipo text,
  p_tarifa numeric, p_desde date, p_regimen text DEFAULT 'vacios'
) RETURNS uuid LANGUAGE plpgsql SET search_path TO 'detention','public'
AS $fn$
declare v_id uuid; v_prev record;
begin
  if p_regimen is null or p_regimen not in ('vacios','cargados','sin_uso') then raise exception 'régimen inválido: %', p_regimen; end if;
  if p_tipo   is null or p_tipo   not in ('Detention','Demurrage','Combined') then raise exception 'tipo inválido: %', p_tipo; end if;
  if p_dias   is null or p_dias < 0 then raise exception 'días libres inválidos: %', p_dias; end if;
  if p_tarifa is null or p_tarifa < 0 then raise exception 'tarifa inválida: %', p_tarifa; end if;
  if p_desde  is null then raise exception 'fecha de vigencia obligatoria'; end if;

  select * into v_prev from freetime_origin
   where naviera_id = p_naviera and regimen = p_regimen and vigente_hasta is null limit 1;

  -- idempotencia: re-submit idéntico devuelve el id, no duplica
  if v_prev.id is not null and v_prev.vigente_desde = p_desde and v_prev.dias_libres = p_dias
     and v_prev.tarifa_usd_dia = p_tarifa and v_prev.tipo = p_tipo
     and v_prev.aplica_carga_peligrosa = p_peligrosa then return v_prev.id; end if;

  -- coherencia de fecha: sin ventana 0-día ni gap (insert-only estricto, confirmado por John)
  if v_prev.id is not null and p_desde <= v_prev.vigente_desde then
    raise exception 'la vigencia nueva (%) debe ser posterior al inicio de la versión vigente (%)', p_desde, v_prev.vigente_desde; end if;

  if v_prev.id is not null then
    update freetime_origin set vigente_hasta = p_desde - 1 where id = v_prev.id; end if;

  insert into freetime_origin (naviera_id, regimen, dias_libres, aplica_carga_peligrosa, tipo, tarifa_usd_dia, vigente_desde, vigente_hasta)
  values (p_naviera, p_regimen, p_dias, p_peligrosa, p_tipo, p_tarifa, p_desde, null) returning id into v_id;
  return v_id;
end $fn$;
```
**Sketch del diff (front — necesario para que el fix cierre):**
- `src/lib/types.ts`: agregar `regimen: "vacios" | "cargados" | "sin_uso"` a `interface FreetimeOrigin`.
- `src/app/(crm)/admin/page.tsx`: `abrirNuevaVersion(t)` captura `regimen: t.regimen`; `formVersion` lleva `regimen`; el call (`:223`) agrega `p_regimen: formVersion.regimen`. (Editar una tarifa hereda el régimen de la fila; un selector de régimen para *crear* un régimen nuevo es mejora opcional.)
**Riesgo:** Medio (money path). **Reversibilidad:** alta (la función vieja está versionada en `db/schema/05_functions.sql`; `CREATE OR REPLACE` la revierte).
**VERIFY plan:** `BEGIN; DROP+CREATE; sanear ZIM en la misma tx; editar vacios 2× idéntico; asserts (sin_uso intacta, 1 vigente/régimen, sin gap, idempotente, fecha inválida raise); ROLLBACK`. Ya ejecutado: **9/9 checks verdes**. Al aplicar en prod, correr una vez más el VERIFY y luego el `CREATE` real, versionar en `db/schema/05_functions.sql`.
**Bloqueado-en:** nada (no depende de valores de negocio). **Va junto con D-10** (ver reserva del verificador).

### D-10 — Índice único parcial anti-carrera/anti-solape · **acompañante obligatorio de D-01**
**Qué está roto:** nada impide dos versiones vigentes del mismo `(naviera, régimen)`. El verificador confirmó que el fix D-01 **no cierra la carrera concurrente** (dos submits simultáneos leen `v_prev` antes de que cualquiera cierre → ambos insertan → 2 vigentes). Es el mismo mecanismo que corrompió ZIM.
**Approach:** unique parcial que haga fallar-limpio cualquier segunda vigente, y de paso blinda la idempotencia de D-01.
**Sketch del diff (DB):**
```sql
-- precondición: 0 solapes vigentes actuales (verificar; hoy da 0 porque cada régimen tiene 1 vigente):
--   SELECT naviera_id, regimen FROM detention.freetime_origin WHERE vigente_hasta IS NULL GROUP BY 1,2 HAVING count(*)>1;
CREATE UNIQUE INDEX ux_freetime_vigente
  ON detention.freetime_origin (naviera_id, regimen) WHERE vigente_hasta IS NULL;
```
Versión más robusta (opcional, anti-solape de rangos históricos completos — requiere `CREATE EXTENSION btree_gist`): `EXCLUDE USING gist (naviera_id WITH =, regimen WITH =, daterange(vigente_desde, coalesce(vigente_hasta,'infinity'::date),'[]') WITH &&)`. El unique parcial cubre el caso de concurrencia; el EXCLUDE cubre además solapes de vigencias pasadas.
**Riesgo:** Bajo. **Reversibilidad:** alta (`DROP INDEX`). **VERIFY:** en rollback, intentar insertar una 2ª vigente del mismo (naviera,régimen) → debe fallar con unique_violation. **Bloqueado-en:** aplicar **después** de la Parte B (para que ZIM tenga 1 vigente/régimen y el índice no rechace la creación).

### F-02 — Reapertura de operación cerrada (reversa contable) · money path
**Qué está roto:** una operación cerrada por error queda para siempre en `vista_costos_cerrados` con costo incorrecto; ninguna RPC reabre (`crm_anular_operacion` excluye cerradas).
**Approach:** RPC `crm_reabrir_operacion(p_operacion, p_usuario, p_motivo)` (gated sup+) que revierta `cerrado → en_transito_a_terminal`, limpie `fecha_devolucion` e inserte evento `reapertura` con motivo obligatorio.
**Sketch del diff (DB):**
```sql
CREATE FUNCTION detention.crm_reabrir_operacion(p_operacion uuid, p_usuario uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SET search_path TO 'detention','public' AS $fn$
begin
  if p_motivo is null or length(trim(p_motivo)) = 0 then raise exception 'motivo obligatorio'; end if;
  update operaciones set estado='en_transito_a_terminal', fecha_devolucion=null
   where id=p_operacion and estado='cerrado';
  if not found then raise exception 'la operación no está cerrada'; end if;
  insert into operacion_eventos(operacion_id, tipo_evento, fecha, usuario_id, detalle)
   values (p_operacion, 'reapertura', now(), p_usuario, jsonb_build_object('motivo', p_motivo));
end $fn$;
```
Nota: agregar `'reapertura'` al CHECK de `operacion_eventos.tipo_evento`. El índice `ux_operacion_abierta` protege contra reabrir si el contenedor ya tiene otro ciclo abierto (fallará con unique_violation → capturar y dar mensaje claro).
**Sketch (front):** botón "reabrir" en la ficha (`contenedores/[id]`), visible sup+, con modal de motivo.
**Riesgo:** Medio (money path — cambia costos del historial). **Reversibilidad:** media (una reapertura se puede volver a cerrar, pero deja rastro en el timeline — correcto). **VERIFY:** en rollback, reabrir una cerrada de prueba → confirmar estado, fecha_devolucion null, evento insertado, y que `vista_costos_cerrados` la excluye (vuelve a aparecer en abiertas). **Bloqueado-en:** confirmar el set de roles (sup+) y si querés límite temporal (ej. solo cerradas < 30 días).

### F-03 — Edición auditada de datos de operación · money path
**Qué está roto:** booking/buque/destino/orden/shp/fechas son read-only post-registro; un typo en `fecha_retiro`/`fecha_devolucion` (determinan el costo USD) solo se arregla anulando+recreando (y en cerradas, ni eso).
**Approach:** RPC `crm_corregir_operacion(p_operacion, p_campos jsonb, p_usuario)` (gated sup+) que actualice solo campos permitidos (asignación + fechas, NO estado ni contenedor) e inserte un evento de auditoría con el diff (valor anterior → nuevo).
**Sketch del diff (DB):** función que valide las keys de `p_campos` contra una whitelist (`booking_asignado,buque,destino,orden,shp,fecha_retiro,fecha_egreso_planta,fecha_devolucion`), haga el UPDATE dinámico, e inserte `operacion_eventos` tipo `correccion` con `detalle = {campo, anterior, nuevo}` por cada cambio. Combinar con los CHECKs de D-05 para que una fecha inválida sea rechazada.
**Sketch (front):** panel "corregir datos" en la ficha (sup+), form con los campos editables.
**Riesgo:** Medio (money path). **Reversibilidad:** alta (cada corrección deja evento; se puede re-corregir). **VERIFY:** en rollback, corregir `fecha_devolucion` de una cerrada → confirmar nuevo `costo_usd` en `vista_costos_cerrados` + evento de auditoría. **Bloqueado-en:** confirmar whitelist de campos y si se permite editar cerradas (probablemente sí, con evento). Depende de D-05 (CHECKs) para blindar.

### D-05 — CHECKs de coherencia fecha/estado · integridad (protege el KPI de plata)
**Qué está roto:** la DB acepta `estado='cerrado'` con `fecha_devolucion NULL` → esa op **desaparece de `vista_costos_cerrados`** (filtra `IS NOT NULL`): plata que se esfuma sin error. Ídem fechas invertidas → estadías negativas.
**Approach:** 3 CHECKs (la data actual ya los pasa, verificado en el audit).
**Sketch del diff (DB):**
```sql
ALTER TABLE detention.operaciones
  ADD CONSTRAINT ck_devolucion_post_retiro CHECK (fecha_devolucion IS NULL OR fecha_devolucion >= fecha_retiro),
  ADD CONSTRAINT ck_cerrado_tiene_devolucion CHECK (estado <> 'cerrado' OR fecha_devolucion IS NOT NULL),
  ADD CONSTRAINT ck_egreso_post_retiro CHECK (fecha_egreso_planta IS NULL OR fecha_egreso_planta >= fecha_retiro);
```
**Riesgo:** Bajo (data actual conforme). **Reversibilidad:** alta (`DROP CONSTRAINT`). **VERIFY:** correr los 3 SELECT de violación (deben dar 0) antes de agregar; en rollback, intentar un UPDATE que viole cada CHECK → debe fallar. **Ojo de coordinación:** los RPCs de egreso/devolución no validan estas fechas hoy → tras el CHECK, una fecha inválida pasada por el front dará error de constraint; el front (egreso, confirmar-devolución) debe mostrar ese error legible. **Bloqueado-en:** nada.

### D-04 — `IF FOUND` en `crm_confirmar_ingreso_planta` · integridad de timeline
**Qué está roto:** inserta el evento `ingreso_planta` e incrementa el contador incondicionalmente (sus RPCs hermanas sí chequean `IF FOUND`). Dos usuarios confirmando la misma tanda → eventos duplicados + "N confirmadas" engañoso.
**Approach:** envolver el insert del evento y el `v_n := v_n+1` en `IF FOUND` sobre el UPDATE de `operaciones`.
**Sketch del diff (DB):** en el loop, tras el `UPDATE operaciones ... WHERE ... AND estado='en_transito_a_planta'`, agregar `IF FOUND THEN <insert evento; v_n := v_n+1;> END IF;`. El UPDATE de `movimientos_planta` puede quedar igual.
**Riesgo:** Bajo. **Reversibilidad:** alta. **VERIFY:** en rollback, confirmar la misma tanda 2× → la 2ª no debe agregar eventos ni contar. **Bloqueado-en:** nada.

### D-06 + D-09 + BE-04 — Integridad de movimientos entre plantas (van juntos)
**Qué está roto:** (D-06) `crm_mover_entre_plantas` permite N movimientos en tránsito simultáneos y `crm_registrar_salida_planta` acepta salida con movimiento pendiente → movimiento huérfano. (D-09) `crm_anular_operacion` no cancela movimientos en tránsito y el trigger `trg_mov_confirmado` no excluye ops cerradas/anuladas → confirmar un movimiento tardío pisa `planta_actual_id` de una op cerrada (que muestra el historial de costos). (BE-04) confirmar llegada es un UPDATE directo del cliente sin guard de estado, no deja evento, y hardcodea la hora.
**Approach (3 piezas coordinadas):**
1. `crm_confirmar_movimiento` (trigger fn): agregar guard `IF (SELECT estado FROM operaciones WHERE id=NEW.operacion_id) IN ('cerrado','anulada') THEN RETURN NEW; END IF;` antes de tocar `planta_actual_id`.
2. Índice único parcial: `CREATE UNIQUE INDEX ux_mov_en_transito ON detention.movimientos_planta (operacion_id) WHERE estado='en_transito';` (espejo de `ux_operacion_abierta`).
3. RPC `crm_confirmar_llegada_movimiento(p_mov, p_fecha, p_usuario)` que reemplace el UPDATE directo del front: valide `estado='en_transito'`, setee llegada, e inserte evento de llegada. Y en `crm_anular_operacion`: cancelar (o cerrar con nota) los movimientos en tránsito de la op.
**Sketch (front):** `contenedores/[id]:confirmarLlegada` deja de hacer UPDATE directo y llama la nueva RPC, con input de fecha real (no hardcodeada).
**Riesgo:** Medio (toca la máquina de estados). **Reversibilidad:** alta (RPCs versionadas). **VERIFY:** en rollback — (a) doble movimiento en tránsito → unique_violation; (b) confirmar movimiento de op anulada → no toca `planta_actual_id`; (c) salida con movimiento pendiente → rechazada o auto-cancelada; (d) confirmar llegada 2× → la 2ª no pisa. **Bloqueado-en:** decidir si salida-con-movimiento-pendiente se rechaza o auto-cancela (recomiendo skip+reporte por operación, no `raise` — el egreso procesa un array y un raise aborta el batch entero).

### BE-03 — RPC atómica de incidencias + backfill de eventos faltantes · integridad
**Qué está roto:** el alta de incidencia son 3 pasos encadenados desde el cliente (insert incidencia → fotos → insert evento). **Hecho duro:** las 13 incidencias existentes no tienen evento en el timeline (`tipo_evento='incidencia'` = 0 filas). El guard "solo operaciones abiertas" vive solo en el autocomplete.
**Approach:** RPC `crm_registrar_incidencia(p_operacion, p_tipo, p_descripcion, p_fecha, p_usuario)` que valide operación abierta e inserte incidencia + evento en una transacción, devolviendo el id; fotos quedan best-effort posterior (ya manejan error por unidad). Backfill de los 13 eventos faltantes.
**Sketch (DB):** función transaccional + `INSERT INTO operacion_eventos ... SELECT ... FROM incidencias WHERE NOT EXISTS (evento)` para el backfill (one-shot).
**Sketch (front):** `incidencias/page.tsx:registrar` llama la RPC en vez de los inserts encadenados; las fotos siguen igual después.
**Riesgo:** Bajo. **Reversibilidad:** alta. **VERIFY:** en rollback, registrar incidencia → confirmar incidencia + evento en una sola tx; backfill → contar eventos = 13. **Bloqueado-en:** nada (el backfill no necesita valores de negocio).

### D-07 — Autoría de cambios administrativos (money path sin trazabilidad)
**Qué está roto:** una versión de tarifa nueva no guarda quién la cargó (la RPC ni recibe usuario); `configuracion` no tiene trigger de `updated_at` (no se sabe cuándo cambió el umbral). Cuando aparezca una tarifa mal cargada (D-01 ya produjo una), no hay rastro.
**Approach:** columna `creado_por` en `freetime_origin` + `p_usuario` en `crm_nueva_version_freetime` (DEFAULT NULL para no romper) + trigger `trg_configuracion_upd` faltante + tabla mínima `admin_eventos(accion, detalle jsonb, usuario_id, fecha)`.
**Sketch (DB):** `ALTER TABLE freetime_origin ADD COLUMN creado_por uuid REFERENCES usuarios(id);` + extender la firma de la RPC (ya toca la firma en D-01 → hacerlo en el mismo cambio) + `CREATE TRIGGER trg_configuracion_upd BEFORE UPDATE ON configuracion ...`.
**Sketch (front):** `admin/page.tsx` pasa `p_usuario: session.id` en el call de tarifa.
**Riesgo:** Bajo. **Reversibilidad:** alta. **VERIFY:** en rollback, crear versión con usuario → confirmar `creado_por`. **Bloqueado-en:** nada. **Sinergia:** hacerlo **junto con D-01** (ambos tocan la firma de la RPC → un solo `DROP+CREATE`).

### F-08 — Estado `cargado` inalcanzable (KPI stock de vacíos impreciso) · integridad de modelo
**Qué está roto:** ninguna acción setea `estado='cargado'` (las 3 filas en ese estado son SQL manual); un contenedor cargado esperando buque cuenta como vacío en `stock_vacios`.
**Approach:** decisión de modelo (2 opciones, no ambas):
- (a) **Eliminar** `cargado` del modelo: migrar las 3 filas a `en_planta`, sacarlo del CHECK/`types.ts`/queries. Verificado en el audit que ningún consumer se rompe (tratan `en_planta|cargado` como equivalentes).
- (b) **Agregar** la acción "marcar como cargado" (RPC + botón) que setee el estado + evento `carga`.
**Riesgo:** Medio. **Reversibilidad:** media. **VERIFY:** según la opción. **Bloqueado-en:** **decisión tuya** (resuelve el §14.1 del spec). Recomendación: (a) si nadie usa el KPI de "cargado" separado; (b) si querés distinguir cargado-esperando-buque del stock de vacíos real.

### D-08 — KPI `en_transito_a_planta` sin scope por planta · menor (correctness dashboard)
**Qué está roto:** único de 15 KPIs sin filtro por planta (un operador de BAHIA ve tandas hacia ABBOTT). Causa: en tránsito, `planta_actual_id` es NULL.
**Approach:** en el subquery del KPI, joinear `movimientos_planta` del tramo inicial (`estado='en_transito'`) y filtrar por `planta_destino_id` cuando `p_planta` no es null.
**Riesgo:** Bajo. **Reversibilidad:** alta. **VERIFY:** en rollback, comparar el KPI con y sin scope. **Bloqueado-en:** nada. No es integridad de datos (es conteo), pero toca `crm_dashboard` → agrupar con los cambios de RPC.

### BE-01 — Enforcement server-side (integridad de escritura + atribución) · **Etapa 4, proyecto propio**
**Qué está roto:** cookie sin firma (rol forjable), RPCs sin validación de rol, `p_usuario` confiado (eventos atribuibles a cualquiera), tablas escribibles con anon key, passwords plaintext. El timeline deja de ser auditoría confiable.
**Approach:** es un proyecto de auth completo, no un fix puntual — cookie HMAC + validación de rol en RPCs + bcrypt + reset de password (F-16). **No se diseña en detalle acá** (excede money-path puntual; va como Etapa 4 con su propio plan). Mitigación parcial ya aplicada en Etapa 0: `REVOKE DELETE/TRUNCATE` de anon (impide el wipe, no la escritura no autorizada).
**Bloqueado-en:** decisión de alcance (mínimo viable HMAC+rol en RPCs, vs migrar a Supabase Auth).

---

## DIFERIDOS POR REGLA (no diseñar)
- **F-06 — brecha 2,4x** (`costos_historicos` USD 1,1M vs `vista_costos_cerrados` USD 464K): Excel = fuente de verdad, no reconciliar hasta que se conecte finanzas.
- **NT-1 — día-1 vs día-0** (impacto USD 42.455): la view es la verdad (reconciliada contra Excel por hash MD5); no tocar el `+1`. Solo actualizar el spec cuando se valide contra facturas.

---

## SECUENCIA RECOMENDADA DE IMPLEMENTACIÓN

| # | Ítem | Modelo | Gate | Depende de |
|---|---|---|---|---|
| 1 | **D-01 Parte A** (fix RPC) + **D-07** (autoría) — un solo `DROP+CREATE` porque ambos tocan la firma | Opus/Fable (money path) + verificador independiente | Ya aprobado adversarial; re-VERIFY en rollback antes del CREATE, luego versionar en `db/schema/` | — |
| 2 | **Front de D-01** (`types.ts` + `admin/page.tsx` pasa `p_regimen` y `p_usuario`) | Sonnet | typecheck + deploy | #1 |
| 3 | **Parte B** (restore ZIM) | Haiku | **Backup validado + confirmación de rama A/B** | #1 (idealmente), backup |
| 4 | **D-10** (índice único parcial) | Haiku | verificar 0 solapes vigentes | #3 (ZIM con 1 vigente/régimen) |
| 5 | **D-05** (CHECKs coherencia) | Haiku | 3 SELECT de violación = 0 | — |
| 6 | **D-04** (IF FOUND) | Sonnet | VERIFY rollback | — |
| 7 | **BE-03** (RPC incidencias + backfill 13 eventos) | Sonnet | VERIFY rollback | — |
| 8 | **D-06+D-09+BE-04** (integridad movimientos) | Opus/Fable (máquina de estados) | VERIFY rollback + verificador | — |
| 9 | **F-02** (reapertura) + **F-03** (edición auditada) | Opus/Fable (money path) | VERIFY rollback + verificador; gate de roles | #5 (F-03 usa los CHECKs) |
| 10 | **D-08** (KPI scope), **F-08** (estado cargado) | Sonnet | decisión de John para F-08 | — |
| 11 | **BE-01** (auth server-side) | proyecto propio, Etapa 4 | plan aparte | — |

**Regla transversal:** todo cambio en RPC/view money-path se VERIFICA en `BEGIN…ROLLBACK` contra casos conocidos antes del `CREATE` real, se versiona en `db/schema/`, y — si toca cálculo de plata — pasa un verificador independiente (≠ implementador) antes de mergear. Los ítems 1, 8 y 9 son los que ameritan el verificador adversarial; el resto, VERIFY en rollback alcanza.

**Por dónde arrancar:** #1+#2+#3 (D-01 completo + restore ZIM) son un bloque coherente — cierran el bug que ya corrompió datos. #4 (D-10) inmediatamente después blinda contra la reincidencia por concurrencia. Con eso, el money-path queda sólido; el resto es integridad incremental de bajo riesgo.
