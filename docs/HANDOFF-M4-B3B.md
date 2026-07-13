# HANDOFF · M4 Bloque 3-B (Ayuda + tooltips / M10 · F3) · 2026-07-13

> **Todo escrito, gateado y commiteado. Migración 024 esperando GO. Front sin deploy
> (espera GO). Un solo ítem, como se pidió.**

## HECHO

### Migración 024 (escrita, gateada, commiteada, NO aplicada)
- **Seeds de ayuda m3-m9** REESCRITOS contra el estado real 2026-07-13 (no se aplicó copy
  viejo): m3 (retiro_de ahora es catálogo de depósitos), m5 (ficha con **waiver
  bruto/absorbido/neto** + historial + **corrección de cerradas F-02**), m9 (plantas ya
  **CRUD** no solo-lectura + sección **depósitos** + **editor de ayuda** + tarifas con
  **convención/cobra**), m6 (el "3" del umbral **sacado del copy** → genérico). m4/m7/m8
  van tal cual (flujos sin cambios; sus números son de render, no de negocio).
- **Nivel `campo`** en ayuda_contenido (nivel/clave) + **13 tooltips** con prioridad a las
  fechas. Los números (días libres, tarifa, umbral, convención) se **interpolan** vía
  `crm_ayuda_valores(naviera)` — **las frases vienen compuestas desde la DB** (número real
  o genérico sin naviera), el front solo sustituye strings. **Cero número hardcodeado.**

### Front (build + lint limpios, commiteado, NO deployado)
- `<FieldHelp>` (on-hover/focus, aria, degrada a nada si 024 no aplicada) + helper único de
  interpolación `interpolarAyuda()`. Wire en los campos de fecha + naviera/retiro_de/waiver/
  umbral/convención con las claves exactas de la 024.
- Ruta **/ayuda** (banco de consultas + buscador + deep-link + empty states), botón **"?"**
  por solapa (trae la ayuda de la sección activa), **editor de Ayuda en Admin** (§15.4:
  edita el copy sin código, vista previa, despublicar-no-borrar).

## GATE (VERIFIER independiente)
- **TAREA A (024 en harness):** 4/5 PASS + **1 bug real cazado** → `crm_ayuda_valores(null)`
  (sin naviera) explotaba (`record no asignado`). **Corregido** (record → escalares) y
  **verificado en prod-rollback**: sin naviera degrada a genérico sin error; con MAERSK
  devuelve "14 días libres" / "35.00 USD/día" (números reales). Idempotente (2 runs OK).
- **TAREA B — la pregunta única del brief:** **0 números de negocio hardcodeados** (PASS).
  Grep sobre seeds + los 15 archivos de front: todo va por `{{...}}` o sale de filas DB.
  Los `20DC`, `1 y 30`, `8 MB`, etc. son límites de UI, no de negocio.

## PRÓXIMO PASO (tuyo)
1. **GO para aplicar 024** → `apply_migration`. Trae los seeds de las 7 solapas + los
   tooltips + `crm_ayuda_valores`.
2. **GO para deployar** el front (commiteado/pusheado `85cab08`, sin deploy).
3. **Smoke visual** (recomendado por el verifier): el hover del tooltip de **umbral** en
   `/admin/configuracion` (que era el que fugaba el placeholder antes del fix), el tooltip
   de **fecha de retiro** en `/ingreso` con una naviera elegida (debe mostrar los días
   libres y la tarifa reales), y el layout del editor de Ayuda en Admin.

## RECORDATORIOS
- ⚠️ **MOTOR↔NAVIERA sigue abierto** — falta la liquidación real de una naviera.
- **Sandbox `gate-019-sandbox` (`gnygffoynwtxpkehmxal`)**: borralo del Dashboard si vive.
- **Bloque 4 / próximos:** ERD (falta tu referencia visual) · reporting a Excel · combobox
  tipeable en el resto de los selects (el `<ComboboxCreatable>` de B3-A es la base) ·
  sidebar colapsable persistente.

## Presupuesto
Constructor 210k + Verifier 118k + LEAD ≈ 350k (un ítem). El patrón se sostiene: 1 ítem
grande = 1 run. El gate atrapó el bug del path sin-naviera antes de prod — valió el run.
