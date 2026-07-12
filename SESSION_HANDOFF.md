# Handoff de sesión — 2026-07-12 (sesión 12: M3 Ingreso → EN PRODUCCIÓN, E2E verificado)

**Rama:** `v2-rebuild` (M3 mergeado, +commits de /ingreso). `master` intacta (v1).
**Estado macro: M3 (/ingreso) EN PRODUCCIÓN y verificado E2E.** `crm-detention.vercel.app/ingreso` funcional. DB en cero (sin data real todavía).

---

## 🟢 QUÉ HAY EN PROD

- **URL:** https://crm-detention.vercel.app/ingreso · **deployment:** `crm-detention-gw1edbwil` (READY). Rollback: `adjf8w138`.
- **/ingreso** — dos fases, front-end puro sobre RPCs de M1 (cero DDL):
  - Fase 1 (tanda de retiro): encabezado único + paste de contenedores (ISO 6346 por fila) + reforzado default true + toggle "confirmar ingreso ahora" (nativo) → `crm_crear_tanda_retiro`.
  - Fase 2 (pendientes): SELECT directo sobre `crm.operaciones` (no RPC, no view) con planta destino, selección múltiple → `crm_confirmar_ingreso_planta`.

## HECHO (sesión 12)

- **M3 completo, E2E verificado en prod** (supervisor de test creado y borrado el mismo turno). M1–M9 todos PASS: tanda crea N ops en 1 submit ({creadas:3}), confirmación en lote ({confirmadas:3}), toggle nace en_planta, ISO inválido marcado, ciclo abierto → FormAlert literal, consola 0·406/401/404, cleanup DB=0/auth=1 (verificado con body por el orquestador, no solo por el agente).
- Planta destino agregada al listado de fase 2 (embed `movimientos_planta→plantas` desambiguado por constraint — hay 2 FK a plantas).
- Sidebar reactivó `/ingreso` solo (flag `ROUTE_BUILT`).

## HALLAZGOS (elevados)

- **H1 — `crm_crear_tanda_retiro`: 1 colisión tumba la tanda entera.** La RPC es 1 transacción plpgsql; el handler de `unique_violation` hace `raise` (no continue) → 1 contenedor con ciclo abierto revierte los N, y nombra solo 1. Sumado al punto ciego del pre-check (SECURITY INVOKER → RLS-scoped, no ve ciclos abiertos en otras plantas), el peor caso son N rechazos completos. **Fix = helper SECURITY DEFINER (DDL) = backend, fuera de M3.** Detalle en `.claude/state/progress.md`. Candidato a fix de RPC antes de producción intensiva de ingresos.

## PRÓXIMO PASO

- **John smokea /ingreso** con su cuenta admin (carga una tanda real) — sobre algo ya verificado E2E. Al ser admin, el select de planta es libre.
- **M4 (Egreso)** en sesión nueva: `crm_registrar_salida_planta` (embarcado/devuelto_vacio) + `crm_confirmar_devolucion`. La asignación (`orden`/`shp` obligatorios; booking/buque/destino opcionales) se pliega ahí vía `p_asignacion` — no hay estado `cargado`. TIER: build estándar.
- Considerar H1 (fix de RPC) antes de que se carguen ingresos en volumen.

## Contexto no obvio (persiste)

- Deploy v2 = proyecto Vercel `crm-detention` (`crm-v2/.vercel/`). `cd crm-v2 && npx vercel deploy --prod --yes`.
- Regla §21: v2 escribe SOLO en schema `crm`. `detention` READ-ONLY. Cero DDL fue el contrato de M3.
- Usuarios de test por SQL: token-cols en `''` (no NULL), dominio `.invalid` (no ruteable, NO Mailinator), rol supervisor (NO admin — lección sesión 11), borrar en el mismo turno.
- Crear usuarios en prod requiere autorización explícita de John (el clasificador de permisos lo bloquea por default).
- `crm-v2/supabase/seeds-ayuda/m3_ingreso.sql` — seed de ayuda preparado por el ui-builder, NO aplicado (contenido de M10). Untracked.
- 3 untracked de negocio sin decidir (PDF/HTML → Drive; HANDOFF-cross → repo ssb-workspace).
