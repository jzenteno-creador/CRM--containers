// Formateo y matemática de días en America/Argentina/Buenos_Aires (fecha_retiro = día 0)

const TZ = "America/Argentina/Buenos_Aires";

/** Fecha de hoy en AR como 'YYYY-MM-DD'. */
export function hoyAR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Convierte un timestamptz ISO a 'YYYY-MM-DD' en zona AR. */
export function fechaAR(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Días transcurridos desde `iso` hasta hoy, en días calendario AR (día 0 = mismo día). */
export function diasDesde(iso: string): number {
  const a = new Date(fechaAR(iso) + "T00:00:00Z").getTime();
  const b = new Date(hoyAR() + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

/** Estadía (dwell) contando el día de retiro inclusive (retiro = día 1) — mismo criterio que el Excel. */
export function diasEstadia(fechaRetiroIso: string): number {
  return diasDesde(fechaRetiroIso) + 1;
}

export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function fmtFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function fmtUSD(n: number | null | undefined): string {
  if (n == null) return "USD —";
  return "USD " + Math.round(n).toLocaleString("es-AR");
}

export const ESTADO_LABELS: Record<string, string> = {
  en_transito_a_planta: "en tránsito a planta",
  en_planta: "en planta",
  cargado: "cargado",
  en_transito_a_terminal: "en tránsito a terminal",
  cerrado: "cerrado",
  anulada: "anulada",
};

export const TIPO_CIERRE_LABELS: Record<string, string> = {
  embarcado: "embarcado",
  devuelto_vacio: "devuelto vacío",
  pendiente: "pendiente",
};

export const EVENTO_LABELS: Record<string, string> = {
  retiro: "Retiro en depósito",
  ingreso_planta: "Ingreso a planta",
  movimiento: "Movimiento entre plantas",
  carga: "Carga / asignación",
  egreso: "Salida de planta",
  devolucion: "Devolución / gate-in terminal",
  anulacion: "Anulación",
  incidencia: "Incidencia",
};
