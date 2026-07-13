# HANDOFF · M4 Cierre B1+B2 · 2026-07-13

> **DEPLOYADO. La 020 en prod. La 021 gateada y esperando GO. Smoke visual: John.**

## HECHO (orden 0→4, todos los gates en PASS)

0. **Excepción de maestros ACLARADA y SANCIONADA**: el front escribe directo en 5 tablas
   (navieras, plantas, configuracion, incidencias, incidencia_fotos) — NINGUNA de plata
   (cero writes sobre operaciones/freetime_origin/contenedores, grep exhaustivo). Regla
   explícita escrita en `crm-v2/AGENTS.md` — un PASS de verifier no crea excepciones.
1. **021 escrita y GATEADA (NO aplicada)** — waiver ACUMULATIVO (decisión b de John):
   tabla `operacion_waivers` (cada waiver = registro auditado, anulable individualmente,
   sup+), guard total ≤ exceso con mensaje legible, misma firma de RPC (UI compatible),
   views con la columna `waiver_dias` = total vigente, migración de datos sin cambiar
   números (checksum idéntico sobre 2.804). El gate encontró **1 defecto bloqueante mío**
   (CREATE OR REPLACE no puede cambiar void→uuid) — corregido en el archivo; la versión
   corregida es byte-equivalente a la que el gate ejercitó.
2. **020 APLICADA A PROD** (`m4_020_b2_correccion_cerradas`) + post-verificación
   **golden-independiente** (el correctivo comprometido): fecha mal cargada → corrección
   → **77 días / 2205.00 exactos contra valores PRE-COMPUTADOS del Excel** (mismatch
   1960→2205 documentado antes de corregir; transacción abortada, prod sin residuo).
3. **11 commits granulares** en `v2-rebuild` (e886ae1…e306791): docs · spec fix ·
   019/020/021 · 5 features de front · regla AGENTS.md. Working tree limpio salvo tus
   3 archivos de negocio untracked (decisión tuya, intactos).
4. **DEPLOY a producción** — build limpio en Vercel, crm-detention.vercel.app en 200.

## PRESUPUESTO — cumplido, con un hallazgo sistémico

Total del run ≈ **217k de 250k** (checkpoints reportados en 50k y 207k). **Hallazgo:**
el techo de 60k del verifier volvió a fallar — consumió **157k reales y su auto-estimación
dijo 50-55k**. Los agentes no ven su consumo real: los techos por prompt son inexigibles.
**Correctivo para futuros runs: la contención es achicar el ALCANCE de cada agente
(tareas más chicas, menos archivos), no declarar techos.** Queda como regla operativa.

## ESPERA TU GO / ACCIÓN

1. **Smoke visual en prod** (campana solo-rojos, tanda fila-por-fila, plantas CRUD,
   tarifas con convención, waiver y corrección en la ficha) — la verificación visual
   NO está hecha por diseño del bloque.
2. **Aplicar la 021** (próximo run): va OBLIGATORIO con la UI de historial de waivers +
   actualización del aviso del modal ("reemplaza" → "suma") + re-gate del archivo
   corregido (el verifier no re-corrió el archivo final dos veces seguidas — caveat
   declarado en su autocrítica).
3. `git push origin v2-rebuild` cuando quieras respaldar los 11 commits en el remoto
   (no pusheé: tu regla de deploy manual me hace preferir tu GO también acá).

## RECORDATORIOS

- **Sandbox `gate-019-sandbox` (`gnygffoynwtxpkehmxal`)**: si no lo borraste del
  Dashboard, sigue facturando ~USD 10/mes.
- ⚠️ **MOTOR↔NAVIERA sigue abierto**: falta cruzar UNA liquidación real de detention
  contra una operación cerrada del histórico. El Excel valida contra sí mismo — el
  off-by-one heredado sería invisible. El insumo (la factura) es tuyo.
- Pendientes M4 restantes según el plan aprobado: F2 (admin configurable UI + reset
  demo) · F3 (ayuda M10 + tooltips) · F4 (UX) · F5 (ERD + CP3 con gate de cálculo).
