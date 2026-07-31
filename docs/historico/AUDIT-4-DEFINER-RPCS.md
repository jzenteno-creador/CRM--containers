# Auditoría de las 4 RPCs pre-existentes SECURITY DEFINER owner=postgres

## Veredicto: **NO hace falta migración 026.** Las 4 son design-correct. No hay P1 de vuelta.

El verifier de CP3 elevó que 4 RPCs corren como DEFINER `owner=postgres` (superusuario → bypassrls):
`crm_registrar_waiver`, `crm_corregir_operacion_cerrada`, `crm_validar_reforzado`,
`crm_nueva_version_freetime`. Se auditaron EMPÍRICAMENTE en el harness (`harness/audit4.mjs`,
evidencia `audit4-evidence.json`). `[MEDIDO]` = output del harness · `[RAZONADO]` = lectura de spec/código.

## 1 · ¿Chequean ROL? — SÍ, las 4 `[MEDIDO]`
```
registrar_waiver        operador → RECHAZO "el waiver es plata: solo supervisor o administrador"
corregir_cerrada        operador → RECHAZO "corregir una cerrada es plata: solo supervisor o administrador"
validar_reforzado       operador → RECHAZO "validar reforzado requiere supervisor o administrador activo"
nueva_version_freetime  operador → RECHAZO · supervisor → RECHAZO "solo un administrador puede versionar tarifas" · admin → OK
```
Los operadores están bloqueados en las 4. `nueva_version_freetime` es admin-only (supervisor también
rechazado). Los guards de rol funcionan.

## 2 · ¿Chequean PLANTA? — NO, y es CORRECTO por diseño
- `crm_registrar_waiver` y `crm_corregir_operacion_cerrada` operan sobre una op de ABBOTT (planta
  distinta) y un supervisor las ejecuta OK `[MEDIDO]` → cross-planta sobre operaciones.
- `crm_validar_reforzado` opera sobre `contenedores`, que **no tiene columna de planta ni policy
  condicionada a planta** — no hay scope de planta que bypassear ahí (corrección del verifier). El
  supervisor la ejecuta OK, pero no prueba lo mismo que waiver/corrección.
- **Nada de esto es el P1.** El P1 era un OPERADOR escapando su scope de planta. Acá los operadores
  están bloqueados por rol; los supervisores/admin son **globales por diseño** `[RAZONADO, verificado:
  spec.md:291 "supervisor/admin todas" + 004_operacion.sql:223-274 — las policies de operaciones usan
  `p.rol in ('supervisor','administrador')` SIN condición de planta]`. Un supervisor tocando cualquier
  planta es lo intencionado, y es lo mismo que la RLS le concede de todas formas — bypassear la RLS no
  le da MÁS de lo que ya tiene.

## 3 · ¿El patrón C (owner=executor sin bypassrls) les aplica? — NO. DEBEN ser DEFINER-postgres
Dos piezas:
1. **`[MEDIDO]`** — write-policies (INSERT/UPDATE) para `authenticated` en las tablas destino:
   ```
   operacion_waivers : (ninguna)   freetime_origin : (ninguna)   contenedores : solo INSERT
   ```
   (freetime_origin incluso lo dice en comentario de 002: "SIN policies de INSERT/UPDATE"). Y
   `crm_corregir_operacion_cerrada` escribe operaciones **cerradas**, que la RLS bloquea para TODOS
   (la USING de `operaciones_update` excluye `cerrado`), incluido sup.
2. **"El executor de C se bloquearía a sí mismo"** — esto era INFERENCIA (no estaba medido cuando se
   escribió; el harness solo había medido la ausencia de policies). **Lo midió el verifier
   independiente** (`harness/verify_patternC.mjs`): aplicó el patrón C real sobre `crm_registrar_waiver`
   (owner = rol sin BYPASSRLS + GRANT insert explícito sobre `operacion_waivers`, para aislar RLS de
   GRANT) y ejecutó la llamada de un supervisor legítimo → **`42501 new row violates row-level security
   policy for table "operacion_waivers"`**. Confirmado: bajo C, la RPC se bloquea a sí misma.

→ Estas 4 son el path de escritura SANCIONADO de tablas sin policy y **tienen que** bypassear la RLS
(C es imposible, medido). Su límite de seguridad es —y debe ser— su guard de rol interno, verificado (§1).

## Diferencia con el P1 (por qué esto NO es lo mismo)
| | Las 6 RPCs operativas (P1) | Las 4 DEFINER-postgres |
|---|---|---|
| Scoping de planta | lo hacía la RLS (invoker) → DEFINER-naive lo borraba → escalada de OPERADOR | no aplica: sup/admin globales por diseño; operador bloqueado por rol |
| Tablas que escriben | tienen write-policy → el executor (C) puede escribirlas bajo RLS | **sin write-policy** → el executor se bloquearía → C imposible |
| Fix | opción C (owner=executor) | **ninguno — ya es correcto** |

## Lo único que es decisión de John (diseño, no bug)
¿Querés que los supervisores sean **planta-scoped** para las acciones de más plata (waiver, corrección)?
Hoy son globales (§14.4). Si sí:
- NO puede reusar el patrón C (esas tablas no tienen write-policy).
- Requiere asignar planta a los supervisores (hoy `planta_asignada_id` es null para ellos) + un check
  de planta EXPLÍCITO dentro de cada RPC (authz imperativa — lo que C evitaba).
- Es un cambio de requisito, no un fix de seguridad. Decilo y lo diseño.

Si no: no se toca nada. La 025 (fix del P1 real) es suficiente.

## Verificación independiente — **PASS** (con una corrección aplicada)
Un auditor Sonnet que no corrió esta auditoría re-ejecutó `audit4.mjs` (exit 0, resultados idénticos) y
cruzó cada celda contra el código fuente (002/003/004, spec §14). **Cazó un mislabel real**: el claim
"el patrón C se bloquearía a sí mismo" (sección 3) estaba etiquetado `[MEDIDO]` pero era inferencia —
el harness solo había medido la ausencia de write-policies, no el bloqueo. **El verifier lo MIDIÓ**
(`harness/verify_patternC.mjs`: C aplicado a `registrar_waiver` → `42501` sobre `operacion_waivers`) y
ya está incorporado arriba con la etiqueta correcta. También separó `validar_reforzado` (contenedores,
sin planta) de waiver/corrección en §2. Sin amaño: operador de test real (rol operador, planta BAHIA),
op de ABBOTT real, supervisor con `planta_asignada_id=null` válido (003 solo fuerza planta para operador).
Ninguna corrección cambia el veredicto: **no hace falta 026.**
