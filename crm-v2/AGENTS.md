<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Regla de escritura a la DB (sancionada por John, 2026-07-13)

Toda la lógica de negocio vive en Supabase (RPCs + views). El front muestra, no calcula,
y NUNCA escribe directo sobre tablas de plata.

- **PROHIBIDO sin excepción**: `.insert/.update/.delete/.upsert` desde el cliente sobre
  `operaciones`, `operacion_eventos`, `operacion_waivers`, `freetime_origin`,
  `contenedores`, `movimientos_planta`. Todo pasa por RPC. Si la RPC no cubre un caso,
  el output es "falta la RPC" — jamás un write directo (regla reforzada tras el B1).
- **SANCIONADO explícitamente** (única lista permitida de escritura directa, siempre
  detrás de las policies de rol): `navieras`, `plantas` (maestros sin impacto en costo —
  `cobra_detention_origen` del maestro es solo default de UI desde la 019),
  `depositos` (maestro sin impacto en costo — catálogo de retiro, 023; el alta inline
  desde /ingreso pasa por `crm_crear_deposito`, pero el CRUD de Admin inserta/actualiza
  directo, mismo patrón que navieras/plantas), `configuracion` (operativa, no toca
  costo), `incidencias` + `incidencia_fotos` (alta de M7; deuda conocida BE-03: no
  atómico, candidato a RPC futura), `ayuda_contenido` (contenido de ayuda/tooltips;
  editor de Admin §15.4, sancionado en el brief M4 B3-B; los números del copy se
  interpolan vía `crm_ayuda_valores`, nunca se escriben a mano).
- Agregar una tabla a la lista sancionada requiere decisión explícita de John — un PASS
  de verifier no crea excepciones.

# Constantes que QUEDAN EN CÓDIGO (decisión de John, 2026-07-13)

`contenedores.tipo` (20DC/40DC/40HC) y `movimientos_planta.medio` (camion/tren)
son CHECKs de integridad sobre tablas de plata, NO configurables por Admin. Razón:
el histórico usa 3 tipos y 2 medios, estables hace un año; cambiar una garantía
permanente por flexibilidad que se usa una vez cada tres años es mal negocio. Un tipo
nuevo = migración de 5 minutos. NO dropear estos CHECKs para hacerlos "configurables".

Sí es configurable: `depositos` (retiro_de) — catálogo con alta inline del operador
(023), porque es texto libre de alta frecuencia y su valor es evitar la fragmentación
(Exolgan/EXOLGAN/...), no una barrera de integridad.
