-- ═══════════════════════════════════════════════════════════════════════════
-- SEED · B4 — Ayuda de consolidación (llenos/vacíos, M5-029, D3 informativo)
-- Generado por el ui-builder al construir la capa UI de B4. NO APLICADO — el
-- agente de DB en paralelo (030) decide número de migración y momento de aplicar.
-- Idempotente: la fila de nivel='campo' usa ON CONFLICT sobre ux_ayuda_clave; la
-- de nivel='seccion' se borra por título antes de reinsertar (no hay unique key
-- natural para esas filas — mismo criterio que 024).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── campo: ingreso.estado_carga (tooltip del Select nuevo en tanda-form.tsx) ──
insert into crm.ayuda_contenido (seccion, nivel, clave, titulo, contenido_md, orden, publicado)
values (
  'ingreso', 'campo', 'ingreso.estado_carga', 'Estado de carga',
  E'Por defecto el contenedor **nace vacío**. Marcá **lleno** solo en el caso raro de un movimiento entre plantas con mercadería ya adentro — la carga habitual se registra después, desde la ficha del contenedor con **Consolidar**.',
  5, true
)
on conflict (clave) where clave is not null
do update set
  titulo = excluded.titulo,
  contenido_md = excluded.contenido_md,
  orden = excluded.orden,
  publicado = excluded.publicado;

-- ── sección: contenedores — paso nuevo del instructivo de la ficha ──
delete from crm.ayuda_contenido
 where seccion = 'contenedores' and nivel = 'seccion'
   and titulo = 'Consolidar y desconsolidar (llenos y vacíos)';

insert into crm.ayuda_contenido (seccion, titulo, contenido_md, orden) values
  ('contenedores', 'Consolidar y desconsolidar (llenos y vacíos)',
   E'Dow usa los contenedores en planta como depósito temporal: adentro se **consolida** mercadería (el contenedor queda «lleno») y en algún momento se **desconsolida** (vuelve a «vacío»). Es **informativo**: no afecta la tarifa ni corta el free time — sirve para llevar el stock y la trazabilidad de qué hay adentro de cada equipo.\n\n- **Badge lleno/vacío** — junto al estado de la operación, en la ficha y en los listados (Contenedores, Egreso, Reportes).\n- **Carga actual** — si está lleno, un detalle con GMID, descripción, cantidad de bolsas y lote de cada producto cargado, más el total de bolsas.\n\nLas acciones solo están disponibles con la operación **en planta**:\n\n1. Tocá **Consolidar** (o **Agregar carga**, si ya está lleno — es incremental, no reemplaza lo cargado) en la ficha del contenedor.\n2. Por cada producto: elegí el **GMID** del catálogo o creá uno nuevo ahí mismo si no existe (el sistema te pide GMID + descripción), y cargá la **cantidad de bolsas**; el **lote** es opcional. Agregá tantas líneas como productos tenga la carga.\n3. Confirmá: el contenedor pasa a **lleno** y las líneas quedan en el historial de la ficha.\n4. Cuando se descarga, tocá **Desconsolidar**: cierra todas las líneas vigentes de una sola vez y el contenedor vuelve a **vacío** (el motivo es opcional).\n\n> Al cargar una tanda de retiro en **Ingreso** también podés marcar que el contenedor **ya viene lleno** — caso raro, pensado para movimientos entre plantas. Por defecto, todos los contenedores nacen vacíos.',
   7);

notify pgrst, 'reload schema';
