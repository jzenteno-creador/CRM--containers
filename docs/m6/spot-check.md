# Spot-check de 10 filas — Excel de Omar vs DB (query individual con joins)

Query ejecutada 2026-07-18 (una sola, con `IN` de los 10 números):

```sql
select c.numero_contenedor, n.nombre naviera, c.tipo, p.nombre planta, o.retiro_de, d.nombre retiro_de_catalogo,
 (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date,
 (o.fecha_devolucion at time zone 'America/Argentina/Buenos_Aires')::date,
 o.estado, o.tipo_cierre, o.estado_carga, o.sin_cargo, k.dias_estadia, k.dias_libres, k.tarifa_usd_dia, k.costo_realizado
from crm.operaciones o
join crm.contenedores c on c.id=o.contenedor_id
join crm.navieras n on n.id=c.naviera_id
left join crm.plantas p on p.id=o.planta_actual_id
left join crm.depositos d on d.id=o.retiro_de_id
left join crm.vista_kpi_costos_cerradas k on k.operacion_id=o.id
where c.numero_contenedor in (...10 números...);
```

Selección: 4 MAERSK / 2 CMA CGM / 3 HAPAG / 1 ZIM · 1 activa · 2 con retiro_de sin catálogo (`retiro_de_id` NULL) · 5 de 2025 y 5 de 2026 · 2 devueltos vacíos.

## CMAU9154911 (fila Excel 2) — CMA CGM
| Campo | Excel (Omar) | DB (sistema) | Match |
|---|---|---|:--:|
| naviera | CMA CGM | CMA CGM | OK |
| fecha retiro (AR) | 2025-07-30 | 2025-07-30 | OK |
| fecha devolución (AR) | 2025-08-04 | 2025-08-04 | OK |
| estado | cerrado | cerrado | OK |
| tipo_cierre / estado_carga | - | embarcado / lleno | OK |
| retiro_de (texto / catálogo) | - | PTN / PTN | OK |
| planta / tipo contenedor | - | BAHIA / 40HC | OK |
| días estadía | 6 | 6 | OK |
| días libres | 18 | 14 | DIF |
| tarifa USD/día | 25 | 25 | OK |
| costo USD | 0 | 0 | OK |

## CMAU8425080 (fila Excel 14) — CMA CGM
| Campo | Excel (Omar) | DB (sistema) | Match |
|---|---|---|:--:|
| naviera | CMA CGM | CMA CGM | OK |
| fecha retiro (AR) | 2025-07-05 | 2025-07-05 | OK |
| fecha devolución (AR) | 2025-08-06 | 2025-08-06 | OK |
| estado | cerrado | cerrado | OK |
| tipo_cierre / estado_carga | - | embarcado / lleno | OK |
| retiro_de (texto / catálogo) | - | TRP / TRP | OK |
| planta / tipo contenedor | - | BAHIA / 40HC | OK |
| días estadía | 33 | 33 | OK |
| días libres | 18 | 14 | DIF |
| tarifa USD/día | 25 | 25 | OK |
| costo USD | 375 | 475 | DIF |

> Diferencia = dato, no error: Omar usó 18 días libres; la tarifa versionada del sistema (CMA/ARGENTINA vigente desde 2025-05-01) dice 14.

## HASU4904147 (fila Excel 401) — MAERSK
| Campo | Excel (Omar) | DB (sistema) | Match |
|---|---|---|:--:|
| naviera | MAERSK | MAERSK | OK |
| fecha retiro (AR) | 2025-05-12 | 2025-05-12 | OK |
| fecha devolución (AR) | 2025-09-11 | 2025-09-11 | OK |
| estado | cerrado | cerrado | OK |
| tipo_cierre / estado_carga | - | devuelto_vacio / vacio | OK |
| retiro_de (texto / catálogo) | - | TERMINAL 4 / Terminal 4 | OK |
| planta / tipo contenedor | - | BAHIA / 40HC | OK |
| días estadía | 123 | 123 | OK |
| días libres | 14 | 14 | OK |
| tarifa USD/día | 35 | 35 | OK |
| costo USD | 0 | 3815 | DIF |

> Diferencia = dato, no error: contenedor devuelto vacío — Omar le asigna costo 0/"-"; el sistema calcula la detention por estadía real.

## CAAU9067468 (fila Excel 1905) — MAERSK
| Campo | Excel (Omar) | DB (sistema) | Match |
|---|---|---|:--:|
| naviera | MAERSK | MAERSK | OK |
| fecha retiro (AR) | 2026-01-02 | 2026-01-02 | OK |
| fecha devolución (AR) | 2026-03-02 | 2026-03-02 | OK |
| estado | cerrado | cerrado | OK |
| tipo_cierre / estado_carga | - | embarcado / lleno | OK |
| retiro_de (texto / catálogo) | - | PTN / PTN | OK |
| planta / tipo contenedor | - | BAHIA / 40HC | OK |
| días estadía | 60 | 60 | OK |
| días libres | 14 | 14 | OK |
| tarifa USD/día | 35 | 35 | OK |
| costo USD | 1610 | 1610 | OK |

## MRSU6066233 (fila Excel 2950) — MAERSK
| Campo | Excel (Omar) | DB (sistema) | Match |
|---|---|---|:--:|
| naviera | MAERSK | MAERSK | OK |
| fecha retiro (AR) | 2026-07-14 | 2026-07-14 | OK |
| fecha devolución (AR) | 2026-07-20 (programada en Excel) | NULL (activa) | OK |
| estado | en_transito_a_terminal | en_transito_a_terminal | OK |
| tipo_cierre / estado_carga | - | pendiente / lleno | OK |
| retiro_de (texto / catálogo) | - | PTN / PTN | OK |
| planta / tipo contenedor | - | BAHIA / 40HC | OK |

## TCLU5892700 (fila Excel 731) — MAERSK
| Campo | Excel (Omar) | DB (sistema) | Match |
|---|---|---|:--:|
| naviera | MAERSK | MAERSK | OK |
| fecha retiro (AR) | 2025-07-21 | 2025-07-21 | OK |
| fecha devolución (AR) | 2025-10-08 | 2025-10-08 | OK |
| estado | cerrado | cerrado | OK |
| tipo_cierre / estado_carga | - | devuelto_vacio / vacio | OK |
| retiro_de (texto / catálogo) | - | TERMINAL 4/ABBOTT / SIN CATALOGO (retiro_de_id NULL) | OK |
| planta / tipo contenedor | - | BAHIA / 40HC | OK |
| días estadía | 80 | 80 | OK |
| días libres | 14 | 14 | OK |
| tarifa USD/día | 35 | 35 | OK |
| costo USD | 0 | 2310 | DIF |

> Diferencia = dato, no error: contenedor devuelto vacío — Omar le asigna costo 0/"-"; el sistema calcula la detention por estadía real.

## CAAU6975564 (fila Excel 1102) — HAPAG LLOYD
| Campo | Excel (Omar) | DB (sistema) | Match |
|---|---|---|:--:|
| naviera | HAPAG LLOYD | HAPAG LLOYD | OK |
| fecha retiro (AR) | 2025-11-06 | 2025-11-06 | OK |
| fecha devolución (AR) | 2025-11-13 | 2025-11-13 | OK |
| estado | cerrado | cerrado | OK |
| tipo_cierre / estado_carga | - | embarcado / lleno | OK |
| retiro_de (texto / catálogo) | - | TERMINAL EXOLGAN / SIN CATALOGO (retiro_de_id NULL) | OK |
| planta / tipo contenedor | - | ABBOTT / 40HC | OK |
| días estadía | 8 | 8 | OK |
| días libres | 14 | 14 | OK |
| tarifa USD/día | 25 | 25 | OK |
| costo USD | 0 | 0 | OK |

## BEAU4459865 (fila Excel 1891) — HAPAG LLOYD
| Campo | Excel (Omar) | DB (sistema) | Match |
|---|---|---|:--:|
| naviera | HAPAG LLOYD | HAPAG LLOYD | OK |
| fecha retiro (AR) | 2026-02-06 | 2026-02-06 | OK |
| fecha devolución (AR) | 2026-02-24 | 2026-02-24 | OK |
| estado | cerrado | cerrado | OK |
| tipo_cierre / estado_carga | - | embarcado / lleno | OK |
| retiro_de (texto / catálogo) | - | PTN / PTN | OK |
| planta / tipo contenedor | - | BAHIA / 40HC | OK |
| días estadía | 19 | 19 | OK |
| días libres | 14 | 14 | OK |
| tarifa USD/día | 25 | 25 | OK |
| costo USD | 125 | 125 | OK |

## TGHU5252722 (fila Excel 1643) — ZIM LINES
| Campo | Excel (Omar) | DB (sistema) | Match |
|---|---|---|:--:|
| naviera | ZIM LINES | ZIM LINES | OK |
| fecha retiro (AR) | 2026-01-06 | 2026-01-06 | OK |
| fecha devolución (AR) | 2026-01-09 | 2026-01-09 | OK |
| estado | cerrado | cerrado | OK |
| tipo_cierre / estado_carga | - | embarcado / lleno | OK |
| retiro_de (texto / catálogo) | - | HIPERBAIRES / Hiperbaires | OK |
| planta / tipo contenedor | - | ABBOTT / 40DC | OK |
| días estadía | 4 | 4 | OK |
| días libres | 7 | 14 | DIF |
| tarifa USD/día | 84 | 25 | DIF |
| costo USD | 0 | 0 | OK |

## HAMU3020279 (fila Excel 91) — HAPAG LLOYD
| Campo | Excel (Omar) | DB (sistema) | Match |
|---|---|---|:--:|
| naviera | HAPAG LLOYD | HAPAG LLOYD | OK |
| fecha retiro (AR) | 2025-07-29 | 2025-07-29 | OK |
| fecha devolución (AR) | 2025-08-15 | 2025-08-15 | OK |
| estado | cerrado | cerrado | OK |
| tipo_cierre / estado_carga | - | embarcado / lleno | OK |
| retiro_de (texto / catálogo) | - | EXOLGAN / Exolgan | OK |
| planta / tipo contenedor | - | BAHIA / 40HC | OK |
| días estadía | 18 | 18 | OK |
| días libres | 14 | 14 | OK |
| tarifa USD/día | 25 | 25 | OK |
| costo USD | 100 | 100 | OK |
