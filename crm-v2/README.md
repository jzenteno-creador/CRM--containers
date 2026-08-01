# CRM Detention de Contenedores — v2

CRM interno de SSB International (para PBB Polisur / Dow, Bahía Blanca) para trackear
contenedores en detention — desde el retiro en depósito hasta el embarque o la devolución
de vacío — con alertas de vencimiento de freetime por naviera, gestión de importación
(demurrage/detention de destino), reportes exportables a Excel y control de incidencias.
Auth real con auto-registro y aprobación por rol, permisos efectivos por rol y planta
(RLS), y diseño propio (Flight Deck).

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind 4**
- **Supabase** (Postgres + Auth + RLS) — proyecto `cctuowthpnstvdgjuomq`, schema `crm`
- JS/TS vanilla en los componentes de UI (sin librerías de estado externas)
- **SheetJS (xlsx)** para exportes a Excel
- Deploy en **Vercel**
- Tests con **Vitest**

## Correr local

```bash
npm install
cp .env.example .env.local   # completar las variables de abajo
npm run dev
```

Variables de entorno (ver `.env.example`):

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (pública — la seguridad real la da la RLS) |
| `NEXT_PUBLIC_SHOW_DESIGN` | Opcional — habilita `/design` (showcase de componentes) en producción; en dev siempre está disponible |
| `ROBOFLOW_API_KEY` | Server-only — PoC de escaneo OCR (`/api/vision/scan`), nunca `NEXT_PUBLIC` |

## Deploy

**Manual, siempre** — este proyecto NO auto-deploya en push (a diferencia de otros
proyectos SSB en Vercel):

```bash
npx vercel deploy --prod --yes
```

## Tests

```bash
npm run test        # vitest run
npm run lint         # eslint
npx tsc --noEmit     # chequeo de tipos
```

Cubre matemática de días/fechas (`lib/format.ts`), validación de contenedores (ISO 6346),
y golden tests de costos de detention contra un snapshot de la DB.

## Base de datos

El schema vive en `crm` del proyecto Supabase compartido (`cctuowthpnstvdgjuomq` — **no**
es un proyecto dedicado; convive con el schema `detention` de la v1, intocable). Las
migraciones están versionadas en `supabase/migrations/`, numeradas y aplicadas en orden.

**Regla de oro: el front nunca escribe directo sobre tablas de plata.** Toda la lógica de
negocio (costos, freetime, transiciones de estado) vive en views y RPCs de Supabase; el
front solo lee y llama RPCs. Ver el detalle completo de qué tablas tienen escritura directa
sancionada (maestros sin impacto en costo) y cuáles son RPC-only en
[`AGENTS.md`](./AGENTS.md).

## Fuentes de verdad

- [`AGENTS.md`](./AGENTS.md) — reglas de escritura a la DB, decisiones de seguridad (RLS,
  supervisores globales, SECURITY DEFINER), constantes que quedan en código.
- [`../spec.md`](../spec.md) — spec funcional completo del rebuild v2 (alcance, arquitectura,
  reglas de negocio, checkpoints).
- [`../docs/v2/CONTEXT.md`](../docs/v2/CONTEXT.md) — contexto operativo para agentes: DB,
  git, deploy, checkpoints humanos.
