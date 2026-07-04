"use client";

// Count-up de KPIs (spec Flight Deck): 0→valor en 1300ms ease-out cubic, SOLO al montar.
// Updates posteriores (realtime) hacen snap directo sin animar.

import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, duration = 1300) {
  const [value, setValue] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else done.current = true;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
