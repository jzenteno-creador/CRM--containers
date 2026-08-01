# Dow Supplier Productivity Summit 2026 — Respuestas para el formulario

> **Cómo usar este archivo:** las respuestas están en **portugués** (idioma del formulario), listas para
> seleccionar/pegar con la cuenta `jzenteno@ssbint.com`. Las notas en español (bloques `>`) son para vos,
> no se pegan. Los campos marcados **[COMPLETAR JOHN]** requieren un dato tuyo que no puedo saber.
>
> **Reescritura 2026-07-14 — cambio de framing obligatorio:** esta versión NO revela que el sistema ya
> existe, ya está construido o ya está en producción. Todo se redacta como **propuesta a desarrollar**
> (futuro/condicional: "propomos desenvolver", "o sistema permitiria", "estimamos"). Los datos de costos
> se presentan como medición operativa propia (planillas de la operación), nunca como output de una
> plataforma existente. Ver el checklist al final para las decisiones que quedaron abiertas.

---

## Fuente de las cifras (nota ES para John — no se pega)

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

**3. Nome da empresa:** `SSB INTERNATIONAL SA` *(ya precargado)*

**4. País principal de atuação da empresa:** ☑ **Argentina**

**5. Nome completo do responsável pela submissão:** `Jonathan Ezequiel Zenteno Parrado` *(ya precargado)*

**6. E-mail do responsável pela submissão:** `jzenteno@ssbint.com` *(ya precargado)*

---

## Perfil de la empresa (7–9)

**7. Qual é o setor principal de atuação da empresa?** ☑ **Logística**

**8. Há quanto tempo sua empresa atende ou se relaciona comercialmente com a Dow?** **[COMPLETAR JOHN]**

> Opciones del formulario: Menos de 1 ano / 1–3 anos / 3–5 anos / 5–10 anos / Mais de 10 anos / Ainda não
> atende a Dow. Elegí la franja real de la relación SSB ↔ Dow/PBB Polisur — no la puedo verificar yo.

**9. Qual é o nome do seu principal contato de Compras na Dow?** **[COMPLETAR JOHN]**

---

## El problema (10–11)

**10. Qual tipo de desafio da Dow sua proposta busca endereçar?** ☑ **Custo elevado de materiais ou serviços**

> Alternativa defendible: "Ineficiências, retrabalho ou gargalos de processo" (la causa raíz es de
> proceso: seguimiento manual). Recomiendo "Custo elevado" porque el pitch abre con USD 587 mil medidos
> en 11 meses — es la opción que el número respalda.

**11. Descreva de forma objetiva o problema, oportunidade ou necessidade que sua proposta busca resolver na Dow.**

```
O custo de detention de contêineres na operação de exportação de Bahía Blanca (PBB Polisur/Dow,
operada pela SSB) triplicou: de uma média de USD 25 mil/mês em 2025 para USD 77 mil/mês nos
primeiros seis meses de 2026, com pico de USD 117 mil em abril. No acumulado de agosto/2025 a
junho/2026 (11 meses), o custo medido chega a USD 587.805 — dos quais 95% (USD 558 mil) está
concentrado em cargas de um único armador (Maersk). No ritmo atual, 2026 fecharia acima de USD
900 mil, bem acima dos USD 434 mil de 2024 e dos USD 297 mil de 2025. Hoje o acompanhamento é
manual, por planilha: a demora só é percebida quando a fatura de detention já chegou, sem
alerta antecipado nem visibilidade diária do free time restante por contêiner e por armador. O
mesmo problema de visibilidade se repete em outras frentes da operação — bookings e
reprogramações de embarque, incidências com contêineres (lavagens exigidas, avarias) e o
controle de prefixos restritos exigido pela Dow — hoje tratados em planilhas paralelas, sem
rastreabilidade única. A oportunidade: um sistema que torne visível, a cada dia, quanto free
time resta por contêiner e por armador, e que alerte antes do primeiro dólar de cobrança.
```

---

## Categoría y alcance (12–14)

**12. Em qual categoria ou área a proposta se aplica principalmente?** ☑ **Logística**

> Si permite segunda opción: "Digitalização/automação". Si es opción única, Logística — la tecnología es
> el medio, el resultado es logístico.

**13. Para qual(is) localidade(s) da Dow a proposta poderia ser aplicada?**
☑ **Bahia Blanca** (onde a SSB já opera a exportação) — e, se o campo é multi-seleção, marcar também as
localidades com potencial de exportação/importação em contêineres: **Aratu, Guarujá, Santos Dumont, São
Paulo, Cartagena, Lima, Santiago, Cidade do México**.

> La pregunta dice "poderia ser aplicada" (potencial), así que marcar los sitios que operan con
> contenedores es legítimo. El checkbox del formulario es solo de localidades de América Latina — la
> escalabilidad a EMEAI/APAC/NAM que pediste se explica en texto libre (15–17, 38), no en este checkbox.
> Si preferís conservador: solo Bahia Blanca + responder 14 con "Sim". Vos conocés qué sitios mueven
> contenedores de exportación/importación — ajustá la lista.

**14. A proposta poderia ser escalada para outras unidades ou países da América Latina?** ☑ **Sim**

---

## La propuesta (15–17)

**15. Título da proposta ou projeto:**

```
Visibilidade e Controle de Free Time — proposta de plataforma para reduzir o custo de
detention/demurrage e gerenciar bookings, incidências e prefixos restritos na exportação e
na importação, escalável para outras plantas e países da América Latina
```

**16. Resuma sua proposta em até 5 linhas, explicando a solução e o benefício esperado para a Dow.**

```
Propomos desenvolver um sistema digital que acompanharia cada contêiner — na exportação e na
importação — desde a retirada ou chegada até a devolução, calculando diariamente o free time
restante por armador e alertando (semáforo verde/amarelo/vermelho) antes da primeira cobrança
de detention ou demurrage. A mesma plataforma gerenciaria bookings e roleo, registraria
incidências (lavagens exigidas, avarias) com o valor cobrado e recuperado em cada reclamo, e
faria a checagem de prefixos restritos definidos pela Dow. Escalável por país, planta e
contrato de free time, começando pela operação de exportação de Bahía Blanca. Benefício
estimado: entre USD 118 mil e USD 206 mil/ano de detention evitável, sem custo para a Dow.
```

**17. Explique como a solução funcionaria na prática. Inclua etapas principais, áreas envolvidas, tecnologia/processo utilizado e como a Dow participaria da implementação.**

```
Fluxo proposto, em 5 frentes:

(1) Visibilidade de free time (exportação e importação): registro da retirada dos vazios
(expo) e da chegada dos cheios (impo) por lote — a lista de contêineres colada tal como vem,
com validação automática do número (ISO 6346); cálculo diário dos dias livres restantes por
armador e do custo projetado com a tarifa vigente, com alertas em semáforo antes do primeiro
dólar de cobrança.

(2) Bookings e roleo: registro de bookings de retirada, controle de ETD, alertas de corte
documental e de embarque, e apoio à reprogramação ou reasignação de contêineres em risco de
atraso.

(3) Incidências e reclamos: registro de lavagens exigidas e avarias com fotos e linha do
tempo, e acompanhamento do reclamo até a resolução — quanto foi cobrado e quanto foi
recuperado.

(4) Prefixos restritos: validação automática dos prefixos de contêiner definidos pela Dow no
momento do ingresso, com varredura periódica sobre o estoque em operação.

(5) Relatórios: exportação para Excel com filtros e resumo periódico automático por e-mail à
gestão.

Tecnologia proposta: aplicação web em nuvem, com atualização em tempo real, perfis de acesso
por função (operador/supervisor/administrador) e trilha de auditoria completa.

Áreas envolvidas: a operação da SSB como usuária diária; logística/supply da Dow como
destinatária dos indicadores e do relatório gerencial.

Participação da Dow: validação das regras de free time e das tarifas negociadas com cada
armador, definição dos prefixos restritos e dos destinatários do relatório gerencial, e um
interlocutor de logística para acompanhar o piloto. Não exigiria integração com sistemas de
TI da Dow — solução autônoma, acessível por navegador.

Plano de implementação proposto: piloto de 8 semanas em Bahía Blanca, focado no módulo de
maior impacto financeiro (visibilidade de free time na exportação); os demais módulos
(importação, bookings, incidências, prefixos restritos) entrariam em fases seguintes,
priorizados em conjunto com a Dow.
```

---

## Implementación previa (18–19)

**18. Esta solução já foi implementada anteriormente?** ☑ **Não, é uma nova proposta**

> Decisión de framing explícita (no un hecho verificable por Dow): la consigna de esta reescritura es no
> revelar que existe una versión previa construida. Con esta respuesta, la pregunta 19 (condicional a
> "Sim, na Dow" / "Sim, em outro cliente" / "Sim, em piloto") **no se muestra** en el formulario real.

**19. Se já foi implementada, descreva onde, quando e quais resultados foram obtidos.**

```
Não aplicável — o formulário só exibe esta pergunta se a resposta da 18 for "Sim, na Dow",
"Sim, em outro cliente" ou "Sim, em piloto". Com "Não, é uma nova proposta" selecionado na
18, esta pergunta não é exibida.
```

---

## Diferencial y beneficio financiero (20–23)

**20. Qual é o principal diferencial da proposta em relação ao modelo atual?** ☑ **Uso de dados/IA/analytics**

**21. Qual é o benefício financeiro estimado para a Dow?** ☑ **USD 100–250 mil/ano**

**22. Informe o valor estimado do benefício financeiro anual para a Dow, em USD, e explique as principais premissas do cálculo.**

```
USD 118.000 a 206.000 por ano. Premissas: no acumulado de 11 meses (agosto/2025 a
junho/2026), o custo medido de detention na exportação de Bahía Blanca foi de USD 587.805,
dos quais 95% (USD 558 mil) concentrados em cargas de um único armador (Maersk). Como
hipótese de trabalho — baseada em benchmarks típicos de redução de detention quando se
implementa alerta antecipado e gestão ativa do free time —, aplicamos dois cenários sobre
esse custo medido: conservador, evitando 20% = USD 118 mil/ano; alcançável, evitando 35%
priorizando o armador de maior concentração = USD 206 mil/ano. Os valores consideram apenas
a exportação de Bahía Blanca; não incluem o potencial de importação (demurrage/detention em
destino), bookings, incidências nem prefixos restritos, cujo benefício ainda não está
quantificado por falta de linha de base.
```

**23. Qual é o tipo principal de ganho financeiro esperado?** ☑ **Saving direto**

> El costo de detention se paga hoy, todos los meses — reducirlo con alerta temprano sería saving
> directo, no cost avoidance.

---

## Productividad (24–25)

**24. Qual ganho de produtividade ou eficiência operacional a proposta pode gerar?**
☑ **Redução de horas manuais** *(si es multi-selección, agregar: Redução de retrabalho, Melhoria de planejamento, Menor complexidade operacional)*

**25. Como esse ganho de produtividade será medido? Indique KPIs, baseline atual e resultado esperado, se disponível.**

```
Dois KPIs propostos, medidos mensalmente contra a linha de base já registrada nas planilhas
de custo da operação: (1) custo de detention por mês, comparado à média de 2026 (USD 77
mil/mês) e ao pico de abril (USD 117 mil); (2) % de contêineres liberados dentro do free
time — hoje não medido de forma sistemática (apenas via planilha de custo consolidada
mensalmente), linha de base a ser levantada nas primeiras semanas do piloto. Em horas de
trabalho: o registro por lote substituiria o lançamento linha a linha em Excel, e qualquer
relatório sairia em um clique, eliminando o acompanhamento paralelo em múltiplas planilhas
manuais (custos, free time origem, free time destino, histórico de contêineres).
```

---

## Working capital (26–27)

**26. A proposta contribui para redução de working capital, estoque, inventário ou prazo de entrega?** ☑ **Parcialmente**

**27. Se aplicável, explique o impacto esperado.**

```
O impacto principal seria em custo, não em estoque. Parcialmente, a visibilidade diária
encurtaria o ciclo do contêiner na operação: contêineres priorizados embarcariam ou seriam
devolvidos antes, reduzindo o tempo de ativo retido e a exposição a cobranças em aberto. O
acompanhamento documentado de reclamos por lavagens e avarias também reduziria os valores em
disputa e o tempo até a recuperação.
```

---

## Costo e implementación (28–33)

**28. Qual é o custo estimado de implementação para a Dow?** ☑ **Sem custo para a Dow**

**29. Detalhe os custos estimados, incluindo investimento inicial, custos recorrentes, licenças, equipamentos, pessoas, treinamento ou outros recursos necessários.**

```
Investimento inicial: assumido integralmente pela SSB, incluindo o desenvolvimento da
plataforma e sua infraestrutura — sem custo de desenvolvimento ou licenciamento para a Dow.
Custos recorrentes: hospedagem e banco de dados em nuvem, de custo mínimo, também absorvidos
pela SSB como parte do serviço; sem licenças por usuário ou por posto. Treinamento: incluído
nas 2 primeiras semanas do piloto, conduzido pela SSB com a equipe operacional. Recursos
esperados da Dow: horas de alinhamento para validar as regras de free time, as tarifas
negociadas por armador e os prefixos restritos, além da definição dos destinatários do
relatório gerencial. Referência de retorno: evitar que dois contêineres por mês entrem em
atraso já cobriria a operação anual proposta para o sistema.
```

**30. Quais recursos seriam necessários da Dow para implementar ou testar a proposta?**
☑ **Tempo de operação** + ☑ **Dados/informações**

> "Dados/informações" = validar regras de free time y tarifas negociadas con cada naviera, y confirmar
> los prefijos restringidos. Si el formulario permite una sola opción, elegí "Tempo de operação".

**31. Qual é o tempo estimado para implementação completa da proposta, considerando desde a aprovação até a solução estar operacional na Dow?** ☑ **3–6 meses**

> Cambié esta respuesta respecto de la versión anterior (que decía "Até 30 dias"). Con el alcance nuevo
> (5 módulos: free time expo/impo, bookings, incidências, prefixos restritos, multi-región) prometer 30
> días no es defendible como propuesta desde cero. El piloto del módulo de mayor impacto (free time en
> exportación, Bahía Blanca) sí se plantea en 8 semanas — ver pregunta 35 — pero la "implementação
> completa" de toda la propuesta es realista en 3–6 meses. Avisame si preferís otra franja.

**32. Qual é a complexidade de implementação da proposta?** ☑ **Média — exige coordenação entre áreas, ajustes operacionais ou validações técnicas**

> También cambié esto (antes "Baixa"). El alcance multi-módulo y multi-región coordina operación,
> logística/supply de Dow y validación de reglas comerciales por naviera — es coherente marcarlo como
> complejidad media, no baja. Avisame si preferís mantener "Baixa" acotando el pitch solo al módulo de
> free time en exportación.

**33. Quais são as principais dependências, riscos ou restrições para implementar a proposta?**

```
(1) Desenvolvimento e prazo — a proposta cobre 5 módulos (visibilidade de free time na
exportação e na importação, bookings, incidências, prefixos restritos); mitigação: entrega
faseada, começando pelo módulo de maior impacto financeiro em piloto de 8 semanas. (2)
Adoção pela equipe — risco de duplo registro (planilha + sistema novo); mitigação: piloto
acompanhado e designação do sistema como registro único assim que validado. (3) Exatidão das
regras comerciais — depende da confirmação, com a Dow, do free time, das tarifas negociadas
por armador e dos prefixos restritos; mitigação: modelo de regras versionado por data,
atualizável sem perder histórico. (4) Qualidade dos dados na carga — mitigação: validação
automática ISO 6346 de cada contêiner e auditoria de toda correção. Não haveria dependência
de TI da Dow: a solução seria autônoma, acessível por navegador.
```

---

## Piloto (34–35)

**34. A proposta poderia ser testada em formato piloto ou prova de conceito?** ☑ **Sim, sem custo para a Dow**

**35. Descreva como seria um piloto inicial: localidade, duração, recursos necessários, KPIs e critério de sucesso.**

```
Localidade proposta: Bahía Blanca, ponto de partida natural dado o volume de exportação já
operado pela SSB para a Dow/PBB Polisur. Duração: 8 semanas — as primeiras 2–3 dedicadas à
carga do histórico de custos como linha de base e à parametrização de armadores, tarifas e
free time; as demais à operação acompanhada e ao relatório gerencial automático. Recursos:
nenhum custo para a Dow; horas de alinhamento com o time de logística para validar as regras
comerciais. KPIs: custo mensal de detention comparado à linha de base de 2026 (USD 77
mil/mês em média, pico de USD 117 mil) e % de contêineres liberados dentro do free time
(linha de base a ser levantada nas primeiras semanas). Critério de sucesso: tendência
mensurável de redução no custo mensal de detention e relatório semanal entregue à gestão até
o final do piloto. Um piloto validado em Bahía Blanca serviria de modelo para replicar o
módulo de exportação em outras plantas e países da América Latina e, na sequência, para os
demais módulos (importação, bookings, incidências, prefixos restritos) e outras regiões
(EMEAI/APAC/NAM), sujeito ao contrato global de free time de cada região negociado pela Dow.
```

---

## Innovación y tecnología (36–38)

**36. Qual é o nível de inovação da proposta para a Dow?** ☑ **Nova solução ainda não aplicada na Dow**

**37. A proposta utiliza tecnologia, automação, digitalização, dados ou inteligência artificial?** ☑ **Sim**

**38. Se sim, descreva a tecnologia utilizada e como ela contribui para gerar produtividade, custo ou confiabilidade.**

```
A solução proposta seria uma aplicação web em nuvem, com atualização em tempo real e trilha
de auditoria completa. O núcleo seria um motor de cálculo diário que cruzaria cada
contêiner com as regras comerciais do seu armador — free time e tarifas versionados por
data de vigência, parametrizáveis conforme os contratos negociados pela Dow com cada
armador — projetando o custo de não agir, com alertas em semáforo. Incluiria automação de
entrada (carga por lote com validação ISO 6346), controle de acesso por perfil
(operador/supervisor/administrador), registro de waivers com valor líquido faturável,
exportação Excel configurável e relatório gerencial automático. A arquitetura seria 100%
parametrizada — armadores, tarifas, plantas, depósitos, prefixos restritos e idioma
(espanhol/português/inglês) como configuração, não como código — o que tornaria a réplica em
outros sites e regiões da América Latina (e, em fases seguintes, EMEAI/APAC/NAM) uma questão
de configuração, não um novo desenvolvimento.
```

---

## Otros impactos (39–41)

**39. Além de produtividade e custo, quais outros impactos positivos a proposta pode gerar?**
☑ **Governança** + ☑ **Redução de risco** + ☑ **Confiabilidade de supply** + ☑ **Qualidade**

> Agregué "Qualidade" respecto de la versión anterior: el módulo de prefixos restritos es, en esencia,
> un control de calidad/cumplimiento sobre qué contenedores entran a operar con Dow. Sacá el check si
> preferís mantener solo las tres opciones originales.

**40. A proposta está alinhada a algum desafio ou oportunidade já discutida com times da Dow?** **[COMPLETAR JOHN]**

> Si ya lo hablaste con alguien de Dow (logística Bahía Blanca, Compras), marcá "Sim" y completá la 41
> con área/contacto. Si no hubo conversación formal, "Não" — no inventes un alineamiento verificable.

**41. Se sim, informe a área, localidade, contato Dow ou contexto já discutido.** **[COMPLETAR JOHN]**

---

## Pitch (42–44)

**42. Em caso de seleção, sua empresa estaria disponível para apresentar a proposta em uma sessão de pitch de 15 minutos + 10 minutos de perguntas durante o Supplier Productivity Summit?** ☑ **Sim**

**43. Nome e e-mail da pessoa que apresentaria a proposta, caso selecionada.**

```
Jonathan Ezequiel Zenteno Parrado — jzenteno@ssbint.com
```

**44. Comentários adicionais:**

```
A proposta conta com material de apoio pronto para o pitch: apresentação executiva e caso de
negócio construídos sobre dados reais e auditáveis das planilhas de custo da operação (série
mensal 2024–2026, concentração por armador e premissas de cálculo). Se selecionada, a SSB se
compromete a entregar o piloto do módulo de visibilidade de free time em até 8 semanas, sem
custo para a Dow, com relatório mensurável de resultado ao final. Por ser proposta com
arquitetura 100% parametrizada e multilíngue, o mesmo desenho está preparado para ser
replicado nas demais localidades da Dow na América Latina listadas neste formulário e, em
fases seguintes, em outras regiões onde a Dow opera com a SSB.
```

---

## Checklist antes de enviar

- [ ] Completar 8 (tiempo de relación comercial) y 9 (contacto de Compras)
- [ ] Decidir alcance de localidades en 13 (solo Bahia Blanca vs. multi-selección)
- [ ] Decidir 40/41 (alineamiento previo con equipos Dow) — solo si es real
- [ ] Confirmar que estás de acuerdo con el framing de la 18 ("Não, é uma nova proposta") — es la
      decisión que exige la regla dura de esta reescritura, no un hecho que yo pueda verificar
- [ ] Revisar el cambio en 31/32 (de "Até 30 dias" / "Baixa" a "3–6 meses" / "Média") — es más
      defendible con el alcance de 5 módulos, pero es tu llamada si preferís acotar la propuesta solo a
      free time de exportación para poder sostener 30 días / complejidad baja
- [ ] ⚠️ **Contradicción a resolver antes del pitch:** la pregunta 44 menciona que hay una presentación
      ejecutiva y un business case como material de apoyo (`docs/caso-negocio/` — no los toqué, fuera de
      alcance de esta tarea). Si esos archivos siguen con el framing viejo (abren con resultados medidos
      por un sistema ya en producción), van a contradecir la respuesta de la 18 apenas Dow los abra.
      Hay que alinear esos materiales al framing de "propuesta a desarrollar" antes de compartirlos, o no
      compartirlos y presentar solo la planilla de costos como respaldo.
- [ ] Confirmar si está bien nombrar a Maersk explícitamente en la 11/22 (concentración del 95% del
      costo en un solo armador) — es un dato real y útil para Dow, pero es tu llamada si preferís
      generalizar a "um único armador" sin nombrarlo
- [ ] Confirmar que el caveat ZIM (handoff 2026-07-07) está resuelto — ver nota en "Fuente de las cifras"
      arriba; si no lo está, USD 587.805 podría necesitar ajuste antes de enviar
