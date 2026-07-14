-- ============================================================================
-- seeds-ayuda/b7_reportes — contenido de ayuda_contenido para la sección
-- `reportes` (nueva) — §15.5: generado DESDE el brief de negocio de B7 (réplica
-- del Excel manual de stock de Omar Pérez) y el contrato real de la pantalla
-- /reportes: crm.vista_alertas, crm.vista_kpi_costos_cerradas,
-- crm.vista_carga_actual y crm.configuracion (umbral_alerta_amarillo).
--
-- ⚠️ NO APLICADO por el ui-builder (B7 es UI-only, no toca supabase/migrations/ —
-- otro agente puede estar trabajando en paralelo, ej. importación/impo). Lo
-- aplica quien escriba la próxima migración de DB, mismo criterio que el resto
-- de seeds-ayuda/*.sql (ver m5b3_bookings.sql / m5b6_prefijos.sql). Idempotente:
-- DELETE + INSERT.
--
-- PRECONDICIÓN — DDL requerido ANTES de poder insertar la sección 'reportes':
-- crm.ayuda_contenido.seccion tiene un CHECK (migración 002, extendido en 031)
-- que hoy NO incluye 'reportes'. Sin este ALTER, el primer INSERT de más abajo
-- falla con "new row ... violates check constraint ayuda_contenido_seccion_check".
--
--   alter table crm.ayuda_contenido drop constraint ayuda_contenido_seccion_check;
--   alter table crm.ayuda_contenido add constraint ayuda_contenido_seccion_check
--     check (seccion in ('ingreso', 'egreso', 'contenedores', 'alertas',
--            'incidencias', 'admin', 'dashboard', 'faq', 'bookings', 'prefijos',
--            'reportes'));
--
-- (nombre auto-generado por Postgres para un CHECK inline sin nombre explícito —
-- confirmar con `select conname from pg_constraint where conrelid =
-- 'crm.ayuda_contenido'::regclass and contype = 'c';` antes de aplicar, por las dudas.
-- Verificado en vivo el 2026-07-14 contra cctuowthpnstvdgjuomq: el conjunto actual
-- es exactamente ('ingreso','egreso','contenedores','alertas','incidencias','admin',
-- 'dashboard','faq','bookings','prefijos') — agregar 'reportes' es el único cambio.)
--
-- A DIFERENCIA de bookings/prefijos: el front de /reportes YA está construido (M4
-- B4 + este bloque B7), pero el "?" contextual de la solapa TODAVÍA NO está
-- cableado — queda fuera del alcance de B7 (restringido a src/app/(app)/reportes/**).
-- Falta, en un paso aparte, agregar 'reportes' a:
--   - src/components/fd/shell.tsx           → TAB_SECCION["/reportes"] = "reportes"
--   - src/app/(app)/ayuda/page.tsx          → mapa de secciones del banco (SECTION_META)
--   - src/app/(app)/admin/ayuda/page.tsx    → selector de secciones del editor (SECCIONES)
-- Sin ese cableado, este contenido queda accesible solo por query directa a la
-- tabla (o una vez que el "?" de /reportes se registre) — el INSERT de abajo no
-- depende de eso y puede aplicarse igual.
-- ============================================================================

-- ── sección: reportes ───────────────────────────────────────────────────────
delete from crm.ayuda_contenido where seccion = 'reportes' and nivel = 'seccion';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('reportes', '¿Qué es la solapa Reportes?',
   E'Reportes tiene **dos exportaciones a Excel**, pensadas para dos usos distintos:\n\n1. **Export configurable** (botón cyan, arriba a la derecha): elegís filtros (rango de fecha de retiro, naviera, planta, depósito, estado, tipo de cierre) y qué columnas incluir, mirás el preview en pantalla y descargás.\n2. **Excel formato Omar** (botón separado, en su propio panel): réplica FIJA del Excel manual de control de stock que arma Omar los martes y jueves. No tiene columnas para elegir ni usa los filtros del punto 1 — siempre trae el stock completo.\n\nLos números de costos y días de ambos exports salen YA CALCULADOS del sistema (las mismas vistas que alimentan Alertas y el Dashboard) — la pantalla solo los junta y los muestra, nunca recalcula nada.\n\nAl igual que el resto del sistema, ves las operaciones de **tu planta** si sos operador, o de **las dos plantas** si sos supervisor o administrador.',
   1),

  ('reportes', 'El export configurable — filtros y columnas',
   E'Arriba de la tabla hay dos paneles:\n\n- **Filtros**: recortan qué operaciones entran al reporte — rango de fecha de retiro, naviera, planta, depósito, estado y tipo de cierre. Se combinan entre sí (Y, no O). "limpiar filtros" los resetea todos de una.\n- **Columnas a exportar**: tildá o destildá qué columnas querés ver y exportar — separadas en **descriptivas** (contenedor, naviera, planta, fechas, bookings) y **costos y días** (estadía, días libres, tarifa, costo bruto/absorbido/neto, waiver). El preview de abajo se actualiza al instante.\n\nEl botón **Exportar a Excel** queda deshabilitado si no hay filas o no hay ninguna columna tildada. El reporte trae como máximo **1.000 filas** por corrida — si tu combinación de filtros trae más, un aviso ámbar lo indica y conviene acotar el rango de fechas u otro filtro.',
   2),

  ('reportes', 'Excel formato Omar — qué es y para qué sirve',
   E'Antes de este sistema, Omar armaba a mano un Excel de control de stock dos veces por semana para saber qué contenedores tiene la empresa, cuáles están por vencer y cuáles ya generan costo. El botón **Excel formato Omar** genera ESE MISMO archivo desde el sistema, con las columnas en el mismo orden y el mismo significado que su planilla — para poder comparar uno contra el otro sin traducir nada.\n\nEl archivo trae **4 hojas**:\n\n- **General**: todas las operaciones abiertas, sin excepción.\n- **Vencidos**: ya pasaron la fecha de vencimiento de su freetime — generan costo de detention.\n- **Próximos a vencer**: les quedan {{umbral}} días o menos de freetime — para priorizar el retiro.\n- **Vacíos a vencer**: contenedores **vacíos** que todavía tienen freetime de sobra — candidatos a devolver primero para no ocupar espacio en planta.\n\nEn esta etapa la generación es **manual** (con este botón); el envío automático por email queda para una próxima iteración.',
   3),

  ('reportes', 'Cómo generar el Excel de Omar',
   E'1. Entrá a **Reportes** y ubicá el panel **"Reporte de stock (formato Omar)"**, arriba de los filtros — es independiente de ellos.\n2. Tocá **Excel formato Omar**. El sistema trae automáticamente TODO el stock abierto del momento (no importa qué filtros tengas cargados más abajo).\n3. Esperá a que el botón termine (muestra un spinner mientras arma las 4 hojas) — no hace falta tocar nada más.\n4. El archivo `stock_contenedores_AAAA-MM-DD.xlsx` se descarga solo, con la fecha de hoy en el nombre.\n5. Revisá los contadores que aparecen junto al botón (General / Vencidos / Próx. a vencer / Vacíos a vencer) para confirmar de un vistazo cuántas filas trae cada hoja antes de abrir el archivo.\n\nSi no hay ninguna operación abierta, el sistema avisa con un mensaje y NO descarga ningún archivo vacío.',
   4),

  ('reportes', 'Si algo no coincide con el Excel manual',
   E'Los montos y días de este reporte salen de las mismas vistas que usa toda la pantalla de **Alertas** — si un número no coincide con lo que Omar tiene anotado a mano, lo más probable es que su planilla esté desactualizada (freetime vencido cargado distinto, un waiver no anotado, una devolución que todavía no le llegó) y no al revés, porque acá el cálculo es automático y siempre corre con los datos vivos del sistema.\n\nLa columna **Fecha vencimiento** es el único dato de esta hoja que el sistema arma "al vuelo" (fecha de retiro + días libres) en vez de leerlo directo de una tabla — el resultado es el mismo día que marca **Días restantes** en Alertas, solo que expresado como fecha en lugar de cuenta regresiva.',
   5);
