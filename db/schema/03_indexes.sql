-- generado desde cctuowthpnstvdgjuomq el 2026-07-05, read-only export
-- Índices del schema detention (excluyendo índices de constraints)

CREATE INDEX idx_cont_numero_trgm ON detention.contenedores USING gin (numero_contenedor gin_trgm_ops);
CREATE INDEX ix_contenedores_naviera ON detention.contenedores USING btree (naviera_id);
CREATE INDEX ix_freetime_naviera ON detention.freetime_origin USING btree (naviera_id, vigente_desde DESC);
CREATE INDEX ix_incidencias_operacion ON detention.incidencias USING btree (operacion_id);
CREATE INDEX ix_movimientos_operacion ON detention.movimientos_planta USING btree (operacion_id);
CREATE INDEX ix_eventos_operacion ON detention.operacion_eventos USING btree (operacion_id, fecha);
CREATE INDEX idx_ops_booking_asig_trgm ON detention.operaciones USING gin (booking_asignado gin_trgm_ops);
CREATE INDEX idx_ops_booking_ret_trgm ON detention.operaciones USING gin (booking_retiro gin_trgm_ops);
CREATE INDEX idx_ops_estado_dev ON detention.operaciones USING btree (estado, fecha_devolucion DESC);
CREATE INDEX idx_ops_orden_trgm ON detention.operaciones USING gin (orden gin_trgm_ops);
CREATE INDEX ix_operaciones_booking ON detention.operaciones USING btree (booking_retiro);
CREATE INDEX ix_operaciones_estado ON detention.operaciones USING btree (estado);
CREATE INDEX ix_operaciones_fecha_retiro ON detention.operaciones USING btree (fecha_retiro);
CREATE INDEX ix_operaciones_planta ON detention.operaciones USING btree (planta_actual_id);
CREATE UNIQUE INDEX ux_operacion_abierta ON detention.operaciones USING btree (contenedor_id) WHERE (estado <> ALL (ARRAY['cerrado'::text, 'anulada'::text]));
-- D-10 (2026-07-05): una sola versión de tarifa vigente por (naviera, régimen) — cierra la carrera concurrente de crm_nueva_version_freetime
CREATE UNIQUE INDEX ux_freetime_vigente ON detention.freetime_origin (naviera_id, regimen) WHERE (vigente_hasta IS NULL);
