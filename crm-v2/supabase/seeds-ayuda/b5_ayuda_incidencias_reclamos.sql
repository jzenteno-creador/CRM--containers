-- ═══════════════════════════════════════════════════════════════════════════
-- B5 · ayuda_contenido — incidencias ampliadas con reclamo (D6, John 2026-07-14)
--
-- Deliverable del ui-builder, NO aplicado (fuera de mi terreno tocar
-- supabase/migrations/ o la DB en este bloque). Reescribe la sección
-- 'incidencias' (nivel='seccion', ya sembrada por la migración 024 con el
-- flujo viejo de solo alta+fotos) para reflejar el ciclo de reclamo agregado
-- por la 030, y suma tooltips de campo (nivel='campo') para numero_orden y
-- monto_usd. Mismo formato/convención exacta que 024_m4_ayuda_tooltips.sql —
-- pensado para que el bloque que gestione la DB de B5 lo pegue en su propia
-- migración numerada (o lo aplique como UPDATE de contenido vía el editor de
-- Admin, ya que ayuda_contenido admite escritura directa de administrador).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── sección 'incidencias' — REESCRITA contra el estado real post-030 ────────
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

-- ── tooltips de campo nuevos (numero_orden, monto_usd) ───────────────────────
-- Mismo idioma que el bloque D de 024_m4_ayuda_tooltips.sql: placeholders
-- {{...}} se interpolan con crm_ayuda_valores en runtime — acá no hacen falta
-- porque ninguno de los dos campos depende de la naviera/convención.
delete from crm.ayuda_contenido
 where nivel = 'campo' and clave in ('incidencias.numero_orden', 'incidencias.monto_usd');

insert into crm.ayuda_contenido (seccion, nivel, clave, titulo, contenido_md, orden, publicado) values
  ('incidencias', 'campo', 'incidencias.numero_orden', 'Número de orden',
   E'**Obligatorio.** Es la referencia con la que se sigue el reclamo — la que vas a usar para cruzar contra la factura o el mail de la naviera/depósito. Las incidencias que genera el sistema automáticamente (ej. contenedor no reforzado) no la llevan.', 2, true),
  ('incidencias', 'campo', 'incidencias.monto_usd', 'Monto estimado (USD)',
   E'**Opcional — nunca bloquea el alta.** A veces el costo se conoce de entrada (ej. una factura de lavado) y a veces no; lo importante es dejar registrado el evento. Se puede cargar ahora o corregir después, cuantas veces haga falta, desde el panel de gestión del reclamo — cada corrección queda con su rastro.', 3, true);
