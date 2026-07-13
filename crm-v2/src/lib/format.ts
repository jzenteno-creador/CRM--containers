// Formateo y matemática de días en America/Argentina/Buenos_Aires — portado de v1.
// Estadía inclusiva (retiro = día 1), calibrada contra el Excel real (Decisión 2 del plan).
// La verdad del cómputo vive en la DB (helpers hoy_ar()/dias_estadia de M1); esto es display.

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

/**
 * Solo la hora 'HH:mm' (h23) en zona AR (slot `time` del Timeline). Vacío si es
 * medianoche exacta (fechas cargadas sin hora). Comparación NUMÉRICA por
 * formatToParts: es-AR sin hourCycle formatea h12 ("12:00 a. m."), así que
 * comparar contra el string "00:00" no detectaba la medianoche.
 */
export function fmtHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  if (Number(hour) === 0 && Number(minute) === 0) return "";
  return `${hour}:${minute}`;
}

/**
 * Fecha PLANA 'YYYY-MM-DD' (columnas DATE: vigente_desde/vigente_hasta) → 'DD/MM/YY'
 * SIN pasar por Date: new Date("YYYY-MM-DD") parsea UTC medianoche y en AR (UTC-3)
 * retrocede un día — fmtFecha() solo sirve para timestamptz.
 */
export function fmtFechaDia(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y.slice(2)}`;
}

export function fmtUSD(n: number | null | undefined): string {
  if (n == null) return "USD —";
  return "USD " + Math.round(n).toLocaleString("es-AR");
}

/** USD exacto para tarifas (sin redondear): 55 → "USD 55" · 55.5 → "USD 55,50". */
export function fmtUSDTarifa(n: number | null | undefined): string {
  if (n == null) return "USD —";
  return (
    "USD " +
    n.toLocaleString("es-AR", {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

/** USD compacto para labels de charts: 875 → "USD 875" · 7350 → "USD 7,4 k" · 2.1M → "USD 2,1 M". */
export function fmtUSDCompact(n: number | null | undefined): string {
  if (n == null) return "USD —";
  const abs = Math.abs(n);
  if (abs >= 1_000_000)
    return "USD " + (n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " M";
  if (abs >= 1_000)
    return "USD " + (n / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " k";
  return fmtUSD(n);
}

// Estados del ciclo v2 (§5/§18.1: sin estado "cargado" — asignación plegada en el egreso)
export const ESTADO_LABELS: Record<string, string> = {
  en_transito_a_planta: "en tránsito a planta",
  en_planta: "en planta",
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
  reapertura: "Reapertura (reversa de cierre)",
  correccion: "Corrección de datos",
  waiver: "Waiver de detention",
};

// Tipos de incidencia (espeja el CHECK de crm.incidencias.tipo — M7). Fuente ÚNICA de
// labels: la consumen el alta/historial de /incidencias y el timeline de la ficha.
export const TIPO_INCIDENCIA_LABELS: Record<string, string> = {
  averia_sufrida: "Avería sufrida",
  averia_recepcionada: "Avería recepcionada",
  otro: "Otro",
};
