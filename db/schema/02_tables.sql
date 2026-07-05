-- generado desde cctuowthpnstvdgjuomq el 2026-07-05, read-only export
-- Tablas base del schema detention

CREATE TABLE detention.configuracion (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clave text NOT NULL,
  valor jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE detention.navieras (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nombre text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  cobra_detention_origen boolean DEFAULT true NOT NULL
);

CREATE TABLE detention.plantas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nombre text NOT NULL,
  codigo text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE detention.usuarios (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text NOT NULL,
  nombre text NOT NULL,
  rol text NOT NULL,
  planta_asignada_id uuid,
  activo boolean DEFAULT true NOT NULL,
  password text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE detention.contenedores (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  numero_contenedor text NOT NULL,
  naviera_id uuid NOT NULL,
  tipo text NOT NULL,
  reforzado_estado text DEFAULT 'confirmado_reforzado'::text NOT NULL,
  reforzado_validado_por uuid,
  reforzado_fecha_validacion timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE detention.costos_historicos (
  anio integer NOT NULL,
  mes integer NOT NULL,
  semana integer NOT NULL,
  costo_usd numeric NOT NULL
);

CREATE TABLE detention.freetime_origin (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  naviera_id uuid NOT NULL,
  pais text DEFAULT 'ARGENTINA'::text NOT NULL,
  dias_libres integer NOT NULL,
  aplica_carga_peligrosa boolean DEFAULT false NOT NULL,
  tipo text NOT NULL,
  tarifa_usd_dia numeric(10,2) NOT NULL,
  vigente_desde date NOT NULL,
  vigente_hasta date,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  regimen text DEFAULT 'vacios'::text NOT NULL
);

CREATE TABLE detention.incidencia_fotos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  incidencia_id uuid NOT NULL,
  storage_path text NOT NULL,
  uploaded_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE detention.incidencias (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  operacion_id uuid NOT NULL,
  tipo text NOT NULL,
  descripcion text,
  fecha timestamp with time zone DEFAULT now() NOT NULL,
  usuario_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE detention.movimientos_planta (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  operacion_id uuid NOT NULL,
  planta_origen_id uuid,
  planta_destino_id uuid NOT NULL,
  medio text NOT NULL,
  fecha_salida timestamp with time zone NOT NULL,
  fecha_llegada_confirmada timestamp with time zone,
  confirmado_por uuid,
  estado text DEFAULT 'en_transito'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE detention.operacion_eventos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  operacion_id uuid NOT NULL,
  tipo_evento text NOT NULL,
  fecha timestamp with time zone DEFAULT now() NOT NULL,
  usuario_id uuid,
  detalle jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE detention.operaciones (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  contenedor_id uuid NOT NULL,
  retiro_de text NOT NULL,
  booking_retiro text,
  fecha_retiro timestamp with time zone NOT NULL,
  planta_actual_id uuid,
  booking_asignado text,
  buque text,
  destino text,
  orden text,
  shp text,
  fecha_egreso_planta timestamp with time zone,
  tipo_cierre text DEFAULT 'pendiente'::text NOT NULL,
  fecha_devolucion timestamp with time zone,
  estado text DEFAULT 'en_transito_a_planta'::text NOT NULL,
  anulada_motivo text,
  anulada_por uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  sin_cargo boolean DEFAULT false NOT NULL,
  producto text,
  gmid text,
  observaciones text
);

CREATE TABLE detention.prefijos_restringidos (
  prefijo text NOT NULL,
  armador text NOT NULL,
  estado text DEFAULT 'vigente'::text NOT NULL,
  nota text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- PRIMARY KEYS
ALTER TABLE detention.configuracion ADD CONSTRAINT configuracion_pkey PRIMARY KEY (id);
ALTER TABLE detention.contenedores ADD CONSTRAINT contenedores_pkey PRIMARY KEY (id);
ALTER TABLE detention.costos_historicos ADD CONSTRAINT costos_historicos_pkey PRIMARY KEY (anio, mes, semana);
ALTER TABLE detention.freetime_origin ADD CONSTRAINT freetime_origin_pkey PRIMARY KEY (id);
ALTER TABLE detention.incidencia_fotos ADD CONSTRAINT incidencia_fotos_pkey PRIMARY KEY (id);
ALTER TABLE detention.incidencias ADD CONSTRAINT incidencias_pkey PRIMARY KEY (id);
ALTER TABLE detention.movimientos_planta ADD CONSTRAINT movimientos_planta_pkey PRIMARY KEY (id);
ALTER TABLE detention.navieras ADD CONSTRAINT navieras_pkey PRIMARY KEY (id);
ALTER TABLE detention.operacion_eventos ADD CONSTRAINT operacion_eventos_pkey PRIMARY KEY (id);
ALTER TABLE detention.operaciones ADD CONSTRAINT operaciones_pkey PRIMARY KEY (id);
ALTER TABLE detention.plantas ADD CONSTRAINT plantas_pkey PRIMARY KEY (id);
ALTER TABLE detention.prefijos_restringidos ADD CONSTRAINT prefijos_restringidos_pkey PRIMARY KEY (prefijo);
ALTER TABLE detention.usuarios ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);

-- UNIQUE CONSTRAINTS
ALTER TABLE detention.configuracion ADD CONSTRAINT configuracion_clave_key UNIQUE (clave);
ALTER TABLE detention.contenedores ADD CONSTRAINT contenedores_numero_contenedor_key UNIQUE (numero_contenedor);
ALTER TABLE detention.navieras ADD CONSTRAINT navieras_nombre_key UNIQUE (nombre);
ALTER TABLE detention.plantas ADD CONSTRAINT plantas_nombre_key UNIQUE (nombre);
ALTER TABLE detention.usuarios ADD CONSTRAINT usuarios_email_key UNIQUE (email);

-- CHECK CONSTRAINTS
ALTER TABLE detention.contenedores ADD CONSTRAINT contenedores_reforzado_estado_check CHECK ((reforzado_estado = ANY (ARRAY['pendiente_validacion'::text, 'confirmado_reforzado'::text, 'confirmado_no_reforzado'::text, 'discrepancia'::text])));
ALTER TABLE detention.contenedores ADD CONSTRAINT contenedores_tipo_check CHECK ((tipo = ANY (ARRAY['20DC'::text, '40DC'::text, '40HC'::text])));
ALTER TABLE detention.costos_historicos ADD CONSTRAINT costos_historicos_mes_check CHECK (((mes >= 1) AND (mes <= 12)));
ALTER TABLE detention.freetime_origin ADD CONSTRAINT freetime_origin_dias_libres_check CHECK ((dias_libres >= 0));
ALTER TABLE detention.freetime_origin ADD CONSTRAINT freetime_origin_regimen_check CHECK ((regimen = ANY (ARRAY['vacios'::text, 'cargados'::text, 'sin_uso'::text])));
ALTER TABLE detention.freetime_origin ADD CONSTRAINT freetime_origin_tarifa_usd_dia_check CHECK ((tarifa_usd_dia >= (0)::numeric));
ALTER TABLE detention.freetime_origin ADD CONSTRAINT freetime_origin_tipo_check CHECK ((tipo = ANY (ARRAY['Detention'::text, 'Demurrage'::text, 'Combined'::text])));
ALTER TABLE detention.incidencias ADD CONSTRAINT incidencias_tipo_check CHECK ((tipo = ANY (ARRAY['averia_sufrida'::text, 'averia_recepcionada'::text, 'otro'::text])));
ALTER TABLE detention.movimientos_planta ADD CONSTRAINT movimientos_planta_estado_check CHECK ((estado = ANY (ARRAY['en_transito'::text, 'confirmado'::text])));
ALTER TABLE detention.movimientos_planta ADD CONSTRAINT movimientos_planta_medio_check CHECK ((medio = ANY (ARRAY['camion'::text, 'tren'::text])));
ALTER TABLE detention.operacion_eventos ADD CONSTRAINT operacion_eventos_tipo_evento_check CHECK ((tipo_evento = ANY (ARRAY['retiro'::text, 'ingreso_planta'::text, 'movimiento'::text, 'carga'::text, 'egreso'::text, 'devolucion'::text, 'anulacion'::text, 'incidencia'::text])));
ALTER TABLE detention.operaciones ADD CONSTRAINT operaciones_estado_check CHECK ((estado = ANY (ARRAY['en_transito_a_planta'::text, 'en_planta'::text, 'cargado'::text, 'en_transito_a_terminal'::text, 'cerrado'::text, 'anulada'::text])));
ALTER TABLE detention.operaciones ADD CONSTRAINT operaciones_tipo_cierre_check CHECK ((tipo_cierre = ANY (ARRAY['embarcado'::text, 'devuelto_vacio'::text, 'pendiente'::text])));
ALTER TABLE detention.plantas ADD CONSTRAINT plantas_nombre_check CHECK ((nombre = ANY (ARRAY['BAHIA'::text, 'ABBOTT'::text])));
ALTER TABLE detention.prefijos_restringidos ADD CONSTRAINT prefijos_restringidos_estado_check CHECK ((estado = ANY (ARRAY['vigente'::text, 'retirado_de_lista'::text])));
ALTER TABLE detention.prefijos_restringidos ADD CONSTRAINT prefijos_restringidos_prefijo_check CHECK ((prefijo ~ '^[A-Z]{4}$'::text));
ALTER TABLE detention.usuarios ADD CONSTRAINT usuarios_rol_check CHECK ((rol = ANY (ARRAY['operador'::text, 'supervisor'::text, 'administrador'::text])));

-- FOREIGN KEYS
ALTER TABLE detention.contenedores ADD CONSTRAINT contenedores_naviera_id_fkey FOREIGN KEY (naviera_id) REFERENCES detention.navieras(id);
ALTER TABLE detention.contenedores ADD CONSTRAINT contenedores_reforzado_validado_por_fkey FOREIGN KEY (reforzado_validado_por) REFERENCES detention.usuarios(id);
ALTER TABLE detention.freetime_origin ADD CONSTRAINT freetime_origin_naviera_id_fkey FOREIGN KEY (naviera_id) REFERENCES detention.navieras(id);
ALTER TABLE detention.incidencia_fotos ADD CONSTRAINT incidencia_fotos_incidencia_id_fkey FOREIGN KEY (incidencia_id) REFERENCES detention.incidencias(id);
ALTER TABLE detention.incidencias ADD CONSTRAINT incidencias_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES detention.operaciones(id);
ALTER TABLE detention.incidencias ADD CONSTRAINT incidencias_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES detention.usuarios(id);
ALTER TABLE detention.movimientos_planta ADD CONSTRAINT movimientos_planta_confirmado_por_fkey FOREIGN KEY (confirmado_por) REFERENCES detention.usuarios(id);
ALTER TABLE detention.movimientos_planta ADD CONSTRAINT movimientos_planta_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES detention.operaciones(id);
ALTER TABLE detention.movimientos_planta ADD CONSTRAINT movimientos_planta_planta_destino_id_fkey FOREIGN KEY (planta_destino_id) REFERENCES detention.plantas(id);
ALTER TABLE detention.movimientos_planta ADD CONSTRAINT movimientos_planta_planta_origen_id_fkey FOREIGN KEY (planta_origen_id) REFERENCES detention.plantas(id);
ALTER TABLE detention.operacion_eventos ADD CONSTRAINT operacion_eventos_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES detention.operaciones(id);
ALTER TABLE detention.operacion_eventos ADD CONSTRAINT operacion_eventos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES detention.usuarios(id);
ALTER TABLE detention.operaciones ADD CONSTRAINT operaciones_anulada_por_fkey FOREIGN KEY (anulada_por) REFERENCES detention.usuarios(id);
ALTER TABLE detention.operaciones ADD CONSTRAINT operaciones_contenedor_id_fkey FOREIGN KEY (contenedor_id) REFERENCES detention.contenedores(id);
ALTER TABLE detention.operaciones ADD CONSTRAINT operaciones_planta_actual_id_fkey FOREIGN KEY (planta_actual_id) REFERENCES detention.plantas(id);
ALTER TABLE detention.usuarios ADD CONSTRAINT usuarios_planta_asignada_id_fkey FOREIGN KEY (planta_asignada_id) REFERENCES detention.plantas(id);
