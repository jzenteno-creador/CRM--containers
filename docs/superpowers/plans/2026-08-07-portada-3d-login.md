# Portada 3D A4 → /login de crm-v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El `/login` de crm-v2 muestra la escena 3D A4 aprobada (contenedor COLOR1 + spreader, bajada de grúa, giro a la puerta al ingresar) con el login real de Supabase.

**Architecture:** Se monta la escena vanilla verificada (NO el port r3f): el módulo inline de `~/work/crm-3d/design/A4-realista.html` (fuente de LÓGICA, líneas 358–2593) se extrae a `container-scene.js` envuelto en `initContainerScene(opts)`; el harness WebP del preview (`~/work/crm-3d/ssb-login-preview/harness/createObjectModel.js`, fuente de ASSETS) se copia como `container-model.js`; las texturas WebP van a `public/3d/`. React (page.tsx) es dueño del form y del auth; la escena expone una API de 4 llamadas. Spec: `docs/superpowers/specs/2026-08-07-portada-3d-login-produccion-design.md`.

**Tech Stack:** Next.js 16.2.12 (App Router) · React 19 · three ^0.185.1 · Supabase auth · vitest · agent-browser (verificación visual — los MCP de browser están rotos en WSL).

## Global Constraints

- **AGENTS.md crm-v2:** "This is NOT the Next.js you know" — leer el doc relevante en `crm-v2/node_modules/next/dist/docs/01-app/` ANTES de escribir código de cada task que toque Next (los pasos lo citan).
- Código en inglés (variables/funciones), comentarios y UI en español. Sin `console.log` en producción (los `console.error` de fallo de textura del módulo A4 se quedan: son de error, no de debug).
- NO editar la lógica verificada: `SEQ`, `LAND`, `applyFraming()`, el gate de reveal, easings, materiales. La coreografía se MUEVE, no se edita. Las únicas adiciones permitidas al módulo son las enumeradas en Task 3.
- Fuente de lógica = `~/work/crm-3d/design/A4-realista.html` (proyecto). Fuente de assets = `~/work/crm-3d/ssb-login-preview/` (WebP + harness repunteado). NO usar `design/r3f-reference/` (nunca compiló) ni los PNG del proyecto.
- Rutas de texturas en crm-v2: prefijo `/3d/` (ej. `/3d/intake/pbr/...webp`). El preview usaba `<base href="/">` + rutas relativas; acá no hay `<base>`.
- Breakpoint mobile = **767px** (el `matchMedia('(max-width: 767px)')` que la escena YA usa — supersede el "760px" aproximado del spec).
- `/registro`, `/recuperar` y `AuthBrandPanel` NO se tocan.
- Deploy de crm-v2 es MANUAL (`npx vercel deploy --prod --yes` desde `crm-v2/`) y SOLO con confirmación de John (Task 7).
- Commits granulares: un commit por task, mensaje `feat(login3d): ...`.
- Working dir del repo: `/home/jzenteno/projects/Crm-containers` (rama `v2-rebuild`). `~/work/crm-3d` NO es repo de este proyecto — solo se lee.

---

### Task 1: Texturas en `public/3d/` + headers immutable

**Files:**
- Create: `crm-v2/public/3d/assets/**` y `crm-v2/public/3d/intake/**` (copiados del preview)
- Modify: `crm-v2/next.config.ts` (agregar entrada de headers para `/3d/:path*`)
- Test: `crm-v2/tests/login3d-assets.test.ts`

**Interfaces:**
- Produces: texturas servidas bajo `/3d/assets/...` y `/3d/intake/...` — Task 2 y 3 reescriben rutas contra ese prefijo. El logo de página NO va acá: se reusa `/logos/ssb-white.svg` (ya existe y el SW lo cachea).

- [ ] **Step 1: Copiar texturas (sin el svg) y verificar igualdad bit a bit**

```bash
cd /home/jzenteno/projects/Crm-containers/crm-v2
mkdir -p public/3d
cp -r ~/work/crm-3d/ssb-login-preview/assets public/3d/assets
cp -r ~/work/crm-3d/ssb-login-preview/intake public/3d/intake
rm public/3d/assets/ssb-white.svg   # el logo de página se sirve de /logos/, no de acá
diff -r ~/work/crm-3d/ssb-login-preview/assets public/3d/assets   # esperado: SOLO "Only in ...: ssb-white.svg"
diff -r ~/work/crm-3d/ssb-login-preview/intake public/3d/intake    # esperado: sin salida
find public/3d -name '*.webp' | wc -l                              # anotar N (esperado ~36: 11 en assets + 25 en intake)
```

- [ ] **Step 2: Test que fija el contrato de assets**

```ts
// crm-v2/tests/login3d-assets.test.ts
// Guardia de regresión del port 3D: si alguien regenera texturas en ~/work/crm-3d y
// copia mal, esto lo agarra antes que el browser.
import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "public", "3d");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("assets 3D del login", () => {
  it("las 8 texturas definitorias (TEX_QUE_DEFINEN + gate) existen", () => {
    const files = walk(ROOT).map((p) => p.replace(ROOT, ""));
    for (const name of [
      "side-wall-right_albedo_ssb", "side-wall-left_albedo_ssb",
      "door-leaf-right_albedo_ssb", "door-leaf-left_albedo_ssb",
      "paint-body-navy_albedo_brand", "decal-white_albedo_brand",
      "paint-accent-orange_albedo_brand", "csc-plate",
    ]) {
      expect(files.some((f) => f.includes(name) && f.endsWith(".webp")), name).toBe(true);
    }
  });
  it("todo es webp (nada de png a medio convertir)", () => {
    const rest = walk(ROOT).filter((f) => !f.endsWith(".webp"));
    expect(rest).toEqual([]);
  });
});
```

- [ ] **Step 3: Correr el test — debe pasar ya** (los archivos existen desde Step 1; este test es guardia, no TDD de código nuevo)

```bash
cd crm-v2 && npx vitest run tests/login3d-assets.test.ts
```

- [ ] **Step 4: Headers immutable en next.config.ts**

Leer antes: `crm-v2/node_modules/next/dist/docs/01-app/` — buscar el archivo de `headers` en api-reference de next-config (`grep -ril "async headers" node_modules/next/dist/docs/01-app | head -3`) y confirmar la firma vigente.

En `next.config.ts`, dentro del array que devuelve `headers()`, agregar ANTES de la entrada `source: "/:path*"` existente:

```ts
      {
        // Texturas de la portada 3D del login: contenido versionado por nombre de
        // archivo, se cachea para siempre — el ~1 MB se paga una vez por dispositivo.
        // (El SW no cachea /3d a propósito: su filosofía es solo estáticos de marca.)
        source: "/3d/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
```

- [ ] **Step 5: Verificar build + header servido**

```bash
cd crm-v2 && npx next build 2>&1 | tail -5    # esperado: build OK
npx next start -p 3199 &  sleep 4
curl -sI http://localhost:3199/3d/assets/decal/csc-plate.webp | grep -i "cache-control\|content-type"
# esperado: cache-control: public, max-age=31536000, immutable
kill %1
```

- [ ] **Step 6: Commit**

```bash
cd /home/jzenteno/projects/Crm-containers
git add crm-v2/public/3d crm-v2/next.config.ts crm-v2/tests/login3d-assets.test.ts
git commit -m "feat(login3d): texturas WebP de la portada A4 en /3d + cache immutable"
```

---

### Task 2: `container-model.js` — el harness del modelo, repunteado a `/3d/`

**Files:**
- Create: `crm-v2/src/components/auth/container-model.js` (copia del harness WebP del preview + rewrite de rutas)
- Modify: `crm-v2/package.json` (dep `three`), `crm-v2/eslint.config.mjs` (ignorar los dos .js vanilla)
- Test: `crm-v2/tests/login3d-paths.test.ts`

**Interfaces:**
- Produces (los 4 named exports que Task 3 importa, mismos nombres que en el preview):
  `createContainerModel(options)`, `applyContainerLighting(scene, opts)`, `createContainerContactShadow(opts)`, `configureContainerRenderer(renderer)`.

- [ ] **Step 1: Instalar three**

```bash
cd /home/jzenteno/projects/Crm-containers/crm-v2 && npm i three@^0.185.1
```

- [ ] **Step 2: Copiar el harness y reescribir rutas relativas → `/3d/`**

```bash
cp ~/work/crm-3d/ssb-login-preview/harness/createObjectModel.js src/components/auth/container-model.js
# Contar ANTES (para verificar después):
grep -oc '"intake/' src/components/auth/container-model.js   # anotar A
grep -oc '"assets/' src/components/auth/container-model.js   # anotar B
grep -oc '`intake/\|`assets/' src/components/auth/container-model.js || true  # anotar C (template literals)
sed -i 's|"intake/|"/3d/intake/|g; s|"assets/|"/3d/assets/|g; s|`intake/|`/3d/intake/|g; s|`assets/|`/3d/assets/|g' \
  src/components/auth/container-model.js
```

- [ ] **Step 3: Verificar el rewrite — cero rutas sin prefijo, mismas cantidades**

```bash
grep -c '"/3d/intake/\|"/3d/assets/' src/components/auth/container-model.js  # esperado: A+B
grep -n '"intake/\|"assets/\|`intake/\|`assets/' src/components/auth/container-model.js  # esperado: SIN salida
node --check src/components/auth/container-model.js   # sintaxis intacta
```

Nota: las strings `path` con ruta de filesystem (`/home/jzenteno/work/crm-3d/...`) quedan — son metadata muerta; `referenceMapUrl()` prefiere `url`. No tocarlas.

- [ ] **Step 4: eslint ignora los .js vanilla del port**

En `eslint.config.mjs`, dentro del `globalIgnores([...])` existente, agregar al final del array:

```js
    // Port 3D del login: módulos vanilla verificados en ~/work/crm-3d, se mueven, no se editan.
    "src/components/auth/container-model.js",
    "src/components/auth/container-scene.js",
```

- [ ] **Step 5: Test de rutas (cubre también a container-scene.js cuando exista)**

```ts
// crm-v2/tests/login3d-paths.test.ts
// Los módulos 3D solo pueden referenciar texturas bajo /3d/ — una ruta relativa
// "assets/..." resolvería contra /login y daría 404 silencioso (gate por timeout).
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(__dirname, "..", "src", "components", "auth");
const MODULES = ["container-model.js", "container-scene.js"].filter((f) =>
  existsSync(join(DIR, f)),
);

describe("rutas de texturas en los módulos 3D", () => {
  it.each(MODULES)("%s no referencia assets sin el prefijo /3d/", (file) => {
    const src = readFileSync(join(DIR, file), "utf8");
    // Solo miramos strings/templates que ARRANCAN el path (las rutas de filesystem
    // muertas en los campos `path` contienen /work/crm-3d/ y no matchean esto).
    const bad = src.match(/["'`](?:intake|assets)\//g) ?? [];
    expect(bad).toEqual([]);
  });
  it("container-model.js referencia /3d/", () => {
    const src = readFileSync(join(DIR, "container-model.js"), "utf8");
    expect(src.includes('"/3d/intake/')).toBe(true);
  });
});
```

- [ ] **Step 6: Correr tests + lint**

```bash
cd crm-v2 && npx vitest run tests/login3d-paths.test.ts && npx next lint 2>&1 | tail -3
```

- [ ] **Step 7: Commit**

```bash
cd /home/jzenteno/projects/Crm-containers
git add crm-v2/package.json crm-v2/package-lock.json crm-v2/src/components/auth/container-model.js \
  crm-v2/eslint.config.mjs crm-v2/tests/login3d-paths.test.ts
git commit -m "feat(login3d): harness del modelo (WebP, rutas /3d) + dep three"
```

---

### Task 3: `container-scene.js` — extracción del módulo A4 con API para React

La task quirúrgica. El módulo inline del proyecto (2.236 líneas) se envuelve en una función exportada; se le QUITA lo que era del demo (form, overlay final, tecla R) y se le AGREGAN exactamente 5 cosas: opts/callbacks, `playLoginSequence`, `setFocusZoom`, `fireFormReady` y `dispose`. Nada más cambia.

**Files:**
- Create: `crm-v2/src/components/auth/container-scene.js`, `crm-v2/src/components/auth/container-scene.d.ts`
- Test: `crm-v2/tests/login3d-paths.test.ts` (ya cubre este archivo) + `node --check`

**Interfaces:**
- Consumes: los 4 exports de `./container-model.js` (Task 2).
- Produces (contrato para Task 4/5 — el `.d.ts` de abajo es la firma exacta):
  `initContainerScene(opts) → Promise<ContainerSceneHandle>`; callbacks `onFormReady()` (una vez: posado completo tras reveal / reveal por timeout / reduced-motion) y `onSequenceEnd()` (una vez, en `SEQ.finalAt`).

- [ ] **Step 1: Extraer el módulo crudo**

```bash
cd /home/jzenteno/projects/Crm-containers/crm-v2
python3 - <<'PY'
import re
s = open('/home/jzenteno/work/crm-3d/design/A4-realista.html').read()
m = re.search(r'<script type="module">\n(.*?)\n</script>', s, re.S)
assert m, 'no encontré el módulo inline'
open('src/components/auth/container-scene.js', 'w').write(m.group(1))
print(len(m.group(1)), 'bytes')
PY
```

- [ ] **Step 2: Cirugía — aplicar estas ediciones en orden (buscar por ANCLA de texto, no por línea)**

**2a. Import del harness** — reemplazar:
```js
import { createContainerModel, applyContainerLighting, createContainerContactShadow, configureContainerRenderer }
  from '/harness/createObjectModel.js';
```
por:
```js
import { createContainerModel, applyContainerLighting, createContainerContactShadow, configureContainerRenderer }
  from './container-model.js';
```

**2b. Envolver TODO el resto del archivo** (desde el primer comentario después de los imports hasta el final) en:
```js
// Superficie de QA (__a4, __ready, __revealReason): solo fuera de producción.
// Cierra la deuda §7 del handoff de crm-3d ("sacar o gatear antes de prod").
const QA = process.env.NODE_ENV !== 'production';

export async function initContainerScene(opts) {
  const {
    canvas,                    // HTMLCanvasElement ya montado por React
    fadeEl,                    // div del fade a opaco (React lo posiciona)
    onFormReady = () => {},    // mobile: mostrar la card (posado listo / timeout / reduced)
    onSequenceEnd = () => {},  // navegación real (reemplaza al overlay "Repetir" del demo)
  } = opts;
  let disposed = false;
  let formReadyFired = false;
  function fireFormReady() {
    if (formReadyFired || disposed) return;
    formReadyFired = true;
    onFormReady();
  }
  // ... [todo el cuerpo original va acá, con las ediciones 2c–2m] ...
  return handle;  // ver 2m
}
```
La indentación del cuerpo NO se toca (JS no la exige y el diff contra el original queda legible).

**2c. Canvas parametrizado** — reemplazar:
```js
const canvas = document.getElementById('scene');
```
por:
```js
// canvas viene de opts (React es dueño del DOM)
```
(la variable `canvas` ya existe por el destructuring de opts).

**2d. Refs del form del demo** — BORRAR el bloque completo (ancla: comentario `// FORMULARIO (mockup, no postea a ningun lado)`):
- las 10 `const` de `getElementById` (`form`, `emailField`, `emailInput`, `passwordInput`, `submitBtn`, `forgotLink`, `loginMain`, `finalEl`, `replayBtn`) — **EXCEPTO `fadeEl`**, que se borra igual porque ahora viene de opts,
- `isValidEmail`, `validateEmail` y sus `addEventListener` (blur/input),
- el `for (const input of [emailInput, passwordInput])` del dolly por focus,
- `let loading = false;` y el `form.addEventListener('submit', ...)` entero,
- `forgotLink.addEventListener('click', ...)`.

En su lugar, dejar SOLO esto (reemplaza al efecto de focus y al submit del demo):
```js
// ---- API para React (reemplaza al form del demo) ----
// EFECTO 4 (dolly por focus en los inputs) ahora lo dispara React:
function setFocusZoom(on) {
  if (seqRunning) return;
  dollyTarget = on ? DOLLY_ZOOM : 1;
}
// El submit real vive en React (Supabase). Cuando la credencial YA fue aceptada,
// React llama esto. Si la grúa no terminó (login más rápido que la carga), se salta
// al estado posado: el giro necesita el contenedor apoyado, y el usuario que ya se
// autenticó no tiene por qué mirar la coreografía de entrada.
function playLoginSequence() {
  if (seqRunning || disposed) return;
  if (!revealed) revealNow('login');
  landT = LAND.total;
  landRunning = false;
  spreaderActive = false;
  spreader.visible = false;
  model.position.y = containerYAt(LAND.total);
  autoRotateEnabled = true;
  fireFormReady();
  startLoginSequence();
}
```
`startLoginSequence()` (la función original) NO se toca.

**2e. Overlay final → callback** — reemplazar la función `showFinalState()` completa por:
```js
// El "estado final" del demo era un overlay con Repetir; en producción es la
// navegación a /inicio. Dispara UNA vez, en SEQ.finalAt (3,40 s), con el fade opaco.
let sequenceEnded = false;
function showFinalState() {
  if (sequenceEnded || disposed) return;
  sequenceEnded = true;
  onSequenceEnd();
}
```
(el llamador en `updateSequence` — `if (!finalShown && seqT >= ...)` — queda intacto).

**2f. Reset del demo** — BORRAR enteros: `function resetAll() {...}`, `replayBtn.addEventListener('click', resetAll)` y el `window.addEventListener('keydown', ...)` de la tecla R.

**2g. Hook de posado (mobile)** — en `updateLand`, agregar los dos `fireFormReady()`:
```js
function updateLand(delta) {
  if (reduced()) {
    model.position.y = 0;
    landRunning = false;
    if (spreaderActive) {
      spreaderActive = false;
      spreader.visible = false;
    }
    autoRotateEnabled = true;
    fireFormReady();                       // reduced: acceso inmediato, sin show
    return;
  }
  if (landRunning) {
    landT += delta;
    if (landT >= LAND.total) {
      landT = LAND.total;
      landRunning = false;
      if (revealed) fireFormReady();       // posado completo Y visible → entra la card
    }
  }
  model.position.y = containerYAt(landT);
}
```
OJO: el `if (revealed)` importa — si la bajada corrió oculta antes del reveal, `revealNow` la resetea a cero y la card debe esperar la bajada VISIBLE.

**2h. Timeout de reveal también libera el form** — en `revealNow(motivo)`, agregar al final del cuerpo:
```js
  if (motivo === 'timeout') fireFormReady();  // red rota: el acceso no espera al show
```

**2i. QA gateado** — envolver en `if (QA) { ... }`: las asignaciones `window.__revealReason`/`window.__revealAt` (en `revealNow`), `window.__ready`/`window.__readyAt`, y la asignación `window.__a4 = {...}` completa al final del archivo.

**2j. Loop cancelable** — reemplazar:
```js
function animate(timestamp) {
  requestAnimationFrame(animate);
```
por:
```js
let rafId = 0;
function animate(timestamp) {
  if (disposed) return;
  rafId = requestAnimationFrame(animate);
```
y donde el loop arranca (`requestAnimationFrame(animate)` fuera de la función, tras `window.__ready`), reemplazar por `rafId = requestAnimationFrame(animate);`.

**2k. Guardas `disposed` en los dos polls asíncronos** — en el `tick()` del `texWait` y en el `check()` del gate de reveal, primera línea de cada uno:
```js
    if (disposed) return;
```
(en `tick` va como `if (disposed) return resolve('disposed');` para no colgar el await).

**2l. Listeners nombrados** (para poder removerlos) — el handler de pointermove pasa de anónimo a:
```js
const onPointerMove = (ev) => {
  pointerTargetX = (ev.clientX / window.innerWidth) * 2 - 1;
  pointerTargetY = (ev.clientY / window.innerHeight) * 2 - 1;
};
window.addEventListener('pointermove', onPointerMove);
```
(`resizeRendererAndCamera` y `applyFraming` ya tienen nombre; no tocar sus `addEventListener`).

**2m. Handle + dispose** — al final del cuerpo de la función (después del bloque `__a4`):
```js
  // ---- Handle para React. dispose() deja el navegador como si la escena nunca
  // hubiera existido: sin rAF, sin listeners, sin contexto WebGL (importa por el
  // doble-mount de StrictMode en dev y por la navegación SPA a /inicio).
  const handle = {
    playLoginSequence,
    setFocusZoom,
    state: () => ({ revealed, seqRunning, landRunning, tex: { ...texState } }),
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeRendererAndCamera);
      window.removeEventListener('pointermove', onPointerMove);
      mobileQuery.removeEventListener('change', applyFraming);
      THREE.DefaultLoadingManager.onStart = undefined;
      THREE.DefaultLoadingManager.onProgress = undefined;
      THREE.DefaultLoadingManager.onError = undefined;
      renderer.dispose();
      renderer.forceContextLoss();
      if (QA) delete window.__a4;
    },
  };
  return handle;
```

- [ ] **Step 3: El `.d.ts` (contrato tipado para los .tsx)**

```ts
// crm-v2/src/components/auth/container-scene.d.ts
// Firma pública de la escena A4. El .js es el módulo verificado de ~/work/crm-3d —
// se tipa acá afuera para no tocarlo.
export interface ContainerSceneHandle {
  /** Giro a la puerta + apertura + fade (3,30 s). Llamar SOLO con credencial aceptada. */
  playLoginSequence(): void;
  /** Dolly-in mientras un input del form tiene foco (efecto 4 de A4). */
  setFocusZoom(on: boolean): void;
  state(): { revealed: boolean; seqRunning: boolean; landRunning: boolean; tex: { total: number; loaded: number; errors: string[]; started: boolean } };
  dispose(): void;
}
export interface ContainerSceneOptions {
  canvas: HTMLCanvasElement;
  fadeEl: HTMLElement;
  /** Una sola vez: posado completo tras el reveal, reveal por timeout, o reduced-motion. */
  onFormReady?: () => void;
  /** Una sola vez, en SEQ.finalAt (3,40 s), con el fade ya opaco: navegar. */
  onSequenceEnd?: () => void;
}
export function initContainerScene(opts: ContainerSceneOptions): Promise<ContainerSceneHandle>;
```

- [ ] **Step 4: Verificar sintaxis, referencias muertas y rutas**

```bash
cd crm-v2
node --check src/components/auth/container-scene.js
# Cero referencias al DOM del demo que borré:
grep -n "getElementById\|finalEl\|replayBtn\|loginMain\|emailInput\|passwordInput\|submitBtn\|forgotLink\|resetAll" \
  src/components/auth/container-scene.js
# esperado: SIN salida (si aparece algo, quedó una referencia colgada de 2d/2f)
grep -c "fireFormReady()" src/components/auth/container-scene.js   # esperado: 5 (def + 2g×2 + 2h + 2d)
npx vitest run tests/login3d-paths.test.ts                          # ahora también valida este archivo
```
Si `node --check` falla: el error es de la cirugía — revisar la edición del ancla que nombre el error, NO parchear lógica del módulo.

- [ ] **Step 5: Commit**

```bash
cd /home/jzenteno/projects/Crm-containers
git add crm-v2/src/components/auth/container-scene.js crm-v2/src/components/auth/container-scene.d.ts
git commit -m "feat(login3d): escena A4 extraída con API para React (init/play/dispose)"
```

---

### Task 4: `container-canvas.tsx` — el puente React ↔ escena

**Files:**
- Create: `crm-v2/src/components/auth/container-canvas.tsx`

**Interfaces:**
- Consumes: `initContainerScene`, `ContainerSceneHandle` (Task 3).
- Produces: `<ContainerCanvas onReady={(h) => ...} onFormReady={...} onSequenceEnd={...} />` — Task 5 guarda el handle en un ref y llama `playLoginSequence()`/`setFocusZoom()`.

- [ ] **Step 1: Leer los docs de Next 16 sobre client components + dynamic import** (`ls node_modules/next/dist/docs/01-app/` y el archivo de lazy-loading; confirmar que un `import()` dinámico dentro de `useEffect` code-splitea — es el mecanismo elegido: la escena no es un componente, `next/dynamic` no aplica).

- [ ] **Step 2: Escribir el componente**

```tsx
// crm-v2/src/components/auth/container-canvas.tsx
"use client";

// Puente React ↔ escena A4 (vanilla three, verificada en ~/work/crm-3d). React es dueño
// del DOM (canvas + fade) y del ciclo de vida; la escena es dueña de TODO lo demás.
// El import() dinámico corta el chunk: three + modelo (~600 KB min) solo bajan en /login.

import { useEffect, useRef } from "react";
import type { ContainerSceneHandle } from "./container-scene";

type Props = {
  onReady: (handle: ContainerSceneHandle) => void;
  onFormReady: () => void;
  onSequenceEnd: () => void;
  /** La escena no pudo ni cargar (chunk caído, WebGL negado): el login sigue sin 3D. */
  onSceneError: () => void;
};

export function ContainerCanvas({ onReady, onFormReady, onSequenceEnd, onSceneError }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  // Los callbacks viven en refs para que el effect corra UNA vez (StrictMode-safe)
  // sin re-inicializar la escena cuando el padre re-renderiza.
  const cbRef = useRef({ onReady, onFormReady, onSequenceEnd, onSceneError });
  cbRef.current = { onReady, onFormReady, onSequenceEnd, onSceneError };

  useEffect(() => {
    let disposed = false;
    let handle: ContainerSceneHandle | null = null;
    (async () => {
      try {
        const { initContainerScene } = await import("./container-scene");
        if (disposed || !canvasRef.current || !fadeRef.current) return;
        handle = await initContainerScene({
          canvas: canvasRef.current,
          fadeEl: fadeRef.current,
          onFormReady: () => cbRef.current.onFormReady(),
          onSequenceEnd: () => cbRef.current.onSequenceEnd(),
        });
        if (disposed) {
          handle.dispose();
          return;
        }
        cbRef.current.onReady(handle);
      } catch {
        // Sin escena no hay show, pero el login no puede depender del show.
        if (!disposed) cbRef.current.onSceneError();
      }
    })();
    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, []);

  return (
    <>
      <canvas id="scene" ref={canvasRef} aria-hidden="true" />
      <div id="fade" ref={fadeRef} aria-hidden="true" />
    </>
  );
}
```
(Los ids `scene`/`fade` se conservan solo porque el CSS copiado de A4 los estilea; el módulo ya no los busca por id.)

- [ ] **Step 3: Typecheck**

```bash
cd crm-v2 && npx tsc --noEmit 2>&1 | head -20   # esperado: sin errores nuevos
```

- [ ] **Step 4: Commit**

```bash
cd /home/jzenteno/projects/Crm-containers
git add crm-v2/src/components/auth/container-canvas.tsx
git commit -m "feat(login3d): puente React↔escena con ciclo de vida y fallback sin 3D"
```

---

### Task 5: `/login` — página nueva con la card A4 + auth real + CSS

**Files:**
- Create: `crm-v2/src/app/login/login3d.css`
- Modify: `crm-v2/src/app/login/page.tsx` (reescritura completa, abajo)

**Interfaces:**
- Consumes: `ContainerCanvas` (Task 4), `getSupabase`/`useSession` (existentes), clases CSS de A4.
- Produces: la página final. El `<form>` DEBE llevar `className="login-card"` — `applyFraming()` la mide por `querySelector('.login-card')` para la garantía anti-superposición (fix de Jorge).

- [ ] **Step 1: Leer los docs de Next 16 sobre CSS global en App Router** (confirmar que un `.css` plano importado desde un page client-side es válido y su alcance; si el doc exige otra cosa, adaptar la importación, NO convertir a CSS module — los hashes romperían `querySelector('.login-card')`).

- [ ] **Step 2: Extraer y adaptar el CSS de A4**

```bash
cd /home/jzenteno/projects/Crm-containers/crm-v2
sed -n '22,321p' ~/work/crm-3d/design/A4-realista.html > src/app/login/login3d.css
```
Transformaciones (a mano, verificando cada una):
1. **Scope total**: todo selector se prefija con `.login3d ` (`.login-card` → `.login3d .login-card`, `input` → `.login3d input`, `label` → `.login3d label`, etc. — dentro de los `@media`/`@supports` también). Regla de oro del CLAUDE.md global: clases genéricas sin namespace ya costaron un bug real (`.ok` del freetime).
2. `:root { ... }` → `.login3d { ... }` (las custom properties quedan scopeadas).
3. `* { ... }` → `.login3d, .login3d * { ... }`.
4. `html, body { ... }` → `.login3d { position: fixed; inset: 0; overflow: hidden; }` conservando SOLO background/color/font del original (el `height:100%` de html/body no aplica a un wrapper fixed).
5. BORRAR los bloques de `#final`, `#final[hidden]`, `#final.visible`, `#final .logo-final`, `#replay`, `#replay:hover`, `#replay:focus-visible` (el overlay del demo no existe más).
6. AGREGAR al final:
```css
/* ---- Port a crm-v2: lo que A4 no tenía ---- */
/* Error de autenticación (Supabase) a nivel card — mismo lenguaje visual que .error-text */
.login3d .form-error {
  font-size: 12.5px;
  line-height: 1.45;
  color: #f0a8a0;
  margin: 2px 0 0;
}
/* Link secundario "Crear cuenta" junto al de contraseña */
.login3d .card-links {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
}
/* Mobile (decisión de John 2026-08-07): primero el contenedor, la card entra al posarse.
   767px = el mismo matchMedia que ya usa la escena. Solo la card se oculta: el logo
   queda desde el primer paint. Sin transition inicial → sin flash antes de hidratar. */
@media (max-width: 767px) {
  .login3d:not(.form-ready) .login-card {
    opacity: 0;
    transform: translateY(14px);
    pointer-events: none;
  }
  .login3d.form-ready .login-card {
    transition: opacity 0.45s ease, transform 0.45s ease;
  }
}
@media (prefers-reduced-motion: reduce) {
  .login3d.form-ready .login-card { transition: none; }
}
```

- [ ] **Step 3: Reescribir `page.tsx`**

Antes: leer `~/work/crm-3d/design/A4-realista.html` líneas 324–356 (el `<body>`) y calcar el markup del header/logo y la card (textos de labels incluidos). El esqueleto completo — la lógica Supabase es LA MISMA que la página actual, solo cambia la cáscara:

```tsx
"use client";

// Login con la portada 3D A4 (spec docs/superpowers/specs/2026-08-07-...-design.md).
// La escena es cosmética: el form es usable desde el primer paint (desktop) y el error
// de credenciales sale a los ~0,5 s como siempre. La secuencia SOLO corre con la
// credencial ya aceptada; al terminar (fade opaco) se navega a /inicio ya prefetcheado.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import type { AuthError } from "@supabase/supabase-js";
import type { ContainerSceneHandle } from "@/components/auth/container-scene";
import { ContainerCanvas } from "@/components/auth/container-canvas";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import "./login3d.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Las 8 texturas que definen el dibujo (TEX_QUE_DEFINEN de la escena): precargarlas
// adelanta el reveal — mismo rol que los <link rel="preload"> del preview.
const PRELOAD_TEXTURES = [
  "/3d/assets/pbr/side-wall-right_albedo_ssb.webp",
  "/3d/assets/pbr/side-wall-left_albedo_ssb.webp",
  "/3d/assets/pbr/paint-body-navy_albedo_brand.webp",
  "/3d/assets/pbr/decal-white_albedo_brand.webp",
  "/3d/assets/pbr/paint-accent-orange_albedo_brand.webp",
  "/3d/assets/pbr/door-leaf-left_albedo_ssb.webp",
  "/3d/assets/pbr/door-leaf-right_albedo_ssb.webp",
  "/3d/assets/decal/csc-plate.webp",
];

function loginErrorMessage(error: AuthError): string {
  if (error.code === "invalid_credentials") return "Correo o contraseña incorrectos.";
  if (error.code === "email_not_confirmed") {
    return "Tu correo todavía no está confirmado. Buscá el mail de confirmación (revisá spam) y tocá el link antes de ingresar.";
  }
  if (error.code === "over_request_rate_limit") return "Demasiados intentos. Esperá un momento y volvé a probar.";
  if (/failed to fetch|networkerror|load failed/i.test(error.message)) {
    return "No hay conexión con el servidor. Verificá tu red y reintentá.";
  }
  return `No se pudo iniciar sesión: ${error.message}`;
}

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const sceneRef = useRef<ContainerSceneHandle | null>(null);
  const [sceneDown, setSceneDown] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  for (const href of PRELOAD_TEXTURES) preload(href, { as: "image", type: "image/webp" });

  // Ya logueado → afuera (el gate resuelve espera vs app); y /inicio se precalienta
  // para que la navegación al final del fade sea instantánea.
  useEffect(() => {
    if (status === "signedIn") router.replace("/inicio");
  }, [status, router]);
  useEffect(() => {
    router.prefetch("/inicio");
  }, [router]);

  // form-ready: en desktop desde el primer frame; en mobile lo dispara la escena
  // (posado / timeout / reduced). Red de seguridad: 16 s pase lo que pase — el techo
  // de reveal de la escena es 15 s, esto solo cubre un chunk que nunca llegó.
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setFormReady(true);
    const t = window.setTimeout(() => setFormReady(true), 16000);
    return () => window.clearTimeout(t);
  }, []);

  const goInicio = useCallback(() => router.replace("/inicio"), [router]);

  const emailError =
    (touched.email || submitted) && email.trim() === ""
      ? "Ingresá tu correo."
      : (touched.email || submitted) && !EMAIL_RE.test(email.trim())
        ? "Ingresá un correo con formato válido (debe incluir @)."
        : null;
  const passwordError = (touched.password || submitted) && password === "" ? "Ingresá tu contraseña." : null;
  const valid = EMAIL_RE.test(email.trim()) && password !== "";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid || submitting) return;
    setSubmitting(true);
    setAuthError(null);
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setAuthError(loginErrorMessage(error));
      setSubmitting(false);
      return;
    }
    // Credencial aceptada: la secuencia ES la transición (3,30 s, fade a opaco y
    // onSequenceEnd navega). submitting queda true: bloquea el doble-submit.
    if (sceneRef.current && !sceneDown) {
      sceneRef.current.playLoginSequence();
    } else {
      goInicio(); // sin escena no hay show, pero el login jamás depende del show
    }
  };

  return (
    <div className={`login3d${formReady ? " form-ready" : ""}`}>
      {!sceneDown && (
        <ContainerCanvas
          onReady={(h) => {
            sceneRef.current = h;
          }}
          onFormReady={() => setFormReady(true)}
          onSequenceEnd={goInicio}
          onSceneError={() => {
            setSceneDown(true);
            setFormReady(true);
          }}
        />
      )}
      <div id="scrim" aria-hidden="true" />
      <main className="login-col" id="login-main">
        {/* [CALCAR de A4 líneas 324–356: header con logo /logos/ssb-white.svg, headline y sub] */}
        <form className="login-card" id="login-form" noValidate onSubmit={onSubmit}>
          <div className={`field${emailError ? " has-error" : ""}`}>
            <label htmlFor="email">{/* texto del label de A4 */}</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="nombre@ssbint.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => sceneRef.current?.setFocusZoom(true)}
              onBlur={() => {
                sceneRef.current?.setFocusZoom(false);
                setTouched((t) => ({ ...t, email: true }));
              }}
            />
            {emailError && <span className="error-text">{emailError}</span>}
          </div>
          <div className={`field${passwordError ? " has-error" : ""}`}>
            <label htmlFor="password">{/* texto del label de A4 */}</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => sceneRef.current?.setFocusZoom(true)}
              onBlur={() => {
                sceneRef.current?.setFocusZoom(false);
                setTouched((t) => ({ ...t, password: true }));
              }}
            />
            {passwordError && <span className="error-text">{passwordError}</span>}
          </div>
          {authError && <p className="form-error" role="alert">{authError}</p>}
          <button type="submit" className={`btn-primary${submitting ? " loading" : ""}`} disabled={submitting} aria-busy={submitting}>
            <span className="btn-label">Ingresar</span>
            <span className="btn-spinner" aria-hidden="true"><i /><i /><i /></span>
          </button>
          <div className="card-links">
            <Link href="/recuperar" className="forgot-link">¿Olvidaste tu contraseña?</Link>
            <Link href="/registro" className="forgot-link">Crear cuenta</Link>
          </div>
        </form>
      </main>
    </div>
  );
}
```
Los dos `{/* texto del label de A4 */}` y el header comentado se completan CALCANDO el body de A4 en este mismo step (es contenido de marca aprobado; no inventar copy). El markup del spinner (`<i/>×3`) debe coincidir con lo que el CSS de A4 estilea (`.btn-spinner i:nth-child(...)`) — verificar contra el CSS extraído y ajustar la cantidad de `<i>` si difiere.

- [ ] **Step 4: Typecheck + build + tests + lint**

```bash
cd crm-v2 && npx tsc --noEmit && npx next build 2>&1 | tail -5 && npx vitest run && npx next lint 2>&1 | tail -3
```

- [ ] **Step 5: Humo manual en dev** — `npx next dev`, abrir `http://localhost:3000/login`: canvas renderiza, bajada de grúa corre, form usable, error de credencial falsa sale en la card. (La verificación medida es Task 6 — esto solo confirma que no está roto de cuajo.)

- [ ] **Step 6: Commit**

```bash
cd /home/jzenteno/projects/Crm-containers
git add crm-v2/src/app/login/page.tsx crm-v2/src/app/login/login3d.css
git commit -m "feat(login3d): /login con la portada A4 — auth real, mobile container-first"
```

---

### Task 6: Verificación medida (agent-browser)

**Files:**
- Create: scripts efímeros en el scratchpad de la sesión (no se commitean)
- Modify: lo que las verificaciones obliguen a corregir (cada fix con su commit)

**Interfaces:**
- Consumes: `window.__a4` (vivo en dev: `NODE_ENV !== 'production'`), `npx next dev`, y el preview local como referencia visual (`cd ~/work/crm-3d/ssb-login-preview && python3 -m http.server 8378`).

Usar la skill `agent-browser`. Correr `npx next dev` en background. Para cada punto, guardar la evidencia cruda (números, no adjetivos):

- [ ] **6.1 Carga limpia (1600×950):** `network`: todas las texturas `/3d/...` en 200, 0 requests a `/assets/` o `/intake/` sin prefijo, 0 errores de consola. `__a4`/`__revealReason` reporta reveal por `texturas`.
- [ ] **6.2 Pixel-compare vs la vitrina aprobada:** screenshot del estado de reposo en `http://localhost:3000/login` y en `http://localhost:8378/` (mismo viewport 1600×950, esperar reveal + posado en ambos). Diff con PIL enmascarando el bbox de `.login-card` (la card tiene un link más — "Crear cuenta" — y es diferencia esperada; medir su bbox por `getBoundingClientRect` vía eval). Fuera de la máscara: **≤0,01% de píxeles con diferencia visible (>6/255)** — el mismo umbral de las rondas de crm-3d.
- [ ] **6.3 Fix de Jorge sigue en pie:** barrido de yaw 0→357° de a 3° por eval (`__a4` expone freeze/seek), proyectando el bbox del contenedor en NDC contra el borde real de la card de React. En 1600×950 y 1366×768: `peor izquierda > borde de card` en TODOS los ángulos.
- [ ] **6.4 Secuencia + navegación real:** credenciales demo del CRM (memoria: DB `cctuowthpnstvdgjuomq`) — submit correcto → `seqRunning=true`, fade llega a opacidad 1, y la URL termina en `/inicio` (con sesión persistida). Cronometrar submit→navegación: **3,3–3,6 s** esperado.
- [ ] **6.5 Credencial mala:** error visible en la card en <1,5 s, `seqRunning=false` (la escena NI se enteró), el form sigue editable.
- [ ] **6.6 Mobile 390×844:** al cargar, card invisible (`opacity 0`), la bajada corre completa SIN card encima; al posarse (`landRunning=false` + revealed) la card entra con su transición. Login completo funciona igual que en desktop.
- [ ] **6.7 reduced-motion:** con `prefers-reduced-motion: reduce` emulado — sin grúa, contenedor apoyado, card visible de inmediato (mobile incluido), submit correcto → fade directo → `/inicio`.
- [ ] **6.8 dispose:** navegar `/login → /registro → /login` (SPA). Sin errores de consola, sin warning de múltiples contextos WebGL, la 2ª visita renderiza bien. `/registro` se ve como siempre (el CSS scopeado no lo tocó).
- [ ] **6.9 Suite fría completa:** `npx tsc --noEmit && npx next build && npx vitest run && npx next lint` — todo verde.
- [ ] **6.10 Commit de los fixes que hayan salido** (`fix(login3d): ...` con el número del punto que falló). Si no hubo fixes, no hay commit.

---

### Task 7: Cierre — gate humano, deploy manual y baja de la vitrina

**Files:**
- Modify: `SESSION_HANDOFF.md` (estado + evidencia de Task 6)

- [ ] **Step 1: Reporte a John con la evidencia de Task 6** y el pedido explícito del smoke que solo él puede hacer: **fluidez a 60 fps en hardware real** (el headless corre sobre SwiftShader — nunca midió framerate) + mirada en su S25.
- [ ] **Step 2: SOLO con el OK de John — deploy manual:**

```bash
cd /home/jzenteno/projects/Crm-containers/crm-v2 && npx -y vercel@latest deploy --prod --yes
```

- [ ] **Step 3: Smoke en prod** (crm-detention.vercel.app/login): login real, secuencia, navegación, headers de `/3d/` con `immutable`.
- [ ] **Step 4: Con prod verificado — baja de la vitrina** (decisión ya tomada por John): borrar el proyecto Vercel `ssb-login-preview` (cuenta jzenteno-9227) vía dashboard o `npx vercel remove ssb-login-preview --yes`. Anotar en `~/work/crm-3d/SESSION_HANDOFF.md` y `README.md`: **la fuente de verdad de la escena del login ahora es `crm-v2/src/components/auth/`** — crm-3d queda como laboratorio del modelo/texturas.
- [ ] **Step 5: Handoff + commit final** (`docs(handoff): portada 3D en producción`).

---

## Self-review (hecho al escribir el plan)

- **Cobertura del spec:** destino /login (T5) · conexión lenta igual a la vitrina — gate intacto (T3 no toca reveal salvo los 2 hooks aditivos) · secuencia completa + prefetch (T5) · mobile container-first (T3 2g/2h + T5 CSS) · gobernanza y vitrina (T7) · `__a4` gateado (T3 2i) · sin tecla R ni overlay (T3 2e/2f) · headers immutable (T1) · riesgo Next 16 (steps de lectura de docs en T1/T4/T5).
- **Sin placeholders:** los dos huecos deliberados de T5 (labels/header de A4) tienen instrucción de calco con fuente y línea exactas — son contenido de marca a copiar, no lógica a inventar.
- **Consistencia de tipos:** `ContainerSceneHandle`/`ContainerSceneOptions` idénticos en T3 (.d.ts), T4 (import) y T5 (uso). `fireFormReady` aparece 5 veces: definición + 2g×2 + 2h + 2d (playLoginSequence) — el grep de T3 Step 4 lo verifica.
