# Espejo PRÓXIMOS A VENCER — semáforo AMARILLO (restan 0–5 días de freetime)

```sql
select numero_contenedor, naviera, planta_actual,
 (fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date,
 dias_estadia, dias_libres, dias_restantes, tarifa_usd_dia, costo_proyectado, estado_semaforo
from crm.vista_alertas order by dias_restantes;
```
Criterio del semáforo (de `pg_get_viewdef('crm.vista_alertas')`): días transcurridos con convención `retiro_dia_1` hasta `now()`;
**rojo** = `dias_restantes < 0` (freetime vencido), **amarillo** = `0 <= dias_restantes <= umbral` (config `umbral_alerta_amarillo` = 5), **verde** = resto.
Las 37 activas son MAERSK, planta BAHIA, 14 días libres, tarifa USD 35/día. Corte: 2026-07-18.

**6 operaciones** (todas retiradas 2026-07-06, les queda 1 día de freetime al corte).

| Contenedor | Retiro (AR) | Días estadía | Días restantes | Costo proyectado USD | Semáforo |
|---|---|--:|--:|--:|---|
| CAAU5693545 | 2026-07-06 | 13 | 1 | 0 | amarillo |
| GCXU6415141 | 2026-07-06 | 13 | 1 | 0 | amarillo |
| MRKU3439794 | 2026-07-06 | 13 | 1 | 0 | amarillo |
| MRSU6034663 | 2026-07-06 | 13 | 1 | 0 | amarillo |
| MRSU7721941 | 2026-07-06 | 13 | 1 | 0 | amarillo |
| SUDU8978860 | 2026-07-06 | 13 | 1 | 0 | amarillo |

Referencia: las otras 9 activas están en VERDE (8–9 días restantes, retiros del 13/14-jul).

| Contenedor | Retiro (AR) | Días estadía | Días restantes | Costo proyectado USD | Semáforo |
|---|---|--:|--:|--:|---|
| CAAU6202501 | 2026-07-13 | 6 | 8 | 0 | verde |
| MIEU2034087 | 2026-07-13 | 6 | 8 | 0 | verde |
| MRKU3394703 | 2026-07-13 | 6 | 8 | 0 | verde |
| TCKU7740859 | 2026-07-13 | 6 | 8 | 0 | verde |
| CAAU8300214 | 2026-07-14 | 5 | 9 | 0 | verde |
| MRKU4864252 | 2026-07-14 | 5 | 9 | 0 | verde |
| MRSU5585743 | 2026-07-14 | 5 | 9 | 0 | verde |
| MRSU6066233 | 2026-07-14 | 5 | 9 | 0 | verde |
| SEKU4466006 | 2026-07-14 | 5 | 9 | 0 | verde |