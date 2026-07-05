-- generado desde cctuowthpnstvdgjuomq el 2026-07-05, read-only export
-- Vistas del schema detention

CREATE OR REPLACE VIEW detention.vista_alertas AS
SELECT o.id AS operacion_id,
    c.id AS contenedor_id,
    c.numero_contenedor,
    p.nombre AS planta_actual,
    n.nombre AS naviera,
    o.estado,
    o.fecha_retiro,
    o.sin_cargo,
    (now() AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date - (o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date + 1 AS dias_transcurridos,
    (now() AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date - (o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date + 1 AS dias_estadia,
    ft.dias_libres,
    CASE
        WHEN ft.dias_libres IS NOT NULL THEN ft.dias_libres - ((now() AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date - (o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date + 1)
        ELSE NULL::integer
    END AS dias_restantes,
    ft.tarifa_usd_dia,
    CASE
        WHEN o.sin_cargo THEN 0::numeric
        WHEN ft.dias_libres IS NULL OR NOT n.cobra_detention_origen THEN NULL::numeric
        ELSE GREATEST(0, (now() AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date - (o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date + 1 - ft.dias_libres)::numeric * ft.tarifa_usd_dia
    END AS costo_proyectado,
    CASE
        WHEN ft.dias_libres IS NULL OR NOT n.cobra_detention_origen THEN 'neutro'::text
        WHEN (ft.dias_libres - ((now() AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date - (o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date + 1)) < 0 THEN 'rojo'::text
        WHEN (ft.dias_libres - ((now() AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date - (o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date + 1)) <= cfg.umbral THEN 'amarillo'::text
        ELSE 'verde'::text
    END AS estado_semaforo
FROM detention.operaciones o
    JOIN detention.contenedores c ON c.id = o.contenedor_id
    JOIN detention.navieras n ON n.id = c.naviera_id
    LEFT JOIN detention.plantas p ON p.id = o.planta_actual_id
    CROSS JOIN LATERAL (SELECT COALESCE((SELECT (configuracion.valor ->> 'dias'::text)::integer AS int4
                   FROM detention.configuracion
                  WHERE configuracion.clave = 'umbral_alerta_amarillo'::text), 3) AS umbral) cfg
    LEFT JOIN LATERAL (SELECT f.dias_libres,
            f.tarifa_usd_dia
           FROM detention.freetime_origin f
          WHERE f.naviera_id = c.naviera_id AND f.regimen = 'vacios'::text AND (o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date >= f.vigente_desde AND (f.vigente_hasta IS NULL OR (o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date <= f.vigente_hasta)
          ORDER BY f.vigente_desde DESC
         LIMIT 1) ft ON true
WHERE o.estado <> ALL (ARRAY['cerrado'::text, 'anulada'::text]);

CREATE OR REPLACE VIEW detention.vista_costos_cerrados AS
SELECT o.id AS operacion_id,
    c.numero_contenedor,
    n.nombre AS naviera,
    o.tipo_cierre,
    o.destino,
    o.fecha_retiro,
    o.fecha_devolucion,
    o.sin_cargo,
    (o.fecha_devolucion AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date - (o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date + 1 AS estadia,
    ft.dias_libres,
    CASE
        WHEN ft.dias_libres IS NOT NULL THEN GREATEST(0, (o.fecha_devolucion AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date - (o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date + 1 - ft.dias_libres)
        ELSE NULL::integer
    END AS demora,
    ft.tarifa_usd_dia,
    CASE
        WHEN o.sin_cargo THEN 0::numeric
        WHEN ft.dias_libres IS NULL OR NOT n.cobra_detention_origen THEN NULL::numeric
        ELSE GREATEST(0, (o.fecha_devolucion AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date - (o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date + 1 - ft.dias_libres)::numeric * ft.tarifa_usd_dia
    END AS costo_usd,
    o.retiro_de,
    o.booking_retiro,
    o.booking_asignado,
    o.buque,
    o.orden,
    o.shp,
    o.observaciones,
    o.producto,
    o.gmid,
    c.tipo AS tipo_contenedor,
    c.reforzado_estado,
    p.nombre AS planta
FROM detention.operaciones o
    JOIN detention.contenedores c ON c.id = o.contenedor_id
    JOIN detention.navieras n ON n.id = c.naviera_id
    LEFT JOIN detention.plantas p ON p.id = o.planta_actual_id
    LEFT JOIN LATERAL (SELECT f.dias_libres,
            f.tarifa_usd_dia
           FROM detention.freetime_origin f
          WHERE f.naviera_id = c.naviera_id AND f.regimen =
                CASE
                    WHEN o.tipo_cierre = 'devuelto_vacio'::text AND (EXISTS (SELECT 1
                       FROM detention.freetime_origin fz
                      WHERE fz.naviera_id = c.naviera_id AND fz.regimen = 'sin_uso'::text AND (o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date >= fz.vigente_desde AND (fz.vigente_hasta IS NULL OR (o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date <= fz.vigente_hasta))) THEN 'sin_uso'::text
                    ELSE 'vacios'::text
                END AND (o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date >= f.vigente_desde AND (f.vigente_hasta IS NULL OR (o.fecha_retiro AT TIME ZONE 'America/Argentina/Buenos_Aires'::text)::date <= f.vigente_hasta)
          ORDER BY f.vigente_desde DESC
         LIMIT 1) ft ON true
WHERE o.estado = 'cerrado'::text AND o.fecha_devolucion IS NOT NULL;
