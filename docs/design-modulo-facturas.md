# Módulo: Validación de facturas de naviera — diseño v1 (2026-08-02)

**Idea de John** (2026-08-02): la app registra costo DEVENGADO; la dimensión
facturado/pagado no está modelada. Este módulo la agrega SIN tocar el motor:
se carga la factura real de la naviera y se matchea línea por línea contra lo
que el motor ya calculó. Cada diferencia es plata concreta a reclamar.

## Modelo (migración 049, RPC-only)

- `crm.facturas_naviera`: naviera_id, numero_factura (unique por naviera),
  fecha_emision, monto_total, estado (cargada→en_revision→cerrada), notas,
  creado_por. SELECT authenticated; escritura vía RPC supervisor+.
- `crm.factura_lineas`: factura_id, numero_contenedor (texto tal cual factura),
  dias_facturados, tarifa_usd_dia, monto_usd, operacion_id / operacion_impo_id
  (match), veredicto, delta_usd, detalle_match jsonb.

## Match (server-side, dentro de la RPC de carga)

Por línea: buscar la operación (expo e impo) de esa naviera con ese contenedor,
cerrada más reciente; costos SIEMPRE de las views (`vista_kpi_costos_cerradas`
/ `_impo` — regla de fuente única). Veredictos:

| Veredicto | Regla |
|---|---|
| `coincide` | \|monto − costo_bruto\| < USD 1 |
| `facturado_de_mas` | monto > costo_bruto (delta = a reclamar) |
| `facturado_de_menos` | monto < costo_bruto |
| `no_esperado` | contenedor sin operación con exceso de esa naviera |

Nota devengado vs neto: el match se hace contra **BRUTO** (lo que corresponde
por contrato); si hay waiver cargado, la UI muestra ambos (bruto y neto) para
que el revisor decida con contexto.

## RPCs

`crm_cargar_factura(p jsonb)` — atómica factura+líneas+match · `crm_rematchear_factura(id)`
· `crm_actualizar_estado_factura(id, estado, nota)` — todo DEFINER owner=executor,
guard supervisor+, evento de auditoría propio.

## UI (nueva solapa "Facturas", gate supervisor+)

Lista de facturas con semáforo agregado (X de más / Y no esperadas) → detalle
línea por línea con veredicto y delta · carga por Excel (columnas mínimas:
contenedor, días, monto — sinónimos como el importador de tarifas) o manual.

## Pendiente de John

Una factura REAL de MAERSK de muestra para calibrar el formato de carga antes
de dar por bueno el mapeo de columnas.
