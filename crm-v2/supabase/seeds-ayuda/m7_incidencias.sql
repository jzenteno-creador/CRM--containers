-- seeds-ayuda/m7_incidencias — ayuda_contenido sección `incidencias` (§15.5, desde spec)
-- Idempotente. NO aplicado durante M7 (contenido de M10, mismo criterio que m3-m6).
delete from crm.ayuda_contenido where seccion = 'incidencias';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('incidencias', '¿Qué es la solapa Incidencias?',
   E'La solapa **Incidencias** es donde registrás cualquier **avería u otro evento** sobre un contenedor en circulación: qué pasó, cuándo, quién lo reportó y las **fotos** que respaldan el reclamo.\n\nTiene dos partes:\n\n1. **Registrar incidencia** — el formulario de alta, sobre una operación abierta.\n2. **Historial** — todas las incidencias registradas, con sus fotos.\n\n> Cada incidencia queda también en el **historial de la ficha del contenedor**, como un evento más de su ciclo.',
   1),

  ('incidencias', 'Qué completa cada campo',
   E'- **Contenedor de la incidencia** — buscá por número (mínimo 2 caracteres) entre las **operaciones abiertas** y elegí la del contenedor afectado. Si el ciclo ya se cerró, no aparece.\n- **Tipo** — *Avería sufrida* (el daño ocurrió bajo custodia propia), *Avería recepcionada* (el contenedor ya llegó dañado) u *Otro*.\n- **Fecha** — el día del evento (viene con la fecha de hoy).\n- **Descripción** — obligatoria: qué pasó, dónde está el daño y todo dato útil para el reclamo.\n- **Fotos** — opcionales, hasta 6, solo imágenes de hasta 8 MB cada una. Se guardan en un almacenamiento **privado**: solo usuarios activos del CRM pueden verlas.',
   2),

  ('incidencias', 'Registrar una incidencia, paso a paso',
   E'1. Buscá el **contenedor** por número y tocá su operación en la lista.\n2. Elegí el **tipo**, revisá la **fecha** y escribí la **descripción**.\n3. Agregá las **fotos** del daño (opcional).\n4. Tocá **Registrar incidencia**: cada foto muestra su progreso y queda tildada al subir.\n\nSi alguna foto falla (corte de red, archivo dañado), la incidencia **ya quedó registrada**: el formulario te avisa cuáles fallaron y podés **reintentar la subida** o descartarlas — nunca se duplica la incidencia.',
   3),

  ('incidencias', 'El historial y las fotos',
   E'En **Historial** aparece cada incidencia con su contenedor, tipo, descripción, planta, quién la reportó y la fecha.\n\n- Las **miniaturas** de fotos se abren en grande con un click.\n- Con la **búsqueda por contenedor** filtrás el historial por número.\n- Click en la fila → se abre la **ficha del contenedor**, donde la incidencia también figura en su línea de tiempo.\n\nLas incidencias **no se borran**: son el respaldo del reclamo ante la naviera o el depósito.',
   4);
