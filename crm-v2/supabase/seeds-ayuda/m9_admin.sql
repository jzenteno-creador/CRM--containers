-- seeds-ayuda/m9_admin — sección `admin` completa (M9: hub + navieras + tarifas +
-- plantas + configuración; conserva el contenido de solicitudes de M2).
-- Idempotente. NO aplicado durante M9 (contenido de M10, mismo criterio que m3-m8).
delete from crm.ayuda_contenido where seccion = 'admin';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('admin', '¿Qué es la solapa Admin?',
   E'La solapa **Admin** es exclusiva del rol **administrador** y concentra la gestión del sistema en cinco secciones:\n\n1. **Solicitudes de acceso** — aprobar, rechazar y suspender cuentas.\n2. **Navieras** — alta y edición de las líneas navieras.\n3. **Tarifas de freetime** — días libres y USD/día por naviera, versionado.\n4. **Plantas** — listado de plantas operativas (solo lectura).\n5. **Configuración** — umbral del semáforo amarillo.\n\n> Importante: aunque alguien esconda o manipule la interfaz, los permisos reales se aplican en la base de datos (RLS). Una cuenta no activa no puede leer ningún dato.',
   1),

  ('admin', 'Cómo llega una solicitud de acceso',
   E'1. La persona entra a **Crear cuenta** y se registra con nombre, correo y contraseña.\n2. Le llega un correo de confirmación; al tocar el link, su cuenta queda **pendiente de aprobación**.\n3. Mientras está pendiente puede iniciar sesión, pero solo ve la pantalla de espera — **cero acceso a datos**.\n4. La solicitud aparece en **Admin → Solicitudes de acceso** (y en la campana de notificaciones) hasta que un administrador la resuelva.',
   2),

  ('admin', 'Aprobar una solicitud (rol y planta)',
   E'El botón **Aprobar** abre un formulario con dos campos:\n\n- **Rol** — define qué puede hacer la persona:\n  - **Operador**: opera el día a día (tandas, ingresos, egresos, incidencias) **solo en su planta**.\n  - **Supervisor**: todo lo del operador en **todas** las plantas, más validar reforzados, anular operaciones y reportes.\n  - **Administrador**: todo lo anterior, más usuarios y configuración.\n- **Planta asignada** — **obligatoria si el rol es operador** (define qué operaciones ve); opcional para supervisor y administrador.\n\nAl confirmar, la cuenta pasa a **activa** y la persona ya puede operar en su próximo ingreso.',
   3),

  ('admin', 'Rechazar una solicitud',
   E'El botón **Rechazar** pide un **motivo obligatorio**, que queda registrado en la cuenta rechazada.\n\nUna cuenta rechazada puede iniciar sesión pero solo ve la pantalla de espera con su estado — sin acceso a ningún dato. Si el rechazo fue un error, la persona debe contactar a administración.',
   4),

  ('admin', 'El aviso de dominio (⚠ junto a una solicitud)',
   E'Si el correo de una solicitud **no pertenece a los dominios sugeridos** (configurables; por defecto `ssbint.com`), la fila muestra un **aviso amarillo**.\n\nEs **solo una señal para mirar dos veces** — no bloquea nada: la decisión de aprobar o rechazar siempre es humana.',
   5),

  ('admin', 'Suspender y reactivar cuentas',
   E'En la lista de **usuarios resueltos**:\n\n- **Suspender** una cuenta activa le corta el acceso **de inmediato** (lo aplica la base de datos, no la pantalla). No borra nada: su historial y sus operaciones quedan intactos.\n- **Reactivar** una cuenta suspendida le devuelve el acceso con el mismo rol y la misma planta que tenía.\n- No podés suspender tu propia cuenta.',
   6),

  ('admin', 'Navieras: alta y edición',
   E'En **Admin → Navieras** se administran las líneas navieras. Cada contenedor referencia su naviera por este registro — nunca por texto — y de ahí sale su tarifa de freetime.\n\n- **Nueva naviera**: nombre (obligatorio) y la palanca **cobra detention en origen** (encendida por defecto). Apagala si la línea no factura detention en Argentina.\n- **Editar**: mismo formulario sobre una naviera existente.\n- **No se borran**: conservan el historial de operaciones. Si una naviera dejó de usarse, simplemente no se le cargan operaciones nuevas.\n\nLa columna de tarifa vigente es informativa; el versionado vive en **Tarifas de freetime**.',
   7),

  ('admin', 'Tarifas de freetime: cómo funciona el versionado',
   E'La tarifa de cada naviera (días libres + USD/día) **nunca se edita ni se pisa**: cada cambio crea una **versión nueva** con su fecha de inicio, y la anterior queda cerrada el día previo.\n\n¿Por qué? Porque cada operación toma la tarifa **que estaba vigente a su fecha de retiro**. Si mañana la naviera sube la tarifa, los contenedores retirados ayer siguen calculando con la de ayer.\n\nEn la pantalla elegís la naviera y ves su **versión vigente** (días libres, USD/día, tipo, si aplica a carga peligrosa) y el **historial completo** de versiones con sus rangos de vigencia.',
   8),

  ('admin', 'Cargar una nueva versión de tarifa',
   E'1. Elegí la **naviera** y tocá **Nueva versión** — el formulario se precarga con la versión vigente.\n2. Completá **días libres**, **tarifa (USD/día)**, **tipo** (Detention, Demurrage o Combined) y si **aplica a carga peligrosa**.\n3. Indicá **vigente desde**: debe ser **posterior** al inicio de la versión vigente (el sistema lo controla).\n4. Tocá **Versionar tarifa**: la versión anterior queda cerrada y la nueva pasa a regir desde esa fecha.\n\nSi cargás exactamente los mismos valores que la versión vigente, el sistema no crea nada y te avisa que no había cambios.',
   9),

  ('admin', 'Plantas (solo lectura)',
   E'El listado muestra las plantas operativas del sistema: definen **dónde puede estar un contenedor** y a qué planta se liga cada operador.\n\nEl alta o la edición de plantas **requiere una migración de backend** (la tabla no tiene política de escritura) — pedila a administración del sistema.',
   10),

  ('admin', 'Configuración: el umbral del semáforo amarillo',
   E'Un contenedor se marca en **amarillo** cuando le quedan estos días de freetime o menos (y en **rojo** cuando se le acaban). El valor rige en **todos** los listados, alertas y notificaciones.\n\n- Ingresá un entero entre **1 y 30** y tocá **Guardar**.\n- El cambio impacta **al instante** para todos los usuarios — no hace falta recargar nada.\n- La pantalla registra quién hizo la última modificación y cuándo.',
   11);
