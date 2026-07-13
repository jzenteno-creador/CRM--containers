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
  `configuracion` (operativa, no toca costo), `incidencias` + `incidencia_fotos`
  (alta de M7; deuda conocida BE-03: no atómico, candidato a RPC futura).
- Agregar una tabla a la lista sancionada requiere decisión explícita de John — un PASS
  de verifier no crea excepciones.
