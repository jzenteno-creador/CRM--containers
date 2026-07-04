// CRM-DETENTION — Flight Deck design tokens
// Mergear en tailwind.config.ts (theme.extend). Fuente de verdad: design_handoff README + artboard 2f.

export const flightDeckTokens = {
  colors: {
    // superficies (jerarquía por elevación, no por bordes)
    bg: {
      base: "#0A0C10", // fondo de app
      rail: "#07090C", // rail de navegación (nivel -1)
    },
    surface: {
      1: "#0E1218", // paneles (nivel +1)
      2: "#10141B", // celdas anidadas, hover de fila
      selected: "#10202A", // fila seleccionada (palette, listas)
    },
    border: {
      subtle: "#151A21", // divisores estructurales
      strong: "#1C2530", // inputs, chips, controles
    },
    text: {
      primary: "#E6EAF0",
      secondary: "#B8C0CC",
      muted: "#8A94A6",
      faint: "#5A6474",
      label: "#6B7585", // labels micro uppercase
    },
    // accent frío — SOLO acciones, foco, filtros activos, sort
    accent: {
      500: "#22D3EE",
      hover: "#4ADEF5",
      muted: "#164E5F", // bordes de chips accent
    },
    // semáforo (estado_semaforo del modelo)
    status: {
      green: "#34D399", // en free time
      greenDim: "#4E9F7E", // metadata verde secundaria
      amber: "#F0B849", // vence <72 h
      amberDeep: "#D9A23C", // labels ámbar uppercase
      red: "#F85149", // en demora — dots, bordes de fila, valores
      redSoft: "#FF8A83", // montos USD sobre dark (legibilidad)
    },
  },
  boxShadow: {
    "glow-red": "0 0 10px rgba(248,81,73,0.6)", // SOLO estado crítico
    "glow-red-soft": "0 0 8px rgba(248,81,73,0.5)", // dots de fila
    palette: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(34,211,238,0.06)",
  },
  fontFamily: {
    display: ["Archivo", "sans-serif"], // display/UI · font-stretch 115-120% en uppercase
    mono: ["JetBrains Mono", "monospace"], // números, IDs, timestamps · SIEMPRE tabular-nums
  },
  fontSize: {
    "label-micro": ["10.5px", { letterSpacing: "0.13em" }], // uppercase
    "col-header": ["10px", { letterSpacing: "0.11em" }], // headers de tabla, uppercase
    body: "12.5px",
    "num-cell": "13.5px", // mono 600
    "display-sm": ["13px", { letterSpacing: "0.1em" }], // títulos de panel, uppercase, 700
    "display-lg": ["17px", { letterSpacing: "0.12em" }], // título de vista, uppercase, 700
    "num-hero": "42px", // KPIs, mono 600-700
  },
  spacing: {
    // escala base 4px; alturas de fila 36-40px
    "row-h": "36px",
  },
  borderRadius: {
    chip: "6px",
    input: "9px",
    panel: "12px",
    palette: "14px",
  },
  transitionDuration: {
    fast: "150ms", // hover, focus, chips
    base: "200ms", // palette, dropdowns, badges
    slow: "250ms", // view transitions
  },
  transitionTimingFunction: {
    "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)", // todo lo que entra
  },
  // no-Tailwind (usar en JS/CSS custom):
  motion: {
    countUp: { duration: 1300, easing: "easeOutCubic" }, // KPIs al montar
    staggerRow: { perRow: 40, maxRows: 10 }, // reveal de listas
    gauge: { duration: 800, easing: "cubic-bezier(0.16,1,0.3,1)" }, // dasharray de RadialTimer
    skeleton: { shimmer: 1400, stagger: 150 },
    pulseDot: { duration: 2000 }, // dot rojo crítico
  },
} as const;
