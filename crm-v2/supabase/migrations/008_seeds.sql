-- ============================================================================
-- 008_seeds — M1 rebuild v2 CRM Detention
-- navieras (14 canónicas del Excel `free time origin.xlsx`) + mapa de alias
-- del histórico como artefacto + freetime_origin (valores del Excel,
-- vigencias reales leídas READ-ONLY de detention.freetime_origin) + FAQ
-- inicial de ayuda (§15.2).
--
-- REPORTE DE MATCHEO DE VIGENCIAS (verificado 2026-07-08 contra
-- detention.freetime_origin, regimen='vacios' — detalle en el entregable CP1):
--   · Match exacto/case-insensitive: CEVA LOGISTICS, DHL, DP World, DSV,
--     EVERGREEN, Expeditors → vigente_desde 2025-05-01
--   · Alias del plan: CMA/MERCOSUL LINE→CMA CGM (2025-05-01),
--     HAPAG→HAPAG LLOYD (2025-05-01), MAERSK→MAERSK (2025-05-01),
--     ZIM→ZIM LINES (ver abajo)
--   · Alias EXTENDIDOS (decisión documentada: valores de tarifa idénticos en
--     v1, identificación inequívoca — evita el fallback 2025-08-01 que
--     seedearía vigencias falsas): LOG-IN→LOG-IN LOGISTICA INTERMODAL S.A.,
--     MSC→MEDITERRANEAN SHIPPING COMPANY (MSC), ONE→OCEAN NETWORK EXPRESS
--     (ONE), SCAN GLOBAL→SCAN GLOBAL LOGISTICS → todas 2025-05-01
--   · ZIM LINES: v1 tiene 3 versiones; la que matchea los valores del Excel
--     (21|sí|Combined|25) rigió 2026-07-01→2026-07-03 ⇒ vigente_desde
--     2026-07-01. DISCREPANCIA reportada: v1 tiene una versión posterior
--     abierta (0 días|Detention|84 USD desde 2026-07-04) que el Excel no
--     refleja — John decide en el cutover.
--   · HAPAG LLOYD: DISCREPANCIA de valores reportada — v1 dice 14 días, el
--     Excel (fuente canónica de valores de este seed) dice 21. Se seedean los
--     del Excel con la vigencia real de v1 (2025-05-01).
--   · Fallback 2025-08-01: NO fue necesario para ninguna naviera.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- navieras — nombres canónicos del Excel. cobra_detention_origen=true para
-- las 14 (paridad verificada contra detention.navieras).
-- ----------------------------------------------------------------------------
insert into crm.navieras (nombre) values
  ('CEVA LOGISTICS'),
  ('CMA CGM'),
  ('DHL'),
  ('DP World'),
  ('DSV'),
  ('EVERGREEN'),
  ('Expeditors'),
  ('HAPAG LLOYD'),
  ('LOG-IN LOGISTICA INTERMODAL S.A.'),
  ('MAERSK'),
  ('MEDITERRANEAN SHIPPING COMPANY (MSC)'),
  ('OCEAN NETWORK EXPRESS (ONE)'),
  ('SCAN GLOBAL LOGISTICS'),
  ('ZIM LINES');

-- ----------------------------------------------------------------------------
-- Mapa de alias histórico v1 → canónico v2, como ARTEFACTO consultable
-- (insumo del cutover y del warning prefijo→naviera de M3 — plan §4 riesgos).
-- Incluye los 4 del plan + los extendidos usados en el matcheo de vigencias.
-- ----------------------------------------------------------------------------
insert into crm.configuracion (clave, valor) values
  ('alias_navieras_historico', '{
    "CMA/MERCOSUL LINE": "CMA CGM",
    "HAPAG": "HAPAG LLOYD",
    "ZIM": "ZIM LINES",
    "MAERSK": "MAERSK",
    "LOG-IN": "LOG-IN LOGISTICA INTERMODAL S.A.",
    "MSC": "MEDITERRANEAN SHIPPING COMPANY (MSC)",
    "ONE": "OCEAN NETWORK EXPRESS (ONE)",
    "SCAN GLOBAL": "SCAN GLOBAL LOGISTICS",
    "DP WORLD": "DP World",
    "EXPEDITORS": "Expeditors"
  }'::jsonb);

-- ----------------------------------------------------------------------------
-- freetime_origin — 14 filas: valores del Excel + vigencias reales de v1.
-- Todas regimen='vacios', vigente_hasta NULL (versión vigente).
-- INSERT directo (contexto de migración, rol postgres): la RPC DEFINER exige
-- un caller admin con sesión, que todavía no existe.
-- ----------------------------------------------------------------------------
insert into crm.freetime_origin
  (naviera_id, dias_libres, aplica_carga_peligrosa, tipo, tarifa_usd_dia,
   vigente_desde, vigente_hasta, regimen)
select n.id, s.dias, s.peligrosa, s.tipo, s.tarifa, s.desde, null, 'vacios'
from (values
  ('CEVA LOGISTICS',                       10, true,  'Combined',  175.00, date '2025-05-01'),
  ('CMA CGM',                              18, true,  'Combined',   25.00, date '2025-05-01'),
  ('DHL',                                  10, true,  'Combined',  325.00, date '2025-05-01'),
  ('DP World',                             10, true,  'Combined',  220.00, date '2025-05-01'),
  ('DSV',                                  14, false, 'Combined',  180.00, date '2025-05-01'),
  ('EVERGREEN',                            10, true,  'Combined',   25.00, date '2025-05-01'),
  ('Expeditors',                           10, false, 'Combined',  180.00, date '2025-05-01'),
  ('HAPAG LLOYD',                          21, false, 'Combined',   25.00, date '2025-05-01'),
  ('LOG-IN LOGISTICA INTERMODAL S.A.',     21, true,  'Detention', 125.00, date '2025-05-01'),
  ('MAERSK',                               14, true,  'Detention',  35.00, date '2025-05-01'),
  ('MEDITERRANEAN SHIPPING COMPANY (MSC)', 15, true,  'Combined',   50.00, date '2025-05-01'),
  ('OCEAN NETWORK EXPRESS (ONE)',          21, true,  'Detention',  25.00, date '2025-05-01'),
  ('SCAN GLOBAL LOGISTICS',                 0, false, 'Combined',  150.00, date '2025-05-01'),
  ('ZIM LINES',                            21, true,  'Combined',   25.00, date '2026-07-01')
) as s(nombre, dias, peligrosa, tipo, tarifa, desde)
join crm.navieras n on n.nombre = s.nombre;

-- ----------------------------------------------------------------------------
-- ayuda_contenido — FAQ global inicial (§15.2). El contenido por solapa lo
-- siembra cada módulo M3–M10 (§15.5).
-- ----------------------------------------------------------------------------
insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('faq', '¿Qué arranca y qué corta el free time?',
   E'El free time **arranca con el retiro del contenedor en el depósito** (la fecha de retiro cuenta como **día 1**) y **lo corta la confirmación de ingreso a terminal o la devolución del vacío** — no la salida de planta.\n\nMientras la operación está abierta, el sistema calcula los días transcurridos contra los días libres de la naviera y proyecta el costo en la solapa **Alertas**.',
   1),
  ('faq', '¿Cómo se calculan los días y el costo proyectado?',
   E'- **Días transcurridos**: días calendario en zona horaria argentina, contando el día del retiro como día 1.\n- **Días libres**: los de la tarifa de la naviera **vigente a la fecha del retiro** (las tarifas están versionadas).\n- **Costo proyectado**: `máx(0, días transcurridos − días libres) × tarifa USD/día`.\n- Operación **sin cargo**: costo 0. Naviera **sin tarifa vigente** o que **no cobra detention en origen**: semáforo *neutro*, sin costo calculable.',
   2),
  ('faq', '¿Qué significa cada color del semáforo?',
   E'- 🟢 **Verde**: quedan más días libres que el umbral configurado.\n- 🟡 **Amarillo**: quedan pocos días (umbral editable en Admin → Configuración; default 3).\n- 🔴 **Rojo**: el free time está vencido — cada día suma costo.\n- ⚪ **Neutro**: la naviera no tiene tarifa vigente para la fecha de retiro, o no cobra detention en origen.',
   3),
  ('faq', '¿Qué es una anulación y en qué se diferencia de cerrar?',
   E'**Cerrar** una operación es el fin normal del ciclo: el contenedor ingresó a terminal o se devolvió vacío (con fecha de devolución, que corta el free time).\n\n**Anular** es marcar que la operación **no debió existir** (error de carga, tanda duplicada). Requiere **supervisor o administrador** y un motivo. No borra nada: la operación queda auditada con su evento de anulación en el timeline.',
   4),
  ('faq', '¿Qué hago si el contenedor ya tiene un ciclo abierto?',
   E'El sistema garantiza **una sola operación abierta por contenedor**. Si al cargar una tanda aparece el error de ciclo abierto:\n\n1. Buscá el contenedor en la solapa **Contenedores**.\n2. Revisá su operación abierta: si es legítima, el contenedor todavía no cerró su ciclo anterior (confirmá la devolución si corresponde).\n3. Si la operación abierta es un error, pedile a un supervisor que la **anule** y volvé a cargar la tanda.',
   5),
  ('faq', '¿Cómo se aprueba un usuario nuevo?',
   E'1. La persona se registra con email y contraseña y confirma su email.\n2. Su cuenta queda **pendiente de aprobación**: puede loguearse pero no ve ningún dato.\n3. Un **administrador** ve la solicitud en la campana de notificaciones y en **Admin → Solicitudes de acceso**, y la aprueba asignando **rol** (y **planta**, obligatoria para operadores) — o la rechaza con motivo.\n4. Al siguiente login, la persona ya opera según su rol y planta.',
   6);
