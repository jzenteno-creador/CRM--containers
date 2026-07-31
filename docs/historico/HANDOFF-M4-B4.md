# HANDOFF · M4 Bloque 4 (Reporting Excel + Combobox global + Sidebar) · 2026-07-13

> **Tres ítems de UX completos, commiteados y pusheados. SIN DDL. Front sin deploy
> (espera GO). Un solo bloque, como se pidió. ERD sigue afuera (falta tu referencia visual).**

## HECHO (build + lint limpios, verificado)

### 1 · Reporting → Excel (`/reportes`)
- **Sin DDL, sin front-calc** (confirmado por el VERIFIER): los campos descriptivos y de
  filtro (incl. **depósito** y **tipo_cierre**, que no están en las views) se leen de
  `operaciones` vía embeds de PostgREST; los **tres números del waiver**
  (bruto/absorbido/neto) + días/tarifa se traen **ya calculados** de `vista_alertas`
  (abiertas) / `vista_kpi_costos_cerradas` (cerradas) y se mergean por `operacion_id`.
  Copiar un número de una view y unir por clave **no es cálculo**.
- Filtros: rango de fechas (fecha_retiro, límites de día AR), naviera, planta, estado,
  depósito, tipo_cierre. **Selector de columnas** (checkboxes). Export **SheetJS** en
  cliente (`reporte_YYYY-MM-DD.xlsx`). **Scope por rol** = la RLS (comentado, sin re-filtro).
- Dep nueva: `xlsx` (write-only en cliente; los CVE de xlsx son de PARSEO — no aplican).

### 2 · Combobox en el resto de los Select (7 migrados, filter-only)
- naviera ×2 (ingreso, tarifas) · planta ×3 (ingreso, solicitudes, mover-ficha) · depósito
  origen/destino de la fusión. Todos **sin creación inline** (tipear→match→flechas). La
  creación inline queda SOLO en depósitos /ingreso (verificado: un único `onCreate` en todo `src/`).
- Los enums fijos (tipo contenedor, medio, tipo cierre, rol, régimen, filtros de estado/
  semáforo) **quedan Select** — combo ahí es ruido.
- **⚠️ Cambio en componente compartido `modal.tsx`**: `overflow:hidden → visible` para que
  el dropdown del combobox no se recorte dentro de los modales (fusión, solicitudes, mover).
  **NO verificado visualmente** — smoke de las esquinas de los modales (sobre todo
  `ConfirmDialog`) queda de tu lado.

### 3 · Sidebar colapsable (cookie SSR-safe)
- Botón expandir/colapsar al fondo del rail. Estado en **cookie `fd_sidebar`** leída
  server-side (`await cookies()`, Next 16 async) → el rail nace en el ancho correcto, cero
  flash. Default colapsado (look actual). Variante expandida ~200px, solo desktop (>900px).
  Las rutas `(app)` pasan a dynamic (`ƒ`) — esperado por el uso de cookies.

## GATE (VERIFIER independiente, 2 preguntas del brief)
- **(a) ¿El export calcula algo en el front?** → **PASS, 0 cálculos.** Los números se copian
  crudos de las views; solo se formatean (fecha con fmtFechaDia, estado→label). `fmtUSD` que
  redondea se usa SOLO en el preview, nunca en el xlsx. Sin `Math.`/`reduce`-suma/aritmética
  sobre datos de negocio.
- **(b) ¿Creación inline donde no corresponde?** → **PASS.** Un único `onCreate` en `src/`
  (depósito en /ingreso). Los 7 comboboxes migrados + los 3 filtros de reportes no ofrecen crear.

## PRÓXIMO PASO (tuyo)
1. **GO para deployar** (commiteado/pusheado `de6ad58`, sin deploy).
2. **Smoke visual** (recomendado): (a) el export real de un `.xlsx` desde `/reportes` con
   filtros; (b) las esquinas de los modales tras el cambio de `overflow` (el `ConfirmDialog`
   sobre todo); (c) el rail expandido y su persistencia al recargar.

## RECORDATORIOS
- ⚠️ **MOTOR↔NAVIERA sigue abierto** — falta la liquidación real de una naviera. Es lo único
  que valida el motor contra la contraparte; hoy el Excel se valida contra sí mismo.
- **ERD** — sigue esperando **tu referencia visual** para arrancar.
- **Sandbox `gate-019-sandbox` (`gnygffoynwtxpkehmxal`)**: borralo del Dashboard si vive.
- Sugerencia declarada (no forzada): una `vista_reporte` dedicada uniría open+closed con
  todos los campos en una sola fuente y simplificaría el reporte — es DDL para un GO futuro,
  no se hizo para respetar el "sin DDL" de este bloque.
