# SESSION_HANDOFF — CRM Detention de Contenedores

**Fecha:** 2026-07-03 (sesión 3: cierre pre-demo + datos reales) · **Rama:** master · **Último commit:** `d603bfd`

## 🟢 DEMOSTRABLE EN PRODUCCIÓN

**URL: https://crm-detention.vercel.app** — login: `admin@ssb.demo`/`admin123` · `supervisor@ssb.demo`/`super123` · `operador@ssb.demo`/`opera123`

## A · Datos reales cargados (reemplazan la demo sintética)

- Fuente: `CONTROL DE VACIOS - ACTIVO.xlsx` hoja GENERAL (70 abiertos al 2026-07-03). Las 82 abiertas sintéticas fueron eliminadas; quedan 2804 cerradas del historial real + 70 abiertas reales.
- Mapeo: VACIO→`en_planta` (67), LLENO→`cargado` (3); PRODUCTO/GMID/OBSERVACIONES como columnas nuevas de `operaciones`; 8 contenedores con recirculación real (ya estaban en el maestro).
- **Sanity contra el Excel: 19 vencidos / USD 28.000 proyectado — match EXACTO fila por fila (70/70)**, salvo la única discrepancia conocida: BMOU4172000 (abajo).
- Evidencia lado a lado (Excel | CRM): TCNU4169680 estadía 108/libres 14/costo 3.290 = ✓ · FFAU5636847 95/14/2.835 = ✓ · MRSU4231621 59/14/1.575 = ✓ · HASU5082008 9/14/0 verde = ✓.
- ⚠ Decisiones tomadas con John AFK (validar): (1) **BMOU4172000** (NO REFORZADO, 31d, VENCIDO): el Excel lo tiene en $0 manual → cargado con `sin_cargo=true` replicando el Excel; la alternativa era regla "NO REFORZADO = 0 días libres" (~$775-1.085). (2) Los 3 `BAHIA/ABBOTT` → dos movimientos, planta actual ABBOTT. (3) GENERAL = todo en planta (nada en tránsito).

## B · Freetime reconciliado contra hoja INFORMACION

| Naviera | INFORMACION (vacíos vigente) | CRM antes | CRM ahora |
|---|---|---|---|
| MAERSK | 14 / $35 | 14/$35 ✓ | 14/$35 |
| CMA/MERCOSUL | 18 / $25 | 18/$25 ✓ | 18/$25 |
| **HAPAG** | **14 / $25** | ~~21/$25 desde 2026-07~~ (seed erróneo del xlsx corporativo) | **14/$25** (versión espuria eliminada — nunca aplicó a ninguna op) |
| ZIM | 21 / $25 | 7→21 versionado ✓ | 7 (histórico) → 21 vigente + **sin_uso 0d/$84** (régimen nuevo) |
| MSC | 15 / $50 | 15/$50 ✓ | 15/$50 (revertida versión de prueba E2E) |

- Columna `regimen` (`vacios`/`cargados`/`sin_uso`) en `freetime_origin`; el cálculo de origen usa SOLO `vacios` (o `sin_uso` para devuelto_vacio de ZIM). CARGADOS no se mezcla.
- NO REFORZADO → 0 días: regla NO activada como automática (el único caso real está en $0 manual en el Excel) — pendiente definición de John (ver A).

## C · Dwell separado del costo

- `dias_estadia` (retiro = día 1, zona AR) SIEMPRE presente en `vista_alertas`; `costo_proyectado` null si no hay tarifa aplicable / naviera no cobra, 0 si waiver.
- UI: columna "estadía (días)" en Contenedores (abiertas) y Alertas; semáforo `neutro` (gris) + leyenda "sin cargo de origen"; KPI "estadía promedio (todas)" en dashboard (23,2d, cuenta todas, no solo las con costo).
- Log-In: NO dado de alta. Flag `navieras.cobra_detention_origen` listo (default true en todas) para activarlo a futuro.

## D · Deploy

- **https://crm-detention.vercel.app** (proyecto Vercel `crm-detention`; un deploy accidental creó proyecto "src", ya eliminado). Deploy = `cd crm-detention && npx vercel deploy --prod --yes`.

## E · E2E sobre la URL de producción (evidencia por paso)

| Paso | Resultado en prod |
|---|---|
| Login admin / operador | ✓ dashboard scoped ("planta: BAHIA" sin Admin para operador) |
| Dashboard | YTD USD 461.000 · 19 vencidos · stock 67 · estadía prom 23,2d |
| Tanda de retiro | ISO 6346 **rechazó dígito inválido** en vivo; con número válido: "1 operaciones creadas" |
| Ingreso fase 2 | "1 ingresos confirmados" |
| Egreso embarcado + asignación | "1 salida registrada" con booking/buque/destino/orden/SHP |
| Gate-in | "1 operacion cerrada — freetime cortado"; timeline `retiro→ingreso→carga→egreso→devolucion` verificado en DB |
| Alertas | 19 rojos ordenados, estadía+costo por fila, leyenda con neutro |
| Tarifa versionada | DSV: "versión nueva insertada; la anterior quedó cerrada" (revertida post-test) |
| **Fotos incidencias** | **"1/1 fotos subidas"** → objeto en Storage + URL pública HTTP 200 (borrada post-test) |

Todos los datos de prueba E2E fueron limpiados: prod quedó con los 70 reales + 2804 históricas exactos.

## F · Mobile 375px

- Sin overflow horizontal (bodyW 360 < 375). Nav en una línea deslizable; KPIs 2 columnas; forms 1 columna; botones/nav 44px, checkboxes de tabla 24px, font 16px (sin zoom iOS).
- **Flujo crítico operado a 375px en prod**: pegar contenedor → tanda creada → multi-select fase 2 → ingreso confirmado.

## Gaps / pendientes para John

1. Confirmar las 3 decisiones de A (BMOU4172000 sin_cargo, BAHIA/ABBOTT→ABBOTT, GENERAL=en planta).
2. Regla NO REFORZADO = 0 días libres: ¿automática o waiver caso a caso?
3. ZIM histórico quedó con 7 días (matchea el historial); INFORMACION sugiere 21 desde oct-2023 — ¿el historial usaba otra condición?
4. Password plano + credenciales committeadas: OK para demo, migrar a Supabase Auth si pasa a producción real.
5. Carga masiva (spec §11): sigue diferida a testing.
