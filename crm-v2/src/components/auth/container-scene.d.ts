// Firma pública de la escena A4. El .js es el módulo verificado de ~/work/crm-3d —
// se tipa acá afuera para no tocarlo.
export interface ContainerSceneHandle {
  /** Giro a la puerta + apertura + fade (3,30 s). Llamar SOLO con credencial aceptada. */
  playLoginSequence(): void;
  /** Dolly-in mientras un input del form tiene foco (efecto 4 de A4). */
  setFocusZoom(on: boolean): void;
  state(): {
    revealed: boolean;
    seqRunning: boolean;
    landRunning: boolean;
    tex: { total: number; loaded: number; errors: string[]; started: boolean };
  };
  dispose(): void;
}
export interface ContainerSceneOptions {
  canvas: HTMLCanvasElement;
  fadeEl: HTMLElement;
  /** Una sola vez: posado completo tras el reveal, reveal por timeout, o reduced-motion. */
  onFormReady?: () => void;
  /** Una sola vez, en SEQ.finalAt (3,40 s), con el fade ya opaco: navegar. */
  onSequenceEnd?: () => void;
}
export function initContainerScene(opts: ContainerSceneOptions): Promise<ContainerSceneHandle>;
