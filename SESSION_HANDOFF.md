# SESSION_HANDOFF — CRM Detention de Contenedores

**Fecha:** 2026-07-06 (sesión 8: Fase 2 DEPLOY — código en prod + VERIFY)
**Rama:** `master` @ `33ad084` (== `feat/fase2-apply`) · pusheado a `origin/master` · **deployado a prod**.
**Handoff previo (Fase 2 APPLY: money-path + frontend/UX):** en git history de este archivo.

---

## ✅ Lo que quedó DEPLOYADO esta sesión

- **`git push origin master`** — fast-forward limpio `806c515..33ad084` (20 commits). El merge local de `feat/fase2-apply` (que arrastra `feat/fase2-etapa0` + la base `feat/login-logos`) ya estaba hecho de la sesión previa; solo faltaba el push.
- **`npx vercel deploy --prod --yes`** — corrido a mano desde `crm-detention/` (John, terminal propia). Prod (`crm-detention.vercel.app`) sirve el build nuevo. Ready in 32s.
- **VERIFY (2026-07-06):** asset `/logos/ssb-white.svg` → 200; `age: 0`; login con logos SSB/Dow; carga de datos real OK (`vista_alertas` = 70 filas vivas vía anon key + schema `detention`). Ruta de datos end-to-end confirmada.

### ⚠️ Aprendizaje crítico de deploy (guardado en memoria)
Este repo **NO auto-deploya desde `git push`**. La regla global "push → Vercel" es de **ssb-workspace**, no de acá. Deploy real = `cd crm-detention && npx vercel deploy --prod --yes` (per `crm-detention/AGENTS.md`). El token del CLI Vercel (`~/.local/share/com.vercel.cli/auth.json`) venció 2026-07-04 pero refrescó OK al deployar desde terminal.

### DB de prod (aplicado en sesión previa, NO se tocó ahora)
Los RPCs money-path (D-01/D-04/D-05, F-02/F-03, BE-03), el REVOKE de grants y las 3 passwords rotadas ya estaban aplicados (cada uno en `BEGIN…ROLLBACK` verificado). **El deploy de hoy solo subió frontend + schema versionado + el workflow yml.** No corrió ninguna migración.

---

## 🧪 PENDIENTE inmediato — Smoke test visual (John, browser logueado)
La capa UX nunca corrió contra prod con un usuario real. Checklist first-run-in-prod (server pega contra prod, **sin staging**):
1. **Realtime + debounce (FE-06):** `/alertas` e `/inicio` en 2 pestañas, refresco sin recargar.
2. **Export CSV (F-01, sup+):** `/historial`, `/alertas`, `/contenedores` — acentos OK (BOM UTF-8, sep `;`), exporta el filtro aplicado.
3. **Selección persistente cross-página (FE-02):** `/egreso` — selección sobrevive cambio de página; contador de lote correcto.
4. **Command palette ⌘K (FE-05):** busca cerradas. ⚠️ ver decisión planta-scope abajo.
5. **Orden naviera/planta `/contenedores`:** puede no reordenar filas padre (embeds no-`!inner`). Cosmético.
6. **`/inicio`** (label umbral FE-07) e **`/ingreso`** (pill planta fija, fail-visible prefijos DOW).
7. **🔴 F-02 / F-03** (reabrir contable / edición auditada, sup+): **SOLO sobre un contenedor de PRUEBA reversible, NUNCA una operación real.** Confirmar flujo (confirm → efecto → evento timeline), luego revertir el contenedor de prueba.

---

## ⏳ Follow-ups gateados (fuera de scope de esta sesión)
1. **Secret `SUPABASE_DB_URL`** (repo → Settings → Secrets → Actions): activa el backup diario (D-02). Sin él, la GitHub Action `backup-detention.yml` **fallará en la próxima corrida cron (06:00 UTC diaria)**. No bloqueante, no peligroso. Precondición de la Parte B.
2. **Decisión A/B — Parte B (restore ZIM):** mutación irreversible, NO ejecutada. SQL listo en `docs/plans/moneypath-plan-20260705.md`. Requiere backup activo (item 1) + confirmar si `vacios 0d@$84` de ZIM es legítima. Estado ZIM en prod sigue corrupto pero con **cero daño vivo** (0 ops ZIM abiertas).
3. **Decisión planta-scope (command palette):** `vista_costos_cerrados` no expone `planta_actual` → un operador ve cerradas de **todas las plantas** al buscar. Aceptar o cambiar la DB. **Decisión de negocio.**
4. **Cosmético `.gitignore`:** el patrón `*.Zone.Identifier` no matchea los 2 archivos basura `docs/*:Zone.Identifier` (dos puntos vs punto). Fix trivial, quedaron untracked.

---

## Estado git al cierre
- `master` local == `origin/master` == `33ad084` (tras el push).
- `feat/fase2-apply` y `feat/fase2-etapa0` locales: contenidas en master, backupeadas implícitamente en origin. Seguras de borrar cuando quieras.
- Untracked: solo `docs/*:Zone.Identifier` (basura WSL, no commitear).
- `SESSION_HANDOFF.md` (este archivo): modificado en working tree, **sin commitear** (a decisión de John).
