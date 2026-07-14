-- ═══════════════════════════════════════════════════════════════════════════
-- 033 · M5 — CIERRE: ayuda M5 completa (importación/prefijos/reportes/
-- consolidación/reclamos + 5 tooltips de campo B1 + crm_ayuda_valores destino)
-- + barrido final de grants fantasma de authenticated sobre crm (hallazgo 032 §J).
--
-- Estado verificado en vivo ANTES de esta migración (2026-07-14,
-- cctuowthpnstvdgjuomq):
--   * CHECK ayuda_contenido_seccion_check = ('ingreso','egreso','contenedores',
--     'alertas','incidencias','admin','dashboard','faq','bookings','prefijos')
--     — falta 'importacion' y 'reportes'.
--   * ayuda_contenido: 0 filas seccion='importacion'|'reportes'; sección
--     'incidencias' todavía con el copy viejo de 024 (pre-reclamo); tooltips
--     admin.tarifa.pais / admin.tarifa.nota / admin.tarifa.convencion_destino /
--     admin.planta.pais / admin.naviera.tipo_proveedor sin fila (el front ya
--     los renderiza vía <FieldHelp>, quedan mudos).
--   * authenticated tiene INSERT+UPDATE vestigial (sin policy que lo respalde,
--     confirmado con pg_policies) sobre: freetime_origin, operacion_eventos,
--     usuarios, vista_alertas (una VIEW — el grant es inerte, no auto-updatable,
--     pero queda como ruido en cualquier auditoría). Verificado que
--     ayuda_contenido/configuracion/depositos/navieras/paises/plantas/
--     prefijos_restringidos SÍ tienen policy INSERT/UPDATE admin/supervisor real
--     para authenticated (sancionadas, AGENTS.md) — esas se conservan intactas.
--     `usuarios` NO tiene ninguna policy de INSERT/UPDATE (solo SELECT); todo el
--     flujo de signup/aprobación corre por funciones SECURITY DEFINER
--     owner=postgres (handle_new_user, bootstrap_admin, aprobar_usuario,
--     rechazar_usuario, set_estado_usuario, sync_mi_usuario) — postgres tiene
--     rolbypassrls=true, así que estos writes NUNCA pasaron por el grant de
--     `authenticated` ni por RLS: el grant es 100% fantasma. Decisión: revocar
--     también `usuarios`, documentado acá (no estaba en la lista "conserva" del
--     brief, que la dejaba condicionada a esta verificación).
--
-- Ningún nombre de tabla/función nueva; solo DML de ayuda + 1 función
-- SECURITY DEFINER existente (crm_ayuda_valores, owner=postgres desde la 024 —
-- preservado por CREATE OR REPLACE, mismo patrón que 026/028/029/030/031/032)
-- + REVOKE puro (no crea permisos nuevos). No hace falta el paso de
-- `grant crm_rpc_executor to current_user` / ALTER OWNER de la 025/028/etc.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ A1 · CHECK ayuda_contenido.seccion — sumar 'importacion' y 'reportes' ═══
alter table crm.ayuda_contenido drop constraint ayuda_contenido_seccion_check;
alter table crm.ayuda_contenido add constraint ayuda_contenido_seccion_check
  check (seccion in ('ingreso', 'egreso', 'contenedores', 'alertas', 'incidencias',
                      'admin', 'dashboard', 'faq', 'bookings', 'prefijos',
                      'importacion', 'reportes'));

-- ═══ A2 · seed: seeds-ayuda/m5b2_importacion.sql (sección `importacion` +
-- tooltips de encabezado de orden) — íntegro, el ALTER comentado en su cabecera
-- ya lo cubrió A1 arriba. ═══════════════════════════════════════════════════

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

-- ═══ A2 · seed: seeds-ayuda/m5b6_prefijos.sql (sección `prefijos`) — íntegro,
-- sin ALTER previo (031 ya agregó 'prefijos' al CHECK). ══════════════════════

delete from crm.ayuda_contenido where seccion = 'prefijos' and nivel = 'seccion';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('prefijos', '¿Qué es la solapa Prefijos?',
   E'Dow publica un **"container screen"**: una lista de prefijos de 4 letras (los primeros 4 caracteres del número de contenedor, ej. **MSKU**) que corresponden a armadores sancionados y **no deben usarse**. Omar la actualiza acá desde la intranet de Dow, típicamente en **julio y diciembre**.\n\nEsta solapa tiene dos partes:\n\n1. **Stock en infracción** (arriba): contenedores que YA están en el sistema con un prefijo que hoy está restringido — el **barrido retroactivo**.\n2. **Lista de prefijos** (abajo): el catálogo administrable, con alta, edición de nota y baja lógica (activo/inactivo).',
   1),

  ('prefijos', 'El barrido retroactivo — por qué existe',
   E'Un contenedor puede haberse retirado en **marzo** con un prefijo que en ese momento no estaba restringido. Si Dow lo agrega a la lista en **julio** y ese contenedor sigue en planta (todavía no se devolvió ni se embarcó), **nadie lo nota** hasta la próxima actualización de la lista — a menos que alguien revise el stock completo a mano.\n\n**Stock en infracción** resuelve esto solo: es una consulta siempre actual sobre los contenedores con ciclo abierto, cruzada contra la lista de prefijos restringidos de HOY. No es una foto vieja — si agregás un prefijo nuevo ahora mismo, cualquier contenedor del stock que lo use aparece acá al instante, sin esperar un ingreso nuevo.\n\nSi la lista está en cero, un aviso verde lo confirma: no hay ningún contenedor del stock actual en infracción.',
   2),

  ('prefijos', 'El warning al pegar contenedores (Ingreso)',
   E'Cuando pegás números de contenedor en **Ingreso**, cada fila se valida contra la lista de prefijos restringidos ACTIVOS. Si el prefijo matchea, la fila se marca con un aviso **ámbar** — distinto del error rojo de dígito verificador ISO 6346.\n\nLa diferencia importa: el error rojo **bloquea** el envío (el número está mal escrito). El aviso ámbar **NO bloquea** — el contenedor puede ya estar retirado físicamente, y frenarlo en el sistema no ayuda en nada. Al enviar la tanda con algún contenedor marcado, el sistema pide una **confirmación explícita** antes de crear las operaciones, listando los números afectados.\n\nConfirmes o no, cada contenedor con prefijo restringido queda con una **incidencia automática** — el aviso es para que lo veas antes de que pase, no para impedirlo.',
   3),

  ('prefijos', 'Agregar y editar prefijos',
   E'Solo **supervisor** o **administrador** pueden dar de alta o editar (es Omar quien la mantiene, con la lista de Dow en mano).\n\n1. Tocá **Nuevo prefijo** y cargá las **4 letras** (se valida en vivo — sin dígito verificador, no es un número de contenedor completo) y una **nota** opcional con la fuente o el armador.\n2. Para editar un prefijo existente, tocá **Editar** en su fila: podés cambiar la **nota** y el toggle **activo**. El prefijo en sí no se edita — es la identidad del registro.\n3. **Desactivar** un prefijo (toggle apagado) lo saca de la lista vigente y de los avisos nuevos, pero no borra el histórico ni las incidencias ya generadas. Si Dow lo vuelve a restringir más adelante, se reactiva la misma fila.',
   4),

  ('prefijos', 'De dónde sale la lista completa',
   E'La lista completa de prefijos restringidos **no se genera en el sistema** — la publica Dow desde su intranet, típicamente dos veces al año (julio y diciembre). Omar es quien la revisa y la carga o actualiza acá, prefijo por prefijo. Este módulo no reemplaza esa fuente: solo la hace **operativa** — visible al pegar contenedores y cruzada contra el stock que ya está en planta.',
   5);

-- ═══ A2 · seed: seeds-ayuda/b7_reportes.sql (sección `reportes`) — íntegro,
-- el ALTER comentado en su cabecera ya lo cubrió A1 arriba. ══════════════════

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

-- ═══ A2 · seed: seeds-ayuda/b4_ayuda_consolidacion.sql — íntegro ═══════════
-- (tooltip ingreso.estado_carga con ON CONFLICT + paso nuevo en el instructivo
-- de la ficha de contenedores).

insert into crm.ayuda_contenido (seccion, nivel, clave, titulo, contenido_md, orden, publicado)
values (
  'ingreso', 'campo', 'ingreso.estado_carga', 'Estado de carga',
  E'Por defecto el contenedor **nace vacío**. Marcá **lleno** solo en el caso raro de un movimiento entre plantas con mercadería ya adentro — la carga habitual se registra después, desde la ficha del contenedor con **Consolidar**.',
  5, true
)
on conflict (clave) where clave is not null
do update set
  titulo = excluded.titulo,
  contenido_md = excluded.contenido_md,
  orden = excluded.orden,
  publicado = excluded.publicado;

delete from crm.ayuda_contenido
 where seccion = 'contenedores' and nivel = 'seccion'
   and titulo = 'Consolidar y desconsolidar (llenos y vacíos)';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('contenedores', 'Consolidar y desconsolidar (llenos y vacíos)',
   E'Dow usa los contenedores en planta como depósito temporal: adentro se **consolida** mercadería (el contenedor queda «lleno») y en algún momento se **desconsolida** (vuelve a «vacío»). Es **informativo**: no afecta la tarifa ni corta el free time — sirve para llevar el stock y la trazabilidad de qué hay adentro de cada equipo.\n\n- **Badge lleno/vacío** — junto al estado de la operación, en la ficha y en los listados (Contenedores, Egreso, Reportes).\n- **Carga actual** — si está lleno, un detalle con GMID, descripción, cantidad de bolsas y lote de cada producto cargado, más el total de bolsas.\n\nLas acciones solo están disponibles con la operación **en planta**:\n\n1. Tocá **Consolidar** (o **Agregar carga**, si ya está lleno — es incremental, no reemplaza lo cargado) en la ficha del contenedor.\n2. Por cada producto: elegí el **GMID** del catálogo o creá uno nuevo ahí mismo si no existe (el sistema te pide GMID + descripción), y cargá la **cantidad de bolsas**; el **lote** es opcional. Agregá tantas líneas como productos tenga la carga.\n3. Confirmá: el contenedor pasa a **lleno** y las líneas quedan en el historial de la ficha.\n4. Cuando se descarga, tocá **Desconsolidar**: cierra todas las líneas vigentes de una sola vez y el contenedor vuelve a **vacío** (el motivo es opcional).\n\n> Al cargar una tanda de retiro en **Ingreso** también podés marcar que el contenedor **ya viene lleno** — caso raro, pensado para movimientos entre plantas. Por defecto, todos los contenedores nacen vacíos.',
   7);

-- ═══ A2 · seed: seeds-ayuda/b5_ayuda_incidencias_reclamos.sql — íntegro ════
-- (reescribe la sección 'incidencias' contra el ciclo de reclamo de la 030 +
-- tooltips de numero_orden/monto_usd).

delete from crm.ayuda_contenido where seccion = 'incidencias' and nivel = 'seccion';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('incidencias', '¿Qué es la solapa Incidencias?',
   E'La solapa **Incidencias** es donde registrás cualquier evento sobre un contenedor en circulación que puede terminar costando plata: una **avería**, un **lavado exigido** al devolver, un **daño con refacción**, o cualquier **otro** evento — con quién lo reportó, cuándo y las **fotos** que respaldan el reclamo.\n\nTiene tres partes:\n\n1. **Registrar incidencia** — el formulario de alta, sobre una operación abierta.\n2. **Historial y reclamos** — todas las incidencias registradas, con filtros y KPIs de lo filtrado.\n3. **Gestión del reclamo** — al hacer click en una fila, se abre el panel donde se sigue el reclamo hasta cobrarlo o descartarlo.\n\n> Cada incidencia queda también en el **historial de la ficha del contenedor**, como un evento más de su ciclo.',
   1),

  ('incidencias', 'Qué completa cada campo',
   E'- **Contenedor de la incidencia** — buscá por número (mínimo 2 caracteres) entre las **operaciones abiertas** y elegí la del contenedor afectado. Si el ciclo ya se cerró, no aparece.\n- **Tipo** — *Avería sufrida* (el daño ocurrió bajo custodia propia), *Avería recepcionada* (llegó dañado), *Lavado exigido* (piden lavarlo al devolver), *Daño con refacción* (daño que se repara), u *Otro*.\n- **Fecha** — el día del evento (viene con la fecha de hoy).\n- **Número de orden** — **obligatorio**: es la referencia con la que se sigue el reclamo.\n- **Descripción** — obligatoria: qué pasó, dónde está el daño y todo dato útil.\n- **Monto estimado (USD)** — **opcional**. A veces el costo se sabe de entrada y a veces no; lo importante es que la incidencia quede registrada. El monto se puede cargar ahora o corregir después, cuantas veces haga falta, desde el panel de gestión.\n- **Responsable** — opcional, texto libre (ej. naviera, depósito, transportista).\n- **Fotos** — opcionales, hasta 6, solo imágenes de hasta 8 MB cada una. Se guardan en un almacenamiento **privado**: solo usuarios activos del CRM pueden verlas.',
   2),

  ('incidencias', 'Registrar una incidencia, paso a paso',
   E'1. Buscá el **contenedor** por número y tocá su operación en la lista.\n2. Elegí el **tipo**, revisá la **fecha**, completá el **número de orden** y escribí la **descripción**.\n3. Si ya conocés el costo, cargá el **monto estimado** y el **responsable** — si no, dejalos vacíos y los cargás después.\n4. Agregá las **fotos** del daño (opcional).\n5. Tocá **Registrar incidencia**: cada foto muestra su progreso y queda tildada al subir.\n\nSi alguna foto falla (corte de red, archivo dañado), la incidencia **ya quedó registrada**: el formulario te avisa cuáles fallaron y podés **reintentar la subida** o descartarlas — nunca se duplica la incidencia.',
   3),

  ('incidencias', 'El historial, los filtros y los KPIs',
   E'En **Historial y reclamos** aparece cada incidencia con su contenedor, tipo, número de orden, estado del reclamo, monto, fecha, responsable y fotos.\n\n- Filtrá por **tipo** o por **estado del reclamo**, o buscá por **contenedor**.\n- Los tres indicadores de arriba (**monto**, **recuperado**, **no recuperado**) son la suma y el conteo **de lo que ves filtrado** en ese momento — cambian solos con cada filtro.\n- Las **miniaturas** de fotos se abren en grande con un click.\n- Click en la fila → se abre el **panel de gestión del reclamo** (ver abajo).',
   4),

  ('incidencias', 'Gestionar el reclamo de una incidencia',
   E'El reclamo de una incidencia con costo sigue un camino fijo: **sin reclamo → abierto → reclamada → resuelta**, sin saltarse pasos.\n\n- **Abrir reclamo** y **marcar reclamada** los hace **supervisor o administrador**, con un click.\n- **Resolver** (también supervisor+) pide el **resultado** — *recuperado* o *no recuperado* — y admite corregir el **monto final** en el mismo paso.\n- El **monto y el responsable** los puede corregir **cualquier usuario activo**, en cualquier momento, con una **nota** opcional que queda de rastro del cambio — así el número se puede ajustar a medida que se sabe más (estimado → facturado → reclamado → recuperado) sin perder de vista qué cambió y cuándo.\n\nLas incidencias **no se borran**: son el respaldo del reclamo ante la naviera o el depósito.',
   5);

delete from crm.ayuda_contenido
 where nivel = 'campo' and clave in ('incidencias.numero_orden', 'incidencias.monto_usd');

insert into crm.ayuda_contenido (seccion, nivel, clave, titulo, contenido_md, orden, publicado) values
  ('incidencias', 'campo', 'incidencias.numero_orden', 'Número de orden',
   E'**Obligatorio.** Es la referencia con la que se sigue el reclamo — la que vas a usar para cruzar contra la factura o el mail de la naviera/depósito. Las incidencias que genera el sistema automáticamente (ej. contenedor no reforzado) no la llevan.', 2, true),
  ('incidencias', 'campo', 'incidencias.monto_usd', 'Monto estimado (USD)',
   E'**Opcional — nunca bloquea el alta.** A veces el costo se conoce de entrada (ej. una factura de lavado) y a veces no; lo importante es dejar registrado el evento. Se puede cargar ahora o corregir después, cuantas veces haga falta, desde el panel de gestión del reclamo — cada corrección queda con su rastro.', 3, true);

-- ═══ A1 (cont.) · 5 tooltips de campo B1 (mudos: el front ya los renderiza,
-- faltaba la fila). es-AR, sin números hardcodeados. ═════════════════════════

delete from crm.ayuda_contenido
 where nivel = 'campo'
   and clave in ('admin.tarifa.pais', 'admin.tarifa.nota', 'admin.tarifa.convencion_destino',
                 'admin.planta.pais', 'admin.naviera.tipo_proveedor');

insert into crm.ayuda_contenido (seccion, nivel, clave, titulo, contenido_md, orden, publicado) values
  ('admin', 'campo', 'admin.tarifa.pais', 'País',
   E'Para qué país rige esta versión de tarifa. Junto con la naviera es la clave que usa el sistema para elegir la tarifa vigente de cada operación — según el país de la planta que la maneja. Hoy todas las plantas son de Argentina, pero el contrato de una naviera puede traer condiciones distintas para otros países.', 4, true),

  ('admin', 'campo', 'admin.tarifa.nota', 'Nota',
   E'Opcional. Documentá acá cualquier ajuste operativo que no está en el contrato formal — un acuerdo verbal con la naviera, una excepción puntual, etc. No afecta ningún cálculo: es solo contexto para quien lea el historial de versiones.', 5, true),

  ('admin', 'campo', 'admin.tarifa.convencion_destino', 'Conteo del freetime (destino)',
   E'Define si el día del **arribo a terminal** cuenta como día 1 del reloj de destino, o si arranca al día siguiente. A diferencia del freetime de origen (que arranca en el retiro), acá el reloj arranca en el arribo. Es parte de esta versión: cambiarla crea una versión nueva, nunca recalcula lo ya cargado.', 6, true),

  ('admin', 'campo', 'admin.planta.pais', 'País',
   E'De qué país es esta planta. Junto con la naviera, define qué tarifa de freetime (de origen y de destino) aplica a las operaciones que pasan por acá — hoy todas las plantas son de Argentina.', 7, true),

  ('admin', 'campo', 'admin.naviera.tipo_proveedor', 'Tipo de proveedor',
   E'**Naviera**: armador con buque propio. **Forwarder**: agente logístico que consolida carga con distintas navieras. Es solo clasificación informativa — no cambia ningún cálculo de freetime ni de costo.', 8, true);

-- ═══ A1 (cont.) · crm_ayuda_valores — extensión con valores de DESTINO ══════
-- Mismo patrón exacto de la 024 (escalares, no record — sin naviera todo queda
-- NULL y degrada a genérico). Filtro "navieras operativas ARG desde
-- freetime_destino": pais.nombre='ARGENTINA' (único país con planta hoy — 026),
-- hub is null (único caso que existe), vigente_hasta is null (versión vigente).
-- Ningún copy usa estos placeholders todavía (limitación reportada por B2-UI:
-- los tooltips de /importacion quedaron genéricos) — quedan disponibles para
-- cuando un copy de destino los necesite. Mismo owner (postgres, DEFINER),
-- mismos grants (CREATE OR REPLACE los preserva) — no hace falta repetirlos.
create or replace function crm.crm_ayuda_valores(p_naviera uuid default null, p_regimen text default 'vacios')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $fn$
declare
  v_umbral int;
  -- escalares (NO un record): un escalar no-asignado queda NULL; un record
  -- no-asignado EXPLOTA al leer un campo. Sin naviera, estos quedan NULL y todo
  -- el resto degrada a genérico (bug cazado por el gate: v_ft.* sin naviera).
  v_dias int;
  v_tarifa numeric;
  v_conv text;
  v_retiro text;
  v_devol text;
  -- destino (033): mismo criterio, escalares independientes.
  v_dias_combined_destino int;
  v_tarifa_destino numeric;
  v_conv_destino text;
begin
  select coalesce((valor ->> 'dias')::int, 3) into v_umbral
    from crm.configuracion where clave = 'umbral_alerta_amarillo';
  v_umbral := coalesce(v_umbral, 3);

  if p_naviera is not null then
    select f.dias_libres, f.tarifa_usd_dia, f.convencion_conteo
      into v_dias, v_tarifa, v_conv
      from crm.freetime_origin f
     where f.naviera_id = p_naviera and f.regimen = p_regimen and f.vigente_hasta is null
     order by f.vigente_desde desc limit 1;

    select f.dias_combined, f.tarifa_dry_usd_dia, f.convencion_conteo
      into v_dias_combined_destino, v_tarifa_destino, v_conv_destino
      from crm.freetime_destino f
      join crm.paises pa on pa.id = f.pais_id
     where f.naviera_id = p_naviera
       and pa.nombre = 'ARGENTINA'
       and f.hub is null
       and f.vigente_hasta is null
     order by f.vigente_desde desc limit 1;
  end if;

  if v_conv = 'retiro_dia_1' then
    v_retiro := 'el día del retiro cuenta como día 1: acá arranca el free time';
  elsif v_conv = 'retiro_dia_0' then
    v_retiro := 'el free time arranca el día siguiente al retiro (el día del retiro no cuenta)';
  else
    v_retiro := 'acá arranca el free time, según la convención de conteo vigente de la naviera';
  end if;
  v_devol := 'acá corta el free time; el día de la devolución también se cuenta en la estadía';

  -- frases compuestas: el número sale de la DB (nunca hardcodeado) o degrada a
  -- genérico sin naviera — el front solo sustituye el string, no calcula ni
  -- maneja nulls ni unidades colgando.
  return jsonb_build_object(
    'umbral', v_umbral,
    'convencion', v_conv,
    'retiro_frase', v_retiro,
    'devolucion_frase', v_devol,
    'dias_libres', v_dias,
    'tarifa_usd_dia', v_tarifa,
    'dias_libres_frase', case when v_dias is not null
                              then v_dias || ' días libres'
                              else 'los días libres de tu naviera' end,
    'tarifa_frase', case when v_tarifa is not null
                        then trim(to_char(v_tarifa, 'FM999990.00')) || ' USD/día'
                        else 'la tarifa vigente de la naviera' end,
    'convencion_destino', v_conv_destino,
    'dias_combined_destino', v_dias_combined_destino,
    'tarifa_destino_usd_dia', v_tarifa_destino,
    'dias_combined_destino_frase', case when v_dias_combined_destino is not null
                              then v_dias_combined_destino || ' días combinados'
                              else 'los días libres de destino de tu naviera' end,
    'tarifa_destino_frase', case when v_tarifa_destino is not null
                        then trim(to_char(v_tarifa_destino, 'FM999990.00')) || ' USD/día'
                        else 'la tarifa de destino vigente de la naviera' end);
end $fn$;

revoke execute on function crm.crm_ayuda_valores(uuid, text) from public, anon;
grant  execute on function crm.crm_ayuda_valores(uuid, text) to authenticated;

-- ═══ A2 (barrido) · grants fantasma de authenticated — hallazgo §J de la 032 ═
-- Cierra las 4 ventanas que quedaban de la lista que la 032 dejó flagueada
-- ("fuera de alcance de esa migración"): freetime_origin, operacion_eventos,
-- usuarios, vista_alertas. Verificado con information_schema.role_table_grants
-- + pg_policies ANTES de este REVOKE (ver cabecera): ninguna tiene policy de
-- INSERT/UPDATE que respalde a `authenticated` — 0 riesgo de romper un flujo
-- vivo. Las tablas SANCIONADAS (navieras/plantas/depositos/configuracion/
-- ayuda_contenido/paises/prefijos_restringidos) NO se tocan: tienen policy real
-- y están en la lista de escritura directa de AGENTS.md.
revoke insert, update on crm.freetime_origin   from authenticated;
revoke insert, update on crm.operacion_eventos from authenticated;
revoke insert, update on crm.usuarios          from authenticated;
revoke insert, update on crm.vista_alertas     from authenticated;

-- ═══ notify · refrescar cache de PostgREST ══════════════════════════════════
notify pgrst, 'reload schema';
