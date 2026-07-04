<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## CRM Detention — operativa

- DB: Supabase `cctuowthpnstvdgjuomq`, schema `detention` (aislado). La lógica de negocio vive en las views `vista_alertas` / `vista_costos_cerrados` y la RPC `crm_dashboard` — en la DB, no en este repo.
- Deploy: `cd crm-detention && npx vercel deploy --prod --yes`.
- Fuente de verdad de operaciones cerradas: hoja `HISTORIAL,` VIVA de `CONTROL DE VACIOS - ACTIVO.xlsx` — el export `DETENTION HISTORIAL...xlsx` es un snapshot viejo (causó 76 ops faltantes + 8 devoluciones desactualizadas, 2026-07-03).
- La hoja GENERAL recalcula contra `B1==TODAY()`: comparar totales CRM↔Excel siempre del MISMO día. Hojas VENCIDOS/PROXIMOS/VACIOS>5: fórmulas con referencias desalineadas — no usar como fuente.
- Reconciliación fila-por-fila sin mover las ~2880 filas: hash MD5 por mes sobre `cont|retiro|estadia|libres|costo` en ambos lados; igualdad de hashes = igualdad fila por fila.
- `globals.css` tiene clases genéricas globales (`.ok`, `.err`, `.badge`): las clases de componentes nuevos van con namespace (ej. `ft-*`) y todo cambio visual se verifica con `getComputedStyle()`/píxel en prod, no por lectura de código.
