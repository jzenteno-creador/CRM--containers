// Contrato de /api/vision/scan compartido entre el modo Foto (page.tsx) y el modo
// En vivo (vivo.tsx). Espejo exacto de la respuesta del route handler.

import type { SiglaExtraida } from "@/lib/iso6346";

export type Fragmento = {
  texto: string;
  confianza: number | null;
  x: number | null;
  y: number | null;
};

export type ScanRespuesta =
  | {
      ok: true;
      modo: "manual" | "vivo";
      sigla: SiglaExtraida | null;
      confianza: number | null;
      recognizedText: string | null;
      fragmentos: Fragmento[];
      imagenAnotada: string | null;
      /** true si se insertó una fila en scan_pruebas en ESTE request. */
      registrado: boolean;
      /** vivo: por qué no se registró (rojo / sin sigla / dedup 5 min). */
      motivoNoRegistro: "digito_invalido" | "sin_sigla" | "duplicado" | null;
      errorRegistro: string | null;
      /** Path del comprobante en el bucket (null si no hubo foto). */
      imagenPath: string | null;
      raw: unknown;
    }
  | { ok: false; error: string; detalle: string };
