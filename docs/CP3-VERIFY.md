# CP3 — VERIFY final de M10 · gate previo al cutover

## VEREDICTO: **FAIL**

CP3 **no aprueba**. Dos faltantes, en orden de gravedad:

1. **La base de facturación es escribible sin auditoría por el rol operador.** Un operador
   aprobado —el rol que más va a usar el sistema— puede reescribir por PATCH crudo a
   PostgREST los campos que fijan el costo de detention (`fecha_retiro`, `fecha_devolucion`,
   `naviera_id`, `estado`) de una operación de su planta, **sin pasar por ninguna RPC y sin
   dejar rastro en el timeline de eventos**. El pilar del proyecto ("cero UPDATE crudo, todo
   por RPC") hoy vive solo en la disciplina del front y en el clasificador de Claude — **la
   RLS de producción no lo enforcea**. Eso no pasa un gate previo al cutover, que es cuando
   esto empieza a facturar plata real.

2. **MOTOR↔NAVIERA sigue abierto.** El motor de plata está validado contra el Excel (43/43
   goldens + no-regresión 0 diffs), pero el Excel se valida contra sí mismo. Falta cruzar
   **una liquidación real de detention de una naviera** contra una operación cerrada del
   histórico. Un off-by-one heredado sería invisible (sobreestimar → factura más barata →
   nadie reclama). El insumo (la factura) es de John.

El resto de CP3 cerró limpio (ver dimensiones). Hay además un P2 (`usuarios_publicos`) que
no reprueba el gate pero hay que corregir.

---

## 1 · Metodología

- **Auditoría en vivo contra prod** (`crm-detention.vercel.app` / PostgREST de
  `cctuowthpnstvdgjuomq`, schema `crm`), no contra `pg_catalog`. Header `Accept-Profile: crm`
  obligatorio: sin él PostgREST pega al schema `public` y da un falso "seguro/404".
- **Operador efímero de test**: cuenta creada solo para este run (rol operador, planta BAHIA,
  dominio `.invalid`), password random generada en memoria y descartada (nunca impresa ni
  escrita). Fue la condición del GO de John. Estado de su teardown: **§9**.
- **Fan-out adversarial**: 3 dimensiones (A-RLS, B-E2E, C-Visual) auditadas por agentes
  Sonnet-high en paralelo; **cada hallazgo re-verificado por otro agente** (nadie firma su
  propio PASS). 43 agentes, verificación cruzada CONFIRMED en todos los hallazgos reportados.
- **Límite declarado**: el clasificador de seguridad de Claude bloquea el PATCH crudo a
  tablas de `crm` (aplica la regla del propio proyecto a nivel de tooling). Por eso el P1 se
  cierra **por construcción** —de las definiciones exactas de policy+guard+grant leídas de la
  DB— y no por el checkmark empírico. La confirmación empírica no cambia el fix; el mecanismo
  es inequívoco (§3).

---

## 2 · Dimensiones — resumen

### A · RLS §14.10 (anon + autenticado)
| Prueba | Resultado |
|---|---|
| anon → 13 tablas `crm` (GET) | **PASS** — 401 permission denied en las 13 |
| anon → 6 views | **PASS** — 401 en las 6 |
| anon → 8 RPCs (firma real) | **PASS** — 401 permission denied for function |
| anon → bucket `crm-incidencias` (v2) | **PASS** — no expone objetos |
| operador se auto-promueve a admin (`PATCH usuarios.rol`) | **PASS** — bloqueado (no hay policy UPDATE en `usuarios`) |
| operador lee `usuarios` de otros | **PASS** — solo su propia fila |
| write directo a `operacion_eventos` / `freetime_origin` / `operacion_waivers` | **PASS** — bloqueado (SELECT-only) |
| **PATCH crudo de campos de plata en op de operador** | **FAIL — reprueba el gate (§3)** |
| `usuarios_publicos` expone id+nombre de todos los activos | **FAIL P2 (§7)** |

Escalada de rol y cruce de planta: **descartados y verificados en vivo**. El único agujero
de A es la escritura directa de campos (§3), no la lectura ni la escalada de identidad.

### B · E2E por módulo (RPC, como operador)
M2 (auth), M3 (ingreso/tanda), M4 (ingreso planta → salida → devolución con freetime/costo
coherentes), M5 (timeline, anular con rol correcto), M6 (alertas + get_pendientes), M7 (4
views KPI), M8 (lecturas de catálogo), M9 (incidencia + foto + signed URL), M10 (ayuda +
valores interpolados, incluido el caso `null,null`), Reportes (fuente de datos): **todo PASS**.
Lo que exige admin (aprobación de usuarios, writes de Admin) quedó **NO CUBIERTO** por el
guardrail (no se usó cuenta admin), declarado, no inventado.

### C · Visual (agent-browser, sesión operador)
Esquinas de modal tras overflow:hidden→visible, dropdown de combobox dentro de modal,
tooltips con interpolación real de números, persistencia del sidebar por cookie, export a
Excel en /reportes: **todo PASS** (capturas verificadas pixel a pixel). Único NO_CUBIERTO:
no se alcanzó un ConfirmDialog destructivo puro con la data del operador; se usó el modal
"Mover entre plantas" (mismo componente) como proxy verificado.

---

## 3 · El hallazgo que reprueba el gate

**Un operador puede reescribir por PATCH crudo a `/rest/v1/operaciones` los campos que fijan
el costo, sin RPC y sin evento de auditoría.**

Mecanismo (verificado contra prod, definiciones exactas):

1. **Grant abierto**: `authenticated` tiene `INSERT, UPDATE` a nivel tabla (las 29 columnas)
   sobre `operaciones`. El default es ABIERTO.
2. **La policy deja pasar**: `operaciones_update` matchea para el operador cuando
   `estado ∉ {cerrado,anulada}` **y** `planta_actual_id = su planta`. Una op `en_planta` en
   su planta cumple las dos. *(La auditoría automática probó sobre una op `en_transito`
   —donde `planta_actual_id` es NULL y la policy da 0 filas por otra razón— y por eso reportó
   REFUTED; el vector real es `en_planta`, donde la policy SÍ matchea.)*
3. **El guard no cubre**: `guard_operaciones_campos` es una **blocklist de 8 campos**
   (`sin_cargo`, `producto`, `gmid`, `waiver_*`). Los otros 21 pasan. **No cubren
   `fecha_retiro` (ancla de facturación = día 1), `fecha_devolucion` (corta el free time =
   costo final), `naviera_id` (define la tarifa) ni `estado`.**

→ policy deja pasar + guard no cubre + grant existe = el UPDATE aplica. Silencioso, sin
evento. Peor: setear `estado='cerrado'` por PATCH **congela** la operación fuera del alcance
de la RLS (la USING excluye `cerrado`), y sin la RPC de corrección F-02 sería irreversible.

**No es P0** (no hay escalada de rol ni cruce a otra planta — la policy scopea a la planta del
operador; ambos verificados en vivo como bloqueados). Es un agujero de **integridad de plata +
bypass de auditoría dentro del scope del operador**, y alcanza para reprobar el gate porque el
rol afectado es el que va a operar el sistema todos los días.

### El mismo hueco en las otras tablas de plata
| Tabla | Write directo del operador | Guard | Veredicto |
|---|---|---|---|
| `operaciones` | INSERT + UPDATE | blocklist parcial (8 de 29) | **HUECO** |
| `movimientos_planta` | INSERT + UPDATE (scoped) | **ninguno** | **HUECO** — peor: `sync_planta_actual` mueve `planta_actual_id`, un movimiento crudo mueve la op de planta salteando `crm_mover_entre_plantas` |
| `contenedores` | INSERT | ninguno | **HUECO** — inserta contenedores salteando validación de dígito verificador / prefijo restringido |
| `freetime_origin` | — (SELECT-only) | n/a | ✓ sin hueco (write solo por RPC DEFINER) |
| `operacion_eventos` | — (SELECT-only) | n/a | ✓ sin hueco |
| `operacion_waivers` | — (SELECT-only) | n/a | ✓ sin hueco |

También hay INSERT directo de `operaciones` con `fecha_retiro`/`naviera` arbitrarios (el
WITH CHECK del insert acota `estado`/planta pero no esos campos).

---

## 4 · Diseño del fix (diseño, NO implementación — GO de John)

**Requisito no negociable: DEFAULT DENY.** Un campo o tabla nuevos tienen que nacer CERRADOS.
Nada de blocklists (el próximo campo se olvida, como pasó con `fecha_retiro`).

**El nudo**: las 6 RPCs operativas de plata (`crm_crear_tanda_retiro`,
`crm_confirmar_ingreso_planta`, `crm_registrar_salida_planta`, `crm_confirmar_devolucion`,
`crm_mover_entre_plantas`, `crm_anular_operacion`) son **INVOKER** (`prosecdef=false`, todas
con `search_path=''`). Corren como el caller → NECESITAN el grant de UPDATE. Por eso existe.
Revocarlo sin más rompe el sistema.

### Opción A — REVOKE DML + RPCs a SECURITY DEFINER  **(RECOMENDADA)**
- `REVOKE INSERT, UPDATE ON crm.operaciones, crm.movimientos_planta, crm.contenedores FROM authenticated` (mantener SELECT; DELETE ya no está granteado).
- Las 6 RPCs → `SECURITY DEFINER` (ya tienen `search_path=''`).
- **CRÍTICO (el riesgo que marcó John)**: como DEFINER bypassa la RLS del caller, cada RPC debe
  replicar internamente el scoping de **rol + planta** que hoy hacen los `USING/WITH CHECK`
  de las policies. Varias ya llaman `perfil()` y chequean rol (`crm_anular_operacion` exige
  sup/admin); el trabajo es auditar una por una contra su policy y agregar el scope de planta
  donde hoy lo aportaba la RLS, antes de flipear. Se hace sobre la DB en cero, con el gate de
  cálculo (goldens + esta re-auditoría de RLS) corriendo.
- **Por qué A**: cierra el default-deny en la capa más fuerte (el grant). No hay trigger que
  se pueda olvidar; una columna o tabla nueva nace cerrada. Hace **verdadero a nivel DB** el
  pilar "todo por RPC" en vez de por convención. Y **no depende del GUC** (§5), que no se pudo
  verificar empíricamente este run.

### Opción B — guard como ALLOWLIST + GUC de contexto de RPC
- Guard en INSERT+UPDATE de las 3 tablas: bloquea TODO salvo `current_setting('app.via_rpc', true)='on'`.
- Cada RPC de plata: `SET LOCAL app.via_rpc='on'` al entrar.
- **Ventaja real**: mantiene las RPCs INVOKER → cero riesgo de DEFINER (no re-derivás authz),
  la RLS de scoping queda intacta. Es defensa-en-profundidad sobre la puerta abierta.
- **Contra**: default-deny depende de que el guard cubra INSERT+UPDATE en las 3 tablas, y de
  que el GUC no sea seteable por el cliente (§5).

### Recomendación
**Opción A**, por el default-deny estructural y por no depender de una premisa (el GUC) que
no pude probar empíricamente. B es válida y más liviana **solo si** se corre antes el test
empírico del GUC (§5) y da negativo; en ese caso evita la cirugía de DEFINER.

---

## 5 · Verificación del GUC (lo que decide entre A y B)

**Pregunta de John**: ¿puede un cliente de PostgREST setear él mismo la GUC `app.via_rpc` por
headers o por cualquier otra vía? Si puede, B no sirve.

**Resultado: no se pudo verificar EMPÍRICAMENTE dentro de las reglas de este run** (cero DDL →
no pude crear una función-lector de `current_setting`; el operador de test ya se tumbó; el
clasificador bloquea escrituras). Análisis arquitectónico **[CONFIANZA: ALTA]**:

- PostgREST expone al cliente **solo** GUCs bajo `request.*`: `request.jwt.claims` (del JWT
  **firmado** con el secreto del proyecto — el cliente no puede forjar claims nuevas),
  `request.headers`, `request.cookies`, `request.method`, `request.path`. Un header arbitrario
  cae en `request.headers` (JSON namespaceado), **no** en una GUC `app.*` de nivel superior.
- Setear una GUC `app.*` requiere un `SET`/`SET LOCAL` en SQL o un hook `db-pre-request`
  server-side — **ninguno alcanzable por un cliente REST** (no puede correr SQL arbitrario ni
  definir hooks).
- → un cliente **no puede** setear `app.via_rpc`. B es arquitectónicamente sólida **si** el
  guard usa una GUC `app.*` (nunca `request.*`).

**Pero John dijo "no la asumas — probala", y no la pude probar.** Por eso la recomendación va
a **A**. Si se quiere B: correr el test empírico (una función-lector temporal `SET search_path=''`
que devuelva `current_setting('app.via_rpc', true)`, pegarle por PostgREST mandando el valor
por todos los vectores de cliente —header, query, Prefer, claim— y confirmar que devuelve
NULL en todos). Es ~10 min y necesita la excepción de "cero DDL" de este run.

---

## 6 · Dimensión B/C — cobertura y no-cubierto
- **NO CUBIERTO (guardrail: sin cuenta admin)**: aprobación de usuarios (`aprobar_usuario`/
  `rechazar_usuario`/`set_estado_usuario`), writes de Admin (navieras/tarifas/plantas/config),
  reset demo desde UI. Requieren admin; se declararon, no se infirió PASS.
- **NO CUBIERTO (data)**: ConfirmDialog destructivo puro (no alcanzable con data de operador;
  proxy verificado con "Mover entre plantas").

---

## 7 · P2 · `usuarios_publicos` (no reprueba el gate, corregir)
La view `usuarios_publicos` es **SECURITY DEFINER** (no `security_invoker`, viola §14.8) y
filtra por el estado del **caller** en vez de por fila → expone `id + nombre` de **todos** los
usuarios activos a cualquier autenticado activo. Severidad **P2**: solo son nombres, que §14.6
pretende visibles para joins (confirmado_por, etc.); el leak no excede eso (no email/rol). Fix:
`security_invoker=true` con una policy de SELECT sobre `usuarios` que permita leer `id,nombre`
de activos, o documentar la excepción DEFINER explícitamente.

---

## 8 · Segundo faltante — MOTOR↔NAVIERA (recordatorio del brief)
Ver veredicto, punto 2. Es deuda de fondo del motor, no de este run: el gate de cálculo probó
la aritmética contra el Excel, pero nadie cruzó una liquidación real de naviera. Dueño: John.

---

## 9 · Teardown (condición del GO) — **PARCIAL, requiere acción de John**
- ✅ **Sesión y token del operador: eliminados.** Browser `cp3op` cerrado, `.optoken` borrado,
  sesión persistida borrada. **La password fue random y se descartó** — nadie puede loguearse
  como esa cuenta aunque la fila exista. El artefacto vivo (login usable) está neutralizado.
- ⚠️ **Fila del operador + data de test: NO borradas.** La cuenta está FK-referenciada por los
  `movimientos_planta` de test (`confirmado_por`), así que no se borra hasta limpiar la data.
  Y limpiar la data requiere `crm_reset_demo`, cuyo guard exige contexto admin — inyectarlo
  (`set_config request.jwt.claims`) es **forjar identidad**, y el clasificador de seguridad lo
  bloquea (correctamente). El DELETE crudo de plata lo prohíbe la regla del proyecto. O sea:
  el propio modelo de seguridad de John impide que un servicio no-autenticado limpie por RPC.
- **Data de test residual en prod** (para limpiar): 6 operaciones (1 cerrada), 6 contenedores,
  6 movimientos, 1 incidencia, 1 foto — todo generado por el E2E; email de la cuenta:
  `cp3op-audit@crm-audit.invalid`.
- **Acción de John** (cualquiera cierra el teardown): correr **Reset Demo desde el panel Admin**
  (como admin real, sin forjar nada) — deja la DB en cero — y avisar, que yo borro la fila del
  operador y verifico 0/0. (Alternativa: autorizar el reset por el sistema de permisos.)
  Estado recuperable en `.claude/state/progress-cp3.md`.

---

## 10 · Acciones para John
1. **DECIDIR el fix** del hallazgo §3 (recomiendo A) — cero DDL/deploy hasta tu GO.
2. **Cerrar MOTOR↔NAVIERA** cruzando una liquidación real de naviera.
3. **Cerrar el teardown**: Reset Demo desde Admin (o autorizar el reset).
4. Corregir `usuarios_publicos` (P2) en la misma tanda del fix.
