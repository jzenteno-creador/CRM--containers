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

## Follow-up separado (no bloqueante de esta decisión)

- Bucket de storage `incidencias` (v1) es **público** (advisor `public_bucket_allows_listing`): las fotos de incidencias son listables sin auth. Se cierra junto con la Opción elegida o en el cutover.
