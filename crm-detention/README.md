# CRM Detention de Contenedores — SSB International (prototipo demo)

Trackeo de contenedores en detention: retiro en depósito → tránsito → planta → carga → embarque/devolución, con alertas de vencimiento de free time por naviera y dashboard de costos.

**Spec:** `../Plan-CRM-Detention-Contenedores.md` (fuente única de verdad).

## Correr local

```bash
npm install
npm run dev
# → http://localhost:3000
```

No requiere `.env`: el cliente Supabase tiene URL + anon key embebidos (decisión de demo — prototipo interno, seguridad OFF).

## Usuarios demo

| Email | Password | Rol |
|---|---|---|
| `admin@ssb.demo` | `admin123` | administrador (ve Admin) |
| `supervisor@ssb.demo` | `super123` | supervisor (todas las plantas) |
| `operador@ssb.demo` | `opera123` | operador (scoped a planta BAHIA) |

## Backend

- **Supabase** proyecto `cctuowthpnstvdgjuomq` (compartido con ssb-export-dashboard por límite de 2 proyectos free; tablas 100% aditivas, migrables a proyecto dedicado con las mismas migrations).
- Schema: 10 tablas + `vista_alertas` + `vista_costos_cerrados` + RPCs `crm_*` (tandas transaccionales, versionado de freetime, dashboard).
- Demo data: 2804 operaciones cerradas del historial real + 82 abiertas sintéticas (ISO 6346 válido) en todos los estados.
- Días computados en `America/Argentina/Buenos_Aires`, `fecha_retiro` = día 0.

## Deploy

```bash
npx vercel login   # una sola vez
npx vercel --prod --yes
```
