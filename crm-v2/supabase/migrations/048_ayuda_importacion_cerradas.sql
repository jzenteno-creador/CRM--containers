-- ═══════════════════════════════════════════════════════════════════════════
-- 048 · Ayuda — sección "Cerradas" de Importación (2026-08-02)
-- ═══════════════════════════════════════════════════════════════════════════
-- Suma el instructivo de la sección "Cerradas" (última de /importacion, colapsada por
-- default): desbloquea en el front el modal de corrección de fechas de una operación
-- cerrada (crm_corregir_operacion_impo_cerrada, 039), que estaba implementado sin caller
-- porque ninguna fila cerrada llegaba nunca a la UI.
--
-- Solo DML de ayuda (misma sección 'importacion' que ya sumó el CHECK en la 033 —
-- 'importacion' ya está en la lista, no hace falta tocar el constraint). Orden 6:
-- continúa los 5 items de sección ya sembrados por la 033 ("¿Qué es la solapa
-- Importación?" … "Anular una operación (supervisor+)").
-- ═══════════════════════════════════════════════════════════════════════════

delete from crm.ayuda_contenido
 where seccion = 'importacion' and nivel = 'seccion'
   and titulo = 'Cerradas: historial y corrección de una operación ya cerrada';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('importacion', 'Cerradas: historial y corrección de una operación ya cerrada',
   E'Al final de la pantalla, debajo de los 4 grupos de pendientes, está **Cerradas** — colapsada por default porque es historial, no una cola de trabajo. Lista cada operación con la **devolución ya confirmada**, con sus días de estadía, exceso y costo tal como los calculó el sistema (las mismas cifras que ves en Alertas y Reportes — acá no se recalcula nada).\n\nNo hay campos para cargar: es de solo lectura, salvo por el botón **Plata** de cada fila.\n\n1. Tocá el título **Cerradas** para desplegarla.\n2. Si la lista es larga, escribí unas letras del **número de contenedor** en la caja de búsqueda — filtra al instante, sin volver a consultar el servidor.\n3. Tocá **Plata** en la fila que te interesa: se abre el mismo panel que en los pendientes, pero acá con el resumen **realizado** (no proyectado).\n4. Si la naviera absorbe días **después** del cierre, registrá el waiver ahí mismo — el costo neto se recalcula solo.\n5. Si una fecha (retiro de terminal, ingreso a planta o devolución) se cargó mal, usá **Corregir dato de la cerrada** — visible solo para **supervisor** o **administrador** — pide un motivo obligatorio y queda un evento en el historial de la operación con el valor anterior, el nuevo y quién lo cambió.',
   6);

notify pgrst, 'reload schema';
