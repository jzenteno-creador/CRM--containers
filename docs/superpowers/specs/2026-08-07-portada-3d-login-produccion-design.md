# Portada 3D en el /login de producción — diseño

**Fecha:** 2026-08-07 · **Aprobado por John en sesión** (4 decisiones explícitas abajo)

## Objetivo

Reemplazar el `AuthBrandPanel` del `/login` de crm-v2 por la escena 3D A4 (contenedor
COLOR1 + spreader amarillo, bajada de grúa, giro a la puerta al ingresar) aprobada en
`ssb-login-preview.vercel.app` el 2026-08-06.

## Decisiones de John (2026-08-07)

1. **Destino:** el `/login` real del CRM (crm-detention.vercel.app), no la vitrina.
2. **Conexión lenta:** igual que la vitrina — el reveal espera las 41 texturas (techo
   15 s), sin rama "apoyado si viene lento". El form y el logo pintan en el primer paint
   y el login es usable siempre; lo que se demora es el show, no el acceso.
3. **Login exitoso:** secuencia completa siempre (giro 1,25 s + puertas + fade = 3,30 s).
   Mitigación: `router.prefetch('/inicio')` al montar el login y `router.replace()` recién
   al terminar el fade — la navegación es instantánea con la pantalla ya tapada.
   (NO disparar el replace al arrancar el fade: desmonta el login y corta el fade a mitad.)
4. **Mobile (≤760px, el breakpoint donde hoy `.login-brand` desaparece):** la escena ocupa
   el viewport y **el contenedor se muestra primero**: bajada de grúa completa sin la card
   encima (esto elimina el defecto "contenedor tapado por la card" medido en 390×844).
   El formulario aparece (fade + rise) cuando termina el posado; inmediato si
   `prefers-reduced-motion` o si el reveal salió por `timeout`.
5. **Gobernanza:** terminado el port, la escena del login se edita SOLO en crm-v2.
   `~/work/crm-3d` queda como laboratorio del modelo/texturas (los sculpt_*.py); si se
   regeneran assets, se copian a crm-v2.
6. **Vitrina:** `ssb-login-preview.vercel.app` se da de baja una vez verificado el login
   real en producción.

## Enfoque elegido: montar la escena vanilla verificada

De las tres opciones evaluadas gana la 1:

1. ✅ **Extraer el módulo inline de `~/work/crm-3d/design/A4-realista.html` a un `.ts` y
   montarlo desde React.** Es el mismo código que John aprobó mirando; conserva las tres
   piezas caras y medidas: `applyFraming()` (fix de Jorge — resuelve el encuadre contra el
   cilindro de rotación y MIDE la card real con `getBoundingClientRect`, así que se
   recalcula solo contra la card de React), el gate de las 41 texturas y el arranque en
   frío pintado con `strippedColor`.
2. ❌ Port a React Three Fiber (`design/r3f-reference/`): nunca se compiló ni se corrió,
   quedó en navy pre-COLOR1. Sería tirar la evidencia y volver a ganarla.
3. ❌ `<iframe>` de la copia publicada: rompe el fix de Jorge (el iframe no ve dónde está
   la card) y mete plumbing de postMessage.

## Archivos

```
crm-v2/
├─ public/3d/{assets,intake}/             ← ~1 MB de texturas WebP desde ssb-login-preview/
├─ src/components/auth/
│  ├─ container-scene.ts                  ← el módulo de A4 + createObjectModel, vanilla, cero React
│  ├─ container-canvas.tsx               ← client component: monta, limpia, expone la API
│  └─ brand-panel.tsx                     ← INTACTO (lo sigue usando /registro)
├─ src/app/login/page.tsx                 ← el form pasa a .login-card + wirea la escena
└─ next.config.ts                         ← headers `immutable` para /3d/*
```

- `three` se agrega a `package.json` (misma versión que valida el harness, ^0.185.1).
  Next lo bundlea; NO hace falta bun, `build-app.sh` ni `vendor/` (eso era porque la
  vitrina es HTML estático sin bundler).
- La escena entra con `next/dynamic({ ssr: false })` → chunk propio que solo baja `/login`.
- El service worker NO cachea `/3d/*` (filosofía deliberada del sw.js: solo estáticos de
  marca); el cache lo dan los headers `immutable` de next.config.ts — el ~1 MB se paga
  una vez por dispositivo.

## Interfaz form–escena (4 puntos de contacto)

| React hace | La escena responde |
|---|---|
| monta `<ContainerCanvas />` | bajada de grúa; reveal con las 41 texturas (techo 15 s) |
| `signInWithPassword()` OK → `scene.playLoginSequence()` | giro → puertas → fade (3,30 s) |
| la escena avisa `onSequenceEnd` | `router.replace('/inicio')` (ya prefetcheado) |
| `signInWithPassword()` falla | NO se llama a la escena: el error sale a los ~0,5 s |

La secuencia arranca DESPUÉS de que Supabase contestó bien, nunca en paralelo:
contraseña equivocada = cero animación que abortar. `onSequenceEnd` dispara en
`finalAt` (3,40 s), que en el demo mostraba el overlay "Repetir".

## Se saca (era del demo)

- Overlay `#final` + botón "Repetir" → lo reemplaza la navegación real.
- Tecla R (reset) → en producción es un bug, no una feature.
- `window.__a4` → solo fuera de producción (`NODE_ENV !== 'production'`) — cierra la
  deuda §7 del handoff de crm-3d.
- `setTimeout(900)` que simulaba el login → `signInWithPassword()` real.

## NO se toca

`createObjectModel.js`, las 4 texturas horneadas en COLOR1, los timings `SEQ`/`LAND`,
`applyFraming()`, el gate de reveal, `prefers-reduced-motion`. La geometría y la
coreografía se MUEVEN de lugar, no se editan. `/registro` queda con `AuthBrandPanel`.

## Verificación

- `tsc --noEmit` + `next build` + vitest existentes en verde.
- Comparación de píxeles contra la captura aprobada (agent-browser headless — los MCP de
  browser están rotos en WSL): 41/41 texturas, 0 errores de consola, estado final ≤0,01%
  de diferencia.
- Barrido de 360° de a 3° contra el borde real de la card de React (re-validar el fix de
  Jorge en 1600×950 y 1366×768).
- Mobile 390×844: la bajada se ve completa sin card; el form aparece al posarse.
- Login real de punta a punta contra Supabase (credenciales demo) con error y con éxito.
- **Smoke test de fluidez (60 fps) va del lado de John**: el headless corre sobre
  SwiftShader y no mide framerate real.

## Post-cutover (fuera de este trabajo, quedan anotados)

- Dar de baja `ssb-login-preview` (proyecto Vercel).
- README en `~/work/crm-3d` apuntando a crm-v2 como fuente de verdad de la escena.

## Riesgos

- **Next 16 tiene breaking changes** vs. el conocimiento entrenado: leer
  `node_modules/next/dist/docs/` ANTES de escribir código (regla de AGENTS.md).
- El módulo A4 asume rutas absolutas `/assets/...` vía `<base href="/">`; en crm-v2 las
  texturas viven en `/3d/...` → el path base debe quedar parametrizado al extraer.
- Deploy de crm-v2 es MANUAL (`npx vercel deploy --prod --yes`), no hay auto-deploy en push.
