"use client";

// Count-up de KPIs (spec Flight Deck): 0→valor en 1300ms ease-out cubic, SOLO al montar.
// Updates posteriores (realtime) hacen snap directo sin animar.
// `decimals` (default 0 = comportamiento histórico) redondea cada frame a N decimales
// para valores que la DB entrega con precisión fija (ej: demora promedio a 1 decimal).

import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, duration = 1300, decimals = 0) {
  const [value, setValue] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) {
      setValue(target);
      return;
    }
    const factor = Math.pow(10, decimals);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      if (p < 1) {
        setValue(Math.round(target * (1 - Math.pow(1 - p, 3)) * factor) / factor);
        raf = requestAnimationFrame(tick);
      } else {
        setValue(target);
        done.current = true;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, decimals]);
  return value;
}
