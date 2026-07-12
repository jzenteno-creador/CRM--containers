-- seeds-ayuda/m6_alertas — ayuda_contenido sección `alertas` (§15.5, desde spec §10 + contrato real de crm.vista_alertas)
-- Idempotente. NO aplicado durante M6 (contenido de M10, mismo criterio que m3/m4/m5).
delete from crm.ayuda_contenido where seccion = 'alertas';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('alertas', '¿Qué es la solapa Alertas?',
   E'La solapa **Alertas** es el tablero de vencimiento del freetime: muestra **cada contenedor con ciclo abierto** (retirado y todavía sin devolver ni embarcar) con sus días transcurridos, los días libres de su naviera, cuántos días le quedan y el **costo proyectado de detention** si se pasa.\n\nTodo lo calcula el sistema solo, a partir de la fecha de retiro y la tarifa vigente de cada naviera. Vos no calculás nada: mirás el semáforo y actuás sobre los que están por vencer.\n\nLas filas aparecen ordenadas por **días restantes** — lo más urgente arriba.',
   1),

  ('alertas', 'Cómo leer el semáforo',
   E'Cada fila tiene un semáforo con **cuatro** estados:\n\n- 🔴 **Vencido** — el freetime ya se agotó: cada día adicional suma costo de detention.\n- 🟡 **Por vencer** — quedan pocos días de freetime (el umbral es configurable desde **Admin**; por defecto, 3 días o menos).\n- 🟢 **En freetime** — todavía hay margen.\n- ⚪ **Sin tarifa** — la naviera no cobra detention en origen o no hay una tarifa vigente cargada para la fecha de retiro. En estos casos los días libres y el costo se muestran como «—».\n\nLos contadores de arriba resumen cuántos contenedores hay en cada estado.',
   2),

  ('alertas', 'Qué muestra cada columna',
   E'- **Días transcurridos** — días desde el retiro en depósito (el día del retiro cuenta).\n- **Días libres** — el freetime de la naviera vigente a la fecha de retiro.\n- **Días restantes** — los que quedan antes de empezar a pagar; un número **negativo en rojo** indica cuántos días se pasó.\n- **Tarifa USD/día** — lo que cobra la naviera por día de demora.\n- **Costo proyectado** — lo acumulado hasta hoy si el contenedor se devolviera ya. «**USD —**» significa que no hay tarifa para proyectar (no es cero); la marca «**sin cargo**» indica una operación acordada sin costo de detention.',
   3),

  ('alertas', 'Cómo trabajar con la lista',
   E'1. Entrá a **Alertas**: lo más urgente ya está arriba (vencidos primero).\n2. Usá el filtro de **semáforo** para quedarte solo con los rojos o amarillos.\n3. Tocá una fila para abrir la **ficha del contenedor**, con su historial completo y sus acciones.\n4. Gestioná la devolución o el embarque desde la solapa **Egreso** — al cerrarse el ciclo, el contenedor sale de esta lista.\n\nLa lista se actualiza sola al volver a la pestaña; también podés tocar **Actualizar**.',
   4),

  ('alertas', 'Quién ve qué',
   E'Un **operador** ve solo los contenedores de su planta; **supervisores y administradores** ven todas las plantas. El umbral del semáforo amarillo se edita en **Admin → Configuración** y aplica para todos al instante.',
   5);
