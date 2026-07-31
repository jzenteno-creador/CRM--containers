# Flight Deck Re-skin — CRM Detention · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para implementar tarea por tarea. Los pasos usan checkboxes (`- [ ]`).

**Goal:** Re-skin visual completo del CRM Detention al design system Flight Deck (handoff `crm-detention/design_handoff_crm_detention/`), lógica de negocio intacta, en branch `flight-deck`, terminando en deploy PREVIEW de Vercel (nunca `--prod`).

**Architecture:** Estrategia de dos capas probada en sesión 5: (1) re-mapeo de las variables CSS legacy (`--surface-*`, `--text-accent`, etc.) a los valores Flight Deck → las 9 pantallas quedan consistentes de inmediato sin tocar estructura; (2) re-layout profundo por módulo siguiendo los artboards (Inicio, Contenedores, Detalle, Alertas) y extrapolación documentada para las 6 pantallas sin artboard. Componentes nuevos en `src/components/` usando utilidades Tailwind 4 generadas por `@theme`.

**Tech Stack:** Next.js 16.2.10 (App Router) · Tailwind 4 CSS-first (`@theme` en globals.css, NO hay tailwind.config) · Supabase JS (schema `detention`) · next/font (Archivo + JetBrains Mono) · Tabler Icons webfont (se mantiene).

## Global Constraints

- **Branch `flight-deck` SIEMPRE.** `master` = prod viva navy+oro hasta OK de John. Jamás commitear a master ni deployar `--prod`.
- **NO CAMBIA:** modelo de datos, carga por tanda en 2 fases, versionado freetime (INSERT nunca UPDATE), días en `America/Argentina/Buenos_Aires` con retiro = día 0, join por `naviera_id`, soft delete, guard de operación única, validación ISO 6346. Nada de esto vive en el front igualmente — vive en views/RPCs de la DB. No tocar `src/lib/` salvo lo indicado.
- **`<ContainerNumber value={numero_contenedor} />`** para TODO número de contenedor. Recibe el string ENTERO; parte internamente. NUNCA partir el dato en DB/query ni armar adapters.
- **Números siempre mono + `tabular-nums`.** Montos USD en `--color-status-red-soft` (#FF8A83).
- **Mobile NO NEGOCIABLE:** se opera en depósito con el dedo. Vistas densas DEGRADAN a cards/stack (patrones `hide-sm` existentes), no se encogen. Touch targets ≥44px, inputs 16px (evita zoom iOS). Verificar 375px en cada módulo.
- **Estados vacío/cargando/error obligatorios** en cada vista (hoy via `ui.tsx`); cargando pasa a SkeletonRow, NUNCA spinners.
- **Verificación visual real** (lección sesión 5): browser + screenshot + `getComputedStyle()` en los overrides de background/color/border. No afirmar "se ve bien" por lectura de código.
- **Clases nuevas con namespace** (`fd-*`): `.ok`/`.err`/`.badge` globales ya mordieron dos veces.
- **Next.js 16 ≠ training data:** leer `node_modules/next/dist/docs/` ante cualquier duda de API (AGENTS.md).
- **Commits granulares** por tarea (features nuevas), mensaje en español. Iteración visual posterior = 1 commit consolidado.
- **NUNCA secrets en el repo.** `.gitignore` ya cubre `.env*`. Env vars ya están en Vercel.
- **Fuera de alcance (decisión John/plan):** barra IA con NL→filtros (queda input + chips estructurales funcionales), botón "Solicitar waiver" del artboard 2c (no existe la mutación; lógica intacta), optimistic updates (se mantiene refetch + realtime actual, ya existente y correcto).
- Fuente de verdad del diseño: `design_handoff_crm_detention/README.md` + `tailwind.tokens.ts` + mockup `Flight Deck - Sistema completo.dc.html` (abrirlo en browser para comparar). Fidelity: high — pixel-perfect.

---

### Task 0: Branch + housekeeping del bundle de diseño

**Files:**
- Versionar: `crm-detention/design_handoff_crm_detention/` (4 archivos)
- Borrar: `crm-detention/CRM-Detention operations design/` (duplicado), `crm-detention/CRM-Detention operations design.zip`, `"...zip:Zone.Identifier"` (raíz del repo)

- [ ] **Step 1:** `git checkout -b flight-deck`
- [ ] **Step 2:** Borrar duplicado + zip + Zone.Identifier:
```bash
cd /home/jzenteno/projects/Crm-containers
rm -rf "crm-detention/CRM-Detention operations design" "crm-detention/CRM-Detention operations design.zip"
rm -f "crm-detention/CRM-Detention operations design.zip:Zone.Identifier"
```
- [ ] **Step 3:** `git add crm-detention/design_handoff_crm_detention/ docs/superpowers/plans/2026-07-04-flight-deck-reskin.md && git status` — verificar que NO entra ningún `.env` ni el zip.
- [ ] **Step 4:** Commit: `Flight Deck: bundle de diseño canónico versionado + plan maestro (duplicado y zip eliminados)`

### Task 1: Fundación — fuentes + tokens `@theme` + re-mapeo de variables legacy

**Files:**
- Modify: `crm-detention/src/app/layout.tsx` (fuentes)
- Modify: `crm-detention/src/app/globals.css` (reescritura de `:root` + bloque `@theme` + restyle de clases base)

**Interfaces (produce):** variables CSS `--color-*`, `--font-display`, `--font-mono` y utilidades Tailwind `text-accent-500`, `text-text-primary`, `text-text-faint`, `bg-surface-1`, `border-border-subtle`, etc. — las consumen TODOS los componentes nuevos (ContainerNumber las usa tal cual).

- [ ] **Step 1:** En `layout.tsx`: reemplazar `IBM_Plex_Mono`/`IBM_Plex_Sans` por `JetBrains_Mono`; Archivo pasa a variable con eje `wdth`:
```tsx
import { Archivo, JetBrains_Mono } from "next/font/google";
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: "variable", variable: "--font-jetbrains" });
// html className: `${archivo.variable} ${jetbrains.variable}`
```
Tabler icons CDN link se mantiene.
- [ ] **Step 2:** En `globals.css`, después de `@import "tailwindcss";` agregar el bloque `@theme` (fuente: `tailwind.tokens.ts`, traducido a Tailwind 4):
```css
@theme {
  --color-bg-base: #0A0C10;  --color-bg-rail: #07090C;
  --color-surface-1: #0E1218; --color-surface-2: #10141B; --color-surface-selected: #10202A;
  --color-border-subtle: #151A21; --color-border-strong: #1C2530;
  --color-text-primary: #E6EAF0; --color-text-secondary: #B8C0CC;
  --color-text-muted: #8A94A6; --color-text-faint: #5A6474; --color-text-label: #6B7585;
  --color-accent-500: #22D3EE; --color-accent-hover: #4ADEF5; --color-accent-muted: #164E5F;
  --color-status-green: #34D399; --color-status-green-dim: #4E9F7E;
  --color-status-amber: #F0B849; --color-status-amber-deep: #D9A23C;
  --color-status-red: #F85149; --color-status-red-soft: #FF8A83;
  --font-display: var(--font-archivo), sans-serif;
  --font-mono: var(--font-jetbrains), ui-monospace, monospace;
  --shadow-glow-red: 0 0 10px rgba(248,81,73,0.6);
  --shadow-glow-red-soft: 0 0 8px rgba(248,81,73,0.5);
  --shadow-palette: 0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(34,211,238,0.06);
  --radius-chip: 6px; --radius-input: 9px; --radius-panel: 12px; --radius-palette: 14px;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}
```
- [ ] **Step 3:** Re-mapear el `:root` legacy a Flight Deck (las 9 pantallas se re-skinean solas — estrategia sesión 5). Mapa exacto:

| Var legacy | Antes (navy+oro) | Ahora (Flight Deck) |
|---|---|---|
| `--surface-0` | #0b1620 | `#0A0C10` (bg-base) |
| `--surface-1` | #0e1e2a | `#0E1218` |
| `--surface-2` | #142633 | `#10141B` |
| `--surface-3` | #1a3040 | `#10202A` (hover/selected) |
| `--text-primary/secondary/muted` | — | `#E6EAF0` / `#B8C0CC` / `#8A94A6` |
| `--border` / `--border-strong` | rgba azul | `#151A21` / `#1C2530` |
| `--text-accent` / `--bg-accent` / `--border-accent` | oro | `#22D3EE` / `rgba(34,211,238,0.10)` / `rgba(34,211,238,0.35)` |
| `--text-warning` / bg / border | oro | `#F0B849` / al 10% / al 35% |
| `--text-danger` / bg / border | #f2685f | `#F85149` / `rgba(248,81,73,0.09)` / al 32% |
| `--text-success` / bg / border | #43cd8b | `#34D399` / al 9% / al 32% |
| `--gold-ink` | #241a06 | `#06171B` (texto sobre botón cyan sólido; renombrar mentalmente "accent-ink") |
| `--radius` | 8px | `9px` (inputs/celdas) |

- [ ] **Step 4:** Restyle de clases base al spec (sin tocar su API): `body` → `font-size: 12.5px` bg `--surface-0`; `.kpi .v` → `font-family: var(--font-mono)` (números mono, no display); `table.t th` → 10px tracking 0.11em color `--text-label`; `.crm-card`/paneles → radius 12; filas 36-40px; `.chip` → radius 6 tonal (texto pleno, bg 8-10%, border 30-35%); botón `.btn-primary` → cyan `#22D3EE` hover `#4ADEF5` texto `--gold-ink`; inputs focus border cyan. Agregar utilidades nuevas namespaced:
```css
.fd-usd { color: var(--color-status-red-soft); }
.fd-label { font-size: 10.5px; letter-spacing: 0.13em; text-transform: uppercase; color: var(--color-text-label); }
.fd-display { font-family: var(--font-display); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; font-stretch: 118%; }
@keyframes fd-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.45 } }
@keyframes fd-shimmer { 0% { background-position: -200px 0 } 100% { background-position: 200px 0 } }
@keyframes fd-reveal { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
```
Reglas mobile existentes (`@media 640px`, `hide-sm`, touch targets, `.ft-meter`) NO se tocan en esta tarea.
- [ ] **Step 5:** Verificar: `npm run build` verde → `npm run dev` → screenshot 1440px y 375px de /inicio, /alertas, /ingreso. Todo debe verse Flight Deck "básico" (dark casi negro + cyan) sin roturas de layout. `getComputedStyle` sobre `.btn-primary` (background = rgb(34,211,238)) y `body` (font 12.5px).
- [ ] **Step 6:** Commit: `Flight Deck fundación: tokens @theme + re-mapeo de variables + Archivo/JetBrains Mono`

### Task 2: Shell — rail izquierdo desktop + bottom-bar mobile

**Files:**
- Modify: `crm-detention/src/components/nav.tsx`
- Modify: `crm-detention/src/app/(crm)/layout.tsx`
- Modify: `crm-detention/src/app/globals.css` (clases `fd-rail`, `fd-topbar`, `fd-bottombar`)

**Interfaces (produce):** shell `rail 60px (desktop ≥900px) + header 58px + main`; en <900px el rail desaparece y aparece bottom-bar fija. `TABS` de nav.tsx no cambia (8 solapas, admin gated por rol).

- [ ] **Step 1:** Rail desktop: fijo izquierda, 60px, `bg #07090C`, border-right `#151A21`, iconos Tabler 17px centrados, tab activa con icono cyan + barra 2px cyan a la izquierda, tooltip con label al hover. Logo dot arriba, avatar/logout abajo.
- [ ] **Step 2:** Header 58px: título de vista `.fd-display` 17px + reloj mono (client-only, `America/Argentina/Buenos_Aires`) + kbd ⌘K (abre palette — placeholder hasta Task 5) + badge "EN VIVO" con dot verde pulsante 2.4s (solo en /inicio).
- [ ] **Step 3:** Mobile <900px: rail `display:none`; bottom-bar fija (height 56px + safe-area-inset-bottom), scroll horizontal como el nav actual, iconos+label 10px, touch ≥44px; `main` con `padding-bottom: 72px`. Se conserva TODO el bloque `@media 640px` existente.
- [ ] **Step 4:** El wrapper `.crm-wrap` (max-width 1180) queda solo para las vistas de formulario; las vistas densas (inicio, contenedores, alertas) pasan a full-width en sus tareas respectivas.
- [ ] **Step 5:** Verificar: build + screenshots 1440/375 de 3 rutas; en 375 la bottom-bar no tapa contenido (getBoundingClientRect del último elemento visible).
- [ ] **Step 6:** Commit: `Flight Deck shell: rail 60px + header 58px + bottom-bar mobile`

### Task 3: ContainerNumber + reemplazo de los ~30 sitios

**Files:**
- Create: `crm-detention/src/components/container-number.tsx` (copiar VERBATIM de `design_handoff_crm_detention/components/ContainerNumber.tsx`)
- Modify: todos los sitios que rendericen `numero_contenedor` en `app/(crm)/**/*.tsx`, `app/login/*` si aplica

**Interfaces (consume):** utilidades `text-accent-500` / `text-text-primary` / `text-text-faint` de Task 1. **Produce:** `<ContainerNumber value={string} colorize?: boolean />`.

- [ ] **Step 1:** Copiar el componente del handoff sin modificar (ya verificado: API `value: string`, parte internamente slice 0-4/4-10/10-11, spans adyacentes sin whitespace).
- [ ] **Step 2:** `grep -rn "numero_contenedor" src/app --include="*.tsx"` y reemplazar cada render crudo (`{op.numero_contenedor}`, `{c.numero_contenedor}` etc.) por `<ContainerNumber value={...} />`. NO tocar usos en queries/`.or(`/`.select`/tipos. En contextos no-tabla (títulos de ficha) usar `className` para tamaño.
- [ ] **Step 3:** Verificar: build verde + en browser: click en un número lo selecciona entero; copiar y pegar en consola devuelve el string contiguo exacto (sin espacios). Screenshot de /contenedores y /alertas.
- [ ] **Step 4:** Commit: `Flight Deck: ContainerNumber en todos los renders de numero_contenedor`

### Task 4: Componentes base — StatusBadge, KpiCard/useCountUp, RadialTimer, SkeletonRow

**Files:**
- Create: `crm-detention/src/components/fd/status-badge.tsx`, `kpi-card.tsx`, `radial-timer.tsx`, `skeleton-row.tsx`, `use-count-up.ts`
- Modify: `globals.css` (clases `fd-badge*`, `fd-skel`)

**Interfaces (produce):**
- `StatusBadge({ estado: "verde"|"amarillo"|"rojo"|"neutro", children })` — mapea el `estado_semaforo` de `vista_alertas` tal cual. Tonal; solo rojo lleva dot pulsante 2s + glow.
- `KpiCard({ label, value: number, sub, critical?: boolean, prefix? })` — label `.fd-label` → valor mono 42px tabular con count-up → sub 11.5px. `critical` tiñe `#FF8A83` + gradiente rojo 5%.
- `RadialTimer({ pct: number, color: "green"|"amber"|"red", size?, label?, sublabel? })`.
- `SkeletonRow({ cols?: string })` — shimmer 1.4s, stagger 150ms, misma grilla que la fila real.
- `useCountUp(target: number, duration = 1300): number` — anima solo el primer mount; updates posteriores (realtime) hacen snap.

- [ ] **Step 1:** `use-count-up.ts`:
```tsx
"use client";
import { useEffect, useRef, useState } from "react";
export function useCountUp(target: number, duration = 1300) {
  const [value, setValue] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) { setValue(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick); else done.current = true;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
```
- [ ] **Step 2:** `radial-timer.tsx` (spec 2f exacto — r=15.9155, stroke 3, rotate(-90 18 18)):
```tsx
"use client";
import { useEffect, useState } from "react";
const STROKE = { green: "#34D399", amber: "#F0B849", red: "#F85149" } as const;
type Props = { pct: number; color: keyof typeof STROKE; size?: number; label?: string; sublabel?: string };
export function RadialTimer({ pct, color, size = 44, label, sublabel }: Props) {
  const clamped = Math.max(0, Math.min(100, pct));
  const [dash, setDash] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setDash(clamped)); return () => cancelAnimationFrame(id); }, [clamped]);
  const critical = color === "red" && clamped >= 100;
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} role="img" aria-label={label ?? `${clamped}%`}
      style={critical ? { filter: "drop-shadow(0 0 4px rgba(248,81,73,0.5))" } : undefined}>
      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--color-border-strong)" strokeWidth="3" />
      <circle cx="18" cy="18" r="15.9155" fill="none" stroke={STROKE[color]} strokeWidth="3"
        strokeDasharray={`${dash} ${100 - dash}`} strokeLinecap={critical ? "butt" : "round"}
        transform="rotate(-90 18 18)" style={{ transition: "stroke-dasharray 800ms cubic-bezier(0.16,1,0.3,1)" }} />
      {label && <text x="18" y={sublabel ? "16.5" : "20.5"} textAnchor="middle"
        style={{ fill: "var(--color-text-primary)", font: "600 7.5px var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{label}</text>}
      {sublabel && <text x="18" y="24.5" textAnchor="middle" style={{ fill: "var(--color-text-muted)", font: "400 4.5px var(--font-mono)" }}>{sublabel}</text>}
    </svg>
  );
}
```
- [ ] **Step 3:** `status-badge.tsx`: los 4 estados como chip tonal (verde "EN FREE TIME" / ámbar "<72 H" / rojo "EN DEMORA" con `<i class="fd-dot-pulse">` + glow / neutro "CERRADO"). Texto configurable via children; los colores salen de las vars de Task 1.
- [ ] **Step 4:** `kpi-card.tsx` usando `useCountUp`; `skeleton-row.tsx` con `display:grid; gridTemplateColumns: cols` y barras `fd-skel` (gradient `#10141B→#151A21→#10141B`, `fd-shimmer 1.4s`, `animation-delay: index*150ms`).
- [ ] **Step 5:** Reemplazar `Cargando` por skeletons SOLO donde haya tabla (cada módulo lo consume en su tarea; acá solo se exportan). Build verde. Página de prueba temporal NO — se verifican al integrarlos en Task 6.
- [ ] **Step 6:** Commit: `Flight Deck: componentes base (StatusBadge, KpiCard count-up, RadialTimer, SkeletonRow)`

### Task 5: CommandPalette ⌘K global

**Files:**
- Create: `crm-detention/src/components/fd/command-palette.tsx`
- Modify: `crm-detention/src/app/(crm)/layout.tsx` (montarla global), `nav.tsx`/header (botón ⌘K)

**Interfaces (consume):** `ContainerNumber`, dot semáforo. **Produce:** palette global con estado abierta/cerrada, atajo ⌘K/Ctrl+K, ESC cierra, ↑↓ navega, ↵ abre.

- [ ] **Step 1:** Modal 640px top 72px, `bg #0E1218` border `#1C2530` radius 14, shadow palette, backdrop `rgba(4,5,7,0.55)` + `backdrop-filter: blur(2px)`. Apertura `scale(0.98)→1` + fade 200ms `--ease-out-expo`.
- [ ] **Step 2:** Búsqueda: debounce 250ms → `supabase.from("operaciones").select("id, numero_contenedor:contenedores(numero_contenedor), ...").or(...)` — reusar el patrón de búsqueda EXACTO de `contenedores/page.tsx:137` (mismo select/ilike, límite 8). Grupo "Contenedores": dot semáforo + ContainerNumber + metadata + "↵ abrir" → `router.push("/contenedores/" + id)`. Grupo "Acciones": ir a Ingreso (I), Egreso (E), Alertas (A) — `router.push`, kbd visible.
- [ ] **Step 3:** Fila seleccionada `bg #10202A` + border-left 2px cyan. Footer hints. Mobile: full-width con margin 12, se abre desde botón lupa del header (no hay ⌘K con dedo).
- [ ] **Step 4:** Verificar en browser: ⌘K abre, tipeo "MRKU" lista resultados reales de la DB, ↵ navega a la ficha, ESC cierra. Screenshot.
- [ ] **Step 5:** Commit: `Flight Deck: command palette ⌘K con búsqueda real y acciones`

### Task 6: Inicio — command center (pantalla hero, artboard 2a)

**Files:**
- Modify: `crm-detention/src/app/(crm)/inicio/page.tsx` (re-layout completo; RPC/fetch/realtime NO se tocan)

**Interfaces (consume):** KpiCard, StatusBadge, ContainerNumber, SkeletonRow, RadialTimer. Los datos ya están: RPC `crm_dashboard` v2 + `vista_alertas` + realtime.

- [ ] **Step 1:** Layout full-width: strip 4 KPIs (grid `1fr 1fr 1.3fr 1fr`, divididos por border, sin cards): activos · días demora acum. · **costo proyectado USD (critical)** · deadlines <72h (ámbar). Cuerpo grid `1fr 372px` gap 16 padding `16px 20px 20px`.
- [ ] **Step 2:** Columna izquierda: panel EN DEMORA (grid `190px 1fr 150px 92px 96px 110px`, filas 40px, border-left 2px rojo) → POR VENCER <72H (filas con barra de free time consumido ámbar — adaptar `.ft-meter` existente a colores nuevos) → EN FREE TIME (grid 6 cards por naviera). Fuente de datos: `vista_alertas` filtrada por semáforo (agregar UN fetch a la vista si el RPC no trae el detalle por fila — solo lectura, sin tocar el RPC).
- [ ] **Step 3:** Columna derecha: POSICIÓN DE FLOTA (por planta: label + barra + count — datos del RPC) → ACTIVIDAD (feed de `operacion_eventos` últimos 12: hora mono + dot color por tipo_evento + texto 12.5px).
- [ ] **Step 4 (CORRECCIÓN DURA de John):** Los paneles de costo por naviera, tendencia mensual e histórico 2020-26 se CONSERVAN SÍ O SÍ debajo del grid principal — son los KPIs de plata del demo al dueño (spec §9), no negociable. Restyle con tokens Flight Deck: paneles surface-1, series en cyan + colores de estado, cifras mono/tabular-nums, títulos `.fd-display`, componiendo SOLO patrones de los artboards. NO dropearlos ni moverlos a otra vista. Si preservarlos exige una decisión visual más allá del swap de tokens, resolverla con el vocabulario existente y ANOTARLA en el reporte final para revisión en el preview.
- [ ] **Step 5:** Mobile 375: KPIs 2×2 → columnas apiladas (izq primero), paneles como cards stack, feed al final. Reglas `hide-sm` en columnas secundarias de EN DEMORA.
- [ ] **Step 6:** Estados: skeletons (misma grilla), vacío por panel ("sin contenedores en demora ✓"), error con retry. Count-up verificado a ojo + stagger 40ms en filas.
- [ ] **Step 7:** Verificar contra mockup 2a lado a lado (browser) + 375px + `getComputedStyle` del KPI crítico (color rgb(255,138,131)). Comparar cifras contra prod navy+oro (mismos números, mismo día).
- [ ] **Step 8:** Commit: `Flight Deck Inicio: command center (KPI strip, en demora, por vencer, flota, actividad)`

### Task 7: Contenedores — planilla densa (2b) + chips de filtros funcionales

**Files:**
- Modify: `crm-detention/src/app/(crm)/contenedores/page.tsx`

- [ ] **Step 1:** Header: título + contadores + botón primario "+ Registrar retiro" (→ `/ingreso`). Barra de filtros: input de búsqueda (estado `busqueda` existente) + dropdowns planta/estado/semáforo existentes + **chips cyan removibles**: cada filtro activo rinde un chip `planta: BAHIA ×` que al cerrarse resetea ese estado (los setState ya existen — los chips son representación, cero lógica nueva) + "limpiar filtros".
- [ ] **Step 2:** Tabla grid denso full-width: `30px 176px 116px 58px 1fr 138px 76px 68px 68px 92px 84px 108px` gap 12, header sticky `bg #0C0E13` labels 10px uppercase, sort activo cyan. Fila: dot semáforo (glow solo rojo), ContainerNumber, chip tonal de estado ciclo (cargado=cyan, en planta=verde, tránsito=neutro), restantes coloreado por semáforo (negativos "−6" rojos), costo `.fd-usd` o "—" faint. Hover `#10141B`. Datos/orden/paginación existentes intactos.
- [ ] **Step 3:** Mobile 375: la grilla densa DEGRADA a cards stack (patrón fila expandible actual): línea 1 dot + ContainerNumber + estado, línea 2 estadía/libres/restantes mono, línea 3 costo. `hide-sm` para naviera/tipo/posición. Tap = expandir (comportamiento actual).
- [ ] **Step 4:** SkeletonRow con la misma grilla; estados vacío/error.
- [ ] **Step 5:** Verificar vs mockup 2b + 375px + chips filtran de verdad (click chip × → tabla refetch).
- [ ] **Step 6:** Commit: `Flight Deck Contenedores: planilla densa + chips de filtro funcionales`

### Task 8: Detalle de contenedor (2c) — timeline + gauge + desglose

**Files:**
- Modify: `crm-detention/src/app/(crm)/contenedores/[id]/page.tsx` (re-layout; RPCs de movimiento/anulación/reforzado intactas)

- [ ] **Step 1:** Header: back + `<ContainerNumber className="text-[26px]" />` + badges estado/tipo/reforzado + acción "Registrar egreso →" primaria (→ `/egreso`). SIN botón waiver (fuera de alcance).
- [ ] **Step 2:** Spec strip: grid 7 celdas (booking, buque/viaje, destino, orden, SHP, retiro de, tarifa vigente) — datos ya cargados por `fetchTodo`.
- [ ] **Step 3:** Cuerpo `1fr 420px`. Izquierda: timeline de `operacion_eventos` (fecha+hora mono col 96px right · dot 12px + conectora 2px · título 13.5/600 + detalle). Estados: completado verde relleno / hito fin free time rojo hueco + chip "HITO" (calculado: fecha_retiro + dias_libres, dato ya presente vía vista) / en curso rojo + glow + pulso / futuro gris. Derecha: `RadialTimer` 148px (pct = dias_transcurridos/dias_libres, color por semáforo) + stats + panel DESGLOSE DE CARGOS (días × tarifa mono, total 24px `.fd-usd` + text-shadow glow, nota de versión de tarifa al pie).
- [ ] **Step 4:** Los formularios existentes (movimiento entre plantas, incidencias, anular, reforzado) se conservan como paneles surface-1 debajo, re-skineados — funcionalidad intacta.
- [ ] **Step 5:** Mobile: header stack, spec strip 2 col, timeline full, gauge centrado arriba del desglose.
- [ ] **Step 6:** Verificar vs 2c con una operación real abierta y una cerrada + 375px. Confirmar que el desglose reproduce el costo de `vista_alertas` (mismo número — no recalcular distinto: usar los campos de la vista).
- [ ] **Step 7:** Commit: `Flight Deck Detalle: timeline de eventos + gauge radial + desglose de cargos`

### Task 9: Alertas — triage (2d) — THINK HARD acá

**Files:**
- Modify: `crm-detention/src/app/(crm)/alertas/page.tsx`

**Riesgo real (del prompt):** acá vive el semáforo/costo. REGLA: TODO número mostrado sale de `vista_alertas` (dias_transcurridos, dias_restantes, costo_proyectado, estado_semaforo) — el front NO recalcula días ni costos, solo deriva presentación (pct del timer, "+US$ X mañana" = tarifa_usd_dia de la fila). Cero matemática de fechas nueva en el front.

- [ ] **Step 1:** Header con contadores por grupo (KPIs existentes). Grid 2 columnas: izquierda EN DEMORA (filas con RadialTimer 44px al 100% rojo + ContainerNumber + "US$ {costo_proyectado} acum" + "+US$ {tarifa} mañana"); derecha VENCEN <72H (RadialTimer ámbar, pct = consumido, horas restantes en el centro = dias_restantes*24 aproximado con label "vence {dia}") + HORIZONTE 3-7 DÍAS (filas compactas con barra verde de restante) + footer "+N en free time >7 días".
- [ ] **Step 2:** Orden dias_restantes ↑ (ya viene así). Filtros existentes (naviera/semáforo) como chips funcionales (patrón Task 7).
- [ ] **Step 3:** Mobile 375 (pantalla de operación con el dedo — la MÁS crítica): grupos apilados EN DEMORA → <72H → HORIZONTE, cada fila conserva contenedor + timer + costo visibles sin scroll horizontal (regla verificada en sesión 5: right < 375).
- [ ] **Step 4:** Skeletons/vacío ("sin demoras ✓" verde)/error. Umbral configurable de Admin sigue mandando en los cortes de grupo (campo ya presente en el fetch).
- [ ] **Step 5:** Verificar: cifras idénticas a la solapa Alertas de prod (mismo día, mismos totales por grupo) + mockup 2d + 375 + `getBoundingClientRect` de la fila más larga.
- [ ] **Step 6:** Commit: `Flight Deck Alertas: triage 2 columnas con timers radiales (números 100% de vista_alertas)`

### Tasks 10-15: pantallas SIN artboard — extrapolación (ver §Extrapolación al final, validada por John)

### Task 10: Ingreso

**Files:** `app/(crm)/ingreso/page.tsx`, `fase-retiro.tsx`, `fase-pendientes.tsx`
- [ ] Encabezado de tanda = **spec strip invertido** (grid 6 inputs con `.fd-label`); textarea de pegado mono 13.5 con contador de líneas válidas ISO; tabla parseada = DataRow con ContainerNumber + chip rojo tonal "PREFIJO RESTRINGIDO" / suave "ex-restringido" (lógica intacta); botón primario cyan "Crear N operaciones"; toggle tránsito corto como chip switch. Fase 2 = tabla con checkboxes (patrón 2b simplificado) + skeletons. Mobile: form 1 col (regla `@media` existente), tabla → cards con checkbox 24px.
- [ ] Verificar: alta de tanda de PRUEBA con 2 contenedores válidos → confirmar en fase 2 → **anular ambas operaciones** desde la ficha (soft delete — no ensuciar la DB). Build + 375. Commit: `Flight Deck Ingreso: tanda 2 fases`

### Task 11: Egreso

**Files:** `app/(crm)/egreso/page.tsx`
- [ ] Fase 1: buscador/pegado (input mono) + tabla selección (patrón 2b: dot + ContainerNumber + planta + estadía) + panel de asignación por lote = spec strip de 2c como formulario (booking, buque, destino, orden, shp) que aparece si `tipo_cierre=embarcado`; botones cyan "Confirmar salida". Fase 2 pendientes de devolución: tabla checkbox + fecha + botón — **la acción que corta freetime lleva confirmación visual fuerte** (banner resultado con contenedores afectados). Mobile: igual a Ingreso.
- [ ] Verificar solo build + estados + 375 (NO ejecutar egresos reales — no hay op de prueba en planta; smoke E2E queda para Fase 3 con la tanda de prueba de Task 10 si John lo pide). Commit: `Flight Deck Egreso: salida + devolución 2 fases`

### Task 12: Incidencias

**Files:** `app/(crm)/incidencias/page.tsx`
- [ ] Alta = panel form (patrón Ingreso) con picker de operación (búsqueda mono), tipo como chips seleccionables tonales (avería sufrida ámbar / recepcionada rojo / otro neutro), dropzone de fotos radius 9 border-strong con thumbnails 64px. Historial = **feed ACTIVIDAD de 2a**: hora mono + dot por tipo + texto + thumbnails + ContainerNumber. Realtime intacto. Mobile: form 1 col, feed full-width, fotos grid 3.
- [ ] Verificar: build + estados + 375. Commit: `Flight Deck Incidencias: alta con fotos + feed`

### Task 13: Admin

**Files:** `app/(crm)/admin/page.tsx` (739 líneas — leer entero antes)
- [ ] Secciones como paneles surface-1 con títulos `.fd-display` 13px: Tarifas freetime = tabla 2b-simplificada con fila vigente destacada (chip verde "VIGENTE") e histórico muted + form "nueva versión" (INSERT — RPC intacta) con nota explícita "las versiones nunca se pisan"; Usuarios = tabla + toggle activo (switch cyan); Navieras/Plantas = listas simples; Umbral = input numérico con hint. Mobile: paneles stack.
- [ ] Verificar: build + crear y verificar UNA versión de tarifa de prueba en naviera ZIM (sin ops activas, impacto $0 — verificar en Alertas que nada cambió) + 375. Commit: `Flight Deck Admin`

### Task 14: Historial + Login

**Files:** `app/(crm)/historial/page.tsx`, `app/login/page.tsx` (actions.ts NO se toca)
- [ ] Historial = **reuso directo del patrón 2b**: tabla sticky-header + paginación footer (server-side intacta) + búsqueda input mono + chips de filtro (naviera, rango devolución) + ficha expandible = spec strip 2c dentro de la fila. Mobile: cards con las 4 columnas clave (regla sesión 5: contenedor + estadía + costo visibles).
- [ ] Login: split institucional se CONSERVA (estructura verificada) con piel Flight Deck: fondo `#0A0C10`, grid pattern con `#151A21`, eyebrow JetBrains Mono cyan, wordmark Archivo stretch 118%, form panel surface-1, botón primario cyan, `.logo-slot` SSB/Dow intactos. Mobile: brand oculto (regla existente).
- [ ] Verificar: búsqueda ZIMU1022976 devuelve la ficha (caso verificado sesión 5), paginación "1-50 de 2.880", login con las 3 credenciales demo + 375. Commit: `Flight Deck Historial + Login`

### Task 15: Verificación global + deploy PREVIEW

- [ ] **Step 1:** `npm run build` sin errores ni warnings de tipos; `npm run lint` limpio.
- [ ] **Step 2:** Pasada visual completa: 9 rutas × (1440px + 375px) con screenshots; checklist de estados (skeleton al cargar, vacío con filtros imposibles, error desconectando red en devtools) por vista; `getComputedStyle` en: KPI crítico, botón primario, badge rojo (los 3 overrides con historial de specificity).
- [ ] **Step 3:** Smoke funcional read-only: login 3 roles (operador ve solo su planta en Contenedores/Alertas), ⌘K busca y navega, dashboard ata cifras con prod navy+oro del mismo día, alertas ordenadas por días restantes, admin lista versiones de tarifa. **Además (pedido de John): verificación ESTÁTICA del form de Egreso — renderiza en ambas fases y los botones de confirmar están cableados al RPC correcto (`crm_registrar_salida_planta` en fase 1, `crm_confirmar_devolucion` en fase 2), verificado por lectura de código + render, SIN ejecutar ninguna mutación (no contaminar prod ni cortar freetime real).**
- [ ] **Step 4:** `git push -u origin flight-deck` → preview automático de Vercel (o `cd crm-detention && npx vercel deploy --yes` SIN `--prod`). Verificar que la URL de preview carga y loguea.
- [ ] **Step 5:** Reportar a John: URL del preview + screenshots + desvíos del mockup. **FRENAR. NO promover a --prod sin OK explícito.**

---

## §Extrapolación — cómo se derivan las 6 pantallas sin artboard

Principio: **cero vocabulario visual nuevo.** Cada pantalla sin artboard se compone SOLO de patrones que los artboards ya definen. Si un elemento no mapea a ningún patrón, se estiliza con tokens crudos (panel surface-1 + labels micro) y se anota como desvío en el reporte final.

| Pantalla | Patrones de artboard reutilizados | Qué NO se inventa |
|---|---|---|
| **Ingreso** | Spec strip 2c (invertido: celdas → inputs) para encabezado de tanda · tabla 2b para parseo y fase 2 · chips tonales 2f para prefijos restringidos · botón primario 2b | Sin layouts nuevos: form = grid de celdas labeladas, igual anatomía label-micro→valor que el spec strip |
| **Egreso** | Idéntico a Ingreso + spec strip como form de asignación (los MISMOS 7 campos del strip de 2c: booking, buque, destino, orden, shp — simetría carga/lectura) | El resultado de "confirmar devolución" usa el banner estándar, no un modal nuevo |
| **Incidencias** | Feed ACTIVIDAD de 2a para el historial · form patrón Ingreso · chips 2f para tipo | Thumbnails = radius input (9px) + border-strong, sin lightbox nuevo |
| **Admin** | Tabla 2b simplificada (menos columnas, mismos headers 10px sticky) · chips VIGENTE verde tonal · paneles 2a | Toggles = switch con track cyan (única pieza semi-nueva, anatomía de chip) |
| **Historial** | Tabla 2b COMPLETA (es la misma planilla, cerradas) · ficha expandible = spec strip 2c embebido · paginación 2b | Nada — es literalmente 2b + 2c |
| **Login** | Estructura actual (split institucional, verificada) + tokens: bg-base, grid-pattern border-subtle, eyebrow mono cyan, botón primario | No se rediseña el layout del login: solo cambia la piel |

**Regla mobile de degradación** (aplica a TODAS): tabla densa → cards apiladas donde línea 1 = identidad (dot + ContainerNumber + estado), línea 2 = números clave mono (estadía/libres/restantes o costo), resto `hide-sm` dentro del expandible; forms → 1 columna; grids de KPI → 2×2; touch ≥44px; inputs 16px. Es la codificación de lo que sesión 5 ya verificó en prod.

## Self-review (hecho)

- Cobertura: 5 pantallas del handoff → Tasks 5-9 ✓ · componentes 2f → Tasks 3-4 ✓ · interacciones (count-up/stagger/skeleton/badges/palette) → Tasks 1,4,5 ✓ · 6 sin artboard → Tasks 10-14 + §Extrapolación ✓ · deploy preview → Task 15 ✓.
- Desvíos deliberados y visibles: barra NL diferida, waiver omitido, optimistic updates → refetch+realtime actual, View Transitions → fade CSS simple (Next 16: verificar soporte en docs locales antes de complicarla).
- Tipos consistentes: `estado: "verde"|"amarillo"|"rojo"|"neutro"` (StatusBadge) mapea `estado_semaforo` existente; `RadialTimer.color` usa nombres del token (`green|amber|red`) — la conversión verde→green vive en un helper único en `status-badge.tsx`.
