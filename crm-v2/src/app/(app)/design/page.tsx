import { notFound } from "next/navigation";
import { DesignClient } from "./design-client";

// Ruta dev-only (plan 1.6, Decisión 5): grilla con TODOS los componentes del design
// system en TODOS sus estados (equivalente al artboard 2f). Herramienta del review de
// M0, de la consistencia inter-módulos y de la pasada visual final pre-CP3.
// No linkeada; excluida de producción por env (NEXT_PUBLIC_SHOW_DESIGN=1 la habilita).
export default function DesignPage() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SHOW_DESIGN !== "1") {
    notFound();
  }
  return <DesignClient />;
}
