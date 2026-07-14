-- ============================================================================
-- seeds-ayuda/m5b2_importacion — contenido de ayuda_contenido para la sección
-- `importacion` (nueva) + tooltips de campo del encabezado de la orden (§15.5:
-- generado DESDE el brief de negocio de M5 B2 y el contrato real de
-- crm.ordenes_impo / crm.operaciones_impo / las RPCs crm_crear_orden_impo,
-- crm_confirmar_retiro_terminal, crm_confirmar_ingreso_planta_impo,
-- crm_registrar_salida_devolucion_impo, crm_confirmar_devolucion_impo,
-- crm_anular_operacion_impo — migración 032).
--
-- ⚠️ NO APLICADO por el ui-builder (B2 es UI-only, no toca supabase/migrations/ —
-- otro agente puede estar trabajando en paralelo). Lo aplica quien escriba la
-- próxima migración de DB, mismo criterio que el resto de seeds-ayuda/*.sql.
-- Idempotente: DELETE + INSERT.
--
-- PRECONDICIÓN — DDL requerido ANTES de poder insertar la sección 'importacion':
-- crm.ayuda_contenido.seccion tiene un CHECK (migración 002, extendido por la 031
-- con 'bookings'/'prefijos') que hoy NO incluye 'importacion'. Sin este ALTER, el
-- primer INSERT de más abajo falla con "new row ... violates check constraint
-- ayuda_contenido_seccion_check".
--
--   alter table crm.ayuda_contenido drop constraint ayuda_contenido_seccion_check;
--   alter table crm.ayuda_contenido add constraint ayuda_contenido_seccion_check
--     check (seccion in ('ingreso', 'egreso', 'contenedores', 'alertas',
--            'incidencias', 'admin', 'dashboard', 'faq', 'bookings', 'prefijos',
--            'importacion'));
--
-- (confirmar el nombre real del constraint con `select conname from pg_constraint
-- where conrelid = 'crm.ayuda_contenido'::regclass and contype = 'c';` antes de
-- aplicar, por las dudas — la 031 ya lo dejó con este nombre, pero por las dudas.)
--
-- (El front ya está preparado para consumir esta sección apenas exista: shell.tsx
-- TAB_SECCION, /ayuda SECTION_META y admin/ayuda SECCIONES ya listan 'importacion'
-- — agregado en el mismo bloque B2 que este seed.)
--
-- LIMITACIÓN CONOCIDA (reportada, no resuelta acá): crm.crm_ayuda_valores(p_naviera,
-- p_regimen) solo lee crm.freetime_origin (tarifas de ORIGEN, ingreso/egreso). No
-- hay una versión que lea crm.freetime_destino (tarifas de DESTINO, importación) —
-- por eso los tooltips de campo de acá abajo NO usan los placeholders
-- {{dias_libres_frase}} / {{tarifa_frase}} (mostrarían el número de origen, que es
-- el ámbito equivocado para un campo de importación). El copy queda genérico, sin
-- ningún número hardcodeado. Si se necesita el número real de destino en el
-- tooltip, hace falta una RPC nueva (o extender crm_ayuda_valores con
-- p_regimen='destino' contra freetime_destino) — fuera de alcance de B2 (UI-only).
-- ============================================================================

-- ── sección: importacion ────────────────────────────────────────────────────
delete from crm.ayuda_contenido where seccion = 'importacion' and nivel = 'seccion';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('importacion', '¿Qué es la solapa Importación?',
   E'El ciclo de **importación** es el espejo del de exportación, pero en sentido contrario: **arribo a terminal → retiro de terminal → ingreso a planta → devolución del vacío**. La devolución es la que **corta el reloj** de demurrage/detention — hasta ahí, el costo sigue corriendo.\n\nUna **orden** trae de **1 a 4 contenedores con arribo común** (llegan en el mismo buque). Los retiros, en cambio, suelen ser **escalonados**: un mismo camión hace varios viajes el mismo día, así que cada contenedor puede tener su propia fecha y hora de retiro dentro de la misma orden.\n\n> En la práctica, la carga la hace **una sola persona, después de los hechos** — por eso el formulario prioriza "menos clicks": un encabezado único para toda la orden, y de ahí en más, todo en lote.',
   1),

  ('importacion', 'Cargar una orden nueva, paso a paso',
   E'1. Completá el **encabezado** una sola vez: número de orden, naviera, fecha de arribo a terminal y planta destino (booking/BL y buque son opcionales). Si sos operador, la planta destino ya viene fijada a la tuya.\n2. **Pegá los números** de contenedor de la orden (uno por línea o separados por coma) — hasta 4 por arribo. Cada uno se valida en vivo con el dígito verificador ISO 6346.\n3. Revisá el **tipo** de cada contenedor: viene con 40HC por defecto, editable fila por fila con el selector.\n4. Si algún prefijo está en la lista restringida de Dow, la fila se marca en **ámbar** — no bloquea el envío, pero al tocar "Crear orden" te pide confirmar antes de continuar.\n5. Tocá **Crear orden de importación**: el resultado se muestra fila por fila (aceptado o rechazado, con el motivo). Si **todos** los contenedores fueron rechazados, la orden queda creada pero **vacía** — un aviso destacado te lo señala para que reintentes o avises al supervisor.',
   2),

  ('importacion', 'Los 4 grupos de pendientes',
   E'Debajo del formulario, la orden avanza por 4 grupos (colapsables, cada uno con su contador):\n\n1. **En terminal** — recién arribados. Acá se **confirma el retiro**, con una particularidad: como los retiros son escalonados, el modal trae una fecha/hora por defecto que podés **ajustar fila por fila** (o aplicar a todas de una).\n2. **En tránsito a planta** — retirados, todavía no llegaron a destino. Se confirma con **una sola fecha** para todo el lote seleccionado.\n3. **En planta** — ya llegaron. Acá se **registra la salida hacia la devolución** del vacío.\n4. **En tránsito a devolución** — en camino de vuelta. Se **confirma la devolución**, que es la acción que **corta el reloj** de demurrage/detention y cierra la operación.\n\nEn todos los grupos, seleccionás uno, varios o todos los contenedores con la casilla y confirmás en lote. Si otro usuario ya había actuado sobre alguno, el sistema confirma solo los que seguían pendientes y te avisa cuántos fueron.',
   3),

  ('importacion', 'Retiros escalonados: fecha y hora por fila',
   E'Cuando confirmás el retiro de un grupo de contenedores **En terminal**, se abre un modal con una **fecha y hora por defecto** (editables) y un **botón para aplicarlas a todas las filas** de una sola vez.\n\nSi el camión hizo varios viajes en el mismo día, ajustá la fecha y/o la hora de las filas que correspondan **antes de confirmar** — cada contenedor guarda su propio horario de retiro. La fecha no puede ser anterior a la del arribo de la orden; si lo es, esa fila queda rechazada y te lo señala el sistema.',
   4),

  ('importacion', 'Anular una operación (supervisor+)',
   E'Solo **supervisor** o **administrador** pueden anular un ciclo de importación abierto, desde el botón **Anular** de cualquiera de los 4 grupos de pendientes.\n\nLa anulación es **definitiva** y pide un **motivo obligatorio**, que queda registrado en el historial junto con tu usuario. Un ciclo ya cerrado (con devolución confirmada) no se puede anular — solo los que siguen abiertos.',
   5);

-- ── campo: encabezado de la orden ───────────────────────────────────────────
delete from crm.ayuda_contenido where nivel = 'campo' and clave like 'importacion.%';

insert into crm.ayuda_contenido (seccion, nivel, clave, titulo, contenido_md, orden, publicado) values
  ('importacion', 'campo', 'importacion.numero_orden', 'Número de orden',
   E'El identificador de esta orden de importación (el que usa tu operación para referenciarla). Tiene que ser **único** — si ya existe una orden con el mismo número, el sistema lo rechaza al crear.', 1, true),

  ('importacion', 'campo', 'importacion.naviera', 'Naviera',
   E'La naviera del contrato de esta orden. Define qué tarifa de detention/demurrage de **destino** aplica sobre los contenedores del arribo — la misma naviera para todos, porque el reloj es del contrato de la orden, no del contenedor.', 2, true),

  ('importacion', 'campo', 'importacion.fecha_arribo', 'Fecha de arribo a terminal',
   E'La fecha en que el buque arribó a terminal — es el **día 1** del reloj de importación (demurrage o combinado, según el contrato). Todos los contenedores de la orden comparten esta misma fecha de arribo.', 3, true),

  ('importacion', 'campo', 'importacion.planta_destino', 'Planta destino',
   E'La planta a la que va a ingresar el contenedor después del retiro. Si sos operador, viene fijada a tu planta asignada; si sos supervisor o administrador, podés elegir cualquiera.', 4, true);
