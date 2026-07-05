# Schema Export: detention (CRM Detention)

## Provenance

- **Proyecto Supabase:** `cctuowthpnstvdgjuomq`
- **Fecha de exportación:** 2026-07-05
- **Método:** read-only export vía catálogo pg_* (SELECT únicamente)
- **Encoding:** UTF-8

## Orden de Ejecución para Rebuild

Para restaurar el schema completo desde cero, ejecutar en este orden:

1. `01_schema.sql` — Crear schema y verificar extensiones
2. `02_tables.sql` — Crear todas las tablas con constraints (PKs, UKs, CHECKs, FKs)
3. `03_indexes.sql` — Crear índices secundarios
4. `04_views.sql` — Crear vistas materializadas/no-materializadas
5. `05_functions.sql` — Crear funciones PL/pgSQL
6. `06_triggers.sql` — Crear triggers
7. `07_grants_publication.sql` — Verificar/recrear grants y Realtime publication (referencia)

## Conteo de Objetos

| Tipo | Cantidad | Detalles |
|------|----------|----------|
| **Tablas** | 13 | configuracion, contenedores, costos_historicos, freetime_origin, incidencia_fotos, incidencias, movimientos_planta, navieras, operacion_eventos, operaciones, plantas, prefijos_restringidos, usuarios |
| **Vistas** | 2 | vista_alertas, vista_costos_cerrados |
| **Funciones** | 11 | crm_anular_operacion, crm_confirmar_devolucion, crm_confirmar_ingreso_planta, crm_confirmar_movimiento, crm_crear_tanda_retiro, crm_dashboard, crm_mover_entre_plantas, crm_nueva_version_freetime, crm_registrar_salida_planta, crm_set_updated_at, crm_validar_reforzado |
| **Triggers** | 9 | trg_contenedores_upd, trg_freetime_upd, trg_incidencias_upd, trg_mov_confirmado, trg_movimientos_upd, trg_navieras_upd, trg_operaciones_upd, trg_plantas_upd, trg_usuarios_upd |
| **Índices (no-constraint)** | 15 | idx_cont_numero_trgm, ix_contenedores_naviera, ix_freetime_naviera, ix_incidencias_operacion, ix_movimientos_operacion, ix_eventos_operacion, idx_ops_booking_asig_trgm, idx_ops_booking_ret_trgm, idx_ops_estado_dev, idx_ops_orden_trgm, ix_operaciones_booking, ix_operaciones_estado, ix_operaciones_fecha_retiro, ix_operaciones_planta, ux_operacion_abierta |
| **Constraints (PK+UK+CHK+FK)** | ~50 | 13 PKs, 5 UKs, 17 CHECKs, 15 FKs |
| **Extensiones relevantes** | 4 | pg_trgm (full-text search), pgcrypto (crypto), uuid-ossp (UUIDs), plpgsql (stored procedures) |
| **Políticas RLS** | 0 | Sin políticas aplicadas en schema detention |
| **Secuencias** | 0 | Se usa gen_random_uuid() en lugar de secuencias |
| **Realtime publications** | 3 tablas | incidencias, movimientos_planta, operaciones |

## Restricciones Críticas Identificadas

- **ux_operacion_abierta** (índice único parcial): garantiza que no haya dos operaciones abiertas para el mismo contenedor. Crítico para integridad lógica.
- **trg_mov_confirmado**: trigger que sincroniza planta_actual en operaciones cuando se confirma un movimiento.
- **crm_crear_tanda_retiro**: función que realiza validaciones de contenedores con ciclo abierto; **raise exception** si existen conflictos.

## Caveats y Limitaciones

### En este export

1. **SIN DATOS:** Este es un dump DDL-only. No contiene datos de tablas (rows). Para un backup completo, usar `pg_dump --data-only`.

2. **Restore NO ENSAYADO:** Los archivos se generaron directamente desde catálogo pg_*. No se ejecutó un restore completo en un ambiente de prueba. Se recomienda:
   - Ejecutar en DB de prueba antes de aplicar a producción
   - Verificar conteos de objetos post-restore vs. esta lista
   - Validar que los triggers se disparan correctamente

3. **Grants/RLS comentados:** Los grants a los roles de Supabase (anon, authenticated, service_role) se listan como referencia. Supabase maneja estos automáticamente en el panel web; no se incluyen como `GRANT` ejecutables.

4. **Storage/Policies:** Las políticas RLS de storage (buckets) no están aquí. Configurarlas por separado en la UI de Supabase o via `storage.buckets` + `storage.objects` si aplica.

5. **Dependencias de esquemas externo:** Algunas funciones pueden referenciar el schema `public` (ej. `SET search_path`). Verificar que existan las dependencias.

## Próximos Pasos (Fase 0.2 del CRM Detention)

- **Ítem 0.2 (backup completo):** Incluir `pg_dump --data-only` y automatizar backups incrementales.
- **Ítem 0.3+ (testing/validation):** Ensayar restore en staging DB, validar funciones y triggers.

---

*Generated from Supabase project cctuowthpnstvdgjuomq on 2026-07-05. Formato: SQL estándar Postgres 14+*
