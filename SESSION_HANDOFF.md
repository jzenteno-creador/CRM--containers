=== CRM v2 · Sesión 13 · 2026-07-12 · CERRADA ===

ESTADO: CRM v2 COMPLETO Y EN PRODUCCIÓN — crm-detention.vercel.app
7 solapas operativas (Inicio, Ingreso, Egreso, Contenedores, Alertas, Incidencias, Admin).
G1–G7 en PASS. 7 commits en v2-rebuild (d205108 → eb7d1b1) + 018 (m8_018_kpi_views).
DB en cero de data de test (verificado al cierre con body: ops/conts/movs/evts/incs/fotos = 0,
auth.users = 1 = jzenteno@ssbint.com, test-crmv2-* = 0, detention = 13 tablas intocado).
Consola de prod limpia (0 · 406 / 401 / 404).

LO QUE JOHN NO PROBÓ TODAVÍA (es su próximo paso)
- Cargar la PRIMERA TANDA REAL desde /ingreso. El CRM está vacío a propósito.
- El click-path de Admin (crear naviera, versionar tarifa, cambiar umbral desde la pantalla).
  El enforcement está verificado por REST y DB; el camino por UI NO. CC no pudo probarlo:
  el guardrail prohíbe cuentas de test con rol administrador, así que no hay sesión con la
  que ejercerlo. NO ESTÁ VERIFICADO — no lo des por bueno.

DECIDIDO ESTA SESIÓN
- §14.1 CERRADO: la asignación se pliega en el egreso. `orden` y `shp` OBLIGATORIOS;
  booking_asignado / buque / destino OPCIONALES. NO hay estado `cargado`.
- Toda view nueva en crm: security_invoker=true + GRANT SELECT TO authenticated. NUNCA a anon.
  Las 4 views KPI de la 018 cumplen (verificado: anon_sel=false en las 4, por catálogo y
  por REST — 401 permission denied con body).

⚠️ BLOQUEANTE DE INFRAESTRUCTURA — DECISIÓN DE JOHN, NO SE TOCA SIN SU GO
El proyecto Supabase cctuowthpnstvdgjuomq aloja DOS workstreams:
  - crm (este CRM, con front público en Vercel)
  - public (bookings_301 / shipments_304 / inbound_events / inbound_log — datos con PII)
Comparten la MISMA anon key, y la anon key del CRM está publicada en su bundle JS por diseño.
El 12/07 se detectó y cerró (migración lockdown_anon_public) que la anon key devolvía
HTTP 200 con 1.745+ raws con PII desde public.inbound_events.
Las tablas están cerradas AHORA, pero el pg_default_acl de supabase_admin sobre `public`
sigue dando grants a anon → la PRÓXIMA tabla que se cree en public nace abierta otra vez.
NO EJECUTAR NINGÚN FIX SOBRE ESTO. John decide en la próxima sesión:
  (a) separar en dos proyectos Supabase, o
  (b) cerrar los defaults + evaluar sacar `public` del GUC de PostgREST.
La opción (b) depende de si n8n le pega a public por REST o por conexión directa a Postgres
— ese dato NO se verificó todavía.

DEUDA ABIERTA (ordenada por impacto)
1. H1 · crm_crear_tanda_retiro revierte la tanda ENTERA ante una sola colisión, y nombra
   un solo contenedor. Combinado con el punto ciego cross-planta del operador (el pre-check
   corre bajo RLS), un operador puede necesitar N rechazos completos para descubrir N
   colisiones. Es el anti-patrón del "menos clics" del spec.
   FIX: helper SECURITY DEFINER (DDL de backend). Conviene ANTES de cargar en volumen.
2. `plantas` no tiene write policy — ni el admin puede crear plantas vía API.
   La sección de Admin quedó read-only con aviso. Fix = DDL.
3. Bucket público `incidencias` (residuo de v1, policy demo abierta a todos, 0 objetos).
   Borrar en el cutover.
4. 2 blobs de test huérfanos en crm-incidencias (carpeta 54959820-…). storage.protect_delete()
   bloquea el borrado por SQL. Se borran desde el Dashboard de Supabase en 10 segundos.
   Inaccesibles mientras tanto (la policy de SELECT exige la incidencia, ya borrada).
5. M10 · Ayuda/FAQ: los seeds están escritos y versionados en seeds-ayuda/ (m3…m9_admin.sql).
   Falta aplicarlos y construir la solapa.
6. Campana del header: Popover placeholder, no navega.
7. vista_kpi_costo_naviera agrupa por nombre de naviera (acoplamiento por texto). Cosmético
   — el nombre viene del maestro vía FK, no es el bug del §10. Pulido de M10.
8. 3 untracked de negocio en la raíz esperando decisión de John.

PRÓXIMO PASO
1. John carga la primera tanda REAL en /ingreso. TIER: humano.
2. Decisión de infraestructura (el bloqueante de arriba). TIER: humano + Opus para el plan.
3. Fix de H1 (DDL de backend). TIER: Opus (grants/lógica transaccional = error silencioso).
4. M10 (Ayuda) + pulido. TIER: Sonnet.

---

## Contexto no obvio (persiste entre sesiones)

- Deploy v2 = `cd crm-v2 && npx vercel deploy --prod --yes` (proyecto Vercel `crm-detention`).
  Deploy final del run: crm-detention-qhqv5a37x. Cadena de deploys/rollbacks por módulo en
  `.claude/state/progress.md` (local, gitignored — evidencia cruda de todos los E2E).
- Regla §21 intacta: v2 escribe SOLO en schema `crm` + bucket `crm-incidencias`.
- Usuarios de test: patrón test-crmv2-*@crmv2.invalid, hash bcrypt generado local (el
  password nunca entra a un transcript), token-cols en '', rol supervisor máximo, borrados
  en el mismo turno. 6 creados y 6 borrados en este run.
- DATEs (vigente_desde/hasta) se formatean con fmtFechaDia — nunca new Date("YYYY-MM-DD"),
  que corre −1 día en AR. fmtFecha es solo para timestamptz.
- Charts del dashboard: BarChart/TrendLine SVG propios del design system (sin Recharts).
- Higiene verificada al cierre: bajo .claude/ solo están trackeadas las definiciones de
  agentes (.claude/agents/*.md, sin credenciales); .claude/state/ está gitignored; los
  transcripts de agentes viven fuera del repo (/tmp). Cero transcripts/logs en git.
