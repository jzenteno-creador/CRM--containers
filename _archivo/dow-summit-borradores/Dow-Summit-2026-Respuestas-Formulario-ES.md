# Dow Supplier Productivity Summit 2026 — Respuestas del formulario (versión en español)

> **Qué es este archivo:** la traducción al español de las respuestas, para que revises y compartas
> internamente. **Lo que se pega en el formulario es el texto en portugués** del archivo
> `Dow-Summit-2026-Respuestas-Formulario.md` / su PDF — este documento es la referencia de lectura.
> Los campos marcados **[COMPLETAR JOHN]** requieren un dato tuyo.
>
> **Reescritura 2026-07-14 — cambio de framing obligatorio:** esta versión NO revela que el sistema ya
> existe, ya está construido o ya está en producción. Todo se redacta como **propuesta a desarrollar**
> (futuro/condicional: "proponemos desarrollar", "el sistema permitiría", "estimamos"). Los datos de
> costos se presentan como medición operativa propia (planillas de la operación), nunca como output de
> una plataforma existente. Ver el checklist al final para las decisiones que quedaron abiertas.

---

## Fuente de las cifras

Todas las cifras de costo salen de `COSTOS POR DETENTION SEMANAL 2024-2025-2026 - REPORTE.xlsx`
(la planilla validada con Omar Pérez), hojas `COSTOS DETENTION SEMANAL 2024/2025/2026`, columnas "Total"
por naviera y "Grand Total" (columna S en la hoja 2024, columna V en 2025 y 2026), filas 2–13 = una por mes.

- **2024 total: USD 434.415** (Hapag USD 14.475 + Maersk USD 419.940)
- **2025 total: USD 296.744** (Hapag USD 14.450 + Maersk USD 192.469 + CMA-CGM USD 89.825) → promedio
  **USD 24.729/mes**
- **2026 total ene-jun: USD 463.235** (Hapag USD 7.675 + Maersk USD 455.560 + CMA-CGM USD 0; jul-dic
  todavía sin cerrar en la planilla) → promedio **USD 77.206/mes**; pico **abril = USD 117.355** (fila 5,
  columna V de la hoja 2026)
- **Acumulado ago/2025–jun/2026 (11 meses, ventana usada en el pitch): USD 587.805** = hoja 2025 filas
  9–13 (ago-dic, USD 124.570) + hoja 2026 filas 2–7 (ene-jun, USD 463.235). Concentración por naviera en
  esa ventana: **Maersk USD 558.355 (95,0%)**, Hapag USD 16.600 (2,8%), CMA-CGM USD 12.850 (2,2%).
- Proyección anual 2026 al ritmo actual: USD 77.206 × 12 ≈ **USD 926.470** ("por encima de USD 900 mil").
- Escenarios de beneficio (pregunta 22): 20% y 35% de reducción aplicados sobre el acumulado de 11 meses
  (USD 587.805) → USD 117.561 ≈ **118 mil** y USD 205.732 ≈ **206 mil**. Es una hipótesis de trabajo
  (benchmark de reducción con alerta temprano), no un dato medido — así lo aclara el texto de la 22.

**Inconsistencia detectada en la planilla fuente:** en la hoja "COSTOS DETENTION SEMANAL 2026" las fechas
de la columna A/H/O están rotuladas como 2025 (copiadas de la hoja anterior), pero el contenido es de
2026 — se confirma porque la pestaña se llama 2026 y los meses jul-dic están en cero, consistente con que
hoy es 14/jul/2026 y esos meses todavía no cerraron. No afecta los totales (dependen de la fila, no de la
fecha), pero convendría corregir la columna de fecha en el archivo fuente antes de la próxima consolidación.

**Reemplaza al número viejo:** el total viejo (USD 588.370) queda reemplazado por **USD 587.805**
(diferencia de USD 565, 0,1%), ahora validado contra esta planilla. El caveat ZIM del handoff 2026-07-07
(`docs/plans/moneypath-plan-20260705.md`) debería estar resuelto dado que esta planilla ya es la
referencia validada con Omar Pérez — si no lo está, avisame antes de enviar el formulario.

**No cubierto por esta planilla (quedó fuera del pitch, no se inventó):** desglose por contenedor/día
(cantidad de contenedores con detention, días totales de atraso, tarifa promedio por día, % de
operaciones cerradas dentro del free time). La versión anterior usaba estos números (1.259 contenedores,
17.565 días, 68% de concentración en 16+ días) — no están en esta planilla, así que se sacaron del texto
en vez de inventarlos. Si tenés la fuente de esos indicadores, decime cuál es y los reincorporo.

---

## Datos del responsable (3–6)

**3. Nombre de la empresa:** `SSB INTERNATIONAL SA` *(ya precargado)*

**4. País principal de actuación de la empresa:** ☑ **Argentina**

**5. Nombre completo del responsable del envío:** `Jonathan Ezequiel Zenteno Parrado` *(ya precargado)*

**6. E-mail del responsable del envío:** `jzenteno@ssbint.com` *(ya precargado)*

---

## Perfil de la empresa (7–9)

**7. ¿Cuál es el sector principal de actuación de la empresa?** ☑ **Logística**

**8. ¿Hace cuánto tiempo su empresa atiende o se relaciona comercialmente con Dow?** **[COMPLETAR JOHN]**

> Opciones del formulario: Menos de 1 año / 1–3 años / 3–5 años / 5–10 años / Más de 10 años / Todavía no
> atiende a Dow. Elegí la franja real de la relación SSB ↔ Dow/PBB Polisur — no la puedo verificar yo.

**9. ¿Cuál es el nombre de su principal contacto de Compras en Dow?** **[COMPLETAR JOHN]**

---

## El problema (10–11)

**10. ¿Qué tipo de desafío de Dow busca abordar su propuesta?** ☑ **Costo elevado de materiales o servicios**

> Alternativa defendible: "Ineficiencias, retrabajo o cuellos de botella de proceso" (la causa raíz es
> de proceso: seguimiento manual). Recomiendo "Costo elevado" porque el pitch abre con USD 587 mil
> medidos en 11 meses — es la opción que el número respalda.

**11. Describa de forma objetiva el problema, oportunidad o necesidad que su propuesta busca resolver en Dow.**

```
El costo de detention de contenedores en la operación de exportación de Bahía Blanca (PBB
Polisur/Dow, operada por SSB) se triplicó: de un promedio de USD 25 mil/mes en 2025 a USD 77
mil/mes en los primeros seis meses de 2026, con pico de USD 117 mil en abril. En el acumulado
de agosto/2025 a junio/2026 (11 meses), el costo medido llega a USD 587.805 — de los cuales
el 95% (USD 558 mil) está concentrado en cargas de una sola naviera (Maersk). Al ritmo
actual, 2026 cerraría por encima de USD 900 mil, muy por arriba de los USD 434 mil de 2024 y
los USD 297 mil de 2025. Hoy el seguimiento es manual, por planilla: la demora recién se
advierte cuando la factura de detention ya llegó, sin alerta anticipada ni visibilidad diaria
del free time restante por contenedor y por naviera. El mismo problema de visibilidad se
repite en otros frentes de la operación — bookings y reprogramaciones de embarque,
incidencias con contenedores (lavados exigidos, averías) y el control de prefijos
restringidos que exige Dow — hoy gestionados en planillas paralelas, sin trazabilidad única.
La oportunidad: un sistema que haga visible, a diario, cuánto free time resta por contenedor
y por naviera, y que alerte antes del primer dólar de cargo.
```

---

## Categoría y alcance (12–14)

**12. ¿En qué categoría o área se aplica principalmente la propuesta?** ☑ **Logística**

> Si permite segunda opción: "Digitalización/automatización". Si es opción única, Logística — la
> tecnología es el medio, el resultado es logístico.

**13. ¿Para qué localidad(es) de Dow podría aplicarse la propuesta?**
☑ **Bahia Blanca** (donde SSB ya opera la exportación) — y si el campo es multi-selección, marcar también
las localidades con potencial de exportación/importación en contenedores: **Aratu, Guarujá, Santos
Dumont, São Paulo, Cartagena, Lima, Santiago, Ciudad de México**.

> La pregunta dice "podría ser aplicada" (potencial), así que marcar los sitios que operan con
> contenedores es legítimo. El checkbox del formulario es solo de localidades de América Latina — la
> escalabilidad a EMEAI/APAC/NAM que pediste se explica en texto libre (15–17, 38), no en este checkbox.
> Si preferís conservador: solo Bahia Blanca + responder 14 con "Sí". Vos conocés qué sitios mueven
> contenedores de exportación/importación — ajustá la lista.

**14. ¿La propuesta podría escalarse a otras unidades o países de América Latina?** ☑ **Sí**

---

## La propuesta (15–17)

**15. Título de la propuesta o proyecto:**

```
Visibilidad y Control de Free Time — propuesta de plataforma para reducir el costo de
detention/demurrage y gestionar bookings, incidencias y prefijos restringidos en
exportación e importación, escalable a otras plantas y países de América Latina
```

**16. Resuma su propuesta en hasta 5 líneas, explicando la solución y el beneficio esperado para Dow.**

```
Proponemos desarrollar un sistema digital que siga cada contenedor —en exportación e
importación— desde el retiro o la llegada hasta la devolución, calculando a diario el free
time restante por naviera y alertando (semáforo verde/amarillo/rojo) antes del primer cargo
de detention o demurrage. La misma plataforma gestionaría bookings y roleo, registraría
incidencias (lavados exigidos, averías) con el monto cobrado y recuperado en cada reclamo, y
haría el control de prefijos restringidos definidos por Dow. Escalable por país, planta y
contrato de free time, empezando por la operación de exportación de Bahía Blanca. Beneficio
estimado: entre USD 118 mil y USD 206 mil/año de detention evitable, sin costo para Dow.
```

**17. Explique cómo funcionaría la solución en la práctica. Incluya etapas principales, áreas involucradas, tecnología/proceso utilizado y cómo participaría Dow en la implementación.**

```
Flujo propuesto, en 5 frentes:

(1) Visibilidad de free time (exportación e importación): registro del retiro de los vacíos
(expo) y de la llegada de los llenos (impo) por tanda —la lista de contenedores pegada tal
cual viene, con validación automática del número (ISO 6346); cálculo diario de los días
libres restantes por naviera y del costo proyectado con la tarifa vigente, con alertas en
semáforo antes del primer dólar de cargo.

(2) Bookings y roleo: registro de bookings de retiro, control de ETD, alertas de corte
documental y de embarque, y apoyo a la reprogramación o reasignación de contenedores en
riesgo de demora.

(3) Incidencias y reclamos: registro de lavados exigidos y averías con fotos y línea de
tiempo, y seguimiento del reclamo hasta la resolución —cuánto se cobró y cuánto se recuperó.

(4) Prefijos restringidos: validación automática de los prefijos de contenedor definidos por
Dow al momento del ingreso, con barrido periódico sobre el stock en operación.

(5) Reportes: exportación a Excel con filtros y resumen periódico automático por correo a la
gerencia.

Tecnología propuesta: aplicación web en la nube, con actualización en tiempo real, perfiles
de acceso por rol (operador/supervisor/administrador) y auditoría completa.

Áreas involucradas: la operación de SSB como usuaria diaria; logística/supply de Dow como
destinataria de los indicadores y del reporte gerencial.

Participación de Dow: validación de las reglas de free time y de las tarifas negociadas con
cada naviera, definición de los prefijos restringidos y de los destinatarios del reporte
gerencial, y un interlocutor de logística para acompañar el piloto. No requeriría
integración con sistemas de TI de Dow —solución autónoma, accesible por navegador.

Plan de implementación propuesto: piloto de 8 semanas en Bahía Blanca, enfocado en el módulo
de mayor impacto financiero (visibilidad de free time en exportación); los demás módulos
(importación, bookings, incidencias, prefijos restringidos) entrarían en fases siguientes,
priorizados junto con Dow.
```

---

## Implementación previa (18–19)

**18. ¿Esta solución ya fue implementada anteriormente?** ☑ **No, es una propuesta nueva**

> Decisión de framing explícita (no un hecho verificable por Dow): la consigna de esta reescritura es no
> revelar que existe una versión previa construida. Con esta respuesta, la pregunta 19 (condicional a
> "Sí, en Dow" / "Sí, en otro cliente" / "Sí, en piloto") **no se muestra** en el formulario real.

**19. Si ya fue implementada, describa dónde, cuándo y qué resultados se obtuvieron.**

```
No aplicable — el formulario solo muestra esta pregunta si la respuesta de la 18 fue "Sí, en
Dow", "Sí, en otro cliente" o "Sí, en piloto". Con "No, es una propuesta nueva" seleccionado
en la 18, esta pregunta no se muestra.
```

---

## Diferencial y beneficio financiero (20–23)

**20. ¿Cuál es el principal diferencial de la propuesta respecto del modelo actual?** ☑ **Uso de datos/IA/analytics**

**21. ¿Cuál es el beneficio financiero estimado para Dow?** ☑ **USD 100–250 mil/año**

**22. Informe el valor estimado del beneficio financiero anual para Dow, en USD, y explique las principales premisas del cálculo.**

```
USD 118.000 a 206.000 por año. Premisas: en el acumulado de 11 meses (agosto/2025 a
junio/2026), el costo medido de detention en la exportación de Bahía Blanca fue de USD
587.805, de los cuales el 95% (USD 558 mil) concentrado en cargas de una sola naviera
(Maersk). Como hipótesis de trabajo —basada en benchmarks típicos de reducción de detention
cuando se implementa alerta anticipada y gestión activa del free time—, aplicamos dos
escenarios sobre ese costo medido: conservador, evitando el 20% = USD 118 mil/año;
alcanzable, evitando el 35% priorizando la naviera de mayor concentración = USD 206
mil/año. Los valores consideran solo la exportación de Bahía Blanca; no incluyen el
potencial de importación (demurrage/detention en destino), bookings, incidencias ni
prefijos restringidos, cuyo beneficio todavía no está cuantificado por falta de línea de
base.
```

**23. ¿Cuál es el tipo principal de ganancia financiera esperada?** ☑ **Saving directo**

> El costo de detention se paga hoy, todos los meses — reducirlo con alerta temprano sería saving
> directo, no cost avoidance.

---

## Productividad (24–25)

**24. ¿Qué ganancia de productividad o eficiencia operativa puede generar la propuesta?**
☑ **Reducción de horas manuales** *(si es multi-selección, agregar: Reducción de retrabajo, Mejora de planificación, Menor complejidad operativa)*

**25. ¿Cómo se medirá esa ganancia de productividad? Indique KPIs, línea de base actual y resultado esperado, si está disponible.**

```
Dos KPIs propuestos, medidos mensualmente contra la línea de base ya registrada en las
planillas de costo de la operación: (1) costo de detention por mes, comparado contra el
promedio de 2026 (USD 77 mil/mes) y el pico de abril (USD 117 mil); (2) % de contenedores
liberados dentro del free time —hoy no medido de forma sistemática (solo vía planilla de
costo consolidada mensualmente), línea de base a relevar en las primeras semanas del
piloto. En horas de trabajo: el registro por tanda reemplazaría la carga fila por fila en
Excel, y cualquier reporte saldría con un clic, eliminando el seguimiento paralelo en
múltiples planillas manuales (costos, free time origen, free time destino, historial de
contenedores).
```

---

## Working capital (26–27)

**26. ¿La propuesta contribuye a reducir working capital, stock, inventario o plazo de entrega?** ☑ **Parcialmente**

**27. Si aplica, explique el impacto esperado.**

```
El impacto principal sería en costo, no en stock. Parcialmente, la visibilidad diaria
acortaría el ciclo del contenedor en la operación: los contenedores priorizados se
embarcarían o devolverían antes, reduciendo el tiempo de activo retenido y la exposición a
cargos en curso. El seguimiento documentado de reclamos por lavados y averías también
reduciría los montos en disputa y el tiempo hasta la recuperación.
```

---

## Costo e implementación (28–33)

**28. ¿Cuál es el costo estimado de implementación para Dow?** ☑ **Sin costo para Dow**

**29. Detalle los costos estimados, incluyendo inversión inicial, costos recurrentes, licencias, equipos, personas, capacitación u otros recursos necesarios.**

```
Inversión inicial: asumida íntegramente por SSB, incluyendo el desarrollo de la plataforma y
su infraestructura —sin costo de desarrollo ni licenciamiento para Dow. Costos recurrentes:
hosting y base de datos en la nube, de costo mínimo, también absorbidos por SSB como parte
del servicio; sin licencias por usuario ni por puesto. Capacitación: incluida en las 2
primeras semanas del piloto, a cargo de SSB con el equipo operativo. Recursos esperados de
Dow: horas de alineación para validar las reglas de free time, las tarifas negociadas por
naviera y los prefijos restringidos, además de la definición de los destinatarios del
reporte gerencial. Referencia de retorno: evitar que dos contenedores por mes caigan en
demora ya cubriría la operación anual propuesta para el sistema.
```

**30. ¿Qué recursos se necesitarían de Dow para implementar o probar la propuesta?**
☑ **Tiempo de operación** + ☑ **Datos/información**

> "Datos/información" = validar reglas de free time y tarifas negociadas con cada naviera, y confirmar
> los prefijos restringidos. Si el formulario permite una sola opción, elegí "Tiempo de operación".

**31. ¿Cuál es el tiempo estimado para la implementación completa de la propuesta, considerando desde la aprobación hasta que la solución esté operativa en Dow?** ☑ **3–6 meses**

> Cambié esta respuesta respecto de la versión anterior (que decía "Hasta 30 días"). Con el alcance
> nuevo (5 módulos: free time expo/impo, bookings, incidencias, prefijos restringidos, multi-región)
> prometer 30 días no es defendible como propuesta desde cero. El piloto del módulo de mayor impacto
> (free time en exportación, Bahía Blanca) sí se plantea en 8 semanas —ver pregunta 35— pero la
> "implementación completa" de toda la propuesta es realista en 3–6 meses. Avisame si preferís otra
> franja.

**32. ¿Cuál es la complejidad de implementación de la propuesta?** ☑ **Media — exige coordinación entre áreas, ajustes operativos o validaciones técnicas**

> También cambié esto (antes "Baja"). El alcance multi-módulo y multi-región coordina operación,
> logística/supply de Dow y validación de reglas comerciales por naviera —es coherente marcarlo como
> complejidad media, no baja. Avisame si preferís mantener "Baja" acotando el pitch solo al módulo de
> free time en exportación.

**33. ¿Cuáles son las principales dependencias, riesgos o restricciones para implementar la propuesta?**

```
(1) Desarrollo y plazo —la propuesta cubre 5 módulos (visibilidad de free time en
exportación e importación, bookings, incidencias, prefijos restringidos); mitigación:
entrega en fases, empezando por el módulo de mayor impacto financiero en un piloto de 8
semanas. (2) Adopción por el equipo —riesgo de doble registro (planilla + sistema nuevo);
mitigación: puesta en marcha acompañada y designación del sistema como registro único apenas
validado. (3) Exactitud de las reglas comerciales —depende de confirmar, con Dow, el free
time, las tarifas negociadas por naviera y los prefijos restringidos; mitigación: modelo de
reglas versionado por fecha, actualizable sin perder historial. (4) Calidad de los datos en
la carga —mitigación: validación automática ISO 6346 de cada contenedor y auditoría de toda
corrección. No habría dependencia de TI de Dow: la solución sería autónoma, accesible por
navegador.
```

---

## Piloto (34–35)

**34. ¿La propuesta podría probarse en formato piloto o prueba de concepto?** ☑ **Sí, sin costo para Dow**

**35. Describa cómo sería un piloto inicial: localidad, duración, recursos necesarios, KPIs y criterio de éxito.**

```
Localidad propuesta: Bahía Blanca, punto de partida natural dado el volumen de exportación
que SSB ya opera para Dow/PBB Polisur. Duración: 8 semanas —las primeras 2–3 dedicadas a
cargar el historial de costos como línea de base y a parametrizar navieras, tarifas y free
time; las restantes a la operación acompañada y al reporte gerencial automático. Recursos:
ningún costo para Dow; horas de alineación con el equipo de logística para validar las
reglas comerciales. KPIs: costo mensual de detention comparado contra la línea de base de
2026 (USD 77 mil/mes en promedio, pico de USD 117 mil) y % de contenedores liberados dentro
del free time (línea de base a relevar en las primeras semanas). Criterio de éxito:
tendencia medible de reducción en el costo mensual de detention y reporte semanal entregado
a la gerencia al final del piloto. Un piloto validado en Bahía Blanca serviría de modelo
para replicar el módulo de exportación en otras plantas y países de América Latina y, en la
secuencia, para los demás módulos (importación, bookings, incidencias, prefijos
restringidos) y otras regiones (EMEAI/APAC/NAM), sujeto al contrato global de free time de
cada región negociado por Dow.
```

---

## Innovación y tecnología (36–38)

**36. ¿Cuál es el nivel de innovación de la propuesta para Dow?** ☑ **Nueva solución aún no aplicada en Dow**

**37. ¿La propuesta utiliza tecnología, automatización, digitalización, datos o inteligencia artificial?** ☑ **Sí**

**38. Si es así, describa la tecnología utilizada y cómo contribuye a generar productividad, costo o confiabilidad.**

```
La solución propuesta sería una aplicación web en la nube, con actualización en tiempo real
y auditoría completa. El núcleo sería un motor de cálculo diario que cruzaría cada
contenedor con las reglas comerciales de su naviera —free time y tarifas versionados por
fecha de vigencia, parametrizables según los contratos negociados por Dow con cada naviera—
proyectando el costo de no actuar, con alertas en semáforo. Incluiría automatización de
ingreso (carga por tanda con validación ISO 6346), control de acceso por rol
(operador/supervisor/administrador), registro de waivers con neto facturable, exportación
Excel configurable y reporte gerencial automático. La arquitectura sería 100% parametrizada
—navieras, tarifas, plantas, depósitos, prefijos restringidos e idioma
(español/portugués/inglés) como configuración, no como código— lo que convertiría la
réplica en otros sitios y regiones de América Latina (y, en fases siguientes, EMEAI/APAC/NAM)
en una cuestión de configuración, no un desarrollo nuevo.
```

---

## Otros impactos (39–41)

**39. Además de productividad y costo, ¿qué otros impactos positivos puede generar la propuesta?**
☑ **Gobernanza** + ☑ **Reducción de riesgo** + ☑ **Confiabilidad de supply** + ☑ **Calidad**

> Agregué "Calidad" respecto de la versión anterior: el módulo de prefijos restringidos es, en esencia,
> un control de calidad/cumplimiento sobre qué contenedores entran a operar con Dow. Sacá el check si
> preferís mantener solo las tres opciones originales.

**40. ¿La propuesta está alineada con algún desafío u oportunidad ya discutida con equipos de Dow?** **[COMPLETAR JOHN]**

> Si ya lo hablaste con alguien de Dow (logística Bahía Blanca, Compras), marcá "Sí" y completá la 41
> con área/contacto. Si no hubo conversación formal, "No" — no inventes un alineamiento verificable.

**41. Si es así, informe el área, localidad, contacto de Dow o contexto ya discutido.** **[COMPLETAR JOHN]**

---

## Pitch (42–44)

**42. En caso de selección, ¿su empresa estaría disponible para presentar la propuesta en una sesión de pitch de 15 minutos + 10 minutos de preguntas durante el Supplier Productivity Summit?** ☑ **Sí**

**43. Nombre y e-mail de la persona que presentaría la propuesta, en caso de ser seleccionada.**

```
Jonathan Ezequiel Zenteno Parrado — jzenteno@ssbint.com
```

**44. Comentarios adicionales:**

```
La propuesta cuenta con material de apoyo listo para el pitch: presentación ejecutiva y caso
de negocio construidos sobre datos reales y auditables de las planillas de costo de la
operación (serie mensual 2024–2026, concentración por naviera y premisas de cálculo). De ser
seleccionada, SSB se compromete a entregar el piloto del módulo de visibilidad de free time
en hasta 8 semanas, sin costo para Dow, con reporte medible de resultado al final. Por ser
una propuesta con arquitectura 100% parametrizada y multilingüe, el mismo diseño está
preparado para replicarse en las demás localidades de Dow en América Latina listadas en este
formulario y, en fases siguientes, en otras regiones donde Dow opera con SSB.
```

---

## Checklist antes de enviar

- [ ] Completar 8 (tiempo de relación comercial) y 9 (contacto de Compras)
- [ ] Decidir alcance de localidades en 13 (solo Bahia Blanca vs. multi-selección)
- [ ] Decidir 40/41 (alineamiento previo con equipos Dow) — solo si es real
- [ ] Confirmar que estás de acuerdo con el framing de la 18 ("No, es una propuesta nueva") — es la
      decisión que exige la regla dura de esta reescritura, no un hecho que yo pueda verificar
- [ ] Revisar el cambio en 31/32 (de "Hasta 30 días" / "Baja" a "3–6 meses" / "Media") — es más
      defendible con el alcance de 5 módulos, pero es tu llamada si preferís acotar la propuesta solo a
      free time de exportación para poder sostener 30 días / complejidad baja
- [ ] ⚠️ **Contradicción a resolver antes del pitch:** la pregunta 44 menciona que hay una presentación
      ejecutiva y un business case como material de apoyo (`docs/caso-negocio/` — no los toqué, fuera de
      alcance de esta tarea). Si esos archivos siguen con el framing viejo (abren con resultados medidos
      por un sistema ya en producción), van a contradecir la respuesta de la 18 apenas Dow los abra. Hay
      que alinear esos materiales al framing de "propuesta a desarrollar" antes de compartirlos, o no
      compartirlos y presentar solo la planilla de costos como respaldo.
- [ ] Confirmar si está bien nombrar a Maersk explícitamente en la 11/22 (concentración del 95% del
      costo en una sola naviera) — es un dato real y útil para Dow, pero es tu llamada si preferís
      generalizar a "una sola naviera" sin nombrarla
- [ ] Confirmar que el caveat ZIM (handoff 2026-07-07) está resuelto — ver nota en "Fuente de las
      cifras" arriba; si no lo está, USD 587.805 podría necesitar ajuste antes de enviar
