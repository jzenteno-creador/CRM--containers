# FIX P1 · Bake-off empírico — escritura directa de plata

## Veredicto: **Opción C** (RPCs a SECURITY DEFINER con owner = rol ejecutor sin BYPASSRLS + REVOKE)

Ganadora por evidencia, no por argumento. Única opción que satisface los 4 criterios:
default-deny estructural, **sin** introducir escalada, **sin** re-derivar authz, reversible con un GRANT.

Migración escrita y verificada: **`docs/fix-p1/025_fix_p1_rpc_executor.sql`** — NO aplicada (espera GO).

---

## Cómo se corrió (harness, no prod)

Postgres **embebido local** (`embedded-postgres`, cluster efímero en loopback:54329). Por cada
opción: DB fresca → stubs de Supabase (roles `anon`/`authenticated`, `auth.uid()` leyendo
`request.jwt.claims`, `storage`, `pg_trgm`/`pgcrypto` en `extensions`) → **replay real de las
migraciones 001-024** → fixture (operador BAHIA, operador ABBOTT, ops `en_planta` y
`en_transito_a_terminal` en cada planta) → DDL de la opción → batería de probes.

Cada probe corre como el operador BAHIA reproduciendo lo que hace PostgREST:
`SET LOCAL ROLE authenticated; set_config('request.jwt.claims', {sub, role})`. Es el PATCH
crudo que el clasificador me bloqueó en prod — acá, en mi sandbox, se puede.

**Fidelidad del harness (prueba de que modela prod):** en `baseline`, el operador BAHIA
reescribe `fecha_retiro` de su op `en_planta` (`rows=1`) y NO puede tocar la de ABBOTT
(`rows=0`) — exactamente el P1 y su límite de planta. Evidencia cruda: `harness/evidence.json`.

---

## Los 4 criterios × 3 opciones

`[MEDIDO]` = output crudo del harness (verificable en `evidence.json`). `[RAZONADO]` = análisis
estático (lectura de las migraciones + del DDL de cada opción), señalado como tal — no está ejecutado.
El auditor independiente (§Verificación) confirmó las celdas MEDIDAS bit a bit y marcó las RAZONADAS.

| Criterio | A · DEFINER naive (owner=postgres) | B · guard allowlist + GUC | **C · DEFINER owner=executor** |
|---|---|---|---|
| **1a. Columna nueva nace cerrada** `[MEDIDO]` | ✅ `raw_patch_columna_nueva → 42501` | ✅ `→ P0001` | ✅ `raw_patch_columna_nueva → 42501` |
| **1b. Tabla nueva nace cerrada** `[RAZONADO]` | disciplina: no grantear DML | disciplina: agregar guard | disciplina: no grantear DML — **igual que A/B** (ninguna es automática; el patrón de 004 grantea al crear tabla → las tres tienen que acordarse) |
| **2. ¿Introduce escalada que hoy no existe?** `[MEDIDO]` | 🔴 **SÍ** `rpc_devolucion_abbott_cross → cerradas=1` (operador BAHIA cierra op de ABBOTT) | 🟢 no `→ cerradas=0` | 🟢 **no** `→ cerradas=0` |
| **3. Superficie / authz re-derivada** | A: **1/6 RPC MEDIDA** cruzando planta (`cerradas=1`); las otras 5 `[RAZONADO]` (006: las 6 son invoker y ninguna referencia `planta_asignada_id` — confirmado por el auditor) → re-derivar authz en 6 funciones | 6 triggers + flag en 6 RPCs + premisa del GUC `[MEDIDO/RAZONADO, §GUC]` | **0 líneas de authz** `[RAZONADO: conteo de DDL]`. 1 rol + grants + 6 `ALTER…OWNER/DEFINER` + 3 `REVOKE`. Cuerpos intactos; el scoping medido intacto (`cerradas=0`) |
| **4. Reversibilidad** `[RAZONADO: conteo de DDL]` | revertir 6 security modes + re-grant | drop 6 triggers + unflag 6 RPCs | **un `GRANT insert,update … to authenticated`** re-abre; owner/security revertibles |
| **¿Cierra el hueco?** `[MEDIDO]` | ✅ raw writes → `42501` | ✅ raw writes → `P0001`/`42501` | ✅ raw writes → `42501` |
| **RPCs siguen funcionando** `[MEDIDO]` | ✅ `cerradas=1` / `creadas=1` | ✅ | ✅ `cerradas=1` / `creadas=1` |

**Lo que decide, y está 100% MEDIDO:** A introduce **escalada cross-planta** (criterio 2, el peor) —
`cerradas=1` sobre ABBOTT, reproducido bit a bit por el auditor. B y C **no** escalan (`cerradas=0`).
Entre B y C, C gana por criterios 3-4 (0 authz re-derivada, reversible con un GRANT) — celdas
RAZONADAS, respaldadas por lectura de código que el auditor replicó. La igualdad B/C en el criterio 1
(ambas cierran la columna nueva; ambas necesitan disciplina para tabla nueva) NO cambia el veredicto.

---

## Evidencia por opción (`harness/evidence.json`, output crudo)

### baseline — la enfermedad, reproducida
```
raw_patch_fecha_retiro_bahia : ok rows=1        ← EL P1, empíricamente confirmado
raw_patch_fecha_retiro_abbott: ok rows=0        ← RLS scopea cross-planta (límite del hueco)
raw_patch_estado_cerrado     : ok rows=1        ← freeze fuera de RLS
raw_patch_columna_nueva      : ok rows=1        ← columna nueva NACE ABIERTA (la clase del bug original)
raw_insert_movimiento        : ok rows=1        ← movimientos_planta: mismo hueco
raw_insert_contenedor        : ok rows=1        ← contenedores: mismo hueco
rpc_devolucion_abbott_cross  : ok cerradas=0    ← RPC invoker NO cruza planta
```

### A · DEFINER naive (owner=postgres) + REVOKE — cierra, pero ESCALA
```
raw_patch_*                  : ERR 42501 permission denied   ← default-deny OK
rpc_devolucion_bahia         : ok cerradas=1                 ← RPC funciona
rpc_devolucion_abbott_cross  : ok cerradas=1  🔴 ESCALADA    ← operador BAHIA cierra op de ABBOTT
```
Causa: las 6 RPCs son INVOKER y **el scope de planta lo impone la RLS, no la función** (006, textual).
Al pasarlas a DEFINER owner=postgres (superusuario, bypassa RLS), las 6 quedan sin scope a la vez.

### B · guard allowlist (3 tablas) + GUC de contexto — cierra sin escalar, pero…
```
raw_patch_* / raw_insert_*   : ERR P0001 via directa no permitida  ← cierra las 3 tablas
rpc_devolucion_abbott_cross  : ok cerradas=0                        ← sin escalada (RPCs siguen invoker)
```
**Verificación del GUC `app.via_rpc` (lo que decidía B) — 4 vectores:**
```
v1_via_claim_jwt      : v=""     ← un claim del JWT NO setea la GUC (PostgREST → request.jwt.claims)
v2_via_request_headers: v=""     ← un header del cliente NO la setea (PostgREST → request.headers)
v3_dentro_de_rpc      : cerradas=1  ← control: dentro de la RPC (flag seteado) el guard deja pasar
v4_via_sql_set_local  : v="on"   ← SET LOCAL SÍ la setea… pero un cliente PostgREST NO corre SQL SET
```
Conclusión GUC: por los vectores REALES del cliente (claim, header) **no se puede setear** → B es
sólida vía PostgREST. Pero su seguridad **depende de una premisa** ("el cliente no tiene SQL") en
lugar de un cierre a nivel de grant. Además necesita un guard por tabla (whack-a-mole: tabla nueva
= hueco nuevo).

### C · DEFINER owner=crm_rpc_executor (sin BYPASSRLS) + REVOKE — **ganadora**
Fuente: **el archivo real `docs/fix-p1/025_fix_p1_rpc_executor.sql`** aplicado sobre 001-024.
```
SUPUESTO 1 (rol): crm_rpc_executor  rolbypassrls=false  rolsuper=false        ✓
SUPUESTO 3 (auth.uid bajo DEFINER): perfil → "operador / planta=<BAHIA>"      ✓  (usuario real preservado)
raw_patch_* / raw_insert_*   : ERR 42501 permission denied     ← default-deny estructural (incl. columna nueva)
rpc_devolucion_bahia         : ok cerradas=1                   ← SUPUESTO 2: la RLS `TO authenticated`
rpc_crear_tanda_bahia        : ok creadas=1                        aplica al executor por membresía
rpc_devolucion_abbott_cross  : ok cerradas=0  🟢 SIN ESCALADA  ← la RLS sigue scopeando por planta
```
Los 3 supuestos de John dieron verde. C = el default-deny de A **sin** la escalada de A, **sin** la
dependencia del GUC de B, y **sin re-derivar una sola línea** de autorización (los cuerpos de las
RPC no se tocan: la RLS de 004 sigue siendo el enforcement, ahora sobre el executor).

---

## El hallazgo de método (para el registro)

**El pilar "cero UPDATE crudo, todo por RPC" nunca estuvo enforced a nivel DB.** Vivió en la
disciplina del front: los grants a `authenticated` sobre las tablas de plata estuvieron
default-ABIERTOS todo el tiempo, y el guard era una blocklist parcial. Nueve gates lo dieron por
bueno sin cruzarlo una vez contra la DB — el mismo patrón que la regla de días ("día 0" escrito,
nunca verificado). **Regla nueva del proyecto: todo pilar arquitectónico se prueba contra la DB
—como este bake-off— o no existe.**

---

## Migración ganadora — `docs/fix-p1/025_fix_p1_rpc_executor.sql`

Resumen (NO aplicada, espera GO):
1. `create role crm_rpc_executor nologin` (INHERIT, sin BYPASSRLS) + `grant authenticated to crm_rpc_executor`.
2. Grants de escritura al executor: INSERT/UPDATE en operaciones y movimientos_planta, INSERT en contenedores.
3. Las 6 RPCs operativas → `SECURITY DEFINER`, `OWNER crm_rpc_executor`. **Cuerpos intactos.**
4. `REVOKE INSERT, UPDATE … FROM authenticated` en las 3 tablas de plata (SELECT queda).

Fuera de alcance (ya seguros / intencionales): `freetime_origin`/`operacion_waivers`/`operacion_eventos`
(SELECT-only); las RPCs ya DEFINER de admin/sup (waiver, corregir_cerrada, validar_reforzado,
nueva_version_freetime); `incidencias`/`incidencia_fotos` (write directo sancionado, AGENTS.md).

**Antes de aplicar (recomendado):** correr el gate de cálculo (goldens) + la re-auditoría RLS de CP3
sobre la DB en cero con la migración puesta, y confirmar `usuarios_publicos` (P2) en la misma tanda.

---

## Verificación independiente

Un auditor Sonnet **que no corrió el bake-off** re-ejecutó el harness desde cero
(`rm -rf pgdata evidence.json; node bakeoff.mjs`) y comparó su `evidence.json` con el entregado.

**Resultado: PASS** — "el bake-off está respaldado por evidencia, no por argumento" en las celdas que
deciden el veredicto. Su `evidence.json` salió **bit-idéntico** (salvo UUIDs aleatorios). Confirmó los
4 números decisivos con sus propios datos (baseline `rows=1`, A `cerradas=1`, C `cerradas=0`+`42501`,
GUC `v=""`/`v="on"`), que la variante C aplica el **archivo real** de la migración (no DDL inline), y
que no hay amaño (batería y fixture compartidos; misma RPC y mismo cruce de planta para la escalada de
A y el cierre de C).

**Reservas que levantó (ya incorporadas arriba como `[RAZONADO]`):**
1. "Tabla nueva" (criterio 1b) no está medido; y bajo C, si un dev copia el patrón de 004
   (`grant insert to authenticated`) al crear una tabla, el hueco vuelve igual que en B → la ventaja de
   C ahí es de convención, no estructural. **Corregido**: 1b ahora dice "igual que A/B".
2. "6/6 RPCs pierden el scope" (criterio 3): solo **1/6** se cruzó por planta en runtime; las otras 5
   son análisis estático de 006 (que el auditor replicó y confirmó: las 6 son invoker, ninguna
   referencia `planta_asignada_id`). **Marcado** como 1/6 medido + 5/6 razonado.
3. "Reversibilidad" (criterio 4): sin probes de revert; es conteo de DDL. **Marcado** `[RAZONADO]`.

Ninguna reserva toca el criterio que mata a A (escalada, 100% medido y reproducido). El veredicto se
sostiene.
