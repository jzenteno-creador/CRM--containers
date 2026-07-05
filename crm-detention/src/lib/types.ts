// Tipos del modelo de datos (spec §4)

export type Rol = "operador" | "supervisor" | "administrador";

export interface Session {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  plantaId: string | null;
  plantaNombre: string | null;
}

export interface Planta {
  id: string;
  nombre: string;
  codigo: string | null;
}

export interface Naviera {
  id: string;
  nombre: string;
}

export type RegimenFreetime = "vacios" | "cargados" | "sin_uso";

export interface FreetimeOrigin {
  id: string;
  naviera_id: string;
  pais: string;
  dias_libres: number;
  aplica_carga_peligrosa: boolean;
  tipo: "Detention" | "Demurrage" | "Combined";
  tarifa_usd_dia: number;
  vigente_desde: string;
  vigente_hasta: string | null;
  regimen: RegimenFreetime;
  navieras?: Naviera;
}

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  planta_asignada_id: string | null;
  activo: boolean;
}

export type ReforzadoEstado =
  | "pendiente_validacion"
  | "confirmado_reforzado"
  | "confirmado_no_reforzado"
  | "discrepancia";

export interface Contenedor {
  id: string;
  numero_contenedor: string;
  naviera_id: string;
  tipo: "20DC" | "40DC" | "40HC";
  reforzado_estado: ReforzadoEstado;
  navieras?: Naviera;
}

export type OperacionEstado =
  | "en_transito_a_planta"
  | "en_planta"
  | "cargado"
  | "en_transito_a_terminal"
  | "cerrado"
  | "anulada";

export type TipoCierre = "embarcado" | "devuelto_vacio" | "pendiente";

export interface Operacion {
  id: string;
  contenedor_id: string;
  retiro_de: string;
  booking_retiro: string | null;
  fecha_retiro: string;
  planta_actual_id: string | null;
  booking_asignado: string | null;
  buque: string | null;
  destino: string | null;
  orden: string | null;
  shp: string | null;
  fecha_egreso_planta: string | null;
  tipo_cierre: TipoCierre;
  fecha_devolucion: string | null;
  estado: OperacionEstado;
  anulada_motivo: string | null;
  contenedores?: Contenedor;
  plantas?: Planta;
}

export interface MovimientoPlanta {
  id: string;
  operacion_id: string;
  planta_origen_id: string | null;
  planta_destino_id: string;
  medio: "camion" | "tren";
  fecha_salida: string;
  fecha_llegada_confirmada: string | null;
  estado: "en_transito" | "confirmado";
}

export type TipoEvento =
  | "retiro"
  | "ingreso_planta"
  | "movimiento"
  | "carga"
  | "egreso"
  | "devolucion"
  | "anulacion"
  | "incidencia";

export interface OperacionEvento {
  id: string;
  operacion_id: string;
  tipo_evento: TipoEvento;
  fecha: string;
  usuario_id: string | null;
  detalle: Record<string, unknown> | null;
}

export interface Incidencia {
  id: string;
  operacion_id: string;
  tipo: "averia_sufrida" | "averia_recepcionada" | "otro";
  descripcion: string | null;
  fecha: string;
  usuario_id: string | null;
}

export interface VistaAlerta {
  operacion_id: string;
  contenedor_id: string;
  numero_contenedor: string;
  planta_actual: string | null;
  naviera: string;
  estado: OperacionEstado;
  fecha_retiro: string;
  sin_cargo: boolean;
  dias_transcurridos: number;
  /** dwell: días que se tiene el contenedor (retiro = día 1, zona AR) — SIEMPRE presente */
  dias_estadia: number;
  dias_libres: number | null;
  dias_restantes: number | null;
  tarifa_usd_dia: number | null;
  /** null = la naviera no tiene tarifa aplicable / no cobra origen; 0 puede ser waiver (sin_cargo) */
  costo_proyectado: number | null;
  estado_semaforo: "verde" | "amarillo" | "rojo" | "neutro";
}

export interface VistaCostoCerrado {
  operacion_id: string;
  numero_contenedor: string;
  naviera: string;
  tipo_cierre: TipoCierre;
  destino: string | null;
  fecha_retiro: string;
  fecha_devolucion: string;
  estadia: number;
  dias_libres: number;
  demora: number;
  tarifa_usd_dia: number;
  costo_usd: number;
}
