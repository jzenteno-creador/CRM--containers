# PLAN M5 — Importación, Bookings, Multi-región y mejoras operativas
**CRM-DETENTION (crm-v2) · Input para Claude Code (Fable 5) · 2026-07-14**

## 0. Cómo usar este documento
Este plan es el input de la fase EXPLORE → PLAN de Fable 5 en Claude Code. Fable lee este documento + repo + DB live, produce el plan maestro de implementación (bloques, agentes, verificación) y lo presenta a John para GO. Tras el GO: ejecución autónoma con agent teams (Fable orquestador, Sonnet workers, verifier independiente por bloque). Cierre: deploy manual + smoke de John.

Fuentes de verdad: transcripción reunión Omar Pérez 2026-07-13, `Origin_Free_Time.xlsx` (732 filas, contrato global origen), `Destination_Free_Time.xlsx` (1443 filas, contrato global destino), DB live `crm` (verificada 2026-07-14), decisiones de John sesión 2026-07-14.

## 1. Contexto y estado
- Prod: crm-detention.vercel.app · Supabase `cctuowthpnstvdgjuomq` · schema `crm`. Migración 025 aplicada en prod y verificada (fix P1: escrituras financieras solo vía RPC).
- ⚠️ Repo desincronizado con prod: migración 025 + docs sin commitear → **B0 obligatorio antes de todo**.
- Datos actuales en `crm` = pruebas de John. Se pueden limpiar (RPC reset-demo, migración 022) si facilita las migraciones. Nada que preservar.
- Schema `detention` (v1 histórico, USD 588.370 conciliados): **READ-ONLY absoluto** (§21). Ni DDL ni writes, nunca.

## 2. Reglas duras (heredan del spec + fix 025)
1. Campos que afectan cálculo de plata (fechas de reloj, naviera, estado, tarifas) se escriben SOLO vía RPC con validación + evento en timeline. **Las tablas nuevas de impo/bookings nacen con este mismo patrón** (RLS activa, sin UPDATE directo de `authenticated` sobre campos financieros). No repetir el hueco P1.
2. Tarifas versionadas: nunca UPDATE sobre versiones con histórico real detrás. Correcciones de seed erróneo sobre datos de test se documentan como corrección (ver B1).
3. Sin números de negocio hardcodeados en UI (14 días, umbral 5 días, etc.) — siempre interpolados desde DB.
4. Timezone de cálculo: `America/Argentina/Buenos_Aires`. Regla de conteo **inclusiva en ambos extremos**: `dias = hasta − desde + 1` (el día del retiro y el día de la devolución cuentan los dos). Confirmada para origen por Omar 2026-07-13 y ya implementada (migración 019). Para destino se asume igual — ⚠️ VERIFY con la primera liquidación real de impo.
5. UX: **menos clicks es el criterio de desempate**. Defaults inteligentes, encabezado una vez + carga en lote, confirmaciones masivas.
6. Verificación: cada bloque cierra con un verifier independiente que corre sus propias queries contra la DB. No se acepta PASS reportado por el worker sin evidencia ejecutada (lección recurrente de CC).

## B0 — Sincronizar repo (previo a todo)
Commit atómico `chore: sync repo with prod (migration 025 + gate docs)`:
- `crm-v2/supabase/migrations/025_fix_p1_rpc_executor.sql`
- `docs/GATE-025.md`, `docs/FIX-P1-BAKEOFF.md`, `docs/CP3-VERIFY.md`, `docs/AUDIT-4-DEFINER-RPCS.md`, `docs/fix-p1/`
- `SESSION_HANDOFF.md`, `crm-v2/AGENTS.md` (modificados)
Excluir del commit el ruido ajeno al rebuild (PDFs/Excel del caso de negocio y Dow Summit 2026).

## B1 — Contrato global de free time + multi-región
Objetivo: las tarifas dejan de ser "Argentina plano por naviera" y pasan a ser el contrato global que comparte el cliente, con dimensión región/país, administrable en Admin.

Modelo (lineamientos; Fable decide detalles finos):
- Catálogo `paises` (nombre, region: LATAM | EMEAI | APAC | NAM) o columnas region+pais en tablas de tarifas. `plantas` gana país (default ARGENTINA). Alta de país + plantas desde Admin (caso Brasil).
- `freetime_origin`: sumar region, `freetime_reefer`, `tarifa_reefer_usd_dia` (hoy no se opera reefer, pero el contrato lo trae y se guarda completo). Versionado se mantiene tal cual.
- `freetime_destino` (nueva, misma filosofía versionada): naviera_id, region, pais_destino, `dias_combined`, `dias_demurrage` nullable, `dias_detention` nullable, hazardous, tarifa_dry, tarifa_reefer, freetime_reefer, vigencias.
- **Semántica destino (regla elegida):** si la fila trae `dias_demurrage`/`dias_detention` con valores ⇒ dos relojes separados (demurrage: arribo→retiro de terminal; detention: retiro→devolución del vacío). Si solo trae Combined ⇒ un reloj único (arribo→devolución). Para las líneas operativas en Argentina (Maersk, Hapag, CMA, MSC) el contrato trae solo Combined ⇒ un reloj. Motor parametrizado para poder ajustar la regla sin migración de datos. ⚠️ interpretación a validar con la primera liquidación real.
- Seed completo desde los dos Excel (todas las regiones y líneas — decisión de John 2026-07-14). Suppliers nuevos (forwarders: CEVA, DHL, DSV, DP World, Expeditors, etc.) se dan de alta en `navieras` automáticamente. Filas inválidas/NaN se documentan y excluyen con log.
- **Corrección Argentina (palabra de Omar 2026-07-13, ratificada por John): días libres de origen = 14 para las navieras operativas.** El contrato global tiene error. Aplicar: CMA CGM 18→14, ZIM 21→14 (Maersk y Hapag ya están en 14 en la DB). El resto de líneas no operativas queda a valor contrato. Como los datos de `crm` son de test, se aplica como corrección del seed, documentada. ⚠️ cierre definitivo pendiente vía MOTOR↔NAVIERA con factura real (acción de John).
- Admin: vista de tarifas (origen y destino) con **filtro rápido de país con ARGENTINA como preset/default**, búsqueda por naviera y destino, lectura fácil, edición versionada por fila. Importador de Excel con diff contra vigente = fase posterior (anotar en deuda, no construir ahora).

## B2 — Módulo Importación (requiere B1)
Ciclo del contenedor impo: **arribo a terminal → retiro de terminal (con mercadería) → ingreso a planta → devolución del vacío** (la devolución corta el reloj).

Realidad operativa (John 2026-07-14): una orden de impo trae 1–4 contenedores; el arribo es común (mismo buque); los retiros pueden ser escalonados en distintos horarios del mismo día (un camión, varios viajes); **la carga en el sistema la hace una persona en un solo momento, después de los hechos**.

- Modelo: recomendación = tabla propia `operaciones_impo` reutilizando `contenedores` (maestro), `incidencias` y timeline de eventos. Fable decide unificar con `operaciones` o separar; no forzar unificación si ensucia estados. Guard igual que expo: un solo ciclo abierto por contenedor (entre expo e impo combinados).
- Cabecera de orden impo: numero_orden, naviera, booking/BL, buque opcional, fecha_arribo_terminal, planta destino.
- Detalle por contenedor: fecha_retiro_terminal (editable por fila, default = compartida), fecha_ingreso_planta, fecha_devolucion, estado (en_terminal | en_transito_a_planta | en_planta | en_transito_devolucion | cerrado | anulada).
- Motor destino según B1 (uno o dos relojes, regla inclusiva). Costo proyectado y semáforo análogos a expo.
- UI: solapa **Importación** con dos fases espejo de Ingreso/Egreso: Fase 1 = alta de orden (encabezado una vez + filas de contenedores, pegado o tipeo, defaults, validación ISO 6346 y prefijos B6); Fase 2 = pendientes (confirmar retiro / ingreso a planta / devolución, con selección múltiple).
- Alertas impo integradas en la solapa Alertas existente (misma lógica de semáforo, columna EXPO/IMPO). Dashboard: costo impo separado + total combinado.

## B3 — Bookings expo (ficticios, roleo y reasignación)
Contexto operativo (reunión Omar): los retiros se hacen con bookings ficticios de Maersk; ocupan lugar en un buque; cuando se acerca la salida (corte ≈ ETD − 3/4 días) y quedan contenedores en planta, hay que pedir el roleo a un buque más lejano. Los contenedores van saliendo despachados bajo bookings reales (dato de Aldi/plan de carga). Omar hoy controla esto a mano todos los viernes con otro Excel.

- Entidad `bookings`: numero (UNIQUE por naviera), naviera_id, **etd (obligatorio)**, fecha_corte opcional, buque opcional, tipo (retiro | embarque), estado (activo | cancelado | cumplido), notas.
- Ingreso expo: `booking_retiro` pasa a referenciar `bookings`; alta inline con `<ComboboxCreatable>` **pidiendo ETD obligatorio** (decisión John: booking + ETD mandatorios al ingreso; el ETD es del booking, no del contenedor).
- Egreso: `booking_asignado` también referencia `bookings` (alta inline). Cada contenedor que egresa descuenta del saldo del booking ficticio con el que entró.
- **Vista Bookings**: bookings de retiro activos con contenedores restantes en planta, ETD, días a ETD y semáforo. Umbral configurable en Admin (default sugerido: alerta a ETD − 4 días). Alerta en solapa Alertas cuando quedan contenedores y se acerca el ETD ("pedir roleo").
- Acciones: **Rolear** (mismo booking, nuevo ETD/buque; queda historial como evento) y **Reasignar** (buscar booking → checkbox de contenedores → booking destino nuevo o existente → motivo: roleo naviera | corrección | otro). Todo queda en el timeline de cada contenedor. Permisos: operador+, con registro de quién y cuándo.

## B4 — Consolidación / llenos-vacíos (expo en planta)
Contexto: Dow usa contenedores en planta como depósito. Hoy Omar registra lleno/vacío + producto + observaciones a mano.

- Catálogo `productos`: **gmid** (código de identificación único del producto, Dow) + descripcion. Alta rápida inline (`<ComboboxCreatable>`); el GMID es la clave del catálogo.
- `consolidaciones` por operación: N líneas de (producto_id, cantidad_bolsas, lote nullable). **Varios productos y varios lotes por contenedor permitidos** (John: puede haber que segmentar; el modelo lo soporta desde el día uno aunque la UI empiece simple).
- Ficha del contenedor (solapa Contenedores): acción **Consolidar** (estado → lleno + carga de líneas) / **Desconsolidar** (→ vacío). Ambos generan evento en timeline.
- Ingreso de tanda expo: campo estado con default **vacío** y opción de marcar lleno (caso raro: movimientos entre plantas u otros particulares).
- Listados, ficha y reportes muestran lleno/vacío + producto(s).

## B5 — Incidencias ampliadas
- Nuevos tipos: `lavado_exigido` (al devolver el vacío exigen lavado; se paga y después se reclama) y `dano_refaccion` (daño detectado en la devolución con costo de refacción). Se mantienen los tipos actuales.
- Campos nuevos en todas las incidencias: **numero_orden**, monto_usd nullable, responsable (texto libre o naviera), y bloque de seguimiento de reclamo: estado_reclamo (sin_reclamo | abierta | reclamada | resuelta), resultado (recuperado | no_recuperado | null), fechas. Objetivo: saber qué plata se pagó y qué se recuperó.
- Aplican a operaciones expo e impo.
- **No reforzado al retiro**: destildar "reforzado" en la tanda auto-genera incidencia `no_reforzado` + alerta (el contenedor ya suele estar arriba del tren). Notificación automática por email = fase posterior (n8n), anotar en deuda.

## B6 — Prefijos restringidos (container screen Dow)
- Tabla admin `prefijos_restringidos`: prefijo (4 letras), activo, nota/fuente, fechas. CRUD en Admin (Omar la actualiza desde la intranet de Dow ~julio y diciembre).
- Validación al pegar contenedores (ingreso expo e impo): prefijo restringido ⇒ **warning fuerte por fila + confirmación explícita** para continuar + genera incidencia/alerta si se confirma igual. No bloqueo duro (el contenedor puede ya estar retirado).

## B7 — Réplica del Excel de Omar (requiere B4)
- Exportación a Excel desde Reportes replicando el formato de Omar: hoja **General** (stock en planta; columnas espejo: contenedor, naviera, terminal/depósito de retiro, planta, tipo, reforzado, fecha retiro, fecha vencimiento, alerta, booking, estadía, días libres, demora, costo, lleno/vacío, producto, observaciones/comentarios) + hojas **Vencidos**, **Próximos a vencer** (< 5 días, umbral desde DB) y **Vacíos a vencer** (resto).
- Generación manual (botón) en v1. Envío automático martes/jueves = fase posterior con n8n, anotar en deuda.
- Criterio de aceptación: Omar puede comparar contra su Excel sin traducir columnas.

## B8 — Fixes y tarea paralela
1. **Password recovery (front)**: handler del evento `PASSWORD_RECOVERY` que rutee a `/auth/actualizar-password` (hoy el link loguea directo). Va con el deploy.
2. Cleanup opcional: revocar `contenedores:UPDATE` de `authenticated` (vestigial, ya bloqueado por RLS).
3. **Paralelo (agente aparte, no bloquea el resto)**: rehacer el archivo de preguntas de la presentación que está en el repo. Reglas de John: (a) **NO revelar que el sistema ya existe ni que funciona** — redactar todo como propuesta a desarrollar; (b) enfoque de producto **escalable multi-región** (países, plantas, contrato global); (c) el alcance incluye seguimiento de **exportación E importación**. Tono de negocio, respuestas concisas, sin tecnicismos internos ni referencias a la infraestructura ya desplegada.

## Orden sugerido y dependencias
B0 → B1 → {B3, B4, B5, B6 en paralelo} → B2 → B7 → B8.1 → deploy. B8.3 corre en paralelo desde el inicio. Dependencias duras: B2 ← B1, B7 ← B4. Fable puede reordenar lo independiente si su plan lo justifica.

## Verificación de cierre (antes del smoke de John)
- Build + lint + navegación de rutas nuevas.
- Verifier independiente por bloque, con queries propias: conteo de seed (origen 732, destino 1443, ± filas inválidas documentadas); corrección CMA/ZIM = 14 vigente; motor impo con 3 casos sintéticos (Combined sin demora, Combined con demora, split demurrage+detention); saldo de booking correcto tras egreso parcial; ciclo completo de incidencia con reclamo; warning de prefijo restringido.
- Checksums expo de referencia: recalcular y documentar (si se usa reset-demo, los valores previos —70 abiertas / 19 en demora / $28.630— dejan de aplicar; registrar los nuevos).
- Deploy manual `npx vercel deploy --prod --yes`. Smoke de John: tanda expo completa, orden impo completa, roleo + reasignación, incidencia con reclamo, export Excel.

## ⚠️ VERIFY pendientes (no bloquean; documentar en el handoff)
1. Regla inclusiva en destino (asumida igual a origen; validar con primera liquidación impo).
2. Interpretación de filas de destino con demurrage y detention simultáneos (regla elegida: dos relojes; validar con liquidación real).
3. Cierre MOTOR↔NAVIERA con factura real de expo — acción manual de John (deuda previa).
4. Aprobación de usuarios pendientes en Admin → Solicitudes (operez@ssbint.com, jsrojas@ssbint.com) — acción manual de John.
