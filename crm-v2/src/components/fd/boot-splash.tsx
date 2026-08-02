"use client";

// Secuencia de arranque (pedido de John 2026-08-02: "cuando abrís tiene que
// aparecer el logo — contenedores — algo disruptivo"). Momento de marca de la
// app instalada: un contenedor que se DIBUJA en trazos (stroke draw-on), el
// reloj ámbar del ícono, y el wordmark revelándose. Corre EN PARALELO con la
// resolución de sesión (AppGate le garantiza ~1.1s de escena) — la percepción
// es "instrumento encendiéndose", no "pantalla de carga".
// Con prefers-reduced-motion todo aparece estático (globals.css ya anula
// animaciones); la escena sigue siendo la marca, sin movimiento.

const TRAZO: React.CSSProperties = {
  fill: "none",
  stroke: "var(--color-accent-500)",
  strokeWidth: 2.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/** Un path que se dibuja: pathLength=1 + dasharray 1 → animación de dashoffset. */
function Trazo({ d, delay, dur = 600 }: { d: string; delay: number; dur?: number }) {
  return (
    <path
      d={d}
      pathLength={1}
      style={{
        ...TRAZO,
        strokeDasharray: 1,
        strokeDashoffset: 1,
        animation: `fd-draw ${dur}ms var(--ease-out-expo) ${delay}ms forwards`,
      }}
    />
  );
}

export function BootSplash() {
  return (
    <div className="fd-boot" role="status" aria-label="iniciando CRM Detention">
      <div className="fd-boot-escena">
        <svg viewBox="0 0 240 150" width="min(300px, 72vw)" aria-hidden>
          {/* piso */}
          <Trazo d="M12 122 H228" delay={0} dur={500} />
          {/* cuerpo del contenedor */}
          <Trazo d="M28 42 H188 a6 6 0 0 1 6 6 V116 H22 V48 a6 6 0 0 1 6-6 Z" delay={150} dur={750} />
          {/* corrugado: costillas verticales, entrada escalonada */}
          {[46, 68, 90, 112, 134, 156].map((x, i) => (
            <Trazo key={x} d={`M${x} 52 V106`} delay={480 + i * 70} dur={320} />
          ))}
          {/* puerta: doble línea + falleba */}
          <Trazo d="M176 46 V116" delay={920} dur={300} />
          <Trazo d="M182 50 V112" delay={980} dur={300} />
          {/* reloj ámbar — el guiño al ícono de la app */}
          <circle
            cx={206}
            cy={30}
            r={15}
            style={{
              ...TRAZO,
              stroke: "var(--color-status-amber)",
              strokeDasharray: 1,
              strokeDashoffset: 1,
              animation: "fd-draw 500ms var(--ease-out-expo) 1050ms forwards",
            }}
            pathLength={1}
          />
          {/* aguja: nace y barre */}
          <g style={{ transformOrigin: "206px 30px", animation: "fd-boot-aguja 900ms var(--ease-out-expo) 1150ms both" }}>
            <path d="M206 30 V20" style={{ ...TRAZO, stroke: "var(--color-status-amber)", strokeWidth: 2.2, opacity: 0 , animation: "fd-boot-in 200ms linear 1150ms forwards"}} />
          </g>
        </svg>

        <div className="fd-boot-marca">
          <div className="fd-boot-wordmark fd-display">
            SSB<span>·</span>DETENTION
          </div>
          <div className="fd-boot-sub mono">CONTROL DE CONTENEDORES</div>
          <div className="fd-boot-scan" aria-hidden />
        </div>
      </div>
    </div>
  );
}
