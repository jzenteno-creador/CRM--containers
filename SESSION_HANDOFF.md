# Handoff de sesión — 2026-07-12 (sesión 10: run autónomo de cierre → CP2-READY)

**Rama al cierre:** `v2/m2-auth` (+3 commits de este run: 94af5f1, 949b2c3, 4a83984) · base `v2-rebuild` · `master` intacta.
**Estado macro: CP2-READY.** M2 verificado E2E; 015 y 017 aplicadas Y versionadas (ledger == repo); DB limpia de usuarios de test. **No queda ningún paso autónomo pendiente: lo que sigue es de John.**

---

## 🟢 QUÉ SIGUE (John)

1. **Auditar CP2**: levantar `npm run dev` en `crm-v2/` y recorrer el flujo M2 (login admin real, /admin/solicitudes, registro de prueba si quiere). La evidencia del run está en `.claude/state/progress.md` (gitignored, local) y los screenshots en el scratchpad de la sesión.
2. Si CP2 aprueba → **merge `v2/m2-auth` → `v2-rebuild`** y arranca **M3 (Ingreso)** en sesión nueva (M3 quedó explícitamente fuera de este run; §14.1 del spec sigue abierto y depende del feedback de CP2).
3. Decidir destino de 3 archivos untracked que NO son del repo (abajo).

## HECHO en este run (todo con evidencia cruda, verifier independiente del implementador)

- **ITEM 1 — Baseline authenticated**: 2 usuarios de test creados (SQL directo en auth.users: no hay service_role key en env y el signup por API gasta cuota SMTP), aprobados por SQL, sign-in real. Asserts 1.0–1.6 PASS. **Primera prueba en vivo del scoping por planta**: operador ve SOLO su planta (BAHIA), supervisor ve todas; `usuarios` devuelve solo la fila propia; `usuarios_publicos` los 3 activos.
- **ITEM 2 — §14.10 pre-hardening**: anon con grants presentes → 12/14 objetos `200+[]`, 2 views `401 permission denied for function` (anon nunca tuvo EXECUTE en funciones crm — bloqueo MÁS fuerte que lo esperado, no leak). 14/14 sin fila filtrada.
- **ITEM 3 — Migración 015 aplicada** (`m2_015_hardening_grants_crm`): anon sin ningún privilegio en crm; authenticated sin DELETE; `usuarios_publicos` read-only para authenticated; default privileges blindados. Rollback exacto (desde ACLs reales) en `crm-v2/supabase/rollbacks/015_rollback.sql` (NO aplicado). Verify post: anon 401 en los 14; sup lee (200+filas); DELETE 403 con fila intacta; scoping intacto; detention 406 y ACLs de detention idénticos pre/post.
- **ITEM 4 — E2E M2 (agent-browser, dev server local)**:
  - Registro real por UI → 200 → "Revisá tu correo".
  - Confirmación por el **link real de verificación** (GET /auth/v1/verify?token=<hash de auth.users>) → redirect a /auth/callback → fragment implicit resuelto → gate `/espera-aprobacion` correcto, retiene también en `/`.
  - Pendiente NO lee NADA: 4 superficies (operaciones, usuarios, usuarios_publicos, vista_alertas) → `200+[]` con su JWT, ni su propia fila.
  - **Auto-reparación (016)**: espejo borrado por SQL → login UI → `rpc/sync_mi_usuario` 204 → **fila reconstruida verificada en DB** (pendiente, sin rol).
  - **Backlog #7 (PKCE/implicit)**: flowType=implicit (default, sin flowType en createClient) y el callback implicit FUNCIONA con link real. PKCE no está activado; si John lo activa, el callback necesita `exchangeCodeForSession` — sigue en backlog, no es deuda.
- **ITEM 5 — Housekeeping**: 017 versionada (divergencia ledger/repo cerrada), 015+rollback commiteados, agentes del run commiteados, `.claude/state/` y `skills-lock.json` al gitignore. **Cleanup S9 verificado: auth.users=1 (solo John), 0 usuarios test.**

## DECISIONES (del run, autónomas)

- Usuarios test por INSERT SQL (sin service_role key; preserva cuota SMTP). Passwords descartables; usuarios borrados al cierre.
- Email e2e con dominio `ssbint.com` (GoTrue bloquea example.com con `email_address_invalid`). **Se disparó 1 email de confirmación a `test-crmv2-e2e@ssbint.com` (casilla inexistente → rebote interno en tu dominio, inofensivo).**
- Operaciones de test (TEST0000001/2, booking TEST-CRMV2): **anuladas, no borradas** (guardrail: DELETE solo de usuarios test). Quedan en el histórico con motivo explícito; fuera de vista_alertas y vistas operativas. Si las querés fuera del todo, es un DELETE tuyo de 1 línea.
- ITEM 2 declarado PASS-con-desviación (los 2 "FAIL" de views eran denegación más fuerte, evidencia en catálogo).

## HALLAZGOS (elevados, no enterrados)

1. **Bootstrap admin es case-INSENSITIVE por diseño** (`lower()` en ambos lados) — el check de CP2 esperaba que una variante en mayúsculas NO matchee. En la práctica es irrelevante: la clave `admin_bootstrap_email` ya está CONSUMIDA (null) + guard de admin activo ⇒ nadie más puede bootstrapearse, con cualquier casing. La variante del email real de John no se probó en vivo (habría creado una cuenta no borrable por guardrail). Si querés match case-sensitive, es 1 línea en `bootstrap_admin` — pero el estándar de emails avala el diseño actual.
2. **Views y funciones**: el `[]` de anon en las views pre-hardening NO era el accidente del WHERE que decía el baseline — anon carecía de EXECUTE sobre `perfil()`/`dias_estadia()` desde M1 (la 010 hizo bien su trabajo). Post-015 es doblemente irrelevante.
3. **Lección GoTrue** (para futuros usuarios por SQL): columnas token de `auth.users` deben ser `''`, no NULL (si no: 500 "Database error querying schema" en el sign-in). Y el endpoint GET de verify usa `token=`, no `token_hash=`.
4. `vista_alertas` conserva INSERT/UPDATE para authenticated (superficie inerte — view de solo lectura funcional). No bloqueante; anotado por db-hardening.

## Untracked que NO van a este repo (decisión pendiente de John)

- `Caso-de-Negocio-CRM-Detention.pdf` + `Presentacion-CRM-Detention-Contenedores.html` → material de negocio: Drive (Team Exportación) u carpeta docs de gestión, no el repo de código.
- `HANDOFF-cross-ssb-workspace-20260707.md` → pertenece al workstream ssb-workspace; moverlo a ese repo.

## ESTADO — stopping condition del run (S1–S9)

| S | assert | estado |
|---|---|---|
| S1 | anon → 14 objetos crm ⇒ 401 | **PASS** (post-015, 14/14 con body) |
| S2 | authN → operaciones ⇒ 200 + ≥1 fila | **PASS** (sup: 2 filas) |
| S3 | authN → vista_alertas ⇒ 200 + ≥1 fila | **PASS al momento del verify** (2 filas en 3.3). Al cierre da `200+[]`: los datos eran de test y se anularon; v2 no tiene datos reales hasta M3. No es error de permisos. |
| S4 | authN DELETE operaciones ⇒ 401/403 | **PASS** (403 + fila intacta) |
| S5 | anon detention ⇒ 406 | **PASS** |
| S6 | op solo su planta / sup todas | **PASS** (1ª prueba real del scoping) |
| S7 | git limpio; 015+017 commiteadas; ledger==repo | **PASS con salvedad**: tracked limpio y ledger==repo; quedan 3 untracked de negocio cuya ubicación decide John (arriba) |
| S8 | E2E M2 4 checks | **PASS** (check 1 con salvedad case-insensitive, hallazgo #1) |
| S9 | test users eliminados; auth.users=1 | **PASS** (verificado por count) |

## Contexto no obvio (persiste)

- Regla §21: v2 escribe SOLO en schema `crm` + bucket `crm-incidencias` + triggers `crm_*`. detention READ-ONLY absoluto.
- Canal migraciones: archivo en `crm-v2/supabase/migrations/` + MCP `apply_migration` (mismo contenido, mismo turno). Rollbacks en `crm-v2/supabase/rollbacks/` (nunca en migrations/).
- MCP browsers rotos en WSL → agent-browser. Deploy v2: manual de John (`npx vercel deploy --prod --yes`), nunca del agente.
- Agentes del run en `.claude/agents/` (scout/verifier/db-hardening/e2e-runner) — el registro los toma al inicio de sesión.

**Modelo sugerido para retomar:** M3 es build de UI+DB sobre spec cerrado → estándar (Sonnet/Opus). El review de M3 → reviewer habitual.
