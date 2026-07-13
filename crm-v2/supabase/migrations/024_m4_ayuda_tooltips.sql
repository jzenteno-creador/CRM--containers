-- ═══════════════════════════════════════════════════════════════════════════
-- 024 · M4 — AYUDA M10: seeds m3-m9 + tooltips a nivel campo con interpolación
-- ═══════════════════════════════════════════════════════════════════════════
-- Aplica el contenido de ayuda de las 7 solapas (solo m2/admin estaba, vía 013),
-- REESCRITO contra el estado real 2026-07-13 (waiver bruto/absorbido/neto,
-- corrección de cerradas F-02, catálogo de depósitos, plantas con CRUD).
-- Suma el nivel `campo`: tooltips on-hover cuyos NÚMEROS se interpolan desde la
-- DB en runtime (nunca hardcodeados). La convención de conteo sale de la versión
-- vigente de freetime_origin de la naviera en contexto — cambia sola si cambia
-- el contrato.
-- ⚠️ NO APLICAR sin GO de John.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ A · ayuda_contenido: nivel `seccion` (existente) vs `campo` (tooltips) ══
-- Idempotente (el gate la aplica en harness; apply_migration la corre una vez).
alter table crm.ayuda_contenido add column if not exists nivel text not null default 'seccion';
alter table crm.ayuda_contenido add column if not exists clave text;

do $$ begin
  if not exists (select 1 from pg_constraint
                  where conname = 'ck_ayuda_nivel' and connamespace = 'crm'::regnamespace) then
    alter table crm.ayuda_contenido add constraint ck_ayuda_nivel check (nivel in ('seccion', 'campo'));
  end if;
end $$;

-- clave única para los campos (ej. 'ingreso.fecha_retiro'); null para secciones
create unique index if not exists ux_ayuda_clave on crm.ayuda_contenido (clave) where clave is not null;

comment on column crm.ayuda_contenido.nivel is
  'seccion = instructivo de solapa (/ayuda + panel ?); campo = tooltip on-hover de un input.';
comment on column crm.ayuda_contenido.clave is
  'Identificador técnico del campo (nivel=campo), ej. ingreso.fecha_retiro. NULL en secciones.';

-- ═══ B · crm_ayuda_valores — valores para interpolar los {{...}} del copy ════
-- Global (umbral) + por-naviera (dias_libres, tarifa, convención). Las frases de
-- retiro/devolución se COMPONEN de la convención versionada, no se escriben a mano.
-- Sin naviera → los valores por-naviera vienen null (el front degrada a genérico).
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
                        else 'la tarifa vigente de la naviera' end);
end $fn$;

revoke execute on function crm.crm_ayuda_valores(uuid, text) from public, anon;
grant  execute on function crm.crm_ayuda_valores(uuid, text) to authenticated;

-- ═══ secciones SIN cambios (m4 egreso · m7 incidencias · m8 dashboard) ═══
delete from crm.ayuda_contenido where seccion = 'egreso' and nivel = 'seccion';

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

delete from crm.ayuda_contenido where seccion = 'incidencias' and nivel = 'seccion';

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

delete from crm.ayuda_contenido where seccion = 'dashboard' and nivel = 'seccion';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('dashboard', '¿Qué es la solapa Inicio?',
   E'**Inicio** es el tablero general: de un vistazo muestra cuánta plata de detention hay en juego, cuántos contenedores están en riesgo y cómo viene el año.\n\nTodos los números salen directo de la base — el sistema calcula solo los días, los costos y los promedios. Acá no se carga nada: es una pantalla de lectura con accesos rápidos a las solapas donde sí se opera.',
   1),

  ('dashboard', 'Los 7 indicadores de arriba',
   E'- **Costo · mes** — detention realizado de los ciclos cerrados con devolución en el mes en curso.\n- **Costo · YTD** — lo mismo, acumulado del año.\n- **Proyectado abierto** — lo que costarían HOY los ciclos abiertos si nada se devuelve (coincide al centavo con la solapa Alertas). Se pinta ámbar cuando hay monto.\n- **En riesgo · rojo** — contenedores con el freetime ya vencido (se pinta rojo si hay alguno).\n- **En riesgo · amarillo** — contenedores por vencer según el umbral configurable en Admin.\n- **Stock de vacíos** — ciclos abiertos hoy: retirados y todavía sin devolver ni embarcar.\n- **Demora promedio** — estadía media (en días) de los ciclos cerrados en el año.',
   2),

  ('dashboard', 'Los dos gráficos',
   E'- **Costo por naviera** — barras con el total por naviera: lo realizado en el año más lo proyectado de los ciclos abiertos. Muestra hasta 8 navieras, de mayor a menor.\n- **Tendencia mensual** — línea de los últimos 12 meses con el costo realizado por mes. Sirve para ver si la detention viene subiendo o bajando.\n\nSi algún gráfico no tiene datos todavía, lo dice en el lugar y explica desde dónde se alimenta.',
   3),

  ('dashboard', 'Cómo se alimenta el tablero (flujo)',
   E'1. En **Ingreso** se carga la tanda de retiro — nace el ciclo y arranca el conteo de días.\n2. En **Egreso** se registra la salida de planta y el cierre (devolución o embarque) — el ciclo pasa a "cerrado" y su costo se vuelve **realizado**.\n3. Mientras un ciclo sigue abierto aparece en **Alertas** con su semáforo y suma al **proyectado**.\n4. El tablero refleja todo al instante: cada carga o cierre mueve los indicadores y los gráficos.',
   4),

  ('dashboard', 'Accesos rápidos',
   E'Abajo del todo hay cuatro tarjetas para saltar directo a la operación diaria: **Ingreso** (cargar tandas y confirmar llegadas), **Egreso** (salidas y cierres), **Alertas** (semáforo de freetime) y **Contenedores** (la planilla global con la ficha de cada equipo).',
   5);


-- ═══ C · secciones REESCRITAS contra el estado real (m3, m5, m6, m9) ════════
-- (m4 egreso, m7 incidencias, m8 dashboard van tal cual — flujos sin cambios.)

-- ── m3 · ingreso (retiro_de ahora es catálogo de depósitos) ──────────────────
delete from crm.ayuda_contenido where seccion = 'ingreso' and nivel = 'seccion';
insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('ingreso', '¿Qué es la solapa Ingreso?',
   E'La solapa **Ingreso** es donde arranca el ciclo de cada contenedor: registrás el **retiro en el depósito** y confirmás la **llegada a la planta**.\n\nTrabaja en dos partes:\n\n1. **Nueva tanda de retiro** — cargás de una vez un grupo de contenedores que se retiran juntos (misma naviera, mismo tipo, mismo depósito).\n2. **Pendientes de ingreso a planta** — la lista de contenedores ya retirados que todavía no confirmaron su llegada.\n\n> El sistema calcula solo los días y los costos a partir de estas fechas. Vos únicamente cargás lo que pasó.',
   1),
  ('ingreso', 'Cargar una tanda de retiro',
   E'El **encabezado** vale para todos los contenedores de la tanda:\n\n- **Naviera** — la línea dueña de los contenedores; de ella salen los días libres y la tarifa.\n- **Tipo de contenedor** — 20DC, 40DC o 40HC.\n- **Retiro de (depósito)** — se elige de un **catálogo**: tipeás y filtrás; si el depósito no existe todavía, lo **creás ahí mismo** (el sistema te avisa si hay uno parecido, para no duplicar). Estandarizar el depósito evita tener el mismo lugar escrito de tres formas.\n- **Planta destino** — a qué planta van. Si sos **operador**, queda fijada a tu planta asignada.\n- **Fecha de retiro** — arranca el free time (pasá el mouse por el campo para ver qué implica ese día).\n- **Booking de retiro** — opcional.\n\nDespués **pegás los números de contenedor**, uno por línea o separados por coma.',
   2),
  ('ingreso', 'Validación de números y reforzado',
   E'Cada número se valida con el **dígito verificador ISO 6346** (4 letras + 7 dígitos). Un número con el dígito incorrecto se **marca en rojo** con el motivo, pero **no se descarta**: lo corregís o lo quitás antes de enviar. Los repetidos se ignoran solos.\n\nCada fila trae una casilla **reforzado** marcada por defecto — destildala si ese contenedor no es reforzado.\n\nEl botón **Crear tanda de retiro** queda bloqueado mientras haya algún número inválido o la tabla esté vacía.',
   3),
  ('ingreso', 'Confirmar el ingreso ahora o después',
   E'La palanca **confirmar ingreso a planta ahora** decide cuándo se registra la llegada:\n\n- **Apagada** (lo habitual): cada contenedor queda **pendiente de ingreso** y aparece en la lista de abajo. Cuando llega a la planta, lo confirmás desde ahí.\n- **Encendida**: el contenedor nace directamente **en planta**. Usala cuando el retiro y el ingreso ocurren el mismo momento. Al encenderla elegís el **medio** (camión o tren).',
   4),
  ('ingreso', 'Confirmar contenedores pendientes de ingreso',
   E'En **Pendientes de ingreso a planta** están los contenedores retirados que todavía no llegaron.\n\n1. Tildá los que llegaron (uno, varios o todos con la casilla del encabezado).\n2. Indicá la **fecha de llegada** y el **medio** (camión o tren).\n3. Tocá **Confirmar ingreso**: pasan a **en planta** y salen de la lista.\n\nSi otra persona ya cargó alguno mientras tanto, el sistema confirma solo los que seguían pendientes y te avisa cuántos fueron.',
   5),
  ('ingreso', 'Un contenedor, un ciclo abierto a la vez',
   E'Un mismo contenedor no puede tener dos ciclos abiertos a la vez. Si cargás en una tanda un contenedor que todavía está en circulación, el sistema **acepta los demás y rechaza solo ese**, diciéndote fila por fila cuál quedó afuera y por qué — nunca se pierde toda la tanda. El contenedor vuelve a estar disponible cuando se cierra su ciclo anterior (devolución o embarque).',
   6);

-- ── m5 · contenedores (ficha con waiver bruto/absorbido/neto + corrección F-02) ──
delete from crm.ayuda_contenido where seccion = 'contenedores' and nivel = 'seccion';
insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('contenedores', '¿Qué es la solapa Contenedores?',
   E'La solapa **Contenedores** es la planilla general: **una fila por ciclo**, desde el retiro hasta la devolución o el embarque.\n\nDesde acá ves todas las operaciones con su estado, planta y fechas; buscás cualquier contenedor, booking u orden con la **búsqueda global**; y abrís la **ficha** clickeando una fila.\n\n> Acá no se carga nada nuevo: las operaciones nacen en **Ingreso** y se cierran en **Egreso**. Esta solapa es para consultar y para las acciones de la ficha.',
   1),
  ('contenedores', 'Buscar y filtrar',
   E'El filtro de **estado** decide qué se lista: **Abiertas** (lo habitual), **Todas**, **Cerradas** o **Anuladas**.\n\nLa **búsqueda global** (mínimo 2 caracteres) cubre número de contenedor (podés pegar con guiones o espacios), booking de retiro, booking asignado y orden de embarque. Siempre respeta el filtro de estado activo.',
   2),
  ('contenedores', 'La ficha del contenedor',
   E'Al clickear una fila se abre la ficha, con:\n\n- **Encabezado** — número ISO 6346, naviera, tipo y estado del **reforzado**.\n- **Operación actual** — el ciclo con su estado, planta, fechas y asignación.\n- **Detention** — los tres números del costo: **bruto** (lo que generó la operación), **absorbido** (lo que se comió la naviera vía waiver) y **neto** (lo que efectivamente paga SSB).\n- **Waivers** — el historial de días que la naviera absorbió (ver más abajo).\n- **Historial** — cada evento del contenedor (retiro, ingreso, movimientos, egreso, devolución, incidencias, anulaciones, correcciones, waivers) con fecha y usuario.',
   3),
  ('contenedores', 'Mover entre plantas y confirmar la llegada',
   E'Si la operación está **en planta**, el botón **Mover entre plantas** registra un traslado: elegís planta destino, medio y fecha de salida. Con **confirmar llegada ahora** encendida, el contenedor pasa en el acto; apagada, el movimiento queda **en tránsito** y confirmás la llegada cuando el contenedor llega. El traslado entre plantas **no afecta el free time**: sigue contando desde el retiro original.',
   4),
  ('contenedores', 'Waiver: cuando la naviera absorbe el costo',
   E'A veces la naviera se hace cargo de días de detention (por un error propio, una demora suya, etc.). Eso se registra como **waiver** — supervisor o administrador, con motivo y referencia (nº de caso o mail de la naviera).\n\n- Cada waiver es un **registro propio** y **se suma** al acumulado — cargar uno nuevo **no borra** los anteriores.\n- El total absorbido nunca puede superar los días excedidos.\n- Si la naviera se retracta, se **anula un waiver individual** (con motivo) sin tocar los demás.\n\nEn la ficha ves el **historial completo** de waivers (vigentes y anulados) y el efecto en el costo: **neto = bruto − absorbido**.',
   5),
  ('contenedores', 'Corregir una operación cerrada y anular / validar reforzado',
   E'- **Corregir datos** (supervisor+): si una operación **cerrada** quedó con una fecha o un dato mal cargado (típico: la fecha de devolución), se corrige acá con **motivo obligatorio**. El costo se **recalcula solo** al valor correcto y la corrección queda auditada en el historial. Es el único camino para tocar una cerrada — nunca se edita la base a mano.\n- **Anular operación** (supervisor+): da de baja un ciclo cargado por error, con motivo. La operación queda anulada (no se borra) y el contenedor queda libre.\n- **Validar reforzado** (supervisor+): fija el estado del reforzado del contenedor y registra quién validó.',
   6);

-- ── m6 · alertas (umbral genérico, sin el "3" hardcodeado) ──────────────────
delete from crm.ayuda_contenido where seccion = 'alertas' and nivel = 'seccion';
insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('alertas', '¿Qué es la solapa Alertas?',
   E'La solapa **Alertas** es el tablero de vencimiento del free time: muestra **cada contenedor con ciclo abierto** con sus días transcurridos, los días libres de su naviera, cuántos le quedan y el **costo proyectado de detention** si se pasa.\n\nTodo lo calcula el sistema solo, a partir de la fecha de retiro y la tarifa vigente. Las filas se ordenan por **días restantes** — lo más urgente arriba.',
   1),
  ('alertas', 'Cómo leer el semáforo',
   E'Cada fila tiene un semáforo con **cuatro** estados:\n\n- 🔴 **Vencido** — el free time ya se agotó: cada día adicional suma costo.\n- 🟡 **Por vencer** — quedan pocos días de free time (el umbral es configurable desde **Admin → Configuración**).\n- 🟢 **En free time** — todavía hay margen.\n- ⚪ **Sin tarifa** — la naviera no cobra detention en origen o no hay tarifa vigente para la fecha de retiro; los días libres y el costo se muestran como «—».\n\nLos contadores de arriba resumen cuántos hay en cada estado.',
   2),
  ('alertas', 'Qué muestra cada columna',
   E'- **Días transcurridos** — días desde el retiro en depósito (el día del retiro cuenta).\n- **Días libres** — el free time de la naviera vigente a la fecha de retiro.\n- **Días restantes** — los que quedan antes de empezar a pagar; **negativo en rojo** indica cuántos se pasó.\n- **Tarifa USD/día** — lo que cobra la naviera por día de demora.\n- **Costo proyectado** — el **neto** acumulado hasta hoy si el contenedor se devolviera ya (ya descuenta lo que la naviera haya absorbido por waiver). «**USD —**» significa que no hay tarifa para proyectar; «**sin cargo**» es una operación acordada sin costo.',
   3),
  ('alertas', 'Cómo trabajar con la lista',
   E'1. Entrá a **Alertas**: lo más urgente ya está arriba.\n2. Usá el filtro de **semáforo** para quedarte con rojos o amarillos.\n3. Tocá una fila para abrir la **ficha del contenedor**.\n4. Gestioná la devolución o el embarque desde **Egreso** — al cerrarse el ciclo, el contenedor sale de esta lista.\n\nLa lista se actualiza sola al volver a la pestaña; también podés tocar **Actualizar**.',
   4),
  ('alertas', 'Quién ve qué',
   E'Un **operador** ve solo los contenedores de su planta; **supervisores y administradores** ven todas. El umbral del semáforo amarillo se edita en **Admin → Configuración** y aplica para todos al instante.',
   5);

-- ── m9 · admin (plantas CRUD + depósitos + editor de ayuda + tarifa convención) ──
delete from crm.ayuda_contenido where seccion = 'admin' and nivel = 'seccion';
insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('admin', '¿Qué es la solapa Admin?',
   E'La solapa **Admin** es exclusiva del rol **administrador** y concentra la gestión del sistema:\n\n1. **Solicitudes de acceso** — aprobar, rechazar y suspender cuentas.\n2. **Navieras** — alta y edición de las líneas.\n3. **Tarifas de free time** — días libres, USD/día y convención de conteo por naviera, versionado.\n4. **Depósitos** — el catálogo de dónde se retiran los contenedores.\n5. **Plantas** — alta, edición y baja de plantas.\n6. **Configuración** — el umbral del semáforo amarillo.\n7. **Ayuda** — el editor de estos mismos textos.\n\n> Los permisos reales se aplican en la base de datos (RLS): esconder la interfaz no da acceso.',
   1),
  ('admin', 'Cómo llega una solicitud de acceso',
   E'1. La persona entra a **Crear cuenta** y se registra con nombre, correo y contraseña.\n2. Le llega un correo de confirmación; al tocar el link, su cuenta queda **pendiente de aprobación**.\n3. Mientras está pendiente puede iniciar sesión, pero solo ve la pantalla de espera — **cero acceso a datos**.\n4. La solicitud aparece en **Admin → Solicitudes** (y en la campana) hasta que un administrador la resuelva.',
   2),
  ('admin', 'Aprobar, rechazar, suspender',
   E'- **Aprobar**: asignás **rol** (operador / supervisor / administrador) y **planta** (obligatoria para operador). La cuenta pasa a **activa**.\n- **Rechazar**: pide **motivo obligatorio**; la persona solo ve la pantalla de espera.\n- **Suspender** una cuenta activa le corta el acceso al instante (lo aplica la base, no la pantalla), sin borrar su historial. **Reactivar** le devuelve el mismo rol y planta. No podés suspender tu propia cuenta.\n- Si el correo no pertenece a los **dominios sugeridos** (configurables), la fila muestra un aviso — es solo una señal, no bloquea.',
   3),
  ('admin', 'Navieras',
   E'Cada contenedor referencia su naviera por este registro — nunca por texto — y de ahí sale su tarifa. **Nueva naviera**: nombre + la palanca **cobra detention en origen**. **No se borran**: conservan el historial; una naviera en desuso simplemente no recibe operaciones nuevas.',
   4),
  ('admin', 'Tarifas de free time: versionado (nunca se pisa)',
   E'La tarifa de cada naviera **nunca se edita ni se pisa**: cada cambio crea una **versión nueva** con su fecha de inicio, y la anterior queda cerrada el día previo. Cada operación toma la tarifa **vigente a su fecha de retiro** — subir la tarifa hoy no recalcula los contenedores de ayer.\n\nUna versión define: **días libres**, **USD/día**, **tipo** (Detention / Demurrage / Combined), si aplica a **carga peligrosa**, la **convención de conteo** (si el día del retiro cuenta como día 1) y si esa naviera **cobra detention en origen**. En la pantalla ves la versión vigente y el historial con sus rangos.',
   5),
  ('admin', 'Cargar una nueva versión de tarifa',
   E'1. Elegí la **naviera** y tocá **Nueva versión** — se precarga con la vigente.\n2. Completá días libres, USD/día, tipo, carga peligrosa, convención de conteo y si cobra en origen.\n3. Indicá **vigente desde**: debe ser **posterior** al inicio de la versión vigente.\n4. Tocá **Versionar**: la anterior queda cerrada y la nueva rige desde esa fecha.\n\nSi cargás los mismos valores que la vigente, el sistema no crea nada y te avisa.',
   6),
  ('admin', 'Depósitos: el catálogo de retiro',
   E'Los **depósitos** son de dónde se retiran los contenedores. Estandarizarlos evita tener el mismo lugar escrito de varias formas (Exolgan / EXOLGAN / Exolgan S.A.).\n\n- Cualquier operador puede **crear** un depósito al cargar una tanda; el sistema le avisa si hay uno **parecido** para no duplicar.\n- Desde acá el administrador **renombra**, **desactiva/reactiva** (nunca se borran: hay operaciones apuntando) y **fusiona duplicados** (repunta las operaciones del depósito viejo al bueno y desactiva el viejo).',
   7),
  ('admin', 'Plantas',
   E'Las **plantas** definen dónde puede estar un contenedor y a qué planta se liga cada operador. El administrador da de **alta**, **edita** y **desactiva/reactiva** plantas (no se borran: hay operaciones e usuarios que las referencian). Los listados y selectores muestran solo las plantas activas.',
   8),
  ('admin', 'Configuración: el umbral del semáforo amarillo',
   E'Un contenedor se marca en **amarillo** cuando le quedan estos días de free time o menos (y en **rojo** cuando se agotan). El valor rige en **todos** los listados, alertas y notificaciones, **al instante** para todos los usuarios. La pantalla registra quién hizo la última modificación y cuándo.',
   9),
  ('admin', 'Editor de ayuda',
   E'Desde **Admin → Ayuda** editás **estos mismos textos** sin tocar código: el instructivo de cada solapa y los mensajes de ayuda de los campos.\n\n- Editás el texto (formato **Markdown**) y lo ves en **vista previa** antes de guardar.\n- Podés **despublicar** un contenido (deja de mostrarse) sin borrarlo.\n- Los **números** (días libres, tarifa, umbral) **no se escriben a mano**: se insertan con marcas como `{{umbral}}` y el sistema los completa solos con el valor real — así nunca quedan desactualizados.',
   10);

-- ═══ D · TOOLTIPS a nivel campo — números interpolados desde crm_ayuda_valores ══
-- Placeholders válidos: {{retiro_frase}}, {{devolucion_frase}}, {{dias_libres_frase}},
-- {{tarifa_frase}}, {{umbral}}. El front los sustituye con crm_ayuda_valores(naviera);
-- las frases ya vienen compuestas (número desde la DB o genérico sin naviera), así el
-- front solo reemplaza strings — no calcula, no maneja nulls, no hardcodea números.
-- PRIORIDAD: campos de FECHA (mueven el cálculo de plata).
delete from crm.ayuda_contenido where nivel = 'campo';   -- idempotente
insert into crm.ayuda_contenido (seccion, nivel, clave, titulo, contenido_md, orden, publicado) values
  ('ingreso', 'campo', 'ingreso.fecha_retiro', 'Fecha de retiro',
   E'{{retiro_frase}}. Corren **{{dias_libres_frase}}** de la naviera; pasados esos, se paga **{{tarifa_frase}}** de detention. Un error acá corre todo el cálculo — verificala contra el remito de retiro.', 1, true),
  ('ingreso', 'campo', 'ingreso.naviera', 'Naviera',
   E'Define **{{dias_libres_frase}}** y una tarifa de **{{tarifa_frase}}** para todo el ciclo, según su versión vigente a la fecha de retiro.', 2, true),
  ('ingreso', 'campo', 'ingreso.retiro_de', 'Retiro de (depósito)',
   E'De dónde se retira el contenedor. Elegilo del catálogo; si no existe, crealo ahí mismo — el sistema te avisa si hay uno parecido para no duplicarlo.', 3, true),
  ('ingreso', 'campo', 'ingreso.fecha_llegada', 'Fecha de llegada a planta',
   E'Cuándo el contenedor llegó a la planta. Queda registrada para trazabilidad, pero **no corta el free time**: el reloj sigue corriendo desde el retiro.', 4, true),
  ('egreso', 'campo', 'egreso.fecha_salida', 'Fecha de salida de planta',
   E'Cuándo salió de la planta (embarcado o vacío). **No corta el free time todavía** — el conteo sigue hasta la llegada a terminal o la devolución.', 1, true),
  ('egreso', 'campo', 'egreso.fecha_devolucion', 'Fecha de devolución',
   E'{{devolucion_frase}}. Poné la fecha **real**: cada día de diferencia cambia el costo de detention que se factura.', 2, true),
  ('contenedores', 'campo', 'contenedores.fecha_salida_mov', 'Fecha del movimiento entre plantas',
   E'Fecha del traslado interno entre plantas. **No afecta el free time**: sigue contando desde la fecha de retiro original, sin importar por cuántas plantas pase.', 1, true),
  ('contenedores', 'campo', 'contenedores.correccion_fecha', 'Corregir fecha de una cerrada',
   E'Corregir esta fecha en una operación cerrada **recalcula el costo** al valor correcto. Requiere motivo y queda auditado — es el único camino para tocar una cerrada.', 2, true),
  ('contenedores', 'campo', 'contenedores.waiver_dias', 'Días de waiver',
   E'Días de detention que **la naviera absorbe**. Se **suma** al acumulado (no reemplaza) y no puede superar los días excedidos. Reduce el costo neto: **neto = bruto − absorbido**.', 3, true),
  ('incidencias', 'campo', 'incidencias.fecha', 'Fecha de la incidencia',
   E'El día en que **ocurrió el evento** (no cuándo lo cargás). Es el dato del reclamo ante la naviera o el depósito; no afecta el cálculo de free time ni de costo.', 1, true),
  ('admin', 'campo', 'admin.tarifa.vigente_desde', 'Vigente desde (tarifa)',
   E'Desde esta fecha rige la nueva tarifa. Los contenedores retirados **antes** siguen calculando con la versión anterior — **nunca se recalcula el pasado**.', 1, true),
  ('admin', 'campo', 'admin.tarifa.convencion', 'Convención de conteo',
   E'Define si **el día del retiro cuenta como día 1** o si el free time arranca al día siguiente. Es parte de la tarifa versionada: cambiarla crea una versión nueva, no recalcula lo ya cargado.', 2, true),
  ('admin', 'campo', 'admin.config.umbral', 'Umbral del semáforo amarillo',
   E'Un contenedor se marca **amarillo** cuando le quedan **{{umbral}} días** de free time o menos. Rige para todos, al instante. Ingresá un entero entre 1 y 30.', 3, true);
