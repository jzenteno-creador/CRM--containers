-- seeds-ayuda/m4_egreso — ayuda_contenido sección `egreso` (§15.5, desde spec §6.2/§6.3.7/§14.1)
-- Idempotente. NO aplicado durante M4 (contenido de M10, mismo criterio que m3_ingreso.sql).
delete from crm.ayuda_contenido where seccion = 'egreso';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('egreso', '¿Qué es la solapa Egreso?',
   E'La solapa **Egreso** cierra el ciclo del contenedor en dos partes:\n\n1. **Salida de planta** — registrás que el contenedor salió de la planta, **embarcado** o **devuelto vacío**. La salida **no corta el freetime**: el conteo de días sigue corriendo.\n2. **Pendientes de terminal / devolución** — confirmás la llegada a terminal o la devolución del vacío. Esta confirmación **sí corta el freetime** y cierra la operación.\n\n> El sistema calcula solo los días y los costos a partir de estas fechas; vos únicamente cargás lo que pasó.',
   1),

  ('egreso', 'Registrar la salida de planta',
   E'1. Tildá en la lista los contenedores que salen (uno, varios o todos con la casilla del encabezado).\n2. En la barra que se abre, elegí el **tipo de cierre**: **embarcado** (va a puerto con carga) o **devuelto vacío** (vuelve vacío a la terminal).\n3. Indicá la **fecha de salida** (viene precargada con hoy).\n4. Si es **embarcado**, completá la **asignación de embarque** (ver más abajo).\n5. Tocá **Registrar salida**: pasan a **en tránsito a terminal** y aparecen en la lista de abajo.\n\nSi otra persona ya había registrado alguno, el sistema registra solo los que seguían en planta y te avisa cuántos fueron.',
   2),

  ('egreso', 'Asignación de embarque',
   E'Cuando el cierre es **embarcado**, los datos de asignación se cargan acá mismo (no hay pantalla de "carga" aparte) y **se aplican a todo el lote seleccionado**:\n\n- **Orden** — obligatoria.\n- **SHP** — obligatorio.\n- **Booking asignado**, **buque** y **destino** — opcionales.\n\nSi el lote mezcla órdenes o buques distintos, registrá la salida en tandas separadas, una por asignación.',
   3),

  ('egreso', 'Seleccionar por pegado',
   E'En vez de tildar uno por uno, podés **pegar la lista de números** de contenedor (uno por línea o separados por coma) y tocar **Seleccionar pegados**: se tildan solos los que están en planta.\n\nLos números que **no están en planta o no existen** se te muestran en un aviso, para que sepas exactamente cuáles quedaron afuera. Este paso no registra nada: solo selecciona filas.',
   4),

  ('egreso', 'Confirmar la llegada a terminal / devolución',
   E'En **Pendientes de terminal / devolución** están los contenedores que ya salieron de planta.\n\n1. Tildá los que llegaron a terminal o se devolvieron.\n2. Indicá la **fecha de devolución**.\n3. Tocá **Confirmar devolución**.\n\nEsta confirmación **corta el freetime** (la fecha que indiques es la que detiene el conteo de días) y **cierra la operación**: el contenedor queda disponible para un ciclo nuevo.',
   5);
