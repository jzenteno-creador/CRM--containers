import * as THREE from 'three';
import { createContainerModel, applyContainerLighting, createContainerContactShadow, configureContainerRenderer }
  from './container-model.js';

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

// =====================================================================================
// A4 - evolucion de A3-spreader. Cierra los TRES pedidos de John del 2026-08-05 mas la
// paleta que eligio ese mismo dia:
//
//   1. REALISMO   "que se vea mas realista, mejor definicion, pero NUEVO - nada de sucio,
//                 oxido, rayones ni desgaste". Es decir: subir la LUZ, no ensuciar el
//                 MATERIAL. -> shadow maps reales, environment de muelle, rim light y
//                 anisotropia al maximo. Cero wear, cero dirt.
//   2. SPREADER   "te agregue la foto de un spreader en docs, tomemos ese color" ->
//                 amarillo #F8991B muestreado de la foto, y gap contra el techo cerrado
//                 de 124 mm a 24 mm.
//   3. COREOGRAFIA "que el contenedor primero gire a la puerta y se muestre la apertura"
//                 -> el vuelo de camara de A3 SE ELIMINA; ahora gira el objeto.
//   4. PALETA     COLOR1 (elegida por John el 2026-08-05): casco teal #14424C, acento
//                 naranja #D6640F, crema #EAE8D6, deck #1A1A19. El repintado del casco NO
//                 vive aca: esta horneado en las 4 texturas de assets/pbr (regeneradas con
//                 harness/sculpt_surface.py --assets-only) y en los hex de marca de
//                 harness/createObjectModel.js. Por eso A, A2 y A3 tambien salen teal.
//
// La geometria del contenedor no se toco: el spreader y la coreografia viven en este
// archivo, el modelo sigue siendo el mismo createContainerModel().
//
// Los cuatro cambios, en orden de impacto medido:
//   1. SOMBRAS REALES (shadow map). La key del rig pasa a proyectar sombra y el
//      contenedor la recibe: eso da AUTOSOMBRA DEL CORRUGADO (cada cresta oscurece su
//      valle) y sombra del spreader sobre el techo. Es el 80% del salto: sin esto el
//      corrugado solo tenia modulacion de Lambert por normal, que lee como CG.
//   2. ENVIRONMENT DE MUELLE NOCTURNO. Reemplaza el equirect gris de estudio por uno
//      con gradiente vertical real (cenit frio brillante -> piso oscuro), banda de
//      horizonte y dos softboxes. Determinista, generado por matematica, cero assets.
//   3. LUZ DE RECORTE (rim). Despega la silueta del fondo navy sin lavar la cara que
//      mira a camara: la direccion elegida da N.L = 0 exacto sobre esa pared.
//   4. NITIDEZ. Anisotropia al maximo del device (8 -> 16) y tone mapping revisado.
//
// Lo demas de A3 sigue vivo tal cual: parallax, luz de mouse, dolly de foco, secuencia
// de login, fog, reduced-motion, tecla R, coreografia de posado con spreader.
//
// A3 (original) - evolucion de A2-nocturna. Mismos seis efectos de interaccion, pero el
// contenedor YA NO CAE SOLO: lo posa un spreader de grua que baja con el, apoya,
// destraba los cuatro twist-locks y se retira hacia arriba fuera de cuadro.
//
// A2 queda intacta como comparacion (design/A2-nocturna.html). Todo lo de A2 sigue vivo
// aca: parallax de mouse, luz que sigue al cursor, dolly de foco, secuencia de login
// (puertas + camara al interior + fade), fog, sombra de contacto, reduced-motion,
// tecla R, estados del formulario.
//
// Lo que cambia respecto de A2:
//   1. El "drop and bounce" (caida libre con dos rebotes) se reemplaza por una
//      coreografia de posado de grua: descenso con desaceleracion real, asentamiento
//      de 40 mm sin rebote, destrabe de twist-locks y retirada del spreader.
//   2. La autorotacion del contenedor ya no arranca de entrada: espera a que el
//      spreader haya salido del cuadro (medido por proyeccion, no por reloj).
//   3. Geometria nueva a nivel de ESCENA (no hijo del modelo): el spreader completo.
//      El pipeline del modelo (src/createObjectModel.ts, harness/) no se toca.
//
// Mockup sin backend: el formulario solo simula estados visuales.
//
// REPRODUCIR: tecla "R" (fuera de un input) o el boton "Repetir" del estado final
// reinician TODO desde el contenedor colgando con el spreader trabado encima.
//
// Estado continuo (mouse, camara, luz, secuencia, posado) vive en variables de modulo y
// se interpola en UN solo requestAnimationFrame. Ningun listener escribe en el DOM ni
// hace calculos de render: solo guardan un target.
// =====================================================================================

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileQuery = window.matchMedia('(max-width: 767px)');
const reduced = () => reduceMotionQuery.matches;

// ---- Seguimiento de texturas - mismo patron que demo/index.html. ----
const texState = { total: 0, loaded: 0, errors: [], started: false };

// ---- QUE TEXTURAS DEFINEN QUE EL CONTENEDOR "SE VEA COMPLETO". ----
// MEDIDO EN PRODUCCION (2026-08-06): esperar las 41 texturas para revelar el contenedor
// daba 11,6 s en una conexion de ~80 KB/s -- y encima revelaba por TIMEOUT, no porque
// estuvieran listas. Son 754 KB entre el bundle y las texturas: a esa velocidad no hay
// orden que lo arregle, hay que dejar de esperar lo que no se ve.
//
// Estas 8 son las que llevan COLOR y DIBUJO: la librea de los laterales con el logo SSB,
// las dos hojas de puerta con la sigla, los albedos de marca y la placa CSC. Con estas
// puestas el contenedor ya se lee terminado.
//
// Las otras 23 son normal / roughness / height / ao: modulan el SOMBREADO, no el dibujo.
// Entran durante la bajada y no se percibe el momento en que lo hacen -- son ~190 KB que
// no tiene ningun sentido mirar de brazos cruzados.
const TEX_QUE_DEFINEN = [
  'side-wall-right_albedo_ssb', 'side-wall-left_albedo_ssb',
  'door-leaf-right_albedo_ssb', 'door-leaf-left_albedo_ssb',
  'paint-body-navy_albedo_brand', 'decal-white_albedo_brand',
  'paint-accent-orange_albedo_brand', 'csc-plate'
];
const texVistas = new Set();
function definitoriasListas() {
  // Una que falle cuenta como resuelta: si no, un 404 dejaria el gate colgado hasta el techo.
  return TEX_QUE_DEFINEN.every((n) => texVistas.has(n));
}
function marcarTextura(url) {
  for (const n of TEX_QUE_DEFINEN) if (url.includes(n)) texVistas.add(n);
}

THREE.DefaultLoadingManager.onStart = () => { texState.started = true; };
THREE.DefaultLoadingManager.onProgress = (url, loaded, total) => {
  texState.loaded = loaded;
  texState.total = total;
  marcarTextura(url);
};
THREE.DefaultLoadingManager.onError = (url) => {
  texState.errors.push(url);
  marcarTextura(url);          // una que falla no puede dejar el gate esperandola
  console.error('A4-realista: fallo cargando textura', url);
};

// canvas viene de opts (React es dueño del DOM)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
configureContainerRenderer(renderer);   // ACESFilmic + sRGB + exposure 1 (del harness)

// =====================================================================================
// A4 (1a): SHADOW MAP - configuracion del renderer.
//
// Va ANTES de crear el modelo: shadowMap.type entra como #define en el shader, y
// cambiarlo despues obliga a recompilar los 5 programas.
//
// OJO CON EL TIPO. El pedido decia PCFSoftShadowMap; en three r185 eso seria un BUG
// SILENCIOSO. Verificado en node_modules/three/build/three.module.js:6578-6586:
//
//     const shadowMapTypeDefines = { [PCFShadowMap]: 'SHADOWMAP_TYPE_PCF',
//                                    [VSMShadowMap]: 'SHADOWMAP_TYPE_VSM' };
//     return shadowMapTypeDefines[ parameters.shadowMapType ] || 'SHADOWMAP_TYPE_BASIC';
//
// PCFSoftShadowMap YA NO ESTA en ese mapa: cae al `|| 'SHADOWMAP_TYPE_BASIC'`, que es
// el branch de 1 solo tap con step() - sombras duras y con escalera, exactamente lo
// contrario de lo que se pedia. El PCF de r185 es la version nueva: sampler2DShadow
// (PCF bilineal por hardware en cada tap) + 5 taps en disco de Vogel + rotacion por
// pixel con interleavedGradientNoise. Es mas suave y mas barato que el PCF_SOFT viejo,
// y ademas respeta shadow.radius (el PCF_SOFT viejo lo ignoraba). Se usa PCFShadowMap.
// =====================================================================================
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

// COLOR1: el fondo de escena tiene que ser EXACTAMENTE el de la pagina (--navy-deep,
// hoy #1A1A19) porque scene.fog usa este mismo color para fundir el extremo lejano del
// contenedor con el HTML. Si divergen, el fundido termina en un borde visible de canvas.
const BG = 0x1A1A19;
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);

// Rig calibrado (pasada 6). NO se reemplaza: los efectos de luz se SUMAN a el.
// contactShadow:false porque la sombra se instancia aparte para poder animarla con la
// caida (ver efecto 6 mas abajo).
const lightRig = applyContainerLighting(renderer, scene, { mode: 'reference', contactShadow: false });

const model = createContainerModel();
scene.add(model);
const runtime = model.userData.sculptRuntime;
// =====================================================================================
// ARRANQUE EN FRIO: EL CONTENEDOR NACE EN COLOR DE MARCA, NO EN BLANCO.
//
// EL PROBLEMA, MEDIDO EN PRODUCCION. El teal del casco esta HORNEADO en el composite,
// asi que el modelo deja `color = blanco` para no multiplicarlo dos veces. Perfecto una
// vez que la textura llego; pero mientras baja, el material tiene un THREE.Texture SIN
// imagen y se renderea blanco lavado. En un link de ~100 KB/s eso son varios segundos de
// un contenedor gris/blanco que no se parece a la marca (capturas de John, 2026-08-06).
//
// LA SOLUCION NO ES ESPERAR MAS, ES EMPEZAR BIEN. Cada material guarda su color plano en
// userData.strippedColor (lo escribe el surface-pass). Se lo pintamos de entrada y le
// sacamos el mapa a medio bajar; cuando la imagen llega de verdad, se devuelve el mapa y
// el color vuelve a blanco. Resultado: el primer frame ya es un contenedor teal correcto,
// y las texturas suman logo y marcas encima sin que se vea ningun salto de color.
const coldStart = [];
model.traverse((o) => {
  const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
  for (const m of mats) {
    if (!m.map || m.map.image) continue;              // sin mapa, o ya resuelto: nada que hacer
    const hex = m.userData?.strippedColor || o.userData?.strippedColor;
    if (!hex) continue;
    coldStart.push({ mat: m, map: m.map, color: m.color.clone() });
    m.map = null;                                     // un mapa sin imagen se samplea blanco
    m.color.set(hex);                                 // el color plano de marca de ESE material
    m.needsUpdate = true;
  }
});

// Devuelve mapa y color a su estado final en cuanto la imagen existe. Se chequea por
// frame y no por callback del loader a proposito: el mapa puede venir de cache, de red o
// de un decode diferido, y `image` es el unico hecho comun a los tres caminos.
function settleColdStart() {
  if (!coldStart.length) return;
  for (let i = coldStart.length - 1; i >= 0; i--) {
    const e = coldStart[i];
    if (!e.map.image) continue;
    e.mat.map = e.map;
    e.mat.color.copy(e.color);
    e.mat.needsUpdate = true;
    coldStart.splice(i, 1);
  }
}


// =====================================================================================
// A4 (4): NITIDEZ - ANISOTROPIA AL MAXIMO DEL DEVICE.
//
// El modelo nace con anisotropy 8 en los 31 mapas (createObjectModel.js:175 y 207,
// default `textureAnisotropy ?? 8`). Se sube al maximo real del contexto WebGL2, que en
// todo el parque desktop/movil actual y tambien en el SwiftShader del harness es 16.
// No es cosmetico: la vista es AZIMUT 28 / ELEVACION 10 grados, o sea las dos paredes
// laterales y el techo se ven EN ESCORZO FUERTE. Ahi el filtrado trilineal solo elige
// un mip por el eje de mayor compresion y funde el trazo del stencil de las marcas ISO
// 6346 (4.43 px de trazo a 4096) con el navy de fondo. Duplicar la anisotropia duplica
// las muestras a lo largo del eje comprimido: es LA palanca de definicion de las marcas.
//
// No se toca ningun otro canal del material: sigue siendo el modelo cerrado de 8 pasadas.
// =====================================================================================
const MAX_ANISOTROPY = renderer.capabilities.getMaxAnisotropy();
const TEX_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap',
                   'alphaMap', 'emissiveMap', 'displacementMap'];
let anisotropyRaised = 0;
{
  const seen = new Set();
  model.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      for (const slot of TEX_SLOTS) {
        const t = m[slot];
        if (!t || seen.has(t)) continue;
        seen.add(t);
        if (t.anisotropy < MAX_ANISOTROPY) { t.anisotropy = MAX_ANISOTROPY; t.needsUpdate = true; anisotropyRaised++; }
      }
    }
  });
}

// =====================================================================================
// A4 (1b): SOMBRAS REALES - la KEY del rig calibrado pasa a proyectar.
//
// POR QUE ES EL CAMBIO DE MAYOR IMPACTO. El corrugado del contenedor es GEOMETRIA REAL,
// no un normal map: createObjectModel.js:1685 construye `corrugatedSlab(11.892, 2.676,
// 42, 0.036, 0.42, 0.28, ...)`, o sea 42 flautas de paso 283 mm y 36 mm de profundidad.
// Hasta A3 esa geometria solo se leia por Lambert (cada cara del trapecio tiene su N.L),
// que da una modulacion suave y simetrica - el "look CG" que el cliente marco. Con
// shadow map la cresta TAPA su valle y aparece la asimetria fotografica.
//
// La cuenta de por que se ve, hecha antes de escribir una linea:
//   direccion de la key = (-10, 8, 4) normalizada = (-0.7454, 0.5963, 0.2981)
//   la luz VIAJA en la direccion opuesta: D = (0.7454, -0.5963, -0.2981)
//   pared que mira a camara: N = (0,0,1) -> N.L = 0.298 (recibe poco, es una pared)
//   flanco del trapecio que mira a -X: N = (-0.647, 0, 0.762) -> N.L = 0.709 (cresta)
//   flanco que mira a +X:              N = ( 0.647, 0, 0.762) -> N.L = -0.255 -> 0
//   penetracion de la sombra en el valle: por cada 36 mm de profundidad la luz avanza
//   36 * (0.7454/0.5963) = 45 mm en X... medido sobre el perfil real: la sombra de la
//   cresta cubre el flanco +X entero (42.5 mm) y ~48 mm de los 79 mm de piso de valle.
// O sea: ~60% del piso de cada valle queda en sombra proyectada. Eso es lo que la foto
// de referencia muestra como modulacion de +/-17% cresta/valle sobre la chapa.
//
// El rig NO se retoca (posicion, color e intensidad de key/fill/hemi quedan como la
// pasada 6 los calibro): lo unico que se le agrega es castShadow y la camara de sombra.
// =====================================================================================
const keyLight = lightRig.lights.getObjectByName('key');
const KEY_DIR = keyLight.position.clone();          // (-10, 8, 4), la del rig
const SHADOW_MAP_SIZE = mobileQuery.matches ? 2048 : 4096;

// AABB del mundo que la camara de sombra tiene que cubrir. Incluye TRES cosas:
//   a) el contenedor apoyado y colgando (y de -0.4 a 8.0: hangY 4.5 + 2.9 de alto + aire)
//   b) el spreader trabado encima (llega a y = 4.68 apoyado, 9.18 colgado)
//   c) la HUELLA de la sombra en el piso, que NO cae debajo del objeto sino desplazada:
//      por cada metro de altura la sombra se corre (1.250, -0.500) en (x, z). El techo
//      apoyado (y=2.896) proyecta a x = 6.1 + 3.62 = 9.7 y z = -1.25 - 1.45 = -2.70.
//      Si el piso receptor cae fuera del frustum, three devuelve "iluminado" y aparece
//      una LINEA RECTA donde la sombra se corta. Por eso el box se estira a +X y -Z.
// Se deja FIJO (no sigue al contenedor): asi la sombra en el piso existe durante todo el
// descenso y se ve encogerse y converger a medida que la carga baja, que es exactamente
// el cue fotografico del posado. Costo de no seguir: 25% menos de texeles por metro.
const SHADOW_BOX = new THREE.Box3(
  new THREE.Vector3(-7.2, -0.40, -3.8),
  new THREE.Vector3(11.0, 8.00, 2.2)
);

// Ajusta la camara ortografica de sombra a un AABB, SIN mover la direccion de la luz.
// Clave: se desplazan la luz Y su target por el MISMO vector (el centro del box), asi
// `position - target` sigue siendo exactamente KEY_DIR y el sombreado difuso no cambia
// ni un LSB. La distancia luz-target es libre (una directional solo mira la direccion):
// se elige hF + 8 para que `near` quede holgado en vez de raspando cero.
const keyTarget = new THREE.Object3D();
keyTarget.name = 'A4 key shadow target';
scene.add(keyTarget);

function fitDirectionalShadow(light, target, dirVec, box, mapSize) {
  const center = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const L = dirVec.clone().normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(L).normalize();
  const up = new THREE.Vector3().crossVectors(L, right).normalize();
  const ext = (v) => Math.abs(v.x) * half.x + Math.abs(v.y) * half.y + Math.abs(v.z) * half.z;
  const hR = ext(right), hU = ext(up), hF = ext(L);
  const dist = hF + 8;
  target.position.copy(center);
  target.updateMatrixWorld();
  light.position.copy(center).addScaledVector(L, dist);
  light.target = target;
  const cam = light.shadow.camera;
  cam.left = -hR; cam.right = hR; cam.top = hU; cam.bottom = -hU;
  cam.near = dist - hF;
  cam.far = dist + hF;
  cam.updateProjectionMatrix();
  light.shadow.mapSize.set(mapSize, mapSize);
  return {
    halfRight: +hR.toFixed(3), halfUp: +hU.toFixed(3), halfForward: +hF.toFixed(3),
    near: +cam.near.toFixed(3), far: +cam.far.toFixed(3),
    depthRange: +(cam.far - cam.near).toFixed(3),
    texelRight_mm: +(2000 * hR / mapSize).toFixed(3),
    texelUp_mm: +(2000 * hU / mapSize).toFixed(3),
    mapSize
  };
}

// BIAS: se eligieron con la geometria en la mano, no a ojo, y despues se verificaron a
// pixel (ver reporte).
//   - `bias` esta en unidades de profundidad NDC [0,1] de la camara de sombra, o sea hay
//     que multiplicarlo por depthRange para leerlo en metros. Con depthRange = 20.4 m,
//     bias = -0.0001 son 2.0 mm. Se mantiene chico A PROPOSITO: el detalle que hay que
//     preservar mide 36 mm de profundidad; un bias de los "tipicos" (-0.0005 = 10 mm)
//     se comeria el 28% del relieve y el valle empezaria a iluminarse solo.
//   - `normalBias` esta en METROS de mundo y es el que de verdad mata el acne, porque
//     desplaza el punto de muestreo a lo largo de la normal (es proporcional al error
//     real de discretizacion, que crece con la inclinacion). Regla: ~1.5 texeles del
//     eje mas grueso. Texel = 4.44 mm en el eje "up" a 4096 -> 6.7 mm. Se usa 0.006.
//     A 2048 (mobile) el texel se duplica, asi que el normalBias tambien.
//   - `radius` es real en r185 (multiplica el disco de Vogel por texelSize). 2.2 texeles
//     ~= 10 mm de penumbra: sombra de contacto dura en las cavidades chicas y borde
//     apenas blando en la proyeccion grande, que es la jerarquia que muestra la foto.
const SHADOW_BIAS = -0.0001;
const SHADOW_NORMAL_BIAS = mobileQuery.matches ? 0.012 : 0.006;
const SHADOW_RADIUS = 2.2;

keyLight.castShadow = true;
keyLight.shadow.bias = SHADOW_BIAS;
keyLight.shadow.normalBias = SHADOW_NORMAL_BIAS;
keyLight.shadow.radius = SHADOW_RADIUS;
const shadowFit = fitDirectionalShadow(keyLight, keyTarget, KEY_DIR, SHADOW_BOX, SHADOW_MAP_SIZE);

// El modelo ya nace con castShadow/receiveShadow = true por mesh (createObjectModel.js
// :458-459 y siguientes, default de las options). Se afirma explicito igual: es la
// condicion de la autosombra del corrugado (recibir la sombra que el mismo proyecta) y
// no puede quedar dependiendo de un default de la libreria.
let shadowMeshes = 0;
model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; shadowMeshes++; } });

// =====================================================================================
// A4 (2): ENVIRONMENT DE MUELLE NOCTURNO.
//
// El environment del harness es un equirect GRIS de estudio: gradiente suave de 0.62
// (abajo) a 1.00 (arriba) mas un softbox de 52 grados en la direccion de la key. Es
// correcto para un product shot sobre blanco y es justo lo que hace que esta escena
// nocturna lea como render: iluminacion indirecta casi uniforme y sin color.
//
// El de A4 respeta la MISMA energia media (se midio, ver abajo) pero la redistribuye:
//   - CENIT frio y brillante (1.15, tinte 0.80/0.91/1.10) -> el techo y el riel superior
//     captan mucho mas cielo que la chapa vertical. Ese es el dato contraintuitivo que
//     la foto de referencia confirma: el riel plano lee MAS CLARO (66,105,122) que el
//     corrugado (31,58,100) aunque compartan pintura.
//   - PISO oscuro (0.16, tinte 0.52/0.60/0.80) -> las caras que miran abajo se apagan y
//     aparece el gradiente vertical del panel que la referencia mide como caida monotona
//     de cresta superior a base.
//   - BANDA DE HORIZONTE (gaussiana en elevacion, centro -3 grados, sigma 8, ganancia
//     0.55). No es decoracion: una pared VERTICAL vista desde 10 grados de elevacion
//     refleja hacia -10 grados de elevacion, o sea justo debajo del horizonte. Sin algo
//     ahi, la pared refleja piso muerto y el especular ancho desaparece.
//   - DOS SOFTBOXES: uno alineado a la key (30 grados, 0.85) y un kicker frio del lado
//     de camara (22 grados, 0.50, tinte 0.78/0.88/1.14) que le da estructura azimutal a
//     los metales del spreader (metalness 0.80-0.86, roughness 0.32-0.44: esos SI
//     resuelven reflejo, a diferencia de la pintura navy que esta en roughness 0.734).
//
// Energia: media ponderada por angulo solido del original = 0.8628 (gris) a intensidad
// 0.25 -> luminancia media 0.2157. La de A4 = 0.6856 -> para igualar hace falta
// intensidad 0.3146. Se usa 0.30 (98.5% de paridad, 1.5% por debajo a proposito: el
// techo del canal de 250 es una restriccion dura y se prefiere errar hacia abajo).
// Todo generado por matematica en el cliente: cero requests, cero assets, determinista.
// =====================================================================================
const ENV_SIZE = 512;             // equirect 512 x 256 antes del PMREM (el harness usa 256)
const ENV_INTENSITY = 0.30;

function createDockNightEnvironment(rend) {
  const W = ENV_SIZE, H = W >> 1;
  const smooth = (t) => t * t * (3 - 2 * t);
  const nrm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };

  const ZEN = [0.80, 0.91, 1.10], ZEN_L = 1.15;
  const HOR = [0.95, 0.97, 1.02], HOR_L = 0.72;
  const GND = [0.52, 0.60, 0.80], GND_L = 0.16;
  const BAND = [0.92, 0.96, 1.02], BAND_GAIN = 0.55;
  const BAND_C = THREE.MathUtils.degToRad(-3), BAND_S = THREE.MathUtils.degToRad(8);
  const BOXES = [
    { d: nrm(KEY_DIR.x, KEY_DIR.y, KEY_DIR.z), cos: Math.cos(THREE.MathUtils.degToRad(30)), gain: 0.85, col: [1.00, 1.00, 1.02] },
    { d: nrm(8, 5, 7), cos: Math.cos(THREE.MathUtils.degToRad(22)), gain: 0.50, col: [0.78, 0.88, 1.14] }
  ];

  const data = new Uint16Array(W * H * 4);
  const rgb = [0, 0, 0];
  for (let j = 0; j < H; j++) {
    // Convencion equirect de three: uv.y = asin(dir.y)/PI + 0.5, y DataTexture no da
    // vuelta las filas -> j = H-1 es el cenit. Misma parametrizacion que el harness.
    const v = (j + 0.5) / H;
    const y = Math.sin((v - 0.5) * Math.PI);
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const el = Math.asin(Math.max(-1, Math.min(1, y)));
    let L, base;
    if (y >= 0) {
      L = HOR_L + (ZEN_L - HOR_L) * Math.pow(y, 0.75);
      const g = Math.pow(y, 0.6);
      base = [HOR[0] + (ZEN[0] - HOR[0]) * g, HOR[1] + (ZEN[1] - HOR[1]) * g, HOR[2] + (ZEN[2] - HOR[2]) * g];
    } else {
      const f = Math.pow(1 + y, 3);
      L = GND_L + (HOR_L - GND_L) * f;
      base = [GND[0] + (HOR[0] - GND[0]) * f, GND[1] + (HOR[1] - GND[1]) * f, GND[2] + (HOR[2] - GND[2]) * f];
    }
    const band = BAND_GAIN * Math.exp(-((el - BAND_C) * (el - BAND_C)) / (2 * BAND_S * BAND_S));
    for (let i = 0; i < W; i++) {
      const u = (i + 0.5) / W;
      const a = (u - 0.5) * Math.PI * 2;
      const x = -r * Math.cos(a);
      const z = r * Math.sin(a);
      rgb[0] = L * base[0] + band * BAND[0];
      rgb[1] = L * base[1] + band * BAND[1];
      rgb[2] = L * base[2] + band * BAND[2];
      for (const b of BOXES) {
        const c = x * b.d[0] + y * b.d[1] + z * b.d[2];
        if (c > b.cos) {
          const w = b.gain * smooth((c - b.cos) / (1 - b.cos));
          rgb[0] += w * b.col[0]; rgb[1] += w * b.col[1]; rgb[2] += w * b.col[2];
        }
      }
      const o = (j * W + i) * 4;
      data[o] = THREE.DataUtils.toHalfFloat(rgb[0]);
      data[o + 1] = THREE.DataUtils.toHalfFloat(rgb[1]);
      data[o + 2] = THREE.DataUtils.toHalfFloat(rgb[2]);
      data[o + 3] = THREE.DataUtils.toHalfFloat(1);
    }
  }

  const equirect = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  equirect.mapping = THREE.EquirectangularReflectionMapping;
  equirect.minFilter = THREE.LinearFilter;
  equirect.magFilter = THREE.LinearFilter;
  equirect.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(rend);
  const texture = pmrem.fromEquirectangular(equirect).texture;
  pmrem.dispose();
  equirect.dispose();
  return texture;
}

// El environment de estudio se libera: si se dejara colgado seria VRAM muerta (el PMREM
// del harness es un render target, no se lo lleva el GC solo).
if (lightRig.environment) lightRig.environment.dispose();
const dockEnv = createDockNightEnvironment(renderer);
scene.environment = dockEnv;
scene.environmentIntensity = ENV_INTENSITY;

// =====================================================================================
// A4 (3): LUZ DE RECORTE (RIM).
//
// Objetivo: despegar la silueta del fondo #0A0F1C sin lavar la cara que mira a camara.
// La direccion NO es decorativa, esta elegida para que N.L de esa cara sea exactamente
// cero y por lo tanto el rim no pueda tocarla:
//   L = normalize(-4.6, 7.2, -8.4) = (-0.383, 0.600, -0.700)
//   pared +Z (la que ve la camara): N = (0,0,1)      -> N.L = -0.700 -> 0   (intacta)
//   flancos del corrugado de esa pared: N = (+/-0.647, 0, 0.762) -> N.L < 0 -> 0
//   techo:      N = (0,1,0)  -> N.L = 0.600  (dibuja la linea del riel superior)
//   testero -X: N = (-1,0,0) -> N.L = 0.383  (separa el extremo ciego del fondo)
// O sea: solo entra donde hace falta - el borde de arriba y el canto de la izquierda.
// Color frio #9DB6E0 (157,182,224): respeta R < G < B, asi que sobre el navy nunca puede
// invertir el orden de canales que el contrato de marca exige.
// Intensidad conservadora: 1.15 contra 5.18 de la key (22%).
// =====================================================================================
const RIM_INTENSITY = 1.15;
const rimLight = new THREE.DirectionalLight(0x9DB6E0, RIM_INTENSITY);
rimLight.name = 'A4 rim';
rimLight.position.set(-4.6, 7.2, -8.4);
rimLight.castShadow = false;
scene.add(rimLight);

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 200);

model.updateWorldMatrix(true, true);
const modelBox = new THREE.Box3().setFromObject(model);
const modelCenter = modelBox.getCenter(new THREE.Vector3());

// =====================================================================================
// EFECTO 6 (a): FOG del mismo color que el fondo.
// Se calibra en applyFraming() contra la distancia real de camara: near = D - 3.0 deja
// el tercio delantero (donde vive el logo SSB del lateral) practicamente sin niebla, y
// far = D + 12 hace que el extremo ciego (-X, el mas lejano) llegue a ~60% de mezcla con
// el fondo y se funda con la pagina. Ver FOG_NEAR_OFFSET / FOG_FAR_OFFSET.
// =====================================================================================
const FOG_NEAR_OFFSET = -3.0;
const FOG_FAR_OFFSET = 12.0;
scene.fog = new THREE.Fog(BG, 1, 100);

// =====================================================================================
// EFECTO 6 (b): SOMBRA DE CONTACTO.
// Sobre fondo #0A0F1C una sombra negra solo puede oscurecer 10/15/28 niveles (el fondo
// ya es casi negro), asi que la de fabrica (opacity .35) casi no se lee. Medido en
// browser: con opacity .35 el delta pico en la banda de contacto es de 3/5/10 niveles;
// subida a .62 el pico es de 6/9/17 niveles sobre el canal azul, que SI se distingue y
// da el "asiento" que pide la caida del efecto 1. Se deja adentro con esa opacidad.
// material.fog = false: si la sombra respetara la niebla, a la distancia del contacto
// (D +/- 6 m) se mezclaria justo con el color del fondo y se autoanularia.
// =====================================================================================
// A4: la sombra HORNEADA deja de ser la sombra principal y pasa a ser solo el "asiento"
// del objeto en el aire. Ver el bloque de la sombra proyectada real, mas abajo, y
// updateContactShadow() para la modulacion nueva (INVERTIDA respecto de A3).
const SHADOW_OPACITY = 0.62;
const contactShadow = createContainerContactShadow({ opacity: SHADOW_OPACITY, softness: 1.15 });
contactShadow.material.fog = false;
contactShadow.matrixAutoUpdate = false;
contactShadow.castShadow = false;
contactShadow.receiveShadow = false;
scene.add(contactShadow);

// =====================================================================================
// A4 (1c): SOMBRA PROYECTADA REAL - plano de piso invisible con ShadowMaterial.
//
// ShadowMaterial renderea NEGRO con alpha = cantidad de sombra: donde no hay sombra es
// transparente y el plano no existe visualmente. Es la unica forma de tener sombra de
// piso sin inventar un piso (esta escena no tiene suelo: el objeto flota sobre el navy
// de la pagina).
//
// QUE GANA CONTRA LA HORNEADA:
//   - FORMA REAL. La horneada es una elipse difusa centrada bajo el objeto. La real
//     tiene la silueta del contenedor, esta DESPLAZADA por la direccion de la luz
//     (1.250, -0.500) por metro de altura, y lleva adentro el dibujo del corrugado.
//   - RESPONDE A LA ALTURA SOLA. No hay que animarle la opacidad ni la escala: cuando
//     el contenedor sube, su sombra se aleja y se agranda porque asi funciona la
//     proyeccion. La horneada necesitaba dos formulas escritas a mano para simularlo.
//   - RESPONDE AL YAW. Con la autorotacion la sombra gira de verdad; la horneada solo
//     podia copiar rotation.y de un ovalo simetrico.
//
// Se DEJAN LAS DOS, con roles opuestos (la horneada invertida en updateContactShadow):
// la real no puede resolver el gap de aire bajo el contenedor cuando esta colgado a 4.5
// m, porque a esa altura la sombra proyectada cae a x = 11.7 .. 15.3 m, fuera del box de
// sombra. Ahi la horneada, ampliada y difusa, sigue siendo el unico "esta arriba de
// algo". Al apoyar se invierte: la real toma el mando y la horneada baja a un residuo.
// depthWrite:false para que un plano transparente de 48 m no se coma el z-buffer.
// fog:false por el mismo motivo que la horneada (a la distancia del contacto la niebla
// la mezclaria con el fondo y se autoanularia).
// =====================================================================================
const GROUND_SHADOW_OPACITY = 0.62;
const groundShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(48, 48),
  new THREE.ShadowMaterial({ color: 0x000000, opacity: GROUND_SHADOW_OPACITY, depthWrite: false })
);
groundShadow.name = 'A4 ground shadow catcher';
groundShadow.rotation.x = -Math.PI / 2;
groundShadow.position.y = -0.006;      // 6 mm bajo el plano de apoyo: evita z-fighting
groundShadow.receiveShadow = true;
groundShadow.castShadow = false;
groundShadow.material.fog = false;
groundShadow.renderOrder = -2;         // antes de la horneada, que va en -1
groundShadow.matrixAutoUpdate = false;
groundShadow.updateMatrix();
groundShadow.userData.measurementExempt = true;
scene.add(groundShadow);

// =====================================================================================
// EFECTO 5 (a): CASCARA INTERIOR.
// El modelo NO tiene interior (limite de reconstruccion desde una foto): con las puertas
// abiertas se ve la cara interna de la chapa exterior espejada. Se agrega una caja
// BackSide A NIVEL DE ESCENA (no como hijo del modelo) para no contaminar
// sculptRuntime.pickables(), resolvePart(), setExplode() ni el Box3 del encuadre.
// Dimensiones sacadas por raycast contra el modelo real, no a ojo. Caras internas
// medidas: paredes laterales en z = +/-1.179, cara inferior (techo del bastidor) en
// y = 0.160, cara interna del techo en y = 2.866, testero ciego en x = -6.056, plano de
// puertas en x = +6.070. La cascara mide 12.06 x 2.645 x 2.31 centrada en (0, 1.5075, 0):
// x +/-6.03, y 0.185..2.83, z +/-1.155. Queda entre 2.4 y 3.6 cm POR DENTRO de cada cara
// real, asi que nunca asoma por fuera y, sobre todo, tapa el bastidor inferior (que sin
// esto se veia desde adentro como un piso metalico claro, 134/138/149).
// Como el modelo rota (autorotacion + parallax), la cascara copia position+quaternion
// del modelo cada frame - vive en la escena pero viaja con el.
// =====================================================================================
// Material LAMBERT y no Standard a proposito. Con MeshStandardMaterial (roughness 0.94,
// metalness 0) el piso y las paredes vistos en angulo rasante desde adentro suben a
// 82/85/95 y 62/64/73: no es el albedo (con color negro puro siguen en 77/77/78), es el
// pedestal especular dielectrico F0=0.04 amplificado por Fresnel a incidencia rasante.
// Resultado: un interior gris metalico, sin penumbra y sin tono navy. Lambert es difuso
// puro: piso 10/25/65, pared 5/15/46, techo 2/7/28 sobre un fondo de 10/15/28. El color
// esta apenas levantado sobre el fondo porque a difuso puro el fondo exacto cae casi a
// negro y el interior se lee como un agujero, no como una superficie.
// COLOR1: se mantiene la MISMA relacion (fondo levantado ~un 45%) sobre el deck nuevo
// #1A1A19 -> #262625. El interior de un contenedor NO es color de marca: es chapa
// desnuda en penumbra, asi que sigue neutro y no se tine de teal.
const interiorShell = new THREE.Mesh(
  new THREE.BoxGeometry(12.06, 2.645, 2.31),
  new THREE.MeshLambertMaterial({ color: 0x262625, side: THREE.BackSide })
);
interiorShell.name = 'A2 interior shell';
interiorShell.geometry.translate(0, 1.5075, 0);
// A4: FUERA del sistema de sombras, a proposito y con motivo medido.
//   castShadow=false: es una caja BackSide 3 cm por dentro de las paredes reales; si
//     proyectara, su propia sombra competiria con la del contenedor por el mismo texel y
//     daria acne en toda la chapa.
//   receiveShadow=false: esta 100% encerrada por el contenedor, o sea el shadow map la
//     da entera en sombra. Con receiveShadow se apagaria a negro puro y se perderia la
//     calibracion de A3 (piso 10/25/65, pared 5/15/46, techo 2/7/28 sobre fondo
//     10/15/28), que es justo lo que evita que el interior lea como un agujero.
interiorShell.castShadow = false;
interiorShell.receiveShadow = false;
scene.add(interiorShell);

// =====================================================================================
// A4: FORRO INTERIOR DE LAS HOJAS DE PUERTA.
//
// DEFECTO QUE ESTO TAPA, y que solo se hizo visible al cambiar la coreografia: la hoja
// es una chapa de 50 mm con las dos caras texturizadas por el MISMO mapa, asi que su cara
// INTERNA mostraba la sigla "SSBX 412 027-5" y el tipo "45G1" ESPEJADOS. Con el vuelo de
// camara de A3 no se notaba (la camara pasaba de largo hacia el fondo ciego); con el giro
// a la puerta las dos hojas quedan abiertas 120 grados MIRANDO A CAMARA y el texto al
// reves es lo primero que se lee. Es el limite del modelo que ya estaba documentado
// ("las puertas abiertas muestran la cara interna con la textura exterior espejada").
//
// Se resuelve como el interiorShell y por el mismo motivo: no se toca el modelo, se le
// pone una tapa. Un plano por hoja, hijo de la hoja, 0.5 mm por dentro de su cara interna.
// El interior de una puerta real es la misma pintura pero LISA y sin marcas, asi que un
// panel plano no es una simplificacion: es lo correcto.
const LEAF = { halfY: 1.2925, halfZ: 0.5295, innerX: -0.025 };
const doorLinerMat = new THREE.MeshStandardMaterial({
  color: 0x14424C,        // teal COLOR1, el mismo del casco
  roughness: 0.734,       // el finish medido de la pintura del casco
  metalness: 0.05
});
const doorLiners = [];
for (const side of ['left', 'right']) {
  const leaf = model.getObjectByName('Hoja de puerta ' + side);
  if (!leaf) continue;
  // 0.996 del tamano real: si el forro fuera exacto asomaria por los cantos de la hoja
  // en angulos rasantes y se veria un borde teal flotando.
  const liner = new THREE.Mesh(
    new THREE.PlaneGeometry(LEAF.halfZ * 2 * 0.996, LEAF.halfY * 2 * 0.996),
    doorLinerMat
  );
  // El plano nace con la normal en +Z; girando -90 grados sobre Y la normal apunta a -X,
  // que es hacia adentro del contenedor (la cara exterior de la hoja mira a +X).
  liner.rotation.y = -Math.PI / 2;
  liner.position.set(LEAF.innerX - 0.0005, 0, 0);
  liner.name = 'A4 door liner ' + side;
  liner.castShadow = false;      // la hoja ya proyecta; dos casters coplanares dan acne
  liner.receiveShadow = true;
  liner.userData.measurementExempt = true;
  leaf.add(liner);
  doorLiners.push(liner);
}

// =====================================================================================
// EFECTO 3: LUZ DINAMICA QUE SIGUE AL MOUSE.
// PointLight y no SpotLight: (a) un spot sobre una pared plana dibuja el borde eliptico
// del cono y hay que pelear la penumbra para esconderlo, (b) el spot necesita un target
// en la escena y mas uniforms, (c) lo que se busca es un charco de luz radial que barra
// el corrugado - eso es exactamente la caida 1/d^2 de una point light.
// Vive en el plano z = +3.2 (world), o sea 1.98 m por delante de la pared que mira a la
// camara (pared en z = +1.219; la camara esta en el cuadrante +X/+Z). Mapeo:
//   mouse x normalizado -> world X (el eje largo del contenedor, que es el horizontal
//                          de la pantalla con este encuadre: az 28 deg)
//   mouse y normalizado -> world Y (altura)
// Es luz ADICIONAL sobre el rig calibrado. Intensidad y color salen de un barrido de 84
// posiciones de mouse medido con gl.readPixels (ver reporte):
//   - i=10, color #C8D8FF (blanco frio): peor caso max = [247, 240, 242], 0 pixeles con
//     algun canal >= 250 en las 84 posiciones. Contraste del corrugado (desvio estandar
//     de una linea horizontal sobre la chapa) sube de 14.28 a 18.30 = +28%.
//   - El techo NO lo pone el navy ni el decal blanco: lo pone la banderita naranja del
//     logo, que ya arranca en 239 en el canal R con el rig solo. Por eso la luz es fria
//     (#C8D8FF, R al 78%): sube el azul del navy sin empujar el rojo del naranja.
//     Con luz calida (#FFF3E6) e i=12 el naranja llegaba a 254 con 272 pixeles quemados.
const LIGHT_Z = 3.2;
const LIGHT_SPAN_X = 7.4;
const LIGHT_SPAN_Y = 2.4;
const LIGHT_BASE_Y = 1.45;
const mouseLight = new THREE.PointLight(0xC8D8FF, 10, 30, 2);
mouseLight.name = 'A2 mouse light';
mouseLight.position.set(0, LIGHT_BASE_Y, LIGHT_Z);
scene.add(mouseLight);

// =====================================================================================
// SPREADER TELESCOPICO 40 ft - geometria NUEVA, construida a mano en este archivo.
//
// Vive A NIVEL DE ESCENA, igual que interiorShell: no es hijo del modelo. Motivos:
//   - no contamina sculptRuntime.pickables(), resolvePart() ni setExplode();
//   - no entra en el Box3 del encuadre (modelBox se calculo antes de crearlo);
//   - se puede separar del contenedor al retirarse, que es justamente el punto.
// Ademas lleva userData.measurementExempt = true en el grupo y en cada descendiente.
//
// Todas las coordenadas estan en el MISMO frame local que el contenedor (origen en el
// centro del piso, +X hacia las puertas, +Y arriba, +Z al lateral del logo). Mientras el
// spreader esta trabado, su transform copia position+quaternion del modelo y por lo
// tanto los pins caen exactamente donde deben. Al soltarse congela el quaternion y sube
// en Y de mundo.
//
// GEOMETRIA DE ENGANCHE (medida sobre el modelo real, no inventada):
//   - esquineros superiores en x = +/-6.007, z = +/-1.138, cara superior en y = 2.896
//     (al ras del techo y de los rails superiores: los tres planos coinciden);
//   - separacion longitudinal entre centros 12.014 m, transversal 2.276 m. Los pins usan
//     PIN_X / PIN_Z, que SON esos numeros;
//   - agujero superior: elipse real de 124 x 63 mm (semiejes 0.062 en X, 0.0315 en Z),
//     espesor de placa 16 mm, camara interior hueca de 2.794 a 2.880.
// El twist-lock se dimensiona contra eso: cabeza 104 x 56 mm (pasa por la elipse con
// 10 mm y 3.5 mm de juego por lado) y queda alojada bajo la placa superior.
// =====================================================================================

const PIN_X = 6.007;          // separacion longitudinal / 2
const PIN_Z = 1.138;          // separacion transversal / 2
const DECK_Y = 2.896;         // plano superior del contenedor (techo, rails y castings)
const PIN_SIGNS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

// ---- Materiales compartidos. Los colores se reasignan por tema (ver applySpreaderTheme).
const matStruct = new THREE.MeshStandardMaterial({ color: 0x2E3440, metalness: 0.80, roughness: 0.44 });
const matWeb = new THREE.MeshStandardMaterial({ color: 0x232935, metalness: 0.78, roughness: 0.52 });
const matTrim = new THREE.MeshStandardMaterial({ color: 0x3D4658, metalness: 0.72, roughness: 0.40 });
const matHardware = new THREE.MeshStandardMaterial({ color: 0x4A5262, metalness: 0.86, roughness: 0.32 });
const matIndicator = new THREE.MeshStandardMaterial({ color: 0x98A2B3, metalness: 0.55, roughness: 0.42 });
const matCable = new THREE.MeshStandardMaterial({ color: 0x39404E, metalness: 0.92, roughness: 0.30 });
// Los flippers son placas grandes e inclinadas 42 grados: con metalness 0.80 y roughness
// 0.44 (el acero del resto) espejan la parte alta del environment y se van a luminancia
// relativa 0.59, mas del doble del percentil 95 del contenedor. Medido en la primera
// pasada: leian como cuatro carteles blancos pegados al contenedor. Material propio, mas
// difuso, para que sigan siendo metal pero dejen de ser lo mas brillante del cuadro.
const matFlipper = new THREE.MeshStandardMaterial({ color: 0x272C38, metalness: 0.50, roughness: 0.76 });

// DECISION DE MATERIAL: gana 'steel' (acero oscuro sin naranja). No es gusto, esta
// medido con readPixels sobre el frame colgado a 1440x900, enmascarando los pixeles del
// spreader por diferencia entre el render con el y sin el (85.085 px, 6.57% de pantalla).
// El fondo de referencia es #0A0F1C, luminancia relativa 0.00474.
//
//                        contraste vs fondo   px naranjas   % naranja del spreader
//   (i)  steel                   1.321             0                 0.00%
//   (ii) accent                  1.300           4.680                5.51%
//   contenedor (referencia)      1.484             448                0.23%
//
// Lectura de esos numeros:
//   1. El naranja NO compra legibilidad: 1.300 contra 1.321, o sea el tema accent lee un
//      1.6% PEOR que el acero pelado. La silueta del spreader la construyen los reflejos
//      especulares (percentil 95 en contraste 3.43), no el albedo.
//   2. El naranja SI rompe el lock de un solo acento: mete 4.680 px de naranja donde el
//      cuadro entero tenia 448 (la banderita del logo del contenedor). Multiplica por
//      10.4 la masa naranja de la composicion y se la pone a un objeto secundario, que
//      pasa a competir con el CTA "Ingresar" y con el propio logo SSB.
//   3. El acero mantiene al spreader SUBORDINADO al contenedor: luminancia media 0.0225
//      contra 0.0315 del contenedor (29% mas oscuro) y 2.7% de pixeles brillantes contra
//      6.6%. Se lee, pero no gana.
// Se deja setSpreaderTheme('steel'|'accent') expuesto en window.__a4 para poder re-medir.
//
// A4 - DECISION DE JOHN (2026-08-05), REEMPLAZA A LA MEDICION DE ARRIBA: "te agregue la
// foto de un spreader en docs, tomemos ese color". El tema por defecto pasa a ser el
// AMARILLO REAL DE EQUIPO DE PUERTO, muestreado de Crm-containers/docs/Container-spreader.jpg:
// #F8991B (hue 34, sat 0.94; promedio del cuerpo de la viga #F29411).
//
// Lo que esto cambia respecto de la medicion del tema 'accent': ya no es un canto naranja,
// es la ESTRUCTURA entera en amarillo, con luminancia relativa 0.428 contra 0.044 del
// casco teal. El spreader deja de estar subordinado al contenedor y pasa a ser el objeto
// mas brillante del cuadro mientras esta en pantalla (0 a ~4.4 s; despues se retira y el
// naranja del CTA se queda solo). Es deliberado: el amarillo es lo que hace legible
// "esto es una grua de puerto posando un contenedor" en 200 px de alto.
//
// Los cantos (trim) van OSCUROS a proposito: en un spreader real son proteccion de borde,
// y ademas son lo que impide que el amarillo lea como un unico bloque plano.
const SPREADER_THEMES = {
  yellow: {
    struct: 0xF8991B, web: 0xD9820F, trim: 0x2B2A26, flipper: 0xE28E16,
    hardware: 0x4A4A48, indicator: 0xEAE8D6, cable: 0x39393A
  },
  steel: {
    struct: 0x2E3440, web: 0x232935, trim: 0x3D4658, flipper: 0x272C38,
    hardware: 0x4A5262, indicator: 0x98A2B3, cable: 0x39404E
  },
  accent: {
    struct: 0x2E3440, web: 0x232935, trim: 0xD6640F, flipper: 0x272C38,
    hardware: 0xD6640F, indicator: 0xE8834A, cable: 0x39404E
  }
};
let spreaderTheme = 'yellow';
function applySpreaderTheme(name) {
  const t = SPREADER_THEMES[name];
  if (!t) return spreaderTheme;
  spreaderTheme = name;
  matStruct.color.setHex(t.struct);
  matWeb.color.setHex(t.web);
  matFlipper.color.setHex(t.flipper);
  matTrim.color.setHex(t.trim);
  matHardware.color.setHex(t.hardware);
  matIndicator.color.setHex(t.indicator);
  matCable.color.setHex(t.cable);
  return spreaderTheme;
}

const spreader = new THREE.Group();
spreader.name = 'A3 spreader';

// Helper: caja alineada a ejes por rango (x0..x1, y0..y1, z0..z1). Trabajar por rangos y
// no por centro+tamano evita errores de medio milimetro al encadenar piezas.
function addBoxRange(parent, mat, x0, x1, y0, y1, z0, z1, name) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  const m = new THREE.Mesh(g, mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  if (name) m.name = name;
  parent.add(m);
  return m;
}

// --- Viga principal: cajon a lo largo de X, con alas superior e inferior para que lea
//     como viga de alma llena y no como un ladrillo.
const BEAM = { x: 4.40, webY0: 3.05, webY1: 3.72, webZ: 0.25, flangeT: 0.06, flangeZ: 0.40 };
addBoxRange(spreader, matWeb, -BEAM.x, BEAM.x, BEAM.webY0, BEAM.webY1, -BEAM.webZ, BEAM.webZ, 'spreader-main-web');
addBoxRange(spreader, matStruct, -BEAM.x, BEAM.x, BEAM.webY1, BEAM.webY1 + BEAM.flangeT, -BEAM.flangeZ, BEAM.flangeZ, 'spreader-main-flange-top');
addBoxRange(spreader, matStruct, -BEAM.x, BEAM.x, BEAM.webY0 - BEAM.flangeT, BEAM.webY0, -BEAM.flangeZ, BEAM.flangeZ, 'spreader-main-flange-bottom');
// Nervios verticales cada 1.76 m: dan escala y evitan que el cajon lea como plastico.
for (let i = -2; i <= 2; i++) {
  const x = i * 1.76;
  addBoxRange(spreader, matStruct, x - 0.055, x + 0.055, BEAM.webY0, BEAM.webY1, -0.285, 0.285, 'spreader-rib');
}
// Cantos longitudinales del ala superior (los "cantos" del tema accent).
addBoxRange(spreader, matTrim, -BEAM.x, BEAM.x, BEAM.webY1 + BEAM.flangeT, BEAM.webY1 + BEAM.flangeT + 0.028, -BEAM.flangeZ, -BEAM.flangeZ + 0.10, 'spreader-edge-a');
addBoxRange(spreader, matTrim, -BEAM.x, BEAM.x, BEAM.webY1 + BEAM.flangeT, BEAM.webY1 + BEAM.flangeT + 0.028, BEAM.flangeZ - 0.10, BEAM.flangeZ, 'spreader-edge-b');

// --- Brazos telescopicos: seccion menor, salen del cajon hacia cada viga de extremo.
//     En 40 ft estan afuera del todo; en 20 ft entrarian hasta |x| = 3.0.
const ARM = { y0: 3.11, y1: 3.66, z: 0.195 };
for (const s of [-1, 1]) {
  addBoxRange(spreader, matStruct, s * 4.20, s * PIN_X, ARM.y0, ARM.y1, -ARM.z, ARM.z, 'spreader-telescopic-arm');
}

// --- Vigas de extremo: transversales, del ancho del contenedor (2.44 m), alojan los
//     twist-locks y los flippers.
//
//     A4 - PEDIDO DE JOHN: cerrar el gap. En A3 la cara inferior quedaba 124 mm sobre el
//     techo y la viga se leia FLOTANDO. Se cierra bajando y0 de 3.020 a 2.920, o sea la
//     viga pasa de 500 a 600 mm de canto (seccion cajon plausible para un spreader de
//     40 ft) y el techo queda a 24 mm: apoyada a la vista, sin interpenetrar.
//
//     Por que 24 mm y no 0: la altura de la viga es lo unico que deja ver el herraje del
//     twist-lock cuando el spreader se separa. Con la viga literalmente al ras, el pin
//     trabaja entero dentro del esquinero y en la retirada no queda un solo pixel de
//     twist-lock visible - se pierde justo el detalle que vende la coreografia.
//
//     y1 NO se toca: bajar tambien el ala superior desalinearia los brazos telescopicos
//     (ARM 3.11-3.66) y la carcasa del actuador, que cuelgan de y1. Todo lo demas que
//     depende del gap (buje, vastago del pin, pivote de flippers) esta parametrizado
//     contra END.y0 y se reacomoda solo.
const END = { y0: 2.920, y1: 3.520, halfX: 0.23, halfZ: 1.22 };
for (const s of [-1, 1]) {
  const cx = s * PIN_X;
  addBoxRange(spreader, matStruct, cx - END.halfX, cx + END.halfX, END.y0, END.y1, -END.halfZ, END.halfZ, 'spreader-end-beam');
  // Canto inferior de la viga de extremo (segunda superficie del tema accent).
  addBoxRange(spreader, matTrim, cx - END.halfX, cx + END.halfX, END.y0, END.y0 + 0.032, -END.halfZ - 0.012, END.halfZ + 0.012, 'spreader-end-edge');
  // Cartelas de union brazo/viga de extremo.
  addBoxRange(spreader, matWeb, cx - s * 0.60, cx - s * 0.22, 3.18, 3.42, -0.30, 0.30, 'spreader-gusset');
}

// --- Flippers (guias de esquina): placas que hacen de embudo para encarar las esquinas.
//
// CAMBIO 2026-08-06 (John, mirando el render de cerca: "las cosas de agarre parecen
// abiertas y no esta sujetando el contenedor"). Hasta aca quedaban desplegadas TODO el
// ciclo -- una simplificacion deliberada de la pasada anterior, que priorizo que la
// silueta se leyera como spreader a 200 px. A tamano real el precio se ve: cuatro placas
// abiertas hacia afuera leen como mordaza suelta, justo cuando el spreader esta cargando
// 30 toneladas.
//
// Ahora siguen a los TWIST-LOCKS, que es la regla mecanica y ademas la lectura intuitiva:
//     plegadas  = pins trabados  = esta agarrando
//     desplegadas = pins sueltos = solto la carga (y quedan listas para el proximo pick)
// No hace falta ningun tiempo nuevo: se derivan de pinAngleAt(), asi que la apertura de
// las guias y el giro de los pins son EL MISMO movimiento y no se pueden desincronizar.
// deg = desplegada (embudo, hacia afuera y abajo).  stowDeg = replegada.
// stow -85 y no 0: a 0 la placa queda HORIZONTAL, saliendo del costado como una repisa,
// que no es como se guarda una guia real ni lee como "recogido". A -85 sube y se acuesta
// contra la viga de extremo (la placa mide 0.62 y el pivote esta en y 2.94, o sea que la
// punta llega a ~3.56: justo el alto de la viga, 3.52). Queda compacta y pegada.
const FLIP = { len: 0.62, wide: 0.92, thick: 0.045, deg: 42, stowDeg: -85 };
const flipperPivots = [];
for (const [sx, sz] of PIN_SIGNS) {
  const pivot = new THREE.Group();
  pivot.position.set(sx * PIN_X, END.y0 + 0.02, sz * (END.halfZ + 0.012));
  pivot.rotation.x = sz * THREE.MathUtils.degToRad(FLIP.stowDeg);   // arranca REPLEGADA
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(FLIP.wide, FLIP.thick, FLIP.len),
    matFlipper
  );
  plate.position.set(0, -FLIP.thick / 2, sz * FLIP.len / 2);
  pivot.add(plate);
  pivot.name = 'spreader-flipper';
  pivot.userData.flipSign = sz;
  spreader.add(pivot);
  flipperPivots.push(pivot);
}

// Angulo de las guias para un instante dado, derivado del angulo del twist-lock:
// pin a 90 grados (trabado) -> 0 = plegada;  pin a 0 (suelto) -> FLIP.deg = desplegada.
function flipperAngleAt(t) {
  const trabado = pinAngleAt(t) / (Math.PI / 2);          // 1 trabado, 0 suelto
  const stow = THREE.MathUtils.degToRad(FLIP.stowDeg);
  const open = THREE.MathUtils.degToRad(FLIP.deg);
  return stow + (open - stow) * (1 - trabado);
}

// --- Twist-locks. Estructura fija por esquina (buje) + grupo giratorio (cabeza, vastago
//     e indicador). El giro es sobre el eje Y local del grupo.
//     Convencion, tomada del funcionamiento real: la elipse del agujero tiene su eje
//     mayor en X, asi que TRABADO = cabeza cruzada respecto al agujero (rotation.y = 90
//     grados) y DESTRABADO = cabeza alineada con el agujero (rotation.y = 0), unica
//     posicion en la que el pin puede salir. El indicador es solidario: trabado queda
//     perpendicular al eje largo del spreader, destrabado queda paralelo.
const pinGroups = [];
const PIN = {
  headX: 0.104, headZ: 0.056,     // 104 x 56 mm, ISO: pasa por la elipse de 124 x 63
  shankX: 0.098, shankZ: 0.050,
  headY0: 2.829, headY1: 2.871,   // alojada bajo la placa superior (cara interna 2.880)
  tipY0: 2.799,                   // punta conica, dentro de la camara (piso en 2.794)
  bossY0: 2.900, bossY1: END.y0   // buje visible bajo la viga de extremo
};
const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
const unitCone = new THREE.CylinderGeometry(0.5, 0.17, 1, 20);

for (const [sx, sz] of PIN_SIGNS) {
  const cx = sx * PIN_X;
  const cz = sz * PIN_Z;

  // Buje fijo: no gira. Es lo que apoya sobre la cara superior del esquinero.
  addBoxRange(spreader, matStruct, cx - 0.15, cx + 0.15, PIN.bossY0, PIN.bossY1, cz - 0.12, cz + 0.12, 'spreader-twistlock-boss');
  // Carcasa del actuador, sobre la viga de extremo.
  const housing = new THREE.Mesh(unitCyl, matWeb);
  housing.scale.set(0.30, 0.15, 0.30);
  housing.position.set(cx, END.y1 + 0.075, cz);
  housing.name = 'spreader-twistlock-housing';
  spreader.add(housing);

  const pin = new THREE.Group();
  pin.position.set(cx, 0, cz);
  pin.name = 'spreader-twistlock-pin';

  const shank = new THREE.Mesh(unitCyl, matHardware);
  shank.scale.set(PIN.shankX, PIN.bossY1 - PIN.headY1, PIN.shankZ);
  shank.position.set(0, (PIN.headY1 + PIN.bossY1) / 2, 0);
  pin.add(shank);

  const head = new THREE.Mesh(unitCyl, matHardware);
  head.scale.set(PIN.headX, PIN.headY1 - PIN.headY0, PIN.headZ);
  head.position.set(0, (PIN.headY0 + PIN.headY1) / 2, 0);
  pin.add(head);

  const tip = new THREE.Mesh(unitCone, matHardware);
  tip.scale.set(PIN.headX, PIN.headY0 - PIN.tipY0, PIN.headZ);
  tip.position.set(0, (PIN.tipY0 + PIN.headY0) / 2, 0);
  pin.add(tip);

  // Indicador mecanico: barra plana solidaria al eje. Es lo UNICO del destrabe que se ve
  // desde afuera, porque el pin trabaja dentro del esquinero.
  const ind = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.13, 0.10), matIndicator);
  ind.position.set(0, END.y1 + 0.21, 0);
  pin.add(ind);
  const indHub = new THREE.Mesh(unitCyl, matHardware);
  indHub.scale.set(0.15, 0.15, 0.15);
  indHub.position.set(0, END.y1 + 0.21, 0);
  pin.add(indHub);

  pin.rotation.y = Math.PI / 2;   // arranca trabado
  spreader.add(pin);
  pinGroups.push(pin);
}

// --- Headblock: plataforma de la que cuelga la viga principal y donde estan las poleas.
const HB = { halfX: 2.10, y0: 3.90, y1: 4.40, halfZ: 0.90 };
addBoxRange(spreader, matWeb, -HB.halfX, HB.halfX, HB.y0, HB.y1, -HB.halfZ, HB.halfZ, 'spreader-headblock');
addBoxRange(spreader, matStruct, -HB.halfX - 0.10, HB.halfX + 0.10, HB.y1, HB.y1 + 0.06, -HB.halfZ - 0.07, HB.halfZ + 0.07, 'spreader-headblock-top');
for (const [sx, sz] of PIN_SIGNS) {
  // Pivotes headblock / viga principal.
  addBoxRange(spreader, matStruct, sx * 1.55 - 0.09, sx * 1.55 + 0.09, BEAM.webY1 + BEAM.flangeT, HB.y0, sz * 0.26 - 0.09, sz * 0.26 + 0.09, 'spreader-pivot');
  // Bloques de polea en las cuatro esquinas del headblock: de ahi salen los cables.
  addBoxRange(spreader, matStruct, sx * 1.86 - 0.14, sx * 1.86 + 0.14, HB.y1 + 0.06, HB.y1 + 0.28, sz * 0.76 - 0.12, sz * 0.76 + 0.12, 'spreader-sheave');
}

// --- Cables de izaje: cuatro tramos que suben desde las poleas y salen del cuadro. Se
//     modelan como cilindros porque una THREE.Line no tiene ancho real en pixeles con
//     WebGL2 (linewidth se ignora) y a esta distancia una linea de 1 px no se ve.
//     Convergen 3.0 grados hacia el trolley: suficiente para que lean como cables
//     tensados de una grua y no como cuatro postes verticales.
const CABLE_TOP_Y = 30.0;
function addCable(x0, y0, z0, x1, y1, z1, r) {
  const a = new THREE.Vector3(x0, y0, z0);
  const b = new THREE.Vector3(x1, y1, z1);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, 8, 1, true);
  const m = new THREE.Mesh(g, matCable);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.name = 'spreader-cable';
  spreader.add(m);
  return m;
}
for (const [sx, sz] of PIN_SIGNS) {
  addCable(sx * 1.86, HB.y1 + 0.22, sz * 0.76, sx * 0.62, CABLE_TOP_Y, sz * 0.26, 0.048);
}

applySpreaderTheme(spreaderTheme);
spreader.userData.measurementExempt = true;
spreader.traverse((o) => { o.userData.measurementExempt = true; });

// =====================================================================================
// A4 (1d): EL SPREADER TAMBIEN PROYECTA.
// Es la mitad de lo que vende la escena: mientras esta trabado encima, las vigas de
// extremo, el headblock y los bujes de twist-lock dibujan su sombra SOBRE EL TECHO del
// contenedor. En la foto de referencia esa franja existe (ahi es tapado directo, aca es
// sombra proyectada porque la camara ve el techo en escorzo).
// EXCEPCION: los cables. Suben hasta y = 30 y ni siquiera entran en el box de sombra;
// dibujarlos en el shadow pass serian 4 draw calls tirados por frame sin un solo pixel
// de resultado. castShadow=false explicito.
// receiveShadow SI en todo: el headblock recibe la sombra de sus propias poleas y las
// vigas de extremo la de los flippers - son las cavidades chicas de AO dura que la
// referencia identifica como el segundo cue mas fuerte de "esto es una foto".
// =====================================================================================
let spreaderShadowMeshes = 0, spreaderCablesSkipped = 0;
spreader.traverse((o) => {
  if (!o.isMesh) return;
  o.receiveShadow = true;
  if (o.name === 'spreader-cable') { o.castShadow = false; spreaderCablesSkipped++; return; }
  o.castShadow = true;
  spreaderShadowMeshes++;
});
// AABB local del spreader completo (incluye los cables). El test de "salio de cuadro"
// proyecta estas 8 esquinas: si todas caen sobre el borde superior, no queda un solo
// pixel de spreader adentro.
const spreaderLocalBox = new THREE.Box3().setFromObject(spreader);
scene.add(spreader);

// ---- Encuadre (identico a A-nocturna: por vertice/eje, sensible al aspect real). ----
function frameDistance(cam, box, azimuthDeg, elevationDeg, margin) {
  const center = box.getCenter(new THREE.Vector3());
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  const dir = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  const forward = dir.clone().negate();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const vHalf = THREE.MathUtils.degToRad(cam.fov) / 2;
  const hHalf = Math.atan(Math.tan(vHalf) * cam.aspect);
  let distance = 0;
  const corner = new THREE.Vector3();
  const rel = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    rel.subVectors(corner, center);
    const x = rel.dot(right);
    const y = rel.dot(up);
    const z = rel.dot(forward);
    distance = Math.max(distance, Math.abs(x) / Math.tan(hHalf) - z, Math.abs(y) / Math.tan(vHalf) - z);
  }
  return { dir, distance: distance * margin, center };
}

// Composicion desktop: el contenedor ocupa el 60% derecho del frame. La camara se
// posiciona mirando al centro real, pero el punto de "lookAt" se desplaza en X negativo
// (mundo) - eso rota la mira de la camara hacia la izquierda y, por paralaje, el
// contenedor (que no se movio) aparece corrido hacia la derecha en pantalla.
const AZIMUTH = 28;
const ELEVATION = 10;
const DESKTOP_TARGET_OFFSET_X = -2.6;
// Con el dolly del efecto 4 el contenedor crece 13.6% y el borde inferior se iba del
// frame (medido: bottom = 900 px justo en el borde de un viewport de 900). Bajar la mira
// sube el modelo en pantalla y devuelve margen abajo sin tocar el encuadre de reposo.
const DESKTOP_TARGET_OFFSET_Y_ZOOM = -0.25;

const framing = { dir: new THREE.Vector3(1, 0, 0), distance: 20, center: new THREE.Vector3(),
                  desktop: true, cardNdcX: -1, targetOffsetX: DESKTOP_TARGET_OFFSET_X,
                  sweepNdc: null };
const loginCardEl = document.querySelector('.login-card');

function applyFraming() {
  const isMobile = mobileQuery.matches;
  const f = frameDistance(camera, modelBox, AZIMUTH, ELEVATION, isMobile ? 1.35 : 1.22);
  framing.dir.copy(f.dir);
  framing.distance = f.distance;
  framing.center.copy(f.center);
  framing.desktop = !isMobile;
  // Borde derecho de la card en NDC (+12 px de aire). Se lee una vez por resize, no por
  // frame: es una constante de layout, no un valor continuo.
  const cardRight = loginCardEl.getBoundingClientRect().right + 12;
  framing.cardNdcX = (cardRight / window.innerWidth) * 2 - 1;

  // =====================================================================================
  // QUE EL CONTENEDOR NO SE META DETRAS DE LA CARD, EN NINGUN ANGULO DE GIRO.
  //
  // PEDIDO DE JORGE SEBASTIAN ROJAS (2026-08-06, por mail): "la parte izquierda queda
  // atras del cuadro del login, si es viable correr la rotacion mas a la derecha... puede
  // ser que no quede superpuesta esa interaccion cuando gira el cont".
  //
  // MEDIDO ANTES DEL FIX a 1600x950: borde de la card en NDC -0.330, y el contenedor al
  // girar llegaba a -0.661 -> se metia 0.331 de ancho de pantalla (265 px). El peor caso
  // NO es el encuadre de reposo sino un yaw intermedio (72 grados), por eso correrlo una
  // vez a ojo no alcanza: hay que resolverlo para TODO el giro.
  //
  // El volumen que barre el contenedor al rotar sobre su eje Y es un CILINDRO de radio R
  // (la esquina mas lejana del eje) y de la altura de la caja. Se resuelve contra ese
  // cilindro, asi que la garantia vale para cualquier angulo, presente o futuro, sin
  // depender de que alguien vuelva a mirar.
  const R = Math.max(
    Math.hypot(modelBox.min.x, modelBox.min.z), Math.hypot(modelBox.min.x, modelBox.max.z),
    Math.hypot(modelBox.max.x, modelBox.min.z), Math.hypot(modelBox.max.x, modelBox.max.z)
  );
  const MARGEN = 0.02;                                   // 1% de pantalla de aire por lado
  const limIzq = framing.desktop ? framing.cardNdcX + MARGEN : -1 + MARGEN;
  const limDer = 1 - MARGEN;

  // Proyecta el cilindro barrido para un (corrimiento, escala de distancia) candidatos y
  // devuelve sus bordes en NDC. Guarda y restaura la camara: no deja estado sucio.
  const probe = new THREE.Vector3();
  function bordesNdc(shift, scale) {
    const posPrev = camera.position.clone(), quatPrev = camera.quaternion.clone();
    camera.position.copy(f.center).addScaledVector(f.dir, f.distance * scale);
    probe.copy(f.center);
    if (framing.desktop) probe.x += shift;
    camera.lookAt(probe);
    camera.updateMatrixWorld(true);
    let izq = 1, der = -1;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      for (const y of [modelBox.min.y, modelBox.max.y]) {
        probe.set(x, y, z).project(camera);
        if (probe.x < izq) izq = probe.x;
        if (probe.x > der) der = probe.x;
      }
    }
    camera.position.copy(posPrev); camera.quaternion.copy(quatPrev);
    camera.updateMatrixWorld(true);
    return { izq, der };
  }

  // Solver: ALEJA lo justo para que el ancho barrido entre en el hueco, y CENTRA en el
  // hueco. El paso de centrado NO estima cuanto NDC mueve un metro de mira: lo MIDE con
  // dos sondas (secante). Estimarlo con la formula del fov daba un error que dejaba el
  // borde a -0.340 contra un limite de -0.310 despues de 4 vueltas; medido, cierra en 2.
  const hueco = limDer - limIzq;
  const centroObjetivo = (limIzq + limDer) / 2;
  let shift = DESKTOP_TARGET_OFFSET_X;
  let scale = 1;
  for (let i = 0; i < 10; i++) {
    const b = bordesNdc(shift, scale);
    const ancho = b.der - b.izq;
    if (ancho > hueco) { scale *= (ancho / hueco) * 1.01; continue; }   // no entra: alejar
    const delta = centroObjetivo - (b.izq + b.der) / 2;
    if (Math.abs(delta) < 0.002) break;
    const sonda = bordesNdc(shift - 1, scale);                          // 1 m de corrimiento
    const ndcPorMetro = (sonda.izq + sonda.der) / 2 - (b.izq + b.der) / 2;
    if (Math.abs(ndcPorMetro) < 1e-6) break;
    shift -= delta / ndcPorMetro;
  }
  // Red de seguridad: si por lo que sea el invariante no cerro, se aleja hasta que cierre.
  // Preferible un contenedor 3% mas chico que uno pisando el formulario.
  for (let g = 0; g < 8; g++) {
    const b = bordesNdc(shift, scale);
    if (b.izq >= limIzq - 0.002 && b.der <= limDer + 0.002) break;
    scale *= 1.03;
  }
  framing.distance = f.distance * scale;
  framing.targetOffsetX = framing.desktop ? shift : 0;
  const fin = bordesNdc(shift, scale);
  framing.sweepNdc = [+fin.izq.toFixed(3), +fin.der.toFixed(3)];

  // ---- ACERCAMIENTO A LA PUERTA (A4). El factor NO es una constante tanteada. ----
  // Un numero fijo se rompe: con el encuadre de reposo calculado para el LADO LARGO
  // (12.19 m) y la testera midiendo 2.44 m, cualquier fraccion "linda" de la distancia
  // mete la camara adentro del contenedor. Medido con dollyTo = 0.46: la camara quedaba a
  // 3.3 m de la cara de puertas, o sea MAS CERCA que el ancho de la propia cara, y el
  // cuadro se volvia ilegible.
  //
  // Se resuelve al reves: se fija cuanto tiene que MEDIR la testera en pantalla y de ahi
  // sale la distancia. La cara de puertas esta en el extremo +X del modelo, o sea a
  // modelBox.max.x del centro medido sobre la direccion de vista (tras el giro, +X apunta
  // a camara). Entonces:
  //     distancia a la CARA  = altura_util / (2 tan(fov/2))
  //     distancia al CENTRO  = distancia a la cara + medio largo
  const halfLen = Math.abs(modelBox.max.x - f.center.x);
  const faceH = modelBox.max.y - modelBox.min.y;
  // Cuanto del alto del cuadro ocupa la testera al final: 0.58 deja la apertura grande y
  // todavia con aire arriba y abajo.
  //
  // EN MOBILE NO HAY ACERCAMIENTO (doorDolly = 1), y no es por vagancia: la card ocupa la
  // mitad inferior de la pantalla con un scrim encima, asi que del contenedor solo se ve
  // una banda arriba. MEDIDO a 390x844 pidiendo FACE_FILL 0.42: el vano de la puerta caia
  // en NDC y = [-0.38, 0.40], o sea JUSTO detras de la card - la camara se acercaba para
  // mostrar una apertura que quedaba tapada, y lo unico que se veia era chapa teal
  // llenando la pantalla. El giro y la apertura siguen pasando (que es el pedido de John);
  // lo que se saca es el movimiento de camara, que ahi no compra nada.
  const FACE_FILL = 0.58;
  const dFace = (faceH / FACE_FILL) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  // Piso de seguridad: nunca mas cerca que el ancho de la propia testera, o la
  // perspectiva se deforma y las hojas abiertas salen del cuadro.
  const faceW = modelBox.max.z - modelBox.min.z;
  const rawDolly = (Math.max(dFace, faceW) + halfLen) / f.distance;
  framing.doorDolly = isMobile ? 1 : Math.min(1, Math.max(0.35, rawDolly));
  // near fijo y chico: la secuencia de login mete la camara ADENTRO del contenedor, con
  // el near derivado de la distancia (D - 15) todo el interior quedaria clipeado.
  camera.near = 0.1;
  camera.far = f.distance + 45;
  camera.updateProjectionMatrix();
  scene.fog.near = Math.max(0.1, f.distance + FOG_NEAR_OFFSET);
  scene.fog.far = f.distance + FOG_FAR_OFFSET;
}

function resizeRendererAndCamera() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  applyFraming();
}

resizeRendererAndCamera();
window.addEventListener('resize', resizeRendererAndCamera);
mobileQuery.addEventListener('change', applyFraming);

// =====================================================================================
// EASINGS ESCRITOS A MANO (sin librerias).
// =====================================================================================

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// DESCENSO DE GRUA. Reemplaza al "drop and bounce" de A2: una grua no deja caer y no
// rebota. La curva NO se escribio como un easing de catalogo sino integrando un perfil
// de VELOCIDAD, que es lo que en la realidad controla el operador y el variador:
//   [0, A)   arranque: la velocidad sube linealmente de 0 a 1 (el motor toma carga)
//   [A, B)   crucero: velocidad constante, el tramo largo del recorrido
//   [B, 1]   soft landing: v = (1-w)^2, llega a cero con aceleracion tambien cero
// Integrando: el 78% del recorrido se hace en el 55% del tiempo y el ultimo 22% se
// arrastra en el 45% restante. Eso es exactamente lo que se ve en un muelle: el
// contenedor viene rapido y los ultimos metros los baja al paso.
// Devuelve 0 (arriba) -> 1 (abajo). Derivada final nula: no hay impacto ni rebote.
const CRANE_A = 0.12;
const CRANE_B = 0.55;
const CRANE_S = CRANE_A / 2 + (CRANE_B - CRANE_A) + (1 - CRANE_B) / 3;   // = 0.64
function easeCraneDescent(t) {
  const u = clamp01(t);
  let s;
  if (u < CRANE_A) {
    s = (u * u) / (2 * CRANE_A);
  } else if (u < CRANE_B) {
    s = CRANE_A / 2 + (u - CRANE_A);
  } else {
    const w = (u - CRANE_B) / (1 - CRANE_B);
    s = CRANE_A / 2 + (CRANE_B - CRANE_A) + (1 - CRANE_B) * (1 - Math.pow(1 - w, 3)) / 3;
  }
  return s / CRANE_S;
}

function easeInOutCubic(t) {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// Damping por lerp independiente del framerate: a 60 fps el factor efectivo es
// exactamente `k` por frame; a 30 o 144 fps la constante de tiempo es la misma.
function damp(k, delta) {
  return 1 - Math.pow(1 - k, delta * 60);
}

// =====================================================================================
// ESTADO CONTINUO (variables de modulo, nunca en el DOM).
// =====================================================================================

// =====================================================================================
// EFECTO 1 (A3): COREOGRAFIA DE POSADO. Cinco tramos sobre el reloj del rAF, nunca sobre
// reloj de pared. Total 4.40 s.
//
//   0.00 - 2.20  descenso    contenedor + spreader bajan juntos de y=4.50 a y=0.04
//                            con easeCraneDescent (velocidad pico 3.2 m/s)
//   2.20 - 2.50  asentamiento  los ultimos 40 mm, easeInOutCubic: entra y sale con
//                            velocidad cero, o sea sin golpe y sin rebote
//   2.50 - 2.90  destrabe    los cuatro twist-locks giran 90 -> 0 grados (400 ms)
//   2.90 - 3.05  confirmacion  pausa muerta, el sistema "lee" los sensores
//   3.05 - 4.40  retirada    el spreader sube 8.4 m acelerando (w^2, velocidad final
//                            9.7 m/s). Cruza el borde superior del cuadro a los 1.04 s
//                            de arrancar; los 0.31 s que quedan ya no se ven.
//
// La autorotacion del contenedor arranca cuando el spreader sale de cuadro DE VERDAD
// (test de proyeccion cada frame), no a un tiempo fijo: si el viewport cambia de alto,
// el momento correcto cambia solo.
// =====================================================================================
// CAMBIO 2026-08-06 (pedido de John): "que entre a pantalla desde arriba".
// Antes hangY era 4.50 y la camara SUBIA a buscarlo (FOLLOW_RISE 3.95), asi que al
// aparecer el contenedor ya estaba en cuadro, colgado del spreader, y solo se veia el
// ultimo tramo. Ahora la camara no se mueve (FOLLOW_RISE 0) y el conjunto arranca POR
// ENCIMA del borde superior, o sea entra a cuadro cayendo.
//
// hangY 7.60 no es a ojo: a la distancia de encuadre el cuadro cubre 11.60 m de alto
// centrados en y = 1.44, asi que el borde superior cae en y = 7.24 (medido en browser).
// Con la base del contenedor en 7.60 quedan 36 cm de aire por encima del borde: el
// contenedor esta afuera y entra, y el spreader (4.4 m mas arriba) y sus cables ya vienen
// bajando por el borde antes que el.
//
// Los tiempos se corrieron porque el recorrido paso de 4.50 a 7.60 m (+69%). descentDur
// va a 3.20 (+45%, no +69%: baja un poco mas rapido a proposito, si no la entrada se
// hacia pesada) y todo lo que venia despues se desplaza 1.00 s para no pisarse.
const LAND = {
  hangY: 7.60,
  descentDur: 3.20,
  settleDrop: 0.040,
  settleDur: 0.30,
  unlockStart: 3.50,
  unlockDur: 0.40,
  liftStart: 4.05,
  liftDur: 1.35,
  // 8.4 m no es un numero lindo: es el que hace que el pin mas bajo cruce el borde
  // superior del cuadro a los 1.04 s de arrancar la subida (medido: hace falta 4.97 m de
  // recorrido para que la ultima esquina pase NDC 1.02). Con liftRise mas alto la
  // retirada se resolvia en 0.91 s y quedaba apurada.
  liftRise: 8.4,
  liftExp: 2.0,
  total: 5.40
};
let landT = 0;
let landRunning = false;
let spreaderActive = true;      // false cuando ya salio de cuadro: deja de costar frames
let liftCaptured = false;
const liftBasePos = new THREE.Vector3();
const liftBaseQuat = new THREE.Quaternion();

// Efecto 2: parallax de mouse.
const PARALLAX_Y = 0.10;   // rad de rotacion sobre el eje Y por unidad de mouse x
const PARALLAX_X = 0.045;  // rad de rotacion sobre el eje X por unidad de mouse y
const PARALLAX_DAMP = 0.06;
let pointerTargetX = 0, pointerTargetY = 0;
let pointerX = 0, pointerY = 0;

// Autorotacion base (se conserva de A-nocturna); el parallax se SUMA a ella.
// A3: arranca APAGADA. La enciende updateSpreader() cuando el spreader sale de cuadro.
const AUTOROTATE = 0.072;
let autoYaw = 0;
let autoRotateEnabled = false;

// Efecto 4: dolly de foco.
const DOLLY_ZOOM = 0.88;
const DOLLY_DAMP = 0.07;
let dollyTarget = 1;
let dolly = 1;

// SEGUIMIENTO DE GRUA. Sin esto el estado colgado sencillamente NO SE VE: medido con el
// encuadre base, el borde superior del cuadro cae en y = 5.82 y el techo del contenedor
// a y = 4.50 de altura queda en NDC 1.538, o sea 27% por encima del borde. La camara
// acompana la carga y vuelve al encuadre de reposo exacto al apoyar.
// FOLLOW_RISE se calculo, no se tanteo: el cuadro cubre 5.85 m de altura a la distancia
// de encuadre y esta centrado en y = 2.897; el conjunto colgado ocupa de 4.50 a 9.18
// (centro 6.84), asi que hacen falta 3.95 m de paneo. FOLLOW_ZOOM abre un 12% mas para
// dejar aire arriba y abajo (0.94 m por lado en vez de 0.58).
// followF = 1 colgando, 0 apoyado. Lo escribe updateCamera desde model.position.y.
// A partir del 2026-08-06 la camara NO sigue la carga. El seguimiento existia para que el
// estado colgado se viera (con hangY 4.50 quedaba 27% por encima del borde); ahora el
// contenedor arranca afuera A PROPOSITO y tiene que ENTRAR al cuadro, asi que si la camara
// lo fuera a buscar se perderia justamente el efecto que se busca. Encuadre fijo = el
// aprobado. Se dejan en 0 y 1 en vez de borrar el mecanismo: followF sigue calculandose y
// alcanza con volver a subir estos dos numeros para recuperar el comportamiento viejo.
const FOLLOW_RISE = 0;
const FOLLOW_ZOOM = 1;
let followF = 0;

// Efecto 5: secuencia de login.
//
// A4 - PEDIDO DE JOHN (2026-08-05): "al hacer el ingreso hacer que el contenedor primero
// gire a la puerta y se muestre la apertura". El VUELO DE CAMARA de A3 (bezier que entraba
// por el vano hasta el fondo ciego) SE ELIMINA. Ahora manda el objeto, no la camara:
//
//   1. GIRO   el contenedor rota sobre su propio eje Y hasta presentar la cara de puertas
//   2. APERTURA  recien ahi abren las dos hojas
//   3. ACERCAMIENTO  la camara solo empuja de frente (dolly), no viaja ni entra
//
// POR QUE EL ACERCAMIENTO NO ES OPCIONAL: girando a la cara de puertas lo que mira a
// camara pasa de un lateral de 12.19 m a una testera de 2.44 m. Con la distancia de
// encuadre de reposo (calculada para el lado largo) la apertura quedaria del tamano de una
// estampilla. SEQ.dollyTo compensa exactamente eso; no es un efecto, es correccion de
// encuadre. Se aplica sincronico a seqT y saltea maxSafeDolly() a proposito: el clamp
// existe para que el LADO LARGO no se salga del cuadro, y aca ya no lo estamos mirando.
const SEQ = {
  turnStart: 0.00,
  turnDur: 1.25,
  // Las puertas arrancan 0.10 s ANTES de que el giro termine: el solape saca la sensacion
  // de dos animaciones encoladas y el ojo lee un solo movimiento continuo.
  doorRightStart: 1.15,
  doorLeftStart: 1.30,
  doorDur: 1.15,
  doorAngle: 120,
  dollyStart: 1.15,
  dollyDur: 1.45,
  // dollyTo YA NO ES UNA CONSTANTE: lo calcula applyFraming() como framing.doorDolly a
  // partir del fov real y del tamano de la testera (ver ahi el por que). Se deja este
  // valor solo como fallback defensivo si alguien llama a la secuencia antes del primer
  // applyFraming(), que no puede pasar hoy porque resizeRendererAndCamera() corre al cargar.
  dollyToFallback: 0.72,
  fadeStart: 2.35,
  fadeDur: 0.95,
  finalAt: 3.40,
  // Reduced motion: sin giro, sin puertas ni acercamiento, solo fade directo.
  fadeDurReduced: 0.60,
  finalAtReduced: 0.65
};
let seqRunning = false;
let seqT = 0;
let fadeOpacity = 0;
let turnCaptured = false;
let finalShown = false;

// ---- GIRO A LA PUERTA: el angulo NO esta tanteado, sale de la geometria. ----
// Las puertas viven en el +X local del modelo (es el mismo eje que usaba el bezier de A3:
// su punto de control estaba en x = +10.5, o sea afuera del vano). Una rotacion de yaw t
// manda el +X local a (cos t, 0, -sin t), cuyo azimut en el plano XZ es -t.
// La camara esta en azimut AZIMUTH (28 grados) por construccion de frameDistance().
// Para que la cara de puertas mire a camara hace falta -t = AZIMUTH, o sea t = -AZIMUTH.
const DOOR_FACE_YAW = -THREE.MathUtils.degToRad(AZIMUTH);
let turnFromYaw = 0;
let turnToYaw = 0;

// Diferencia angular llevada al rango (-PI, PI]: garantiza que el contenedor gire SIEMPRE
// por el lado corto. Sin esto, con la autorotacion acumulada de un usuario que dejo la
// pantalla abierta un rato, el giro podia salir por el lado largo y dar casi una vuelta.
function shortestAngle(delta) {
  return delta - Math.PI * 2 * Math.round(delta / (Math.PI * 2));
}

// Reutilizables por frame (cero allocs en el loop).
// tmpA / tmpB se fueron junto con el vuelo de camara de A3: eran los acumuladores de la
// bezier de entrada. El giro a la puerta es escalar; doorAim es el unico vector que
// sobrevive, y es el punto de mira sobre la cara de puertas (ver updateCamera).
const lookTarget = new THREE.Vector3();
const doorAim = new THREE.Vector3();

// ---- Listeners: SOLO guardan el target, no calculan nada. ----
// (nombrado para poder removerlo en dispose())
const onPointerMove = (ev) => {
  pointerTargetX = (ev.clientX / window.innerWidth) * 2 - 1;
  pointerTargetY = (ev.clientY / window.innerHeight) * 2 - 1;
};
window.addEventListener('pointermove', onPointerMove);

// =====================================================================================
// PRIMER RENDER: NO SE ESPERAN LAS TEXTURAS.
//
// Antes se esperaban las 31 con techo de 20 s. En una conexion rapida no se notaba; en
// una de ~100 KB/s (la de la oficina, medida) eran 9 SEGUNDOS de pantalla sin contenedor
// -- contados por John en una ventana de incognito. Y encima, si el techo saltaba, lo
// primero que aparecia era el contenedor a medio texturar.
//
// Ahora el gate solo espera a que el loader ARRANQUE (o 500 ms si no hay texturas), y el
// contenedor entra en escena ya pintado con los colores planos de marca del bloque de
// arranque en frio. Las texturas se incorporan solas, por frame, via settleColdStart().
// El cambio es de PERCEPCION, no de resultado: el estado final es identico: lo unico que
// cambia es que se ve algo correcto a los ~2 s en vez de nada a los 9.
const texWait = await new Promise((resolve) => {
  const t0 = performance.now();
  const tick = () => {
    if (disposed) return resolve('disposed');
    if (texState.started) return resolve('started');
    if (performance.now() - t0 > 500) return resolve('no-textures');
    setTimeout(tick, 30);
  };
  tick();
});
// una imagen recien decodificada no esta subida a la GPU hasta el siguiente frame
await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

// =====================================================================================
// ACTUALIZADORES (uno por efecto). Todos leen delta y escriben estado, nada mas.
// =====================================================================================

// Altura del contenedor para un instante cualquiera de la coreografia. Es una FUNCION
// PURA del tiempo (no acumula estado): por eso seekLand() puede saltar a cualquier
// momento, hacia adelante o hacia atras, y todo queda coherente.
function containerYAt(t) {
  if (t <= 0) return LAND.hangY;
  if (t < LAND.descentDur) {
    return LAND.hangY - (LAND.hangY - LAND.settleDrop) * easeCraneDescent(t / LAND.descentDur);
  }
  const w = clamp01((t - LAND.descentDur) / LAND.settleDur);
  return LAND.settleDrop * (1 - easeInOutCubic(w));
}

// Angulo del twist-lock en radianes. 90 grados = trabado (cabeza cruzada al agujero),
// 0 = destrabado (cabeza alineada con la elipse, unica posicion en la que puede salir).
function pinAngleAt(t) {
  const p = easeInOutCubic(clamp01((t - LAND.unlockStart) / LAND.unlockDur));
  return (Math.PI / 2) * (1 - p);
}

function liftAt(t) {
  if (t <= LAND.liftStart) return 0;
  const w = clamp01((t - LAND.liftStart) / LAND.liftDur);
  return LAND.liftRise * Math.pow(w, LAND.liftExp);
}

function updateLand(delta) {
  if (reduced()) {
    // Sin descenso ni spreader: el contenedor aparece apoyado y quieto, igual que A2.
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

function updateParallax(delta) {
  if (reduced()) {
    model.rotation.set(0, 0, 0);
    return;
  }
  // A4: durante la secuencia el yaw lo escribe updateSequence() (giro a la puerta), asi
  // que la autorotacion NO puede seguir sumando o se pelearia con el destino.
  if (autoRotateEnabled && !seqRunning) autoYaw += AUTOROTATE * delta;
  // Durante la secuencia el target se va a cero: el modelo se endereza solo.
  const tx = seqRunning ? 0 : pointerTargetX;
  const ty = seqRunning ? 0 : pointerTargetY;
  const k = damp(PARALLAX_DAMP, delta);
  pointerX += (tx - pointerX) * k;
  pointerY += (ty - pointerY) * k;
  model.rotation.y = autoYaw + pointerX * PARALLAX_Y;
  model.rotation.x = pointerY * PARALLAX_X;
}

function updateMouseLight() {
  if (reduced()) {
    // Luz fija y centrada: sigue sumando relieve al corrugado, pero no se mueve.
    mouseLight.position.set(0, LIGHT_BASE_Y, LIGHT_Z);
    return;
  }
  // Usa el mismo valor damped que el parallax: la luz y la rotacion viajan juntas.
  mouseLight.position.set(pointerX * LIGHT_SPAN_X, LIGHT_BASE_Y - pointerY * LIGHT_SPAN_Y, LIGHT_Z);
}

function updateContactShadow() {
  // A4: MODULACION INVERTIDA respecto de A3, porque cambio el reparto de trabajo.
  // En A3 la horneada era LA sombra, asi que se oscurecia al apoyar (0.12 -> 1.00 de
  // factor). En A4 la sombra proyectada real toma el mando en cuanto el contenedor entra
  // en el box de sombra, y si la horneada siguiera subiendo se sumarian las dos y el
  // apoyo quedaria con el doble de negro del que corresponde.
  // Ahora la horneada hace lo contrario: fuerte y grande EN EL AIRE (donde la proyectada
  // cae fuera del box, a x = 11.7..15.3 m) y baja a un residuo de 0.15 al apoyar. Ese
  // residuo no es cero a proposito: hace de AO de contacto bajo el bastidor, que es la
  // unica sombra que un shadow map de una sola direccion no puede dar.
  // El cruce entre las dos es continuo porque las dos leen la MISMA variable, la altura
  // real del modelo - no hay dos relojes que puedan desincronizarse.
  const h = clamp01(model.position.y / LAND.hangY);
  const k = 1 - h;
  contactShadow.material.opacity = SHADOW_OPACITY * (0.15 + 0.85 * h);
  const s = 1.30 - 0.30 * k;
  contactShadow.scale.set(s, s, 1);
  // Solo el yaw del modelo: la sombra se queda en el piso, no sube con la caida.
  // Tras rotation.x = -90 deg el giro propio del plano (rotation.z) mapea 1:1 al giro
  // en el plano XZ del mundo.
  contactShadow.rotation.set(-Math.PI / 2, 0, model.rotation.y);
  contactShadow.updateMatrix();
}

function updateSequence(delta) {
  if (!seqRunning) return;
  seqT += delta;

  if (!reduced()) {
    // ---- PASO 1: giro a la cara de puertas. ----
    // El destino se captura UNA vez, en el primer frame de la secuencia, y no en
    // startLoginSequence(): asi el angulo de partida es el yaw REAL del frame en que
    // arranca el giro (la autorotacion pudo avanzar entre el submit y este frame) y el
    // camino corto se calcula sobre ese valor, no sobre uno viejo.
    if (!turnCaptured) {
      turnCaptured = true;
      turnFromYaw = autoYaw;
      turnToYaw = autoYaw + shortestAngle(DOOR_FACE_YAW - autoYaw);
    }
    const turnP = easeInOutCubic(clamp01((seqT - SEQ.turnStart) / SEQ.turnDur));
    autoYaw = turnFromYaw + (turnToYaw - turnFromYaw) * turnP;

    // ---- PASO 2: apertura de las hojas. ----
    const rightP = clamp01((seqT - SEQ.doorRightStart) / SEQ.doorDur);
    const leftP = clamp01((seqT - SEQ.doorLeftStart) / SEQ.doorDur);
    runtime.setDoorAngle('right', SEQ.doorAngle * easeInOutCubic(rightP));
    runtime.setDoorAngle('left', SEQ.doorAngle * easeInOutCubic(leftP));
  }

  // El fade lo maneja el MISMO reloj que las puertas y la camara. Con una transicion CSS
  // (reloj de pared) un frame lento desincroniza: el negro llega antes que la camara.
  const fadeStart = reduced() ? 0 : SEQ.fadeStart;
  const fadeDur = reduced() ? SEQ.fadeDurReduced : SEQ.fadeDur;
  const target = clamp01((seqT - fadeStart) / fadeDur);
  if (Math.abs(target - fadeOpacity) > 0.004 || (target === 1 && fadeOpacity !== 1)) {
    fadeOpacity = target;
    fadeEl.style.opacity = String(target);
  }

  if (!finalShown && seqT >= (reduced() ? SEQ.finalAtReduced : SEQ.finalAt)) {
    finalShown = true;
    showFinalState();
  }
}

function updateCamera(delta) {
  // El modelo ya tiene su transform final de este frame: se refresca SOLO la matriz del
  // root (no el subarbol) para poder usar localToWorld en el camino de la camara.
  model.updateWorldMatrix(true, false);

  // El seguimiento se deriva de la ALTURA REAL de la carga, no de un reloj propio: asi
  // la camara y el contenedor comparten exactamente la misma curva (incluido el
  // asentamiento final) sin poder desincronizarse nunca.
  followF = reduced() ? 0 : clamp01(model.position.y / LAND.hangY);

  // A4: el vuelo de camara de A3 (bezier que entraba por el vano) ESTA ELIMINADO.
  // Durante la secuencia la camara se queda en el eje de encuadre y solo ACERCA, en el
  // mismo reloj que el giro y las puertas. Ver el comentario de SEQ.
  if (seqRunning && !reduced()) {
    autoRotateEnabled = false;
    const p = easeInOutCubic(clamp01((seqT - SEQ.dollyStart) / SEQ.dollyDur));
    // Sincronico a seqT, no amortiguado: un damp() aca haria que el acercamiento llegue
    // tarde respecto de la apertura en un frame lento, y el fade taparia el momento.
    // maxSafeDolly() se saltea A PROPOSITO (ver SEQ): el clamp cuida el lado largo del
    // contenedor, que a esta altura ya no es lo que mira a camara.
    const dollyEnd = framing.doorDolly ?? SEQ.dollyToFallback;
    dolly = 1 + (dollyEnd - 1) * p;
    dollyTarget = dolly;
    placeCamera(dolly);

    // ---- REENCUADRE A LA TESTERA. ----
    // placeCamera() apunta al CENTRO del contenedor, que esta 6.1 m DETRAS de la cara de
    // puertas. Con la camara picada 10 grados, esos 6.1 m valen 6.1*tan(10) = 1.06 m de
    // caida del rayo de vision: la testera queda 0.8 m por DEBAJO del centro de pantalla y
    // el borde inferior de las hojas se corta contra el borde del viewport. Medido: sin
    // esta correccion el piso del contenedor cae en y = 940 px de 950.
    // La correccion es apuntar a la CARA, no al centro. Como el punto nuevo esta sobre la
    // misma linea de vision (solo mas cerca), la camara no gira en horizontal: solo
    // levanta el picado, que es exactamente lo que hace falta.
    if (framing.desktop) {
      doorAim.set(modelBox.max.x, framing.center.y, framing.center.z);
      model.localToWorld(doorAim);
      doorAim.x += framing.targetOffsetX;          // se conserva el corrimiento de la card
      lookTarget.lerp(doorAim, p);
      camera.lookAt(lookTarget);
      camera.updateMatrixWorld(true);
    }
    return;
  }

  // Encuadre base + dolly de foco (efecto 4), acotado para que el modelo nunca se salga.
  const wanted = reduced() ? 1 : dollyTarget;
  const safe = wanted < 1 ? maxSafeDolly() : 1;
  dolly += (safe - dolly) * damp(DOLLY_DAMP, delta);
  placeCamera(dolly);
}

// Coloca la camara para un factor de dolly dado y devuelve el lookTarget usado.
function placeCamera(scale) {
  // Seguimiento de grua (ver FOLLOW_RISE): la camara sube y abre mientras la carga esta
  // en el aire. Es un PANEO (sube camara y mira lo mismo), no un tilt: si solo se
  // levantara el lookTarget la perspectiva se deformaria y el contenedor se veria
  // "picado" desde abajo justo cuando tiene que leerse colgado.
  const s = scale * (1 + (FOLLOW_ZOOM - 1) * followF);
  camera.position.copy(framing.center).addScaledVector(framing.dir, framing.distance * s);
  lookTarget.copy(framing.center);
  if (framing.desktop) {
    lookTarget.x += framing.targetOffsetX;      // resuelto en applyFraming, no la constante
    // El corrimiento vertical entra progresivamente con el zoom (0 en reposo: el encuadre
    // de reposo queda EXACTAMENTE igual al de A-nocturna).
    lookTarget.y += DESKTOP_TARGET_OFFSET_Y_ZOOM * clamp01((1 - scale) / (1 - DOLLY_ZOOM));
  }
  const rise = FOLLOW_RISE * followF;
  camera.position.y += rise;
  lookTarget.y += rise;
  camera.lookAt(lookTarget);
  camera.updateMatrixWorld(true);
}

// ¿Entra el modelo entero en el frame Y a la derecha de la card con este dolly? Proyecta
// las 8 esquinas de su caja en NDC. 0.985 deja 1.5% de aire contra el borde.
const fitCorner = new THREE.Vector3();
function fitsAt(scale) {
  placeCamera(scale);
  for (let i = 0; i < 8; i++) {
    fitCorner.set(i & 1 ? modelBox.max.x : modelBox.min.x,
                  i & 2 ? modelBox.max.y : modelBox.min.y,
                  i & 4 ? modelBox.max.z : modelBox.min.z);
    fitCorner.applyMatrix4(model.matrixWorld).project(camera);
    if (Math.abs(fitCorner.x) > 0.985 || Math.abs(fitCorner.y) > 0.985) return false;
    if (framing.desktop && fitCorner.x < framing.cardNdcX) return false;
  }
  return true;
}

// Dolly mas agresivo que sigue dejando el modelo entero adentro, entre DOLLY_ZOOM y 1.
// Hace falta porque el encuadre base tiene 22% de margen y la mira esta corrida en X: el
// 12% que se come el zoom mas la rotacion acumulada por la autorotacion pueden sacar el
// extremo de puertas por la derecha. Si ni siquiera 1 entra (viewport muy angosto), el
// efecto simplemente no se aplica en vez de romper el encuadre.
function maxSafeDolly() {
  if (fitsAt(DOLLY_ZOOM)) return DOLLY_ZOOM;
  let lo = DOLLY_ZOOM, hi = 1;
  for (let i = 0; i < 5; i++) {
    const mid = (lo + hi) / 2;
    if (fitsAt(mid)) hi = mid; else lo = mid;
  }
  return hi;
}

function syncInteriorShell() {
  interiorShell.position.copy(model.position);
  interiorShell.quaternion.copy(model.quaternion);
}

// ¿Salio el spreader entero por arriba del cuadro? Proyecta las 8 esquinas de su AABB
// local a NDC y exige que TODAS pasen el borde superior con 2% de aire. Es la misma
// tecnica que fitsAt() usa para el dolly, y por ser una medicion y no un tiempo fijo
// funciona igual en un viewport de 700 px que en uno de 1400.
const offCorner = new THREE.Vector3();
function spreaderOffScreen() {
  camera.updateMatrixWorld(true);
  for (let i = 0; i < 8; i++) {
    offCorner.set(i & 1 ? spreaderLocalBox.max.x : spreaderLocalBox.min.x,
                  i & 2 ? spreaderLocalBox.max.y : spreaderLocalBox.min.y,
                  i & 4 ? spreaderLocalBox.max.z : spreaderLocalBox.min.z);
    offCorner.applyMatrix4(spreader.matrixWorld).project(camera);
    if (offCorner.y < 1.02) return false;
  }
  return true;
}

// Corre DESPUES de updateCamera: necesita la matriz de camara de este frame para el test
// de salida de cuadro, y la del modelo para copiarle el transform.
function updateSpreader() {
  if (!spreaderActive) return;

  if (landT >= LAND.liftStart) {
    // Suelto: congela la orientacion que tenia al liberarse y sube en Y de MUNDO. Si
    // siguiera copiando el quaternion del modelo, el parallax del mouse lo haria girar
    // solidario a un contenedor del que ya se separo.
    if (!liftCaptured) {
      liftCaptured = true;
      liftBasePos.copy(model.position);
      liftBaseQuat.copy(model.quaternion);
    }
    spreader.position.copy(liftBasePos);
    spreader.position.y += liftAt(landT);
    spreader.quaternion.copy(liftBaseQuat);
  } else {
    // Trabado: cuerpo rigido con el contenedor. La geometria del spreader esta escrita en
    // el frame local del contenedor, asi que copiar position+quaternion alcanza para que
    // los cuatro pins caigan en los cuatro agujeros con cualquier yaw acumulado.
    liftCaptured = false;
    spreader.position.copy(model.position);
    spreader.quaternion.copy(model.quaternion);
  }

  const ang = pinAngleAt(landT);
  for (const pin of pinGroups) pin.rotation.y = ang;
  // Las guias abren con los pins: mismo reloj, imposible que se desfasen.
  const flip = flipperAngleAt(landT);
  for (const p of flipperPivots) p.rotation.x = p.userData.flipSign * flip;

  spreader.updateMatrixWorld(true);

  if (landT > LAND.liftStart && spreaderOffScreen()) {
    spreaderActive = false;
    spreader.visible = false;      // subarbol entero fuera del render, cero draw calls
    autoRotateEnabled = true;      // recien ahora el contenedor empieza a girar solo
  }
}

// =====================================================================================
// LOOP UNICO. Nunca se instancia un segundo rAF: el reset solo toca variables.
// =====================================================================================
const timer = new THREE.Timer();
timer.connect(document);
landT = 0;
landRunning = false;              // NO arranca aca: lo arranca revealWhenReady()
spreaderActive = !reduced();
spreader.visible = false;
autoRotateEnabled = reduced();
model.position.y = reduced() ? 0 : LAND.hangY;
updateContactShadow();
updateCamera(0);
updateSpreader();
syncInteriorShell();

// =====================================================================================
// LA COREOGRAFIA ESPERA AL CONTENEDOR COMPLETO (pedido de John, 2026-08-06).
//
// EL PROBLEMA QUE ESTO RESUELVE. Antes la bajada de la grua arrancaba en el primer frame,
// o sea a los ~2 s en una conexion de oficina. Las texturas seguian entrando MIENTRAS el
// contenedor descendia: el mejor momento de la pieza -una grua posando un contenedor de
// 40 pies- se jugaba con el objeto a medio pintar, y lo que se veia era el logo y las
// marcas apareciendo de a pedazos sobre algo que ya estaba en movimiento.
//
// LO QUE SE RETIENE ES LA COREOGRAFIA, NO EL RENDER. La escena renderiza desde el primer
// frame (fondo, niebla, luces); lo unico oculto es el contenedor y su spreader. El
// formulario y el logo SSB son HTML sin gate: pintan antes de que corra una linea de JS,
// asi que la pagina nunca se ve muerta mientras se espera.
//
// EL TECHO DE 8 s NO ES DECORATIVO. Si la red se cae a la mitad, sin techo el contenedor
// no aparece NUNCA. Cumplido el plazo se muestra igual: el bloque de ARRANQUE EN FRIO ya
// garantiza que lo que se vea sea un contenedor teal correcto y no uno blanco, y las
// texturas que falten se incorporan solas por frame. Degrada, no rompe.
// 15 s y no 8: con 8 el techo saltaba ANTES de que terminaran las texturas en una
// conexion de oficina (todas cierran ~9,5 s), y revelar por timeout es exactamente el
// caso feo -- contenedor bajando y actualizandose. El techo tiene que ser el plan B de
// una red rota, no algo que se dispare en el uso normal.
const REVEAL_TIMEOUT_MS = 15000;
let revealed = false;
function revealNow(motivo) {
  if (revealed) return;
  revealed = true;
  if (QA) {
    window.__revealReason = motivo;
    window.__revealAt = Math.round(performance.now());
  }
  if (motivo === 'timeout') fireFormReady();  // red rota: el acceso no espera al show
  model.visible = true;
  // La coreografia arranca DESDE CERO en este instante, no desde donde habria quedado si
  // hubiese corrido oculta: el usuario tiene que ver la bajada entera, no su segunda mitad.
  landT = 0;
  landRunning = !reduced();
  spreaderActive = !reduced();
  spreader.visible = !reduced();
  model.position.y = reduced() ? 0 : LAND.hangY;
  updateContactShadow();
  updateCamera(0);
  updateSpreader();
  syncInteriorShell();
}
model.visible = false;
{
  const t0 = performance.now();
  const check = () => {
    if (disposed || revealed) return;
    // Se esperan LAS 41. Hubo una version intermedia que esperaba solo las 8 de
    // TEX_QUE_DEFINEN suponiendo que las de sombreado llegaban despues; MEDIDO en
    // produccion, es falso: los 39 recursos bajan en paralelo compartiendo el caño y
    // terminan todos en el mismo instante (ultima definitoria 9405 ms, ultima de todas
    // 9405 ms). O sea que esperar 8 no adelantaba NADA y encima dejaba que el techo
    // saltara antes de que estuvieran las de sombreado -> el contenedor se actualizaba
    // mientras bajaba, que es justo lo que se quería evitar.
    // texState.total > 0 evita revelar en el frame 0, cuando el manager no publico nada.
    if (texState.total > 0 && texState.loaded >= texState.total) return revealNow('texturas');
    if (performance.now() - t0 > REVEAL_TIMEOUT_MS) return revealNow('timeout');
    setTimeout(check, 60);
  };
  check();
}

renderer.render(scene, camera);
if (QA) {
  window.__ready = true;
  window.__readyAt = Math.round(performance.now());
}

let loopStarted = false;
let rafId = 0;
function animate(timestamp) {
  if (disposed) return;
  rafId = requestAnimationFrame(animate);
  timer.update(timestamp);
  // freeze es un hook de QA (ver window.__a4): congela el tiempo sin parar el loop.
  const delta = debug.freeze ? 0 : Math.min(timer.getDelta(), 0.05);
  updateLand(delta);
  updateParallax(delta);
  updateMouseLight();
  updateSequence(delta);
  updateCamera(delta);
  updateSpreader();
  updateContactShadow();
  syncInteriorShell();
  // Incorpora cada textura en el frame siguiente a que su imagen exista. Cuesta un for
  // sobre una lista que se vacia sola: cuando ya entraron todas, sale en la primera linea.
  settleColdStart();
  renderer.render(scene, camera);
}

// =====================================================================================
// API PARA REACT (reemplaza al formulario mockup del demo) + coreografia de login.
// =====================================================================================
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

function startLoginSequence() {
  seqRunning = true;
  seqT = 0;
  fadeOpacity = 0;
  turnCaptured = false;
  finalShown = false;
  dollyTarget = 1;
}

// El "estado final" del demo era un overlay con Repetir; en producción es la
// navegación a /inicio. Dispara UNA vez, en SEQ.finalAt (3,40 s), con el fade opaco.
// (El reset del demo — tecla R, botón Repetir, resetAll — no existe más: en producción
// resetear el login con una tecla es un bug, no una feature.)
let sequenceEnded = false;
function showFinalState() {
  if (sequenceEnded || disposed) return;
  sequenceEnded = true;
  onSequenceEnd();
}

// =====================================================================================
// Superficie de QA (solo lectura de estado + hooks de captura). No hay console.log:
// la verificacion lee window.__a4 por eval. Expone lo mismo que __a3 mas el control de
// la coreografia de posado (freeze + seek por tiempo) para poder capturar frames.
// =====================================================================================
const debug = { freeze: false };

// ---- Hooks A4 de verificacion. Todos son reversibles y no tocan estado de la escena
//      mas alla de lo que dicen. setShadows(false) reproduce EXACTAMENTE el render de A3
//      (misma camara, mismo frame) para la comparativa antes/despues.
//      Apagar keyLight.castShadow cambia numDirLightShadows, y three recompila los
//      programas solo por cambio de lightsStateVersion: no hace falta needsUpdate a mano.
let shadowsOn = true;
debug.setShadows = (on) => {
  shadowsOn = !!on;
  keyLight.castShadow = shadowsOn;
  groundShadow.visible = shadowsOn;
  return shadowsOn;
};
debug.setExposure = (v) => { renderer.toneMappingExposure = v; return v; };
debug.setToneMapping = (name) => {
  const map = {
    aces: THREE.ACESFilmicToneMapping,
    neutral: THREE.NeutralToneMapping,
    agx: THREE.AgXToneMapping,
    reinhard: THREE.ReinhardToneMapping,
    linear: THREE.LinearToneMapping,
    none: THREE.NoToneMapping
  };
  if (!(name in map)) return null;
  renderer.toneMapping = map[name];
  scene.traverse((o) => { if (o.isMesh && o.material) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) m.needsUpdate = true; });
  return name;
};
debug.setEnvIntensity = (v) => { scene.environmentIntensity = v; return v; };
debug.setRim = (v) => { rimLight.intensity = v; return v; };
debug.setBakedShadow = (v) => { contactShadow.visible = v > 0; return v; };
debug.setGroundShadow = (v) => { groundShadow.material.opacity = v; return v; };
debug.setShadowBias = (bias, normalBias, radius) => {
  if (bias !== undefined) keyLight.shadow.bias = bias;
  if (normalBias !== undefined) keyLight.shadow.normalBias = normalBias;
  if (radius !== undefined) keyLight.shadow.radius = radius;
  return { bias: keyLight.shadow.bias, normalBias: keyLight.shadow.normalBias, radius: keyLight.shadow.radius };
};
// Costo en ms de submit de JS por frame (no incluye el rasterizado). Se mide con y sin
// sombras sobre el MISMO frame congelado para que la unica variable sea el shadow pass.
debug.benchFrame = (n = 30) => {
  const t0 = performance.now();
  for (let i = 0; i < n; i++) renderer.render(scene, camera);
  const ms = (performance.now() - t0) / n;
  return { frames: n, msPerFrame: +ms.toFixed(3), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
};

// Nombre del tramo de la coreografia en el que estamos, para leerlo de una.
function landPhase() {
  if (reduced()) return 'reduced';
  if (landT < LAND.descentDur) return 'descenso';
  if (landT < LAND.descentDur + LAND.settleDur) return 'asentamiento';
  if (landT < LAND.unlockStart + LAND.unlockDur) return 'destrabe';
  if (landT < LAND.liftStart) return 'confirmacion';
  if (spreaderActive) return 'retirada';
  return 'idle';
}

// Verificacion geometrica real: para cada pin, distancia en mm entre el eje del pin y el
// centro del agujero superior de SU esquinero. No compara constantes contra constantes,
// recorre las matrices de verdad (world del pin contra world del casting) para que un
// error de transform o un typo aparezca como numero y no pase inadvertido.
// Los esquineros se identifican por posicion medida, no por nombre.
function pinAlignment() {
  model.updateWorldMatrix(true, true);
  spreader.updateMatrixWorld(true);
  const castings = [];
  const wp = new THREE.Vector3();
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.getWorldPosition(wp);
    const local = model.worldToLocal(wp.clone());
    if (Math.abs(Math.abs(local.x) - PIN_X) < 0.002 &&
        Math.abs(Math.abs(local.z) - PIN_Z) < 0.002 &&
        Math.abs(local.y - 2.837) < 0.002) {
      castings.push({ x: local.x, y: local.y, z: local.z });
    }
  });
  const out = [];
  for (const pin of pinGroups) {
    pin.getWorldPosition(wp);
    const p = model.worldToLocal(wp.clone());
    let best = null;
    for (const c of castings) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (!best || d < best.d) best = { c, d };
    }
    if (!best) continue;
    // Y del agujero = cara superior del esquinero = centro + medio alto (0.059).
    const holeY = best.c.y + 0.059;
    out.push({
      pin: `x${p.x > 0 ? '+' : '-'} z${p.z > 0 ? '+' : '-'}`,
      dx_mm: +((p.x - best.c.x) * 1000).toFixed(3),
      dz_mm: +((p.z - best.c.z) * 1000).toFixed(3),
      radial_mm: +(best.d * 1000).toFixed(3),
      holeY_m: +holeY.toFixed(4),
      headTop_m: PIN.headY1,
      headClearanceToPlate_mm: +((2.880 - PIN.headY1) * 1000).toFixed(1)
    });
  }
  return { castingsFound: castings.length, pins: out };
}

if (QA) window.__a4 = {
  THREE, renderer, scene, camera, model, runtime,
  mouseLight, contactShadow, interiorShell,
  spreader, pinGroups,
  // reset/submit del demo se fueron con el form; la secuencia se maneja por seekSequence
  // y el submit real vive en React.
  playLoginSequence,
  // ---- Agregados A4 ----
  lights: lightRig.lights, keyLight, rimLight, keyTarget,
  groundShadow, environment: dockEnv,
  shadow: {
    fit: shadowFit,
    box: { min: SHADOW_BOX.min.toArray(), max: SHADOW_BOX.max.toArray() },
    bias: SHADOW_BIAS, normalBias: SHADOW_NORMAL_BIAS, radius: SHADOW_RADIUS,
    type: 'PCFShadowMap (r185: PCFSoftShadowMap cae a BASIC, ver comentario)',
    castersModel: shadowMeshes, castersSpreader: spreaderShadowMeshes,
    cablesExcluded: spreaderCablesSkipped
  },
  env: { intensity: ENV_INTENSITY, size: ENV_SIZE },
  anisotropy: { max: MAX_ANISOTROPY, texturesRaised: anisotropyRaised },
  tex: texState,
  debug,
  // Compatibilidad con el hook de A2: t01 recorre el DESCENSO (tramo equivalente).
  seekDrop(t01) { landT = clamp01(t01) * LAND.descentDur; landRunning = true; syncLandSeek(); },
  // Control nuevo: segundos absolutos sobre la coreografia completa.
  seekLand(seconds) { landT = Math.max(0, Math.min(seconds, LAND.total)); landRunning = true; syncLandSeek(); },
  seekSequence(seconds) { seqT = seconds; },
  land: LAND,
  seq: SEQ,
  framing,
  setSpreaderTheme: applySpreaderTheme,
  themes: Object.keys(SPREADER_THEMES),
  pinAlignment,
  state: () => ({
    ready: window.__ready === true,
    textures: `${texState.loaded}/${texState.total}`,
    texErrors: texState.errors.length,
    reduced: reduced(),
    dropY: model.position.y,
    yaw: model.rotation.y,
    dolly,
    seqRunning, seqT,
    // Arranque: cuando se mostro el contenedor y por que (texturas completas vs techo).
    reveal: { hecho: revealed, motivo: window.__revealReason || null,
              msDesdeCarga: window.__revealAt ?? null, primerFrameMs: window.__readyAt ?? null },
    doors: [runtime.getDoorAngle('left'), runtime.getDoorAngle('right')],
    // ---- Giro a la puerta (A4). doorFaceDeg es el angulo al que TIENE que llegar el yaw
    //      para que la cara de puertas mire a camara; turnErrDeg es lo que falta.
    turn: {
      captured: turnCaptured,
      fromDeg: +THREE.MathUtils.radToDeg(turnFromYaw).toFixed(2),
      toDeg: +THREE.MathUtils.radToDeg(turnToYaw).toFixed(2),
      doorFaceDeg: +THREE.MathUtils.radToDeg(DOOR_FACE_YAW).toFixed(2),
      turnErrDeg: +THREE.MathUtils.radToDeg(
        shortestAngle(DOOR_FACE_YAW - model.rotation.y)).toFixed(2)
    },
    light: mouseLight.position.toArray(),
    fog: [scene.fog.near, scene.fog.far],
    camDist: camera.position.distanceTo(framing.center),
    landT, landRunning, landPhase: landPhase(),
    autoRotate: autoRotateEnabled,
    spreaderVisible: spreader.visible,
    spreaderY: spreader.position.y,
    spreaderTheme,
    pinDeg: +THREE.MathUtils.radToDeg(pinGroups[0].rotation.y).toFixed(2),
    // ---- Agregados A4 ----
    shadowsOn,
    shadowMapSize: keyLight.shadow.mapSize.x,
    shadowBias: keyLight.shadow.bias,
    shadowNormalBias: keyLight.shadow.normalBias,
    shadowRadius: keyLight.shadow.radius,
    envIntensity: scene.environmentIntensity,
    rimIntensity: rimLight.intensity,
    bakedShadowOpacity: +contactShadow.material.opacity.toFixed(4),
    groundShadowOpacity: groundShadow.material.opacity,
    toneMapping: renderer.toneMapping,
    exposure: renderer.toneMappingExposure,
    pixelRatio: renderer.getPixelRatio(),
    anisotropy: MAX_ANISOTROPY,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles
  })
};

// Un seek hacia atras tiene que deshacer los latches del tramo de retirada, o el spreader
// se queda invisible en un instante en el que deberia estar apoyado.
function syncLandSeek() {
  if (reduced()) return;
  if (landT < LAND.liftStart) liftCaptured = false;
  if (!spreaderActive) {
    // Se reactiva siempre: si el instante buscado sigue estando fuera de cuadro,
    // updateSpreader() lo vuelve a apagar en el mismo frame.
    spreaderActive = true;
    spreader.visible = true;
    autoRotateEnabled = false;
  }
  model.position.y = containerYAt(landT);
}

if (!loopStarted) { loopStarted = true; animate(); }

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
}