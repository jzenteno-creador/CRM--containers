// Helper local del módulo ingreso: extrae un mensaje legible de un error desconocido
// (PostgrestError no siempre es instancia de Error).

export function mensajeDeError(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return "error inesperado";
}
