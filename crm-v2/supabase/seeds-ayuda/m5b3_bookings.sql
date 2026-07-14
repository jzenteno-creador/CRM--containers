-- ============================================================================
-- seeds-ayuda/m5b3_bookings — contenido de ayuda_contenido para la sección
-- `bookings` (nueva) + el tooltip de campo `ingreso.booking_retiro` (§15.5:
-- generado DESDE el brief de negocio de M5 B3 — Omar, reunión 2026-07-13 — y el
-- contrato real de crm.bookings / crm.vista_bookings_saldo, migración 028).
--
-- ⚠️ NO APLICADO por el ui-builder (B3 es UI-only, no toca supabase/migrations/ —
-- otro agente puede estar aplicando la 029 en paralelo). Lo aplica quien escriba
-- la próxima migración de DB, mismo criterio que el resto de seeds-ayuda/*.sql.
-- Idempotente: DELETE + INSERT.
--
-- PRECONDICIÓN — DDL requerido ANTES de poder insertar la sección 'bookings':
-- crm.ayuda_contenido.seccion tiene un CHECK (migración 002) que hoy NO incluye
-- 'bookings'. Sin este ALTER, el primer INSERT de más abajo falla con
-- "new row ... violates check constraint ayuda_contenido_seccion_check".
--
--   alter table crm.ayuda_contenido drop constraint ayuda_contenido_seccion_check;
--   alter table crm.ayuda_contenido add constraint ayuda_contenido_seccion_check
--     check (seccion in ('ingreso', 'egreso', 'contenedores', 'alertas',
--            'incidencias', 'admin', 'dashboard', 'faq', 'bookings'));
--
-- (nombre auto-generado por Postgres para un CHECK inline sin nombre explícito —
-- confirmar con `select conname from pg_constraint where conrelid =
-- 'crm.ayuda_contenido'::regclass and contype = 'c';` antes de aplicar, por las dudas.)
--
-- (El front ya está preparado para consumir esta sección apenas exista: shell.tsx
-- TAB_SECCION, /ayuda SECTION_META y admin/ayuda SECCIONES ya listan 'bookings'.)
-- ============================================================================

-- ── sección: bookings ────────────────────────────────────────────────────────
delete from crm.ayuda_contenido where seccion = 'bookings' and nivel = 'seccion';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('bookings', '¿Qué es la solapa Bookings?',
   E'Los retiros de exportación se cargan contra un **booking** de la naviera: un cupo con **ETD** (fecha de zarpe) que ocupa lugar en un buque. La solapa **Bookings** muestra, para cada booking de retiro activo, cuántos contenedores todavía están **en planta** sin embarcar y qué tan cerca está su ETD — con semáforo.\n\nEsto reemplaza el control manual que se hacía a mano cada viernes: si el ETD se acerca y quedan contenedores en planta, hay que **rolear** el booking (mismo booking, nuevo ETD/buque) o **reasignar** esos contenedores a otro booking con más margen.',
   1),

  ('bookings', 'Cómo leer el semáforo',
   E'Cada fila tiene un semáforo de **cuatro** estados, sobre el booking completo (no sobre un contenedor individual):\n\n- 🔴 **Vencido** — el ETD ya pasó y todavía quedan contenedores en planta sin embarcar: hay que actuar ya (rolear o reasignar).\n- 🟡 **Por vencer** — quedan pocos días para el ETD (umbral configurable) y hay contenedores en planta.\n- 🟢 **En plazo** — hay contenedores en planta pero el ETD todavía está lejos.\n- ⚪ **Sin pendientes** — no hay contenedores en planta para este booking (ya se embarcaron todos, o todavía no llegó ninguno): no hace falta ninguna acción.\n\nLa tabla ordena por **días a ETD**, con lo más urgente arriba.',
   2),

  ('bookings', 'Rolear un booking',
   E'**Rolear** es cuando la naviera cambia el ETD (y a veces el buque) de un booking que ya existe, manteniendo el mismo número.\n\n1. Tocá **Rolear** en la fila del booking.\n2. Cargá el **nuevo ETD** (obligatorio) y, si cambió, el **nuevo buque**.\n3. El **motivo** es opcional, pero queda registrado en el historial de cada operación abierta que cuelga de ese booking.\n4. Al confirmar, el sistema anota el roleo en el historial de cada contenedor todavía en planta con ese booking — nadie pierde trazabilidad de por qué cambió la fecha.',
   3),

  ('bookings', 'Reasignar contenedores a otro booking',
   E'**Reasignar** mueve contenedores de un booking a otro — típico cuando un booking se va a vencer y conviene pasar sus contenedores a uno con más margen.\n\n1. Tocá **Reasignar** en la fila del booking de origen.\n2. Tildá los contenedores que querés mover (los que están en planta, colgados de ese booking).\n3. Elegí el **booking destino** — tiene que ser un booking de retiro activo; si no existe todavía, lo creás ahí mismo con su ETD.\n4. Elegí el **motivo** (roleo de naviera, corrección u otro) y, si hace falta, un detalle.\n5. Confirmá: cada contenedor reasignado queda registrado en su historial con el booking anterior y el nuevo.\n\nSi algún contenedor ya no está disponible (otro usuario lo movió mientras tanto), el sistema reasigna el resto igual y te avisa cuáles quedaron afuera.',
   4),

  ('bookings', 'De dónde salen los bookings',
   E'Los bookings de **retiro** se crean desde la solapa **Ingreso**, al elegir la naviera de una tanda nueva (o acá mismo, al reasignar contenedores a un booking que todavía no existe). Los bookings de **embarque** se crean desde **Egreso**, al asignar el embarque de un lote. Ningún booking se edita a mano fuera de estos flujos: el ETD solo cambia con un **roleo**, y queda auditado.',
   5);

-- ── campo: booking de retiro en Ingreso ────────────────────────────────────
delete from crm.ayuda_contenido where nivel = 'campo' and clave = 'ingreso.booking_retiro';

insert into crm.ayuda_contenido (seccion, nivel, clave, titulo, contenido_md, orden, publicado) values
  ('ingreso', 'campo', 'ingreso.booking_retiro', 'Booking de retiro',
   E'El cupo de la naviera donde entra este contenedor — define el **ETD** (fecha de zarpe) contra la que se controla el freetime de expo. Es **obligatorio**: elegilo del catálogo de bookings activos de esta naviera, o creá uno nuevo ahí mismo si todavía no existe. Seguilo desde la solapa **Bookings**: si se acerca el ETD y el contenedor sigue en planta, hay que rolear el booking o reasignarlo a otro.',
   5, true);
