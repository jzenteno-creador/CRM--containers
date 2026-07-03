# SESSION_HANDOFF — CRM Detention de Contenedores

**Fecha:** 2026-07-03 (sesión 5: Fase 2 — integración Excel + solapa Historial + diseño navy/oro) · **Rama:** master

## 🟢 DEMOSTRABLE EN PRODUCCIÓN

**URL: https://crm-detention.vercel.app** — login: `admin@ssb.demo`/`admin123` · `supervisor@ssb.demo`/`super123` · `operador@ssb.demo`/`opera123`

## A · RECONCILIACIÓN CERRADA: el CRM ata EXACTO con el Excel, mismo día, fila por fila

| Métrica | Antes | Después | Excel (03-jul) |
|---|---|---|---|
| Ops cerradas | 2.804 | **2.880** | 2.880 ✓ |
| Costo historial | 599.440 | **588.370** | **588.370 ✓ EXACTO** |
| Hashes MD5 mensuales (cont\|retiro\|est\|libres\|costo) | 1/12 | **12/12 idénticos** | — |

Camino del ajuste (todo con diff SQL fila por fila, mismo día):
1. **+76 cierres importados** del HISTORIAL vivo (devoluciones 12-jun→3-jul; 66 MAERSK + 10 HAPAG, todas embarcado/REFORZADO/BAHIA), replicando convenciones sesión 3 (retiro 12:00Z, ingreso +6h, egreso dev−1 17:00Z, devolución 19:00Z, 4 eventos/op). Guards de idempotencia por (contenedor, fecha_retiro).
2. **8 waivers históricos → sin_cargo=true** (roturas con devolución en vacío "SIN COSTOS" autorizadas por CMA/MAERSK: TCNU3517944, HASU4904147, SUDU6729339, MSKU8696734, TCLU5892700, INKU6197809, TCLU8377540, MRKU4955835; −$14.255). Motivo documentado en `observaciones` de cada una. Dwell/días siguen visibles.
3. **Hallazgo extra en la reconciliación (−$490):** 8 ops pre-existentes tenían **devolución desactualizada** en el export viejo (dev 24-jun; el Excel vivo las devuelve 26/27-jun): CAAU8468553, TRHU8052801, MRKU4889266, TRLU8199220, MRSU6895358, SUDU8971969, MRKU6331313, MRKU4616066. Corregidas fechas de devolución/egreso + eventos. 105×4+70 = 490 exacto.
- Dashboard RPC verificado en prod: `costo_historial: 588370`, `vencidos: 19`, abiertas intactas (70 / USD 28.000 al 03-jul — recordar que el proyectado de abiertas deriva a diario con el Excel).

## B · Rótulos temporales corregidos (el "YTD" ya no miente) — commit `d108bde`

- KPI **"costo detention — historial (ago-25 → hoy)"** = 588.370 (rango dinámico desde `historial_desde` de la RPC v2) + KPI **"costo detention (2026)"** = 463.905 explícito + "(mes)" = 635.
- **"costo por naviera — historial"**: rango completo → **CMA/MERCOSUL reapareció** (12.850; antes el filtro YTD lo ocultaba). MAERSK 558.320, HAPAG 17.200, ZIM 0.
- **Tendencia mensual**: historial completo ago-25→jul-26, sin el truncado de 12 meses que iba a recortar desde ago-2026.
- "estadía promedio (historial, cerradas)" = 17 d con alcance real.
- RPC `crm_dashboard` v2 (migración `crm_dashboard_v2_historial_completo`): claves nuevas `costo_historial`, `historial_desde`; `costo_por_naviera`/`tendencia_mensual`/`estadia_promedio`/`demora_promedio` pasan a rango completo; `costo_ytd` se mantiene para la vista "(2026)".

## C · Solapa HISTORIAL (consulta de las 2.880 cerradas) — commit `376a3b1`

- `/historial` en el nav: búsqueda contenedor/booking/orden (`.or` + ilike con **índices pg_trgm**), filtro naviera y rango de devolución, **paginación server-side** (`range` + `count exact`, 50/pág — verificado en prod: "1–50 de 2.880 · página 1 de 58"). Nunca se traen las 2.880 al cliente.
- Ficha expandible por fila (clic/+): retiro_de, bookings, buque, destino, orden, shp, planta, tipo, producto, tarifa, observaciones. Verificado con ZIMU1022976 (HIPERBAIRES → CHLOE D V292 → ITAPOA).
- `vista_costos_cerrados` v2: columnas de consulta agregadas AL FINAL (no rompe consumidores). Scoping por planta para rol operador.

## D · Prefijos restringidos (regla "PARA DOW") — commit `2484695`

- Tabla `detention.prefijos_restringidos`: 26 vigentes + 13 retirados del listado (nota 26-08-2025).
- En el alta de tanda: badge rojo "⚠ prefijo restringido" (con armador en tooltip) + aviso agregado **NO bloqueante**; badge suave "prefijo ex-restringido" para los 13 históricos. Verificado en prod: HWIU→alerta, BANU→ex-restringido, MSKU→limpio.

## E · Módulo aparte "histórico agregado 2020-2026" — commit `d108bde`

- Tabla `detention.costos_historicos` (323 semanas de la hoja COSTOS HISTORICOS, abr-2020→jul-2026, USD 4.200.685) + card separada en el dashboard con barras anuales.
- ⚠ **Esta serie NO reconcilia con el historial del CRM** (2025: 395k vs 138k; es una métrica propia del equipo de ops, alcance distinto) — por eso va como módulo aparte, rotulado, sin mezclar con KPIs operativos. La "semana 1 de jul-2026" de esa hoja es 27.370 (otra huella del pivot desactualizado de la sesión 4).

## F · Punto 9 — consolidado/trasvase MAERSK→HAPAG (solo investigación)

Las 3 ops consolidadas (CAAU9115289, CAIU8059394, TGBU5395830, orden 118009744, sep-2025): la observación del historial cierra la duda — *"AUTORIZADO SE EXPORTÓ CON MAERSK LA ORDEN MANTENIENDO LOS CONTENEDORES"*. Se facturaron con condiciones MAERSK (14 libres/$35 → $140 c/u). **La naviera que factura la detention no cambió: siempre la dueña del contenedor.** El modelo del CRM ya lo representa; no se tocó nada.

## G · Diseño navy + ámbar-oro aplicado (mejora básica) — commits `14187aa`, `09040f3`, `c3c4911`, `ab72cbc`

- Paleta navy oscuro + oro único (verde/rojo solo semáforo) vía re-mapeo de variables CSS → las 8 solapas consistentes sin tocar su estructura. Tipos: Archivo (display/cifras) + IBM Plex Sans + IBM Plex Mono (contenedores), tabulares.
- Ícono de contenedor en KPIs/conteos; **medidor de freetime** (verde→ámbar→rojo) en Alertas; filas expandibles en Contenedores e Historial; login institucional split con **slots SSB/Dow** (los logos reales los suma John).
- 2 bugs de CSS cazados por verificación de píxel en prod (lección specificity): (1) fill absoluto fuera del track dentro de celdas; (2) **clase `ok` del meter colisionaba con el banner global `.ok`** → namespace `ft-*`.
- **Mobile 375 verificado en prod**: body 360<375 sin overflow; en Alertas/Historial las columnas secundarias se ocultan (`hide-sm`) y **contenedor + estadía + medidor + costo quedan visibles sin scroll** (BMOU: "USD 0 · sin cargo" con barra roja, `getBoundingClientRect` right=355<375).
- Screenshots de evidencia: login, dashboard, alertas (meter), contenedores (fila expandida), historial (búsqueda ZIM + ficha), ingreso (alerta prefijos), mobile alertas/dashboard.

## Decisiones de diseño vigentes (de sesiones 3-4)

- NO REFORZADO: caso por caso vía `sin_cargo` + observaciones (no regla automática). ZIM 7d histórico = condición especial escalonada real (42/67/75 · 84/134/150), sin impacto ($0).
- El Excel GENERAL es blanco móvil (`B1==TODAY()`): comparar CRM↔Excel siempre mismo día.
- Naviera que factura = dueña del contenedor, aun en órdenes consolidadas (F).

## Gaps / pendientes para John

1. Medidor de freetime en la solapa Contenedores: no se agregó porque ese listado no carga datos de freetime (es la vista de operaciones); está en Alertas, que es la pantalla de freetime. Si lo querés también ahí, hay que joinear `vista_alertas` por fila.
2. Logos reales SSB/Dow en los `.logo-slot` del login.
3. Dudas de INFORMACION sin impacto numérico: MSC contradictorio (7/25 vs 15/50, sin ops), régimen `cargados` no modelado (por diseño), facturación DP (799 ops) fuera del CRM, ROTURAS (13 ops) sin flag propio.
4. Password plano + credenciales committeadas: OK demo; migrar a Supabase Auth si pasa a producción real.
5. Carga masiva (spec §11) sigue diferida. Sincronización periódica del HISTORIAL vivo (el import es manual; el Excel sigue moviéndose).
