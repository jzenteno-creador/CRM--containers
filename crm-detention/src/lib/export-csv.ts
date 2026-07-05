// Export CSV client-side (F-01). BOM UTF-8 + separador ';' para que Excel es-AR
// lo abra con columnas y acentos correctos, sin librerías.

export interface ColumnaCSV {
  key: string;
  label: string;
}

function escapar(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Genera y descarga un CSV a partir de filas ya cargadas en memoria.
 * `filas` son objetos planos; cada columna toma su valor por `key`.
 */
export function descargarCSV(
  nombre: string,
  columnas: ColumnaCSV[],
  filas: Record<string, unknown>[],
): void {
  const head = columnas.map((c) => escapar(c.label)).join(";");
  const body = filas
    .map((f) => columnas.map((c) => escapar(f[c.key])).join(";"))
    .join("\r\n");
  const contenido = "\uFEFF" + head + "\r\n" + body;
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre.endsWith(".csv") ? nombre : `${nombre}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
