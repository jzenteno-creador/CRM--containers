# Handoff de sesión — 2026-08-07 · CRM Detention v2 · rama v2-rebuild

## Resumen

Una sesión, un objetivo: **pasar la portada 3D del login (A4) de la vitrina a producción**.
El trabajo NO fue un deploy sino un **port**: lo publicado en `ssb-login-preview.vercel.app`
era una copia estática autosuficiente (HTML + bundle de bun); el `/login` real es Next 16 +
React 19. Se portó, se verificó contra la vitrina píxel a píxel, y John lo smoke-testeó con
su usuario real. **Falta el deploy a prod** (ver "Lo que sigue").

Documentos: spec `docs/superpowers/specs/2026-08-07-portada-3d-login-produccion-design.md`,
plan `docs/superpowers/plans/2026-08-07-portada-3d-login.md`.

## Decisiones de John (todas explícitas, esta sesión)

1. **Destino:** el `/login` real del CRM. No una vitrina con dominio propio.
2. **Conexión lenta:** igual que la vitrina — el gate espera las 41 texturas (techo 15 s).
   Sin rama "apoyado si viene lento". El form es usable desde el primer paint igual.
3. **Login exitoso:** secuencia completa siempre (giro + puertas + fade, 3,30 s).
4. **Mobile:** primero el contenedor, después el formulario. La card espera al posado.
   Esto además elimina el defecto viejo de "el contenedor queda tapado por la card" en 390×844.
5. **Gobernanza:** terminado el port, la escena del login se edita SOLO en `crm-v2`.
   `~/work/crm-3d` queda como laboratorio del modelo y las texturas (los `sculpt_*.py`).
6. **Vitrina:** `ssb-login-preview` se da de baja cuando prod esté verificado.

## Lo que se construyó (7 commits, todos en v2-rebuild)

| Commit | Qué |
|---|---|
| `8322e43` | spec del diseño |
| `c6aa497` | plan de implementación (7 tasks) |
| `854063e` | 31 texturas WebP en `crm-v2/public/3d/` + `Cache-Control: immutable` en next.config.ts |
| `5311c61` | `container-model.js` (harness WebP repunteado a `/3d/`) + dep `three@^0.185.1` |
| `5907128` | `container-scene.js`: el módulo A4 extraído con API para React |
| `61be357` | `container-canvas.tsx`: puente React↔escena, StrictMode-safe, fallback sin 3D |
| `7c72a91` | `/login` con la card A4 + `login3d.css` scopeado + mobile container-first |
| `f7f1fcb` | **fix del bug que encontró John** (ver abajo) |

**Enfoque elegido y por qué importa:** se montó la escena **vanilla ya verificada**, NO se
usó `design/r3f-reference/` (el port a React Three Fiber que nunca compiló ni corrió).
Portar a r3f era reescribir la parte más medida del trabajo — el encuadre resuelto contra
el cilindro de rotación (fix de Jorge), el gate de las 41 texturas y el arranque en frío.
Se movieron de lugar, no se editaron.

**Dato que abarató todo:** `applyFraming()` no tiene el encuadre hardcodeado, MIDE la card
real (`document.querySelector('.login-card').getBoundingClientRect()`, línea 1447 del A4
original). Con la card de React —que tiene un link más— la garantía anti-superposición se
recalcula sola. Por eso el `<form>` DEBE conservar la clase `.login-card`.

**Se sacó lo que era del demo:** overlay `#final` con botón Repetir (→ navegación real),
tecla R (en prod resetear el login con una tecla es un bug), `setTimeout(900)` que simulaba
el login (→ `signInWithPassword` real), y `window.__a4` quedó gateado a
`NODE_ENV !== 'production'` — eso cierra la deuda §7 del handoff de crm-3d.

## El bug que encontró John (y que la verificación automática NO podía encontrar)

**Síntoma:** "veo bien la animación, lo que no veo es la animación de apertura de puertas."

**Causa:** el login exitoso también flipea `status` a `signedIn` vía `onAuthStateChange`.
El efecto "ya logueado → afuera del login" (que existe para rebotar a quien llega a /login
con sesión viva) desmontaba la página a ~0,5 s de secuencia. El giro (0→1,25 s) alcanzaba
a verse; las puertas, que arrancan a 1,15 s, nunca.

**Por qué no lo agarró la verificación:** el branch de credencial VÁLIDA fue el único que no
se pudo ejecutar — el clasificador bloqueó (bien) crear un usuario sintético en `auth.users`
de prod, así que la secuencia se probó por inyección QA, que no dispara `onAuthStateChange`.
**Lección: un branch verificado por inyección no es un branch verificado.**

**Fix (`f7f1fcb`):** `seqStartedRef` levantado ANTES del await (el orden de emisión del
SIGNED_IN respecto de la continuación no está garantizado) y bajado si el login falla. Con
secuencia en vuelo navega `onSequenceEnd`, no el efecto. El rebote de "llego ya logueado"
sigue intacto.

## Verificación (agent-browser; los MCP de browser siguen rotos en WSL)

- **Pixel-compare vs la vitrina aprobada, 1600×950, ambas congeladas en el mismo instante:
  escena 3D 0,0000% de diferencia, máximo 0/255.** La única diferencia está en la columna
  de texto (~7 px de corrimiento) por el link "Crear cuenta" que la vitrina no tenía.
- **Fix de Jorge revalidado contra la card de React**, barriendo 360° de a 3° y proyectando
  las 8 esquinas reales: 1600×950 card −0,330 / peor izq **−0,298** / der 0,968 · 1366×768
  card −0,243 / **−0,218** / 0,972. Idénticos a los registrados en crm-3d.
- Carga: reveal por `texturas`, 41/41, 0 errores de consola, 282 requests a `/3d` todos 200,
  cero requests a rutas sin prefijo.
- Credencial mala: error real de Supabase en la card, `seqRunning=false` (la escena ni se
  entera), form editable.
- Mobile 390×844: card en `opacity 0` → bajada completa → card entra al posarse.
  Reduced-motion: contenedor apoyado, form inmediato.
- dispose: `/login → /registro → /login` sin errores, canvas desmontado, `__a4` borrado,
  remount limpio. `/registro` intacto (el CSS scopeado no lo toca).
- Build de prod en frío: **consola vacía**, `__a4`/`__ready` ausentes.
- Suite: `tsc --noEmit` ✓ · `next build` ✓ · **106 tests** ✓ · `eslint` ✓.

**Falso positivo descartado:** 13 warnings de THREE ("Texture marked for update but no image
data found") en la primerísima carga. Irreproducible en frío, en caliente y en build de prod
— artefacto del compile on-demand de `next dev`. No es del port.

## Lo que sigue — PENDIENTES ABIERTOS

### P1 · Deploy a producción (bloqueado solo por el OK de John)

```bash
cd /home/jzenteno/projects/Crm-containers/crm-v2 && npx -y vercel@latest deploy --prod --yes
```
NO auto-deploya en push. Después: smoke en `crm-detention.vercel.app/login` y **baja de la
vitrina** (`npx vercel remove ssb-login-preview --yes`, decisión ya tomada por John).

### P2 · Latencia y fluidez de la bajada (pedido de John, 2026-08-07)

John, mirando el smoke con su usuario real: *"hay que mejorar la latencia, se ve un poco
trabada la bajada"*. Es lo que quedó explícitamente SIN verificar en todas las rondas: el
headless corre sobre SwiftShader a ~0,24× de tiempo real, así que el framerate nunca se
midió en hardware de verdad. Puntos de partida medidos esta sesión (dev, SwiftShader):
**196 draw calls / 30.614 triángulos**, shadow map con `radius 2.2`.

Sospechosos a ordenar por costo antes de tocar nada:
- el shadow pass (la key proyecta y el contenedor recibe: es el 80% del realismo, pero
  también el grueso del costo por frame — `__a4.debug.setShadows(false)` y
  `__a4.debug.benchFrame(30)` dan el número exacto en el hardware de John, en un toggle);
- `pixelRatio` está en `min(devicePixelRatio, 2)`: en una pantalla retina son 4× los píxeles;
- los ~750 KB de red compitiendo con el primer tramo de la animación.

**Medir primero en la máquina de John, no en el headless.** Ese es el punto entero.

### P3 · Artefacto de render en el tope de la puerta (pedido de John, 2026-08-07)

John: *"un fix de render en la parte superior de la puerta, entre la puerta y el gancho que
baja al contenedor"*. **Caracterizado y medido esta sesión** (evidencia: la geometría, no la
impresión):

| Pieza | Holgura al techo (y = 2,916) | x |
|---|---|---|
| `spreader-end-beam` / `spreader-end-edge` | **24 mm** | 5,78 → **6,24** |
| `spreader-twistlock-boss` | **4 mm** | 5,86 → 6,16 |
| pins (los `Mesh` finos) | −25 / −67 / −97 mm | 5,98 → 6,03 |

Dos hallazgos, los dos en esa zona exacta:

1. **La viga de extremo SOBRESALE 135 mm de la cara de puertas** (llega a x = 6,24; el
   contenedor termina en x = 6,105). Se ve como un voladizo amarillo flotando más allá de
   la silueta del contenedor, justo arriba de la puerta.
2. **24 mm de holgura viga↔techo, y 4 mm en el twistlock-boss**, con
   `shadowBias −0,0001 / normalBias 0,006 / radius 2,2`. A esa distancia es exactamente
   donde aparecen shadow acne / peter-panning y costuras de precisión de z.

Los pins con holgura negativa **NO son el bug**: entran en los esquineros a propósito.

**Primer paso para la próxima sesión (un solo toggle discrimina entre las dos hipótesis):**
`window.__a4.debug.setShadows(false)` — si la costura oscura desaparece, es el shadow map
(se ataca con bias/normalBias); si sigue ahí, es z-fighting de geometría y se ataca subiendo
la viga o recortando el voladizo. La superficie de QA ya existe, no hay que instrumentar nada.
Screenshots de referencia quedaron en el scratchpad de la sesión (efímero: recapturar con
`__a4.seekLand(3.35)` + freeze, que es el instante exacto).

### P4 · Mobile: composición heredada

En 390×844 el contenedor sigue viniendo de la composición de A-nocturna. El pedido de John
(bajada primero, form después) está resuelto y eso tapó el síntoma peor, pero la composición
mobile en sí nunca se diseñó. Decisión de diseño aparte, no es un bug.

## Estado del árbol

Rama `v2-rebuild`, 8 commits nuevos, working tree limpia salvo los untracked de `docs/`
que ya venían de antes (PDFs de marca, foto del spreader, transcripción de Nara).
