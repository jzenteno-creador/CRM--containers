-- ============================================================================
-- seeds-ayuda/m2_admin — contenido de ayuda_contenido para la sección `admin`
-- (§15.5: generado DESDE spec.md — §12 flujo de aprobación, §7 matriz de roles,
-- §12.4 warning de dominio, §12.5 suspensión, §18.3 operador con planta).
-- Alcance M2: solo la parte de Solicitudes de acceso; el resto del Admin
-- (navieras, tarifas, plantas, configuración, editor de ayuda) se suma en M8.
--
-- ⚠️ NO APLICADO por el ui-builder (M2 no toca la DB): lo aplica el
-- schema-builder en su próximo turno.
-- Idempotente: reemplaza el contenido previo de la sección `admin`.
-- ============================================================================

delete from crm.ayuda_contenido where seccion = 'admin';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('admin', '¿Qué es la solapa Admin?',
   E'La solapa **Admin** es exclusiva del rol **administrador** y concentra la gestión del sistema. En esta etapa contiene las **Solicitudes de acceso**: aprobar, rechazar y suspender cuentas.\n\nMás adelante se suman la gestión de usuarios, navieras, tarifas versionadas, plantas, la configuración general y el editor de esta misma ayuda.\n\n> Importante: aunque alguien esconda o manipule la interfaz, los permisos reales se aplican en la base de datos (RLS). Una cuenta no activa no puede leer ningún dato.',
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
   E'Si el correo de una solicitud **no pertenece a los dominios sugeridos** (configurables; por defecto `ssbint.com`), la fila muestra un **aviso amarillo**.\n\nEs **solo una señal para mirar dos veces** — no bloquea nada: la decisión de aprobar o rechazar siempre es humana. Cualquier persona con un correo válido puede registrarse; el filtro real es tu aprobación.',
   5),

  ('admin', 'Suspender y reactivar cuentas',
   E'En la lista de **usuarios resueltos**:\n\n- **Suspender** una cuenta activa le corta el acceso **de inmediato** (lo aplica la base de datos, no la pantalla). No borra nada: su historial y sus operaciones quedan intactos.\n- **Reactivar** una cuenta suspendida le devuelve el acceso con el mismo rol y la misma planta que tenía.\n- No podés suspender tu propia cuenta.\n\nUsala para bajas temporales o definitivas de personal sin perder trazabilidad.',
   6);
