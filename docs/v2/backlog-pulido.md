# Backlog de pulido — rebuild v2

> Items no bloqueantes detectados durante el build. Se barren en la pasada visual final pre-CP3 (o antes si un módulo los toca). Nada de acá gatea checkpoints.

| # | Item | Origen | Destino sugerido |
|---|---|---|---|
| 1 | Login móvil oculta el panel de marca (logos SSB/Dow) por CSS intencional — ¿John quiere logos también en móvil? | verify M0 | pasada final |
| 2 | Íconos Tabler por CDN jsdelivr (única dependencia runtime de terceros; fuentes sí self-hosted) → migrar a `@tabler/icons-react` o webfont self-hosted | review M0 (finding 4) | M10/pasada final |
| 3 | Charts SVG escalan tipografía con el viewBox — si molesta en paneles muy anchos, medir con ResizeObserver | reporte M0 | M7 (si se nota) |
| 4 | Comentario engañoso en migración 001 (el default-privilege por schema fue no-op; el fix real es 010) — aclarar en migración futura | review M1 (finding 1) | próxima migración |
| 5 | Campana: incluir operaciones en tránsito hacia la planta del operador en categoría `alertas` de `get_pendientes()` — DECIDIDO por John en CP1 | review M1 (finding 2) | **M6 (comprometido)** |
| 6 | Resend de email de confirmación desde el login (hoy solo desde registro) | self-critique M2 | M10 |
| 7 | PKCE: si John activa PKCE en el dashboard, el callback necesita `exchangeCodeForSession` (hoy flujo implicit default) | self-critique M2 | verificar en verify M2 |
| 8 | Grants de `service_role` sobre schema `crm` — necesarios recién para F2 (digest n8n) | entregable CP1 | F2 |
| 9 | RPCs `crm_reabrir_operacion`/`crm_corregir_operacion` (F-02/F-03 de v1) — valores de evento ya en el CHECK; las RPCs quedan para cutover salvo pedido | plan M1 | cutover |
| 10 | `/registro` revela existencia de cuentas ("ya existe una cuenta…") — decisión: ACEPTADO por UX (el oráculo vive igual en la respuesta del API de GoTrue; herramienta interna con gate de aprobación). Vetable por John en CP2 | review M2 (finding 1) | decidido |
| 11 | Consolidar `GateFrame`, `CardIcon` y el alert-box rojo de formularios como componentes del design system (hoy duplicados en 3-4 pantallas de auth) — hacerlo ANTES de que M3 copie el patrón | review M2 (finding 2) | pre-M3 |
| 12 | Estándar de acciones por fila en tablas operativas — DECIDIDO: `ghost` por fila, `primary` solo en el modal de confirmación (una primaria por pantalla). Ajustar Aprobar de /admin/solicitudes; el reviewer lo exige desde M3 | review M2 (finding 3) | M3 en adelante + pulido |
