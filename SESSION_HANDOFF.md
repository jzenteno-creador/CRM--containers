# Handoff de sesión — 2026-07-14 · CRM Detention v2 · rama v2-rebuild

## Resumen
Sesión **M5 completa en modo autónomo** (plan de John `PLAN-M5-IMPO-BOOKINGS-MULTIREGION.md` →
refinado con 3 agentes de exploración → GO con resoluciones D1–D7 → ejecución con agent teams:
Fable orquestador + workers Sonnet + reviewer/verifier independientes). **Los 8 bloques (B0–B8)
quedaron implementados, aplicados en prod y verificados.** 9 migraciones nuevas (026–034), 15
commits. **Deploy del front PENDIENTE** (clasificador bloqueó `vercel deploy` — acción manual de John).

## ✅ HECHO (todo aplicado en prod DB + commiteado en v2-rebuild)
- **B8.3** Formulario Dow Summit reescrito (PT+ES) como propuesta a desarrollar, cifras desde la
  planilla COSTOS validada con Omar (USD 587.805/11m, Maersk 95%). Solo .md, sin PDF.
- **B0** Repo sincronizado con prod (`c8dbf51`, `87c6b8a`): migración 025 + docs gate + plan M5.
- **B1** Multi-región (026+027, `e605ab1`/`9bd4167`/`0b86e85`): `paises` (98), `freetime_origin`
  reseed 730 filas del contrato global, `freetime_destino` nueva 1441 filas, **fix del bug latente**
  (motor no filtraba por país), ajuste ARG exacto D1 (CMA/ZIM/MSC/Hapag→14 **con nota** del valor
  contractual + O. Pérez 2026-07-13), navieras 33 (5 activas), Admin tarifas Origen/Destino con
  edición versionada + filtro país (default ARGENTINA). Gate: reviewer APROBADO + verifier PASS 10/10.
- **B3** Bookings (028, `cc38351`/`980af19`): RPC-only, booking+ETD obligatorios al ingreso (alta
  inline), roleo y reasignación auditados con eventos, `vista_bookings_saldo` + página /bookings +
  alertas. Umbral configurable (4 días).
- **B4** Consolidación (029, `262cd68`/`14b91cc`): productos GMID + consolidaciones multi-línea +
  estado_carga informativo (D3 — no toca tarifa ni reloj), Consolidar/Desconsolidar en ficha.
- **B5** Incidencias ampliadas (030, `2338037`/`19f71d6`): tipos nuevos, ciclo de reclamo con rastro
  {de,a} por edición, monto nullable estimativo (D6), RPC-only (BE-03 resuelto), auto no_reforzado.
- **B6** Prefijos restringidos (031, `ef32b17`/`c365ca0`): seed 37/37 desde legacy, **solapa propia**
  /prefijos, warning al pegar + ConfirmDialog, **barrido retroactivo** (vista derivada, siempre actual).
- **B2** Importación (032, `6b2c55f`/`97a2ded`): ciclo completo arribo→retiro→planta→devolución,
  retiros escalonados por fila, guard cross expo/impo bidireccional (advisory lock), **motor destino
  verificado con aritmética a mano en 3 casos** (Combined 0 / Combined 9×35=315 / split 9×125=1.125),
  solapa /importacion, alertas EXPO/IMPO fusionadas, KPIs impo + combinado en dashboard.
- **B7** Excel formato Omar (`2ab6d25`): 4 hojas espejo (General/Vencidos/Próximos/Vacíos), fórmula
  de vencimiento validada empíricamente 8/8 contra la vista.
- **B8.1** Password recovery (`f051d74` + fix P1 `5cc15ea`): branch PASSWORD_RECOVERY → form de
  cambio. ⚠ El reviewer independiente cazó un P1 en mi primer fix (perfil quedaba null → skeleton
  eterno post-cambio) — corregido y verificado. **B8.2** revoke contenedores (en 032).
- **033** (`5fb7f1e`): ayuda M5 completa (12 secciones), `crm_ayuda_valores` con destino, **barrido
  de grants fantasma** (authenticated escribe SOLO la lista sancionada exacta: 7 tablas).
- **034** (`5e7bf35`): fix evento de reclamo dual-aware para incidencias impo (bug integración 030↔032).
- **Verifier final consolidado: PASS 10/10** (migraciones, estado base, grants, 21 RPCs executor,
  REST anon 42501 total, goldens a mano, RLS 23/23, ayuda, legacy 2952 intacto). Build+lint+tsc limpios.

## ⏳ PENDIENTE

### De John (acciones)
1. **DEPLOY** (bloqueado para el agente por el clasificador): `cd crm-v2 && npx vercel deploy --prod --yes`
   (target verificado: proyecto `crm-detention`, mismo del deploy M4).
2. **Smoke en prod** (post-deploy): tanda expo con booking → mover → consolidar → cerrar · orden impo
   completa (retiro escalonado) → devolución · roleo + reasignación · incidencia con reclamo (montos)
   · prefijo restringido (warning + barrido en /prefijos) · export Excel formato Omar · recovery de
   password end-to-end. El smoke con roles reales quedó estructuralmente verificado pero NO ejercitado
   en vivo (clasificador bloquea fixtures de usuarios — precedente CP3 §9).
3. **CHECKPOINT prefijos**: la escritura quedó **supervisor+** (para que Omar opere la solapa), la
   letra de tu D4 decía "admin-only". Ratificar o revertir (one-liner en la 031/migración nueva).
4. **Formulario Dow**: leer PT+ES, completar preguntas 8/9/40/41, resolver la **contradicción** del
   material de apoyo (los PDFs/HTML de caso-negocio siguen con framing "sistema funcionando" — pregunta
   44 los ofrece) y el **caveat ZIM**; corregir rótulo 2025→2026 en la hoja 2026 de tu planilla COSTOS.
   PDFs del formulario recién con tu OK explícito.
5. Aprobar/rechazar en Admin → Solicitudes: `operez@ssbint.com`, `jsrojas@ssbint.com`.
6. MOTOR↔NAVIERA con factura real (expo) + primera liquidación real de impo (valida regla inclusiva
   destino y regla de relojes D2). ERD (espera tu referencia). Sandbox `gate-019-sandbox` (~USD 10/mes) si vive.

### De dev (deuda anotada M5 — no bloquea)
7. Importador de Excel de tarifas con diff contra vigente (Admin).
8. Envío automático del reporte Omar martes/jueves (n8n) + notificación email de no_reforzado (n8n).
9. Integración bookings EDI 301 (`public.bookings_301`) ↔ `crm.bookings`.
10. Reefer y hubs: datos seedeados, motor no los consume (parametrización futura).
11. Orden impo con `creadas=0` queda vacía (espejo tanda) — falta RPC de anulación de orden/edición
    de encabezado ("falta la RPC", nunca write directo). Ficha impo propia (hoy click → /importacion).
12. Verificación visual en navegador de las 4 pantallas nuevas (agent-browser; MCP browsers rotos en WSL).

## Lecciones
- **El gate independiente paga**: el único P1 de la sesión fue del orquestador (B8.1), no de los workers.
- Agente colgado por watchdog en verify largo → **resume con instrucciones quirúrgicas** (auditar qué
  entró por catálogo, no re-ejecutar a ciegas) recuperó la 032 sin pérdida.
- **Grants fantasma**: default-ACL retirado deja grants emitidos sin revocar — auditar
  `role_table_grants` contra la lista sancionada tras cambios de infra (033 lo barrió).
- PostgREST devuelve `400 PGRST204` antes del chequeo de permisos si el payload no matchea columnas —
  un test de seguridad REST necesita payloads con columnas reales.

## Docs de la sesión
`docs/M5-PLAN-MAESTRO.md` (plan + resoluciones D1–D7) · `PLAN-M5-IMPO-BOOKINGS-MULTIREGION.md`
(input de John) · migraciones `crm-v2/supabase/migrations/026–034` · seeds `supabase/seeds-ayuda/`
· formulario `Dow-Summit-2026-Respuestas-Formulario{,-ES}.md`
