# Handoff de sesión — 2026-07-12 (sesión 13: run autónomo M3-FIX → M9 — CRM COMPLETO EN PRODUCCIÓN)

**Rama:** `v2-rebuild` (HEAD `9be67a4`, pusheado). `master` intacta (v1).
**Estado macro: el CRM v2 está COMPLETO y en producción** — https://crm-detention.vercel.app (deploy final `crm-detention-qhqv5a37x`). Las 7 solapas operativas construidas y verificadas E2E en prod. Solo falta M10 (Ayuda/FAQ — los seeds ya están escritos) y el pulido de CP3.

---

## HECHO por módulo — con el assert que lo prueba

| Módulo | Commit | Assert que lo prueba |
|---|---|---|
| **M3-FIX** sidebar | (ya estaba en 9a631c6) | E2E visual en prod: DOM del sidebar con `/ingreso` como `<a>` + click nativo renderiza la tanda; screenshots mirados por el orquestador. Consola 0×401/404/406 (56 req). |
| **M4 Egreso** | `d205108` | Bodies crudos en prod: `{creadas:3}` → `{salidas:2}` (embarcado + asignación) → `{salidas:1}` (devuelto_vacio, `p_asignacion:null`) → `{cerradas:3}` (corta freetime). Validación §14.1 bloquea client-side con CERO requests. DB verificada campo por campo. |
| **M5 Contenedores** | `64b93d9` | Mover BAHIA→ABBOTT confirmado y pendiente+confirmar-llegada (con `{confirmadas:0}` correctamente NO tratado como error), anular con motivo literal, validar reforzado — todo verificado en DB. Deep-link roto: 0 requests inválidas (fix UUID en el retry del gate). |
| **M6 Alertas** | `d485622` | Números de la UI EXACTOS contra snapshot SQL de `vista_alertas`: rojo 15/10/−5/USD 875 · amarillo 8/10/2 · verde 1/10/9. Leyenda del umbral "≤ 3 días" (fix jsonb `{dias:N}` en el retry). |
| **M7 Incidencias** | `4f59835` | Alta 201 + 2 uploads 200 a `crm-incidencias/{incidencia_id}/…` + 2 fotos 201 + evento en timeline. **Seguridad ejecutada por el orquestador**: URL pública → 400 "Bucket not found" / signed URL → 200 image/png 177 bytes. |
| **M8 Dashboard** | `79635c2` | Migración 018 (4 views KPI): anon=false por catálogo Y por REST (401 `permission denied` ×4, con body). Aritmética validada contra cálculo a mano ANTES del front (mes 1050 / ytd 6475 / abierto 875 / demora 20,0 — exactos en la UI). Rollback escrito antes de aplicar. |
| **M9 Admin** | `9be67a4` | Tripartito: gating supervisor (sin ítem Admin, 5 URLs → /inicio, 0 leakage en 354 req), enforcement REST 5/5 con bodies (42501/P0001 literales), camino positivo a nivel DB con impersonación RLS + rollback estructural (previa cerrada en `p_desde−1` verificado). |

Cada módulo cerró con: build+tsc limpios → deploy a prod → E2E en prod → data de test en cero (verificado con body) → commit atómico con el flag de `ROUTE_BUILT` incluido → push.

## DECISIONES (qué decidí yo y por qué)

1. **Charts sin Recharts** (M8): el design system trae BarChart/TrendLine SVG propios (decisión de M0 "sin librería"); la convención del repo pisa la sugerencia del superprompt. Cero dependencias nuevas.
2. **Plantas read-only** (M9): la tabla NO tiene write policy — el "CRUD de plantas" es imposible sin DDL (prohibida fuera de M8). La sección lo explica en pantalla y el gap va en HALLAZGOS. No paré el run: no necesité DDL, adapté la UI a la realidad.
3. **Confirmación de movimiento inter-planta pendiente** (M5): usa `crm_confirmar_ingreso_planta`, cuyo `{confirmadas:0}` en ese contexto NO es error — el éxito se decide releyendo los movimientos. Documentado en el código.
4. **Descripción de incidencia requerida en UI** (M7) aunque la columna sea nullable — calidad del dato para el reclamo.
5. **Fallo parcial de fotos = modo reintento sobre el mismo id** (M7): la incidencia nunca se duplica; el evento del timeline ya existe.
6. **Costo "realizado" vs "proyectado"** (M8): mes/YTD = solo operaciones CERRADAS (fecha_devolucion); lo devengado por abiertas es un KPI aparte ("proyectado abierto") que coincide al centavo con /alertas. Sin mezcla conceptual.
7. **E2E de M9 sin cuenta admin de test** (guardrail 6): gating con supervisor + enforcement REST + camino positivo impersonando la RLS del admin real a nivel SQL con rollback estructural (RAISE). La UI positiva de admin queda para tu smoke.
8. **Seeds de ayuda versionados, no aplicados** (m3→m9 en `crm-v2/supabase/seeds-ayuda/`): son contenido de M10; se aplican todos juntos ahí.

## HALLAZGOS (elevados, no enterrados)

1. **⚠️ Bucket público `incidencias` (v1) con policy demo `incidencias_demo_all` para TODOS los comandos** — cualquier rol puede leer/escribir ese bucket. Es residuo de v1; v2 no lo usa (usa `crm-incidencias` privado). **No lo toqué (orden explícita), pero es candidato #1 a borrarse en el cutover.**
2. **`plantas` sin write policy**: ni el admin puede crear/editar plantas vía API. Si se necesita el alta, es una migración de backend (INSERT/UPDATE policy admin, 10 líneas).
3. **2 blobs de test huérfanos en storage `crm-incidencias`** (54959820-…/): `storage.protect_delete()` bloquea el DELETE por SQL y no hay service key ni DELETE policy. Son INACCESIBLES (la policy de SELECT exige que exista la incidencia, ya borrada). Se borran en 10 segundos desde el Dashboard → Storage.
4. **`vista_kpi_costo_naviera` cruza realizado vs proyectado por NOMBRE de naviera** (vista_alertas no expone naviera_id). Asume nombres únicos — cierto por diseño, pero es el único acoplamiento por texto del sistema.
5. **Ficha del contenedor tarda ~3-4s en skeleton** (2 roundtrips secuenciales tras el batch inicial). No funcional; pulido para M10/CP3.
6. La búsqueda con filtro anidado a dos niveles (`operacion.contenedor.numero_contenedor` con doble `!inner`, M7) funciona en la versión de PostgREST del proyecto — validado en prod.

## ESTADO — G1..G7

| Gate | Estado | Evidencia |
|---|---|---|
| G1 · 6 rutas + flags, VISTAS en el sidebar en prod | **PASS** | Eval del DOM (M9-E1a): Inicio/Ingreso/Egreso/Contenedores/Alertas/Incidencias = `<a>`; Ayuda = `<span>` (M10, correcto); Admin visible solo para admin. Screenshots mirados por el orquestador. |
| G2 · E2E por módulo en prod con evidencia cruda | **PASS** | Tabla HECHO ↑ — todos con status+body. Retries del gate usados: M5 (UUID 400s), M7 (label timeline) — ambos re-verificados en prod. |
| G3 · Consola prod: 0×406/401/404 | **PASS** | Verificado en el flujo E2E de CADA módulo (56+94+303+55+52+140+133+76+354+132 requests, histogramas en los reportes). Únicos 4xx de todo el run: los 2×400 de M5 (arreglados y re-verificados) y los 4xx ESPERADOS de los asserts de seguridad. |
| G4 · DDL solo M8, security_invoker, anon=false | **PASS** | 4 views con `security_invoker=true` (reloptions), `has_table_privilege('anon',…)=false` ×4 + REST anon → 401 `permission denied` ×4 CON BODY. Migración `018` + rollback versionados. |
| G5 · Data de test en cero, auth.users=1 | **PASS** | ops/conts/movs/evts/incs/fotos = 0, auth_users=1 (jzenteno@ssbint.com), test_users=0 — con body, post-cleanup de cada módulo y al cierre. Salvedad: hallazgo 3 (2 blobs storage, fuera de la lista G5). |
| G6 · detention intocado | **PASS** | 13 tablas (baseline = cierre). GUC del authenticator: `pgrst.db_schemas=public, graphql_public, crm` — sin detention. Cero GRANT/DDL fuera de `crm`. |
| G7 · tsc+build limpios, commiteado y pusheado | **PASS** | tsc+build verificados por el orquestador en cada módulo (23/23 páginas al cierre). 6 commits (`d205108`→`9be67a4`) pusheados a origin/v2-rebuild. Working tree limpio (solo los 3 untracked de negocio de sesión 11). |

## QUÉ VA A VER JOHN — y cómo probarlo

Entrás a **https://crm-detention.vercel.app** con tu cuenta admin y tenés el CRM completo: Inicio (dashboard de KPIs), Ingreso, Egreso, Contenedores, Alertas, Incidencias y Admin. La DB está EN CERO (sin data de test) — el dashboard arranca en 0 con su instructivo.

**Smoke sugerido (15 min, en este orden):**
1. **Ingreso**: cargá una tanda real con el toggle "confirmar ingreso ahora". → La ves en Contenedores y en Alertas (verde), y el dashboard actualiza stock/proyectado.
2. **Contenedores**: abrí la ficha → probá "Mover entre plantas" y mirá el timeline.
3. **Egreso**: registrá la salida (embarcado, con orden/SHP) y confirmá la devolución. → El dashboard suma el costo realizado.
4. **Incidencias**: cargá una con foto — la foto se sirve firmada (privada).
5. **Admin (lo único NO verificado E2E — guardrail: no se crean cuentas admin de test)**: Navieras → creá/editá una; Tarifas → "Nueva versión" para una naviera (mirá cómo la anterior queda cerrada al día previo); Configuración → cambiá el umbral a 4 y mirá /alertas recalcular el semáforo al toque. El enforcement de todo esto SÍ está verificado (REST + DB); lo pendiente es solo el click-path de la UI.
6. Storage → bucket `crm-incidencias` → borrá la carpeta huérfana `54959820-…` (hallazgo 3).

## DEUDA ABIERTA

- **H1 (arrastrada de M3)**: `crm_crear_tanda_retiro` — 1 colisión tumba la tanda entera + punto ciego cross-planta del pre-check. Fix = helper SECURITY DEFINER (DDL de backend). Candidato a resolver antes de carga en volumen.
- **M10**: solapa Ayuda/FAQ + aplicar los seeds `m3…m9_admin.sql` (ya escritos y versionados) + empty states finales + CP3 (pulido visual + re-auditoría §14.10).
- **Campana de notificaciones (§13)**: `get_pendientes()` existe; el front de campana/popup no entró en este run.
- **Realtime (§6.3.9)**: todos los listados usan refetch-al-foco (consistente); Realtime quedó fuera desde M3.
- Write policy de `plantas` si se necesita el alta (hallazgo 2). Bucket público `incidencias` → borrar en cutover (hallazgo 1).
- 3 untracked de negocio en la raíz (PDF/HTML/HANDOFF-cross) — decisión tuya desde sesión 11.

## Contexto no obvio (persiste)

- Deploy v2 = `cd crm-v2 && npx vercel deploy --prod --yes` (proyecto Vercel `crm-detention`). Deploy final: `qhqv5a37x`. Cadena de rollbacks del run en `.claude/state/progress.md`.
- Regla §21 intacta: v2 escribe SOLO en `crm` + bucket `crm-incidencias`. `detention`/`public` intocados (verificado al cierre).
- Usuarios de test: patrón `test-crmv2-*@crmv2.invalid`, password bcrypt generado local (nunca en transcript), borrados en el mismo turno — 6 creados y 6 borrados en este run.
- El clasificador de permisos denegó (correctamente) el único intento de mutación persistente a config compartida — el camino positivo de M9 se verificó con rollback estructural.
