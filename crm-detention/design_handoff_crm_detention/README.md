# Handoff: CRM-DETENTION — Flight Deck

## Overview
Rediseño completo de la capa visual del CRM-DETENTION de SSB International: sistema interno para trackear detention/demurrage de contenedores de exportación de polietileno desde Bahía Blanca (plantas Bahía y Abbott, ~300-400 contenedores/mes). Dirección estética: **operations command center** — dark casi negro, jerarquía por elevación, números monospace protagonistas, color solo como señal de estado (verde/ámbar/rojo + accent cyan para acción).

Repo destino: `jzenteno-creador/CRM--containers` → `crm-detention/` (Next.js App Router + Tailwind + Supabase). Las rutas y el modelo de datos existentes (`src/lib/types.ts`, `VistaAlerta`, `Operacion`, `estado_semaforo`) NO cambian — esto es solo la capa de presentación.

## About the Design Files
Los archivos de este bundle son **referencias de diseño creadas en HTML** (`Flight Deck — Sistema completo.dc.html`): prototipos que muestran el look & behavior buscado, NO código de producción para copiar. La tarea es **recrear estas pantallas en el codebase existente** (Next.js + Tailwind, componentes en `src/components/`), reemplazando el CSS actual de `globals.css` por los tokens de este documento. `tailwind.tokens.ts` trae los tokens listos para mergear en `tailwind.config`. `components/ContainerNumber.tsx` es el único componente entregado como código de referencia directa.

## Fidelity
**High-fidelity.** Colores, tipografía, spacing e interacciones son finales. Recrear pixel-perfect con los patrones del codebase.

## Screens / Views

### 1. Command center (`/inicio`) — artboard 2a
- **Purpose**: home del operador; qué contenedores queman plata y qué deadlines vencen, en un vistazo.
- **Layout**: rail izquierdo fijo 60px (`bg-rail #07090C`, border-right `#151A21`) + columna principal. Header 58px → strip de 4 KPIs (grid `1fr 1fr 1.3fr 1fr`, divididos por border, sin cards) → cuerpo grid `1fr 372px`, gap 16, padding `16px 20px 20px`.
- **KPIs** (en orden): contenedores activos · días de demora acum. · **costo proyectado USD (ancla visual: color `#FF8A83`, weight 700, fondo `linear-gradient(180deg, rgba(248,81,73,0.05), transparent 70%)`)** · deadlines <72h (ámbar). Anatomía: label 10.5px uppercase tracking .13em `#6B7585` → valor JetBrains Mono 42px tabular → sub-label 11.5px. **Count-up 0→valor en 1300ms ease-out-cubic al montar.**
- **Columna izquierda**: panel EN DEMORA (tabla grid `190px 1fr 150px 92px 96px 110px`, filas 40px con border-left 2px `#F85149`) → panel POR VENCER <72H (filas con barra de progreso de free time consumido, `#F0B849`) → panel EN FREE TIME (grid 6 cards por naviera, flex:1 hasta el pie).
- **Columna derecha**: POSICIÓN DE FLOTA (label + barra + count) → ACTIVIDAD (feed: hora mono 11px + dot de color + texto 12.5px).
- **Header**: título + badge "EN VIVO" (dot verde pulsante 2.4s) + barra IA (input `bg #0E1218` border `#1C2530` radius 9, placeholder "mostrame los Maersk con más de 5 días de demora…", chip "IA" cyan) + kbd ⌘K + reloj mono + avatar.

### 2. Planilla de contenedores (`/contenedores`) — artboard 2b
- **Purpose**: listado global denso, sortable/filtrable.
- **Layout**: header 58px (título + contadores + botón primario "+ Registrar retiro" cyan) → barra de filtros (input IA + chips de filtro activos cyan removibles + dropdowns planta/estado/semáforo + "limpiar filtros") → header de tabla sticky (`bg #0C0E13`, labels 10px uppercase, columna de sort activa en cyan "Restantes ↑") → filas → footer de paginación.
- **Columnas** (grid): `30px[dot] 176px[contenedor] 116px[naviera] 58px[tipo] 1fr[posición] 138px[estado ciclo] 76px[retiro] 68px[estadía] 68px[libres] 92px[restantes] 84px[tarifa/d] 108px[costo proy.]`, gap 12px, padding filas `8px 24px`.
- **Fila**: dot semáforo 8px (glow `0 0 8px rgba(248,81,73,0.5)` SOLO en rojo) · ContainerNumber · estado ciclo como chip tonal (cargado=cyan, en planta=verde, en tránsito=neutro) · restantes coloreado por semáforo (negativos rojos "−6") · costo proy. `#FF8A83` o "—" `#5A6474`. Hover `bg #10141B`.

### 3. Detalle de contenedor (`/contenedores/[id]`) — artboard 2c
- **Purpose**: ficha completa de una operación.
- **Layout**: header (back + ContainerNumber 26px + badges estado/tipo/reforzado + acciones "Solicitar waiver" ghost / "Registrar egreso →" primario) → spec strip (grid 7 celdas: booking, buque/viaje, destino, orden, SHP, retiro de, tarifa vigente) → cuerpo grid `1fr 420px`.
- **Timeline** (izquierda): eventos del ciclo distribuidos en la altura del panel (flex column, cada evento flex:1). Anatomía por evento: fecha+hora mono (col 96px, right) · dot 12px + línea conectora 2px · título 13.5px 600 + detalle 12px `#6B7585`. Estados: completado (dot verde relleno), hito fin free time (dot rojo hueco, título ámbar, chip "HITO"), en curso (dot rojo relleno + glow + pulso, chip "EN CURSO"), futuro (dot gris hueco, texto muted).
- **Derecha**: gauge radial 148px (ver RadialTimer; anima dasharray al montar) con stats estadía/free time/en demora + panel DESGLOSE DE CARGOS (ítem + cálculo mono + monto; total 24px `#FF8A83` con text-shadow glow; nota de tarifa al pie).

### 4. Alertas (`/alertas`) — artboard 2d
- **Purpose**: triage por criticidad, orden días restantes ↑.
- **Layout**: header con contadores por grupo → grid 2 columnas. Izquierda: EN DEMORA (filas flex:1 con RadialTimer 44px al 100% rojo, ContainerNumber, "US$ acum" + "+US$ tarifa mañana"; footer "acción sugerida" con link cyan). Derecha: VENCEN <72H (RadialTimer ámbar parcial con horas en el centro, "vence sáb 09:00") + HORIZONTE 3–7 DÍAS (filas compactas con barra verde de free time restante; footer "+27 en free time >7 días — sin acción requerida").

### 5. Command palette (⌘K) — artboard 2e
Modal 640px centrado top 72px, `bg #0E1218` border `#1C2530` radius 14, shadow `0 24px 80px rgba(0,0,0,0.7)`. Backdrop `rgba(4,5,7,0.55)` + blur del contenido de fondo. **Apertura: scale(0.98)→1 + fade, 200ms cubic-bezier(.16,1,.3,1).** Secciones: input con ícono búsqueda + ESC · grupo "Contenedores" (dot semáforo + ContainerNumber + metadata + "↵ abrir") · grupo "Acciones" (con atajos kbd) · footer de hints. Fila seleccionada: `bg #10202A` + border-left 2px cyan.

## Interactions & Behavior
- **Hover**: filas `bg surface-2 (#10141B)` 150ms; botones primarios `#22D3EE → #4ADEF5`; inputs border → cyan.
- **Count-up KPIs**: 0→valor, 1300ms, ease-out cubic, solo al montar la vista.
- **Stagger de listas**: reveal fade+translateY(10px), 40ms/fila, máx 10 filas.
- **Badges de estado**: transición verde→ámbar→rojo por cross-fade de color 250ms ease-out. Solo el rojo lleva dot pulsante (2s) + glow.
- **View transitions**: 250ms, sin cortes secos (View Transitions API o AnimatePresence).
- **Loading**: skeleton rows con shimmer 1.4s y stagger 150ms, misma grilla que la fila real (cero layout shift). **Nunca spinners.**
- **Optimistic updates**: mutaciones (egreso, waiver) pintan al toque y reconcilian con Supabase realtime (ya existe la suscripción a `operaciones`).
- **Estados obligatorios por pantalla**: vacío ("sin operaciones para los filtros" + acción), cargando (skeletons), error (mensaje + retry en cyan), poblado.
- **⌘K global**: abre palette; ESC cierra; ↑↓ navega; ↵ abre; atajos E/R para acciones.
- **Barra IA**: input NL → traduce a filtros estructurados que aparecen como chips removibles (ver planilla).

## State Management
- Igual que hoy: Supabase + realtime channel sobre `detention.operaciones` refresca KPIs y listas. RPC `crm_dashboard` para el command center.
- Nuevo estado UI: palette abierta/cerrada (global), filtros activos como chips (planilla), progreso de count-up (local al KPI), fila seleccionada en palette.

## Design Tokens
Completos en `tailwind.tokens.ts`. Resumen:

**Superficies/texto**: bg-base `#0A0C10` · bg-rail `#07090C` · surface-1 `#0E1218` (paneles) · surface-2 `#10141B` (anidado/hover) · border-subtle `#151A21` · border-strong `#1C2530` · text-primary `#E6EAF0` · text-secondary `#B8C0CC` · text-muted `#8A94A6` · text-faint `#5A6474`.

**Acción/estados**: accent-500 `#22D3EE` · accent-hover `#4ADEF5` · accent-muted `#164E5F` (bordes) · status-green `#34D399` · status-amber `#F0B849` · status-red `#F85149` · status-red-soft `#FF8A83` (montos USD) · amber-deep `#D9A23C` · green-dim `#4E9F7E` · glow-red `0 0 10px rgba(248,81,73,0.6)`.

**Tipografía**: Archivo (variable, usar font-stretch 115–120% en display uppercase) + JetBrains Mono (TODO número, ID, timestamp — siempre `tabular-nums`). Escala: display-lg 17/700/track .12em · display-sm 13/700/track .1em · num-hero 42/600-700 mono · num-cell 13.5/600 mono · body 12.5/400 · label-micro 10.5/uppercase/track .13em. Prohibido: Inter, Roboto, Arial, Space Grotesk.

**Spacing**: base 4px → 4/8/12/16/20/24. Row height 36–40px. Radius: 6 (chips) · 9 (inputs/celdas) · 12 (paneles) · 14 (palette).

**Motion**: fast 150ms (hover/focus) · base 200ms (palette/dropdown/badge) · slow 250ms (view transitions) · ease `cubic-bezier(.16,1,.3,1)` · count-up 1300ms · stagger 40ms/fila. Regla: motion solo si cambió un dato o una vista.

## Componentes clave (specs en artboard 2f)
- **KpiCard**: label micro → valor mono 42 tabular → sub-label. Variante crítica tiñe valor `#FF8A83` y agrega gradiente rojo 5%.
- **StatusBadge**: 4 estados (free time verde / <72h ámbar / en demora rojo con dot pulsante + glow / cerrado neutro). Tonal: texto color pleno, bg color al 8-10%, border al 30-35%.
- **RadialTimer**: SVG `viewBox 0 0 36 36`, círculo r=15.9155, stroke-width 3, `stroke-dasharray "pct 100-pct"`, `rotate(-90 18 18)`, linecap round (salvo rojo al 100%: sin linecap + `drop-shadow(0 0 4px rgba(248,81,73,0.5))`). Texto central mono. Anima dasharray 800ms `cubic-bezier(.16,1,.3,1)`.
- **DataRow**: altura 36-40px, dot semáforo col 1, border-left 2px solo en rojo, números right-aligned tabular, hover surface-2.
- **CommandPalette**: ver pantalla 5.
- **SkeletonRow**: shimmer 1.4s, stagger 150ms, misma grilla que la fila real.
- **ContainerNumber** (`components/ContainerNumber.tsx`, incluido): API `value: string` — recibe `numero_contenedor` ENTERO tal como está en la DB (campo único, ej. `"MSKU4829103"`) y parte internamente con `slice(0,4)/slice(4,10)/slice(10,11)`. Render: 3 `<span>` adyacentes SIN whitespace (prefijo cyan, serial primary, check digit faint) dentro de wrapper `font-mono tabular-nums select-all`. Copiar devuelve el string contiguo exacto; un click selecciona todo. `colorize=false` → span único. Solo display: no toca la validación de `lib/iso6346.ts`. Reemplazar TODOS los sitios que rendericen `numero_contenedor`.

## Assets
- Fuentes: Google Fonts — `Archivo:wdth,wght@62..125,100..900` y `JetBrains+Mono:wght@400..700` (self-host con `next/font` en producción).
- Íconos: outline 1.4px stroke, 16-17px (los mocks usan SVG inline; en el codebase mantener Tabler Icons que ya está en uso, ajustando stroke).
- Sin imágenes ni ilustraciones.

## Files
- `Flight Deck — Sistema completo.dc.html` — mockups navegables: 2a command center · 2b planilla · 2c detalle · 2d alertas · 2e ⌘K · 2f design system con ejemplos vivos.
- `tailwind.tokens.ts` — tokens para mergear en `tailwind.config`.
- `components/ContainerNumber.tsx` — componente de referencia listo para copiar.
