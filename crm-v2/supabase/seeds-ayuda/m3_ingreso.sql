-- ============================================================================
-- seeds-ayuda/m3_ingreso — contenido de ayuda_contenido para la sección `ingreso`
-- (§15.5: generado DESDE spec.md — §6.1 flujo de ingreso en dos fases, §6.3 registro
-- único de contenedor, §18.3 operador ligado a su planta, ISO 6346 con dígito
-- verificador). Alcance M3: la solapa Ingreso (tanda de retiro + pendientes de ingreso).
--
-- ⚠️ NO APLICADO por el ui-builder (M3 no toca la DB): lo aplica el schema-builder
-- en su próximo turno.
-- Idempotente: reemplaza el contenido previo de la sección `ingreso`.
-- ============================================================================

delete from crm.ayuda_contenido where seccion = 'ingreso';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('ingreso', '¿Qué es la solapa Ingreso?',
   E'La solapa **Ingreso** es donde arranca el ciclo de cada contenedor: registrás el **retiro en el depósito** y confirmás la **llegada a la planta**.\n\nTrabaja en dos partes:\n\n1. **Nueva tanda de retiro** — cargás de una vez un grupo de contenedores que se retiran juntos (misma naviera, mismo tipo, mismo destino).\n2. **Pendientes de ingreso a planta** — la lista de contenedores ya retirados que todavía no confirmaron su llegada a la planta.\n\n> El sistema calcula solo los días y los costos a partir de estas fechas. Vos únicamente cargás lo que pasó; nunca hace falta calcular nada a mano.',
   1),

  ('ingreso', 'Cargar una tanda de retiro',
   E'El **encabezado** vale para todos los contenedores de la tanda:\n\n- **Naviera** — la línea dueña de los contenedores.\n- **Tipo de contenedor** — 20DC, 40DC o 40HC.\n- **Retiro de (depósito)** — el depósito o terminal de donde se retiran.\n- **Planta destino** — a qué planta van. Si sos **operador**, queda fijada a tu planta asignada; supervisores y administradores la eligen.\n- **Fecha de retiro** — el día en que se retiran (arranca el conteo de días).\n- **Booking de retiro** — opcional.\n\nDespués **pegás los números de contenedor** en el cuadro de texto, uno por línea (o separados por coma). Cada número aparece en la tabla de abajo.',
   2),

  ('ingreso', 'Validación de números y reforzado',
   E'Cada número se valida con el **dígito verificador ISO 6346** (4 letras + 7 dígitos). Un número con el dígito incorrecto se **marca en rojo** con el motivo, pero **no se descarta**: lo corregís o lo quitás con el botón **Quitar** antes de enviar. Los números repetidos se ignoran solos.\n\nCada fila trae una casilla **reforzado** marcada por defecto — destildala si ese contenedor no es reforzado.\n\nEl botón **Crear tanda de retiro** queda bloqueado mientras haya algún número inválido o la tabla esté vacía.',
   3),

  ('ingreso', 'Confirmar el ingreso ahora o después',
   E'La palanca **confirmar ingreso a planta ahora** decide cuándo se registra la llegada:\n\n- **Apagada** (lo habitual): al crear la tanda, cada contenedor queda **pendiente de ingreso** y aparece en la lista de abajo. Cuando efectivamente llega a la planta, lo confirmás desde ahí.\n- **Encendida**: el contenedor nace directamente **en planta**, sin pasar por pendientes. Usala cuando el retiro y el ingreso ocurren el mismo momento. Al encenderla elegís el **medio** (camión o tren).',
   4),

  ('ingreso', 'Confirmar contenedores pendientes de ingreso',
   E'En **Pendientes de ingreso a planta** están los contenedores retirados que todavía no llegaron.\n\n1. Tildá los contenedores que llegaron (uno, varios o todos con la casilla del encabezado).\n2. Se abre una barra: indicá la **fecha de llegada** y el **medio** (camión o tren).\n3. Tocá **Confirmar ingreso**: pasan a **en planta** y salen de la lista.\n\nSi entre que abriste la pantalla y confirmaste otra persona ya cargó alguno, el sistema confirma solo los que seguían pendientes y te avisa cuántos fueron.',
   5),

  ('ingreso', 'Un contenedor, un ciclo abierto a la vez',
   E'Un mismo contenedor no puede tener dos ciclos abiertos al mismo tiempo. Si intentás cargar en una tanda un contenedor que todavía está en circulación (retirado y sin devolver), el sistema **rechaza toda la tanda** y te dice exactamente **qué contenedores** están abiertos, para que los saques de la lista.\n\nEl contenedor vuelve a estar disponible recién cuando se cierra su ciclo anterior (devolución en terminal o embarque).',
   6);
