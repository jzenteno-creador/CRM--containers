-- ============================================================================
-- seeds-ayuda/m5b6_prefijos — contenido de ayuda_contenido para la sección
-- `prefijos` (§15.5: generado DESDE el brief de negocio de B6 — Dow "container
-- screen", contexto de la migración 031 — y el contrato real de
-- crm.prefijos_restringidos / crm.vista_stock_prefijos_restringidos).
--
-- ⚠️ NO APLICADO por el ui-builder (B6 es UI-only, no toca supabase/migrations/ —
-- otro agente puede estar trabajando en paralelo). Lo aplica quien escriba la
-- próxima migración de DB, mismo criterio que el resto de seeds-ayuda/*.sql.
-- Idempotente: DELETE + INSERT.
--
-- A DIFERENCIA de m5b3_bookings.sql: acá NO hace falta ningún ALTER previo. La
-- migración 031 (§5) ya agregó 'prefijos' al CHECK de crm.ayuda_contenido.seccion
-- en el mismo movimiento en que agregó 'bookings' — este INSERT corre tal cual
-- sobre cualquier entorno con la 031 aplicada.
--
-- (El front ya está preparado para consumir esta sección apenas exista: shell.tsx
-- TAB_SECCION, /ayuda SECTION_META y admin/ayuda SECCIONES ya listan 'prefijos'
-- — agregado en el mismo bloque B6 que este seed.)
-- ============================================================================

-- ── sección: prefijos ───────────────────────────────────────────────────────
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
