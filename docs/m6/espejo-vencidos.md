# Espejo VENCIDOS — activas con freetime vencido (semáforo ROJO)

```sql
select numero_contenedor, naviera, planta_actual,
 (fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date,
 dias_estadia, dias_libres, dias_restantes, tarifa_usd_dia, costo_proyectado, estado_semaforo
from crm.vista_alertas order by dias_restantes;
```
Criterio del semáforo (de `pg_get_viewdef('crm.vista_alertas')`): días transcurridos con convención `retiro_dia_1` hasta `now()`;
**rojo** = `dias_restantes < 0` (freetime vencido), **amarillo** = `0 <= dias_restantes <= umbral` (config `umbral_alerta_amarillo` = 5), **verde** = resto.
Las 37 activas son MAERSK, planta BAHIA, 14 días libres, tarifa USD 35/día. Corte: 2026-07-18.

**22 operaciones** con detention corriendo · costo proyectado acumulado USD 6,055 (crece USD 770/día).

| Contenedor | Retiro (AR) | Días estadía | Días restantes | Costo proyectado USD | Semáforo |
|---|---|--:|--:|--:|---|
| MRKU2304921 | 2026-05-12 | 68 | -54 | 1,890 | rojo |
| HASU5082008 | 2026-06-25 | 24 | -10 | 350 | rojo |
| MRKU2199533 | 2026-06-25 | 24 | -10 | 350 | rojo |
| MRKU4407390 | 2026-06-25 | 24 | -10 | 350 | rojo |
| MRKU5386749 | 2026-06-25 | 24 | -10 | 350 | rojo |
| MRKU5404837 | 2026-06-25 | 24 | -10 | 350 | rojo |
| CAAU6726073 | 2026-06-30 | 19 | -5 | 175 | rojo |
| FFAU2345302 | 2026-06-30 | 19 | -5 | 175 | rojo |
| HASU4997875 | 2026-06-30 | 19 | -5 | 175 | rojo |
| MRKU4251918 | 2026-06-30 | 19 | -5 | 175 | rojo |
| MRKU5908735 | 2026-06-30 | 19 | -5 | 175 | rojo |
| MRSU6517147 | 2026-06-30 | 19 | -5 | 175 | rojo |
| MRSU6960432 | 2026-06-30 | 19 | -5 | 175 | rojo |
| MRSU7785400 | 2026-06-30 | 19 | -5 | 175 | rojo |
| TCKU6406472 | 2026-06-30 | 19 | -5 | 175 | rojo |
| TCLU5463500 | 2026-06-30 | 19 | -5 | 175 | rojo |
| TCNU2488857 | 2026-06-30 | 19 | -5 | 175 | rojo |
| TCNU7555120 | 2026-06-30 | 19 | -5 | 175 | rojo |
| TLLU5115061 | 2026-06-30 | 19 | -5 | 175 | rojo |
| MRSU9025388 | 2026-07-03 | 16 | -2 | 70 | rojo |
| MRSU3124953 | 2026-07-04 | 15 | -1 | 35 | rojo |
| MRSU8451310 | 2026-07-04 | 15 | -1 | 35 | rojo |