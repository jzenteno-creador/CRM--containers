"use client";

// Puente React ↔ escena A4 (vanilla three, verificada en ~/work/crm-3d). React es dueño
// del DOM (canvas + fade) y del ciclo de vida; la escena es dueña de TODO lo demás.
// El import() dinámico corta el chunk: three + modelo solo bajan en /login.

import { useEffect, useRef } from "react";
import type { ContainerSceneHandle } from "./container-scene";

type Props = {
  onReady: (handle: ContainerSceneHandle) => void;
  onFormReady: () => void;
  onSequenceEnd: () => void;
  /** La escena no pudo ni cargar (chunk caído, WebGL negado): el login sigue sin 3D. */
  onSceneError: () => void;
};

export function ContainerCanvas({ onReady, onFormReady, onSequenceEnd, onSceneError }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  // Los callbacks viven en refs para que el effect corra UNA vez (StrictMode-safe)
  // sin re-inicializar la escena cuando el padre re-renderiza.
  const cbRef = useRef({ onReady, onFormReady, onSequenceEnd, onSceneError });
  cbRef.current = { onReady, onFormReady, onSequenceEnd, onSceneError };

  useEffect(() => {
    let disposed = false;
    let handle: ContainerSceneHandle | null = null;
    (async () => {
      try {
        const { initContainerScene } = await import("./container-scene");
        if (disposed || !canvasRef.current || !fadeRef.current) return;
        handle = await initContainerScene({
          canvas: canvasRef.current,
          fadeEl: fadeRef.current,
          onFormReady: () => cbRef.current.onFormReady(),
          onSequenceEnd: () => cbRef.current.onSequenceEnd(),
        });
        if (disposed) {
          handle.dispose();
          return;
        }
        cbRef.current.onReady(handle);
      } catch {
        // Sin escena no hay show, pero el login no puede depender del show.
        if (!disposed) cbRef.current.onSceneError();
      }
    })();
    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, []);

  return (
    <>
      {/* Los ids se conservan porque el CSS de A4 los estilea; el módulo ya no los busca. */}
      <canvas id="scene" ref={canvasRef} aria-hidden="true" />
      <div id="fade" ref={fadeRef} aria-hidden="true" />
    </>
  );
}
