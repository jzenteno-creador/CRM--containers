# SESSION_HANDOFF — CRM Detention de Contenedores

**Fecha:** 2026-07-03 (sesión 4: verificación BMOU + decisión NO REFORZADO + investigación ZIM) · **Rama:** master · **Último commit:** ver `git log`

## 🟢 DEMOSTRABLE EN PRODUCCIÓN

**URL: https://crm-detention.vercel.app** — login: `admin@ssb.demo`/`admin123` · `supervisor@ssb.demo`/`super123` · `operador@ssb.demo`/`opera123`

## A · BMOU4172000: ya estaba resuelto — el "desvío de $630" era el Excel leído otro día

**No se mutó ningún dato en esta sesión.** Verificación completa contra prod y contra el Excel:

- `operaciones.sin_cargo = true` en BMOU4172000 **desde la carga de datos** (2026-07-03 15:04 UTC, sesión 3), documentado en `observaciones` ("SIN CARGO según Excel (NO REFORZADO, pendiente definición de regla)").
- **Diff SQL fila por fila Excel↔prod: 70/70 match, 0 discrepancias. Total Excel = 28.000 = Total CRM = 28.000,00.** (VALUES generados desde la hoja GENERAL vs `detention.vista_alertas`, misma fecha.)
- **El 27.370 no es una discrepancia: es el MISMO Excel leído el 2026-07-02.** `GENERAL!B1 = =TODAY()` → estadías/costos recalculan a diario. 18 filas con cargo × $35/día = **$630/día de deriva**. 28.000 (03-jul) − 630 = 27.370 (02-jul). Ni siquiera es el costo de BMOU: BMOU cobrado hoy daría $595 (17 días × $35), no $630.
  - ⚠ **Para la demo:** CRM y Excel se mueven juntos día a día; comparar totales siempre del mismo día.
- Fila BMOU en prod (UI Alertas, screenshot verificado en navegador): `BMOU4172000 | MAERSK | ABBOTT | en planta | estadía 31 | libres 14 | restantes −17 | USD 0 + badge "sin cargo" | semáforo ROJO (dot-rojo rgb(163,45,45))`. **El dwell sigue visible y la fila sigue contando como vencida; solo el costo es $0** (la view pone `costo=0` si `sin_cargo` pero el semáforo no mira `sin_cargo`).
- Dashboard RPC `crm_dashboard(null)`: `costo_proyectado_abiertas: 28000`, `vencidos: 19`. Cross-check de scoping: operador BAHIA ve 15 vencidos / USD 23.555 = 28.000 − 4.445 de las 4 filas ABBOTT ✓.
- Confirmación de operaciones (vía John): BMOU tuvo demora real pero fue informado erróneamente como reforzado sin serlo → la naviera asumió el costo → costo a SSB $0. El dato ya cargado replica esto.

## B · Decisión de diseño: NO automatizar "NO REFORZADO = 0 días libres"

**Decisión (no deuda técnica):** el no-reforzado se resuelve **caso por caso** con el flag `sin_cargo` por operación (+`observaciones`), no como regla determinística. Evidencia de que la regla no es determinística:

1. **MAERSK** tiene la regla en contrato (hoja INFORMACION f11: "DIAS LIBRES - VACIOS | 0 | USD 25 | CONTENEDORES NO REFORZADOS"), pero en el único caso real (BMOU4172000) la naviera absorbió el costo → cargo real $0. La regla automática habría proyectado ~$775 (31d × $25) de más.
2. **ZIM** no-reforzado tuvo una estructura totalmente distinta: 7 días libres + tarifa escalonada por tamaño (ver C). Ni 0 días ni la tarifa estándar.

→ El resultado depende de naviera + negociación puntual. Si John define lo contrario, se automatiza después (el flag `navieras`/`freetime_origin` por régimen ya da la base).

## C · ZIM 7 días vs INFORMACION 21 días: es una condición especial real de NO REFORZADO, no un error de carga

Las 2 ops históricas ZIM (historial f1642–1643, `DETENTION HISTORIAL ... 2025-2026.xlsx` y hoja `HISTORIAL,` idénticas):

| Contenedor | Tipo | Reforzado | Retiro | Devolución | Booking | Libres (Excel) | Valor unit (Excel) | Costo |
|---|---|---|---|---|---|---|---|---|
| ZIMU1022976 | 20DC | **NO REFORZADO** | 2026-01-06 (HIPERBAIRES) | 2026-01-09 embarcado (CHLOE D V292 → ITAPOA) | ZIMUBUE9046380 | **7** | **42** | 0 |
| TGHU5252722 | 40DC | **NO REFORZADO** | 2026-01-06 (HIPERBAIRES) | 2026-01-09 embarcado (ídem) | ZIMUBUE9046363 | **7** | **84** | 0 |

- OBSERVACIONES del historial (textual): 20' → "Del dia 8 al 12 costo de detention de USD 42 y del dia 13 al 16 costo de detention de USD 67 y del 17 en adelante costo de detention de USD 75". 40' → ídem con 84/134/150. **Tarifario escalonado por tamaño, cotizado para esos retiros NO REFORZADO** — no es la condición estándar de vacíos (INFORMACION: ZIM 21d/$25 desde oct-2023).
- **Impacto numérico: cero en todos los escenarios.** Estadía fue 4 días < 7 < 21 → demora 0, costo $0 en Excel y en CRM (`vista_costos_cerrados` = 0.00 en ambas). Son 2 de 2804 ops.
- Estado del seed en CRM: `freetime_origin` ZIM vacíos = 7d/$25 (2025-05-01→2026-06-30) + 21d/$25 (2026-07-01→) + sin_uso 0d/$84. El 7d reproduce la columna del historial, pero con tarifa $25 (la real cotizada era 42/84 escalonada) — sin efecto porque demora=0.
- **Opciones para John (no se cambió el seed):**
  1. **Dejar como está** (recomendado): impacto $0, el historial ata.
  2. Re-seed estándar 21d/$25 desde 2023-10-01 según INFORMACION: las 2 ops seguirían dando $0, pero se pierde el registro de que hubo condición especial.
  3. Modelar condiciones NO REFORZADO por naviera con tarifas escalonadas: requiere cambiar el modelo (`freetime_origin` es plano: días + tarifa única) — solo vale si van a repetir retiros ZIM no reforzados.

## FASE 1 · Análisis de CONTROL DE VACIOS como base de consulta (2026-07-03 — ⏸ esperando OK de John para Fase 2)

**Semántica temporal (evidencia):**
- HISTORIAL vivo: 2880 ops cerradas; retiros **2025-05-12 → 2026-06-30** (~14 meses), devoluciones **2025-08-04 → 2026-07-03** (11 meses). "Arranca en agosto 2025" vale solo por devolución. NO es año calendario.
- La DB tiene 2804 cerradas = copia EXACTA de `DETENTION HISTORIAL...xlsx` (2804 filas, max dev 29-jun): el import de sesión 3 usó ese export viejo. **Faltan 76 cierres recientes** (58 jun + 18 jul, dev 12-jun→3-jul, 66 MAERSK + 10 HAPAG, $3.185) que solo están en el HISTORIAL vivo.
- **8 waivers históricos** con $0 manual en Excel (roturas "SIN COSTOS" autorizadas por CMA/MAERSK: f38, f401-403, f731, f1053-54, f1693) que el CRM computó con tarifa: **CRM sobreestima $14.255**. Conciliación exacta: DB 599.440 − 14.255 (waivers) + 3.185 (76 faltantes) = **588.370 = Excel**. Días/libres atan 100% en las 2880.
- Dinámico vs estático: GENERAL+derivadas recalculan contra `B1==TODAY()` (VENCIDOS/ESTADIA/DEMORA/COSTOS); HISTORIAL es estático (dev−ret+1); REPORTE TOTAL es un **pivot con cache manual** (último refresh: Operez 2026-07-02 11:34 → de ahí salió el "27.370"); COSTOS HISTORICOS y PREFIJOS estáticos.
- Rotulado temporal en el CRM: `inicio/page.tsx:277` "costo detention (YTD)" y `:304` "costo por naviera (YTD)" = solo 2026 (461.000; oculta 138.440 de ago-dic 2025 y el gráfico por naviera invisibiliza a CMA); `:310` "tendencia mensual" = últimos 12 meses (hoy cubre todo por casualidad; desde ago-2026 trunca silenciosamente); `:289` "estadía promedio (todas)" = solo cerradas 2026. **No existe ningún KPI "acumulado del historial completo".**

**Mapeo (resumen):** integrado ✔: contenedor/naviera/retiro_de/planta/tipo/reforzado/fechas/bookings/buque/destino/orden/shp/producto/gmid/observaciones/estado(LLENOS)/tipo_cierre (CARGADO+DEVOLUCION DE VACIOS: 2787 embarcado + 17 devuelto_vacio ✓ exacto). NO modelado ✖: ROTURAS (13 ops), facturación DP (DP-FLETE/DP-DETENTION/invoices, 799 ops), prefijos restringidos (26+13, regla "PARA DOW"), COSTOS HISTORICOS (serie semanal abr-2020→jul-2026, 76 meses), régimen `cargados` de INFORMACION, NO REFORZADO MAERSK 0d/$25, tarifas escalonadas ZIM. ⚠ Hojas VENCIDOS/PROXIMOS/VACIOS>5: derivadas con structured refs DESALINEADOS (VACIOS>5 muestra costos de filas equivocadas) — **solo GENERAL e HISTORIAL son fuente confiable**.

**Dudas para John (Fase 2):** (1) importar las 76 faltantes; (2) marcar sin_cargo los 8 waivers (con ambos fixes el CRM ata 588.370 exacto); (3) ¿facturación DP al modelo?; (4) ROTURAS como incidencias retroactivas o flag; (5) ¿validar prefijos restringidos en tanda de retiro?; (6) MSC en INFORMACION contradice al seed (7d/$25 vs 15/$50, sin ops → sin impacto); (7) ¿serie 2020-2026 en dashboard?; (8) nuevos rótulos temporales; (9) CONSOLIDADO/trasvase MAERSK→HAPAG: ¿quién cobra?

## Recorrido de sesiones anteriores (resumen)

- **Sesión 3:** datos reales de CONTROL DE VACIOS (70 abiertos + 2804 históricas), freetime reconciliado contra INFORMACION (MAERSK 14/$35, CMA 18/$25, HAPAG 14/$25, ZIM 7→21 + sin_uso, MSC 15/$50), dwell separado del costo (`dias_estadia` siempre visible, semáforo `neutro` para navieras que no cobran), E2E completo sobre prod con evidencia por paso, mobile 375px OK. Deploy: `cd crm-detention && npx vercel deploy --prod --yes`.
- Columna `regimen` (`vacios`/`cargados`/`sin_uso`) en `freetime_origin`; el cálculo de origen usa SOLO `vacios` (o `sin_uso` para devuelto_vacio ZIM).
- Flag `navieras.cobra_detention_origen` (default true) listo para dar de alta navieras que no cobran (Log-In no dado de alta).

## Gaps / pendientes para John

1. ~~BMOU4172000 sin_cargo~~ ✔ confirmado por operaciones y verificado en prod (sección A).
2. ~~Regla NO REFORZADO~~ ✔ decisión de diseño: caso por caso vía `sin_cargo` (sección B). Reabrir solo si John define automatizar.
3. **ZIM histórico 7d:** elegir opción 1/2/3 de la sección C (recomendada: 1, impacto $0).
4. Confirmar decisiones restantes de la carga: los 3 `BAHIA/ABBOTT` → planta actual ABBOTT; GENERAL = todo en planta (nada en tránsito).
5. Password plano + credenciales committeadas: OK para demo, migrar a Supabase Auth si pasa a producción real.
6. Carga masiva (spec §11): sigue diferida a testing.
