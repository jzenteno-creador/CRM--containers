# VEREDICTO — Verificación independiente post-carga M6 · CRM Detention
Verificador: agente independiente (no participó de la carga) · 2026-07-18 · Proyecto Supabase `cctuowthpnstvdgjuomq`, schema `crm` · Solo SELECT ejecutado contra la DB viva.

## PASS/FAIL por verificación

| # | Verificación | Resultado |
|---|---|---|
| 1 | Conteos + 37 activas una a una | **PASS** — todos los asserts exactos |
| 2 | Match de costos 2025/2026 | **PASS con hallazgos** — motor validado; diferencias 100% atribuidas con evidencia a nivel fila |
| 3 | Spot-check 10 filas | **PASS** — campo a campo coherente; 2 diferencias de costo son dato, no error de carga |
| 4 | Reportes espejo | **GENERADOS** (general 2.959 filas, vencidos, próximos, vacíos) |
| 5 | Este resumen | — |

## 1 · Conteos (todos ejecutados contra la DB)

operaciones=2.959 ✓ · cerradas=2.922 ✓ · activas=37 ✓ · contenedores=2.959 (números únicos: 2.959) ✓ · operacion_eventos=0 ✓ · retiro_de_id NULL=5 ✓ · retiros AR 2025=1.728 / 2026=1.231 / otros=0 ✓ · tipo_cierre embarcado=2.903 / devuelto_vacio=19 / pendiente=37 ✓.
Las 37 activas cotejadas UNA A UNA contra `activas_para_revision_john`: 37/37 con estado `en_transito_a_terminal`, `fecha_devolucion` NULL y fecha de retiro idéntica. Cero sobrantes en DB.

## 2 · Match de costos (detalle completo en `match-costos-2025.md`)

Convención descubierta y verificada: **el motor y el Excel de Omar agrupan por mes de DEVOLUCIÓN** (las vistas `vista_kpi_tendencia_mensual` y `vista_kpi_costo_naviera` usan `fecha_devolucion` en zona AR; empíricamente feb/abr/may/jun-2026 dan diferencia $0 exacta con esa agrupación, y por retiro no matchea ningún mes).

### Tabla condensada (por devolución, USD)

| Naviera | Año | Sistema | Excel | Dif | Lectura |
|---|---|--:|--:|--:|---|
| MAERSK | 2025 | 116.340 | 192.469 | −76.129 | Excel ene–jul −89.674 fuera de ventana de carga; ago–dic comparable: **+13.545** (+13,2%) |
| HAPAG | 2025 | 8.925 | 14.450 | −5.525 | feb+jul −5.525 fuera de ventana; ago–dic comparable: **0 exacto** |
| CMA CGM | 2025 | 22.350 | 89.825 | −67.475 | mar–jul −76.975 fuera de ventana; ago–dic comparable: **+9.500** (+73,9%) |
| MAERSK | 2026 | 465.395 | 455.560 | +9.835 | ene–jun: **+385** (+0,08%); jul +9.450 aún no volcado por Omar |
| HAPAG | 2026 | 8.275 | 7.675 | +600 | ene–jun: **0 exacto**; jul +600 aún no volcado |
| CMA CGM | 2026 | 0 | 0 | 0 | Sin operaciones CMA 2026 en el control (hallazgo conocido del Excel) |

Operaciones cerradas sin costo calculable por tarifa/freetime faltante: **0 de 2.922** — el motor cubre el 100%.

### Match a nivel FILA (la prueba fuerte)

Costo del sistema vs costo calculado a mano por Omar, operación por operación (2.922 cerradas):
- **2.798 filas (95,8%) EXACTAS al centavo.**
- 116 filas CMA CGM 2025: **+9.500** — Omar usó 18 días libres en TODAS las CMA 2025 (634 filas); el sistema aplica 14 (freetime CMA/ARGENTINA vigente desde 2025-05-01). Explica el 100% del desvío CMA.
- 8 filas MAERSK: **+15.015** — contenedores `devuelto_vacio`: Omar les pone costo 0 (o «-»); el sistema calcula la detention por estadía real (ej.: HASU4904147, 123 días de estadía, sistema USD 3.815, Excel 0). Explica el desvío MAERSK 2025 (+13.650 en devoluciones 2025, −105 de corrimiento semana/mes del reporte SEMANAL) y el +280 de ene-2026.

**No se ajustó nada**: las diferencias quedan reportadas tal cual.

## 3 · Spot-check (detalle en `spot-check.md`)

10 filas: 4 MAERSK / 2 CMA / 3 HAPAG / 1 ZIM · 1 activa (MRSU6066233) · 2 retiro_de sin catálogo (TCLU5892700 «TERMINAL 4/ABBOTT», CAAU6975564 «TERMINAL EXOLGAN» — ambas con `retiro_de_id` NULL y texto crudo preservado, correcto) · 5 de 2025 y 5 de 2026 · 2 devueltos vacíos. Naviera, fechas AR, estado, tipo_cierre y estado_carga: **10/10 coinciden**. Costos: 8/10 exactos; los 2 distintos son los patrones ya descriptos (días libres CMA, devuelto vacío).

## Hallazgos por importancia

1. **[DECISIÓN DE NEGOCIO] Días libres CMA CGM 2025: 18 (Omar) vs 14 (sistema) → USD +9.500 en 116 ops.** Si CMA otorgaba 18 días en esa época, falta una versión de freetime con `vigente_hasta` (hoy solo existe 14 días desde 2025-05-01); si lo contractual era 14, el Excel de Omar sub-reportó 9.500. El sistema hoy re-liquida esas 116 ops con 14.
2. **[DECISIÓN DE NEGOCIO] Devueltos vacíos: el sistema computa detention (USD 15.540 en 11 de 19 ops), Omar los deja en 0.** Si la práctica real es que esa detention no se paga (o se reclama), esas ops necesitan `sin_cargo`/waiver vía RPC — hoy inflan el costo realizado del sistema vs lo pagado.
3. **El Excel 2025 tiene USD 172.174 (ene–jul) de operaciones devueltas antes de ago-2025 que NO están en la carga** (el control 2025-2026 arranca en retiros may-2025 / devoluciones ago-2025). Cualquier comparación anual 2025 sistema-vs-Excel va a dar "faltante" por alcance de la fuente, no por error del motor. Dejarlo anotado para el caso de negocio.
4. **Jul-2026: el sistema ya registra USD 10.050 realizados** (9.450 MAERSK + 600 HAPAG) que el reporte semanal de Omar aún no refleja al corte 18-jul. Diferencia de rezago, no de cálculo.
5. **Alertas activas al corte: 22 ROJAS** (freetime vencido, costo proyectado USD 6.055 creciendo USD 770/día), 6 amarillas (1 día restante), 9 verdes. Umbral amarillo configurado: 5 días.
6. **ZIM LINES: 2 ops con freetime del sistema 14 días/USD 25 vs 7 días según Omar** — sin impacto (estadía 4 días, costo 0 en ambos), pero la tarifa ZIM del catálogo no coincide con la que usa Omar. Consistente con el caveat ZIM abierto del deck.
7. 5 ops con `retiro_de_id` NULL coinciden exactamente con los `depositos_sin_match` del reporte (TERMINAL EXOLGAN ×4, TERMINAL 4/ABBOTT ×1). Falta alta de catálogo si se quieren filtrables.
8. Menor: 1 fila con costo «-» en el Excel (MRKU4955835) parseada como 0 — sin efecto material (dif ya contada en devueltos vacíos).

## Veredicto final

**La carga M6 es fiel al Excel de Omar y el motor de costos queda validado contra 2.922 liquidaciones manuales reales: 95,8% de match exacto al centavo, y el 4,2% restante se explica por dos reglas de negocio divergentes (días libres CMA 2025 y devueltos vacíos), no por bugs de motor ni errores de carga.** Las diferencias anuales grandes de 2025 (−149K por devolución) son un artefacto del alcance de la fuente cargada (ene–jul 2025 no existe en el control), no del sistema. Quedan dos decisiones de negocio para John (hallazgos 1 y 2) antes de presentar el costo 2025 del sistema como cifra oficial.
