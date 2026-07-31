# Handoff de sesión — 2026-07-31 (maratón) · CRM Detention v2 · rama v2-rebuild

## Resumen
UNA sesión, cuatro capítulos: (1) limpieza integral del repo + P1 del backup que respaldaba
el schema muerto; (2) **auditoría integral con 6 agentes** (informe:
`docs/auditoria-integral-2026-07-31.md`) + cruce contra el PDF enviado a Dow; (3) John
aprobó TODO el plan → **implementación autónoma de los 4 bloques** (migraciones 037-040
aplicadas con harness, 3 deploys a prod, CI nuevo verde, 101 tests); (4) descubrimiento y
reparación de que **el backup JAMÁS había funcionado** (25/25 corridas fallidas desde el
07/07) → hoy existe el primer backup real del proyecto.
(El handoff de la limpieza matutina quedó en la historia git de este archivo.)

## ✅ EN PRODUCCIÓN (deploys verificados con URL 200)

**Bloque 1 — higiene**: Next 16.2.12 (3 CVEs cerrados) · engines Node fijado · rail con
scroll (1366×768) · pegado con tabs · compresión de fotos de incidencias · AbortController
en modo vivo · /design solo admin · aviso "peligrosa = dato informativo" en Admin→Tarifas.

**Bloque 2 — importación completa**: migración **038** (operador NO crea órdenes en otra
planta; 2 RPCs con guard rol+planta — la RLS del SELECT previo es el candado real, medido;
3 CHECKs de fechas; semáforo split honesto: exceso devengado ⇒ rojo) + migración **039**
(waiver acumulativo impo espejo de 021 CON advisory lock anti-TOCTOU, anulación, corrección
de cerradas whitelist 3 fechas, views con costo NETO + costo_bruto + dias_waiver al final,
CHECK de eventos con 'waiver'). Harness T1-T10 y T1-T9 PASS pre-apply, smoke post-apply.
Front: dashboard combinado expo+impo + pestaña Importación en /reportes.

**Bloque 4 — red de seguridad**: **101 tests** (ISO 6346 con ancla canónica, fechas AR,
43 golden de plata con oráculo TS) · **CI verde** en primera corrida (lint+tsc+test+build,
push y PR) · rate limit 50/min por usuario en /api/vision/scan · **BACKUP FUNCIONANDO**:
3 causas apiladas cazadas en validación end-to-end (gpg sin tty desde el día 1 → secret
SUPABASE_DB_URL que nunca existió (John lo cargó hoy) → wrapper pg_dump 16 vs server 17)
→ run 30672413156 SUCCESS, artifact `crm-db-backup-20260731-2316` (2.0 MB, crm+detention).
Aviso de fallo por mail vía n8n ya activo (probado en vivo). Todo cherry-pickeado a master.

**Bloque 3 — pitch**: migración **040** `vista_kpi_piloto_mensual` (KPIs 2-3-4 del
formulario Dow; calibrada ANTES de crear: 54,4% dentro del free time vs 56% del PDF —
delta = CMA 14vs18 días de M6 + activas en el denominador del PDF, documentado en la
migración) · sección "KPIs del piloto" en /inicio (4 cards + tabla 12 meses) · refresco
automático 60s en /inicio y /alertas con badge honesto · buscador ⌘K conectado de verdad
(expo abiertas/cerradas + impo).

## ⏸ BLOQUEADO EN JOHN (lo único que falta del plan aprobado)
1. **Correo diario 7AM**: workflow n8n `hdDDj5BLJt5wNESm` ("CRM Detention — Resumen diario
   7AM") creado y probado — falla SOLO por credencial: en n8n no existe ninguna credencial
   del proyecto cctuowthpnstvdgjuomq (todas apuntan a xkppk; verificado barriendo los 36
   workflows). John: Supabase→crm-containers→Settings→API Keys→copiar `service_role` →
   n8n→Credentials→Add→"Supabase API"→Host `https://cctuowthpnstvdgjuomq.supabase.co` +
   la key → nombre `supabase-crm-containers-service`. Después: reasignar la cred en los 3
   nodos HTTP (MCP update_workflow), re-ejecutar prueba, **publish** (hoy está en draft,
   el cron NO corre hasta publicar).
2. **Snapshot mensual del backup a Drive**: pendiente — requiere workflow n8n con un GH PAT
   como credencial (John) para bajar el artifact. Diseñar cuando el mail esté vivo.
3. Decisión **carga peligrosa**: sigue abierta (contrato: ¿tarifa/free time distinto para
   peligrosa?). Mientras: flag marcado "no usado por el motor" en Admin. Si se confirma
   diferenciación → desarrollo real (columna en contenedores + filtro en motor).
4. HIBP toggle en Supabase Auth (1 click, John ya tiene acceso al dashboard).
5. Bucket viejo `incidencias`: quedó privado e inerte; baja física desde dashboard.

## Pendientes de trabajo (no bloqueados)
- **UI de waiver/corrección impo** (task #9): RPCs verificadas sin pantalla. Diseñar punto
  de entrada (¿ficha impo?) con el patrón de contenedores/[id]/acciones.tsx.
- **Verificación visual** de todo lo deployado hoy (rail, KPIs, ⌘K, tabs de reportes):
  análisis estático solamente — browsers MCP rotos en WSL; pase de agent-browser o smoke
  de John.
- Deudas P2/P3 del informe no incluidas en los bloques (fetch caps, prorrateo KPI,
  tarifa por tramos MOTOR↔NAVIERA, i18n, Realtime real, importador Excel de tarifas):
  ver `docs/auditoria-integral-2026-07-31.md` §3/§7 fase 2.

## Decisiones de John HOY (todas ejecutadas)
- GO a todo el plan de la auditoría; trabajo autónomo con multiagentes y modelos baratos.
- Migraciones y deploys a prod autorizados ("autorizado todo").
- Prefijos: supervisor+admin RATIFICADO → AGENTS.md actualizado (cierra D4).
- Correo diario: a jzenteno@ solo, destinatarios configurables después.
- Vercel Node 22.x fijado (dashboard) · secret SUPABASE_DB_URL cargado · proyecto Supabase
  renombrado a `crm-containers` · `gate-019-sandbox` identificado como borrable (~USD 10/mes).

## Estado técnico exacto
- `v2-rebuild` == origin (HEAD tras docs de ratificación); `master` == origin con los 3
  cherry-picks del backup (b621d17→34bc6b5, aviso n8n, fix pg_dump 17). Working tree limpio
  salvo untracked de John (`docs/Modelo LOGIN VGM SISTEMA E-Cargo.xlsx` — sin clasificar,
  John no explicó qué es).
- DB prod: migraciones **hasta 040** aplicadas y verificadas. Front prod: deploy del Bloque
  3 (alineados). CI: verde. Backup: cron diario 03:00 AR operativo con alerta.
- n8n: workflow del mail en DRAFT (id hdDDj5BLJt5wNESm), sin publicar.

## Contexto no obvio (lecciones del día)
- **El fix sugerido por un auditor puede romper prod**: el DROP de las policies huérfanas
  (004) habría matado las RPCs — el rebind (`ALTER POLICY ... TO crm_rpc_executor`) fue el
  fix correcto. Verificar SIEMPRE contra pg_policies + harness antes de aplicar fixes de
  terceros (incluidos agentes propios).
- **perfil() matchea por `auth_user_id`, no por `usuarios.id`** — simular contexto en
  harness requiere el uuid de auth.users.
- **`create or replace view` NO permite intercalar columnas** — las nuevas van AL FINAL.
- **Los runners de GH ya traen keyring PGDG y pg_dump 16**: gpg necesita `--batch --yes` y
  pg_dump 17 ruta explícita `/usr/lib/postgresql/17/bin/pg_dump`.
- **GHA `schedule:` corre solo desde la rama default (master)** — todo fix de workflow
  necesita cherry-pick; el dispatch manual desde otra rama da verde y engaña.
- El rechazo cross-planta en RPCs impo sale como `estado_no_valido` (RLS oculta la fila),
  no `fuera_de_alcance` — es deseable (no filtra existencia) y está documentado en la 038.
- n8n: NINGUNA credencial existente apunta al proyecto del CRM — "supabase-ssb-inbox-service"
  es xkppk (schema inbox_triage no existe en cctuowth, verificado).
