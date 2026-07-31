# HANDOFF · M4 Bloque 3 (PARCIAL — STOP por presupuesto) · 2026-07-13

> **Paros 1-2 completos y en prod. Pasos 3-4 NO arrancados: se reventó el techo de 250k.**

## HECHO (pasos 1-2 del bloque)

1. **Push** de los 12 commits del cierre B1+B2 a `origin/v2-rebuild` (`983d491..d430324`). ✓
2. **021 (waiver acumulativo) APLICADA a prod** (`m4_021_waiver_acumulativo`):
   - Re-gate: byte-equivalencia del fix void→uuid confirmada (drop+create ≡ lo testeado);
     aplicación atómica limpia. Prod PG 17.6.
   - Estructura verificada: tabla `operacion_waivers`, 4 funciones nuevas,
     `crm_registrar_waiver` ahora `returns uuid`, CHECK legacy dropeado, 1 waiver migrado
     (el de la op anulada de test `cb03` — invisible en views).
   - **Post-verificación golden-independiente (VERIFIER, en prod-rollback): PASS.**
     Caso `muestra-MRSU5124675`: dos waivers 3+2 = **5 absorbidos (no 2)**, contra
     valores del Excel (bruto 2205, exceso 63); absorbido 175, neto 2030. Guard de
     exceso, anulación individual (w1 sobrevive a la anulación de w2), y no-persistencia:
     todo verde.
   - **UI de historial de waivers** (`contenedores/[id]/acciones.tsx` + `page.tsx`):
     lista por registro (días/motivo/referencia/quién/cuándo/estado), anulación individual
     sup+ vía `crm_anular_waiver`, modal de registro ahora dice "suma al acumulado". Los 3
     números (bruto/absorbido/neto) desde las views. Build + lint limpios.
   - **Commiteado y pusheado** (`d430324..13478bf`).

## ESCRITO PERO NO APLICADO (paso 3 parcial)

- **Migración 022 — reset demo** (`crm-v2/supabase/migrations/022_m4_reset_demo.sql`,
  commiteada): RPC `crm_reset_demo(p_confirmacion)` con triple guard (admin activo +
  `configuracion.modo_demo=true` + `p_confirmacion='RESET DEMO'`) + guard de render por
  env var en el front. Borra datos operativos de `crm.*` en orden FK-seguro (incluye
  `operacion_waivers`), preserva semillas + usuarios (cero huérfanos auth.users por
  construcción), auditoría en `configuracion.ultimo_reset_demo`. Incluye policy DELETE
  de admin en el bucket. **NO gateada, NO aplicada** — quedó cortada por el STOP.

## NO ARRANCADO (STOP por presupuesto)

- **Paso 3 · Admin configurable (F2)** — UI para constantes (a) versionado / (b) mutable,
  el botón de reset demo, y la clasificación explícita de lo (c)-que-debería-ser-(b).
  **Prep hecha (LEAD):** (a) ya está cubierto por `/admin/tarifas` (convención/cobra/tarifa
  versionadas desde B2 — nada nuevo que construir). (b) seguro y de alto valor: catálogo de
  **depósitos** (`retiro_de` es texto libre hoy → typos; es config sin CHECK que dropear).
  **A decidir por John (no lo hice silencioso):** `tipos_contenedor` y `medios` son
  configurables en principio pero requieren DROPEAR CHECKs de `contenedores`/
  `movimientos_planta` (tablas de plata) + mover la validación — DDL de más riesgo, va con
  tu GO, no lo toqué.
- **Paso 4 · Ayuda M10 + tooltips (F3)** — migración seeds m3-m9, ruta /ayuda, editor de
  ayuda en Admin (§15.4), FieldHelp con interpolación. **Prep hecha (LEAD):** revisé los 8
  seeds — **ninguno dice "día 0"** (m6_alertas dice "el día del retiro cuenta", correcto);
  la migración de seeds puede aplicarlos casi como están. Nada arrancado.

## EL PROBLEMA SISTÉMICO — presupuesto vs alcance del bloque

Consumo real del turno ≈ **340k+ contra el techo de 250k**, ya en los pasos 1-2:
- VERIFIER golden: **109k** (auto-estimó 20k).
- CONSTRUCTOR waiver UI: **174k** (le pedí ~40k).

**El diagnóstico se confirma una tercera vez:** los agentes no ven su consumo real y las
estimaciones propias erran por 3-4x. Achicar el alcance por agente AYUDA (esta vez cada
uno tocó pocos archivos y una tarea) pero **no alcanza**: un solo constructor de UI sobre
2 archivos consumió 174k explorando. La conclusión operativa para el próximo run: **un
bloque de 4 ítems es irrealizable bajo 250k.** Hay que partirlo — 021+UI fue UN run
completo. Admin configurable = otro run. Ayuda = otro. No caben juntos.

## PRÓXIMO PASO (tuyo)

1. **Smoke visual** de la UI de waivers en prod (historial, anular, el modal que ahora
   suma) — NO deployado todavía (los commits están pusheados pero sin `vercel deploy`;
   cero deploy sin tu GO).
2. **GO para deployar** el front del paso 2 (`cd crm-v2 && npx vercel deploy --prod --yes`).
3. **Nuevo run acotado para el paso 3** (Admin configurable + gate/apply del reset 022) y
   otro para el paso 4 (Ayuda). Uno por run — es la única forma de que entren en presupuesto.
4. Decisión sobre `tipos_contenedor`/`medios`: ¿configurables (dropear CHECKs) o quedan fijos?

## RECORDATORIOS

- ⚠️ **MOTOR↔NAVIERA sigue abierto** — falta la liquidación real de una naviera.
- **Bloque 4** = ERD (falta tu referencia visual) + reporting Excel + combobox + sidebar.
- **Sandbox `gate-019-sandbox` (`gnygffoynwtxpkehmxal`)**: borralo del Dashboard si vive
  (factura ~USD 10/mes).
- **Prod tiene 5 operaciones en_planta de tu smoke** (+ 3 anuladas de test) — no las toqué.
  Si querés la DB en cero para la demo, el reset demo (022) es exactamente para eso una vez
  aplicado, o se anulan por RPC.
