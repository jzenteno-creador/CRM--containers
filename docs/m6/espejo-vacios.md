# Espejo VACÍOS

Criterio 1 — activas sin cargar (espejo de la hoja de vacíos en planta):
```sql
select c.numero_contenedor, (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date,
       crm.hoy_ar() - (o.fecha_retiro at time zone 'America/Argentina/Buenos_Aires')::date as dias_desde_retiro
from crm.operaciones o join crm.contenedores c on c.id=o.contenedor_id
where o.estado <> 'cerrado' and o.estado_carga = 'vacio';
```
**Resultado: 0 filas.** Las 37 activas tienen `estado_carga='lleno'` (cargado=SI en el Excel de Omar) — coincide con el reporte de carga: al corte no queda ningún vacío en planta sin cargar.

Criterio 2 — histórico de contenedores devueltos vacíos (cerradas con `tipo_cierre='devuelto_vacio'` / `estado_carga='vacio'`), con su estadía:

| Contenedor | Naviera | Retiro (AR) | Devolución (AR) | Días estadía | Costo sistema USD | Costo Excel |
|---|---|---|---|--:|--:|--:|
| HASU4904147 | MAERSK | 2025-05-12 | 2025-09-11 | 123 | 3,815 | 0 |
| SUDU6729339 | MAERSK | 2025-06-04 | 2025-09-11 | 100 | 3,010 | 0 |
| TCNU3517944 | CMA CGM | 2025-07-07 | 2025-08-06 | 31 | 425 | 0 |
| MSKU8696734 | MAERSK | 2025-07-10 | 2025-09-11 | 64 | 1,750 | 0 |
| TCLU5892700 | MAERSK | 2025-07-21 | 2025-10-08 | 80 | 2,310 | 0 |
| CMAU9525484 | CMA CGM | 2025-07-30 | 2025-08-06 | 8 | 0 | 0 |
| TEMU6560780 | CMA CGM | 2025-07-30 | 2025-08-06 | 8 | 0 | 0 |
| APHU7402250 | CMA CGM | 2025-08-04 | 2025-08-20 | 17 | 75 | 0 |
| CMAU4707892 | CMA CGM | 2025-08-27 | 2025-09-09 | 14 | 0 | 0 |
| DFSU6692738 | CMA CGM | 2025-08-27 | 2025-09-09 | 14 | 0 | 0 |
| TCNU6491308 | CMA CGM | 2025-08-27 | 2025-09-09 | 14 | 0 | 0 |
| INKU6197809 | MAERSK | 2025-09-12 | 2025-11-06 | 56 | 1,470 | 0 |
| TCLU8377540 | MAERSK | 2025-09-17 | 2025-11-06 | 51 | 1,295 | 0 |
| SEGU4335402 | CMA CGM | 2025-10-04 | 2025-10-17 | 14 | 0 | 0 |
| CMAU4569643 | CMA CGM | 2025-10-14 | 2025-10-28 | 15 | 25 | 0 |
| MSKU0462637 | MAERSK | 2025-11-20 | 2025-11-27 | 8 | 0 | 0 |
| MRKU4955835 | MAERSK | 2026-01-02 | 2026-01-23 | 22 | 280 | '-' |
| BMOU4172000 | MAERSK | 2026-06-03 | 2026-07-17 | 45 | 1,085 | 0 |
| SJCU4518060 | MAERSK | 2026-06-26 | 2026-06-29 | 4 | 0 | 0 |

Total: 19 devueltos vacíos · costo sistema USD 15,540 · costo Excel 0 en todos (hallazgo: Omar no computa detention de devueltos vacíos; el sistema sí).