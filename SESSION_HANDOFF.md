# Handoff de sesión — 2026-07-13 · CRM Detention v2 · rama v2-rebuild

## Resumen
Sesión de **CP3** (gate previo al cutover). CP3 cerró FAIL por un hueco P1 (operador reescribía
campos de plata por PATCH crudo, salteando RPC + auditoría). Se auditó, se reprodujo el hueco en un
Postgres embebido local, se corrió un **bake-off de 3 fixes** (ganó C), se gateó, y se **APLICÓ el fix
a prod (migración 025) + verificó**. 3 verifiers independientes (Sonnet) en PASS. Además: se recuperó
el acceso admin de John (flujo de recovery) y se diagnosticó un bug del recovery.

## ✅ HECHO
- **025 aplicada y verificada en prod** (`docs/GATE-025.md`, `docs/FIX-P1-BAKEOFF.md`,
  `crm-v2/supabase/migrations/025_fix_p1_rpc_executor.sql`, registrada `20260713160000`):
  REVOKE write directo de `authenticated` sobre operaciones/movimientos/contenedores + 6 RPCs
  operativas a SECURITY DEFINER owner=`crm_rpc_executor` (sin BYPASSRLS → RLS sigue scopeando).
  Post-apply: anon 401 en vivo (20 objetos), aritmética exacta (goldens), único ERROR advisor =
  `usuarios_publicos` (excepción DEFINER documentada en AGENTS.md).
- **DB en cero** (reset demo) + **cuenta de test borrada** (0/0).
- **AGENTS.md**: supervisores globales + excepción usuarios_publicos documentadas.
- Las 4 RPCs pre-existentes DEFINER owner=postgres → auditadas, **no hace falta 026**
  (`docs/AUDIT-4-DEFINER-RPCS.md`): deben ser definer (escriben tablas sin write-policy), guards de rol OK.
- **Acceso admin de John recuperado** + **password de admin fijada** (John la actualizó en
  /auth/actualizar-password, 2026-07-13).

## ⏳ PENDIENTE

### De John (acciones)
1. **Aprobar/rechazar 2 registros reales pendientes** en Admin → Solicitudes: `operez@ssbint.com` (Omar
   Perez) y `jsrojas@ssbint.com`.
3. **Smoke del fix** (ya está logueado): cargar una tanda / mover / cerrar → confirma en vivo que las 6
   RPCs andan end-to-end (lo único que quedó verificado estructuralmente, no en vivo, por diseño).
4. **MOTOR↔NAVIERA** (deuda abierta): cruzar una liquidación real de naviera contra una cerrada del
   histórico. Insumo (la factura) es de John.
5. **ERD**: sigue esperando su referencia visual.
6. **Sandbox `gate-019-sandbox` (`gnygffoynwtxpkehmxal`)**: si vive, ~USD 10/mes — borrarlo del Dashboard.

### De dev (para cerrar / deployar)
7. **Bug del flujo de recovery (front)**: el link de reset (o el "Send password recovery" del Dashboard,
   que redirige al Site URL raíz) **loguea al usuario en vez de mandarlo al form de cambio de password**.
   Fix: handler del evento `PASSWORD_RECOVERY` de Supabase → rutea a `/auth/actualizar-password`. Va con deploy.
8. **SMTP propio** (opcional, raíz del "el mail de reset no llega/es poco confiable"): el proyecto usa el
   email default de Supabase (rate-limit + entrega pobre). Configurar en Authentication → Emails.
9. **Cleanup opcional**: revocar `contenedores:UPDATE` de authenticated (vestigial, hoy RLS-bloqueado al 100%).

## Lecciones (en memoria)
- Todo pilar arquitectónico se prueba contra la DB o no existe ([[regla-probar-pilares-contra-db]]).
- "Cero DDL" es sobre prod, no sobre el harness local propio.
- Diferencias prod-vs-harness reales: en Supabase `postgres` NO es superusuario → el `alter function owner`
  exige membresía en el rol destino + CREATE en el schema (el harness superusuario no lo modelaba).

## Docs de la sesión
`docs/CP3-VERIFY.md` · `docs/FIX-P1-BAKEOFF.md` · `docs/GATE-025.md` · `docs/AUDIT-4-DEFINER-RPCS.md`
· `docs/fix-p1/025_fix_p1_rpc_executor.sql` · harness en `scratchpad/cp3/harness/` (efímero).
