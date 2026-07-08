# Plan M0 + M1 — Rebuild v2 CRM Detention

**Fecha:** 2026-07-08 · **Spec:** `spec.md` v2.1 (raíz) · **Estado:** ✅ APROBADO por John (2026-07-08) — decisiones: (1) crear Supabase OK · (2) fórmula v1: retiro = día 1 inclusivo · (3) schema `public` · (4) paridad v1 paquete completo (A) · (5) `/design` sí · (6) `usuarios_publicos` owner-based (excepción §14.8 documentada) · (7) semáforo `neutro` · (8) bootstrap por trigger post-confirmación.
**Bloqueo infra (2026-07-08):** límite de 2 proyectos free alcanzado en la org (ambos producción) — la creación de `crm-detention-v2` espera decisión de John (Pro US$25/mes u org alternativa). Gatea M1, no M0.
**Reglas de convivencia:** §21 — v1 (`cctuowthpnstvdgjuomq`, crm-detention.vercel.app) intocable; todo v2 en branch `v2-rebuild`, Supabase nuevo, Vercel nuevo.
**Rev. 2:** versión corregida tras verificación adversarial (3 lentes, 26 findings — 2 bloqueantes, 13 mayores incorporados; detalle en el historial git de este archivo).

---

## 0. Infraestructura previa a M1 — ACTUALIZADO por addendum §21 (2026-07-08)

La org llegó al límite de 2 proyectos free (ambos producción). John corrigió la premisa de §21 (la v1 no está en uso operativo, data descartable) y decidió: **v2 vive en el schema NUEVO `crm` del proyecto existente `cctuowthpnstvdgjuomq`** — US$ 0, sin proyecto dedicado. Verificado read-only (2026-07-08): `auth.users` = 0 filas (v2 se apropia de Auth sin conflicto), bucket `incidencias` ya existe (v1) → v2 usa **`crm-incidencias`**, schema `crm` libre.

| Item | Valor |
|---|---|
| DB v2 | Schema `crm` en `cctuowthpnstvdgjuomq`. Escritura SOLO ahí (+ bucket `crm-incidencias` + triggers de auth.users). `detention` y `public` intocables. |
| Decisión 3 (schema `public`) | **Revertida** → schema `crm` con `db: { schema: 'crm' }` (patrón v1 probado en este mismo proyecto). |
| Grants | Desde cero, mínimo privilegio: `anon` sin grants (todo requiere sesión); `authenticated` SELECT/INSERT/UPDATE + EXECUTE según matriz; DELETE/TRUNCATE jamás. `GRANT USAGE ON SCHEMA crm` en la migración 001. |
| Paso manual de John | Exponer `crm` en la Data API (Dashboard → Project Settings → Data API → Exposed schemas). Precondición del front (M2+), NO de las migraciones — puede hacerse en cualquier momento antes de CP2. |
| Credenciales | `crm-v2/.env.local` (gitignored) + `.env.example` committeado. Usar la publishable key nueva del proyecto, no la legacy committeada en v1. |
| Proyecto Vercel | Nuevo, lo crea John al primer deploy manual (`npx vercel deploy --prod --yes` desde `crm-v2/`). |

---

## 1. M0 — Scaffold + shell Flight Deck

**Objetivo:** `crm-v2/` compilando con el design system Flight Deck COMPLETO y el shell de la app. Todo módulo posterior consume esto; **nada define estilos ad-hoc después de M0** — por eso el inventario 1.3 cubre explícitamente lo que M2–M10 van a consumir.

**Branch:** `v2/m0-scaffold` (desde `v2-rebuild`). Commits atómicos por paso.

### 1.1 Scaffold
- `create-next-app`: Next.js 16.x (misma major que v1, probada), TypeScript, Tailwind v4, App Router, `src/`, ESLint.
- Fuentes self-hosted con `next/font`: **Archivo** (variable, eje wdth 62–125 para el font-stretch 115–120% del display) + **JetBrains Mono** → CSS vars `--font-archivo` / `--font-jetbrains` (patrón v1 probado).
- `lib/` portada de v1 (código propio, testeado en prod): `iso6346.ts`, `format.ts`. Cliente Supabase nuevo (env-only, sin fallback hardcodeado).

### 1.2 Tokens
- Portar el bloque `@theme` de `crm-detention/src/app/globals.css` (traducción ya probada de `tailwind.tokens.ts`): superficies, texto, accent, semáforo, sombras/glow, radios, easing, tipografía.
- **Sin** el bloque de "variables legacy" de v1 (existía para re-skinear pantallas viejas; v2 nace Flight Deck puro).
- Keyframes/utilidades de motion del handoff: count-up 1300ms, stagger 40ms/fila (máx 10), shimmer 1400ms, pulse-dot 2s, ease-out-expo.

### 1.3 Componentes base (design system completo)

**Portados de v1** (probados en prod): `ContainerNumber` (string completo de la DB, separa internamente, select-all), `KpiCard`, `RadialTimer`, `StatusBadge`, `SkeletonRow`, `useCountUp`, `CommandPalette` (shell sin datasource; se conecta en M5/M6).

**Nuevos** (cada uno con TODOS sus estados en `/design`):

| Componente | Spec | Consumidores |
|---|---|---|
| `Button` | primario cyan (texto ink oscuro), ghost, danger; hover/disabled/**loading (spinner interno + disabled = doble-submit imposible)** | todos |
| `Input`, `Select`, `DateField`, `Textarea`, `Checkbox`, `Toggle` | Flight Deck (surface-2, border strong→cyan focus, radius 9); slot de error inline + label micro | todos |
| `DataTable` | header sticky, columnas tipadas, sort (indicador cyan), números right `tabular-nums`, hover surface-2, dot semáforo, border-left rojo crítico, paginación, **selección múltiple (columna checkbox + select-all + contador de seleccionados, estado controlado)**, **slot de estado de validación por fila (badge + error/warning inline)**. Móvil: **scroll-x contenido en su propio contenedor** (nunca scroll horizontal de página) | M3 F1/F2, M4 F1/F2, M5, M6, M8 |
| `Badge`/`Chip` tonal + chip de filtro removible | texto pleno, bg 8–10%, border 30–35% | M3+, M5 |
| `Modal` / `ConfirmDialog` | radius 14, shadow palette, backdrop blur, focus trap, ESC, scale .98→1 200ms | M3+, M13 popup |
| `Toast` system | provider + `useToast`; éxito/error/info; auto-dismiss; apilable | todas las mutaciones |
| `EmptyState` | ícono + título + **cuerpo instructivo §15.3** + acción opcional | todos los listados |
| `ErrorState` | mensaje + **botón retry cyan**, misma familia visual que EmptyState — el estado de error de página/panel (Toast solo cubre errores transitorios de mutación) | todos |
| `PageHeader` | título display-lg + contadores + **una** acción primaria. El patrón de página lleva el **contrato de 4 estados** (carga/vacío/error/poblado) — el reviewer lo gatea por pantalla | todos |
| `Timeline` / `TimelineEvent` | anatomía artboard 2c: fecha mono col 96px, dot 12px + conector 2px, 4 estados (completado / hito fin free time / en curso glow+pulso / futuro), chips HITO / EN CURSO. En v1 está inline en la ficha — acá nace componente | M5 ficha |
| `ProgressBar` / `FreetimeMeter` | variantes verde/ámbar/rojo, namespace propio (lección v1: colisión con `.ok` global dejó un fill invisible en prod) | M6 alertas, M7 flota |
| `BarChart` + `TrendLine` | SVG propio con tokens Flight Deck (sin librería: barras y línea simples; evita estética ajena y decisión ad-hoc en M7) | M7 §9 |
| `Dropdown`/`Popover` + `Tooltip` | posicionamiento, cierre ESC/click-fuera; tooltip del rail | M0 menú usuario, M5 filtros, M6 campana |
| `PhotoUpload` | picker múltiple + previews + estados de subida (UI pura en M0; storage en M9) | M9 |
| `Markdown` | renderer sanitizado con estilos Flight Deck | M10 ayuda, M8 editor (preview) |
| `Kbd`, `Tabs`, `HelpPanel` | panel lateral del "?" — shell; contenido M10 | shell, M10 |

### 1.4 Shell de la app
- Rail izquierdo fijo 60px (`bg-rail`, íconos Tabler outline 1.4px, tooltip, ítem activo cyan). **Móvil: bottom-nav**; header móvil colapsa a título + campana + menú (búsqueda y "?" van dentro del menú).
- Header 58px: título contextual, búsqueda global (placeholder; wiring M5), campana con badge (placeholder; wiring M6), "?" contextual (placeholder; contenido M10), reloj mono, menú de usuario (Dropdown del sistema).
- Área de contenido con patrón de página + contrato de 4 estados. View transitions 250ms.

### 1.5 Login estático + espera de aprobación estática (calidad de portada)
- `/login`: logos SSB/Dow (assets de `crm-detention/public/logos/`), form email+password con validación visual, links "olvidé mi contraseña" y "crear cuenta" (sin lógica — M2), Flight Deck completo.
- `/espera-aprobacion` estática (§12.2) — se wirea en M2. Ambas se revisan con screenshots.

### 1.6 Ruta `/design` (dev-only — Decisión 5)
Grilla con TODOS los componentes en TODOS sus estados (equivalente al artboard 2f). Herramienta del review de M0, de la consistencia inter-módulos y de la pasada visual final pre-CP3. No linkeada; excluida de producción por env.

### 1.7 VERIFY M0
Build limpio + `tsc --noEmit` + lint. Screenshots (desktop + móvil): login, espera, shell, `/design` (incluye el DataTable con scroll-x móvil). Review del `reviewer` contra el estándar de interfaz. Sin checkpoint humano (§17); screenshots se adjuntan en CP1.

---

## 2. M1 — Schema completo + RLS + triggers + seeds

**Objetivo:** todo §4 + §14 en migraciones sobre el proyecto Supabase v2 (incluido **Storage §14.9** — entra en M1 para que CP1 lo revise, no en M9). Cierra con **CP1**.

**Branch:** `v2/m1-schema`. Cada migración = archivo en `crm-v2/supabase/migrations/` + `apply_migration` vía MCP. **Regla §14.1: cada tabla nace con RLS ON + policies en su misma migración.**

**Regla de privilegios (corrige el borrador — verificado contra semántica real de Postgres):** las funciones de **trigger** corren con los privilegios del rol que disparó la sentencia, NO del owner de la tabla. Por lo tanto **toda función de trigger que escribe en otra tabla es SECURITY DEFINER** con `SET search_path` fijo (owner `postgres` bypasea RLS sin FORCE): `handle_new_user`, todos los triggers de timeline, y el trigger de `planta_actual`. `operacion_eventos` queda con RLS ON y **cero policies de INSERT/UPDATE/DELETE**: la app no puede falsificar timeline; solo los triggers DEFINER escriben.

**SECURITY DEFINER — lista cerrada** (todo lo demás es INVOKER; el reviewer rebota adiciones):
`perfil()`, `aprobar_usuario`, `rechazar_usuario`, `set_estado_usuario` (suspensión §12.5), `get_pendientes()` — las del spec §4;
`crm_nueva_version_freetime` y `crm_validar_reforzado` — **necesario, no opcional**: con INVOKER exigirían policies directas de INSERT/UPDATE que permitirían saltarse el versionado de tarifas (dos vigencias solapadas → tarifa ambigua en el money-path) y mutar el maestro. Como DEFINER con check de rol interno, `freetime_origin` y `contenedores` quedan SIN policies directas de escritura para roles de app (la tanda crea contenedores vía su propia RPC INVOKER + policy INSERT);
las funciones de trigger de arriba.
**Toda DEFINER: primera línea = guard `perfil().estado = 'activo'`** (+ check de rol que corresponda). Una RPC DEFINER bypasea RLS: el §14.3 se cumple adentro o no se cumple.

### 2.1 Migraciones

| # | Nombre | Contenido |
|---|---|---|
| 001 | `extensions_base` | `CREATE SCHEMA crm` + `GRANT USAGE` a anon/authenticated (sin grants de tabla para anon — mínimo privilegio); `pg_trgm`; `set_updated_at()`; helpers de fecha AR: `hoy_ar()` y `dias_estadia(desde, hasta)` — **UNA definición del cómputo de días** (Decisión 2: inclusivo, retiro = día 1) consumida por views/RPCs |
| 002 | `maestros_config` | `plantas` (+ seed BAHIA/ABBOTT — el CHECK las fija), `navieras`, `freetime_origin` (versionado; `ux_freetime_vigente` — clave según Decisión 4), `configuracion` (+ **seed acá**: `umbral_alerta_amarillo=3`, `dominios_sugeridos=["ssbint.com"]`, `admin_bootstrap_email="jzenteno@ssbint.com"` — el trigger de 003 la lee), `ayuda_contenido`. Todos + updated_at + RLS: SELECT activos; `configuracion`/`ayuda_contenido`/`navieras` escritura admin; **`freetime_origin` sin policies de escritura** (solo RPC DEFINER); `plantas` sin escritura de app |
| 003 | `identidad` | `usuarios` (§4: `auth_user_id` FK auth.users UNIQUE, rol nullable, `estado_cuenta`, FK plantas ya existente, CHECK operador⇒planta) + RLS (propia fila; todas solo admin; **cero UPDATE self**) + `perfil()` DEFINER STABLE + `handle_new_user` (AFTER INSERT auth.users, DEFINER): inserta `pendiente_aprobacion`, **idempotente** (`ON CONFLICT (auth_user_id) DO NOTHING`), tolerante a config ausente (default pendiente) + **bootstrap admin en trigger separado AFTER UPDATE OF email_confirmed_at**: promueve a `activo`/`administrador` SOLO con email confirmado ∧ email = `admin_bootstrap_email` ∧ **no existe otro admin activo** (cierra el vector de pre-registro: un atacante que registre ese email nunca lo confirma — el inbox es de John; y aunque John confirmara por error, el guard de primer-admin-único + la clave consumida post-uso acotan el daño) — Decisión 8 + RPCs `aprobar_usuario` (valida operador⇒planta), `rechazar_usuario`, `set_estado_usuario` — DEFINER, check admin, `SET search_path` |
| 004 | `operacion` | `contenedores` (sin policies de escritura directa salvo INSERT vía tanda — ver 006; reforzado solo RPC), `operaciones` (+ CHECKs de coherencia v1: `ck_devolucion_post_retiro`, `ck_cerrado_tiene_devolucion`, `ck_egreso_post_retiro`), `movimientos_planta`, `operacion_eventos` (**cero policies de escritura**), `incidencias`, `incidencia_fotos` + `ux_operacion_abierta` + índices (trgm numero/bookings/orden; btree FKs/estado/fecha) + RLS matriz 2.2 — **sin recursión**: las policies de `movimientos_planta` se expresan DIRECTO por plantas (origen/destino vs `perfil()`), nunca subconsultando `operaciones`; las de `operaciones` sí subconsultan `movimientos_planta` (una sola dirección → no hay ciclo 42P17) |
| 005 | `triggers_eventos` | Timeline por triggers DEFINER, **AFTER INSERT OR UPDATE con el guard v1** (`new.estado='confirmado' AND (tg_op='INSERT' OR old.estado IS DISTINCT FROM 'confirmado')`) para cubrir el **tránsito corto** (§6.1: el movimiento nace confirmado): `retiro` (INSERT operaciones), `ingreso_planta` (movimiento confirmado con origen NULL), `movimiento` (INSERT de tramo con origen NOT NULL — registra la SALIDA con su fecha, como v1), `carga`+`egreso` (UPDATE fecha_egreso_planta; carga solo embarcado), `devolucion` (UPDATE fecha_devolucion + cierre), `anulacion` (estado→anulada), `incidencia` (INSERT incidencias). CHECK `tipo_evento` incluye **`reapertura` y `correccion`** (existen en el timeline vivo de v1; sin RPCs en v2 hasta el cutover — costo cero, evita violar el constraint al importar). `usuario_id` vía `perfil()`; NULL si sistema + trigger `planta_actual` (mismo guard v1) |
| 006 | `rpcs_operativas` | `crm_crear_tanda_retiro`, `crm_confirmar_ingreso_planta`, `crm_registrar_salida_planta`, `crm_confirmar_devolucion`, `crm_mover_entre_plantas`, `crm_anular_operacion` — adaptadas de v1, **SECURITY INVOKER** (RLS aplica adentro), sin inserts manuales de eventos, sin estado `cargado` (§18.1). **Sin RETURNING sobre filas recién insertadas**: los uuid se generan en la función ANTES del INSERT (la fila nueva con `planta_actual_id` NULL no matchea el SELECT del operador → RETURNING fallaría con 42501). *Justificación de tenerlas en M1 y no en M3–M5: toda la superficie de lógica DB queda bajo el único checkpoint de schema (CP1); su E2E llega con cada módulo.* |
| 007 | `views_notificaciones` | `vista_alertas` (§10 + Decisión 2 + semáforo `neutro` — Decisión 7; umbral desde configuracion; lookup de vigencia con filtro según Decisión 4) — `security_invoker=true` + `usuarios_publicos(id, nombre)` según **Decisión 6** + `get_pendientes()` DEFINER (§13): **primera línea guard activo**, scope planta para operador |
| 008 | `seeds` | navieras: 14 suppliers del xlsx (canónicos) + **mapa de alias del histórico como artefacto** (`CMA/MERCOSUL LINE→CMA CGM`, `HAPAG→HAPAG LLOYD`, `ZIM→ZIM LINES`, `MAERSK→MAERSK`); freetime_origin: 14 filas — vigencias leídas de v1 **read-only** matcheando por alias, y si una naviera de v1 no matchea → **fallback RUIDOSO** (se reporta en el entregable CP1, no silencioso a `2025-08-01`); ayuda_contenido: FAQ global inicial (§15.2; contenido por solapa lo siembra cada módulo §15.5) |
| 009 | `storage_incidencias` | Bucket **`crm-incidencias`** privado (el bucket `incidencias` es de v1 — intocable) + policies de `storage.objects` scoped al bucket: INSERT/SELECT solo `perfil()` activo, path scoped por incidencia (§14.9). Entra en M1 para que CP1 revise TODA la superficie de seguridad |

Después de cada migración: `get_advisors` (security + performance) y corrección inmediata.

### 2.2 Matriz RLS (resumen para CP1 — el detalle va en las migraciones)

| Tabla | SELECT | INSERT | UPDATE |
|---|---|---|---|
| plantas, configuracion, ayuda, navieras | activo | admin (plantas: nadie) | admin (plantas: nadie) |
| freetime_origin | activo | — (solo RPC DEFINER admin) | — (el versionado cierra filas solo vía RPC) |
| contenedores | activo | operador+ **WITH CHECK naviera/tipo válidos** (vía tanda INVOKER) | — (reforzado solo RPC DEFINER supervisor+) |
| operaciones | activo ∧ (operador ⇒ planta_actual = su planta ∨ ∃ movimiento en_transito con destino su planta) | operador+ (WITH CHECK estado inicial válido) | operador+ transiciones §7 **WITH CHECK + USING**; anular: supervisor+ |
| movimientos_planta | activo ∧ (operador ⇒ **origen = su planta ∨ destino = su planta** — directo por plantas, sin subquery a operaciones) | operador+ **WITH CHECK: (origen = su planta) ∨ (origen NULL ∧ destino = su planta)** — cierra la escritura ciega contra operaciones ajenas | operador+ (confirmación: destino = su planta) |
| operacion_eventos | según operación visible | **nadie** (solo triggers DEFINER) | nadie |
| incidencias / fotos | según operación visible | operador+ **WITH CHECK operación visible** (su planta si operador) | supervisor+ |
| usuarios | propia fila; todas solo admin | solo trigger auth (DEFINER) | solo RPCs admin — nunca self de rol/estado/planta |

Transversales: TODA policy exige `estado_cuenta='activo'` vía `perfil()`; `auth.uid()` como `(select auth.uid())`; UPDATE siempre USING + WITH CHECK; sin DELETE.

**Si John acepta la Decisión 4 (columna `sin_cargo`):** trigger BEFORE UPDATE que rechaza cambios de `sin_cargo`/`producto`/`gmid` si `perfil().rol='operador'`, + evento de timeline al cambiar `sin_cargo` (es plata: excluye la operación del costo — no puede ser mutación invisible de cualquier operador).

### 2.3 Verificación M1 (previa a CP1)
1. `get_advisors` security limpio (o findings justificados).
2. Test SQL de `vista_alertas` con datos sintéticos y **oráculo escrito por caso**: día de retiro, vencimiento exacto, en demora, **naviera sin freetime → `neutro`** (Decisión 7), versión de tarifa vigente por fecha, (si Decisión 4: régimen correcto y `sin_cargo` → costo 0).
3. **Mini-auditoría RLS y RPC** (anticipo §14.10): anon sin sesión → cada tabla niega; usuario `pendiente_aprobacion` → tablas niegan **y `get_pendientes()` + cada RPC operativa devuelven nada/error**; operador BAHIA → no ve operaciones ABBOTT, **SELECT sobre operaciones Y movimientos_planta sin recursión 42P17**, e **INSERT de movimiento/incidencia contra operación de ABBOTT → rechazado**; Storage: anon/pendiente no listan ni suben al bucket.
4. **Flujo operativo como operador real** (cierra el gap que dejaba pasar el bloqueante de triggers): `crm_crear_tanda_retiro` ejecutada con un usuario operador de prueba, con y sin toggle de tránsito corto → operaciones creadas, eventos `retiro` (+`ingreso_planta` si toggle) insertados por trigger, `planta_actual_id` seteado en el caso toggle, y el operador VE sus operaciones recién creadas.
5. **Bootstrap probado en M1** (no diferido a M2): signup sintético con email bootstrap temporal + confirmación simulada (`email_confirmed_at`) → promueve a admin una sola vez; doble disparo del trigger → sin duplicados; segundo "admin" → no promueve.
6. Datos sintéticos limpiados al cierre.

### 2.4 Entregable CP1
Resumen de schema, matriz RLS final, lista cerrada de SECURITY DEFINER, output de advisors, evidencia completa de 2.3 (incluido el reporte de matcheo de vigencias v1), screenshots M0, decisiones aplicadas.

---

## 3. Decisiones que este plan somete a John (con recomendación)

1. **Costo Supabase:** US$ 0/mes verificado. ¿Confirmás la creación de `crm-detention-v2` en `sa-east-1`? *(M1 no arranca sin esto; M0 no lo necesita.)*
2. **Fórmula de días — plata en juego.** El spec dice "fecha_retiro = día 0" (§4/§10). La v1, **calibrada contra el Excel real y auditada en el money-path**, computa inclusivo: el día del retiro cuenta como día 1 (`(hoy_AR − retiro_AR) + 1`). Con "día 0", todos los costos darían un día menos que el histórico y el cutover compararía peras con manzanas. **Recomendación: fórmula v1 (+1, inclusiva)**, leyendo "día 0" como "el freetime corre desde el día del retiro".
3. **Schema `public`** en el proyecto v2 dedicado (v1 usaba `detention` por convivir con otro dataset; acá no hay con quién convivir y se evita exponer un schema custom en la API a mano). **Recomendación: `public`.**
4. **Paridad v1 — paquete completo, no columnas sueltas.** Las piezas v1 post-lanzamiento que el spec v2 omite NO son pasivas: `regimen` es clave del índice de vigencia, filtro del lookup de tarifa y parámetro de la RPC de versiones; `sin_cargo` y `cobra_detention_origen` participan del CASE de costo de las views. Opciones:
   **(A — recomendada) Paquete completo:** `regimen` (+ índice `(naviera_id, regimen)` + filtro en lookup + `p_regimen` en la RPC), `sin_cargo` (+ guard anti-operador + evento), `cobra_detention_origen`, `producto`, `gmid`, `observaciones` — mapeo 1:1 en el cutover, sin migración post-corte, y la lógica de costo de v2 reproduce la de v1 auditada.
   **(B) Solo pasivas:** `producto`, `gmid`, `observaciones` — las tres "lógicas" se agregan en el cutover (migración + retoque de views en caliente).
   **(C) Spec puro:** nada — todo al cutover.
5. **Ruta `/design` dev-only.** **Recomendación: sí** (herramienta del review visual de M0 y de la pasada final).
6. **`usuarios_publicos` — contradicción interna del spec** (§14.6 pide la view para nombres en joins; §14.8 exige security_invoker; con invoker + policy "propia fila", un operador resolvería UN solo nombre: la view nace muerta). Opciones: **(a — recomendada)** excepción documentada al §14.8: view owner-based que expone SOLO `id, nombre`, gateada a callers activos (`WHERE perfil().estado='activo'`) — superficie mínima, joins funcionan; **(b)** policy "activo lee todas las filas de usuarios" + REVOKE por columnas de email/rol/estado — mantiene invoker pero abre la tabla y complica los grants.
7. **Semáforo `neutro`** para naviera sin freetime vigente (una implementación literal del §10 la mostraría VERDE para siempre — invisible en alertas; v1 ya resolvió esto con `neutro`). **Recomendación: adoptar `neutro`** (+ warning en M8 al crear naviera sin tarifa). Alternativa: bloquear en Admin la naviera sin tarifa.
8. **Bootstrap admin vía trigger post-confirmación de email** en lugar del "seed" literal del §4 (imposible seedear `usuarios` con FK a `auth.users` sin fila de auth; el trigger promueve a admin SOLO tras confirmar el email jzenteno@ssbint.com, con guard de primer-admin-único y clave consumida tras el uso — cierra el vector de pre-registro). **Recomendación: sí.** Es desvío del texto del spec; queda registrado acá.

*Si se aprueban las decisiones, los agentes `schema-builder` y `reviewer` se actualizan con la lista cerrada de SECURITY DEFINER de §2 (hoy dicen "solo las 4 del spec").*

## 4. Riesgos anotados (no bloquean M0/M1)

- **Prefijo→naviera (§6.3.4, M3):** el warning necesita un mapeo que el spec no modela. Propuesta llegado M3: tabla `prefijos_navieras` seedeada desde el histórico usando el mapa de alias de la migración 008. Se decide en el plan de M3.
- **Dashboard M7:** KPIs de costo cerrado necesitan una view tipo `vista_costos_cerrados` (v1 la tiene; §9 no la define). Se diseña en M7 con su migración (regla §14.1 aplica). Los charts ya no son riesgo: componentes en M0 (1.3).
- **Editor markdown de Admin (M8):** usa el renderer `Markdown` de M0; la decisión de editor (textarea + preview vs librería) se toma en M8.
- **`crm_reabrir_operacion` / `crm_corregir_operacion` (v1 F-02/F-03):** los valores de evento ya entran al CHECK (005); las RPCs quedan para el cutover/F2 salvo pedido explícito.
- **`aprobar_usuario` sin email de notificación:** el aprobado se entera al loguearse (spec no pide más). Posible F2 con n8n.
