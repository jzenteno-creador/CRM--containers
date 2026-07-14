# Gate de la migración 025 (fix C del P1) — resultado

## **PASS.** La 025 aplica limpio y pasa los 5 checks + la re-auditoría RLS. Espera GO explícito de John para el apply a prod.

Todo corrido en Postgres embebido local (`harness/gate.mjs`, replay real 001-024 + el archivo
`docs/fix-p1/025_fix_p1_rpc_executor.sql`). Evidencia cruda: `harness/gate-evidence.json`.
`[MEDIDO]` = output del harness · `[RAZONADO]` = lectura de código, señalado como tal.

---

## 2.1 · Las 6 RPCs cross-planta rechazan `[MEDIDO]` — **PASS**
Operador de BAHIA invoca cada RPC contra una operación de ABBOTT. Esperado: sin efecto. Las 6:
```
crear_tanda→ABBOTT          : ERR 42501 RLS movimientos_planta   (no puede crear tanda en otra planta)
confirmar_ingreso(ABBOTT)   : confirmadas=0                       (RLS del movimiento no matchea)
registrar_salida(ABBOTT)    : salidas=0                           (RLS de operaciones no matchea)
confirmar_devolucion(ABBOTT): cerradas=0                          (idem)
mover_entre_plantas(ABBOTT) : ERR "La operación no está en planta"(SELECT RLS-scoped no la ve)
anular(ABBOTT)              : ERR "anular requiere supervisor"    (bloqueo por rol)
```
Cierra el 5/6 que quedó sin medir en el bake-off: **las 6, no una.** La promesa de C (la RLS sigue
scopeando bajo el executor) se cumple RPC por RPC.

## 2.2 · El hueco muere en las TRES tablas `[MEDIDO]` — **PASS**
```
UPDATE operaciones.fecha_retiro : 42501   UPDATE operaciones.estado : 42501
INSERT operaciones              : 42501   INSERT movimientos_planta : 42501
UPDATE movimientos_planta       : 42501   INSERT contenedores       : 42501
```
Incluye los vectores que hoy no tienen guard alguno (movimientos INSERT/UPDATE, contenedores INSERT).

## 2.3 · Las RPCs siguen funcionando — flujo E2E completo `[MEDIDO]` — **PASS**
Como operador (y supervisor donde el rol lo exige), end-to-end bajo C:
```
1 tanda           : creadas=1        2 ingreso planta : confirmadas=1
3 mover           : ok               4 salida         : salidas=1
5 devolución      : cerradas=1       6 waiver (sup)   : uuid devuelto
7 corrección cerrada (sup): ok       estado_final: cerrado, fecha_devolucion corregida
```
Incluye las 2 RPCs que ya eran DEFINER (waiver, corrección) — C no las toca y siguen andando.

## 2.4 · Gate de cálculo — goldens `[MEDIDO]` — **PASS**
`crm.dias_estadia` (DB) + el modelo de costo, contra los 43 casos del Excel:
```
baseline: 43/43 pass, 0 diffs      C: 43/43 pass, 0 diffs
```
C es de permisos, no de aritmética — cero regresión, como se esperaba, ahora medido.

## 3 · Re-auditoría RLS bajo C `[MEDIDO]` — **PASS**
```
anon SELECT operaciones/usuarios/freetime/navieras/contenedores : 42501 (las 5)
anon RPC perfil()                                               : 42501
operador se auto-promueve a administrador                       : 42501 (usuarios sin grant UPDATE)
operador lee usuarios                                           : n=1 (solo su propia fila)
```
Subconjunto representativo de la dimensión A de CP3. C **no toca** grants anon ni policies RLS, así
que el lockout anon que CP3 ya verificó en prod queda intacto; esto confirma que el fix no abrió nada.

## 2.5 · P2 · usuarios_publicos — **RESUELTO (con desvío medido)**
```
DEFINER (actual + re-creada en 025): operador ve n=4 nombres  → joins de UI OK   [MEDIDO]
security_invoker=true (lo pedido)  : operador ve n=1 (el propio) → join ROTO      [MEDIDO]
```
El `security_invoker=true` **rompe** el join de nombres (medido). Column-grants `(id,nombre)` tampoco
sirven: el panel Admin lee `email/rol/estado` de `usuarios` directo y los perdería `[RAZONADO:
admin/solicitudes/page.tsx:300]`. Por eso la 025 **mantiene la view SECURITY DEFINER** (leak = solo
nombres, que §14.6 quiere visibles) con un `COMMENT` documentando la excepción a §14.8. Silenciar el
advisor 0010 del todo requiere convertirla en función DEFINER + cambiar 3 `.from()` del front a
`.rpc()` — un deploy, fuera de alcance de esta migración. **Decisión de John.**

---

## Si el gate pasa (pasó): próximos pasos
1. **GO explícito de John** para `apply_migration` de la 025 a prod (con la DB en cero, tras el teardown).
2. Antes/durante: la re-auditoría RLS completa de CP3 (dimensión A entera) sobre prod con la 025 puesta.
3. `usuarios_publicos` P2: confirmar si se acepta la excepción DEFINER documentada o se agenda el
   cambio de front (función + `.rpc`).

## Verificación independiente — **PASS**
Un auditor Sonnet que no escribió la 025 ni corrió el gate re-ejecutó `gate.mjs` (EXIT=0) y obtuvo un
`gate-evidence.json` **idéntico** (salvo UUIDs). No halló ninguna celda `[MEDIDO]` que fuera razonamiento;
la única `[RAZONADO]` (2.5, column-grants romperían Admin) la verificó por fuera y es correcta. Extras que
corrió: confirmó vía `pg_proc` que **exactamente las 6** RPCs pasan a `prosecdef=true, owner=crm_rpc_executor`
y las 4 pre-existentes DEFINER quedan `owner=postgres` sin tocar; que el E2E valida contra el estado real de
la tabla (no solo el `ok` de la RPC); y cruzó el claim "5/6 sin medir en el bake-off" (correcto). Sin amaño.

**Residual que elevó (fuera del alcance del gate, para tenerlo presente):** las 4 RPCs pre-existentes
SECURITY DEFINER con `owner=postgres` (waiver, corrección de cerrada, validar_reforzado, nueva_version_freetime)
bypassan la RLS por completo y se apoyan SOLO en su guard de rol interno. La 025 no las toca (son paths de
admin/sup). No es una grieta de este fix, pero es un patrón a auditar con cuidado si se reusa.
