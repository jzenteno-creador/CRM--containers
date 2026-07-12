-- seeds-ayuda/m8_dashboard — ayuda_contenido sección `dashboard` (§15.5, desde spec §8/§9 + views 018)
-- Idempotente. NO aplicado durante M8 (contenido de M10, mismo criterio que m3-m7).
delete from crm.ayuda_contenido where seccion = 'dashboard';

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
