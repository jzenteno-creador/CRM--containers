# CP1 — Entregable M1: Schema completo + RLS + triggers + seeds

**Fecha:** 2026-07-08 · **Branch:** `v2/m1-schema` · **Proyecto Supabase:** `cctuowthpnstvdgjuomq`, schema **`crm`** (addendum §21)
**Plan:** `docs/v2/plan-m0-m1.md` §2 · **Spec:** `spec.md` v2.1
**Regla cumplida:** escritura EXCLUSIVA en schema `crm` + bucket `crm-incidencias` + triggers `crm_*` sobre `auth.users`. `detention` y `public` solo lectura de referencia.
**Screenshots M0:** producidos en el VERIFY de M0 (branch `v2/m0-scaffold`, mergeada) — no forman parte de este módulo.

---

## 1. Migraciones aplicadas (archivo git = contenido aplicado vía MCP `apply_migration`)

| # | Archivo (`crm-v2/supabase/migrations/`) | Commit | Contenido |
|---|---|---|---|
| 001 | `001_extensions_base.sql` | `d4ff6c7` | `CREATE SCHEMA crm` + `GRANT USAGE` a anon/authenticated (sin grants de tabla para anon) + pg_trgm (idempotente, ya instalada) + `set_updated_at()` + `hoy_ar()` + **`dias_estadia()`** (Decisión 2: única definición, inclusiva, retiro = día 1) + **`perfil()`** DEFINER STABLE |
| 002 | `002_maestros_config.sql` | `9256ed7` | `plantas` (seed BAHIA/ABBOTT, CHECK fija universo, sin escritura de app), `navieras` (`cobra_detention_origen`), `freetime_origin` (versionado, `ux_freetime_vigente (naviera_id, regimen) WHERE vigente_hasta IS NULL`, **cero policies de escritura**), `configuracion` (clave PK; seeds `umbral_alerta_amarillo=3`, `dominios_sugeridos`, `admin_bootstrap_email`), `ayuda_contenido` + RLS de todos + **`crm_nueva_version_freetime`** (DEFINER, guard admin, idempotente, cierra vigencia previa) |
| 003 | `003_identidad.sql` | `5696bc8` | `usuarios` (FK `auth.users` ON DELETE CASCADE, CHECK operador⇒planta, `rechazo_motivo`) + RLS (propia fila activa ∨ admin — una sola policy permissive) + FK diferida `configuracion.updated_by` + **`handle_new_user`** (AFTER INSERT auth.users, idempotente) + **`bootstrap_admin`** (AFTER UPDATE OF email_confirmed_at — Decisión 8: transición única, email = clave, guard primer-admin-único, clave consumida) + RPCs **`aprobar_usuario` / `rechazar_usuario` / `set_estado_usuario`** (DEFINER, guard admin, anti-auto-suspensión) |
| 004 | `004_operacion.sql` | `9ee9c62` | `contenedores` (CHECK ISO `^[A-Z]{4}[0-9]{7}$`), `operaciones` (sin estado `cargado`; paridad v1: `sin_cargo/producto/gmid/observaciones`; CHECKs D-05; **`ux_operacion_abierta`**), `movimientos_planta` (+CHECK origen≠destino, llegada≥salida), `operacion_eventos` (CHECK con `reapertura`/`correccion`; **cero policies de escritura**), `incidencias` (atribución no falsificable), `incidencia_fotos` + toda la matriz RLS §2.2 + índices (trgm + btree + FKs) + **`crm_validar_reforzado`** (DEFINER supervisor+; contenedores sin UPDATE directo) |
| 005 | `005_triggers_eventos.sql` | `371799d` | Timeline por triggers **DEFINER**: `evt_operacion_insert` (retiro), `evt_operacion_update` (carga+egreso / devolucion / anulacion / **correccion por cambio de sin_cargo**), `evt_movimiento` (movimiento con origen NOT NULL; ingreso_planta con guard v1 que cubre tránsito corto), `sync_planta_actual` (única vía de `planta_actual_id`), `evt_incidencia` + **`guard_operaciones_campos`** (BEFORE UPDATE, INVOKER: operador no toca sin_cargo/producto/gmid) |
| 006 | `006_rpcs_operativas.sql` | `410c281` | 6 RPCs **SECURITY INVOKER** (RLS aplica adentro): `crm_crear_tanda_retiro` (uuid pre-generados sin RETURNING; backstop unique_violation), `crm_confirmar_ingreso_planta`, `crm_registrar_salida_planta`, `crm_confirmar_devolucion`, `crm_mover_entre_plantas`, `crm_anular_operacion`. usuario vía `perfil()`, nunca parámetro. Sin inserts manuales de eventos |
| 007 | `007_views_notificaciones.sql` | `8a7a1dc` | **`vista_alertas`** (`security_invoker=true`; días inclusivos; lookup vigencia por `regimen='vacios'`; semáforo con **`neutro`**; sin_cargo⇒0; no cobra⇒NULL; umbral desde config) + **`usuarios_publicos`** (owner-based + `security_barrier`, solo `id,nombre`, gate activo — excepción §14.8 documentada, Decisión 6) + **`get_pendientes`** (DEFINER, guard activo, scope planta interno) |
| 008 | `008_seeds.sql` | `d017855` | 14 navieras canónicas + `alias_navieras_historico` en configuracion (artefacto para cutover/M3) + 14 filas freetime (valores Excel, vigencias reales v1 — §5) + 6 FAQ iniciales (§15.2) |
| 009 | `009_storage_incidencias.sql` | `a81a180` | Bucket **`crm-incidencias`** privado + policies `crm_incidencias_select/insert` sobre `storage.objects` (solo activos; path `<incidencia_id>/…` encadenado a la visibilidad RLS de la incidencia) |
| 010 | `010_fix_function_acl.sql` | `2e54979` | **Fix de la propia auditoría**: `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA crm FROM public, anon` — el default privilege por-schema de 001 es aditivo y no quita el EXECUTE built-in a PUBLIC (ver §7 Desvíos) |

**Inventario final del schema `crm`** (query a catálogos, 2026-07-08): 12 tablas (**0 sin RLS**), 2 views, 24 funciones (**14 DEFINER** — lista cerrada exacta, 10 INVOKER), 26 policies en `crm` + 2 en `storage.objects`, 18 triggers en `crm` + 2 en `auth.users` (`crm_handle_new_user`, `crm_bootstrap_admin`), 47 índices.

---

## 2. Matriz RLS final (todas las policies `TO authenticated`; anon sin ningún grant)

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `plantas` | activo | — | — | — |
| `navieras` | activo | admin | admin (USING+CHECK) | — |
| `freetime_origin` | activo | — (solo RPC DEFINER) | — (versionado solo RPC) | — |
| `configuracion` | activo | admin | admin | — |
| `ayuda_contenido` | activo | admin | admin | — |
| `usuarios` | propia fila ∧ activo ∨ admin activo (1 policy) | — (solo trigger DEFINER) | — (solo RPCs admin) | — |
| `contenedores` | activo | operador+ (vía tanda INVOKER) | — (reforzado solo RPC DEFINER sup+) | — |
| `operaciones` | activo ∧ (sup/admin ∨ operador: `planta_actual`=su planta ∨ ∃mov en_transito→su planta) | operador+ ∧ estado inicial válido ∧ `planta_actual_id IS NULL` ∧ cierre limpio | 1 policy: USING no-cerrada/anulada ∧ (sup/admin ∨ operador su planta); CHECK operador ⇒ estado≠'anulada' ∧ su planta | — |
| `movimientos_planta` | activo ∧ (sup/admin ∨ operador: origen=su planta ∨ destino=su planta) — **directo por plantas, sin subquery a operaciones** | operador: origen=su planta ∨ (origen NULL ∧ destino=su planta); sup/admin libre | confirmación: estado='en_transito' ∧ (sup/admin ∨ destino=su planta) | — |
| `operacion_eventos` | activo ∧ EXISTS operación visible | **nadie** (solo triggers DEFINER) | nadie | — |
| `incidencias` | activo ∧ EXISTS operación visible | operador+ ∧ op visible ∧ usuario_id propio o NULL | supervisor+ | — |
| `incidencia_fotos` | activo ∧ EXISTS incidencia visible | operador+ ∧ incidencia visible | — | — |
| `storage.objects` (bucket crm-incidencias) | activo ∧ incidencia del path visible | activo ∧ incidencia del path visible | — | — |

Transversales cumplidas: toda policy exige activo (vía `perfil()` o el propio `estado_cuenta` en la fila propia); `auth.uid()` y `perfil()` siempre como `(select …)` (InitPlan — 1 evaluación por statement); UPDATE siempre USING+WITH CHECK; cero DELETE; grants de tabla solo los verbos con policy (p.ej. `operacion_eventos` y `freetime_origin` solo `SELECT`).

**Anti-recursión:** `movimientos_planta` nunca subconsulta `operaciones`; la cadena es eventos/incidencias/fotos → operaciones → movimientos (una dirección). Verificado sin 42P17 (§4.3).

## 3. SECURITY DEFINER — lista cerrada (14, ninguna adición)

Todas con `SET search_path = ''` + guard en primera línea (las de trigger de auth no tienen caller de app; su gate es el evento de auth):

1. `perfil()` — STABLE, identidad para policies
2. `aprobar_usuario` · 3. `rechazar_usuario` · 4. `set_estado_usuario` — guard admin activo
5. `get_pendientes` — guard activo + scope planta interno
6. `crm_nueva_version_freetime` — guard admin (freetime sin escritura directa)
7. `crm_validar_reforzado` — guard supervisor+ (contenedores sin UPDATE directo)
8. `handle_new_user` · 9. `bootstrap_admin` — triggers sobre auth.users que escriben `crm.usuarios`/`configuracion` (bootstrap_admin es el trigger de la Decisión 8 — misma categoría sancionada "funciones de trigger que escriben en otra tabla")
10. `evt_operacion_insert` · 11. `evt_operacion_update` · 12. `evt_movimiento` · 13. `sync_planta_actual` · 14. `evt_incidencia` — triggers de timeline/planta (escriben tablas sin policies de escritura)

INVOKER (10): `set_updated_at`, `hoy_ar`, `dias_estadia`, `guard_operaciones_campos` (no escribe otra tabla), y las 6 RPCs operativas.

## 4. Advisors — resultado final

**Corridos después de CADA migración (security + performance).** Estado final (2026-07-08, post-limpieza):

**Findings MÍOS: 0 abiertos.** El único finding propio detectado fue el ACL de funciones (EXECUTE a PUBLIC) — encontrado por la mini-auditoría, no por el advisor — y corregido en la migración 010 (evidencia §5.3).

**Preexistentes (detention/public/v1 — NO tocados, no son de M1):**
- SECURITY · `rls_enabled_no_policy` INFO: `public.inbound_log`, `public.transform_304_config`
- SECURITY · `public_bucket_allows_listing` WARN: bucket `incidencias` (v1, policy `incidencias_demo_all`)
- PERFORMANCE · `unindexed_foreign_keys` INFO: 9 FKs en `detention.*` · `unused_index` INFO: 4 índices `detention.operaciones`, 3 en `public.*`

**INFO esperado sobre crm (no accionable):** `unused_index` sobre los índices recién creados de `crm` — cero tráfico a t=0; sirven a RLS/FK/lookup de vigencia/búsqueda trgm. Re-evaluar recién con uso real (M3+).

**Transitorio observado:** `auth_leaked_password_protection` WARN apareció mientras `auth.users` tuvo filas (usuarios sintéticos) y desapareció al limpiarlos. **Acción para John antes de M2** (dashboard, no SQL): Auth → habilitar leaked password protection (HaveIBeenPwned).

**Nota para cuando John exponga `crm` en la Data API:** puede aparecer `security_definer_view` sobre `usuarios_publicos` — es la excepción intencional y documentada de la Decisión 6 (owner-based + security_barrier, superficie `id,nombre`, gate activo).

## 5. Evidencia de verificación §2.3

### 5.1 `vista_alertas` — oráculo por caso: **8/8 PASS**

Datos sintéticos (contenedores `TST*`, navieras `TEST *`; MAERSK seed real 14 días/35 USD; umbral=3). Resultado crudo:

| Caso | Contenedor | dias | libres | rest | costo | semáforo | Oráculo | |
|---|---|---|---|---|---|---|---|---|
| Día de retiro = día 1 | TSTA0000001 | 1 | 14 | 13 | 0.00 | verde | dias=1 (inclusivo) | PASS |
| Vencimiento exacto | TSTB0000002 | 14 | 14 | 0 | 0.00 | amarillo | rest=0 ⇒ amarillo, costo 0 | PASS |
| En demora | TSTC0000003 | 21 | 14 | −7 | 245.00 | rojo | 7×35=245 | PASS |
| Sin freetime ⇒ neutro | TSTD0000004 | 6 | NULL | NULL | NULL | **neutro** | Decisión 7 | PASS |
| Versión por vigencia (op vieja) | TSTE0000005 | 388 | **5** | −383 | 3830.00 | rojo | tomó la versión 2025 (5d/10USD), no la 2026 | PASS |
| Versión por vigencia (op nueva) | TSTF0000006 | 1 | **10** | 9 | 0.00 | verde | tomó la versión 2026 (10d/20USD) | PASS |
| `sin_cargo` ⇒ costo 0 | TSTG0000007 | 21 | 14 | −7 | **0** | rojo | costo 0, semáforo intacto (paridad v1) | PASS |
| `cobra_detention_origen=false` | TSTH0000008 | 11 | 5 | −6 | NULL | **neutro** | paridad v1 | PASS |

Régimen correcto: la naviera TEST VERSIONADA tenía además una fila `regimen='cargados'` con 99 días — el lookup la ignoró en ambos casos E (dias_libres 5 y 10, nunca 99). ✔

### 5.2 Mini-auditoría RLS + RPC (simulación de roles vía `set local role` + `request.jwt.claims`)

**anon (20/20 PASS tras el fix 010):** SELECT sobre las 12 tablas + 2 views ⇒ `permission denied (42501)`; INSERT ⇒ 42501; EXEC de las 12 RPCs + helpers ⇒ 42501 (evidencia post-010: "proacl con PUBLIC execute restantes en crm: ninguna"). `storage.objects`: el SELECT es permitido por los grants estándar de Supabase Storage (infra compartida con v1, fuera del mandato) pero la RLS sin policy anon devuelve **0 filas**.

**pendiente_aprobacion (29/29 PASS):** las 14 relaciones ⇒ **0 filas** (incluida su propia fila de usuarios — §14.3: la pantalla de espera se resuelve por ausencia de datos); las 12 RPCs ⇒ error de guard (`cuenta no activa` / `solo un administrador…`); INSERT directo en incidencias y en `storage.objects` ⇒ violación de policy; listar bucket ⇒ 0 filas.

**operador BAHIA (11/11 PASS):** ve 8/8 operaciones BAHIA y **0 ABBOTT**; movimientos scoped (0 — el único era ABBOTT); `SELECT` y `JOIN operaciones+movimientos` **sin recursión 42P17**; vista_alertas scoped (8); `usuarios` = 1 fila propia y `usuarios_publicos` = 3 nombres (Decisión 6 operativa); INSERT movimiento con origen ABBOTT ⇒ rechazado; primer tramo hacia ABBOTT ⇒ rechazado; incidencia sobre op ABBOTT ⇒ rechazada; incidencia sobre op BAHIA ⇒ permitida + evento por trigger (control positivo); UPDATE de `sin_cargo` ⇒ rechazado por guard; `crm_anular_operacion` ⇒ rechazado ("anular requiere supervisor o administrador").

### 5.3 Hallazgo y fix de la auditoría (migración 010)

La corrida anon inicial mostró que las RPCs eran **ejecutables** por anon (respondían el error del guard interno, nunca datos): el `ALTER DEFAULT PRIVILEGES … IN SCHEMA crm REVOKE EXECUTE … FROM PUBLIC` de 001 **no tiene efecto** — los default privileges por-schema son aditivos y no pueden quitar el EXECUTE built-in a PUBLIC (verificado: `pg_default_acl` sin entrada para `crm`; `proacl` con `=X/postgres`). Defensa en profundidad funcionó (guards §14.8), pero la superficie ACL violaba el mínimo privilegio del plan §0. **Fix:** 010 `REVOKE … ON ALL FUNCTIONS IN SCHEMA crm FROM public, anon`. Re-verificación: 6/6 probes anon ⇒ 42501 y **cero** funciones crm con EXECUTE de PUBLIC. **Regla para M3+:** toda función nueva en crm cierra con su `REVOKE … FROM public` + grant explícito.

### 5.4 Flujo operativo como operador real (13/13 PASS + INFO)

- **Tanda sin toggle** (2 contenedores, uno en minúsculas): `{"creadas": 2}`; `tstk0000011`→`TSTK0000011`; ops `en_transito_a_planta` con `planta_actual NULL`; 1 movimiento `en_transito` (origen NULL→BAHIA) por op; evento `retiro` por trigger **con `usuario_id` del operador**; flag reforzado por ítem respetado; **el operador VE sus 2 operaciones nuevas** (vía movimiento en tránsito a su planta).
- **Tanda con toggle** (tránsito corto §6.1): op nace `en_planta`, movimiento nace `confirmado` (confirmado_por = operador), `planta_actual=BAHIA` fijada por el trigger, eventos `retiro` + `ingreso_planta`.
- **Tanda cross-planta a ABBOTT:** rechazada (policy de movimientos) **con rollback atómico** — ni el contenedor quedó creado.
- **Guard ciclo abierto:** re-cargar `TSTK0000011` ⇒ "Contenedores con ciclo abierto: TSTK0000011".
- **F2 ingreso:** `{"confirmadas": 2}` + planta_actual + 2 eventos `ingreso_planta`.
- **Egreso F1 (embarcado con asignación):** `en_transito_a_terminal` + eventos `carga` y `egreso`.
- **Egreso F2 (devolución):** `{"cerradas": 1}` + estado `cerrado` + evento `devolucion` (corta freetime).
- **Anular como supervisor:** anulada + `anulada_por` = supervisor + evento `anulacion` (y denegado para operador — 5.2).
- **`get_pendientes` (operador):** `{"alertas":{"rojo":3,"amarillo":1},"pendientes_ingreso":0,"pendientes_devolucion":0}` — coherente exacto con el estado sintético.

Nota de contrato: el RPC de tanda recibe números **ya normalizados por el parser del front (§6.3.2, M3)** — hace `upper()` y el CHECK ISO de la tabla es la red determinística (probado: `'tstk 000001-1'` con espacios/guión rebota en el CHECK; `'tstk0000011'` normaliza bien).

### 5.5 Bootstrap admin (5/5 PASS)

Usuario sintético con email bootstrap temporal (`bootstrap.temp@test.local`): fila espejo pendiente al crear; **promoción a administrador activo** al simular `email_confirmed_at`; **clave consumida** (`valor=null`); **doble disparo** (re-update confirmado y transición null→confirmado repetida) sin duplicados ni re-promoción (1 fila, 1 solo admin activo); **segundo admin** (clave re-seedeada a otro email) **NO promovido** — guard primer-admin-único. Limpieza: usuarios sintéticos borrados y `admin_bootstrap_email` **restaurado a `"jzenteno@ssbint.com"`**.

### 5.6 Limpieza de datos sintéticos

Estado final verificado = estado de seeds exacto: plantas 2 · navieras 14 · freetime 14 · ayuda 6 · config 4 claves (bootstrap = jzenteno@ssbint.com) · contenedores/operaciones/movimientos/eventos/incidencias/fotos/usuarios/objetos storage = **0** · `auth.users` = **0**. Nada sintético quedó en la DB.

## 6. Reporte de matcheo de vigencias v1 (seeds 008)

Fuente de VALORES: Excel `free time origin.xlsx` (14 filas parseadas). Fuente de VIGENCIAS: `detention.freetime_origin` read-only (`regimen='vacios'`).

| Naviera v2 | Match v1 | vigente_desde | Nota |
|---|---|---|---|
| CEVA LOGISTICS, DHL, DSV, EVERGREEN | exacto | 2025-05-01 | |
| DP World, Expeditors | case-insensitive (`DP WORLD`, `EXPEDITORS`) | 2025-05-01 | |
| CMA CGM | alias plan `CMA/MERCOSUL LINE` | 2025-05-01 | |
| MAERSK | alias plan | 2025-05-01 | |
| HAPAG LLOYD | alias plan `HAPAG` | 2025-05-01 | ⚠ **Discrepancia de valores:** v1 = 14 días; Excel = **21** (seed usa Excel — fuente canónica de valores). Confirmar con John en cutover |
| LOG-IN LOGISTICA INTERMODAL S.A. | **alias extendido** `LOG-IN` | 2025-05-01 | valores idénticos en v1 ⇒ identificación inequívoca |
| MEDITERRANEAN SHIPPING COMPANY (MSC) | **alias extendido** `MSC` | 2025-05-01 | ídem |
| OCEAN NETWORK EXPRESS (ONE) | **alias extendido** `ONE` | 2025-05-01 | ídem |
| SCAN GLOBAL LOGISTICS | **alias extendido** `SCAN GLOBAL` | 2025-05-01 | ídem |
| ZIM LINES | alias plan `ZIM` | **2026-07-01** | v1 tiene 3 versiones; la que matchea los valores del Excel (21\|sí\|Combined\|25) rigió 2026-07-01→03. ⚠ **v1 tiene una versión posterior ABIERTA (0 días\|Detention\|84 USD desde 2026-07-04) que el Excel no refleja** — decidir en cutover. Consecuencia operativa v2: retiros ZIM anteriores a 2026-07-01 caen en semáforo `neutro` (honesto, no inventa tarifa) |

**Fallback `2025-08-01`: no fue necesario para ninguna naviera.** `cobra_detention_origen=true` en las 14 (paridad v1 verificada). El mapa de alias (4 del plan + 6 extendidos/case) quedó como artefacto en `crm.configuracion.alias_navieras_historico`.

## 7. Desvíos y decisiones tomadas (con justificación)

1. **`perfil()` en 001 (el plan la mapeaba a 003):** las policies de 002 la referencian y `CREATE POLICY` exige que la función exista; al ser plpgsql, la referencia a `crm.usuarios` resuelve en runtime (003 corre antes de todo uso). Sin efecto funcional.
2. **Migración extra 010 (fix ACL):** hallazgo propio de la auditoría — ver §5.3. Deja regla explícita para M3+.
3. **Alias extendidos en el matcheo de vigencias (§6):** la instrucción daba 4 alias + fallback ruidoso `2025-08-01`; LOG-IN/MSC/ONE/SCAN GLOBAL tienen en v1 valores de tarifa **idénticos** al Excel ⇒ identificación inequívoca. Seedear el fallback habría grabado vigencias falsas en el money-path. Decisión ruidosa, no silenciosa: documentada acá y en el SQL de 008.
4. **Columna `usuarios.rechazo_motivo`:** §12.3 exige rechazo CON motivo y el spec §4 no le da columna; `rechazar_usuario(usuario_id, motivo)` lo necesita persistente.
5. **CHECK ISO en `contenedores.numero_contenedor`** (`^[A-Z]{4}[0-9]{7}$`): verificado contra v1 (0/2944 filas lo violan) ⇒ no bloquea el cutover; red determinística bajo el parser del front.
6. **CHECKs extra en `movimientos_planta`** (origen≠destino, llegada≥salida): integridad barata, mismo espíritu D-05; `crm_mover_entre_plantas` valida antes con mensaje claro.
7. **`crm_nueva_version_freetime` en 002 y `crm_validar_reforzado` en 004** (el plan no les fijaba migración): cohesión con su tabla. Lista DEFINER intacta.
8. **Evento de cambio de `sin_cargo` como `tipo_evento='correccion'`** con detalle `{campo, anterior, nuevo}` — el plan pide "evento de timeline al cambiar sin_cargo" sin fijar tipo; `correccion` ya existe en el CHECK (paridad v1 F-03) y es semánticamente exacto.
9. **`usuarios_publicos` con `security_barrier`** además del owner-based aprobado: evita que un predicado hostil se evalúe antes del gate de activo. Superficie sin cambio.
10. **Mapa de alias como clave de `configuracion`** (no tabla nueva): el plan pedía "artefacto" sin fijar forma; una clave jsonb es consultable por M3/cutover sin objeto extra.
11. **`operacion_eventos` con `updated_at` + trigger** pese a ser append-only: convención §4 "sin excepción" (v1 no lo tenía).
12. **Seed `plantas.codigo` = BAH/ABB** (paridad v1 leída read-only).

## 8. Pendientes que NO gatean CP1 (heredados/futuros)

- **Paso manual de John (pre-M2):** exponer `crm` en Data API (Dashboard → Settings → Data API → Exposed schemas) + habilitar **leaked password protection** en Auth (WARN del advisor cuando haya usuarios reales).
- **Realtime (§6.3.9, M3/M6):** las tablas de `crm` no están en la publicación `supabase_realtime` — se agrega en el módulo que lo consuma (migración propia).
- **`service_role` sin grants en `crm`** (mínimo privilegio): el digest F2 de n8n necesitará su GRANT puntual de SELECT sobre `vista_alertas` cuando exista.
- **`crm_reabrir_operacion` / `crm_corregir_operacion`:** los valores de evento ya están en el CHECK; RPCs al cutover/F2 (plan §4).
- **Discrepancias HAPAG (14 vs 21 días) y ZIM (versión 0/84 post-Excel en v1)** — decisión de John en cutover (§6).

---

## Addendum — Decisiones de CP1 (John, 2026-07-08)

1. **CP1 APROBADO** — merge de `v2/m1-schema` a `v2-rebuild` (`1220709`); loop continúa a M2.
2. **HAPAG LLOYD = 14 días** ("son 14 días"): la v1 tenía el valor correcto, el Excel queda desmentido en ese punto. Aplicado en migración `011_fix_hapag_dias` (UPDATE de seed pre-go-live, excepción documentada al versionado) y verificado en vivo. ZIM queda como Excel (21d/$25); la versión 0d/$84 de la disputa NO entra salvo confirmación de negocio.
3. **Campana (finding menor 2 del review): corregir en M6** — `get_pendientes()` debe incluir para el operador las operaciones en tránsito hacia su planta en la categoría `alertas` (consistencia con la solapa).
4. **Toggles de dashboard (John) diferidos a CP2:** exponer `crm` en Data API + Leaked Password Protection. El verify E2E de M2 reportará qué queda gateado hasta entonces.
5. Wording del criterio 13 del reviewer precisado (grants de tabla/función a anon; USAGE sancionado) — commit `c806520`.
