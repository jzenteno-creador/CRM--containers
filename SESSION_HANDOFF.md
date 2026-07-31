# Handoff de sesión — 2026-07-31 · CRM Detention v2 · rama v2-rebuild

## Resumen
Sesión **de orden**: cerrado el capítulo Dow Summit (presentación enviada por John) y
limpieza completa del repo — baja del prototipo v1, consolidación de 8 borradores del
formulario en 1 entregable, 20 documentos de proceso cerrado a `docs/historico/`, y baja de
9 ramas locales + 5 remotas. Cero código de la app tocado. En el camino apareció un **P1
real que no era limpieza**: el backup diario respaldaba la base muerta.

## ✅ HECHO

### P1 — el backup respaldaba el schema equivocado (`b621d17`)
`.github/workflows/backup-detention.yml` hacía `pg_dump --schema=detention`: el schema del
prototipo v1. Los datos vivos del v2 —**2.959 operaciones cargadas en M6**— están en el
schema `crm` del mismo proyecto `cctuowthpnstvdgjuomq` y **no tenían ninguna copia
recuperable** (plan free: sin PITR, sin backups descargables). Corregido a
`--schema=crm --schema=detention`, con guardrail que hace fallar el job si el `.sql` no
contiene `CREATE TABLE crm.` — un backup vacío en verde es peor que no tener backup.
Renombrado a `backup-db.yml`; runbook reescrito en `docs/backup-db.md`.
**⚠️ TODAVÍA NO ESTÁ EFECTIVO — ver Próximos pasos #1.**

### Limpieza (`3c2df3d`) — 105 archivos, −20.468 líneas
- **Baja del v1**: `crm-detention/` (59 archivos) y `db/schema/` (10). Rescate en el tag
  **`v1-prototipo`** (pusheado): `git checkout v1-prototipo -- crm-detention db`.
  Mató un footgun real: `crm-detention/.vercel/project.json` apuntaba **al mismo proyecto
  Vercel que crm-v2** (`prj_xRmLlZJ3...`) — un `vercel deploy --prod` parado en la carpeta
  equivocada pisaba producción con el prototipo. Hoy hay un solo `.vercel/` en el repo.
- **Dow Summit**: queda `docs/dow-summit-2026/` con `presentacion-final.pdf` (la enviada) y
  `formulario-final.md` (su texto fuente). 8 borradores fuera del repo.
- **Caso de negocio**: `docs/caso-negocio/` con los 2 PDF finales (ES + EN).
- **Planillas**: las 4 xlsx con datos reales de cliente salieron del repo. `.gitignore`
  ahora corta `/*.xlsx|docx|pdf|html` **en la raíz** (no alcanza `docs/m5/fuentes/`).
- **Histórico**: 20 docs de proceso cerrado a `docs/historico/` con README que explica cada
  uno. Planes de M5 a `docs/m5/` (M5 tiene deuda abierta, no es histórico).
- **Referencias**: reapuntadas en `crm-v2/AGENTS.md`, `docs/v2/CONTEXT.md` y los 2 planes de
  M5. Verificado por grep: cero referencias rotas fuera de `docs/historico/`.
- **Ramas**: 9 locales + 5 remotas borradas. **Las 9 estaban contenidas en `v2-rebuild`**
  (verificado con `git merge-base --is-ancestor` una por una) — cero commits huérfanos.

### Archivo externo (nada se borró)
`/home/jzenteno/projects/_archivo-crm-containers/2026-07-31/` — 4,0 MB en 16 archivos:
`dow-summit-borradores/`, `caso-negocio-fuentes/`, `fuentes-xlsx/`, `handoffs/`.

## Decisiones tomadas
- Lo untracked se **archiva fuera del repo**, no se borra (decisión de John): era lo único
  irrecuperable. Lo tracked se borra sin miedo — vive en la historia y en el tag.
- El schema `detention` **sigue vivo en la DB**: hoy se dio de baja solo el código del v1.
  Por eso el backup lo sigue dumpeando.
- `docs/fix-p1/025_fix_p1_rpc_executor.sql` borrado sin archivar: era duplicado **byte a
  byte** de `crm-v2/supabase/migrations/025_fix_p1_rpc_executor.sql`, que está aplicada en
  prod (registrada `20260713160000`, y le siguieron 11 migraciones más).
- `master` **no se tocó**: sigue congelada en `33ad084` (v1), el cutover sigue pendiente.

## Estado actual
- `v2-rebuild` local == origin == `3c2df3d`. Working tree **limpio**. Tag `v1-prototipo`
  pusheado. Solo quedan 2 ramas: `master` y `v2-rebuild`.
- Raíz del repo: `spec.md`, `SESSION_HANDOFF.md` y nada más suelto.
- **Cero cambios** en `crm-v2/src`, `crm-v2/supabase` y `package.json` → el build no puede
  haberse roto. No se corrió build ni deploy; prod sigue en el deploy del 18/07.

## Próximos pasos
1. **John**: disparar el workflow a mano (Actions → *Backup DB CRM* → Run workflow) y
   confirmar que el artifact `crm-db-*` trae tablas de `crm`. **Es lo único que valida el
   fix** — nunca corrió contra el runner real.
2. **John**: test con foto real del escaneo OCR en prod (pendiente desde el 18/07).
3. **John**: smoke de M5 con roles reales en prod (pendiente desde el cierre de M5).

### ✅ Resuelto en la misma sesión (GO de John)
El fix del backup vivía solo en `v2-rebuild`, y GitHub Actions ejecuta los triggers
`schedule:` **solo desde la rama default** — que es `master`, congelada en el v1. Cherry-pick
de `b621d17` a `master` (`34bc6b5`, pusheado): master recibió **únicamente** el workflow,
`git diff 33ad084 master` = 1 archivo. El cron de las 03:00 ya corre la versión corregida.

## Deudas abiertas (con tier del próximo paso)
| Deuda | Próximo paso | Tier |
|---|---|---|
| Restore nunca ensayado (D-02). Además el dump usa `--no-privileges`: no trae los GRANT, y el modelo de seguridad del v2 vive en los grants | Ensayo end-to-end contra proyecto vacío + reaplicar grants desde migrations; verificar si las policies RLS vienen en el dump | **Sonnet** con guardrails |
| `scan_pruebas` es DESECHABLE + cuentas no-activas acceden | Dropear tabla al terminar las pruebas OCR | db-hardening (**Opus**) — DDL prod |
| Filtro de sigla: confusiones OCR en el serial (O→0/B→8/I→1) | Implementar en `extraerSigla` con vectores de test | **Sonnet** |
| M5: MOTOR↔NAVIERA (expo) + primera liquidación impo | Diseño + ejecución con gates | **Fable/Opus** — lógica de plata |
| Cutover de `master` (sigue en v1, 10+ commits atrás) | Decisión de John | Decisión → cualquiera |
| M5: reviewer estricto B2-UI/B7/033/034 sin resultado | Correr los reviews pendientes | **Opus/Fable** high |

## Contexto no obvio
- **GitHub Actions `schedule:` solo corre desde la rama default.** Un workflow arreglado en
  una rama de trabajo no tiene ningún efecto sobre el cron hasta que llega a `master`.
  Vale para cualquier workflow futuro de este repo mientras master siga congelada.
- El tag `v1-prototipo` apunta a `b621d17`, que **está en la rama** `v2-rebuild` (no es un
  commit huérfano). Contiene los 69 archivos del v1.
- Los assets del design system Flight Deck (`design_handoff_crm_detention/`) ya estaban
  portados a `crm-v2/src/app/globals.css` — la baja del v1 no perdió nada vivo.
- La presentación al Dow Summit **ya fue enviada** por John (31/07). Ahora se espera
  respuesta; el caveat ZIM quedó sin resolver pero el documento ya salió.
