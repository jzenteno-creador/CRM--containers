-- generado desde cctuowthpnstvdgjuomq el 2026-07-05, read-only export
-- GRANTS Y REALTIME PUBLICATION (REFERENCIA SOLAMENTE - NO EJECUTAR)
-- Estos comandos reflejan la configuración actual pero no se replayan durante restore.
-- La configuración de RLS/Grants se debe manejar según la política de seguridad del proyecto.

-- GRANTS por tabla (todas las tablas del schema tienen grants completos a anon, authenticated, postgres, service_role)
-- Ejemplo:
-- ALTER TABLE detention.configuracion GRANT ALL ON detention.configuracion TO anon, authenticated, service_role;

-- REALTIME PUBLICATION: las siguientes tablas están en la publicación supabase_realtime:
-- - detection.incidencias
-- - detention.movimientos_planta
-- - detention.operaciones

-- Para agregar/configurar Realtime en una tabla:
-- ALTER PUBLICATION supabase_realtime ADD TABLE detention.incidencias;
-- ALTER PUBLICATION supabase_realtime ADD TABLE detention.movimientos_planta;
-- ALTER PUBLICATION supabase_realtime ADD TABLE detention.operaciones;

-- Storage buckets y políticas RLS (si aplica) se configuran fuera del DDL.
