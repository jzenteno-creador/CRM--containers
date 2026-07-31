# HANDOFF · M4 Bloque 2 (front F1 + F-02) · 2026-07-13

> Estado: **COMPLETO Y AUDITADO — esperando GO de John para (1) aplicar la 020 y (2) deployar.**
> Cero DDL aplicado en este bloque, cero deploy, cero commits.

## HECHO

1. **Migración 020** (`crm-v2/supabase/migrations/020_m4_b2_correccion_cerradas.sql`, NO aplicada):
   `crm_corregir_operacion_cerrada(p_operacion, p_campo, p_valor, p_motivo)` — elegida sobre
   "reabrir" (no re-transita la máquina de estados ni choca con `ux_operacion_abierta` si el
   contenedor ya tiene un ciclo nuevo). Supervisor+, motivo obligatorio, whitelist de 9 campos
   (fechas + asignación; jamás estado/contenedor/waiver/sin_cargo), mensajes de error legibles,
   guard de no-op por instante, evento `correccion` con anterior/nuevo/quién/porqué.
2. **Gate 020 en harness local: PASS 11/11** — devolución +3d → bruto 105→210 (3×35 exacto),
   retiro −2d → +70, texto no toca costos, 7 guards legibles, 3 eventos auditados.
   (Ver "FAIL metodológico" abajo — el PASS tiene una reserva.)
3. **Front F1 completo (6/6, build y lint limpios, 11 archivos en `crm-v2/src/`)**:
   tanda fila-por-fila con el contrato nuevo (+ null-guard de deploy desfasado) · campana
   real con badge SOLO rojos y navegación por categoría (+ `/alertas?semaforo=`) · plantas
   CRUD con baja lógica y pickers filtrados · modal de tarifas con convención de conteo y
   cobra versionados (siempre versión nueva) · waiver en la ficha (3 números desde las views,
   nunca client-side) · corrección F-02 en la ficha (solo cerradas, sup+).

## AUDITORÍA INDEPENDIENTE (verifier ≠ constructor) — reglas de plata

| Punto | Resultado |
|---|---|
| El front no recalcula nada | **PASS** (grep completo; solo formateo de campos de views) |
| Tarifas versiona, no pisa | **PASS** (único call: `crm_nueva_version_freetime` con `p_convencion`/`p_cobra` en el MISMO call; `freetime_origin` solo `.select()`) |
| Cero escritura directa sobre tablas de plata | **PASS** (únicos write: `plantas`, la excepción sancionada de maestros) |
| Contratos RPC coinciden campo por campo | **PASS** (verificado contra `pg_get_functiondef` de PROD, no contra el enunciado) |
| Waiver: comportamiento real | **Documentado** (abajo — decisión tuya) |
| ¿El gate 020 probó lo que F-02 existe para hacer? | **FAIL metodológico** (abajo) |

### FAIL del punto 6 — y qué se hace con él

El caso del gate validó el recálculo **contra la aritmética del propio motor** (bruto +105 =
3×35), no contra un valor esperado independiente. Si la convención tuviera un off-by-one, el
bug estaría en ambos lados y el test pasaría igual. **Mitigante real:** la aritmética base está
anclada al Excel por el gate de F0 (2.804/2.804) — no está validada "contra sí misma" en el
sistema, pero SÍ lo estuvo este test puntual. **Correctivo comprometido:** la verificación
post-aplicación de la 020 usará un caso derivado de `tests/golden-costos.json` (valores
esperados pre-computados del Excel, independientes del motor). Los gates futuros heredan la regla.

## ⚠️ DECISIÓN PENDIENTE DE JOHN — waiver: ¿reemplaza o suma?

Comportamiento real hoy (auditado con evidencia, nadie lo decidió — es un efecto de la 019):

- La naviera autoriza 3 días, después 2 más → `crm_registrar_waiver` hace `SET waiver_dias = p_dias`:
  **resultado 2, no 5**.
- **El rastro NO se pierde**: cada registro emite evento `waiver` con `dias_anterior` en el
  detalle — el timeline tiene la historia completa; la tabla solo guarda el último.
- La UI avisa explícito: *"Esta operación ya tiene un waiver de X día(s) — el nuevo valor lo
  reemplaza (no se suma)."*

Opciones: (a) queda REEMPLAZA (el operario suma mentalmente y carga el total — simple, auditado,
ya avisado en UI) · (b) cambiar la RPC a acumular (suma automática, pero "corregir un waiver mal
cargado" pasa a necesitar otro camino). Si elegís (b), es DDL nuevo con su gate.

## PRESUPUESTO — desvío reportado

Autorizado 250k + 60k extra = 310k. **Consumido ≈ 492k (159%)**: verifier-020 99k ·
constructor 269k (el ciclo stop/resume re-cargó todo su contexto) · verifier-front **124k
contra 60k autorizados — no respetó su techo, debía parar y no paró**; el alcance acotado no
compensó que verificó 4 puntos contra prod + código fuente completo. Lección aplicada a futuros
prompts de agente: el guard de presupuesto va como STOP-CONDITION verificable al inicio de cada
paso, no como instrucción general.

## ESTADO / PRÓXIMO PASO (todo espera tu GO)

1. **GO → aplicar 020 a prod** (post-verificación con caso golden independiente, el correctivo de arriba).
2. **GO → deploy del front** (`cd crm-v2 && npx vercel deploy --prod --yes`) + tu smoke visual
   (la verificación visual NO está hecha — bloque sin deploy, declarado).
3. **Decisión waiver** (a/b de arriba).
4. Commits: todo el B1+B2 está en working tree sin commitear — propongo granular por feature
   (019 · goldens+snapshots · docs · 020 · front por ítem) cuando des el GO.

## RECORDATORIOS

- Sandbox `gate-019-sandbox` (`gnygffoynwtxpkehmxal`): borralo del Dashboard si aún no lo hiciste — factura ~USD 10/mes.
- ⚠️ **MOTOR↔NAVIERA sigue abierto**: falta cruzar UNA liquidación real de detention contra una
  operación cerrada del histórico. El Excel valida contra sí mismo.
