# Plan de remediación — exposición de `detention` (v1 producción)

**Fecha:** 2026-07-08 · **Estado:** PENDIENTE DE DECISIÓN de John (toca producción — nada se aplica sin OK)

## Hallazgo

El schema `detention` (v1) está **expuesto en la Data API** con **RLS OFF en las 13 tablas** (0 policies). El rol `anon` (key pública, embebida en el bundle de v1) tiene SELECT/INSERT/UPDATE sobre las 15 relaciones (DELETE fue revocado por el hardening v1). Cualquiera con la anon key —que viaja en el JS del browser— puede leer y modificar las ~2.952 operaciones reales. La exposición existe desde el lanzamiento de v1; no la introdujo el rebuild.

## Por qué las dos ramas del fork original no aplican

- **v1 es 100% client-side con anon key y NO usa Supabase Auth** (login propio con password en texto plano + cookie base64; cada request llega como rol `anon`). Evidencia: Explore de `crm-detention/src/` (client único con anon key hardcodeada en el bundle; cero service role; sin route handlers).
- **"RLS con el patrón de crm" es imposible:** no hay `auth.uid()`/identidad Postgres. La única RLS escribible es `USING(true)` (no protege — el atacante tiene la misma key) o `USING(false)` (rompe v1). RLS por-usuario requiere reescribir la auth de v1.
- **"Des-exponer" rompe v1** tal cual está: cada request manda `Accept-Profile: detention`.

## Opciones reales (tradeoffs)

| # | Opción | Cierra el hueco | Rompe v1 | Esfuerzo | Cuándo conviene |
|---|---|---|---|---|---|
| **1** | **Des-exponer `detention` de la Data API** (toggle de dashboard, NO migración). PostgREST devuelve PGRST106 → 0 lectura/escritura por la API pese a los grants. Datos preservados en la DB como referencia fría hasta el cutover. | **Sí, total** | Sí, v1 queda inutilizable (no lee ni escribe) | Nulo (1 toggle) | v1 NO se usa/demuestra. Es el teardown del cutover adelantado, sin el DROP. **Recomendada dado que dijiste que v1 no está en uso operativo.** |
| **2** | **Lockdown read-only:** REVOKE INSERT/UPDATE de anon/authenticated sobre `detention`; SELECT queda. v1 muestra datos pero no escribe. | Parcial (frena tampering; lectura sigue abierta) | Rompe ingreso/egreso/admin/incidencias de v1; lectura y dashboard siguen | Bajo (1 migración de grants sobre detention) | Todavía mostrás v1 como demo read-only y querés cortar la escritura anónima ya. |
| **3** | **Dejar como está** hasta el cutover de v2. Aceptación explícita del riesgo. | No | No | Nulo | Priorizás terminar v2 y el dato expuesto no te preocupa en la ventana. No recomendada (hay escritura anónima sobre dato comercial real). |
| **4** | **Proxy server-side:** reescribir el acceso de v1 a route handlers con service role + sesión real, luego des-exponer. | Sí | No | Alto (reescritura de una app que se reemplaza) | Necesitás v1 plenamente funcional y seguro por meses. No recomendada (esfuerzo desechable). |

## Recomendación

**Opción 1** si v1 no se está demostrando (coincide con "v1 no operativa, data descartable, cutover = drop detention"): cierra el hueco hoy, cero migración, preserva el dato. Si todavía necesitás mostrar v1, **Opción 2** como interino hasta que v2 lo reemplace.

Ambas son reversibles: la exposición se puede volver a activar. La 1 es un toggle tuyo; la 2 es una migración sobre `detention` que requiere tu OK explícito (§21).

## Evidencia (a) — v1 es client-side con anon key (verificado directo 2026-07-08)

- `crm-detention/src/lib/supabase.ts:1,13` — único `createClient`, con `SUPABASE_ANON_KEY`, `db.schema="detention"`.
- Grep `src/`: **0** `service_role`/`serviceRole`, **0** route handlers/middleware, **0** `createServerClient`/`@supabase/ssr`.
- El cliente `supabase` lo importan 13 archivos: **12 `"use client"`** + `login/actions.ts` (`"use server"`, pero también anon key vía REST). Por semántica Next, la anon key `NEXT_PUBLIC_*` se inlinea en el bundle → queries desde el browser.
- **Conclusión: 100% anon-key, dominado por el browser. Des-exponer detention rompe v1.**

## Config viva de PostgREST (fuente de verdad)

`pg_db_role_setting` de `authenticator`: `pgrst.db_schemas = public, graphql_public, detention` (crm NO figura — el Save del dashboard no persistió). La exposición la manda ESTE setting + `NOTIFY pgrst,'reload config'`, no el dashboard.

## Por qué "RLS con el patrón de crm" NO aplica a detention

El patrón crm depende de `auth.uid()`/`perfil()`. v1 no usa Supabase Auth (login propio, cookie base64, todo como rol `anon`). Sin `auth.uid()`, la única RLS escribible es `USING(true)` (no protege) o `USING(false)` (rompe v1). A nivel DB, `anon`-app y `anon`-atacante son el mismo principal con la misma key pública: **ninguna RLS/grant los distingue.** Asegurar detention funcional ⇒ darle identidad real (reescribir auth) o proxy server-side con service role.

## Statements candidatos para (c) — exposición de crm por SQL (NO aplicar sin OK de John)

crm debe exponerse igual (lo necesita v2). La lista final depende de la decisión de detention:

- **Opción A (detention dormida → des-exponer):**
  ```sql
  ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, crm';
  NOTIFY pgrst, 'reload config';
  ```
- **Opción B/C (detention se sigue usando → queda expuesta):**
  ```sql
  ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, detention, crm';
  NOTIFY pgrst, 'reload config';
  ```
  En B además va una migración sobre detention (REVOKE INSERT/UPDATE de anon/authenticated) — corta escritura anónima, deja lectura; requiere OK aparte (§21).

Los grants de las tablas crm ya existen (auto-expose previo) → exponer el schema alcanza; la RLS protege. El hardening 015 (revocar excedentes) va DESPUÉS del test §14.10.

## Follow-up separado (no bloqueante de esta decisión)

- Bucket de storage `incidencias` (v1) es **público** (advisor `public_bucket_allows_listing`): las fotos de incidencias son listables sin auth. Se cierra junto con la Opción elegida o en el cutover.
