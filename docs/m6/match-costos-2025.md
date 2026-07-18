# Match de costos SISTEMA vs EXCEL de Omar — M6

Fecha de verificación: 2026-07-18 · Proyecto Supabase `cctuowthpnstvdgjuomq` · schema `crm` · SOLO SELECT.

## Metodología (qué fecha usa el motor)

- Fuente sistema: `crm.vista_kpi_costos_cerradas` (`costo_realizado` = `costo_neto` del motor: `GREATEST(0, dias_estadia - dias_libres) * tarifa`, convención `retiro_dia_1`, freetime vigente por fecha de retiro, filtro `estado=cerrado AND fecha_devolucion IS NOT NULL`).
- **El motor agrupa por FECHA DE DEVOLUCIÓN**: `vista_kpi_tendencia_mensual` y `vista_kpi_costo_naviera` usan `fecha_devolucion AT TIME ZONE America/Argentina/Buenos_Aires` (verificado con `pg_get_viewdef`). Esa es la agrupación primaria de esta tabla. Se computó también la agrupación por fecha de retiro (secundaria, abajo).
- Query base ejecutada (dump por operación, agregado localmente):
```sql
select c.numero_contenedor, n.nombre, o.fecha_retiro, o.fecha_devolucion, o.estado, k.costo_realizado, ...
from crm.operaciones o
join crm.contenedores c on c.id=o.contenedor_id
join crm.navieras n on n.id=c.naviera_id
left join crm.vista_kpi_costos_cerradas k on k.operacion_id=o.id;
-- fechas convertidas con AT TIME ZONE 'America/Argentina/Buenos_Aires'
```
- Mapeo navieras Excel→DB: HAPAG→HAPAG LLOYD, MAERSK→MAERSK, CMA-CGM→CMA CGM.
- **Ventana de datos cargados**: primer retiro en DB = 2025-05-12; primera devolución = 2025-08-04. El Excel de costos de Omar (Fuente 2) tiene meses ene–jul 2025 con costos de operaciones devueltas ANTES de esa ventana → el sistema da 0 en esos meses por diseño de la carga, no por error del motor.
- Operaciones cerradas SIN costo calculable (tarifa/freetime faltante): **0 de 2.922**. Ninguna naviera tiene huecos de tarifa.

## TABLA PRINCIPAL — 2025 · agrupación por fecha de DEVOLUCIÓN (la del motor)

| Naviera | Mes | Sistema USD | Excel USD | Diferencia | Dif % |
|---|---|--:|--:|--:|--:|
| MAERSK | ene-2025 | 0 | 24,535 | -24,535 | -100.0% |
| MAERSK | feb-2025 | 0 | 8,155 | -8,155 | -100.0% |
| MAERSK | mar-2025 | 0 | 9,016 | -9,016 | -100.0% |
| MAERSK | abr-2025 | 0 | 33,023 | -33,023 | -100.0% |
| MAERSK | may-2025 | 0 | 3,325 | -3,325 | -100.0% |
| MAERSK | jun-2025 | 0 | 9,240 | -9,240 | -100.0% |
| MAERSK | jul-2025 | 0 | 2,380 | -2,380 | -100.0% |
| MAERSK | ago-2025 | 15,050 | 15,155 | -105 | -0.7% |
| MAERSK | sep-2025 | 20,615 | 12,040 | +8,575 | +71.2% |
| MAERSK | oct-2025 | 33,775 | 31,780 | +1,995 | +6.3% |
| MAERSK | nov-2025 | 24,465 | 21,700 | +2,765 | +12.7% |
| MAERSK | dic-2025 | 22,435 | 22,120 | +315 | +1.4% |
| **MAERSK** | **total 2025** | **116,340** | **192,469** | **-76,129** | **-39.6%** |
| HAPAG | feb-2025 | 0 | 1,850 | -1,850 | -100.0% |
| HAPAG | jul-2025 | 0 | 3,675 | -3,675 | -100.0% |
| HAPAG | ago-2025 | 400 | 400 | +0 | +0.0% |
| HAPAG | sep-2025 | 1,400 | 1,400 | +0 | +0.0% |
| HAPAG | oct-2025 | 5,875 | 5,875 | +0 | +0.0% |
| HAPAG | dic-2025 | 1,250 | 1,250 | +0 | +0.0% |
| **HAPAG** | **total 2025** | **8,925** | **14,450** | **-5,525** | **-38.2%** |
| CMA-CGM | mar-2025 | 0 | 7,975 | -7,975 | -100.0% |
| CMA-CGM | abr-2025 | 0 | 58,025 | -58,025 | -100.0% |
| CMA-CGM | may-2025 | 0 | 2,525 | -2,525 | -100.0% |
| CMA-CGM | jun-2025 | 0 | 1,025 | -1,025 | -100.0% |
| CMA-CGM | jul-2025 | 0 | 7,425 | -7,425 | -100.0% |
| CMA-CGM | ago-2025 | 3,150 | 1,800 | +1,350 | +75.0% |
| CMA-CGM | sep-2025 | 4,150 | 1,425 | +2,725 | +191.2% |
| CMA-CGM | oct-2025 | 1,925 | 500 | +1,425 | +285.0% |
| CMA-CGM | nov-2025 | 4,750 | 1,550 | +3,200 | +206.5% |
| CMA-CGM | dic-2025 | 8,375 | 7,575 | +800 | +10.6% |
| **CMA-CGM** | **total 2025** | **22,350** | **89,825** | **-67,475** | **-75.1%** |
| **TOTAL** | **2025** | **147,615** | **296,744** | **-149,129** | **-50.3%** |

## INFORMATIVO — 2026 · agrupación por fecha de DEVOLUCIÓN (la del motor)

| Naviera | Mes | Sistema USD | Excel USD | Diferencia | Dif % |
|---|---|--:|--:|--:|--:|
| MAERSK | ene-2026 | 52,255 | 51,975 | +280 | +0.5% |
| MAERSK | feb-2026 | 31,780 | 31,780 | +0 | +0.0% |
| MAERSK | mar-2026 | 53,410 | 53,305 | +105 | +0.2% |
| MAERSK | abr-2026 | 117,355 | 117,355 | +0 | +0.0% |
| MAERSK | may-2026 | 105,000 | 105,000 | +0 | +0.0% |
| MAERSK | jun-2026 | 96,145 | 96,145 | +0 | +0.0% |
| MAERSK | jul-2026 | 9,450 | 0 | +9,450 | n/a |
| **MAERSK** | **total 2026** | **465,395** | **455,560** | **+9,835** | **+2.2%** |
| HAPAG | ene-2026 | 5,775 | 5,775 | +0 | +0.0% |
| HAPAG | feb-2026 | 1,375 | 1,375 | +0 | +0.0% |
| HAPAG | mar-2026 | 425 | 425 | +0 | +0.0% |
| HAPAG | jun-2026 | 100 | 100 | +0 | +0.0% |
| HAPAG | jul-2026 | 600 | 0 | +600 | n/a |
| **HAPAG** | **total 2026** | **8,275** | **7,675** | **+600** | **+7.8%** |
| **CMA-CGM** | **total 2026** | **0** | **0** | **+0** | **0%** |
| **TOTAL** | **2026** | **473,670** | **463,235** | **+10,435** | **+2.3%** |

## Ventana comparable (ambas fuentes con datos)

| Segmento | Sistema USD | Excel USD | Dif | Dif % | Explicación |
|---|--:|--:|--:|--:|---|
| 2025 ene–jul (PRE-CARGA) | 0 | 172,174 | -172,174 | -100.0% | Operaciones devueltas antes de ago-2025: NO cargadas (el control 2025-2026 arranca con retiros may-2025 / dev ago-2025) |
| 2025 ago–dic (comparable) | 147,615 | 124,570 | +23,045 | +18.5% | Dif = +13.650 devueltos vacíos MAERSK + 9.500 días libres CMA (18 vs 14) − 105 corrimiento semana/mes |
| 2026 ene–jun (comparable) | 463,620 | 463,235 | +385 | +0.1% | Dif = +280 devuelto vacío ene (Excel "-") + 105 corrimiento |
| 2026 jul (Excel sin cargar aún) | 10,050 | 0 | +10,050 | n/a | Omar no volcó julio al reporte semanal al corte 18-jul |

## Secundaria — agrupación por fecha de RETIRO (solo referencia)

| Naviera | Año | Sistema USD | Excel USD | Dif |
|---|---|--:|--:|--:|
| MAERSK | 2025 | 195,195 | 192,469 | +2,726 |
| HAPAG | 2025 | 14,700 | 14,450 | +250 |
| CMA-CGM | 2025 | 22,350 | 89,825 | -67,475 |
| MAERSK | 2026 | 386,540 | 455,560 | -69,020 |
| HAPAG | 2026 | 2,500 | 7,675 | -5,175 |
| CMA-CGM | 2026 | 0 | 0 | +0 |

Nota: mes a mes la agrupación por retiro NO matchea (dic-2025 S=86.485 vs E=22.120, mar-2026 S=269.220 vs E=53.305) mientras que por devolución 2026 da exacto (feb/abr/may/jun dif=0). Conclusión empírica: **el reporte semanal de Omar registra el costo en el mes de la DEVOLUCIÓN**, igual que el motor.

## Match a nivel FILA (evidencia de la causa raíz)

Comparación operación por operación (2.922 cerradas) del `costo_realizado` del sistema contra la columna de costos que Omar calculó a mano en el control:

| Resultado | Filas | Dif acumulada USD |
|---|--:|--:|
| Costo EXACTO (dif < $0,01) | 2.798 (95,8%) | 0 |
| CMA CGM 2025: Omar usó 18 días libres, sistema 14 | 116 | +9.500 |
| Devueltos vacíos: Omar les pone costo 0/"-", sistema calcula detention | 8 (MAERSK) | +15.015 |
| **Total** | **2.922** | **+24.515** |

(Los 19 `devuelto_vacio` tienen costo 0 o "-" en el Excel; 11 de ellos generan costo en el sistema por USD 15.540 — los 8 MAERSK de arriba más 3 CMA que ya caen en el bucket de días libres.)