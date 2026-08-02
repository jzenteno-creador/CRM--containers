-- ══════════════════════════════════════════════════════════════════════════════
-- MOTOR DRILL — valida el cálculo de plata contra la SQL REAL y los DATOS REALES
-- ══════════════════════════════════════════════════════════════════════════════
-- Los tests de tests/golden-costos.test.ts validan un ORÁCULO en TypeScript: si
-- alguien cambia la SQL de las views, esos tests siguen en verde. Este archivo cierra
-- ese hueco: consulta `crm.vista_kpi_costos_cerradas` (la view que usa producción)
-- sobre las operaciones reales, y compara contra los montos del Excel de Omar.
--
-- Fuente de la verdad: DETENTION HISTORIAL DE CONTENEDORES AÑO-DE AGOSTO 2025-2026.xlsx · hoja DETENTION DE AGOSTO 2025 A 2026
-- Generado desde tests/golden-costos.json — NO editar a mano.
--
-- DIVERGENCIAS CONOCIDAS (columna `divergencia_conocida`): 7 casos `devuelto_vacio`
-- donde Omar NO cobró detention y el motor SÍ la calcula. NO es un bug: es una
-- decisión de negocio pendiente de John desde M6 (~USD 15.540 sobre la cifra 2025).
-- El drill las tolera; lo que NO tolera es una divergencia NUEVA.
-- ══════════════════════════════════════════════════════════════════════════════
with golden(contenedor, neto_esperado, estadia_esperada, exceso_esperado, divergencia_conocida) as (values
  ('MRSU5124675', 2205.0::numeric, 77, 63, false),
  ('MRKU5866521', 0.0::numeric, 7, 0, false),
  ('GESU6232970', 0.0::numeric, 5, 0, false),
  ('BEAU5196172', 315.0::numeric, 23, 9, false),
  ('TCKU6510846', 315.0::numeric, 23, 9, false),
  ('ECMU7537257', 0.0::numeric, 9, 0, false),
  ('CMAU4929056', 0.0::numeric, 4, 0, false),
  ('MRKU3430842', 0.0::numeric, 12, 0, false),
  ('MRKU3937246', 140.0::numeric, 18, 4, false),
  ('SUDU8603930', 420.0::numeric, 26, 12, false),
  ('TGHU6603478', 0.0::numeric, 5, 0, false),
  ('TRHU4536691', 560.0::numeric, 30, 16, false),
  ('SUDU6658868', 945.0::numeric, 41, 27, false),
  ('CMAU5732971', 0.0::numeric, 7, 0, false),
  ('CAAU6779854', 280.0::numeric, 22, 8, false),
  ('CMAU7973849', 0.0::numeric, 9, 0, false),
  ('TCKU6946146', 0.0::numeric, 5, 0, false),
  ('MRSU3479697', 0.0::numeric, 12, 0, false),
  ('MRSU3637832', 455.0::numeric, 27, 13, false),
  ('MRSU4231621', 770.0::numeric, 36, 22, false),
  ('CMAU3598842', 0.0::numeric, 7, 0, false),
  ('MRSU6805647', 0.0::numeric, 14, 0, false),
  ('TGCU5439042', 0.0::numeric, 3, 0, false),
  ('TCKU7405104', 0.0::numeric, 7, 0, false),
  ('MRSU8128925', 420.0::numeric, 26, 12, false),
  ('TRHU6325337', 490.0::numeric, 28, 14, false),
  ('FANU3683334', 375.0::numeric, 29, 15, false),
  ('HASU4804430', 0.0::numeric, 3, 0, false),
  ('MRKU3884906', 560.0::numeric, 30, 16, false),
  ('WFHU5199152', 0.0::numeric, 8, 0, false),
  ('TCNU3517944', 0.0::numeric, 31, 13, true),
  ('HASU4904147', 0.0::numeric, 123, 109, true),
  ('SUDU6729339', 0.0::numeric, 100, 86, true),
  ('MSKU8696734', 0.0::numeric, 64, 50, true),
  ('TCLU5892700', 0.0::numeric, 80, 66, true),
  ('INKU6197809', 0.0::numeric, 56, 42, true),
  ('TCLU8377540', 0.0::numeric, 51, 37, true),
  ('ZIMU1022976', 0.0::numeric, 4, 0, false),
  ('TGHU5252722', 0.0::numeric, 4, 0, false),
  ('SUDU8973236', 245.0::numeric, 21, 7, false),
  ('TLLU4335170', 0.0::numeric, 1, 0, false),
  ('CAAU9968342', 4235.0::numeric, 135, 121, false),
  ('CMAU9154911', 0.0::numeric, 6, 0, false)
),
medido as (
  select g.*, cc.costo_neto, cc.dias_estadia,
         greatest(0, cc.dias_estadia - cc.dias_libres) as exceso_real
    from golden g
    left join crm.contenedores c on c.numero_contenedor = g.contenedor
    left join lateral (select o.id from crm.operaciones o
                        where o.contenedor_id = c.id order by o.fecha_retiro desc limit 1) op on true
    left join crm.vista_kpi_costos_cerradas cc on cc.operacion_id = op.id
),
veredictos as (
  select *, case
      when costo_neto is null then 'FALTA'
      when costo_neto = neto_esperado and dias_estadia = estadia_esperada
           and exceso_real = exceso_esperado then 'OK'
      when divergencia_conocida then 'DIVERGENCIA_CONOCIDA'
      else 'REGRESION'
    end as veredicto
  from medido
)
select veredicto, count(*) as casos,
       string_agg(contenedor || ' (esperado ' || neto_esperado || ', motor ' ||
                  coalesce(costo_neto::text,'—') || ')', E'\n  ' order by contenedor)
         filter (where veredicto <> 'OK') as detalle
from veredictos group by 1 order by 1;
