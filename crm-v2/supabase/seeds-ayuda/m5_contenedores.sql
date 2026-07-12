-- seeds-ayuda/m5_contenedores — ayuda_contenido sección `contenedores` (§15.5, desde spec)
-- Idempotente. NO aplicado durante M5 (contenido de M10, mismo criterio que m3/m4).
delete from crm.ayuda_contenido where seccion = 'contenedores';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('contenedores', '¿Qué es la solapa Contenedores?',
   E'La solapa **Contenedores** es la planilla general: **una fila por ciclo** de contenedor, desde el retiro en depósito hasta la devolución o el embarque.\n\nDesde acá:\n\n1. Ves todas las operaciones con su estado, planta y fechas.\n2. Buscás cualquier contenedor, booking u orden con la **búsqueda global**.\n3. Abrís la **ficha** de un contenedor clickeando su fila.\n\n> Acá no se carga nada: las operaciones nacen en **Ingreso** y se cierran en **Egreso**. Esta solapa es para consultar y para las acciones de la ficha.',
   1),

  ('contenedores', 'Buscar y filtrar',
   E'El filtro de **estado** decide qué se lista: **Abiertas** (en circulación — lo habitual), **Todas**, **Cerradas** o **Anuladas**.\n\nLa **búsqueda global** (mínimo 2 caracteres) cubre:\n\n- **Número de contenedor** — podés pegar con guiones o espacios, se normaliza solo.\n- **Booking de retiro** y **booking asignado**.\n- **Orden** de embarque.\n\nLa búsqueda siempre respeta el filtro de estado activo: si buscás algo cerrado con el filtro en Abiertas, cambiá el filtro a **Todas**.',
   2),

  ('contenedores', 'La ficha del contenedor',
   E'Al clickear una fila se abre la ficha, con tres zonas:\n\n- **Encabezado** — número ISO 6346, naviera, tipo y estado del **reforzado** (con quién lo validó y cuándo).\n- **Operación actual** — el ciclo abierto con su estado, planta, fechas y asignación de embarque. Si no hay ciclo abierto se muestra la última operación.\n- **Historial** — cada evento del contenedor (retiro, ingreso, movimientos, egreso, devolución, anulaciones, correcciones) con fecha y usuario, de todos sus ciclos.',
   3),

  ('contenedores', 'Mover entre plantas y confirmar la llegada',
   E'Si la operación está **en planta**, el botón **Mover entre plantas** registra un traslado:\n\n1. Elegí la **planta destino** (distinta de la actual), el **medio** y la **fecha de salida**.\n2. Con **confirmar llegada ahora** encendida (lo habitual), el contenedor pasa de una a la otra en el acto.\n3. Apagada, el movimiento queda **en tránsito**: la operación sigue figurando en la planta de origen y la ficha muestra un aviso con el botón **Confirmar llegada** para cuando el contenedor llegue.\n\nSi sos operador, la llegada solo la podés confirmar cuando el destino es **tu planta**.',
   4),

  ('contenedores', 'Anular una operación y validar el reforzado',
   E'Dos acciones quedan reservadas a **supervisores y administradores**:\n\n- **Anular operación** — da de baja un ciclo cargado por error. El **motivo es obligatorio** y la anulación es definitiva: la operación sale de la planilla de abiertas y queda como anulada, con usuario y motivo en el historial. El contenedor queda libre para un ciclo nuevo.\n- **Validar reforzado** — fija el estado del reforzado del **contenedor** (pendiente, confirmado reforzado, confirmado no reforzado o discrepancia). Aplica al contenedor en todos sus ciclos y registra quién validó y cuándo.',
   5);
