// src/createObjectModel.ts
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
function hashString(value) {
  let hash = 2166136261;
  for (let index = 0;index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function readLayerNumber(value, keys, fallback) {
  if (typeof value === "number")
    return value;
  if (value && typeof value === "object") {
    const record = value;
    for (const key of keys) {
      if (typeof record[key] === "number")
        return record[key];
    }
  }
  return fallback;
}
function hexToRgb(hex) {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex) ? "#" + hex.slice(1).split("").map((part) => part + part).join("") : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 9075295;
  return [value >> 16 & 255, value >> 8 & 255, value & 255];
}
function materialPalette(spec) {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0)
    return palette.filter((value) => typeof value === "string");
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...Array.isArray(secondary) ? secondary : []];
  return colors.filter((value) => typeof value === "string" && value.startsWith("#"));
}
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
function smoothCurve(value) {
  return value * value * (3 - 2 * value);
}
function periodicHash(x, y, seed, periodX, periodY) {
  const wrappedX = (x % periodX + periodX) % periodX;
  const wrappedY = (y % periodY + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ value >>> 13, 1274126177);
  return ((value ^ value >>> 16) >>> 0) / 4294967295;
}
function periodicValueNoise(u, v, seed, periodX, periodY) {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}
function surfaceBands(spec) {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item) => {
    if (!item || typeof item !== "object")
      return [];
    const band = item;
    const frequency = typeof band.frequency === "number" ? band.frequency : 0;
    const amplitude = typeof band.amplitude === "number" ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0)
      return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? "")} ${String(band.role ?? "")}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === "number" ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === "number" ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description)
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false }
  ];
}
function sampleSurface(u, v, bands, seed) {
  let value = 0;
  let weight = 0;
  for (let index = 0;index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge)
      sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}
function mixPalette(colors, value) {
  if (colors.length === 1)
    return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix))
  ];
}
function parseRgba(value) {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match)
    return [138, 122, 95];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
function sampleColorGradient(gradient, u, v) {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: "rgba(138,122,95,1)" }, { offset: 1, color: "rgba(138,122,95,1)" }];
  let t;
  if (gradient.type === "radial") {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix)
  ];
}
function writePixel(data, offset, red, green, blue) {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}
function makeCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}
function createMapTexture(canvas, colorSpace, spec, options) {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === "object" ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(typeof repeat[0] === "number" ? repeat[0] : 2, typeof repeat[1] === "number" ? repeat[1] : 2);
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}
function referenceMapUrl(spec, channel) {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== "object")
    return null;
  if (reference.usable === false)
    return null;
  const confidence = typeof reference.confidence === "number" ? reference.confidence : typeof reference.estimatedFidelity === "number" ? reference.estimatedFidelity : 0;
  const threshold = typeof reference.targetThreshold === "number" ? reference.targetThreshold : 0.7;
  if (confidence < threshold)
    return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== "object")
    return null;
  const map = maps[channel];
  if (!map || typeof map !== "object")
    return null;
  const record = map;
  const url = typeof record.url === "string" && record.url.trim() ? record.url : record.path;
  return typeof url === "string" && url.trim() ? url : null;
}
function createLoadedMapTexture(url, colorSpace, spec, options) {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === "object" ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(typeof repeat[0] === "number" ? repeat[0] : 1, typeof repeat[1] === "number" ? repeat[1] : 1);
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}
function makeReferenceTextureSet(spec, options) {
  const albedo = referenceMapUrl(spec, "albedo");
  const roughness = referenceMapUrl(spec, "roughness");
  const height = referenceMapUrl(spec, "height");
  const normal = referenceMapUrl(spec, "normal");
  const ao = referenceMapUrl(spec, "ao");
  if (!albedo || !roughness || !height || !normal || !ao)
    return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: "reference-pixel-extraction"
  };
}
function makeProceduralTextureSet(id, spec, options) {
  if (typeof document === "undefined")
    return null;
  const qualityFirst = (options.qualityPriority ?? "reference-fidelity") === "reference-fidelity";
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === "number" && Number.isFinite(requested) ? requested : qualityFirst ? 1024 : 512;
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size)
  };
  const contexts = {
    albedo: canvases.albedo.getContext("2d"),
    roughness: canvases.roughness.getContext("2d"),
    height: canvases.height.getContext("2d"),
    normal: canvases.normal.getContext("2d"),
    ao: canvases.ao.getContext("2d")
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao)
    return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size)
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === "string" ? spec.baseColor : "#8A7A5F";
  const colors = (palette.length >= 2 ? palette : [fallback, "#6E614B", "#A08F70"]).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ["base"], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ["variation"], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ["amplitude", "variation"], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ["heightCorrelation"], 0.3));
  const colorGradient = spec.colorGradient;
  for (let y = 0;y < size; y += 1) {
    const v = y / size;
    for (let x = 0;x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color;
      if (colorGradient) {
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation);
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ["strength", "amplitude"], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ["cavityStrength", "strength"], 0.35));
  for (let y = 0;y < size; y += 1) {
    const up = (y - 1 + size) % size * size;
    const down = (y + 1) % size * size;
    for (let x = 0;x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (heightField[y * size + left] + heightField[y * size + right] + heightField[up + x] + heightField[down + x]) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(images.normal.data, offset, (normalX * 0.5 + 0.5) * 255, (normalY * 0.5 + 0.5) * 255, (normalZ * 0.5 + 0.5) * 255);
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: "procedural"
  };
}
function createSculptMaterial(id, spec, options) {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 16777215 : new THREE.Color(typeof spec.baseColor === "string" ? spec.baseColor : "#8A7A5F"),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ["base"], 0.76)),
    metalness: clamp01(readLayerNumber(spec.metalness, ["base"], 0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ["base", "amount"], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ["base"], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ["base", "amount"], 0)),
    ior: Math.max(1, readLayerNumber(spec.ior, ["base", "value"], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ["base", "amount"], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ["base", "value"], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === "string" ? spec.attenuationColor : "#ffffff"),
    sheen: clamp01(readLayerNumber(spec.sheen, ["base", "amount"], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === "string" ? spec.sheenColor : "#ffffff"),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ["base"], 1)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ["base", "amount"], 0)),
    iridescenceIOR: Math.max(1, readLayerNumber(spec.iridescenceIOR, ["base", "value"], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ["base", "amount"], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ["rotation"], 0),
    specularIntensity: clamp01(readLayerNumber(spec.specularIntensity, ["base"], 1)),
    specularColor: new THREE.Color(typeof spec.specularColor === "string" ? spec.specularColor : "#ffffff"),
    emissive: new THREE.Color(typeof spec.emissive === "string" ? spec.emissive : "#000000"),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ["base"], 1)),
    opacity: clamp01(readLayerNumber(spec.opacity, ["base"], 1)),
    transparent: readLayerNumber(spec.transmission, ["base", "amount"], 0) > 0 || readLayerNumber(spec.opacity, ["base"], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ["cutoff", "alphaTest"], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ["strength", "amplitude"], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ["cavityStrength", "strength"], 0.35);
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ["amplitude", "strength"], 0));
    if (bumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = bumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ["amplitude", "strength"], 0));
    if (displacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = displacementScale;
      material.displacementBias = -displacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ["envMapIntensity"], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrTextureSource = textures?.source ?? "flat-fallback";
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.needsUpdate = true;
  return material;
}
function readVector3(value, fallback) {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === "number")) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}
function readNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function makeAttachmentEndpoint(attachment) {
  if (!attachment || typeof attachment !== "object")
    return null;
  const record = attachment;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001)
    return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius
  };
}
function createSSB40ftHighCubeContainerModel(options = {}) {
  const root = new THREE.Group;
  root.name = "SSB 40ft High Cube Container";
  root.userData.reconstructionEvidence = { itemFamily: null, subtype: null, componentAdapter: null, route: null, exactnessTier: null, referenceCamera: { solved: false, fovDegrees: 35, aspect: 1.8333, orientation: { yaw: 35, pitch: -17, roll: 0 }, positionHint: [10.5, 4.2, 7.5], note: "Estimacion visual (no se corrio solve_camera_pose: projection-route skipped). La camara de REVIEW se calibra en blockout contra Tier-1 (aspect delta <=0.05, scale delta <=0.08, IoU >=0.85) con azimut sesgado al testero para compensar la desviacion 20-ref -> 40HC-target; luego queda FIJA para las 8 pasadas." }, approximationNotes: [] };
  const materialMap = {};
  materialMap["paint-body-navy"] = createSculptMaterial("paint-body-navy", { id: "paint-body-navy", name: "Pintura casco SSB navy", type: "standard", shaderModel: "MeshStandardMaterial / PBR approximation", baseColor: "#14424C", color: "#14424C", albedo: { dominant: "#89898D", secondary: ["#848589", "#8D8D91", "#919296"], samplingNotes: "Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.", map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_albedo.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_albedo.webp", channel: "albedo", source: "reference-pixel-extraction" } }, colorVariation: { palette: ["#89898D", "#848589", "#8D8D91", "#919296", "#7C7D81"], pattern: "reference-derived pixel palette", amplitude: 0.08, heightCorrelation: 0.42 }, textureResolution: 1024, textureProjection: { mode: "uv", repeat: [2, 2], anisotropy: 8, texelDensityIntent: "Preserve stable world/object-scale detail; do not stretch micro detail with component scale." }, surfaceFrequencyBands: [{ id: "macro", frequency: 2, amplitude: 0.308, role: "reference-derived broad albedo and height breakup" }, { id: "meso", frequency: 14, amplitude: 0.35, role: "reference-derived cracks, ridges, pores, grain, or leaf clusters" }, { id: "micro", frequency: 72, amplitude: 0.14, role: "reference-derived micro highlight breakup under grazing light" }], roughness: { base: 0.734, variation: 0.161, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_roughness.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_roughness.webp", channel: "roughness", source: "reference-pixel-extraction" }, localResponse: "reference-derived roughness estimate; cavities and textured zones trend rougher, bright highlights trend smoother" }, metalness: { base: 0.05, variation: 0.05 }, normal: { pattern: "reference-derived height-gradient normal map", strength: 0.252, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_normal.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_normal.webp", channel: "normal", source: "reference-pixel-extraction" }, heightSource: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", channel: "height", source: "reference-pixel-extraction" }, space: "tangent" }, bump: { pattern: "reference-derived height field", amplitude: 0.037, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", channel: "height", source: "reference-pixel-extraction" } }, displacement: { pattern: "none", amplitude: 0, scale: 1, silhouetteAffects: false }, ambientOcclusion: { cavityStrength: 0.38, contactShadowBias: 0.35, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_ao.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_ao.webp", channel: "ao", source: "reference-pixel-extraction" }, notes: "Reference-derived cavity estimate from local height minima; verify against grazing-light screenshot." }, wear: { edgeWear: 0, scratches: [], chips: [] }, dirt: { amount: 0, cavityBias: 0, color: "#2F2A22" }, localOverrides: [{ id: "logo-decal", kind: "decal", region: "ambos laterales, centrado horizontal ~40% del largo, banda media", description: "Logo SSB variante blanca (assets/ssb-white.svg) rasterizado a CanvasTexture 2048px, proporcion 512:202; letras #FFFFFF + cuadrados #D6640F; SIN geometria.", evidenceRef: "/3d/assets/ssb-white.svg", confidence: 1 }, { id: "ao-corrugation-valleys", kind: "stain", region: "valles del corrugado en todas las caras", dirtAmount: 0.12, cavityBias: 1, streak: "none", description: "Oscurecimiento AO sutil en valles; sin dirt real (contenedor nuevo).", evidenceRef: "/3d/intake/zones/zone-r1c1.webp", confidence: 0.9 }, { id: "reference-pbr-pixel-evidence", type: "material-map-evidence", evidenceRefs: ["full-object"], channels: ["albedo", "roughness", "height", "normal", "ambient-occlusion"], notes: "Use generated maps as material evidence, then refine after browser screenshot comparison." }], shaderNotes: ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.", "Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.", "Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps."], notes: "Pintura industrial satinada sobre acero: dielectrica, semi-mate. Albedo por contrato SSB.", referencePbr: { version: "1.0", sourceImage: "/home/jzenteno/work/crm-3d/intake/crops/paint-body.webp", extractor: "stage1_intake/extract_pbr_evidence.py", method: "single-image pixel evidence with de-lighting estimate; not photogrammetry", usable: true, verdict: "pass", confidence: 0.837, estimatedFidelity: 0.837, targetThreshold: 0.7, hardLimit: "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", maps: { albedo: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_albedo.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_albedo.webp", channel: "albedo", source: "reference-pixel-extraction" }, roughness: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_roughness.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_roughness.webp", channel: "roughness", source: "reference-pixel-extraction" }, height: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", channel: "height", source: "reference-pixel-extraction" }, normal: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_normal.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_normal.webp", channel: "normal", source: "reference-pixel-extraction" }, ao: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_ao.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_ao.webp", channel: "ao", source: "reference-pixel-extraction" } }, diagnostics: { sourceWidth: 800, sourceHeight: 400, mapSize: 1024, cropBBoxPixels: { x: 1, y: 0, width: 783, height: 400 }, mask: { backgroundColor: "#636466", backgroundNoise: 12.884, transparentPixelFraction: 0, foregroundCoverage: 0.5781 }, mapStats: { valueRange: 0.0809, heightP90Gradient: 0.08139, roughnessBase: 0.734, roughnessVariation: 0.161, normalStrength: 0.252, blurRadius: 21 }, palette: ["#89898D", "#848589", "#8D8D91", "#919296", "#7C7D81"] }, warnings: ["single-image inverse rendering cannot prove true physical PBR; confidence is capped", "low value range weakens height/roughness inference"], albedoOverrideNote: "CONTRATO SSB: el canal albedo del recipe usa los hex de marca (brandContract), NO el albedo extraido de la referencia; la evidencia extraida vale para finish/roughness/normal/AO de pintura industrial. decal-white y paint-accent-orange comparten evidencia de finish del mismo sistema de pintura (crop paint-body)." } }, options);
  materialMap["paint-structure"] = createSculptMaterial("paint-structure", { id: "paint-structure", name: "Pintura estructura (navy profundo)", type: "standard", shaderModel: "MeshStandardMaterial / PBR approximation", baseColor: "#0E2D34", color: "#0E2D34", albedo: { dominant: "#E4E4E4", secondary: ["#DCDCDC", "#68696C", "#E8E8E8"], samplingNotes: "Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.", map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-structure/paint-structure_albedo.webp", url: "/3d/intake/pbr/paint-structure/paint-structure_albedo.webp", channel: "albedo", source: "reference-pixel-extraction" } }, colorVariation: { palette: ["#E4E4E4", "#DCDCDC", "#68696C", "#E8E8E8", "#BABBBB"], pattern: "reference-derived pixel palette", amplitude: 0.254, heightCorrelation: 0.42 }, textureResolution: 1024, textureProjection: { mode: "uv", repeat: [2, 2], anisotropy: 8, texelDensityIntent: "Preserve stable world/object-scale detail; do not stretch micro detail with component scale." }, surfaceFrequencyBands: [{ id: "macro", frequency: 2, amplitude: 0.491, role: "reference-derived broad albedo and height breakup" }, { id: "meso", frequency: 14, amplitude: 0.189, role: "reference-derived cracks, ridges, pores, grain, or leaf clusters" }, { id: "micro", frequency: 72, amplitude: 0.078, role: "reference-derived micro highlight breakup under grazing light" }], roughness: { base: 0.681, variation: 0.05, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-structure/paint-structure_roughness.webp", url: "/3d/intake/pbr/paint-structure/paint-structure_roughness.webp", channel: "roughness", source: "reference-pixel-extraction" }, localResponse: "reference-derived roughness estimate; cavities and textured zones trend rougher, bright highlights trend smoother" }, metalness: { base: 0.05, variation: 0.05 }, normal: { pattern: "reference-derived height-gradient normal map", strength: 0.167, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-structure/paint-structure_normal.webp", url: "/3d/intake/pbr/paint-structure/paint-structure_normal.webp", channel: "normal", source: "reference-pixel-extraction" }, heightSource: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-structure/paint-structure_height.webp", url: "/3d/intake/pbr/paint-structure/paint-structure_height.webp", channel: "height", source: "reference-pixel-extraction" }, space: "tangent" }, bump: { pattern: "reference-derived height field", amplitude: 0.01, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-structure/paint-structure_height.webp", url: "/3d/intake/pbr/paint-structure/paint-structure_height.webp", channel: "height", source: "reference-pixel-extraction" } }, displacement: { pattern: "none", amplitude: 0, scale: 1, silhouetteAffects: false }, ambientOcclusion: { cavityStrength: 0.38, contactShadowBias: 0.35, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-structure/paint-structure_ao.webp", url: "/3d/intake/pbr/paint-structure/paint-structure_ao.webp", channel: "ao", source: "reference-pixel-extraction" }, notes: "Reference-derived cavity estimate from local height minima; verify against grazing-light screenshot." }, wear: { edgeWear: 0, scratches: [], chips: [] }, dirt: { amount: 0, cavityBias: 0, color: "#2F2A22" }, localOverrides: [{ id: "reference-pbr-pixel-evidence", type: "material-map-evidence", evidenceRefs: ["full-object"], channels: ["albedo", "roughness", "height", "normal", "ambient-occlusion"], notes: "Use generated maps as material evidence, then refine after browser screenshot comparison." }], shaderNotes: ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.", "Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.", "Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps."], notes: "Bastidor, postes, rails, esquineros: un paso mas oscuro que el casco para lectura estructural.", referencePbr: { version: "1.0", sourceImage: "/home/jzenteno/work/crm-3d/intake/crops/structure.webp", extractor: "stage1_intake/extract_pbr_evidence.py", method: "single-image pixel evidence with de-lighting estimate; not photogrammetry", usable: true, verdict: "pass", confidence: 0.764, estimatedFidelity: 0.764, targetThreshold: 0.7, hardLimit: "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", maps: { albedo: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-structure/paint-structure_albedo.webp", url: "/3d/intake/pbr/paint-structure/paint-structure_albedo.webp", channel: "albedo", source: "reference-pixel-extraction" }, roughness: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-structure/paint-structure_roughness.webp", url: "/3d/intake/pbr/paint-structure/paint-structure_roughness.webp", channel: "roughness", source: "reference-pixel-extraction" }, height: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-structure/paint-structure_height.webp", url: "/3d/intake/pbr/paint-structure/paint-structure_height.webp", channel: "height", source: "reference-pixel-extraction" }, normal: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-structure/paint-structure_normal.webp", url: "/3d/intake/pbr/paint-structure/paint-structure_normal.webp", channel: "normal", source: "reference-pixel-extraction" }, ao: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-structure/paint-structure_ao.webp", url: "/3d/intake/pbr/paint-structure/paint-structure_ao.webp", channel: "ao", source: "reference-pixel-extraction" } }, diagnostics: { sourceWidth: 750, sourceHeight: 160, mapSize: 1024, cropBBoxPixels: { x: 513, y: 0, width: 237, height: 58 }, mask: { backgroundColor: "#F7F7F7", backgroundNoise: 5.385, transparentPixelFraction: 0, foregroundCoverage: 0.0512 }, mapStats: { valueRange: 0.6036, heightP90Gradient: 0.0094, roughnessBase: 0.681, roughnessVariation: 0.05, normalStrength: 0.167, blurRadius: 21 }, palette: ["#E4E4E4", "#DCDCDC", "#68696C", "#E8E8E8", "#BABBBB"] }, warnings: ["foreground mask is very small", "single-image inverse rendering cannot prove true physical PBR; confidence is capped", "low high-frequency detail weakens normal/roughness inference"], albedoOverrideNote: "CONTRATO SSB: el canal albedo del recipe usa los hex de marca (brandContract), NO el albedo extraido de la referencia; la evidencia extraida vale para finish/roughness/normal/AO de pintura industrial. decal-white y paint-accent-orange comparten evidencia de finish del mismo sistema de pintura (crop paint-body)." } }, options);
  materialMap["steel-galvanized"] = createSculptMaterial("steel-galvanized", { id: "steel-galvanized", name: "Acero galvanizado herraje", type: "standard", shaderModel: "MeshStandardMaterial / PBR approximation", baseColor: "#9BA3AB", color: "#9BA3AB", albedo: { dominant: "#444547", secondary: ["#2A2A2B", "#383939", "#D2D2D3"], samplingNotes: "Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.", map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/steel-galvanized/steel-galvanized_albedo.webp", url: "/3d/intake/pbr/steel-galvanized/steel-galvanized_albedo.webp", channel: "albedo", source: "reference-pixel-extraction" } }, colorVariation: { palette: ["#444547", "#2A2A2B", "#383939", "#D2D2D3", "#191A1A"], pattern: "reference-derived pixel palette", amplitude: 0.305, heightCorrelation: 0.42 }, textureResolution: 1024, textureProjection: { mode: "uv", repeat: [2, 2], anisotropy: 8, texelDensityIntent: "Preserve stable world/object-scale detail; do not stretch micro detail with component scale." }, surfaceFrequencyBands: [{ id: "macro", frequency: 2, amplitude: 0.52, role: "reference-derived broad albedo and height breakup" }, { id: "meso", frequency: 14, amplitude: 0.193, role: "reference-derived cracks, ridges, pores, grain, or leaf clusters" }, { id: "micro", frequency: 72, amplitude: 0.08, role: "reference-derived micro highlight breakup under grazing light" }], roughness: { base: 0.68, variation: 0.05, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/steel-galvanized/steel-galvanized_roughness.webp", url: "/3d/intake/pbr/steel-galvanized/steel-galvanized_roughness.webp", channel: "roughness", source: "reference-pixel-extraction" }, localResponse: "reference-derived roughness estimate; cavities and textured zones trend rougher, bright highlights trend smoother" }, metalness: { base: 0.85, variation: 0.05 }, normal: { pattern: "reference-derived height-gradient normal map", strength: 0.168, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/steel-galvanized/steel-galvanized_normal.webp", url: "/3d/intake/pbr/steel-galvanized/steel-galvanized_normal.webp", channel: "normal", source: "reference-pixel-extraction" }, heightSource: { path: "/home/jzenteno/work/crm-3d/intake/pbr/steel-galvanized/steel-galvanized_height.webp", url: "/3d/intake/pbr/steel-galvanized/steel-galvanized_height.webp", channel: "height", source: "reference-pixel-extraction" }, space: "tangent" }, bump: { pattern: "reference-derived height field", amplitude: 0.01, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/steel-galvanized/steel-galvanized_height.webp", url: "/3d/intake/pbr/steel-galvanized/steel-galvanized_height.webp", channel: "height", source: "reference-pixel-extraction" } }, displacement: { pattern: "none", amplitude: 0, scale: 1, silhouetteAffects: false }, ambientOcclusion: { cavityStrength: 0.38, contactShadowBias: 0.35, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/steel-galvanized/steel-galvanized_ao.webp", url: "/3d/intake/pbr/steel-galvanized/steel-galvanized_ao.webp", channel: "ao", source: "reference-pixel-extraction" }, notes: "Reference-derived cavity estimate from local height minima; verify against grazing-light screenshot." }, wear: { edgeWear: 0, scratches: [], chips: [] }, dirt: { amount: 0, cavityBias: 0, color: "#2F2A22" }, localOverrides: [{ id: "reference-pbr-pixel-evidence", type: "material-map-evidence", evidenceRefs: ["full-object"], channels: ["albedo", "roughness", "height", "normal", "ambient-occlusion"], notes: "Use generated maps as material evidence, then refine after browser screenshot comparison." }], shaderNotes: ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.", "Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.", "Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps."], notes: "Lock rods, bisagras, levas, manijas, brackets: metal expuesto mas reflectivo que el casco pintado.", referencePbr: { version: "1.0", sourceImage: "/home/jzenteno/work/crm-3d/intake/crops/galvanized.webp", extractor: "stage1_intake/extract_pbr_evidence.py", method: "single-image pixel evidence with de-lighting estimate; not photogrammetry", usable: true, verdict: "pass", confidence: 0.771, estimatedFidelity: 0.771, targetThreshold: 0.7, hardLimit: "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", maps: { albedo: { path: "/home/jzenteno/work/crm-3d/intake/pbr/steel-galvanized/steel-galvanized_albedo.webp", url: "/3d/intake/pbr/steel-galvanized/steel-galvanized_albedo.webp", channel: "albedo", source: "reference-pixel-extraction" }, roughness: { path: "/home/jzenteno/work/crm-3d/intake/pbr/steel-galvanized/steel-galvanized_roughness.webp", url: "/3d/intake/pbr/steel-galvanized/steel-galvanized_roughness.webp", channel: "roughness", source: "reference-pixel-extraction" }, height: { path: "/home/jzenteno/work/crm-3d/intake/pbr/steel-galvanized/steel-galvanized_height.webp", url: "/3d/intake/pbr/steel-galvanized/steel-galvanized_height.webp", channel: "height", source: "reference-pixel-extraction" }, normal: { path: "/home/jzenteno/work/crm-3d/intake/pbr/steel-galvanized/steel-galvanized_normal.webp", url: "/3d/intake/pbr/steel-galvanized/steel-galvanized_normal.webp", channel: "normal", source: "reference-pixel-extraction" }, ao: { path: "/home/jzenteno/work/crm-3d/intake/pbr/steel-galvanized/steel-galvanized_ao.webp", url: "/3d/intake/pbr/steel-galvanized/steel-galvanized_ao.webp", channel: "ao", source: "reference-pixel-extraction" } }, diagnostics: { sourceWidth: 440, sourceHeight: 300, mapSize: 1024, cropBBoxPixels: { x: 5, y: 0, width: 435, height: 300 }, mask: { backgroundColor: "#86878B", backgroundNoise: 45.033, transparentPixelFraction: 0, foregroundCoverage: 0.076 }, mapStats: { valueRange: 0.7258, heightP90Gradient: 0.01021, roughnessBase: 0.68, roughnessVariation: 0.05, normalStrength: 0.168, blurRadius: 21 }, palette: ["#444547", "#2A2A2B", "#383939", "#D2D2D3", "#191A1A"] }, warnings: ["foreground mask is very small", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"], albedoOverrideNote: "CONTRATO SSB: el canal albedo del recipe usa los hex de marca (brandContract), NO el albedo extraido de la referencia; la evidencia extraida vale para finish/roughness/normal/AO de pintura industrial. decal-white y paint-accent-orange comparten evidencia de finish del mismo sistema de pintura (crop paint-body)." } }, options);
  materialMap["rubber-gasket"] = createSculptMaterial("rubber-gasket", { id: "rubber-gasket", name: "Goma de burletes", type: "standard", shaderModel: "MeshStandardMaterial / PBR approximation", baseColor: "#15161A", color: "#15161A", albedo: { dominant: "#8D8D90", secondary: ["#757679", "#525255", "#313232"], samplingNotes: "Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.", map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/rubber-gasket/rubber-gasket_albedo.webp", url: "/3d/intake/pbr/rubber-gasket/rubber-gasket_albedo.webp", channel: "albedo", source: "reference-pixel-extraction" } }, colorVariation: { palette: ["#8D8D90", "#757679", "#525255", "#313232", "#CCCDCD"], pattern: "reference-derived pixel palette", amplitude: 0.235, heightCorrelation: 0.42 }, textureResolution: 1024, textureProjection: { mode: "uv", repeat: [2, 2], anisotropy: 8, texelDensityIntent: "Preserve stable world/object-scale detail; do not stretch micro detail with component scale." }, surfaceFrequencyBands: [{ id: "macro", frequency: 2, amplitude: 0.475, role: "reference-derived broad albedo and height breakup" }, { id: "meso", frequency: 14, amplitude: 0.325, role: "reference-derived cracks, ridges, pores, grain, or leaf clusters" }, { id: "micro", frequency: 72, amplitude: 0.14, role: "reference-derived micro highlight breakup under grazing light" }], roughness: { base: 0.697, variation: 0.077, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/rubber-gasket/rubber-gasket_roughness.webp", url: "/3d/intake/pbr/rubber-gasket/rubber-gasket_roughness.webp", channel: "roughness", source: "reference-pixel-extraction" }, localResponse: "reference-derived roughness estimate; cavities and textured zones trend rougher, bright highlights trend smoother" }, metalness: { base: 0, variation: 0 }, normal: { pattern: "reference-derived height-gradient normal map", strength: 0.205, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/rubber-gasket/rubber-gasket_normal.webp", url: "/3d/intake/pbr/rubber-gasket/rubber-gasket_normal.webp", channel: "normal", source: "reference-pixel-extraction" }, heightSource: { path: "/home/jzenteno/work/crm-3d/intake/pbr/rubber-gasket/rubber-gasket_height.webp", url: "/3d/intake/pbr/rubber-gasket/rubber-gasket_height.webp", channel: "height", source: "reference-pixel-extraction" }, space: "tangent" }, bump: { pattern: "reference-derived height field", amplitude: 0.019, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/rubber-gasket/rubber-gasket_height.webp", url: "/3d/intake/pbr/rubber-gasket/rubber-gasket_height.webp", channel: "height", source: "reference-pixel-extraction" } }, displacement: { pattern: "none", amplitude: 0, scale: 1, silhouetteAffects: false }, ambientOcclusion: { cavityStrength: 0.38, contactShadowBias: 0.35, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/rubber-gasket/rubber-gasket_ao.webp", url: "/3d/intake/pbr/rubber-gasket/rubber-gasket_ao.webp", channel: "ao", source: "reference-pixel-extraction" }, notes: "Reference-derived cavity estimate from local height minima; verify against grazing-light screenshot." }, wear: { edgeWear: 0, scratches: [], chips: [] }, dirt: { amount: 0, cavityBias: 0, color: "#2F2A22" }, localOverrides: [{ id: "door-perimeter", kind: "seam", region: "perimetro de ambas hojas + junta central + contra postes", description: "Tiras de goma casi negras, mate, ancho constante 0.02; leen como lineas oscuras con leve profundidad.", evidenceRef: "/3d/intake/zones/zone-r2c2.webp", confidence: 0.9 }, { id: "reference-pbr-pixel-evidence", type: "material-map-evidence", evidenceRefs: ["full-object"], channels: ["albedo", "roughness", "height", "normal", "ambient-occlusion"], notes: "Use generated maps as material evidence, then refine after browser screenshot comparison." }], shaderNotes: ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.", "Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.", "Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps."], notes: "Goma EPDM mate casi negra.", referencePbr: { version: "1.0", sourceImage: "/home/jzenteno/work/crm-3d/intake/crops/rubber.webp", extractor: "stage1_intake/extract_pbr_evidence.py", method: "single-image pixel evidence with de-lighting estimate; not photogrammetry", usable: true, verdict: "pass", confidence: 0.794, estimatedFidelity: 0.794, targetThreshold: 0.7, hardLimit: "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", maps: { albedo: { path: "/home/jzenteno/work/crm-3d/intake/pbr/rubber-gasket/rubber-gasket_albedo.webp", url: "/3d/intake/pbr/rubber-gasket/rubber-gasket_albedo.webp", channel: "albedo", source: "reference-pixel-extraction" }, roughness: { path: "/home/jzenteno/work/crm-3d/intake/pbr/rubber-gasket/rubber-gasket_roughness.webp", url: "/3d/intake/pbr/rubber-gasket/rubber-gasket_roughness.webp", channel: "roughness", source: "reference-pixel-extraction" }, height: { path: "/home/jzenteno/work/crm-3d/intake/pbr/rubber-gasket/rubber-gasket_height.webp", url: "/3d/intake/pbr/rubber-gasket/rubber-gasket_height.webp", channel: "height", source: "reference-pixel-extraction" }, normal: { path: "/home/jzenteno/work/crm-3d/intake/pbr/rubber-gasket/rubber-gasket_normal.webp", url: "/3d/intake/pbr/rubber-gasket/rubber-gasket_normal.webp", channel: "normal", source: "reference-pixel-extraction" }, ao: { path: "/home/jzenteno/work/crm-3d/intake/pbr/rubber-gasket/rubber-gasket_ao.webp", url: "/3d/intake/pbr/rubber-gasket/rubber-gasket_ao.webp", channel: "ao", source: "reference-pixel-extraction" } }, diagnostics: { sourceWidth: 60, sourceHeight: 560, mapSize: 1024, cropBBoxPixels: { x: 0, y: 0, width: 60, height: 560 }, mask: { backgroundColor: "#8F9092", backgroundNoise: 150.127, transparentPixelFraction: 0, foregroundCoverage: 1 }, mapStats: { valueRange: 0.5585, heightP90Gradient: 0.04165, roughnessBase: 0.697, roughnessVariation: 0.077, normalStrength: 0.205, blurRadius: 21 }, palette: ["#8D8D90", "#757679", "#525255", "#313232", "#CCCDCD"] }, warnings: ["foreground mask is tiny; material extraction is likely unreliable", "image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"], albedoOverrideNote: "CONTRATO SSB: el canal albedo del recipe usa los hex de marca (brandContract), NO el albedo extraido de la referencia; la evidencia extraida vale para finish/roughness/normal/AO de pintura industrial. decal-white y paint-accent-orange comparten evidencia de finish del mismo sistema de pintura (crop paint-body)." } }, options);
  materialMap["decal-white"] = createSculptMaterial("decal-white", { id: "decal-white", name: "Decales de marcas SSB", type: "standard", shaderModel: "MeshStandardMaterial / PBR approximation", baseColor: "#EAE8D6", color: "#EAE8D6", albedo: { dominant: "#89898D", secondary: ["#848589", "#8D8D91", "#919296"], samplingNotes: "Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.", map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_albedo.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_albedo.webp", channel: "albedo", source: "reference-pixel-extraction" } }, colorVariation: { palette: ["#89898D", "#848589", "#8D8D91", "#919296", "#7C7D81"], pattern: "reference-derived pixel palette", amplitude: 0.08, heightCorrelation: 0.42 }, textureResolution: 1024, textureProjection: { mode: "uv", repeat: [2, 2], anisotropy: 8, texelDensityIntent: "Preserve stable world/object-scale detail; do not stretch micro detail with component scale." }, surfaceFrequencyBands: [{ id: "macro", frequency: 2, amplitude: 0.308, role: "reference-derived broad albedo and height breakup" }, { id: "meso", frequency: 14, amplitude: 0.35, role: "reference-derived cracks, ridges, pores, grain, or leaf clusters" }, { id: "micro", frequency: 72, amplitude: 0.14, role: "reference-derived micro highlight breakup under grazing light" }], roughness: { base: 0.734, variation: 0.161, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_roughness.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_roughness.webp", channel: "roughness", source: "reference-pixel-extraction" }, localResponse: "reference-derived roughness estimate; cavities and textured zones trend rougher, bright highlights trend smoother" }, metalness: { base: 0, variation: 0 }, normal: { pattern: "reference-derived height-gradient normal map", strength: 0.252, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_normal.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_normal.webp", channel: "normal", source: "reference-pixel-extraction" }, heightSource: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", channel: "height", source: "reference-pixel-extraction" }, space: "tangent" }, bump: { pattern: "reference-derived height field", amplitude: 0.037, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", channel: "height", source: "reference-pixel-extraction" } }, displacement: { pattern: "none", amplitude: 0, scale: 1, silhouetteAffects: false }, ambientOcclusion: { cavityStrength: 0.38, contactShadowBias: 0.35, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_ao.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_ao.webp", channel: "ao", source: "reference-pixel-extraction" }, notes: "Reference-derived cavity estimate from local height minima; verify against grazing-light screenshot." }, wear: { edgeWear: 0, scratches: [], chips: [] }, dirt: { amount: 0, cavityBias: 0, color: "#2F2A22" }, localOverrides: [{ id: "markings-blocks", kind: "decal", region: "hoja DERECHA DE LA VISTA EXTERNA = componente door-leaf-left (sigla+numero+45G1); placa CSC en la hoja izquierda de la vista externa = componente door-leaf-right; y tercio trasero de laterales (bloques tara/max gross/cube)", description: "REGLA SSB: layout realista de bloques de marcas tomado de consulta 40hc_04, caracteres 100% ficticios SSB (sigla SSBX 412 027-5, digito verificador ISO 6346 real); tipografia sans condensada #EAE8D6. CERO reproduccion de BBCU 217769-9.", evidenceRef: "consulta/40hc_04.jpg", confidence: 1 }, { id: "reference-pbr-pixel-evidence", type: "material-map-evidence", evidenceRefs: ["full-object"], channels: ["albedo", "roughness", "height", "normal", "ambient-occlusion"], notes: "Use generated maps as material evidence, then refine after browser screenshot comparison." }], shaderNotes: ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.", "Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.", "Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps."], notes: "Caracteres y placa CSC: pintura blanca aplicada — mismo satinado que el casco.", referencePbr: { version: "1.0", sourceImage: "/home/jzenteno/work/crm-3d/intake/crops/paint-body.webp", extractor: "stage1_intake/extract_pbr_evidence.py", method: "single-image pixel evidence with de-lighting estimate; not photogrammetry", usable: true, verdict: "pass", confidence: 0.837, estimatedFidelity: 0.837, targetThreshold: 0.7, hardLimit: "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", maps: { albedo: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_albedo.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_albedo.webp", channel: "albedo", source: "reference-pixel-extraction" }, roughness: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_roughness.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_roughness.webp", channel: "roughness", source: "reference-pixel-extraction" }, height: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", channel: "height", source: "reference-pixel-extraction" }, normal: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_normal.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_normal.webp", channel: "normal", source: "reference-pixel-extraction" }, ao: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_ao.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_ao.webp", channel: "ao", source: "reference-pixel-extraction" } }, diagnostics: { sourceWidth: 800, sourceHeight: 400, mapSize: 1024, cropBBoxPixels: { x: 1, y: 0, width: 783, height: 400 }, mask: { backgroundColor: "#636466", backgroundNoise: 12.884, transparentPixelFraction: 0, foregroundCoverage: 0.5781 }, mapStats: { valueRange: 0.0809, heightP90Gradient: 0.08139, roughnessBase: 0.734, roughnessVariation: 0.161, normalStrength: 0.252, blurRadius: 21 }, palette: ["#89898D", "#848589", "#8D8D91", "#919296", "#7C7D81"] }, warnings: ["single-image inverse rendering cannot prove true physical PBR; confidence is capped", "low value range weakens height/roughness inference"], albedoOverrideNote: "CONTRATO SSB: el canal albedo del recipe usa los hex de marca (brandContract), NO el albedo extraido de la referencia; la evidencia extraida vale para finish/roughness/normal/AO de pintura industrial. decal-white y paint-accent-orange comparten evidencia de finish del mismo sistema de pintura (crop paint-body)." } }, options);
  materialMap["paint-accent-orange"] = createSculptMaterial("paint-accent-orange", { id: "paint-accent-orange", name: "Acento SSB naranja", type: "standard", shaderModel: "MeshStandardMaterial / PBR approximation", baseColor: "#D6640F", color: "#D6640F", albedo: { dominant: "#89898D", secondary: ["#848589", "#8D8D91", "#919296"], samplingNotes: "Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.", map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_albedo.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_albedo.webp", channel: "albedo", source: "reference-pixel-extraction" } }, colorVariation: { palette: ["#89898D", "#848589", "#8D8D91", "#919296", "#7C7D81"], pattern: "reference-derived pixel palette", amplitude: 0.08, heightCorrelation: 0.42 }, textureResolution: 1024, textureProjection: { mode: "uv", repeat: [2, 2], anisotropy: 8, texelDensityIntent: "Preserve stable world/object-scale detail; do not stretch micro detail with component scale." }, surfaceFrequencyBands: [{ id: "macro", frequency: 2, amplitude: 0.308, role: "reference-derived broad albedo and height breakup" }, { id: "meso", frequency: 14, amplitude: 0.35, role: "reference-derived cracks, ridges, pores, grain, or leaf clusters" }, { id: "micro", frequency: 72, amplitude: 0.14, role: "reference-derived micro highlight breakup under grazing light" }], roughness: { base: 0.734, variation: 0.161, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_roughness.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_roughness.webp", channel: "roughness", source: "reference-pixel-extraction" }, localResponse: "reference-derived roughness estimate; cavities and textured zones trend rougher, bright highlights trend smoother" }, metalness: { base: 0.05, variation: 0.05 }, normal: { pattern: "reference-derived height-gradient normal map", strength: 0.252, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_normal.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_normal.webp", channel: "normal", source: "reference-pixel-extraction" }, heightSource: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", channel: "height", source: "reference-pixel-extraction" }, space: "tangent" }, bump: { pattern: "reference-derived height field", amplitude: 0.037, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", channel: "height", source: "reference-pixel-extraction" } }, displacement: { pattern: "none", amplitude: 0, scale: 1, silhouetteAffects: false }, ambientOcclusion: { cavityStrength: 0.38, contactShadowBias: 0.35, map: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_ao.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_ao.webp", channel: "ao", source: "reference-pixel-extraction" }, notes: "Reference-derived cavity estimate from local height minima; verify against grazing-light screenshot." }, wear: { edgeWear: 0, scratches: [], chips: [] }, dirt: { amount: 0, cavityBias: 0, color: "#2F2A22" }, localOverrides: [{ id: "reference-pbr-pixel-evidence", type: "material-map-evidence", evidenceRefs: ["full-object"], channels: ["albedo", "roughness", "height", "normal", "ambient-occlusion"], notes: "Use generated maps as material evidence, then refine after browser screenshot comparison." }], shaderNotes: ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.", "Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.", "Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps."], notes: "Acento de marca (#D6640F de los cuadrados del logo): reservado para cuadrados del logo-decal y detalle puntual de manijas; asignacion final a validar visualmente en material-pass.", referencePbr: { version: "1.0", sourceImage: "/home/jzenteno/work/crm-3d/intake/crops/paint-body.webp", extractor: "stage1_intake/extract_pbr_evidence.py", method: "single-image pixel evidence with de-lighting estimate; not photogrammetry", usable: true, verdict: "pass", confidence: 0.837, estimatedFidelity: 0.837, targetThreshold: 0.7, hardLimit: "A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.", maps: { albedo: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_albedo.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_albedo.webp", channel: "albedo", source: "reference-pixel-extraction" }, roughness: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_roughness.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_roughness.webp", channel: "roughness", source: "reference-pixel-extraction" }, height: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_height.webp", channel: "height", source: "reference-pixel-extraction" }, normal: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_normal.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_normal.webp", channel: "normal", source: "reference-pixel-extraction" }, ao: { path: "/home/jzenteno/work/crm-3d/intake/pbr/paint-body-navy/paint-body-navy_ao.webp", url: "/3d/intake/pbr/paint-body-navy/paint-body-navy_ao.webp", channel: "ao", source: "reference-pixel-extraction" } }, diagnostics: { sourceWidth: 800, sourceHeight: 400, mapSize: 1024, cropBBoxPixels: { x: 1, y: 0, width: 783, height: 400 }, mask: { backgroundColor: "#636466", backgroundNoise: 12.884, transparentPixelFraction: 0, foregroundCoverage: 0.5781 }, mapStats: { valueRange: 0.0809, heightP90Gradient: 0.08139, roughnessBase: 0.734, roughnessVariation: 0.161, normalStrength: 0.252, blurRadius: 21 }, palette: ["#89898D", "#848589", "#8D8D91", "#919296", "#7C7D81"] }, warnings: ["single-image inverse rendering cannot prove true physical PBR; confidence is capped", "low value range weakens height/roughness inference"], albedoOverrideNote: "CONTRATO SSB: el canal albedo del recipe usa los hex de marca (brandContract), NO el albedo extraido de la referencia; la evidencia extraida vale para finish/roughness/normal/AO de pintura industrial. decal-white y paint-accent-orange comparten evidencia de finish del mismo sistema de pintura (crop paint-body)." } }, options);
  const nodes = { root };
  const meshes = {};
  const sockets = {};
  const colliders = {};
  const destructionGroups = {};
  const attachment_root_0 = null;
  const endpoint_root_0 = makeAttachmentEndpoint(attachment_root_0);
  const node_root_0 = new THREE.Group;
  node_root_0.name = "SSB 40ft High Cube Container__pivot";
  if (endpoint_root_0) {
    node_root_0.position.set(0, 0, 0);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  } else {
    node_root_0.position.set(0, 0, 0);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  }
  node_root_0.userData.sculptComponent = { id: "root", name: "SSB 40ft High Cube Container", level: "macro", role: "body", importance: 1, confidence: 0.98, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Ensamble rigido de paneles, bastidor y puertas — contenedor ISO; el root es un Group organizador. (primitive box: contenedor organizacional renderizado como caja en blockout).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: null, attachment: null, dimensions: { width: 12.192, height: 2.896, depth: 2.438, units: "meters", confidence: 0.95 }, transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "root", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "root", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } }, material: "paint-body-navy", materialLayers: ["paint-body-navy"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(18, 28, 47, 1.0)", secondaryAlbedo: "rgba(24, 35, 56, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_root_0.userData.actionProfile = { animationRole: "root", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "root", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } };
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = new THREE.BoxGeometry(12.192, 2.896, 2.438).translate(0, 1.448, 0);
  const mesh_root_0 = new THREE.Mesh(mesh_root_0Geometry, materialMap["paint-body-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_root_0.name = "SSB 40ft High Cube Container";
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = { id: "root", name: "SSB 40ft High Cube Container", level: "macro", role: "body", importance: 1, confidence: 0.98, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Ensamble rigido de paneles, bastidor y puertas — contenedor ISO; el root es un Group organizador. (primitive box: contenedor organizacional renderizado como caja en blockout).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: null, attachment: null, dimensions: { width: 12.192, height: 2.896, depth: 2.438, units: "meters", confidence: 0.95 }, transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "root", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "root", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } }, material: "paint-body-navy", materialLayers: ["paint-body-navy"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(18, 28, 47, 1.0)", secondaryAlbedo: "rgba(24, 35, 56, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);
  const attachment_side_wall_right_1 = null;
  const endpoint_side_wall_right_1 = makeAttachmentEndpoint(attachment_side_wall_right_1);
  const node_side_wall_right_1 = new THREE.Group;
  node_side_wall_right_1.name = "Pared lateral derecha (visible en ref)__pivot";
  if (endpoint_side_wall_right_1) {
    node_side_wall_right_1.position.set(0, 1.498, 1.201);
    node_side_wall_right_1.rotation.set(0, 0, 0);
    node_side_wall_right_1.scale.set(1, 1, 1);
  } else {
    node_side_wall_right_1.position.set(0, 1.498, 1.201);
    node_side_wall_right_1.rotation.set(0, 0, 0);
    node_side_wall_right_1.scale.set(1, 1, 1);
  }
  node_side_wall_right_1.userData.sculptComponent = { id: "side-wall-right", name: "Pared lateral derecha (visible en ref)", level: "macro", role: "body-shell", importance: 0.8, confidence: 0.9, primitive: "extrude", topologyClass: "assembled-solid", topologyRationale: "Chapa de acero conformada: perfil trapezoidal repetido extruido en alto de panel — panel rigido, no volumen organico.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "root", attachment: null, dimensions: { width: 11.892, height: 2.676, depth: 0.036, units: "meters", confidence: 0.95 }, transform: { position: [0, 1.498, 1.201], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "side-wall-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } }, material: "paint-body-navy", materialLayers: ["paint-body-navy"], deformations: [], joints: [], seams: [], localFeatures: [{ id: "flute-profile", kind: "ridge", description: "Corrugado vertical trapezoidal: cresta ancha plana / valle angosto, webs cortos angulados, bevel corto en pliegues; profundidad 0.036 m, pitch ~0.28 m (ajuste visual en form-refinement); relieve GEOMETRICO (afecta silueta en escorzo).", geometryEffect: { type: "extruded-profile", pitch: 0.28, depth: 0.036, crestRatio: 0.42, valleyRatio: 0.28, bevel: 0.006 }, evidenceRefs: ["side-field"], confidence: 0.95 }, { id: "holdback-plates", kind: "fastener", description: "Retenedores de puerta (holdback catch) sobre el panel cerca del poste trasero + placa equivalente cerca del frente; placa 0.06x0.12 con 2 fijaciones.", geometryEffect: { type: "raised-plate", count: 2, size: [0.06, 0.12, 0.015] }, evidenceRefs: ["door-end-detail"], confidence: 0.7 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["side-field", "full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(18, 28, 47, 1.0)", secondaryAlbedo: "rgba(24, 35, 56, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_side_wall_right_1.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "side-wall-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } };
  (nodes["root"] ?? root).add(node_side_wall_right_1);
  nodes["side-wall-right"] = node_side_wall_right_1;
  const mesh_side_wall_right_1Geometry = new THREE.BoxGeometry(11.892, 2.676, 0.036);
  const mesh_side_wall_right_1 = new THREE.Mesh(mesh_side_wall_right_1Geometry, materialMap["paint-body-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_side_wall_right_1.name = "Pared lateral derecha (visible en ref)";
  mesh_side_wall_right_1.castShadow = options.castShadow ?? true;
  mesh_side_wall_right_1.receiveShadow = options.receiveShadow ?? true;
  mesh_side_wall_right_1.userData.sculptComponent = { id: "side-wall-right", name: "Pared lateral derecha (visible en ref)", level: "macro", role: "body-shell", importance: 0.8, confidence: 0.9, primitive: "extrude", topologyClass: "assembled-solid", topologyRationale: "Chapa de acero conformada: perfil trapezoidal repetido extruido en alto de panel — panel rigido, no volumen organico.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "root", attachment: null, dimensions: { width: 11.892, height: 2.676, depth: 0.036, units: "meters", confidence: 0.95 }, transform: { position: [0, 1.498, 1.201], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "side-wall-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } }, material: "paint-body-navy", materialLayers: ["paint-body-navy"], deformations: [], joints: [], seams: [], localFeatures: [{ id: "flute-profile", kind: "ridge", description: "Corrugado vertical trapezoidal: cresta ancha plana / valle angosto, webs cortos angulados, bevel corto en pliegues; profundidad 0.036 m, pitch ~0.28 m (ajuste visual en form-refinement); relieve GEOMETRICO (afecta silueta en escorzo).", geometryEffect: { type: "extruded-profile", pitch: 0.28, depth: 0.036, crestRatio: 0.42, valleyRatio: 0.28, bevel: 0.006 }, evidenceRefs: ["side-field"], confidence: 0.95 }, { id: "holdback-plates", kind: "fastener", description: "Retenedores de puerta (holdback catch) sobre el panel cerca del poste trasero + placa equivalente cerca del frente; placa 0.06x0.12 con 2 fijaciones.", geometryEffect: { type: "raised-plate", count: 2, size: [0.06, 0.12, 0.015] }, evidenceRefs: ["door-end-detail"], confidence: 0.7 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["side-field", "full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(18, 28, 47, 1.0)", secondaryAlbedo: "rgba(24, 35, 56, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_side_wall_right_1.add(mesh_side_wall_right_1);
  meshes["side-wall-right"] = mesh_side_wall_right_1;
  colliders["side-wall-right"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["side-wall-right"] ??= [];
  destructionGroups["side-wall-right"].push(node_side_wall_right_1);
  const attachment_side_wall_left_2 = null;
  const endpoint_side_wall_left_2 = makeAttachmentEndpoint(attachment_side_wall_left_2);
  const node_side_wall_left_2 = new THREE.Group;
  node_side_wall_left_2.name = "Pared lateral izquierda (espejo)__pivot";
  if (endpoint_side_wall_left_2) {
    node_side_wall_left_2.position.set(0, 1.498, -1.201);
    node_side_wall_left_2.rotation.set(0, 0, 0);
    node_side_wall_left_2.scale.set(1, 1, 1);
  } else {
    node_side_wall_left_2.position.set(0, 1.498, -1.201);
    node_side_wall_left_2.rotation.set(0, 0, 0);
    node_side_wall_left_2.scale.set(1, 1, 1);
  }
  node_side_wall_left_2.userData.sculptComponent = { id: "side-wall-left", name: "Pared lateral izquierda (espejo)", level: "macro", role: "body-shell", importance: 0.8, confidence: 0.9, primitive: "extrude", topologyClass: "assembled-solid", topologyRationale: "Espejo exacto de side-wall-right (oculta en ref; inferida por norma).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "root", attachment: null, dimensions: { width: 11.892, height: 2.676, depth: 0.036, units: "meters", confidence: 0.95 }, transform: { position: [0, 1.498, -1.201], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "side-wall-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } }, material: "paint-body-navy", materialLayers: ["paint-body-navy"], deformations: [], joints: [], seams: [], localFeatures: [{ id: "flute-profile-mirror", kind: "ridge", description: "Mismo corrugado trapezoidal que side-wall-right (espejado).", geometryEffect: { type: "extruded-profile", pitch: 0.28, depth: 0.036, crestRatio: 0.42, valleyRatio: 0.28, bevel: 0.006 }, evidenceRefs: ["side-field"], confidence: 0.9 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["side-field"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(18, 28, 47, 1.0)", secondaryAlbedo: "rgba(24, 35, 56, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_side_wall_left_2.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "side-wall-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } };
  (nodes["root"] ?? root).add(node_side_wall_left_2);
  nodes["side-wall-left"] = node_side_wall_left_2;
  const mesh_side_wall_left_2Geometry = new THREE.BoxGeometry(11.892, 2.676, 0.036);
  const mesh_side_wall_left_2 = new THREE.Mesh(mesh_side_wall_left_2Geometry, materialMap["paint-body-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_side_wall_left_2.name = "Pared lateral izquierda (espejo)";
  mesh_side_wall_left_2.castShadow = options.castShadow ?? true;
  mesh_side_wall_left_2.receiveShadow = options.receiveShadow ?? true;
  mesh_side_wall_left_2.userData.sculptComponent = { id: "side-wall-left", name: "Pared lateral izquierda (espejo)", level: "macro", role: "body-shell", importance: 0.8, confidence: 0.9, primitive: "extrude", topologyClass: "assembled-solid", topologyRationale: "Espejo exacto de side-wall-right (oculta en ref; inferida por norma).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "root", attachment: null, dimensions: { width: 11.892, height: 2.676, depth: 0.036, units: "meters", confidence: 0.95 }, transform: { position: [0, 1.498, -1.201], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "side-wall-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } }, material: "paint-body-navy", materialLayers: ["paint-body-navy"], deformations: [], joints: [], seams: [], localFeatures: [{ id: "flute-profile-mirror", kind: "ridge", description: "Mismo corrugado trapezoidal que side-wall-right (espejado).", geometryEffect: { type: "extruded-profile", pitch: 0.28, depth: 0.036, crestRatio: 0.42, valleyRatio: 0.28, bevel: 0.006 }, evidenceRefs: ["side-field"], confidence: 0.9 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["side-field"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(18, 28, 47, 1.0)", secondaryAlbedo: "rgba(24, 35, 56, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_side_wall_left_2.add(mesh_side_wall_left_2);
  meshes["side-wall-left"] = mesh_side_wall_left_2;
  colliders["side-wall-left"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["side-wall-left"] ??= [];
  destructionGroups["side-wall-left"].push(node_side_wall_left_2);
  const attachment_front_wall_3 = null;
  const endpoint_front_wall_3 = makeAttachmentEndpoint(attachment_front_wall_3);
  const node_front_wall_3 = new THREE.Group;
  node_front_wall_3.name = "Testero ciego (extremo -X)__pivot";
  if (endpoint_front_wall_3) {
    node_front_wall_3.position.set(-6.078, 1.528, 0);
    node_front_wall_3.rotation.set(0, 0, 0);
    node_front_wall_3.scale.set(1, 1, 1);
  } else {
    node_front_wall_3.position.set(-6.078, 1.528, 0);
    node_front_wall_3.rotation.set(0, 0, 0);
    node_front_wall_3.scale.set(1, 1, 1);
  }
  node_front_wall_3.userData.sculptComponent = { id: "front-wall", name: "Testero ciego (extremo -X)", level: "macro", role: "body-shell", importance: 0.8, confidence: 0.85, primitive: "extrude", topologyClass: "assembled-solid", topologyRationale: "Panel corrugado vertical estandar (oculto en ref; confirmado en consulta 40hc_03).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "root", attachment: null, dimensions: { width: 0.036, height: 2.736, depth: 2.138, units: "meters", confidence: 0.95 }, transform: { position: [-6.078, 1.528, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "front-wall", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } }, material: "paint-body-navy", materialLayers: ["paint-body-navy"], deformations: [], joints: [], seams: [], localFeatures: [{ id: "flute-profile-end", kind: "ridge", description: "Corrugado vertical del testero, mismo perfil familia que laterales.", geometryEffect: { type: "extruded-profile", pitch: 0.28, depth: 0.036, crestRatio: 0.42, valleyRatio: 0.28, bevel: 0.006 }, evidenceRefs: ["full-object"], confidence: 0.85 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(18, 28, 47, 1.0)", secondaryAlbedo: "rgba(24, 35, 56, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_front_wall_3.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "front-wall", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } };
  (nodes["root"] ?? root).add(node_front_wall_3);
  nodes["front-wall"] = node_front_wall_3;
  const mesh_front_wall_3Geometry = new THREE.BoxGeometry(0.036, 2.736, 2.138);
  const mesh_front_wall_3 = new THREE.Mesh(mesh_front_wall_3Geometry, materialMap["paint-body-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_front_wall_3.name = "Testero ciego (extremo -X)";
  mesh_front_wall_3.castShadow = options.castShadow ?? true;
  mesh_front_wall_3.receiveShadow = options.receiveShadow ?? true;
  mesh_front_wall_3.userData.sculptComponent = { id: "front-wall", name: "Testero ciego (extremo -X)", level: "macro", role: "body-shell", importance: 0.8, confidence: 0.85, primitive: "extrude", topologyClass: "assembled-solid", topologyRationale: "Panel corrugado vertical estandar (oculto en ref; confirmado en consulta 40hc_03).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "root", attachment: null, dimensions: { width: 0.036, height: 2.736, depth: 2.138, units: "meters", confidence: 0.95 }, transform: { position: [-6.078, 1.528, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "front-wall", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } }, material: "paint-body-navy", materialLayers: ["paint-body-navy"], deformations: [], joints: [], seams: [], localFeatures: [{ id: "flute-profile-end", kind: "ridge", description: "Corrugado vertical del testero, mismo perfil familia que laterales.", geometryEffect: { type: "extruded-profile", pitch: 0.28, depth: 0.036, crestRatio: 0.42, valleyRatio: 0.28, bevel: 0.006 }, evidenceRefs: ["full-object"], confidence: 0.85 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(18, 28, 47, 1.0)", secondaryAlbedo: "rgba(24, 35, 56, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_front_wall_3.add(mesh_front_wall_3);
  meshes["front-wall"] = mesh_front_wall_3;
  colliders["front-wall"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["front-wall"] ??= [];
  destructionGroups["front-wall"].push(node_front_wall_3);
  const attachment_roof_panel_4 = null;
  const endpoint_roof_panel_4 = makeAttachmentEndpoint(attachment_roof_panel_4);
  const node_roof_panel_4 = new THREE.Group;
  node_roof_panel_4.name = "Techo__pivot";
  if (endpoint_roof_panel_4) {
    node_roof_panel_4.position.set(0, 2.881, 0);
    node_roof_panel_4.rotation.set(0, 0, 0);
    node_roof_panel_4.scale.set(1, 1, 1);
  } else {
    node_roof_panel_4.position.set(0, 2.881, 0);
    node_roof_panel_4.rotation.set(0, 0, 0);
    node_roof_panel_4.scale.set(1, 1, 1);
  }
  node_roof_panel_4.userData.sculptComponent = { id: "roof-panel", name: "Techo", level: "macro", role: "body-shell", importance: 0.8, confidence: 0.9, primitive: "extrude", topologyClass: "assembled-solid", topologyRationale: "Chapa de techo con costillas transversales bajas y margen perimetral PLANO (las costillas no llegan al borde).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "root", attachment: null, dimensions: { width: 11.892, height: 0.03, depth: 2.1380000000000003, units: "meters", confidence: 0.95 }, transform: { position: [0, 2.881, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "roof-panel", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } }, material: "paint-body-navy", materialLayers: ["paint-body-navy"], deformations: [], joints: [], seams: [], localFeatures: [{ id: "rib-profile", kind: "ridge", description: "Costillas transversales elevadas de perfil trapezoidal bajo (profundidad ~0.012), pitch ~0.23 m, con margen plano perimetral de ~0.10 m antes de rails.", geometryEffect: { type: "transverse-ribs", pitch: 0.23, depth: 0.012, flatMargin: 0.1 }, evidenceRefs: ["roof-field"], confidence: 0.9 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["roof-field"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(18, 28, 47, 1.0)", secondaryAlbedo: "rgba(24, 35, 56, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_roof_panel_4.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "roof-panel", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } };
  (nodes["root"] ?? root).add(node_roof_panel_4);
  nodes["roof-panel"] = node_roof_panel_4;
  const mesh_roof_panel_4Geometry = new THREE.BoxGeometry(11.892, 0.03, 2.1380000000000003);
  const mesh_roof_panel_4 = new THREE.Mesh(mesh_roof_panel_4Geometry, materialMap["paint-body-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_roof_panel_4.name = "Techo";
  mesh_roof_panel_4.castShadow = options.castShadow ?? true;
  mesh_roof_panel_4.receiveShadow = options.receiveShadow ?? true;
  mesh_roof_panel_4.userData.sculptComponent = { id: "roof-panel", name: "Techo", level: "macro", role: "body-shell", importance: 0.8, confidence: 0.9, primitive: "extrude", topologyClass: "assembled-solid", topologyRationale: "Chapa de techo con costillas transversales bajas y margen perimetral PLANO (las costillas no llegan al borde).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "root", attachment: null, dimensions: { width: 11.892, height: 0.03, depth: 2.1380000000000003, units: "meters", confidence: 0.95 }, transform: { position: [0, 2.881, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "roof-panel", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } }, material: "paint-body-navy", materialLayers: ["paint-body-navy"], deformations: [], joints: [], seams: [], localFeatures: [{ id: "rib-profile", kind: "ridge", description: "Costillas transversales elevadas de perfil trapezoidal bajo (profundidad ~0.012), pitch ~0.23 m, con margen plano perimetral de ~0.10 m antes de rails.", geometryEffect: { type: "transverse-ribs", pitch: 0.23, depth: 0.012, flatMargin: 0.1 }, evidenceRefs: ["roof-field"], confidence: 0.9 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["roof-field"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(18, 28, 47, 1.0)", secondaryAlbedo: "rgba(24, 35, 56, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_roof_panel_4.add(mesh_roof_panel_4);
  meshes["roof-panel"] = mesh_roof_panel_4;
  colliders["roof-panel"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["roof-panel"] ??= [];
  destructionGroups["roof-panel"].push(node_roof_panel_4);
  const attachment_underframe_5 = null;
  const endpoint_underframe_5 = makeAttachmentEndpoint(attachment_underframe_5);
  const node_underframe_5 = new THREE.Group;
  node_underframe_5.name = "Bastidor inferior__pivot";
  if (endpoint_underframe_5) {
    node_underframe_5.position.set(0, 0.08, 0);
    node_underframe_5.rotation.set(0, 0, 0);
    node_underframe_5.scale.set(1, 1, 1);
  } else {
    node_underframe_5.position.set(0, 0.08, 0);
    node_underframe_5.rotation.set(0, 0, 0);
    node_underframe_5.scale.set(1, 1, 1);
  }
  node_underframe_5.userData.sculptComponent = { id: "underframe", name: "Bastidor inferior", level: "macro", role: "frame", importance: 0.8, confidence: 0.85, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Conjunto de largueros inferiores + travesanos (travesanos simplificados: ocultos). (primitive box: contenedor organizacional renderizado como caja en blockout).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "root", attachment: null, dimensions: { width: 12.192, height: 0.16, depth: 2.438, units: "meters", confidence: 0.95 }, transform: { position: [0, 0.08, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "underframe", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_underframe_5.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "underframe", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } };
  (nodes["root"] ?? root).add(node_underframe_5);
  nodes["underframe"] = node_underframe_5;
  const mesh_underframe_5Geometry = new THREE.BoxGeometry(12.192, 0.16, 2.438);
  const mesh_underframe_5 = new THREE.Mesh(mesh_underframe_5Geometry, materialMap["paint-structure"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_underframe_5.name = "Bastidor inferior";
  mesh_underframe_5.castShadow = options.castShadow ?? true;
  mesh_underframe_5.receiveShadow = options.receiveShadow ?? true;
  mesh_underframe_5.userData.sculptComponent = { id: "underframe", name: "Bastidor inferior", level: "macro", role: "frame", importance: 0.8, confidence: 0.85, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Conjunto de largueros inferiores + travesanos (travesanos simplificados: ocultos). (primitive box: contenedor organizacional renderizado como caja en blockout).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "root", attachment: null, dimensions: { width: 12.192, height: 0.16, depth: 2.438, units: "meters", confidence: 0.95 }, transform: { position: [0, 0.08, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "underframe", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_underframe_5.add(mesh_underframe_5);
  meshes["underframe"] = mesh_underframe_5;
  colliders["underframe"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["underframe"] ??= [];
  destructionGroups["underframe"].push(node_underframe_5);
  const attachment_door_assembly_6 = null;
  const endpoint_door_assembly_6 = makeAttachmentEndpoint(attachment_door_assembly_6);
  const node_door_assembly_6 = new THREE.Group;
  node_door_assembly_6.name = "Conjunto de puertas (extremo +X)__pivot";
  if (endpoint_door_assembly_6) {
    node_door_assembly_6.position.set(0, 0, 0);
    node_door_assembly_6.rotation.set(0, 0, 0);
    node_door_assembly_6.scale.set(1, 1, 1);
  } else {
    node_door_assembly_6.position.set(0, 0, 0);
    node_door_assembly_6.rotation.set(0, 0, 0);
    node_door_assembly_6.scale.set(1, 1, 1);
  }
  node_door_assembly_6.userData.sculptComponent = { id: "door-assembly", name: "Conjunto de puertas (extremo +X)", level: "macro", role: "assembly", importance: 1, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Ensamble articulado: 2 hojas + herraje completo; el rasgo identitario #1. (primitive box: contenedor organizacional renderizado como caja en blockout). Posicion en origen: los hijos llevan coordenadas de mundo.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "root", attachment: null, dimensions: { width: 0.02, height: 0.02, depth: 0.02, units: "meters", confidence: 0.95 }, transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "door-assembly", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } }, material: "paint-body-navy", materialLayers: ["paint-body-navy"], deformations: [], joints: [], seams: [], localFeatures: [{ id: "lock-rod-system", kind: "fastener", description: "4 lock rods verticales completos (2 por hoja) Ø0.025, acabado galvanizado, cada uno con 2 brackets standoff; las levas engranan keepers en header y sill.", geometryEffect: { type: "rod-system", count: 4, diameter: 0.025, standoff: 0.045 }, evidenceRefs: ["door-end-detail"], confidence: 0.95 }, { id: "cam-keeper-sets", kind: "fastener", description: "8 conjuntos leva+keeper con base: 4 contra header, 4 contra sill; caja ~0.09.", geometryEffect: { type: "instanced-fastener", count: 8, size: [0.09, 0.09, 0.07] }, evidenceRefs: ["door-end-detail"], confidence: 0.9 }, { id: "handle-sets", kind: "fastener", description: "4 manijas en tercio inferior de cada rod: hub + brazo angulado 0.45 + retenedor con caja de precinto en rods internos.", geometryEffect: { type: "instanced-fastener", count: 4, armLength: 0.45 }, evidenceRefs: ["door-end-detail"], confidence: 0.85 }, { id: "hinge-sets", kind: "fastener", description: "Bisagras de pala externas: 4 por hoja sobre postes traseros, pala 0.16x0.06 + barril de pasador.", geometryEffect: { type: "instanced-fastener", count: 8, size: [0.16, 0.06, 0.02] }, evidenceRefs: ["door-end-detail"], confidence: 0.8 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(18, 28, 47, 1.0)", secondaryAlbedo: "rgba(24, 35, 56, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_door_assembly_6.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "door-assembly", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } };
  (nodes["root"] ?? root).add(node_door_assembly_6);
  nodes["door-assembly"] = node_door_assembly_6;
  const mesh_door_assembly_6Geometry = new THREE.BoxGeometry(0.02, 0.02, 0.02);
  const mesh_door_assembly_6 = new THREE.Mesh(mesh_door_assembly_6Geometry, materialMap["paint-body-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_door_assembly_6.name = "Conjunto de puertas (extremo +X)";
  mesh_door_assembly_6.castShadow = options.castShadow ?? true;
  mesh_door_assembly_6.receiveShadow = options.receiveShadow ?? true;
  mesh_door_assembly_6.userData.sculptComponent = { id: "door-assembly", name: "Conjunto de puertas (extremo +X)", level: "macro", role: "assembly", importance: 1, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Ensamble articulado: 2 hojas + herraje completo; el rasgo identitario #1. (primitive box: contenedor organizacional renderizado como caja en blockout). Posicion en origen: los hijos llevan coordenadas de mundo.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "root", attachment: null, dimensions: { width: 0.02, height: 0.02, depth: 0.02, units: "meters", confidence: 0.95 }, transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "door-assembly", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } }, material: "paint-body-navy", materialLayers: ["paint-body-navy"], deformations: [], joints: [], seams: [], localFeatures: [{ id: "lock-rod-system", kind: "fastener", description: "4 lock rods verticales completos (2 por hoja) Ø0.025, acabado galvanizado, cada uno con 2 brackets standoff; las levas engranan keepers en header y sill.", geometryEffect: { type: "rod-system", count: 4, diameter: 0.025, standoff: 0.045 }, evidenceRefs: ["door-end-detail"], confidence: 0.95 }, { id: "cam-keeper-sets", kind: "fastener", description: "8 conjuntos leva+keeper con base: 4 contra header, 4 contra sill; caja ~0.09.", geometryEffect: { type: "instanced-fastener", count: 8, size: [0.09, 0.09, 0.07] }, evidenceRefs: ["door-end-detail"], confidence: 0.9 }, { id: "handle-sets", kind: "fastener", description: "4 manijas en tercio inferior de cada rod: hub + brazo angulado 0.45 + retenedor con caja de precinto en rods internos.", geometryEffect: { type: "instanced-fastener", count: 4, armLength: 0.45 }, evidenceRefs: ["door-end-detail"], confidence: 0.85 }, { id: "hinge-sets", kind: "fastener", description: "Bisagras de pala externas: 4 por hoja sobre postes traseros, pala 0.16x0.06 + barril de pasador.", geometryEffect: { type: "instanced-fastener", count: 8, size: [0.16, 0.06, 0.02] }, evidenceRefs: ["door-end-detail"], confidence: 0.8 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(18, 28, 47, 1.0)", secondaryAlbedo: "rgba(24, 35, 56, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_door_assembly_6.add(mesh_door_assembly_6);
  meshes["door-assembly"] = mesh_door_assembly_6;
  colliders["door-assembly"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["door-assembly"] ??= [];
  destructionGroups["door-assembly"].push(node_door_assembly_6);
  const attachment_corner_structure_7 = null;
  const endpoint_corner_structure_7 = makeAttachmentEndpoint(attachment_corner_structure_7);
  const node_corner_structure_7 = new THREE.Group;
  node_corner_structure_7.name = "Estructura de esquinas y rails__pivot";
  if (endpoint_corner_structure_7) {
    node_corner_structure_7.position.set(0, 0, 0);
    node_corner_structure_7.rotation.set(0, 0, 0);
    node_corner_structure_7.scale.set(1, 1, 1);
  } else {
    node_corner_structure_7.position.set(0, 0, 0);
    node_corner_structure_7.rotation.set(0, 0, 0);
    node_corner_structure_7.scale.set(1, 1, 1);
  }
  node_corner_structure_7.userData.sculptComponent = { id: "corner-structure", name: "Estructura de esquinas y rails", level: "macro", role: "frame", importance: 0.95, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Postes esquineros + rails superiores + esquineros ISO — el marco resistente. (primitive box: contenedor organizacional renderizado como caja en blockout). Posicion en origen: los hijos llevan coordenadas de mundo.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "root", attachment: null, dimensions: { width: 0.02, height: 0.02, depth: 0.02, units: "meters", confidence: 0.95 }, transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-structure", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_corner_structure_7.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-structure", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } };
  (nodes["root"] ?? root).add(node_corner_structure_7);
  nodes["corner-structure"] = node_corner_structure_7;
  const mesh_corner_structure_7Geometry = new THREE.BoxGeometry(0.02, 0.02, 0.02);
  const mesh_corner_structure_7 = new THREE.Mesh(mesh_corner_structure_7Geometry, materialMap["paint-structure"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_corner_structure_7.name = "Estructura de esquinas y rails";
  mesh_corner_structure_7.castShadow = options.castShadow ?? true;
  mesh_corner_structure_7.receiveShadow = options.receiveShadow ?? true;
  mesh_corner_structure_7.userData.sculptComponent = { id: "corner-structure", name: "Estructura de esquinas y rails", level: "macro", role: "frame", importance: 0.95, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Postes esquineros + rails superiores + esquineros ISO — el marco resistente. (primitive box: contenedor organizacional renderizado como caja en blockout). Posicion en origen: los hijos llevan coordenadas de mundo.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "root", attachment: null, dimensions: { width: 0.02, height: 0.02, depth: 0.02, units: "meters", confidence: 0.95 }, transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-structure", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_corner_structure_7.add(mesh_corner_structure_7);
  meshes["corner-structure"] = mesh_corner_structure_7;
  colliders["corner-structure"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["corner-structure"] ??= [];
  destructionGroups["corner-structure"].push(node_corner_structure_7);
  const attachment_top_side_rail_right_8 = null;
  const endpoint_top_side_rail_right_8 = makeAttachmentEndpoint(attachment_top_side_rail_right_8);
  const node_top_side_rail_right_8 = new THREE.Group;
  node_top_side_rail_right_8.name = "Rail superior lateral right__pivot";
  if (endpoint_top_side_rail_right_8) {
    node_top_side_rail_right_8.position.set(0, 2.866, 1.189);
    node_top_side_rail_right_8.rotation.set(0, 0, 0);
    node_top_side_rail_right_8.scale.set(1, 1, 1);
  } else {
    node_top_side_rail_right_8.position.set(0, 2.866, 1.189);
    node_top_side_rail_right_8.rotation.set(0, 0, 0);
    node_top_side_rail_right_8.scale.set(1, 1, 1);
  }
  node_top_side_rail_right_8.userData.sculptComponent = { id: "top-side-rail-right", name: "Rail superior lateral right", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Tubo cuadrado 60x60 entre esquineros superiores.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "corner-structure", attachment: null, dimensions: { width: 11.892, height: 0.06, depth: 0.06, units: "meters", confidence: 0.95 }, transform: { position: [0, 2.866, 1.189], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "top-side-rail-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: ["seam-roof-rail", "seam-wall-rail"], localFeatures: [{ id: "panel-seam", kind: "seam", description: "Seam fino panel-rail: el margen plano del techo y la chapa lateral rematan contra el rail.", geometryEffect: { type: "groove", width: 0.004, depth: 0.003 }, evidenceRefs: ["roof-field"], confidence: 0.85 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_top_side_rail_right_8.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "top-side-rail-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } };
  (nodes["corner-structure"] ?? root).add(node_top_side_rail_right_8);
  nodes["top-side-rail-right"] = node_top_side_rail_right_8;
  const mesh_top_side_rail_right_8Geometry = new THREE.BoxGeometry(11.892, 0.06, 0.06);
  const mesh_top_side_rail_right_8 = new THREE.Mesh(mesh_top_side_rail_right_8Geometry, materialMap["paint-structure"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_top_side_rail_right_8.name = "Rail superior lateral right";
  mesh_top_side_rail_right_8.castShadow = options.castShadow ?? true;
  mesh_top_side_rail_right_8.receiveShadow = options.receiveShadow ?? true;
  mesh_top_side_rail_right_8.userData.sculptComponent = { id: "top-side-rail-right", name: "Rail superior lateral right", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Tubo cuadrado 60x60 entre esquineros superiores.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "corner-structure", attachment: null, dimensions: { width: 11.892, height: 0.06, depth: 0.06, units: "meters", confidence: 0.95 }, transform: { position: [0, 2.866, 1.189], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "top-side-rail-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: ["seam-roof-rail", "seam-wall-rail"], localFeatures: [{ id: "panel-seam", kind: "seam", description: "Seam fino panel-rail: el margen plano del techo y la chapa lateral rematan contra el rail.", geometryEffect: { type: "groove", width: 0.004, depth: 0.003 }, evidenceRefs: ["roof-field"], confidence: 0.85 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_top_side_rail_right_8.add(mesh_top_side_rail_right_8);
  meshes["top-side-rail-right"] = mesh_top_side_rail_right_8;
  colliders["top-side-rail-right"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["top-side-rail-right"] ??= [];
  destructionGroups["top-side-rail-right"].push(node_top_side_rail_right_8);
  const attachment_bottom_side_rail_right_9 = null;
  const endpoint_bottom_side_rail_right_9 = makeAttachmentEndpoint(attachment_bottom_side_rail_right_9);
  const node_bottom_side_rail_right_9 = new THREE.Group;
  node_bottom_side_rail_right_9.name = "Larguero inferior right__pivot";
  if (endpoint_bottom_side_rail_right_9) {
    node_bottom_side_rail_right_9.position.set(0, 0, 1.195);
    node_bottom_side_rail_right_9.rotation.set(0, 0, 0);
    node_bottom_side_rail_right_9.scale.set(1, 1, 1);
  } else {
    node_bottom_side_rail_right_9.position.set(0, 0, 1.195);
    node_bottom_side_rail_right_9.rotation.set(0, 0, 0);
    node_bottom_side_rail_right_9.scale.set(1, 1, 1);
  }
  node_bottom_side_rail_right_9.userData.sculptComponent = { id: "bottom-side-rail-right", name: "Larguero inferior right", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Perfil C 160 de ala corta; cara frontal plana con escalon respecto de los valles del corrugado.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "underframe", attachment: null, dimensions: { width: 11.892, height: 0.16, depth: 0.048, units: "meters", confidence: 0.95 }, transform: { position: [0, 0, 1.195], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "bottom-side-rail-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: ["seam-wall-bottomrail"], localFeatures: [{ id: "panel-seam", kind: "seam", description: "Costura limpia donde las flautas terminan contra el ala superior del rail; escalon visible.", geometryEffect: { type: "step-seam", step: 0.012 }, evidenceRefs: ["bottom-rail-detail"], confidence: 0.9 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_bottom_side_rail_right_9.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "bottom-side-rail-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } };
  (nodes["underframe"] ?? root).add(node_bottom_side_rail_right_9);
  nodes["bottom-side-rail-right"] = node_bottom_side_rail_right_9;
  const mesh_bottom_side_rail_right_9Geometry = new THREE.BoxGeometry(11.892, 0.16, 0.048);
  const mesh_bottom_side_rail_right_9 = new THREE.Mesh(mesh_bottom_side_rail_right_9Geometry, materialMap["paint-structure"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_bottom_side_rail_right_9.name = "Larguero inferior right";
  mesh_bottom_side_rail_right_9.castShadow = options.castShadow ?? true;
  mesh_bottom_side_rail_right_9.receiveShadow = options.receiveShadow ?? true;
  mesh_bottom_side_rail_right_9.userData.sculptComponent = { id: "bottom-side-rail-right", name: "Larguero inferior right", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Perfil C 160 de ala corta; cara frontal plana con escalon respecto de los valles del corrugado.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "underframe", attachment: null, dimensions: { width: 11.892, height: 0.16, depth: 0.048, units: "meters", confidence: 0.95 }, transform: { position: [0, 0, 1.195], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "bottom-side-rail-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: ["seam-wall-bottomrail"], localFeatures: [{ id: "panel-seam", kind: "seam", description: "Costura limpia donde las flautas terminan contra el ala superior del rail; escalon visible.", geometryEffect: { type: "step-seam", step: 0.012 }, evidenceRefs: ["bottom-rail-detail"], confidence: 0.9 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_bottom_side_rail_right_9.add(mesh_bottom_side_rail_right_9);
  meshes["bottom-side-rail-right"] = mesh_bottom_side_rail_right_9;
  colliders["bottom-side-rail-right"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["bottom-side-rail-right"] ??= [];
  destructionGroups["bottom-side-rail-right"].push(node_bottom_side_rail_right_9);
  const attachment_top_side_rail_left_10 = null;
  const endpoint_top_side_rail_left_10 = makeAttachmentEndpoint(attachment_top_side_rail_left_10);
  const node_top_side_rail_left_10 = new THREE.Group;
  node_top_side_rail_left_10.name = "Rail superior lateral left__pivot";
  if (endpoint_top_side_rail_left_10) {
    node_top_side_rail_left_10.position.set(0, 2.866, -1.189);
    node_top_side_rail_left_10.rotation.set(0, 0, 0);
    node_top_side_rail_left_10.scale.set(1, 1, 1);
  } else {
    node_top_side_rail_left_10.position.set(0, 2.866, -1.189);
    node_top_side_rail_left_10.rotation.set(0, 0, 0);
    node_top_side_rail_left_10.scale.set(1, 1, 1);
  }
  node_top_side_rail_left_10.userData.sculptComponent = { id: "top-side-rail-left", name: "Rail superior lateral left", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Tubo cuadrado 60x60 entre esquineros superiores.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "corner-structure", attachment: null, dimensions: { width: 11.892, height: 0.06, depth: 0.06, units: "meters", confidence: 0.95 }, transform: { position: [0, 2.866, -1.189], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "top-side-rail-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: ["seam-roof-rail", "seam-wall-rail"], localFeatures: [{ id: "panel-seam", kind: "seam", description: "Seam fino panel-rail: el margen plano del techo y la chapa lateral rematan contra el rail.", geometryEffect: { type: "groove", width: 0.004, depth: 0.003 }, evidenceRefs: ["roof-field"], confidence: 0.85 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_top_side_rail_left_10.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "top-side-rail-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } };
  (nodes["corner-structure"] ?? root).add(node_top_side_rail_left_10);
  nodes["top-side-rail-left"] = node_top_side_rail_left_10;
  const mesh_top_side_rail_left_10Geometry = new THREE.BoxGeometry(11.892, 0.06, 0.06);
  const mesh_top_side_rail_left_10 = new THREE.Mesh(mesh_top_side_rail_left_10Geometry, materialMap["paint-structure"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_top_side_rail_left_10.name = "Rail superior lateral left";
  mesh_top_side_rail_left_10.castShadow = options.castShadow ?? true;
  mesh_top_side_rail_left_10.receiveShadow = options.receiveShadow ?? true;
  mesh_top_side_rail_left_10.userData.sculptComponent = { id: "top-side-rail-left", name: "Rail superior lateral left", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Tubo cuadrado 60x60 entre esquineros superiores.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "corner-structure", attachment: null, dimensions: { width: 11.892, height: 0.06, depth: 0.06, units: "meters", confidence: 0.95 }, transform: { position: [0, 2.866, -1.189], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "top-side-rail-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: ["seam-roof-rail", "seam-wall-rail"], localFeatures: [{ id: "panel-seam", kind: "seam", description: "Seam fino panel-rail: el margen plano del techo y la chapa lateral rematan contra el rail.", geometryEffect: { type: "groove", width: 0.004, depth: 0.003 }, evidenceRefs: ["roof-field"], confidence: 0.85 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_top_side_rail_left_10.add(mesh_top_side_rail_left_10);
  meshes["top-side-rail-left"] = mesh_top_side_rail_left_10;
  colliders["top-side-rail-left"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["top-side-rail-left"] ??= [];
  destructionGroups["top-side-rail-left"].push(node_top_side_rail_left_10);
  const attachment_bottom_side_rail_left_11 = null;
  const endpoint_bottom_side_rail_left_11 = makeAttachmentEndpoint(attachment_bottom_side_rail_left_11);
  const node_bottom_side_rail_left_11 = new THREE.Group;
  node_bottom_side_rail_left_11.name = "Larguero inferior left__pivot";
  if (endpoint_bottom_side_rail_left_11) {
    node_bottom_side_rail_left_11.position.set(0, 0, -1.195);
    node_bottom_side_rail_left_11.rotation.set(0, 0, 0);
    node_bottom_side_rail_left_11.scale.set(1, 1, 1);
  } else {
    node_bottom_side_rail_left_11.position.set(0, 0, -1.195);
    node_bottom_side_rail_left_11.rotation.set(0, 0, 0);
    node_bottom_side_rail_left_11.scale.set(1, 1, 1);
  }
  node_bottom_side_rail_left_11.userData.sculptComponent = { id: "bottom-side-rail-left", name: "Larguero inferior left", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Perfil C 160 de ala corta; cara frontal plana con escalon respecto de los valles del corrugado.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "underframe", attachment: null, dimensions: { width: 11.892, height: 0.16, depth: 0.048, units: "meters", confidence: 0.95 }, transform: { position: [0, 0, -1.195], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "bottom-side-rail-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: ["seam-wall-bottomrail"], localFeatures: [{ id: "panel-seam", kind: "seam", description: "Costura limpia donde las flautas terminan contra el ala superior del rail; escalon visible.", geometryEffect: { type: "step-seam", step: 0.012 }, evidenceRefs: ["bottom-rail-detail"], confidence: 0.9 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_bottom_side_rail_left_11.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "bottom-side-rail-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } };
  (nodes["underframe"] ?? root).add(node_bottom_side_rail_left_11);
  nodes["bottom-side-rail-left"] = node_bottom_side_rail_left_11;
  const mesh_bottom_side_rail_left_11Geometry = new THREE.BoxGeometry(11.892, 0.16, 0.048);
  const mesh_bottom_side_rail_left_11 = new THREE.Mesh(mesh_bottom_side_rail_left_11Geometry, materialMap["paint-structure"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_bottom_side_rail_left_11.name = "Larguero inferior left";
  mesh_bottom_side_rail_left_11.castShadow = options.castShadow ?? true;
  mesh_bottom_side_rail_left_11.receiveShadow = options.receiveShadow ?? true;
  mesh_bottom_side_rail_left_11.userData.sculptComponent = { id: "bottom-side-rail-left", name: "Larguero inferior left", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Perfil C 160 de ala corta; cara frontal plana con escalon respecto de los valles del corrugado.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "underframe", attachment: null, dimensions: { width: 11.892, height: 0.16, depth: 0.048, units: "meters", confidence: 0.95 }, transform: { position: [0, 0, -1.195], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "bottom-side-rail-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: ["seam-wall-bottomrail"], localFeatures: [{ id: "panel-seam", kind: "seam", description: "Costura limpia donde las flautas terminan contra el ala superior del rail; escalon visible.", geometryEffect: { type: "step-seam", step: 0.012 }, evidenceRefs: ["bottom-rail-detail"], confidence: 0.9 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_bottom_side_rail_left_11.add(mesh_bottom_side_rail_left_11);
  meshes["bottom-side-rail-left"] = mesh_bottom_side_rail_left_11;
  colliders["bottom-side-rail-left"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["bottom-side-rail-left"] ??= [];
  destructionGroups["bottom-side-rail-left"].push(node_bottom_side_rail_left_11);
  const attachment_corner_post_front_left_12 = null;
  const endpoint_corner_post_front_left_12 = makeAttachmentEndpoint(attachment_corner_post_front_left_12);
  const node_corner_post_front_left_12 = new THREE.Group;
  node_corner_post_front_left_12.name = "Poste esquinero front-left__pivot";
  if (endpoint_corner_post_front_left_12) {
    node_corner_post_front_left_12.position.set(-6.021, 1.448, -1.1440000000000001);
    node_corner_post_front_left_12.rotation.set(0, 0, 0);
    node_corner_post_front_left_12.scale.set(1, 1, 1);
  } else {
    node_corner_post_front_left_12.position.set(-6.021, 1.448, -1.1440000000000001);
    node_corner_post_front_left_12.rotation.set(0, 0, 0);
    node_corner_post_front_left_12.scale.set(1, 1, 1);
  }
  node_corner_post_front_left_12.userData.sculptComponent = { id: "corner-post-front-left", name: "Poste esquinero front-left", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Poste estructural entre esquineros; cara plana diferenciada de los paneles.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "corner-structure", attachment: null, dimensions: { width: 0.15, height: 2.54, depth: 0.15, units: "meters", confidence: 0.95 }, transform: { position: [-6.021, 1.448, -1.1440000000000001], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-post-front-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_corner_post_front_left_12.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-post-front-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } };
  (nodes["corner-structure"] ?? root).add(node_corner_post_front_left_12);
  nodes["corner-post-front-left"] = node_corner_post_front_left_12;
  const mesh_corner_post_front_left_12Geometry = new THREE.BoxGeometry(0.15, 2.54, 0.15);
  const mesh_corner_post_front_left_12 = new THREE.Mesh(mesh_corner_post_front_left_12Geometry, materialMap["paint-structure"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_corner_post_front_left_12.name = "Poste esquinero front-left";
  mesh_corner_post_front_left_12.castShadow = options.castShadow ?? true;
  mesh_corner_post_front_left_12.receiveShadow = options.receiveShadow ?? true;
  mesh_corner_post_front_left_12.userData.sculptComponent = { id: "corner-post-front-left", name: "Poste esquinero front-left", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Poste estructural entre esquineros; cara plana diferenciada de los paneles.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "corner-structure", attachment: null, dimensions: { width: 0.15, height: 2.54, depth: 0.15, units: "meters", confidence: 0.95 }, transform: { position: [-6.021, 1.448, -1.1440000000000001], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-post-front-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_corner_post_front_left_12.add(mesh_corner_post_front_left_12);
  meshes["corner-post-front-left"] = mesh_corner_post_front_left_12;
  colliders["corner-post-front-left"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["corner-post-front-left"] ??= [];
  destructionGroups["corner-post-front-left"].push(node_corner_post_front_left_12);
  const attachment_corner_post_front_right_13 = null;
  const endpoint_corner_post_front_right_13 = makeAttachmentEndpoint(attachment_corner_post_front_right_13);
  const node_corner_post_front_right_13 = new THREE.Group;
  node_corner_post_front_right_13.name = "Poste esquinero front-right__pivot";
  if (endpoint_corner_post_front_right_13) {
    node_corner_post_front_right_13.position.set(-6.021, 1.448, 1.1440000000000001);
    node_corner_post_front_right_13.rotation.set(0, 0, 0);
    node_corner_post_front_right_13.scale.set(1, 1, 1);
  } else {
    node_corner_post_front_right_13.position.set(-6.021, 1.448, 1.1440000000000001);
    node_corner_post_front_right_13.rotation.set(0, 0, 0);
    node_corner_post_front_right_13.scale.set(1, 1, 1);
  }
  node_corner_post_front_right_13.userData.sculptComponent = { id: "corner-post-front-right", name: "Poste esquinero front-right", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Poste estructural entre esquineros; cara plana diferenciada de los paneles.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "corner-structure", attachment: null, dimensions: { width: 0.15, height: 2.54, depth: 0.15, units: "meters", confidence: 0.95 }, transform: { position: [-6.021, 1.448, 1.1440000000000001], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-post-front-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_corner_post_front_right_13.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-post-front-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } };
  (nodes["corner-structure"] ?? root).add(node_corner_post_front_right_13);
  nodes["corner-post-front-right"] = node_corner_post_front_right_13;
  const mesh_corner_post_front_right_13Geometry = new THREE.BoxGeometry(0.15, 2.54, 0.15);
  const mesh_corner_post_front_right_13 = new THREE.Mesh(mesh_corner_post_front_right_13Geometry, materialMap["paint-structure"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_corner_post_front_right_13.name = "Poste esquinero front-right";
  mesh_corner_post_front_right_13.castShadow = options.castShadow ?? true;
  mesh_corner_post_front_right_13.receiveShadow = options.receiveShadow ?? true;
  mesh_corner_post_front_right_13.userData.sculptComponent = { id: "corner-post-front-right", name: "Poste esquinero front-right", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Poste estructural entre esquineros; cara plana diferenciada de los paneles.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "corner-structure", attachment: null, dimensions: { width: 0.15, height: 2.54, depth: 0.15, units: "meters", confidence: 0.95 }, transform: { position: [-6.021, 1.448, 1.1440000000000001], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-post-front-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_corner_post_front_right_13.add(mesh_corner_post_front_right_13);
  meshes["corner-post-front-right"] = mesh_corner_post_front_right_13;
  colliders["corner-post-front-right"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["corner-post-front-right"] ??= [];
  destructionGroups["corner-post-front-right"].push(node_corner_post_front_right_13);
  const attachment_corner_post_rear_left_14 = null;
  const endpoint_corner_post_rear_left_14 = makeAttachmentEndpoint(attachment_corner_post_rear_left_14);
  const node_corner_post_rear_left_14 = new THREE.Group;
  node_corner_post_rear_left_14.name = "Poste esquinero rear-left__pivot";
  if (endpoint_corner_post_rear_left_14) {
    node_corner_post_rear_left_14.position.set(6.021, 1.448, -1.1440000000000001);
    node_corner_post_rear_left_14.rotation.set(0, 0, 0);
    node_corner_post_rear_left_14.scale.set(1, 1, 1);
  } else {
    node_corner_post_rear_left_14.position.set(6.021, 1.448, -1.1440000000000001);
    node_corner_post_rear_left_14.rotation.set(0, 0, 0);
    node_corner_post_rear_left_14.scale.set(1, 1, 1);
  }
  node_corner_post_rear_left_14.userData.sculptComponent = { id: "corner-post-rear-left", name: "Poste esquinero rear-left", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Poste estructural entre esquineros; cara plana diferenciada de los paneles.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "corner-structure", attachment: null, dimensions: { width: 0.15, height: 2.54, depth: 0.15, units: "meters", confidence: 0.95 }, transform: { position: [6.021, 1.448, -1.1440000000000001], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-post-rear-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_corner_post_rear_left_14.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-post-rear-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } };
  (nodes["corner-structure"] ?? root).add(node_corner_post_rear_left_14);
  nodes["corner-post-rear-left"] = node_corner_post_rear_left_14;
  const mesh_corner_post_rear_left_14Geometry = new THREE.BoxGeometry(0.15, 2.54, 0.15);
  const mesh_corner_post_rear_left_14 = new THREE.Mesh(mesh_corner_post_rear_left_14Geometry, materialMap["paint-structure"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_corner_post_rear_left_14.name = "Poste esquinero rear-left";
  mesh_corner_post_rear_left_14.castShadow = options.castShadow ?? true;
  mesh_corner_post_rear_left_14.receiveShadow = options.receiveShadow ?? true;
  mesh_corner_post_rear_left_14.userData.sculptComponent = { id: "corner-post-rear-left", name: "Poste esquinero rear-left", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Poste estructural entre esquineros; cara plana diferenciada de los paneles.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "corner-structure", attachment: null, dimensions: { width: 0.15, height: 2.54, depth: 0.15, units: "meters", confidence: 0.95 }, transform: { position: [6.021, 1.448, -1.1440000000000001], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-post-rear-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_corner_post_rear_left_14.add(mesh_corner_post_rear_left_14);
  meshes["corner-post-rear-left"] = mesh_corner_post_rear_left_14;
  colliders["corner-post-rear-left"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["corner-post-rear-left"] ??= [];
  destructionGroups["corner-post-rear-left"].push(node_corner_post_rear_left_14);
  const attachment_corner_post_rear_right_15 = null;
  const endpoint_corner_post_rear_right_15 = makeAttachmentEndpoint(attachment_corner_post_rear_right_15);
  const node_corner_post_rear_right_15 = new THREE.Group;
  node_corner_post_rear_right_15.name = "Poste esquinero rear-right__pivot";
  if (endpoint_corner_post_rear_right_15) {
    node_corner_post_rear_right_15.position.set(6.021, 1.448, 1.1440000000000001);
    node_corner_post_rear_right_15.rotation.set(0, 0, 0);
    node_corner_post_rear_right_15.scale.set(1, 1, 1);
  } else {
    node_corner_post_rear_right_15.position.set(6.021, 1.448, 1.1440000000000001);
    node_corner_post_rear_right_15.rotation.set(0, 0, 0);
    node_corner_post_rear_right_15.scale.set(1, 1, 1);
  }
  node_corner_post_rear_right_15.userData.sculptComponent = { id: "corner-post-rear-right", name: "Poste esquinero rear-right", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Poste estructural entre esquineros; cara plana diferenciada de los paneles.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "corner-structure", attachment: null, dimensions: { width: 0.15, height: 2.54, depth: 0.15, units: "meters", confidence: 0.95 }, transform: { position: [6.021, 1.448, 1.1440000000000001], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-post-rear-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_corner_post_rear_right_15.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-post-rear-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } };
  (nodes["corner-structure"] ?? root).add(node_corner_post_rear_right_15);
  nodes["corner-post-rear-right"] = node_corner_post_rear_right_15;
  const mesh_corner_post_rear_right_15Geometry = new THREE.BoxGeometry(0.15, 2.54, 0.15);
  const mesh_corner_post_rear_right_15 = new THREE.Mesh(mesh_corner_post_rear_right_15Geometry, materialMap["paint-structure"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_corner_post_rear_right_15.name = "Poste esquinero rear-right";
  mesh_corner_post_rear_right_15.castShadow = options.castShadow ?? true;
  mesh_corner_post_rear_right_15.receiveShadow = options.receiveShadow ?? true;
  mesh_corner_post_rear_right_15.userData.sculptComponent = { id: "corner-post-rear-right", name: "Poste esquinero rear-right", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Poste estructural entre esquineros; cara plana diferenciada de los paneles.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "corner-structure", attachment: null, dimensions: { width: 0.15, height: 2.54, depth: 0.15, units: "meters", confidence: 0.95 }, transform: { position: [6.021, 1.448, 1.1440000000000001], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-post-rear-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_corner_post_rear_right_15.add(mesh_corner_post_rear_right_15);
  meshes["corner-post-rear-right"] = mesh_corner_post_rear_right_15;
  colliders["corner-post-rear-right"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["corner-post-rear-right"] ??= [];
  destructionGroups["corner-post-rear-right"].push(node_corner_post_rear_right_15);
  const attachment_door_header_16 = null;
  const endpoint_door_header_16 = makeAttachmentEndpoint(attachment_door_header_16);
  const node_door_header_16 = new THREE.Group;
  node_door_header_16.name = "Header de puertas__pivot";
  if (endpoint_door_header_16) {
    node_door_header_16.position.set(6.02, 2.653, 0);
    node_door_header_16.rotation.set(0, 0, 0);
    node_door_header_16.scale.set(1, 1, 1);
  } else {
    node_door_header_16.position.set(6.02, 2.653, 0);
    node_door_header_16.rotation.set(0, 0, 0);
    node_door_header_16.scale.set(1, 1, 1);
  }
  node_door_header_16.userData.sculptComponent = { id: "door-header", name: "Header de puertas", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Travesano superior del marco de puertas; recibe keepers superiores.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: null, dimensions: { width: 0.13, height: 0.13, depth: 2.1380000000000003, units: "meters", confidence: 0.95 }, transform: { position: [6.02, 2.653, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "door-header", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_door_header_16.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "door-header", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } };
  (nodes["door-assembly"] ?? root).add(node_door_header_16);
  nodes["door-header"] = node_door_header_16;
  const mesh_door_header_16Geometry = new THREE.BoxGeometry(0.13, 0.13, 2.1380000000000003);
  const mesh_door_header_16 = new THREE.Mesh(mesh_door_header_16Geometry, materialMap["paint-structure"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_door_header_16.name = "Header de puertas";
  mesh_door_header_16.castShadow = options.castShadow ?? true;
  mesh_door_header_16.receiveShadow = options.receiveShadow ?? true;
  mesh_door_header_16.userData.sculptComponent = { id: "door-header", name: "Header de puertas", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Travesano superior del marco de puertas; recibe keepers superiores.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: null, dimensions: { width: 0.13, height: 0.13, depth: 2.1380000000000003, units: "meters", confidence: 0.95 }, transform: { position: [6.02, 2.653, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "door-header", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_door_header_16.add(mesh_door_header_16);
  meshes["door-header"] = mesh_door_header_16;
  colliders["door-header"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["door-header"] ??= [];
  destructionGroups["door-header"].push(node_door_header_16);
  const attachment_door_sill_17 = null;
  const endpoint_door_sill_17 = makeAttachmentEndpoint(attachment_door_sill_17);
  const node_door_sill_17 = new THREE.Group;
  node_door_sill_17.name = "Sill de puertas__pivot";
  if (endpoint_door_sill_17) {
    node_door_sill_17.position.set(6.02, 0.288, 0);
    node_door_sill_17.rotation.set(0, 0, 0);
    node_door_sill_17.scale.set(1, 1, 1);
  } else {
    node_door_sill_17.position.set(6.02, 0.288, 0);
    node_door_sill_17.rotation.set(0, 0, 0);
    node_door_sill_17.scale.set(1, 1, 1);
  }
  node_door_sill_17.userData.sculptComponent = { id: "door-sill", name: "Sill de puertas", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Umbral inferior con perfil escalonado y cara central rebajada; recibe keepers inferiores.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: null, dimensions: { width: 0.17, height: 0.17, depth: 2.1380000000000003, units: "meters", confidence: 0.95 }, transform: { position: [6.02, 0.288, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "door-sill", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_door_sill_17.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "door-sill", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } };
  (nodes["door-assembly"] ?? root).add(node_door_sill_17);
  nodes["door-sill"] = node_door_sill_17;
  const mesh_door_sill_17Geometry = new THREE.BoxGeometry(0.17, 0.17, 2.1380000000000003);
  const mesh_door_sill_17 = new THREE.Mesh(mesh_door_sill_17Geometry, materialMap["paint-structure"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_door_sill_17.name = "Sill de puertas";
  mesh_door_sill_17.castShadow = options.castShadow ?? true;
  mesh_door_sill_17.receiveShadow = options.receiveShadow ?? true;
  mesh_door_sill_17.userData.sculptComponent = { id: "door-sill", name: "Sill de puertas", level: "meso", role: "frame", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Umbral inferior con perfil escalonado y cara central rebajada; recibe keepers inferiores.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: null, dimensions: { width: 0.17, height: 0.17, depth: 2.1380000000000003, units: "meters", confidence: 0.95 }, transform: { position: [6.02, 0.288, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "door-sill", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["full-object"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_door_sill_17.add(mesh_door_sill_17);
  meshes["door-sill"] = mesh_door_sill_17;
  colliders["door-sill"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["door-sill"] ??= [];
  destructionGroups["door-sill"].push(node_door_sill_17);
  const attachment_door_leaf_left_18 = { parentSocket: "hinge-axis-left", localStart: [0, 0, -0.6045], localEnd: [0, 0, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.006 };
  const endpoint_door_leaf_left_18 = makeAttachmentEndpoint(attachment_door_leaf_left_18);
  const node_door_leaf_left_18 = new THREE.Group;
  node_door_leaf_left_18.name = "Hoja de puerta left__pivot";
  if (endpoint_door_leaf_left_18) {
    node_door_leaf_left_18.position.set(6.02, 1.5825, -0.5395000000000001);
    node_door_leaf_left_18.rotation.set(0, 0, 0);
    node_door_leaf_left_18.scale.set(1, 1, 1);
  } else {
    node_door_leaf_left_18.position.set(6.02, 1.5825, -0.5395000000000001);
    node_door_leaf_left_18.rotation.set(0, 0, 0);
    node_door_leaf_left_18.scale.set(1, 1, 1);
  }
  node_door_leaf_left_18.userData.sculptComponent = { id: "door-leaf-left", name: "Hoja de puerta left", level: "meso", role: "door", importance: 0.95, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Hoja rigida: marco perimetral elevado + campos embutidos + refuerzo horizontal — construccion de paneles observada. Pivot de bisagra real se instala en interaction-pass.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: { parentSocket: "hinge-axis-left", localStart: [0, 0, -0.6045], localEnd: [0, 0, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.006 }, dimensions: { width: 0.05, height: 2.585, depth: 1.0590000000000002, units: "meters", confidence: 0.95 }, transform: { position: [6.02, 1.5825, -0.5395000000000001], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "hinged-door", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.95 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [{ type: "hinge", axis: [0, 1, 0], range: [0, 270], note: "apertura real de hoja de contenedor" }], destruction: { breakable: false, fractureGroup: "door-leaf-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } }, material: "paint-body-navy", materialLayers: ["paint-body-navy"], deformations: [], joints: [], seams: [], localFeatures: [{ id: "recessed-panels", kind: "groove", description: "Marco perimetral elevado (+0.012) + 2 campos rectangulares embutidos (-0.015) separados por refuerzo horizontal elevado a ~55% de altura; sombras marcadas en bordes.", geometryEffect: { type: "recessed-fields", frameRaise: 0.012, recess: 0.015, fields: 2, hStiffenerY: 0.55 }, evidenceRefs: ["door-end-detail"], confidence: 0.9 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(18, 28, 47, 1.0)", secondaryAlbedo: "rgba(24, 35, 56, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_door_leaf_left_18.userData.actionProfile = { animationRole: "hinged-door", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.95 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [{ type: "hinge", axis: [0, 1, 0], range: [0, 270], note: "apertura real de hoja de contenedor" }], destruction: { breakable: false, fractureGroup: "door-leaf-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } };
  (nodes["door-assembly"] ?? root).add(node_door_leaf_left_18);
  nodes["door-leaf-left"] = node_door_leaf_left_18;
  const mesh_door_leaf_left_18Geometry = new THREE.BoxGeometry(0.05, 2.585, 1.0590000000000002);
  const mesh_door_leaf_left_18 = new THREE.Mesh(mesh_door_leaf_left_18Geometry, materialMap["paint-body-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_door_leaf_left_18.name = "Hoja de puerta left";
  mesh_door_leaf_left_18.castShadow = options.castShadow ?? true;
  mesh_door_leaf_left_18.receiveShadow = options.receiveShadow ?? true;
  mesh_door_leaf_left_18.userData.sculptComponent = { id: "door-leaf-left", name: "Hoja de puerta left", level: "meso", role: "door", importance: 0.95, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Hoja rigida: marco perimetral elevado + campos embutidos + refuerzo horizontal — construccion de paneles observada. Pivot de bisagra real se instala en interaction-pass.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: { parentSocket: "hinge-axis-left", localStart: [0, 0, -0.6045], localEnd: [0, 0, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.006 }, dimensions: { width: 0.05, height: 2.585, depth: 1.0590000000000002, units: "meters", confidence: 0.95 }, transform: { position: [6.02, 1.5825, -0.5395000000000001], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "hinged-door", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.95 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [{ type: "hinge", axis: [0, 1, 0], range: [0, 270], note: "apertura real de hoja de contenedor" }], destruction: { breakable: false, fractureGroup: "door-leaf-left", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } }, material: "paint-body-navy", materialLayers: ["paint-body-navy"], deformations: [], joints: [], seams: [], localFeatures: [{ id: "recessed-panels", kind: "groove", description: "Marco perimetral elevado (+0.012) + 2 campos rectangulares embutidos (-0.015) separados por refuerzo horizontal elevado a ~55% de altura; sombras marcadas en bordes.", geometryEffect: { type: "recessed-fields", frameRaise: 0.012, recess: 0.015, fields: 2, hStiffenerY: 0.55 }, evidenceRefs: ["door-end-detail"], confidence: 0.9 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(18, 28, 47, 1.0)", secondaryAlbedo: "rgba(24, 35, 56, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_door_leaf_left_18.add(mesh_door_leaf_left_18);
  meshes["door-leaf-left"] = mesh_door_leaf_left_18;
  colliders["door-leaf-left"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["door-leaf-left"] ??= [];
  destructionGroups["door-leaf-left"].push(node_door_leaf_left_18);
  const attachment_lock_rod_left_inner_19 = { parentSocket: "rod-brackets-left-inner", localStart: [0, -1.2325, 0], localEnd: [0, 1.2325, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.004 };
  const endpoint_lock_rod_left_inner_19 = makeAttachmentEndpoint(attachment_lock_rod_left_inner_19);
  const node_lock_rod_left_inner_19 = new THREE.Group;
  node_lock_rod_left_inner_19.name = "Lock rod left inner__pivot";
  if (endpoint_lock_rod_left_inner_19) {
    node_lock_rod_left_inner_19.position.set(0.045, 0, 0.2395);
    node_lock_rod_left_inner_19.rotation.set(0, 0, 0);
    node_lock_rod_left_inner_19.scale.set(1, 1, 1);
  } else {
    node_lock_rod_left_inner_19.position.set(0.045, 0, 0.2395);
    node_lock_rod_left_inner_19.rotation.set(0, 0, 0);
    node_lock_rod_left_inner_19.scale.set(1, 1, 1);
  }
  node_lock_rod_left_inner_19.userData.sculptComponent = { id: "lock-rod-left-inner", name: "Lock rod left inner", level: "meso", role: "hardware", importance: 0.9, confidence: 0.9, primitive: "tube", topologyClass: "fiber-strand", topologyRationale: "Barra larga delgada de seccion constante que recorre la altura de la hoja — tube/cylinder, jamas box. Reposicionado: 4 rods repartidos como la ref (abs z -0.3).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-leaf-left", attachment: { parentSocket: "rod-brackets-left-inner", localStart: [0, -1.2325, 0], localEnd: [0, 1.2325, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.004 }, dimensions: { width: 0.025, height: 2.465, depth: 0.025, units: "meters", confidence: 0.95 }, transform: { position: [0.045, 0, 0.2395], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "lock-rod-left-inner", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } }, material: "steel-galvanized", materialLayers: ["steel-galvanized"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(155, 163, 171, 1.0)", secondaryAlbedo: "rgba(174, 182, 190, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "galvanized-semi-gloss", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_lock_rod_left_inner_19.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "lock-rod-left-inner", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } };
  (nodes["door-leaf-left"] ?? root).add(node_lock_rod_left_inner_19);
  nodes["lock-rod-left-inner"] = node_lock_rod_left_inner_19;
  const mesh_lock_rod_left_inner_19Geometry = new THREE.CylinderGeometry(0.0125, 0.0125, 2.465, 16);
  const mesh_lock_rod_left_inner_19 = new THREE.Mesh(mesh_lock_rod_left_inner_19Geometry, materialMap["steel-galvanized"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_lock_rod_left_inner_19.name = "Lock rod left inner";
  mesh_lock_rod_left_inner_19.castShadow = options.castShadow ?? true;
  mesh_lock_rod_left_inner_19.receiveShadow = options.receiveShadow ?? true;
  mesh_lock_rod_left_inner_19.userData.sculptComponent = { id: "lock-rod-left-inner", name: "Lock rod left inner", level: "meso", role: "hardware", importance: 0.9, confidence: 0.9, primitive: "tube", topologyClass: "fiber-strand", topologyRationale: "Barra larga delgada de seccion constante que recorre la altura de la hoja — tube/cylinder, jamas box. Reposicionado: 4 rods repartidos como la ref (abs z -0.3).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-leaf-left", attachment: { parentSocket: "rod-brackets-left-inner", localStart: [0, -1.2325, 0], localEnd: [0, 1.2325, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.004 }, dimensions: { width: 0.025, height: 2.465, depth: 0.025, units: "meters", confidence: 0.95 }, transform: { position: [0.045, 0, 0.2395], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "lock-rod-left-inner", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } }, material: "steel-galvanized", materialLayers: ["steel-galvanized"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(155, 163, 171, 1.0)", secondaryAlbedo: "rgba(174, 182, 190, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "galvanized-semi-gloss", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_lock_rod_left_inner_19.add(mesh_lock_rod_left_inner_19);
  meshes["lock-rod-left-inner"] = mesh_lock_rod_left_inner_19;
  colliders["lock-rod-left-inner"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["lock-rod-left-inner"] ??= [];
  destructionGroups["lock-rod-left-inner"].push(node_lock_rod_left_inner_19);
  const attachment_lock_rod_left_outer_20 = { parentSocket: "rod-brackets-left-outer", localStart: [0, -1.2325, 0], localEnd: [0, 1.2325, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.004 };
  const endpoint_lock_rod_left_outer_20 = makeAttachmentEndpoint(attachment_lock_rod_left_outer_20);
  const node_lock_rod_left_outer_20 = new THREE.Group;
  node_lock_rod_left_outer_20.name = "Lock rod left outer__pivot";
  if (endpoint_lock_rod_left_outer_20) {
    node_lock_rod_left_outer_20.position.set(0.045, 0, -0.3105);
    node_lock_rod_left_outer_20.rotation.set(0, 0, 0);
    node_lock_rod_left_outer_20.scale.set(1, 1, 1);
  } else {
    node_lock_rod_left_outer_20.position.set(0.045, 0, -0.3105);
    node_lock_rod_left_outer_20.rotation.set(0, 0, 0);
    node_lock_rod_left_outer_20.scale.set(1, 1, 1);
  }
  node_lock_rod_left_outer_20.userData.sculptComponent = { id: "lock-rod-left-outer", name: "Lock rod left outer", level: "meso", role: "hardware", importance: 0.9, confidence: 0.9, primitive: "tube", topologyClass: "fiber-strand", topologyRationale: "Barra larga delgada de seccion constante que recorre la altura de la hoja — tube/cylinder, jamas box. Reposicionado: 4 rods repartidos como la ref (abs z -0.85).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-leaf-left", attachment: { parentSocket: "rod-brackets-left-outer", localStart: [0, -1.2325, 0], localEnd: [0, 1.2325, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.004 }, dimensions: { width: 0.025, height: 2.465, depth: 0.025, units: "meters", confidence: 0.95 }, transform: { position: [0.045, 0, -0.3105], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "lock-rod-left-outer", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } }, material: "steel-galvanized", materialLayers: ["steel-galvanized"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(155, 163, 171, 1.0)", secondaryAlbedo: "rgba(174, 182, 190, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "galvanized-semi-gloss", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_lock_rod_left_outer_20.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "lock-rod-left-outer", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } };
  (nodes["door-leaf-left"] ?? root).add(node_lock_rod_left_outer_20);
  nodes["lock-rod-left-outer"] = node_lock_rod_left_outer_20;
  const mesh_lock_rod_left_outer_20Geometry = new THREE.CylinderGeometry(0.0125, 0.0125, 2.465, 16);
  const mesh_lock_rod_left_outer_20 = new THREE.Mesh(mesh_lock_rod_left_outer_20Geometry, materialMap["steel-galvanized"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_lock_rod_left_outer_20.name = "Lock rod left outer";
  mesh_lock_rod_left_outer_20.castShadow = options.castShadow ?? true;
  mesh_lock_rod_left_outer_20.receiveShadow = options.receiveShadow ?? true;
  mesh_lock_rod_left_outer_20.userData.sculptComponent = { id: "lock-rod-left-outer", name: "Lock rod left outer", level: "meso", role: "hardware", importance: 0.9, confidence: 0.9, primitive: "tube", topologyClass: "fiber-strand", topologyRationale: "Barra larga delgada de seccion constante que recorre la altura de la hoja — tube/cylinder, jamas box. Reposicionado: 4 rods repartidos como la ref (abs z -0.85).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-leaf-left", attachment: { parentSocket: "rod-brackets-left-outer", localStart: [0, -1.2325, 0], localEnd: [0, 1.2325, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.004 }, dimensions: { width: 0.025, height: 2.465, depth: 0.025, units: "meters", confidence: 0.95 }, transform: { position: [0.045, 0, -0.3105], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "lock-rod-left-outer", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } }, material: "steel-galvanized", materialLayers: ["steel-galvanized"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(155, 163, 171, 1.0)", secondaryAlbedo: "rgba(174, 182, 190, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "galvanized-semi-gloss", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_lock_rod_left_outer_20.add(mesh_lock_rod_left_outer_20);
  meshes["lock-rod-left-outer"] = mesh_lock_rod_left_outer_20;
  colliders["lock-rod-left-outer"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["lock-rod-left-outer"] ??= [];
  destructionGroups["lock-rod-left-outer"].push(node_lock_rod_left_outer_20);
  const attachment_door_leaf_right_21 = { parentSocket: "hinge-axis-right", localStart: [0, 0, 0.6045], localEnd: [0, 0, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.006 };
  const endpoint_door_leaf_right_21 = makeAttachmentEndpoint(attachment_door_leaf_right_21);
  const node_door_leaf_right_21 = new THREE.Group;
  node_door_leaf_right_21.name = "Hoja de puerta right__pivot";
  if (endpoint_door_leaf_right_21) {
    node_door_leaf_right_21.position.set(6.02, 1.5825, 0.5395000000000001);
    node_door_leaf_right_21.rotation.set(0, 0, 0);
    node_door_leaf_right_21.scale.set(1, 1, 1);
  } else {
    node_door_leaf_right_21.position.set(6.02, 1.5825, 0.5395000000000001);
    node_door_leaf_right_21.rotation.set(0, 0, 0);
    node_door_leaf_right_21.scale.set(1, 1, 1);
  }
  node_door_leaf_right_21.userData.sculptComponent = { id: "door-leaf-right", name: "Hoja de puerta right", level: "meso", role: "door", importance: 0.95, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Hoja rigida: marco perimetral elevado + campos embutidos + refuerzo horizontal — construccion de paneles observada. Pivot de bisagra real se instala en interaction-pass.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: { parentSocket: "hinge-axis-right", localStart: [0, 0, 0.6045], localEnd: [0, 0, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.006 }, dimensions: { width: 0.05, height: 2.585, depth: 1.0590000000000002, units: "meters", confidence: 0.95 }, transform: { position: [6.02, 1.5825, 0.5395000000000001], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "hinged-door", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.95 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [{ type: "hinge", axis: [0, 1, 0], range: [0, 270], note: "apertura real de hoja de contenedor" }], destruction: { breakable: false, fractureGroup: "door-leaf-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } }, material: "paint-body-navy", materialLayers: ["paint-body-navy"], deformations: [], joints: [], seams: [], localFeatures: [{ id: "recessed-panels", kind: "groove", description: "Marco perimetral elevado (+0.012) + 2 campos rectangulares embutidos (-0.015) separados por refuerzo horizontal elevado a ~55% de altura; sombras marcadas en bordes.", geometryEffect: { type: "recessed-fields", frameRaise: 0.012, recess: 0.015, fields: 2, hStiffenerY: 0.55 }, evidenceRefs: ["door-end-detail"], confidence: 0.9 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(18, 28, 47, 1.0)", secondaryAlbedo: "rgba(24, 35, 56, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_door_leaf_right_21.userData.actionProfile = { animationRole: "hinged-door", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.95 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [{ type: "hinge", axis: [0, 1, 0], range: [0, 270], note: "apertura real de hoja de contenedor" }], destruction: { breakable: false, fractureGroup: "door-leaf-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } };
  (nodes["door-assembly"] ?? root).add(node_door_leaf_right_21);
  nodes["door-leaf-right"] = node_door_leaf_right_21;
  const mesh_door_leaf_right_21Geometry = new THREE.BoxGeometry(0.05, 2.585, 1.0590000000000002);
  const mesh_door_leaf_right_21 = new THREE.Mesh(mesh_door_leaf_right_21Geometry, materialMap["paint-body-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_door_leaf_right_21.name = "Hoja de puerta right";
  mesh_door_leaf_right_21.castShadow = options.castShadow ?? true;
  mesh_door_leaf_right_21.receiveShadow = options.receiveShadow ?? true;
  mesh_door_leaf_right_21.userData.sculptComponent = { id: "door-leaf-right", name: "Hoja de puerta right", level: "meso", role: "door", importance: 0.95, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Hoja rigida: marco perimetral elevado + campos embutidos + refuerzo horizontal — construccion de paneles observada. Pivot de bisagra real se instala en interaction-pass.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: { parentSocket: "hinge-axis-right", localStart: [0, 0, 0.6045], localEnd: [0, 0, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.006 }, dimensions: { width: 0.05, height: 2.585, depth: 1.0590000000000002, units: "meters", confidence: 0.95 }, transform: { position: [6.02, 1.5825, 0.5395000000000001], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "hinged-door", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.95 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [{ type: "hinge", axis: [0, 1, 0], range: [0, 270], note: "apertura real de hoja de contenedor" }], destruction: { breakable: false, fractureGroup: "door-leaf-right", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-body-navy" } }, material: "paint-body-navy", materialLayers: ["paint-body-navy"], deformations: [], joints: [], seams: [], localFeatures: [{ id: "recessed-panels", kind: "groove", description: "Marco perimetral elevado (+0.012) + 2 campos rectangulares embutidos (-0.015) separados por refuerzo horizontal elevado a ~55% de altura; sombras marcadas en bordes.", geometryEffect: { type: "recessed-fields", frameRaise: 0.012, recess: 0.015, fields: 2, hStiffenerY: 0.55 }, evidenceRefs: ["door-end-detail"], confidence: 0.9 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(18, 28, 47, 1.0)", secondaryAlbedo: "rgba(24, 35, 56, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_door_leaf_right_21.add(mesh_door_leaf_right_21);
  meshes["door-leaf-right"] = mesh_door_leaf_right_21;
  colliders["door-leaf-right"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["door-leaf-right"] ??= [];
  destructionGroups["door-leaf-right"].push(node_door_leaf_right_21);
  const attachment_lock_rod_right_inner_22 = { parentSocket: "rod-brackets-right-inner", localStart: [0, -1.2325, 0], localEnd: [0, 1.2325, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.004 };
  const endpoint_lock_rod_right_inner_22 = makeAttachmentEndpoint(attachment_lock_rod_right_inner_22);
  const node_lock_rod_right_inner_22 = new THREE.Group;
  node_lock_rod_right_inner_22.name = "Lock rod right inner__pivot";
  if (endpoint_lock_rod_right_inner_22) {
    node_lock_rod_right_inner_22.position.set(0.045, 0, -0.2395);
    node_lock_rod_right_inner_22.rotation.set(0, 0, 0);
    node_lock_rod_right_inner_22.scale.set(1, 1, 1);
  } else {
    node_lock_rod_right_inner_22.position.set(0.045, 0, -0.2395);
    node_lock_rod_right_inner_22.rotation.set(0, 0, 0);
    node_lock_rod_right_inner_22.scale.set(1, 1, 1);
  }
  node_lock_rod_right_inner_22.userData.sculptComponent = { id: "lock-rod-right-inner", name: "Lock rod right inner", level: "meso", role: "hardware", importance: 0.9, confidence: 0.9, primitive: "tube", topologyClass: "fiber-strand", topologyRationale: "Barra larga delgada de seccion constante que recorre la altura de la hoja — tube/cylinder, jamas box. Reposicionado: 4 rods repartidos como la ref (abs z 0.3).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-leaf-right", attachment: { parentSocket: "rod-brackets-right-inner", localStart: [0, -1.2325, 0], localEnd: [0, 1.2325, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.004 }, dimensions: { width: 0.025, height: 2.465, depth: 0.025, units: "meters", confidence: 0.95 }, transform: { position: [0.045, 0, -0.2395], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "lock-rod-right-inner", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } }, material: "steel-galvanized", materialLayers: ["steel-galvanized"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(155, 163, 171, 1.0)", secondaryAlbedo: "rgba(174, 182, 190, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "galvanized-semi-gloss", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_lock_rod_right_inner_22.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "lock-rod-right-inner", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } };
  (nodes["door-leaf-right"] ?? root).add(node_lock_rod_right_inner_22);
  nodes["lock-rod-right-inner"] = node_lock_rod_right_inner_22;
  const mesh_lock_rod_right_inner_22Geometry = new THREE.CylinderGeometry(0.0125, 0.0125, 2.465, 16);
  const mesh_lock_rod_right_inner_22 = new THREE.Mesh(mesh_lock_rod_right_inner_22Geometry, materialMap["steel-galvanized"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_lock_rod_right_inner_22.name = "Lock rod right inner";
  mesh_lock_rod_right_inner_22.castShadow = options.castShadow ?? true;
  mesh_lock_rod_right_inner_22.receiveShadow = options.receiveShadow ?? true;
  mesh_lock_rod_right_inner_22.userData.sculptComponent = { id: "lock-rod-right-inner", name: "Lock rod right inner", level: "meso", role: "hardware", importance: 0.9, confidence: 0.9, primitive: "tube", topologyClass: "fiber-strand", topologyRationale: "Barra larga delgada de seccion constante que recorre la altura de la hoja — tube/cylinder, jamas box. Reposicionado: 4 rods repartidos como la ref (abs z 0.3).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-leaf-right", attachment: { parentSocket: "rod-brackets-right-inner", localStart: [0, -1.2325, 0], localEnd: [0, 1.2325, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.004 }, dimensions: { width: 0.025, height: 2.465, depth: 0.025, units: "meters", confidence: 0.95 }, transform: { position: [0.045, 0, -0.2395], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "lock-rod-right-inner", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } }, material: "steel-galvanized", materialLayers: ["steel-galvanized"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(155, 163, 171, 1.0)", secondaryAlbedo: "rgba(174, 182, 190, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "galvanized-semi-gloss", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_lock_rod_right_inner_22.add(mesh_lock_rod_right_inner_22);
  meshes["lock-rod-right-inner"] = mesh_lock_rod_right_inner_22;
  colliders["lock-rod-right-inner"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["lock-rod-right-inner"] ??= [];
  destructionGroups["lock-rod-right-inner"].push(node_lock_rod_right_inner_22);
  const attachment_lock_rod_right_outer_23 = { parentSocket: "rod-brackets-right-outer", localStart: [0, -1.2325, 0], localEnd: [0, 1.2325, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.004 };
  const endpoint_lock_rod_right_outer_23 = makeAttachmentEndpoint(attachment_lock_rod_right_outer_23);
  const node_lock_rod_right_outer_23 = new THREE.Group;
  node_lock_rod_right_outer_23.name = "Lock rod right outer__pivot";
  if (endpoint_lock_rod_right_outer_23) {
    node_lock_rod_right_outer_23.position.set(0.045, 0, 0.3105);
    node_lock_rod_right_outer_23.rotation.set(0, 0, 0);
    node_lock_rod_right_outer_23.scale.set(1, 1, 1);
  } else {
    node_lock_rod_right_outer_23.position.set(0.045, 0, 0.3105);
    node_lock_rod_right_outer_23.rotation.set(0, 0, 0);
    node_lock_rod_right_outer_23.scale.set(1, 1, 1);
  }
  node_lock_rod_right_outer_23.userData.sculptComponent = { id: "lock-rod-right-outer", name: "Lock rod right outer", level: "meso", role: "hardware", importance: 0.9, confidence: 0.9, primitive: "tube", topologyClass: "fiber-strand", topologyRationale: "Barra larga delgada de seccion constante que recorre la altura de la hoja — tube/cylinder, jamas box. Reposicionado: 4 rods repartidos como la ref (abs z 0.85).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-leaf-right", attachment: { parentSocket: "rod-brackets-right-outer", localStart: [0, -1.2325, 0], localEnd: [0, 1.2325, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.004 }, dimensions: { width: 0.025, height: 2.465, depth: 0.025, units: "meters", confidence: 0.95 }, transform: { position: [0.045, 0, 0.3105], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "lock-rod-right-outer", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } }, material: "steel-galvanized", materialLayers: ["steel-galvanized"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(155, 163, 171, 1.0)", secondaryAlbedo: "rgba(174, 182, 190, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "galvanized-semi-gloss", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_lock_rod_right_outer_23.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "lock-rod-right-outer", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } };
  (nodes["door-leaf-right"] ?? root).add(node_lock_rod_right_outer_23);
  nodes["lock-rod-right-outer"] = node_lock_rod_right_outer_23;
  const mesh_lock_rod_right_outer_23Geometry = new THREE.CylinderGeometry(0.0125, 0.0125, 2.465, 16);
  const mesh_lock_rod_right_outer_23 = new THREE.Mesh(mesh_lock_rod_right_outer_23Geometry, materialMap["steel-galvanized"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_lock_rod_right_outer_23.name = "Lock rod right outer";
  mesh_lock_rod_right_outer_23.castShadow = options.castShadow ?? true;
  mesh_lock_rod_right_outer_23.receiveShadow = options.receiveShadow ?? true;
  mesh_lock_rod_right_outer_23.userData.sculptComponent = { id: "lock-rod-right-outer", name: "Lock rod right outer", level: "meso", role: "hardware", importance: 0.9, confidence: 0.9, primitive: "tube", topologyClass: "fiber-strand", topologyRationale: "Barra larga delgada de seccion constante que recorre la altura de la hoja — tube/cylinder, jamas box. Reposicionado: 4 rods repartidos como la ref (abs z 0.85).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-leaf-right", attachment: { parentSocket: "rod-brackets-right-outer", localStart: [0, -1.2325, 0], localEnd: [0, 1.2325, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.004 }, dimensions: { width: 0.025, height: 2.465, depth: 0.025, units: "meters", confidence: 0.95 }, transform: { position: [0.045, 0, 0.3105], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "lock-rod-right-outer", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } }, material: "steel-galvanized", materialLayers: ["steel-galvanized"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(155, 163, 171, 1.0)", secondaryAlbedo: "rgba(174, 182, 190, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "galvanized-semi-gloss", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_lock_rod_right_outer_23.add(mesh_lock_rod_right_outer_23);
  meshes["lock-rod-right-outer"] = mesh_lock_rod_right_outer_23;
  colliders["lock-rod-right-outer"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["lock-rod-right-outer"] ??= [];
  destructionGroups["lock-rod-right-outer"].push(node_lock_rod_right_outer_23);
  const attachment_corner_castings_24 = { parentSocket: "post-ends", localStart: [0, 0, 0], localEnd: [0, 0, 0], contactType: "embed", overlap: 0, embedDepth: 0.03, gapTolerance: 0.002 };
  const endpoint_corner_castings_24 = makeAttachmentEndpoint(attachment_corner_castings_24);
  const node_corner_castings_24 = new THREE.Group;
  node_corner_castings_24.name = "Esquineros ISO 1161 (x8, instanced)__pivot";
  if (endpoint_corner_castings_24) {
    node_corner_castings_24.position.set(0, 1.448, 0);
    node_corner_castings_24.rotation.set(0, 0, 0);
    node_corner_castings_24.scale.set(1, 1, 1);
  } else {
    node_corner_castings_24.position.set(0, 1.448, 0);
    node_corner_castings_24.rotation.set(0, 0, 0);
    node_corner_castings_24.scale.set(1, 1, 1);
  }
  node_corner_castings_24.userData.sculptComponent = { id: "corner-castings", name: "Esquineros ISO 1161 (x8, instanced)", level: "micro", role: "hardware", importance: 0.9, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Bloques 0.178x0.162x0.118 con aberturas ovales/redondas por cara y protrusion leve (~6 mm) sobre los planos.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "corner-structure", attachment: { parentSocket: "post-ends", localStart: [0, 0, 0], localEnd: [0, 0, 0], contactType: "embed", overlap: 0, embedDepth: 0.03, gapTolerance: 0.002 }, dimensions: { width: 0.178, height: 0.118, depth: 0.162, units: "meters", confidence: 0.95 }, transform: { position: [0, 1.448, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-castings", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [{ id: "iso1161-holes", kind: "hole", description: "Aberturas por cara: oval en caras laterales/frontales y superiores, con radio interno; cavidad oscura visible — corte real, no textura.", geometryEffect: { type: "boolean-cut", shapes: ["oval-124x63", "round-63"], depth: "through" }, evidenceRefs: ["door-end-detail", "full-object"], confidence: 0.95 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_corner_castings_24.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-castings", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } };
  (nodes["corner-structure"] ?? root).add(node_corner_castings_24);
  nodes["corner-castings"] = node_corner_castings_24;
  const mesh_corner_castings_24Geometry = new THREE.BoxGeometry(0.178, 0.118, 0.162);
  const mesh_corner_castings_24 = new THREE.Mesh(mesh_corner_castings_24Geometry, materialMap["paint-structure"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_corner_castings_24.name = "Esquineros ISO 1161 (x8, instanced)";
  mesh_corner_castings_24.castShadow = options.castShadow ?? true;
  mesh_corner_castings_24.receiveShadow = options.receiveShadow ?? true;
  mesh_corner_castings_24.userData.sculptComponent = { id: "corner-castings", name: "Esquineros ISO 1161 (x8, instanced)", level: "micro", role: "hardware", importance: 0.9, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Bloques 0.178x0.162x0.118 con aberturas ovales/redondas por cara y protrusion leve (~6 mm) sobre los planos.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "corner-structure", attachment: { parentSocket: "post-ends", localStart: [0, 0, 0], localEnd: [0, 0, 0], contactType: "embed", overlap: 0, embedDepth: 0.03, gapTolerance: 0.002 }, dimensions: { width: 0.178, height: 0.118, depth: 0.162, units: "meters", confidence: 0.95 }, transform: { position: [0, 1.448, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "corner-castings", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "paint-structure" } }, material: "paint-structure", materialLayers: ["paint-structure"], deformations: [], joints: [], seams: [], localFeatures: [{ id: "iso1161-holes", kind: "hole", description: "Aberturas por cara: oval en caras laterales/frontales y superiores, con radio interno; cavidad oscura visible — corte real, no textura.", geometryEffect: { type: "boolean-cut", shapes: ["oval-124x63", "round-63"], depth: "through" }, evidenceRefs: ["door-end-detail", "full-object"], confidence: 0.95 }], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(26, 32, 48, 1.0)", secondaryAlbedo: "rgba(32, 40, 60, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_corner_castings_24.add(mesh_corner_castings_24);
  meshes["corner-castings"] = mesh_corner_castings_24;
  colliders["corner-castings"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["corner-castings"] ??= [];
  destructionGroups["corner-castings"].push(node_corner_castings_24);
  const attachment_hinge_set_25 = { parentSocket: "rear-posts", localStart: [0, 0, 0], localEnd: [0.14, 0, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.003 };
  const endpoint_hinge_set_25 = makeAttachmentEndpoint(attachment_hinge_set_25);
  const node_hinge_set_25 = new THREE.Group;
  node_hinge_set_25.name = "Bisagras de pala (x8, instanced)__pivot";
  if (endpoint_hinge_set_25) {
    node_hinge_set_25.position.set(6.05, 1.5, 0);
    node_hinge_set_25.rotation.set(0, 0, 0);
    node_hinge_set_25.scale.set(1, 1, 1);
  } else {
    node_hinge_set_25.position.set(6.05, 1.5, 0);
    node_hinge_set_25.rotation.set(0, 0, 0);
    node_hinge_set_25.scale.set(1, 1, 1);
  }
  node_hinge_set_25.userData.sculptComponent = { id: "hinge-set", name: "Bisagras de pala (x8, instanced)", level: "micro", role: "hardware", importance: 0.8, confidence: 0.8, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Pala plana 0.16x0.06x0.02 + barril de pasador Ø0.03 sobre postes traseros.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: { parentSocket: "rear-posts", localStart: [0, 0, 0], localEnd: [0.14, 0, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.003 }, dimensions: { width: 0.02, height: 0.06, depth: 0.16, units: "meters", confidence: 0.95 }, transform: { position: [6.05, 1.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "hinge-set", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } }, material: "steel-galvanized", materialLayers: ["steel-galvanized"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(155, 163, 171, 1.0)", secondaryAlbedo: "rgba(174, 182, 190, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "galvanized-semi-gloss", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_hinge_set_25.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "hinge-set", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } };
  (nodes["door-assembly"] ?? root).add(node_hinge_set_25);
  nodes["hinge-set"] = node_hinge_set_25;
  const mesh_hinge_set_25Geometry = new THREE.BoxGeometry(0.02, 0.06, 0.16);
  const mesh_hinge_set_25 = new THREE.Mesh(mesh_hinge_set_25Geometry, materialMap["steel-galvanized"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_hinge_set_25.name = "Bisagras de pala (x8, instanced)";
  mesh_hinge_set_25.castShadow = options.castShadow ?? true;
  mesh_hinge_set_25.receiveShadow = options.receiveShadow ?? true;
  mesh_hinge_set_25.userData.sculptComponent = { id: "hinge-set", name: "Bisagras de pala (x8, instanced)", level: "micro", role: "hardware", importance: 0.8, confidence: 0.8, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Pala plana 0.16x0.06x0.02 + barril de pasador Ø0.03 sobre postes traseros.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: { parentSocket: "rear-posts", localStart: [0, 0, 0], localEnd: [0.14, 0, 0], contactType: "overlap", overlap: 0.03, embedDepth: 0, gapTolerance: 0.003 }, dimensions: { width: 0.02, height: 0.06, depth: 0.16, units: "meters", confidence: 0.95 }, transform: { position: [6.05, 1.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "hinge-set", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } }, material: "steel-galvanized", materialLayers: ["steel-galvanized"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(155, 163, 171, 1.0)", secondaryAlbedo: "rgba(174, 182, 190, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "galvanized-semi-gloss", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_hinge_set_25.add(mesh_hinge_set_25);
  meshes["hinge-set"] = mesh_hinge_set_25;
  colliders["hinge-set"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["hinge-set"] ??= [];
  destructionGroups["hinge-set"].push(node_hinge_set_25);
  const attachment_cam_keeper_set_26 = { parentSocket: "rod-ends", localStart: [0, 0, 0], localEnd: [0, 0.08, 0], contactType: "socket", overlap: 0.025, embedDepth: 0, gapTolerance: 0.004 };
  const endpoint_cam_keeper_set_26 = makeAttachmentEndpoint(attachment_cam_keeper_set_26);
  const node_cam_keeper_set_26 = new THREE.Group;
  node_cam_keeper_set_26.name = "Levas y keepers (x8, instanced)__pivot";
  if (endpoint_cam_keeper_set_26) {
    node_cam_keeper_set_26.position.set(6.05, 1.45, 0);
    node_cam_keeper_set_26.rotation.set(0, 0, 0);
    node_cam_keeper_set_26.scale.set(1, 1, 1);
  } else {
    node_cam_keeper_set_26.position.set(6.05, 1.45, 0);
    node_cam_keeper_set_26.rotation.set(0, 0, 0);
    node_cam_keeper_set_26.scale.set(1, 1, 1);
  }
  node_cam_keeper_set_26.userData.sculptComponent = { id: "cam-keeper-set", name: "Levas y keepers (x8, instanced)", level: "micro", role: "hardware", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Conjunto leva+keeper+base en extremos de cada rod, contra header y sill.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: { parentSocket: "rod-ends", localStart: [0, 0, 0], localEnd: [0, 0.08, 0], contactType: "socket", overlap: 0.025, embedDepth: 0, gapTolerance: 0.004 }, dimensions: { width: 0.02, height: 0.09, depth: 0.09, units: "meters", confidence: 0.95 }, transform: { position: [6.05, 1.45, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "cam-keeper-set", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } }, material: "steel-galvanized", materialLayers: ["steel-galvanized"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(155, 163, 171, 1.0)", secondaryAlbedo: "rgba(174, 182, 190, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "galvanized-semi-gloss", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_cam_keeper_set_26.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "cam-keeper-set", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } };
  (nodes["door-assembly"] ?? root).add(node_cam_keeper_set_26);
  nodes["cam-keeper-set"] = node_cam_keeper_set_26;
  const mesh_cam_keeper_set_26Geometry = new THREE.BoxGeometry(0.02, 0.09, 0.09);
  const mesh_cam_keeper_set_26 = new THREE.Mesh(mesh_cam_keeper_set_26Geometry, materialMap["steel-galvanized"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_cam_keeper_set_26.name = "Levas y keepers (x8, instanced)";
  mesh_cam_keeper_set_26.castShadow = options.castShadow ?? true;
  mesh_cam_keeper_set_26.receiveShadow = options.receiveShadow ?? true;
  mesh_cam_keeper_set_26.userData.sculptComponent = { id: "cam-keeper-set", name: "Levas y keepers (x8, instanced)", level: "micro", role: "hardware", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Conjunto leva+keeper+base en extremos de cada rod, contra header y sill.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: { parentSocket: "rod-ends", localStart: [0, 0, 0], localEnd: [0, 0.08, 0], contactType: "socket", overlap: 0.025, embedDepth: 0, gapTolerance: 0.004 }, dimensions: { width: 0.02, height: 0.09, depth: 0.09, units: "meters", confidence: 0.95 }, transform: { position: [6.05, 1.45, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "cam-keeper-set", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } }, material: "steel-galvanized", materialLayers: ["steel-galvanized"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(155, 163, 171, 1.0)", secondaryAlbedo: "rgba(174, 182, 190, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "galvanized-semi-gloss", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_cam_keeper_set_26.add(mesh_cam_keeper_set_26);
  meshes["cam-keeper-set"] = mesh_cam_keeper_set_26;
  colliders["cam-keeper-set"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["cam-keeper-set"] ??= [];
  destructionGroups["cam-keeper-set"].push(node_cam_keeper_set_26);
  const attachment_handle_set_27 = { parentSocket: "rod-lower-third", localStart: [0, 0, 0], localEnd: [0.4, -0.12, 0], contactType: "socket", overlap: 0.025, embedDepth: 0, gapTolerance: 0.004 };
  const endpoint_handle_set_27 = makeAttachmentEndpoint(attachment_handle_set_27);
  const node_handle_set_27 = new THREE.Group;
  node_handle_set_27.name = "Manijas con caja de precinto (x4, instanced)__pivot";
  if (endpoint_handle_set_27) {
    node_handle_set_27.position.set(6.06, 1.05, 0);
    node_handle_set_27.rotation.set(0, 0, 0);
    node_handle_set_27.scale.set(1, 1, 1);
  } else {
    node_handle_set_27.position.set(6.06, 1.05, 0);
    node_handle_set_27.rotation.set(0, 0, 0);
    node_handle_set_27.scale.set(1, 1, 1);
  }
  node_handle_set_27.userData.sculptComponent = { id: "handle-set", name: "Manijas con caja de precinto (x4, instanced)", level: "micro", role: "hardware", importance: 0.8, confidence: 0.85, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Hub sobre rod + brazo 0.45 angulado + retenedor; caja de precinto en rods internos.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: { parentSocket: "rod-lower-third", localStart: [0, 0, 0], localEnd: [0.4, -0.12, 0], contactType: "socket", overlap: 0.025, embedDepth: 0, gapTolerance: 0.004 }, dimensions: { width: 0.03, height: 0.12, depth: 0.45, units: "meters", confidence: 0.95 }, transform: { position: [6.06, 1.05, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "handle-set", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } }, material: "steel-galvanized", materialLayers: ["steel-galvanized"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(155, 163, 171, 1.0)", secondaryAlbedo: "rgba(174, 182, 190, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "galvanized-semi-gloss", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_handle_set_27.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "handle-set", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } };
  (nodes["door-assembly"] ?? root).add(node_handle_set_27);
  nodes["handle-set"] = node_handle_set_27;
  const mesh_handle_set_27Geometry = new THREE.BoxGeometry(0.03, 0.12, 0.45);
  const mesh_handle_set_27 = new THREE.Mesh(mesh_handle_set_27Geometry, materialMap["steel-galvanized"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_handle_set_27.name = "Manijas con caja de precinto (x4, instanced)";
  mesh_handle_set_27.castShadow = options.castShadow ?? true;
  mesh_handle_set_27.receiveShadow = options.receiveShadow ?? true;
  mesh_handle_set_27.userData.sculptComponent = { id: "handle-set", name: "Manijas con caja de precinto (x4, instanced)", level: "micro", role: "hardware", importance: 0.8, confidence: 0.85, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Hub sobre rod + brazo 0.45 angulado + retenedor; caja de precinto en rods internos.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: { parentSocket: "rod-lower-third", localStart: [0, 0, 0], localEnd: [0.4, -0.12, 0], contactType: "socket", overlap: 0.025, embedDepth: 0, gapTolerance: 0.004 }, dimensions: { width: 0.03, height: 0.12, depth: 0.45, units: "meters", confidence: 0.95 }, transform: { position: [6.06, 1.05, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "handle-set", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } }, material: "steel-galvanized", materialLayers: ["steel-galvanized"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(155, 163, 171, 1.0)", secondaryAlbedo: "rgba(174, 182, 190, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "galvanized-semi-gloss", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_handle_set_27.add(mesh_handle_set_27);
  meshes["handle-set"] = mesh_handle_set_27;
  colliders["handle-set"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["handle-set"] ??= [];
  destructionGroups["handle-set"].push(node_handle_set_27);
  const attachment_rod_guide_brackets_28 = { parentSocket: "leaf-face", localStart: [0, 0, 0], localEnd: [0.05, 0, 0], contactType: "overlap", overlap: 0.02, embedDepth: 0, gapTolerance: 0.003 };
  const endpoint_rod_guide_brackets_28 = makeAttachmentEndpoint(attachment_rod_guide_brackets_28);
  const node_rod_guide_brackets_28 = new THREE.Group;
  node_rod_guide_brackets_28.name = "Brackets de guia de rods (x10, instanced)__pivot";
  if (endpoint_rod_guide_brackets_28) {
    node_rod_guide_brackets_28.position.set(6.055, 1.4, 0);
    node_rod_guide_brackets_28.rotation.set(0, 0, 0);
    node_rod_guide_brackets_28.scale.set(1, 1, 1);
  } else {
    node_rod_guide_brackets_28.position.set(6.055, 1.4, 0);
    node_rod_guide_brackets_28.rotation.set(0, 0, 0);
    node_rod_guide_brackets_28.scale.set(1, 1, 1);
  }
  node_rod_guide_brackets_28.userData.sculptComponent = { id: "rod-guide-brackets", name: "Brackets de guia de rods (x10, instanced)", level: "micro", role: "hardware", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Soportes standoff que separan cada rod 0.045 de la cara de hoja; 2-3 por rod.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: { parentSocket: "leaf-face", localStart: [0, 0, 0], localEnd: [0.05, 0, 0], contactType: "overlap", overlap: 0.02, embedDepth: 0, gapTolerance: 0.003 }, dimensions: { width: 0.025, height: 0.08, depth: 0.06, units: "meters", confidence: 0.95 }, transform: { position: [6.055, 1.4, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "rod-guide-brackets", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } }, material: "steel-galvanized", materialLayers: ["steel-galvanized"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(155, 163, 171, 1.0)", secondaryAlbedo: "rgba(174, 182, 190, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "galvanized-semi-gloss", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_rod_guide_brackets_28.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "rod-guide-brackets", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } };
  (nodes["door-assembly"] ?? root).add(node_rod_guide_brackets_28);
  nodes["rod-guide-brackets"] = node_rod_guide_brackets_28;
  const mesh_rod_guide_brackets_28Geometry = new THREE.BoxGeometry(0.025, 0.08, 0.06);
  const mesh_rod_guide_brackets_28 = new THREE.Mesh(mesh_rod_guide_brackets_28Geometry, materialMap["steel-galvanized"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_rod_guide_brackets_28.name = "Brackets de guia de rods (x10, instanced)";
  mesh_rod_guide_brackets_28.castShadow = options.castShadow ?? true;
  mesh_rod_guide_brackets_28.receiveShadow = options.receiveShadow ?? true;
  mesh_rod_guide_brackets_28.userData.sculptComponent = { id: "rod-guide-brackets", name: "Brackets de guia de rods (x10, instanced)", level: "micro", role: "hardware", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Soportes standoff que separan cada rod 0.045 de la cara de hoja; 2-3 por rod.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: { parentSocket: "leaf-face", localStart: [0, 0, 0], localEnd: [0.05, 0, 0], contactType: "overlap", overlap: 0.02, embedDepth: 0, gapTolerance: 0.003 }, dimensions: { width: 0.025, height: 0.08, depth: 0.06, units: "meters", confidence: 0.95 }, transform: { position: [6.055, 1.4, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "rod-guide-brackets", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "steel-galvanized" } }, material: "steel-galvanized", materialLayers: ["steel-galvanized"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(155, 163, 171, 1.0)", secondaryAlbedo: "rgba(174, 182, 190, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "galvanized-semi-gloss", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_rod_guide_brackets_28.add(mesh_rod_guide_brackets_28);
  meshes["rod-guide-brackets"] = mesh_rod_guide_brackets_28;
  colliders["rod-guide-brackets"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["rod-guide-brackets"] ??= [];
  destructionGroups["rod-guide-brackets"].push(node_rod_guide_brackets_28);
  const attachment_csc_plate_29 = { parentSocket: "leaf-face-lower", localStart: [0, 0, 0], localEnd: [0.003, 0, 0], contactType: "overlap", overlap: 0.02, embedDepth: 0, gapTolerance: 0.002 };
  const endpoint_csc_plate_29 = makeAttachmentEndpoint(attachment_csc_plate_29);
  const node_csc_plate_29 = new THREE.Group;
  node_csc_plate_29.name = "Placa CSC (geometria real, caracteres SSB ficticios)__pivot";
  if (endpoint_csc_plate_29) {
    node_csc_plate_29.position.set(0.027, -0.75, 0.05);
    node_csc_plate_29.rotation.set(0, 0, 0);
    node_csc_plate_29.scale.set(1, 1, 1);
  } else {
    node_csc_plate_29.position.set(0.027, -0.75, 0.05);
    node_csc_plate_29.rotation.set(0, 0, 0);
    node_csc_plate_29.scale.set(1, 1, 1);
  }
  node_csc_plate_29.userData.sculptComponent = { id: "csc-plate", name: "Placa CSC (geometria real, caracteres SSB ficticios)", level: "micro", role: "hardware", importance: 0.8, confidence: 0.95, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Placa 0.20x0.23x0.003 sobre door-leaf-right zona inferior (hoja que se ve a la IZQUIERDA de pantalla desde afuera del extremo de puertas); texto via decal-white (REGLA SSB).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-leaf-right", attachment: { parentSocket: "leaf-face-lower", localStart: [0, 0, 0], localEnd: [0.003, 0, 0], contactType: "overlap", overlap: 0.02, embedDepth: 0, gapTolerance: 0.002 }, dimensions: { width: 0.003, height: 0.23, depth: 0.2, units: "meters", confidence: 0.95 }, transform: { position: [0.027, -0.75, 0.05], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "csc-plate", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "decal-white" } }, material: "decal-white", materialLayers: ["decal-white"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(232, 234, 237, 1.0)", secondaryAlbedo: "rgba(216, 219, 223, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_csc_plate_29.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "csc-plate", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "decal-white" } };
  (nodes["door-leaf-right"] ?? root).add(node_csc_plate_29);
  nodes["csc-plate"] = node_csc_plate_29;
  const mesh_csc_plate_29Geometry = new THREE.BoxGeometry(0.003, 0.23, 0.2);
  const mesh_csc_plate_29 = new THREE.Mesh(mesh_csc_plate_29Geometry, materialMap["decal-white"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_csc_plate_29.name = "Placa CSC (geometria real, caracteres SSB ficticios)";
  mesh_csc_plate_29.castShadow = options.castShadow ?? true;
  mesh_csc_plate_29.receiveShadow = options.receiveShadow ?? true;
  mesh_csc_plate_29.userData.sculptComponent = { id: "csc-plate", name: "Placa CSC (geometria real, caracteres SSB ficticios)", level: "micro", role: "hardware", importance: 0.8, confidence: 0.95, primitive: "box", topologyClass: "assembled-solid", topologyRationale: "Placa 0.20x0.23x0.003 sobre door-leaf-right zona inferior (hoja que se ve a la IZQUIERDA de pantalla desde afuera del extremo de puertas); texto via decal-white (REGLA SSB).", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-leaf-right", attachment: { parentSocket: "leaf-face-lower", localStart: [0, 0, 0], localEnd: [0.003, 0, 0], contactType: "overlap", overlap: 0.02, embedDepth: 0, gapTolerance: 0.002 }, dimensions: { width: 0.003, height: 0.23, depth: 0.2, units: "meters", confidence: 0.95 }, transform: { position: [0.027, -0.75, 0.05], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "csc-plate", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "decal-white" } }, material: "decal-white", materialLayers: ["decal-white"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout", colorMaterialRecipe: { dominantAlbedo: "rgba(232, 234, 237, 1.0)", secondaryAlbedo: "rgba(216, 219, 223, 1.0)", materialClass: "metal", materialClassConfidence: 0.95, finish: "satin-industrial-paint", evidenceRef: "brandContract (SSB) para albedo; referencia para finish/respuesta", note: "Albedo por contrato SSB — desviacion deliberada del gris de la referencia." } };
  node_csc_plate_29.add(mesh_csc_plate_29);
  meshes["csc-plate"] = mesh_csc_plate_29;
  colliders["csc-plate"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["csc-plate"] ??= [];
  destructionGroups["csc-plate"].push(node_csc_plate_29);
  const attachment_gasket_frames_30 = { parentSocket: "leaf-perimeter", localStart: [0, 0, 0], localEnd: [0, 2.72, 0], contactType: "overlap", overlap: 0.02, embedDepth: 0, gapTolerance: 0.002 };
  const endpoint_gasket_frames_30 = makeAttachmentEndpoint(attachment_gasket_frames_30);
  const node_gasket_frames_30 = new THREE.Group;
  node_gasket_frames_30.name = "Burletes de puertas__pivot";
  if (endpoint_gasket_frames_30) {
    node_gasket_frames_30.position.set(6.03, 1.55, 0);
    node_gasket_frames_30.rotation.set(0, 0, 0);
    node_gasket_frames_30.scale.set(1, 1, 1);
  } else {
    node_gasket_frames_30.position.set(6.03, 1.55, 0);
    node_gasket_frames_30.rotation.set(0, 0, 0);
    node_gasket_frames_30.scale.set(1, 1, 1);
  }
  node_gasket_frames_30.userData.sculptComponent = { id: "gasket-frames", name: "Burletes de puertas", level: "micro", role: "seal", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "material-only", topologyRationale: "Tiras de goma perimetrales + junta central: geometria minima (tiras 0.02) que porta el material rubber-gasket.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: { parentSocket: "leaf-perimeter", localStart: [0, 0, 0], localEnd: [0, 2.72, 0], contactType: "overlap", overlap: 0.02, embedDepth: 0, gapTolerance: 0.002 }, dimensions: { width: 0.01, height: 2.585, depth: 0.02, units: "meters", confidence: 0.95 }, transform: { position: [6.03, 1.55, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "gasket-frames", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "rubber-gasket" } }, material: "rubber-gasket", materialLayers: ["rubber-gasket"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout" };
  node_gasket_frames_30.userData.actionProfile = { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "gasket-frames", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "rubber-gasket" } };
  (nodes["door-assembly"] ?? root).add(node_gasket_frames_30);
  nodes["gasket-frames"] = node_gasket_frames_30;
  const mesh_gasket_frames_30Geometry = new THREE.BoxGeometry(0.01, 2.585, 0.02);
  const mesh_gasket_frames_30 = new THREE.Mesh(mesh_gasket_frames_30Geometry, materialMap["rubber-gasket"] ?? new THREE.MeshStandardMaterial({ color: 8947848 }));
  mesh_gasket_frames_30.name = "Burletes de puertas";
  mesh_gasket_frames_30.castShadow = options.castShadow ?? true;
  mesh_gasket_frames_30.receiveShadow = options.receiveShadow ?? true;
  mesh_gasket_frames_30.userData.sculptComponent = { id: "gasket-frames", name: "Burletes de puertas", level: "micro", role: "seal", importance: 0.8, confidence: 0.9, primitive: "box", topologyClass: "material-only", topologyRationale: "Tiras de goma perimetrales + junta central: geometria minima (tiras 0.02) que porta el material rubber-gasket.", geometryDescriptor: { topologyIntent: "low-poly blockout with bevel-ready edges", edgeTreatment: { type: "chamfer", bevelRadius: 0.004, segments: 1 }, deformationStack: [], uvStrategy: "generated procedural coordinates", normalStrategy: "vertex normals from generated geometry" }, parent: "door-assembly", attachment: { parentSocket: "leaf-perimeter", localStart: [0, 0, 0], localEnd: [0, 2.72, 0], contactType: "overlap", overlap: 0.02, embedDepth: 0, gapTolerance: 0.002 }, dimensions: { width: 0.01, height: 2.585, depth: 0.02, units: "meters", confidence: 0.95 }, transform: { position: [6.03, 1.55, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, actionProfile: { animationRole: "static-part", pivot: { mode: "center", localPosition: [0, 0, 0], axis: [0, 1, 0], confidence: 0.9 }, transformChannels: { translate: true, rotate: true, scale: true, bend: false, twist: false, detach: false, visibility: true, materialState: true }, sockets: [], collider: { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" }, constraints: [], destruction: { breakable: false, fractureGroup: "gasket-frames", seamRefs: [], detachableFragments: [], breakImpulse: 0, debrisMaterial: "rubber-gasket" } }, material: "rubber-gasket", materialLayers: ["rubber-gasket"], deformations: [], joints: [], seams: [], localFeatures: [], surfaceDetail: { macroRoughness: 0.5, microRoughness: 0.1, bumpAmplitude: 0, normalPattern: "", displacementPattern: "", occlusionPattern: "cavity AO en valles y rebajes", edgeWearPattern: "", notes: "" }, evidenceRefs: ["door-end-detail"], details: [], fidelityTier: "blockout" };
  node_gasket_frames_30.add(mesh_gasket_frames_30);
  meshes["gasket-frames"] = mesh_gasket_frames_30;
  colliders["gasket-frames"] = { type: "box", offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: false, notes: "proxy simple" };
  destructionGroups["gasket-frames"] ??= [];
  destructionGroups["gasket-frames"].push(node_gasket_frames_30);
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
    const mat = materialMap["paint-body-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 });
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0, 0, 1).normalize();
    const radius = 0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    const cluster = new THREE.InstancedMesh(geo, mat, 42);
    const _m = new THREE.Matrix4;
    const _p = new THREE.Vector3;
    const _q = new THREE.Quaternion;
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0;i < 42; i++) {
      const ang = (0 + i * 360 / 42) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3);
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "corrugation-side";
    parent.add(cluster);
  }
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
    const mat = materialMap["paint-body-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 });
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0, 0, 1).normalize();
    const radius = 0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    const cluster = new THREE.InstancedMesh(geo, mat, 52);
    const _m = new THREE.Matrix4;
    const _p = new THREE.Vector3;
    const _q = new THREE.Quaternion;
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0;i < 52; i++) {
      const ang = (0 + i * 360 / 52) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3);
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "roof-ribs";
    parent.add(cluster);
  }
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
    const mat = materialMap["paint-body-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 });
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0, 0, 1).normalize();
    const radius = 0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    const cluster = new THREE.InstancedMesh(geo, mat, 8);
    const _m = new THREE.Matrix4;
    const _p = new THREE.Vector3;
    const _q = new THREE.Quaternion;
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0;i < 8; i++) {
      const ang = (0 + i * 360 / 8) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3);
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "hinge-system";
    parent.add(cluster);
  }
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
    const mat = materialMap["paint-body-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 });
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0, 0, 1).normalize();
    const radius = 0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    const cluster = new THREE.InstancedMesh(geo, mat, 8);
    const _m = new THREE.Matrix4;
    const _p = new THREE.Vector3;
    const _q = new THREE.Quaternion;
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0;i < 8; i++) {
      const ang = (0 + i * 360 / 8) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3);
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "cam-keeper-system";
    parent.add(cluster);
  }
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
    const mat = materialMap["paint-body-navy"] ?? new THREE.MeshStandardMaterial({ color: 8947848 });
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0, 0, 1).normalize();
    const radius = 0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    const cluster = new THREE.InstancedMesh(geo, mat, 10);
    const _m = new THREE.Matrix4;
    const _p = new THREE.Vector3;
    const _q = new THREE.Quaternion;
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0;i < 10; i++) {
      const ang = (0 + i * 360 / 10) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3);
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "guide-bracket-system";
    parent.add(cluster);
  }
  {
    const addBox = (parent, w, h, d, x, y, z, mat) => {
      const mm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materialMap[mat] ?? new THREE.MeshStandardMaterial({ color: 8950432 }));
      mm.position.set(x, y, z);
      mm.castShadow = true;
      mm.receiveShadow = true;
      parent.add(mm);
      return mm;
    };
    const repSysHide = new Set(["corrugation-side", "roof-ribs", "hinge-system", "cam-keeper-system", "guide-bracket-system"]);
    root.traverse((o) => {
      if (repSysHide.has(o.name) && o.isMesh)
        o.visible = false;
    });
    if (meshes["root"])
      meshes["root"].visible = false;
    if (meshes["corner-castings"])
      meshes["corner-castings"].visible = false;
    if (meshes["hinge-set"])
      meshes["hinge-set"].visible = false;
    if (meshes["cam-keeper-set"])
      meshes["cam-keeper-set"].visible = false;
    if (meshes["rod-guide-brackets"])
      meshes["rod-guide-brackets"].visible = false;
    if (meshes["handle-set"])
      meshes["handle-set"].visible = false;
    if (meshes["gasket-frames"])
      meshes["gasket-frames"].visible = false;
    addBox(nodes["corner-castings"], 0.178, 0.118, 0.162, -6.007, -1.389, -1.138, "paint-structure");
    addBox(nodes["corner-castings"], 0.178, 0.118, 0.162, -6.007, -1.389, 1.138, "paint-structure");
    addBox(nodes["corner-castings"], 0.178, 0.118, 0.162, -6.007, 1.389, -1.138, "paint-structure");
    addBox(nodes["corner-castings"], 0.178, 0.118, 0.162, -6.007, 1.389, 1.138, "paint-structure");
    addBox(nodes["corner-castings"], 0.178, 0.118, 0.162, 6.007, -1.389, -1.138, "paint-structure");
    addBox(nodes["corner-castings"], 0.178, 0.118, 0.162, 6.007, -1.389, 1.138, "paint-structure");
    addBox(nodes["corner-castings"], 0.178, 0.118, 0.162, 6.007, 1.389, -1.138, "paint-structure");
    addBox(nodes["corner-castings"], 0.178, 0.118, 0.162, 6.007, 1.389, 1.138, "paint-structure");
    addBox(nodes["hinge-set"], 0.02, 0.06, 0.16, 0, -0.84, -1.1, "steel-galvanized");
    addBox(nodes["hinge-set"], 0.02, 0.06, 0.16, 0, -0.15, -1.1, "steel-galvanized");
    addBox(nodes["hinge-set"], 0.02, 0.06, 0.16, 0, 0.54, -1.1, "steel-galvanized");
    addBox(nodes["hinge-set"], 0.02, 0.06, 0.16, 0, 1.22, -1.1, "steel-galvanized");
    addBox(nodes["hinge-set"], 0.02, 0.06, 0.16, 0, -0.84, 1.1, "steel-galvanized");
    addBox(nodes["hinge-set"], 0.02, 0.06, 0.16, 0, -0.15, 1.1, "steel-galvanized");
    addBox(nodes["hinge-set"], 0.02, 0.06, 0.16, 0, 0.54, 1.1, "steel-galvanized");
    addBox(nodes["hinge-set"], 0.02, 0.06, 0.16, 0, 1.22, 1.1, "steel-galvanized");
    addBox(nodes["cam-keeper-set"], 0.07, 0.09, 0.09, 0.01, -1.03, -0.85, "steel-galvanized");
    addBox(nodes["cam-keeper-set"], 0.07, 0.09, 0.09, 0.01, 1.25, -0.85, "steel-galvanized");
    addBox(nodes["cam-keeper-set"], 0.07, 0.09, 0.09, 0.01, -1.03, -0.3, "steel-galvanized");
    addBox(nodes["cam-keeper-set"], 0.07, 0.09, 0.09, 0.01, 1.25, -0.3, "steel-galvanized");
    addBox(nodes["cam-keeper-set"], 0.07, 0.09, 0.09, 0.01, -1.03, 0.3, "steel-galvanized");
    addBox(nodes["cam-keeper-set"], 0.07, 0.09, 0.09, 0.01, 1.25, 0.3, "steel-galvanized");
    addBox(nodes["cam-keeper-set"], 0.07, 0.09, 0.09, 0.01, -1.03, 0.85, "steel-galvanized");
    addBox(nodes["cam-keeper-set"], 0.07, 0.09, 0.09, 0.01, 1.25, 0.85, "steel-galvanized");
    addBox(nodes["rod-guide-brackets"], 0.025, 0.08, 0.06, 0.003, -0.5, -0.85, "steel-galvanized");
    addBox(nodes["rod-guide-brackets"], 0.025, 0.08, 0.06, 0.003, 0.7, -0.85, "steel-galvanized");
    addBox(nodes["rod-guide-brackets"], 0.025, 0.08, 0.06, 0.003, -0.5, -0.3, "steel-galvanized");
    addBox(nodes["rod-guide-brackets"], 0.025, 0.08, 0.06, 0.003, 0.7, -0.3, "steel-galvanized");
    addBox(nodes["rod-guide-brackets"], 0.025, 0.08, 0.06, 0.003, -0.5, 0.3, "steel-galvanized");
    addBox(nodes["rod-guide-brackets"], 0.025, 0.08, 0.06, 0.003, 0.7, 0.3, "steel-galvanized");
    addBox(nodes["rod-guide-brackets"], 0.025, 0.08, 0.06, 0.003, -0.5, 0.85, "steel-galvanized");
    addBox(nodes["rod-guide-brackets"], 0.025, 0.08, 0.06, 0.003, 0.7, 0.85, "steel-galvanized");
    addBox(nodes["handle-set"], 0.028, 0.05, 0.4, 0.01, -0.03, -0.68, "steel-galvanized");
    addBox(nodes["handle-set"], 0.028, 0.05, 0.4, 0.01, -0.03, -0.13, "steel-galvanized");
    addBox(nodes["handle-set"], 0.028, 0.05, 0.4, 0.01, -0.03, 0.13, "steel-galvanized");
    addBox(nodes["handle-set"], 0.028, 0.05, 0.4, 0.01, -0.03, 0.68, "steel-galvanized");
    addBox(nodes["gasket-frames"], 0.015, 2.585, 0.02, 0.018, 0.0325, -1.069, "rubber-gasket");
    addBox(nodes["gasket-frames"], 0.015, 2.585, 0.02, 0.018, 0.0325, -0.01, "rubber-gasket");
    addBox(nodes["gasket-frames"], 0.015, 0.02, 1.0590000000000002, 0.018, -1.26, -0.5395, "rubber-gasket");
    addBox(nodes["gasket-frames"], 0.015, 0.02, 1.0590000000000002, 0.018, 1.325, -0.5395, "rubber-gasket");
    addBox(nodes["gasket-frames"], 0.015, 2.585, 0.02, 0.018, 0.0325, 0.01, "rubber-gasket");
    addBox(nodes["gasket-frames"], 0.015, 2.585, 0.02, 0.018, 0.0325, 1.069, "rubber-gasket");
    addBox(nodes["gasket-frames"], 0.015, 0.02, 1.0590000000000002, 0.018, -1.26, 0.5395, "rubber-gasket");
    addBox(nodes["gasket-frames"], 0.015, 0.02, 1.0590000000000002, 0.018, 1.325, 0.5395, "rubber-gasket");
    addBox(nodes["gasket-frames"], 0.015, 2.585, 0.025, 0.018, 0.0325, 0, "rubber-gasket");
  }
  {
    const mergeGeos = (geos) => {
      const parts = geos.map((g) => g.index ? g.toNonIndexed() : g);
      let total = 0;
      for (const g of parts)
        total += g.attributes.position.count;
      const pos = new Float32Array(total * 3);
      const nor = new Float32Array(total * 3);
      const uv = new Float32Array(total * 2);
      let off = 0;
      for (const g of parts) {
        if (!g.attributes.normal)
          g.computeVertexNormals();
        pos.set(g.attributes.position.array, off * 3);
        nor.set(g.attributes.normal.array, off * 3);
        if (g.attributes.uv)
          uv.set(g.attributes.uv.array, off * 2);
        off += g.attributes.position.count;
      }
      const out = new THREE.BufferGeometry;
      out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      return out;
    };
    const boxAt = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    const flutePolyline = (span, count, depth, crestRatio, valleyRatio) => {
      const pitch = span / count;
      const crest = crestRatio * pitch;
      const valley = valleyRatio * pitch;
      const web = (pitch - crest - valley) / 2;
      const pts = [];
      for (let i = 0;i < count; i += 1) {
        const s = i * pitch;
        pts.push([s, 0]);
        pts.push([s + crest, 0]);
        pts.push([s + crest + web, -depth]);
        pts.push([s + crest + web + valley, -depth]);
      }
      pts.push([span, 0]);
      return pts;
    };
    const bevelPolyline = (pts, r) => {
      if (r <= 0 || pts.length < 3)
        return pts;
      const out = [pts[0]];
      for (let i = 1;i < pts.length - 1; i += 1) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const d1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        if (d1 < 0.000000001 || d2 < 0.000000001) {
          out.push(p1);
          continue;
        }
        const t1 = Math.min(r, d1 * 0.45) / d1;
        const t2 = Math.min(r, d2 * 0.45) / d2;
        out.push([p1[0] + (p0[0] - p1[0]) * t1, p1[1] + (p0[1] - p1[1]) * t1]);
        out.push([p1[0] + (p2[0] - p1[0]) * t2, p1[1] + (p2[1] - p1[1]) * t2]);
      }
      out.push(pts[pts.length - 1]);
      return out;
    };
    const corrugatedSlab = (span, height, count, depth, crestRatio, valleyRatio, bevel, backing) => {
      const line = bevelPolyline(flutePolyline(span, count, depth, crestRatio, valleyRatio), bevel);
      const shape = new THREE.Shape;
      shape.moveTo(line[0][0], line[0][1]);
      for (let i = 1;i < line.length; i += 1)
        shape.lineTo(line[i][0], line[i][1]);
      shape.lineTo(span, -depth - backing);
      shape.lineTo(0, -depth - backing);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1, curveSegments: 1 });
      geo.rotateX(Math.PI / 2);
      geo.translate(-span / 2, height / 2, 0);
      return geo;
    };
    const ellipsePts = (rx, ry, seg) => {
      const out = [];
      for (let i = 0;i < seg; i += 1) {
        const th = i / seg * Math.PI * 2;
        out.push([rx * Math.cos(th), ry * Math.sin(th)]);
      }
      return out;
    };
    const platedFace = (w, h, t, hole) => {
      const shape = new THREE.Shape;
      shape.moveTo(-w / 2, -h / 2);
      shape.lineTo(w / 2, -h / 2);
      shape.lineTo(w / 2, h / 2);
      shape.lineTo(-w / 2, h / 2);
      shape.closePath();
      if (hole && hole.length > 2) {
        const path = new THREE.Path;
        path.moveTo(hole[0][0], hole[0][1]);
        for (let i = 1;i < hole.length; i += 1)
          path.lineTo(hole[i][0], hole[i][1]);
        path.closePath();
        shape.holes.push(path);
      }
      return new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, steps: 1, curveSegments: 1 }).translate(0, 0, -t / 2);
    };
    const setGeo = (id, g, note) => {
      const m = meshes[id];
      if (!m)
        return;
      m.geometry.dispose();
      m.geometry = g;
      m.userData.formRefinement = note;
    };
    const dropByName = (n) => {
      const o = root.getObjectByName(n);
      if (!o)
        return;
      o.parent?.remove(o);
      const m = o;
      if (m.isMesh && m.geometry)
        m.geometry.dispose();
    };
    const clearAnonMeshes = (o) => {
      if (!o)
        return;
      for (const c of [...o.children])
        if (c.isMesh && c.name === "")
          o.remove(c);
    };
    const addCluster = (parent, name, geo, mat, placements) => {
      const material = materialMap[mat] ?? new THREE.MeshStandardMaterial({ color: 8950432 });
      const cluster = new THREE.InstancedMesh(geo, material, placements.length);
      const m4 = new THREE.Matrix4;
      const pv = new THREE.Vector3;
      const qv = new THREE.Quaternion;
      const sv = new THREE.Vector3(1, 1, 1);
      const ax = new THREE.Vector3(1, 0, 0);
      geo.computeBoundingBox();
      const elem = geo.boundingBox;
      const union = new THREE.Box3;
      for (let i = 0;i < placements.length; i += 1) {
        const p = placements[i];
        pv.set(p[0], p[1], p[2]);
        qv.setFromAxisAngle(ax, p[3]);
        m4.compose(pv, qv, sv);
        cluster.setMatrixAt(i, m4);
        union.union(elem.clone().applyMatrix4(m4));
      }
      cluster.instanceMatrix.needsUpdate = true;
      cluster.castShadow = options.castShadow ?? true;
      cluster.receiveShadow = options.receiveShadow ?? true;
      cluster.name = name;
      cluster.userData.explodeWithParent = true;
      const sphere = union.getBoundingSphere(new THREE.Sphere);
      geo.boundingBox = union;
      geo.boundingSphere = sphere;
      cluster.boundingBox = union.clone();
      cluster.boundingSphere = sphere.clone();
      parent.add(cluster);
      return cluster;
    };
    if (meshes["door-assembly"])
      meshes["door-assembly"].visible = false;
    if (meshes["corner-structure"])
      meshes["corner-structure"].visible = false;
    dropByName("corrugation-side");
    {
      const g = corrugatedSlab(11.892, 2.676, 42, 0.036, 0.42, 0.28, 0.006, 0.004);
      g.translate(0, 0, 0.018);
      setGeo("side-wall-right", g, { system: "corrugation-side", flutes: 42, pitch: 0.28314, depth: 0.036, direction: "inward-from-outer-plane" });
    }
    {
      const g = corrugatedSlab(11.892, 2.676, 42, 0.036, 0.42, 0.28, 0.006, 0.004);
      g.rotateY(Math.PI);
      g.translate(0, 0, -0.018);
      setGeo("side-wall-left", g, { system: "corrugation-side", flutes: 42, pitch: 0.28314, depth: 0.036, direction: "inward-from-outer-plane", mirrored: true });
    }
    {
      const g = corrugatedSlab(2.138, 2.736, 8, 0.036, 0.42, 0.28, 0.006, 0.004);
      g.rotateY(-Math.PI / 2);
      g.translate(-0.018, 0, 0);
      setGeo("front-wall", g, { system: "corrugation-side", flutes: 8, pitch: 0.26725, depth: 0.036, direction: "inward-from-outer-plane" });
    }
    dropByName("roof-ribs");
    {
      const field = corrugatedSlab(11.692, 1.9380000000000004, 52, 0.012, 0.3, 0.46, 0.004, 0.018);
      field.rotateX(-Math.PI / 2);
      field.translate(0, 0.015, 0);
      const g = mergeGeos([
        field,
        boxAt(11.892, 0.03, 0.1, 0, 0, -1.0190000000000001),
        boxAt(11.892, 0.03, 0.1, 0, 0, 1.0190000000000001),
        boxAt(0.1, 0.03, 1.9380000000000004, -5.896, 0, 0),
        boxAt(0.1, 0.03, 1.9380000000000004, 5.896, 0, 0)
      ]);
      setGeo("roof-panel", g, { system: "roof-ribs", ribs: 52, pitch: 0.22485, depth: 0.012, flatMargin: 0.1, direction: "recessed-below-outer-plane" });
    }
    dropByName("hinge-system");
    dropByName("cam-keeper-system");
    dropByName("guide-bracket-system");
    clearAnonMeshes(nodes["hinge-set"]);
    clearAnonMeshes(nodes["cam-keeper-set"]);
    clearAnonMeshes(nodes["rod-guide-brackets"]);
    clearAnonMeshes(nodes["corner-castings"]);
    {
      const barrel = new THREE.CylinderGeometry(0.026, 0.026, 0.11, 14).translate(0.018, 0, 0.088);
      const geo = mergeGeos([boxAt(0.014, 0.06, 0.16, 0, 0, 0), barrel]);
      const P = [
        [0.002, -0.8475, 1.012, 0],
        [0.002, -0.8475, -1.012, Math.PI],
        [0.002, -0.2275, 1.012, 0],
        [0.002, -0.2275, -1.012, Math.PI],
        [0.002, 0.3925, 1.012, 0],
        [0.002, 0.3925, -1.012, Math.PI],
        [0.002, 1.0125, 1.012, 0],
        [0.002, 1.0125, -1.012, Math.PI]
      ];
      addCluster(nodes["hinge-set"], "hinge-system", geo, "steel-galvanized", P);
    }
    {
      const geo = mergeGeos([
        boxAt(0.01, 0.1, 0.11, 0.005, 0, 0),
        boxAt(0.02, 0.022, 0.086, 0.02, 0.039, 0),
        boxAt(0.02, 0.022, 0.086, 0.02, -0.039, 0),
        boxAt(0.028, 0.03, 0.04, 0.022, 0, 0)
      ]);
      const P = [
        [0.008, -1.03, -0.85, 0],
        [0.008, -1.03, -0.3, 0],
        [0.008, -1.03, 0.3, 0],
        [0.008, -1.03, 0.85, 0],
        [0.008, 1.25, -0.85, 0],
        [0.008, 1.25, -0.3, 0],
        [0.008, 1.25, 0.3, 0],
        [0.008, 1.25, 0.85, 0]
      ];
      addCluster(nodes["cam-keeper-set"], "cam-keeper-system", geo, "steel-galvanized", P);
    }
    {
      const collar = new THREE.TorusGeometry(0.018, 0.005, 6, 14);
      collar.rotateX(Math.PI / 2);
      collar.translate(0.035, 0, 0);
      const geo = mergeGeos([
        boxAt(0.008, 0.08, 0.05, 0.004, 0, 0),
        boxAt(0.02, 0.026, 0.026, 0.014, 0, 0),
        collar
      ]);
      const P = [
        [-0.025, -0.65, -0.85, 0],
        [-0.025, 0.25, -0.85, 0],
        [-0.025, 1.15, -0.85, 0],
        [-0.025, -0.2, -0.3, 0],
        [-0.025, 0.7, -0.3, 0],
        [-0.025, -0.2, 0.3, 0],
        [-0.025, 0.7, 0.3, 0],
        [-0.025, -0.65, 0.85, 0],
        [-0.025, 0.25, 0.85, 0],
        [-0.025, 1.15, 0.85, 0]
      ];
      addCluster(nodes["rod-guide-brackets"], "guide-bracket-system", geo, "steel-galvanized", P);
    }
    {
      const W = 0.178, H = 0.118, D = 0.162, T = 0.016;
      const ovalTop = ellipsePts(0.062, 0.0315, 24);
      const ovalEnd = ellipsePts(0.051, 0.03, 24);
      const roundSide = ellipsePts(0.0315, 0.0315, 20);
      const py = platedFace(W, D, T, ovalTop);
      const ny = platedFace(W, D, T, ovalTop);
      py.rotateX(-Math.PI / 2).translate(0, (H - T) / 2, 0);
      ny.rotateX(-Math.PI / 2).translate(0, -(H - T) / 2, 0);
      const px = platedFace(D, H, T, ovalEnd);
      const nx = platedFace(D, H, T, ovalEnd);
      px.rotateY(Math.PI / 2).translate((W - T) / 2, 0, 0);
      nx.rotateY(Math.PI / 2).translate(-(W - T) / 2, 0, 0);
      const pz = platedFace(W, H, T, roundSide).translate(0, 0, (D - T) / 2);
      const nz = platedFace(W, H, T, roundSide).translate(0, 0, -(D - T) / 2);
      const shell = mergeGeos([py, ny, px, nx, pz, nz]);
      shell.computeBoundingBox();
      shell.computeBoundingSphere();
      const mat = materialMap["paint-structure"] ?? new THREE.MeshStandardMaterial({ color: 8950432 });
      const at = [
        [-6.007, -1.389, -1.138],
        [-6.007, -1.389, 1.138],
        [-6.007, 1.389, -1.138],
        [-6.007, 1.389, 1.138],
        [6.007, -1.389, -1.138],
        [6.007, -1.389, 1.138],
        [6.007, 1.389, -1.138],
        [6.007, 1.389, 1.138]
      ];
      for (const p of at) {
        const mm = new THREE.Mesh(shell, mat);
        mm.position.set(p[0], p[1], p[2]);
        mm.castShadow = true;
        mm.receiveShadow = true;
        mm.userData.explodeWithParent = true;
        nodes["corner-castings"].add(mm);
      }
    }
    {
      const H = 2.585, D = 1.0590000000000002, FB = 0.075;
      const coreT = 0.035;
      const frameT = 0.015;
      const frameCx = 0.0175;
      const build = () => mergeGeos([
        boxAt(coreT, H, D, -0.0075, 0, 0),
        boxAt(frameT, FB, D, frameCx, (H - FB) / 2, 0),
        boxAt(frameT, FB, D, frameCx, -(H - FB) / 2, 0),
        boxAt(frameT, H - 2 * FB, FB, frameCx, 0, (D - FB) / 2),
        boxAt(frameT, H - 2 * FB, FB, frameCx, 0, -(D - FB) / 2),
        boxAt(frameT, 0.065, D - 2 * FB, frameCx, 0.12925, 0)
      ]);
      const note = { feature: "recessed-panels", fields: 2, recess: 0.015, frameWidth: 0.075, stiffenerY: 0.12925 };
      setGeo("door-leaf-left", build(), note);
      setGeo("door-leaf-right", build(), note);
    }
    if (nodes["csc-plate"]) {
      nodes["csc-plate"].position.x = 0.0115;
    }
    {
      const gw = 0.004, gd = 0.003;
      const band = (0.06 - gw) / 2;
      setGeo("top-side-rail-right", mergeGeos([
        boxAt(11.892, band, 0.06, 0, (band + gw) / 2, 0),
        boxAt(11.892, band, 0.06, 0, -(band + gw) / 2, 0),
        boxAt(11.892, gw, 0.06 - gd, 0, 0, -1 * gd / 2)
      ]), { feature: "panel-seam", type: "groove", width: gw, depth: gd, outward: 1 });
    }
    {
      const gw = 0.004, gd = 0.003;
      const band = (0.06 - gw) / 2;
      setGeo("top-side-rail-left", mergeGeos([
        boxAt(11.892, band, 0.06, 0, (band + gw) / 2, 0),
        boxAt(11.892, band, 0.06, 0, -(band + gw) / 2, 0),
        boxAt(11.892, gw, 0.06 - gd, 0, 0, 1 * gd / 2)
      ]), { feature: "panel-seam", type: "groove", width: gw, depth: gd, outward: -1 });
    }
    {
      const st = 0.012;
      const body = 0.16 - st;
      setGeo("bottom-side-rail-right", mergeGeos([
        boxAt(11.892, body, 0.048, 0, -st / 2, 0),
        boxAt(11.892, st, 0.048 - st, 0, body / 2, -1 * st / 2)
      ]), { feature: "panel-seam", type: "step-seam", step: st, outward: 1 });
    }
    {
      const st = 0.012;
      const body = 0.16 - st;
      setGeo("bottom-side-rail-left", mergeGeos([
        boxAt(11.892, body, 0.048, 0, -st / 2, 0),
        boxAt(11.892, st, 0.048 - st, 0, body / 2, 1 * st / 2)
      ]), { feature: "panel-seam", type: "step-seam", step: st, outward: -1 });
    }
  }
  {
    const loadTex = (url, srgb, rx, ry, clamp) => {
      const t = new THREE.TextureLoader().load(url);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      if (clamp) {
        t.wrapS = THREE.ClampToEdgeWrapping;
        t.wrapT = THREE.ClampToEdgeWrapping;
      } else {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
      }
      t.repeat.set(rx, ry);
      t.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? 8));
      t.needsUpdate = true;
      return t;
    };
    const brandAlbedo = [
      ["paint-body-navy", "#14424C", 1.077292],
      ["paint-structure", "#0E2D34", 1.024268],
      ["steel-galvanized", "#9BA3AB", 1.127287],
      ["rubber-gasket", "#15161A", 1.066563],
      ["decal-white", "#EAE8D6", 1.077292],
      ["paint-accent-orange", "#D6640F", 1.077292]
    ];
    for (const [id, hex, comp] of brandAlbedo) {
      const m = materialMap[id];
      if (!m)
        continue;
      const prev = m.map;
      m.color.set(hex).multiplyScalar(comp);
      m.map = loadTex(`/3d/assets/pbr/${id}_albedo_brand.webp`, true, 2, 2, false);
      if (prev)
        prev.dispose();
      m.userData.albedoOverride = { source: "brandContract", hex, compensation: comp, mask: "neutral-luminance-from-referencePbr" };
      m.needsUpdate = true;
    }
    const addPlanarUV1 = (mesh, flipU) => {
      if (!mesh)
        return;
      const g = mesh.geometry;
      const p = g.attributes.position;
      g.computeBoundingBox();
      const bb = g.boundingBox;
      const sx = Math.max(0.000001, bb.max.x - bb.min.x);
      const sy = Math.max(0.000001, bb.max.y - bb.min.y);
      const arr = new Float32Array(p.count * 2);
      for (let i = 0;i < p.count; i += 1) {
        const u = (p.getX(i) - bb.min.x) / sx;
        arr[i * 2] = flipU ? 1 - u : u;
        arr[i * 2 + 1] = (p.getY(i) - bb.min.y) / sy;
      }
      g.setAttribute("uv1", new THREE.BufferAttribute(arr, 2));
    };
    addPlanarUV1(meshes["side-wall-right"], false);
    addPlanarUV1(meshes["side-wall-left"], true);
    {
      const base = materialMap["paint-body-navy"];
      const mk = (side, url) => {
        const wall = base.clone();
        wall.name = "paint-body-navy+ssb-decal-" + side;
        wall.color.set(16777215);
        wall.map = loadTex(url, true, 1, 1, true);
        wall.map.channel = 1;
        wall.userData.strippedColor = "#14424C";
        wall.userData.decal = {
          id: "logo-decal",
          source: "/3d/assets/ssb-white.svg",
          uvChannel: 1,
          widthFraction: 0.4,
          placement: "centrado horizontal, banda media"
        };
        wall.needsUpdate = true;
        materialMap["paint-body-navy+ssb-decal-" + side] = wall;
        return wall;
      };
      const wr = mk("right", "/3d/assets/pbr/side-wall-right_albedo_ssb.webp");
      const wl = mk("left", "/3d/assets/pbr/side-wall-left_albedo_ssb.webp");
      if (meshes["side-wall-right"])
        meshes["side-wall-right"].material = wr;
      if (meshes["side-wall-left"])
        meshes["side-wall-left"].material = wl;
    }
  }
  {
    const loadTexS = (url) => {
      const t = new THREE.TextureLoader().load(url);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.repeat.set(1, 1);
      t.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? 8));
      t.needsUpdate = true;
      return t;
    };
    const leafUV1 = (mesh) => {
      if (!mesh)
        return;
      const g = mesh.geometry;
      const p = g.attributes.position;
      g.computeBoundingBox();
      const bb = g.boundingBox;
      const sz = Math.max(0.000001, bb.max.z - bb.min.z);
      const sy = Math.max(0.000001, bb.max.y - bb.min.y);
      const arr = new Float32Array(p.count * 2);
      for (let i = 0;i < p.count; i += 1) {
        arr[i * 2] = (bb.max.z - p.getZ(i)) / sz;
        arr[i * 2 + 1] = (p.getY(i) - bb.min.y) / sy;
      }
      g.setAttribute("uv1", new THREE.BufferAttribute(arr, 2));
    };
    const navyBase = materialMap["paint-body-navy"];
    {
      leafUV1(meshes["door-leaf-right"]);
      const m = navyBase.clone();
      m.name = "paint-body-navy+door-leaf-right";
      m.color.set(16777215);
      m.map = loadTexS("/3d/assets/pbr/door-leaf-right_albedo_ssb.webp");
      m.map.channel = 1;
      m.userData.strippedColor = "#14424C";
      m.userData.surface = { ao: "recessed-fields", markings: false };
      m.needsUpdate = true;
      materialMap["paint-body-navy+door-leaf-right"] = m;
      if (meshes["door-leaf-right"])
        meshes["door-leaf-right"].material = m;
    }
    {
      leafUV1(meshes["door-leaf-left"]);
      const m = navyBase.clone();
      m.name = "paint-body-navy+door-leaf-left";
      m.color.set(16777215);
      m.map = loadTexS("/3d/assets/pbr/door-leaf-left_albedo_ssb.webp");
      m.map.channel = 1;
      m.userData.strippedColor = "#14424C";
      m.userData.surface = { ao: "recessed-fields", markings: true };
      m.needsUpdate = true;
      materialMap["paint-body-navy+door-leaf-left"] = m;
      if (meshes["door-leaf-left"])
        meshes["door-leaf-left"].material = m;
    }
    {
      const base = materialMap["decal-white"];
      const m = base.clone();
      m.name = "decal-white+csc";
      m.color.set(16777215);
      m.map = loadTexS("/3d/assets/decal/csc-plate.webp");
      m.userData.strippedColor = "#EAE8D6";
      m.userData.surface = { plate: "csc-safety-approval", fictitious: true };
      m.needsUpdate = true;
      materialMap["decal-white+csc"] = m;
      if (meshes["csc-plate"])
        meshes["csc-plate"].material = m;
    }
  }
  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups };
  root.userData.lookDevTargets = { qualityPriority: "reference-fidelity", materialPass: { albedoPaletteRequired: true, roughnessVariationRequired: true, normalOrBumpRequired: true, localOverridesRequired: true, minimumTextureResolution: 1024, preferredTextureResolution: 2048, independentMapChannels: ["albedo", "roughness", "height", "normal", "ambient-occlusion"], requiredSurfaceFrequencyBands: ["macro", "meso", "micro"], geometryReliefRequiredWhenSilhouetteAffected: true, referencePbrExtraction: { requiredWhenSourceImagePresent: true, targetThreshold: 0.7, stopOnLowConfidence: true, script: "forge/stage1_intake/extract_pbr_evidence.py", acceptedLimitation: "single-image extraction is reference-derived inference, not exact photogrammetry" }, mustAvoid: ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"] }, lightingPass: { requiredTerms: ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], mustAvoid: ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"] }, screenshotReview: ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."] };
  root.userData.actionReadiness = {
    note: "Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets."
  };
  {
    const RT = root.userData.sculptRuntime;
    const notes = [];
    const asserts = {};
    const visibleChain = (leaf, stopAt) => {
      for (let n = leaf;n && n !== stopAt; n = n.parent)
        if (!n.visible)
          return false;
      return true;
    };
    const worldBoxOf = (o) => {
      const box = new THREE.Box3;
      o.updateWorldMatrix(true, true);
      o.traverse((c) => {
        const m = c;
        if (!m.isMesh || !visibleChain(c, o.parent))
          return;
        const im = c;
        if (im.isInstancedMesh && im.boundingBox) {
          box.union(im.boundingBox.clone().applyMatrix4(im.matrixWorld));
          return;
        }
        if (!m.geometry.boundingBox)
          m.geometry.computeBoundingBox();
        box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));
      });
      return box;
    };
    const triCount = (o) => {
      let t = 0;
      o.traverse((c) => {
        const m = c;
        if (!m.isMesh || !m.geometry)
          return;
        const g = m.geometry;
        const n = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0;
        const im = c;
        t += Math.floor(n / 3) * (im.isInstancedMesh ? im.count : 1);
      });
      return t;
    };
    const arr3 = (v) => [+v.x.toFixed(6), +v.y.toFixed(6), +v.z.toFixed(6)];
    const nameAnon = (parent, fn) => {
      if (!parent)
        return 0;
      let n = 0;
      for (const c of parent.children) {
        const m = c;
        if (!m.isMesh || m.name !== "")
          continue;
        m.name = fn(m);
        m.userData.partIdHint = m.name;
        n += 1;
      }
      return n;
    };
    asserts.namedHandles = nameAnon(nodes["handle-set"], (m) => `handle-${m.position.z < 0 ? "left" : "right"}-${Math.abs(m.position.z) > 0.4 ? "outer" : "inner"}`);
    asserts.namedGaskets = nameAnon(nodes["gasket-frames"], (m) => {
      const p = m.position;
      if (Math.abs(p.z) < 0.005)
        return "gasket-center-lap-seal";
      const side = p.z < 0 ? "left" : "right";
      const par = m.geometry.parameters ?? {};
      const vertical = (par.height ?? 0) > (par.depth ?? 0);
      if (vertical)
        return `gasket-${side}-${Math.abs(p.z) > 0.5 ? "hinge" : "lock"}-stile`;
      return `gasket-${side}-${p.y < 0 ? "sill" : "head"}-rail`;
    });
    asserts.namedCastings = nameAnon(nodes["corner-castings"], (m) => {
      const p = m.position;
      return `corner-casting-${p.x < 0 ? "front" : "rear"}-${p.y < 0 ? "bottom" : "top"}-${p.z < 0 ? "left" : "right"}`;
    });
    if (nodes["corner-castings"]) {
      for (const c of nodes["corner-castings"].children)
        if (c.isMesh)
          c.userData.explodeWithParent = false;
    }
    const PIN = { x: 6.07, z: 1.1 };
    const doorPivots = {};
    const doorAngles = { left: 0, right: 0 };
    const OPEN_SIGN = { left: 1, right: -1 };
    for (const side of ["left", "right"]) {
      const pv = new THREE.Object3D;
      pv.name = `door-pivot-${side}`;
      pv.position.set(PIN.x, 0, side === "left" ? -PIN.z : PIN.z);
      pv.userData.rigNode = "hinge-pivot";
      pv.userData.partKind = "pivot";
      pv.userData.hinge = {
        axis: [0, 1, 0],
        worldPosition: [PIN.x, 0, side === "left" ? -PIN.z : PIN.z],
        rangeDeg: [0, 270],
        openSign: OPEN_SIGN[side],
        leaf: `door-leaf-${side}`
      };
      nodes["door-assembly"].add(pv);
      pv.attach(nodes[`door-leaf-${side}`]);
      doorPivots[side] = pv;
    }
    const splitInstanced = (cluster, baseName) => {
      const posAttr = cluster.geometry.attributes.position;
      const elem = new THREE.Box3().setFromBufferAttribute(posAttr);
      const buckets = { left: [], right: [] };
      const m4 = new THREE.Matrix4;
      const pv = new THREE.Vector3;
      for (let i = 0;i < cluster.count; i += 1) {
        cluster.getMatrixAt(i, m4);
        pv.setFromMatrixPosition(m4);
        buckets[pv.z < 0 ? "left" : "right"].push(m4.clone());
      }
      const parent = cluster.parent;
      const out = {};
      for (const side of ["left", "right"]) {
        const list = buckets[side];
        const im = new THREE.InstancedMesh(cluster.geometry, cluster.material, list.length);
        const union = new THREE.Box3;
        for (let i = 0;i < list.length; i += 1) {
          im.setMatrixAt(i, list[i]);
          union.union(elem.clone().applyMatrix4(list[i]));
        }
        im.instanceMatrix.needsUpdate = true;
        im.name = `${baseName}-${side}`;
        im.castShadow = cluster.castShadow;
        im.receiveShadow = cluster.receiveShadow;
        im.userData.explodeWithParent = true;
        im.boundingBox = union.clone();
        im.boundingSphere = union.getBoundingSphere(new THREE.Sphere);
        parent.add(im);
        out[side] = im;
      }
      parent.remove(cluster);
      return out;
    };
    const findChild = (parent, name) => parent ? parent.children.find((c) => c.name === name) : undefined;
    const halves = {};
    {
      const cl = findChild(nodes["cam-keeper-set"], "cam-keeper-system");
      if (!cl)
        throw new Error("interaction-pass: falta el cluster cam-keeper-system");
      const h = splitInstanced(cl, "cam-keeper-system");
      halves["cam-keeper-set"] = { left: [h.left], right: [h.right] };
    }
    {
      const cl = findChild(nodes["hinge-set"], "hinge-system");
      if (!cl)
        throw new Error("interaction-pass: falta el cluster hinge-system");
      {
        const mm = new THREE.Matrix4;
        const pp = new THREE.Vector3;
        let ok = true;
        for (let i = 0;i < cl.count; i += 1) {
          cl.getMatrixAt(i, mm);
          pp.setFromMatrixPosition(mm);
          if (Math.abs(Math.abs(pp.z) - 1.012) > 0.000001)
            ok = false;
        }
        asserts.hingeAxis = { expectedInstanceZ: 1.012, pinX: PIN.x, pinZ: PIN.z, pass: ok, count: cl.count };
        if (!ok)
          notes.push("hinge-axis-drift: las instancias de bisagra ya no estan en |z|=1.012");
      }
      const h = splitInstanced(cl, "hinge-system");
      halves["hinge-set"] = { left: [h.left], right: [h.right] };
    }
    {
      const cl = findChild(nodes["rod-guide-brackets"], "guide-bracket-system");
      if (!cl)
        throw new Error("interaction-pass: falta el cluster guide-bracket-system");
      const h = splitInstanced(cl, "guide-bracket-system");
      halves["rod-guide-brackets"] = { left: [h.left], right: [h.right] };
    }
    {
      const src = nodes["handle-set"];
      const byside = { left: [], right: [] };
      for (const c of [...src ? src.children : []]) {
        const m = c;
        if (!m.isMesh || !m.visible)
          continue;
        byside[m.position.z < 0.005 ? "left" : "right"].push(m);
        m.userData.explodeWithParent = true;
      }
      halves["handle-set"] = byside;
    }
    {
      const src = nodes["gasket-frames"];
      const byside = { left: [], right: [] };
      for (const c of [...src ? src.children : []]) {
        const m = c;
        if (!m.isMesh || !m.visible)
          continue;
        byside[m.position.z < 0.005 ? "left" : "right"].push(m);
        m.userData.explodeWithParent = true;
      }
      halves["gasket-frames"] = byside;
    }
    const splitSets = {};
    for (const setId of Object.keys(halves)) {
      const ids = [];
      for (const side of ["left", "right"]) {
        const kids = halves[setId][side];
        if (!kids || kids.length === 0)
          continue;
        const g = new THREE.Group;
        g.name = `${setId}-${side}`;
        g.userData.partIdHint = g.name;
        g.userData.splitOf = setId;
        g.userData.side = side;
        nodes[`door-leaf-${side}`].add(g);
        for (const k of kids)
          g.attach(k);
        nodes[g.name] = g;
        ids.push(g.name);
      }
      splitSets[setId] = ids;
      const dead = nodes[setId];
      if (dead && dead.parent)
        dead.parent.remove(dead);
      delete nodes[setId];
      delete meshes[setId];
    }
    const idOf = (o) => {
      const hint = o.userData.partIdHint;
      if (typeof hint === "string" && hint)
        return hint;
      const comp = o.userData.sculptComponent;
      if (comp && comp.id)
        return String(comp.id);
      return o.name;
    };
    const hasVisibleGeometry = (o) => {
      let found = false;
      o.traverse((c) => {
        const m = c;
        if (m.isMesh && visibleChain(c, o.parent))
          found = true;
      });
      return found;
    };
    const parts = [];
    const containers = [];
    let integralMeshes = 0;
    let unnamedMeshes = 0;
    const collect = (o) => {
      if (o.userData.explodeWithParent === true) {
        o.traverse((c) => {
          if (c.isMesh)
            integralMeshes += 1;
        });
        return false;
      }
      const partChildren = [];
      for (const c of o.children)
        if (collect(c))
          partChildren.push(c);
      if (partChildren.length > 0) {
        if (partChildren.length === 1 && partChildren[0].isMesh && /__pivot$/.test(o.name)) {
          const rec = parts.find((p) => p.node === partChildren[0]);
          if (rec) {
            rec.node = o;
            rec.name = o.name;
            o.userData.__partId = rec.id;
            delete partChildren[0].userData.__partId;
            integralMeshes += 1;
            return true;
          }
        }
        o.userData.partKind = "container";
        containers.push({ id: idOf(o), name: o.name, node: o, kind: "container" });
        return true;
      }
      if (o === root)
        return false;
      const mesh = o;
      if (mesh.isMesh && !o.visible)
        return false;
      if (!hasVisibleGeometry(o))
        return false;
      if (!o.name) {
        unnamedMeshes += 1;
        return false;
      }
      const id = idOf(o);
      o.userData.__partId = id;
      o.userData.partKind = "part";
      let inner = 0;
      o.traverse((c) => {
        if (c.isMesh && c !== o)
          inner += 1;
      });
      integralMeshes += inner;
      parts.push({
        id,
        name: o.name,
        node: o,
        kind: "part",
        parentPart: null,
        bbox: { min: [], max: [] },
        triangles: 0,
        basePos: [],
        baseCenter: [],
        dir: [],
        collider: {},
        actionProfile: {},
        destructionGroup: null
      });
      return true;
    };
    root.updateMatrixWorld(true);
    collect(root);
    root.traverse((c) => {
      const m = c;
      if (m.isMesh && !m.name)
        unnamedMeshes += 1;
    });
    asserts.unnamedMeshes = unnamedMeshes;
    asserts.parts = parts.length;
    const MODEL_CENTER = new THREE.Vector3(0, 1.448, 0);
    const EXPLODE_K = 1;
    const EXPLODE_CLEARANCE = 0.3;
    const roleOf = (id) => {
      if (id.startsWith("door-leaf-"))
        return "hinged-door";
      if (id.startsWith("lock-rod-"))
        return "rotating-rod";
      return "static-part";
    };
    const sideOfPart = (p) => {
      for (const side of ["left", "right"]) {
        for (let n = p.node;n; n = n.parent)
          if (n === doorPivots[side])
            return side;
      }
      return null;
    };
    const groupOfPart = {};
    groupOfPart["door-pivot-left"] = "door-leaf-left-assembly";
    groupOfPart["door-pivot-right"] = "door-leaf-right-assembly";
    groupOfPart["door-header"] = "door-frame";
    groupOfPart["door-sill"] = "door-frame";
    groupOfPart["side-wall-right"] = "shell-side-right";
    groupOfPart["top-side-rail-right"] = "shell-side-right";
    groupOfPart["bottom-side-rail-right"] = "shell-side-right";
    groupOfPart["side-wall-left"] = "shell-side-left";
    groupOfPart["top-side-rail-left"] = "shell-side-left";
    groupOfPart["bottom-side-rail-left"] = "shell-side-left";
    groupOfPart["front-wall"] = "shell-front";
    groupOfPart["roof-panel"] = "shell-roof";
    groupOfPart["underframe"] = "shell-underframe";
    groupOfPart["corner-post-front-left"] = "corner-frame";
    groupOfPart["corner-post-front-right"] = "corner-frame";
    groupOfPart["corner-post-rear-left"] = "corner-frame";
    groupOfPart["corner-post-rear-right"] = "corner-frame";
    for (const p of parts) {
      const box = worldBoxOf(p.node);
      const c = box.getCenter(new THREE.Vector3);
      const s = box.getSize(new THREE.Vector3);
      const dir = c.clone().sub(MODEL_CENTER);
      if (dir.lengthSq() < 0.00000001)
        dir.set(0, 1, 0);
      p.bbox = { min: arr3(box.min), max: arr3(box.max) };
      p.triangles = triCount(p.node);
      p.basePos = arr3(p.node.position);
      p.baseCenter = arr3(c);
      p.dir = arr3(dir);
      const side = sideOfPart(p);
      const localCenter = p.node.worldToLocal(c.clone());
      p.collider = {
        type: "box",
        center: arr3(localCenter),
        halfExtents: arr3(s.clone().multiplyScalar(0.5)),
        size: arr3(s),
        worldCenter: arr3(c),
        isTrigger: false,
        source: "aabb-simplified-proxy",
        note: "proxy de fisica: caja alineada, NO el mesh visual"
      };
      const role = roleOf(p.id);
      const pivot = role === "hinged-door" ? {
        mode: "hinge",
        node: `door-pivot-${p.id.endsWith("left") ? "left" : "right"}`,
        axis: [0, 1, 0],
        worldPosition: [PIN.x, 0, p.id.endsWith("left") ? -PIN.z : PIN.z],
        rangeDeg: [0, 270],
        openSign: OPEN_SIGN[p.id.endsWith("left") ? "left" : "right"]
      } : role === "rotating-rod" ? {
        mode: "axis",
        node: p.name,
        axis: [0, 1, 0],
        worldPosition: [c.x, 0, c.z],
        rangeDeg: [-100, 100],
        note: "giro del rod que acciona las levas"
      } : { mode: "center", node: p.name, axis: [0, 1, 0], worldPosition: arr3(c) };
      const dgroup = groupOfPart[p.id] ?? (side ? `door-leaf-${side}-assembly` : null);
      p.destructionGroup = dgroup;
      p.actionProfile = {
        animationRole: role,
        pivot,
        transformChannels: { translate: true, rotate: true, scale: true, bend: true, twist: true, detach: true, visibility: true, "material-state": true },
        collider: p.collider,
        sockets: [],
        ridesPivot: side ? `door-pivot-${side}` : null,
        destruction: {
          breakable: false,
          detachable: true,
          fractureGroup: dgroup,
          detachNode: p.name,
          debrisMaterial: null,
          strategy: "Prefer detachable component groups and a small number of procedural fragments over random mesh explosion."
        }
      };
      p.node.userData.actionProfile = p.actionProfile;
      colliders[p.id] = p.collider;
    }
    const addSocket = (id, parent, pos, meta) => {
      if (!parent)
        return null;
      const s = new THREE.Object3D;
      s.name = `socket:${id}`;
      s.position.set(pos[0], pos[1], pos[2]);
      s.userData.socket = { id, ...meta };
      parent.add(s);
      sockets[id] = s;
      return s;
    };
    for (const side of ["left", "right"]) {
      addSocket(`hinge-axis-${side}`, doorPivots[side], [0, 1.5825, 0], {
        kind: "hinge",
        axis: [0, 1, 0],
        rangeDeg: [0, 270],
        specNominalWorldZ: side === "left" ? -1.144 : 1.144,
        builtWorldZ: side === "left" ? -PIN.z : PIN.z,
        note: "socket en el pasador construido, no en el nominal del spec"
      });
    }
    for (const side of ["left", "right"]) {
      const g = nodes[`rod-guide-brackets-${side}`];
      if (g) {
        const b = worldBoxOf(g);
        const cc = b.getCenter(new THREE.Vector3);
        const lp = nodes[`door-leaf-${side}`].worldToLocal(cc.clone());
        addSocket(`leaf-face-${side}`, nodes[`door-leaf-${side}`], arr3(lp), { kind: "mount", forComponent: "rod-guide-brackets", specSocket: "leaf-face", side });
      }
    }
    addSocket("leaf-face-lower", nodes["door-leaf-right"], [0.027, -0.75, 0.05], { kind: "attachment", forComponent: "csc-plate", contactType: "overlap" });
    for (const side of ["left", "right"]) {
      const g = nodes[`gasket-frames-${side}`];
      if (g) {
        const b = worldBoxOf(g);
        const cc = b.getCenter(new THREE.Vector3);
        const lp = nodes[`door-leaf-${side}`].worldToLocal(cc.clone());
        addSocket(`leaf-perimeter-${side}`, nodes[`door-leaf-${side}`], arr3(lp), { kind: "mount", forComponent: "gasket-frames", specSocket: "leaf-perimeter", side });
      }
    }
    addSocket("post-ends", nodes["corner-structure"], [0, 1.448, 0], { kind: "attachment", forComponent: "corner-castings", contactType: "embed" });
    for (const side of ["left", "right"]) {
      const g = nodes[`hinge-set-${side}`];
      if (g) {
        const b = worldBoxOf(g);
        const cc = b.getCenter(new THREE.Vector3);
        const lp = nodes[`door-leaf-${side}`].worldToLocal(cc.clone());
        addSocket(`rear-posts-${side}`, nodes[`door-leaf-${side}`], arr3(lp), { kind: "mount", forComponent: "hinge-set", specSocket: "rear-posts", side });
      }
    }
    addSocket("rod-brackets-left-inner", nodes["door-leaf-left"], [0.045, -1.2325, 0.2395], { kind: "attachment", forComponent: "lock-rod-left-inner", contactType: "overlap" });
    addSocket("rod-brackets-left-outer", nodes["door-leaf-left"], [0.045, -1.2325, -0.3105], { kind: "attachment", forComponent: "lock-rod-left-outer", contactType: "overlap" });
    addSocket("rod-brackets-right-inner", nodes["door-leaf-right"], [0.045, -1.2325, -0.2395], { kind: "attachment", forComponent: "lock-rod-right-inner", contactType: "overlap" });
    addSocket("rod-brackets-right-outer", nodes["door-leaf-right"], [0.045, -1.2325, 0.3105], { kind: "attachment", forComponent: "lock-rod-right-outer", contactType: "overlap" });
    for (const side of ["left", "right"]) {
      const g = nodes[`cam-keeper-set-${side}`];
      if (g) {
        const b = worldBoxOf(g);
        const cc = b.getCenter(new THREE.Vector3);
        const lp = nodes[`door-leaf-${side}`].worldToLocal(cc.clone());
        addSocket(`rod-ends-${side}`, nodes[`door-leaf-${side}`], arr3(lp), { kind: "mount", forComponent: "cam-keeper-set", specSocket: "rod-ends", side });
      }
    }
    for (const side of ["left", "right"]) {
      const g = nodes[`handle-set-${side}`];
      if (g) {
        const b = worldBoxOf(g);
        const cc = b.getCenter(new THREE.Vector3);
        const lp = nodes[`door-leaf-${side}`].worldToLocal(cc.clone());
        addSocket(`rod-lower-third-${side}`, nodes[`door-leaf-${side}`], arr3(lp), { kind: "mount", forComponent: "handle-set", specSocket: "rod-lower-third", side });
      }
    }
    const destruction = [];
    {
      const ids = ["door-pivot-left"];
      const ns = [];
      for (const id of ids) {
        const n = nodes[id] ?? doorPivots[id.replace("door-pivot-", "")] ?? null;
        if (n)
          ns.push(n);
      }
      destructionGroups["door-leaf-left-assembly"] = ns;
      destruction.push({
        id: "door-leaf-left-assembly",
        nodes: ids,
        seam: "hinge-axis-left",
        detachable: true,
        breakable: false,
        rationale: "Hoja izquierda completa con su herraje: se desprende del marco por el pasador."
      });
    }
    {
      const ids = ["door-pivot-right"];
      const ns = [];
      for (const id of ids) {
        const n = nodes[id] ?? doorPivots[id.replace("door-pivot-", "")] ?? null;
        if (n)
          ns.push(n);
      }
      destructionGroups["door-leaf-right-assembly"] = ns;
      destruction.push({
        id: "door-leaf-right-assembly",
        nodes: ids,
        seam: "hinge-axis-right",
        detachable: true,
        breakable: false,
        rationale: "Hoja derecha completa con su herraje: se desprende del marco por el pasador."
      });
    }
    {
      const ids = ["door-header", "door-sill"];
      const ns = [];
      for (const id of ids) {
        const n = nodes[id] ?? doorPivots[id.replace("door-pivot-", "")] ?? null;
        if (n)
          ns.push(n);
      }
      destructionGroups["door-frame"] = ns;
      destruction.push({
        id: "door-frame",
        nodes: ids,
        seam: "door-frame-welds",
        detachable: true,
        breakable: false,
        rationale: "Header y sill del testero de puertas: cordon de soldadura contra los postes."
      });
    }
    {
      const ids = ["side-wall-right", "top-side-rail-right", "bottom-side-rail-right"];
      const ns = [];
      for (const id of ids) {
        const n = nodes[id] ?? doorPivots[id.replace("door-pivot-", "")] ?? null;
        if (n)
          ns.push(n);
      }
      destructionGroups["shell-side-right"] = ns;
      destruction.push({
        id: "shell-side-right",
        nodes: ids,
        seam: "side-panel-seam",
        detachable: true,
        breakable: false,
        rationale: "Panel lateral derecho con sus rails: costura de panel."
      });
    }
    {
      const ids = ["side-wall-left", "top-side-rail-left", "bottom-side-rail-left"];
      const ns = [];
      for (const id of ids) {
        const n = nodes[id] ?? doorPivots[id.replace("door-pivot-", "")] ?? null;
        if (n)
          ns.push(n);
      }
      destructionGroups["shell-side-left"] = ns;
      destruction.push({
        id: "shell-side-left",
        nodes: ids,
        seam: "side-panel-seam",
        detachable: true,
        breakable: false,
        rationale: "Panel lateral izquierdo con sus rails: costura de panel."
      });
    }
    {
      const ids = ["front-wall"];
      const ns = [];
      for (const id of ids) {
        const n = nodes[id] ?? doorPivots[id.replace("door-pivot-", "")] ?? null;
        if (n)
          ns.push(n);
      }
      destructionGroups["shell-front"] = ns;
      destruction.push({
        id: "shell-front",
        nodes: ids,
        seam: "front-panel-seam",
        detachable: true,
        breakable: false,
        rationale: "Testero ciego."
      });
    }
    {
      const ids = ["roof-panel"];
      const ns = [];
      for (const id of ids) {
        const n = nodes[id] ?? doorPivots[id.replace("door-pivot-", "")] ?? null;
        if (n)
          ns.push(n);
      }
      destructionGroups["shell-roof"] = ns;
      destruction.push({
        id: "shell-roof",
        nodes: ids,
        seam: "roof-perimeter-weld",
        detachable: true,
        breakable: false,
        rationale: "Techo nervado."
      });
    }
    {
      const ids = ["underframe"];
      const ns = [];
      for (const id of ids) {
        const n = nodes[id] ?? doorPivots[id.replace("door-pivot-", "")] ?? null;
        if (n)
          ns.push(n);
      }
      destructionGroups["shell-underframe"] = ns;
      destruction.push({
        id: "shell-underframe",
        nodes: ids,
        seam: "underframe-weld",
        detachable: true,
        breakable: false,
        rationale: "Bastidor inferior con travesanios."
      });
    }
    {
      const ids = ["corner-post-front-left", "corner-post-front-right", "corner-post-rear-left", "corner-post-rear-right"];
      const ns = [];
      for (const id of ids) {
        const n = nodes[id] ?? doorPivots[id.replace("door-pivot-", "")] ?? null;
        if (n)
          ns.push(n);
      }
      destructionGroups["corner-frame"] = ns;
      destruction.push({
        id: "corner-frame",
        nodes: ids,
        seam: "post-castings-weld",
        detachable: true,
        breakable: false,
        rationale: "Los 4 postes esquineros: ultima estructura en ceder."
      });
    }
    const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
    const setDoorAngle = (side, deg) => {
      const d = clamp(Number(deg) || 0, 0, 270);
      doorAngles[side] = d;
      doorPivots[side].rotation.y = OPEN_SIGN[side] * d * Math.PI / 180;
      root.updateMatrixWorld(true);
      return d;
    };
    let explodeAmount = 0;
    const setExplode = (amount) => {
      const e = clamp(Number(amount) || 0, 0, 1);
      explodeAmount = e;
      root.updateMatrixWorld(true);
      const q = new THREE.Quaternion;
      const off = new THREE.Vector3;
      for (const p of parts) {
        off.set(p.dir[0], p.dir[1], p.dir[2]);
        const len = off.length() || 1;
        off.multiplyScalar(e * EXPLODE_K + e * EXPLODE_CLEARANCE / len);
        const par = p.node.parent;
        if (par) {
          par.getWorldQuaternion(q);
          q.invert();
          off.applyQuaternion(q);
        }
        p.node.position.set(p.basePos[0] + off.x, p.basePos[1] + off.y, p.basePos[2] + off.z);
      }
      root.updateMatrixWorld(true);
      return e;
    };
    const resolvePart = (o) => {
      for (let n = o;n; n = n.parent) {
        const id = n.userData.__partId;
        if (typeof id === "string")
          return parts.find((p) => p.id === id) ?? null;
      }
      return null;
    };
    const pickables = () => parts.map((p) => p.node);
    const layoutRadius = () => {
      const b = new THREE.Box3;
      for (const p of parts)
        b.union(worldBoxOf(p.node));
      return b.getBoundingSphere(new THREE.Sphere).radius;
    };
    const manifest = () => ({
      model: "ssb-40ft-high-cube-container",
      generatedBy: "harness/sculpt_interaction.py + harness/index.html",
      parts: [
        ...parts.map((p) => ({
          name: p.id,
          kind: "part",
          module: p.destructionGroup ?? "shell",
          node: p.name,
          triangles: p.triangles,
          animationRole: p.actionProfile.animationRole
        })),
        ...containers.filter((c) => !parts.some((p) => p.id === c.id)).map((c) => ({
          name: c.id,
          kind: "container",
          module: "assembly",
          node: c.name,
          triangles: triCount(c.node)
        })),
        ...Object.keys(splitSets).map((setId) => ({
          name: setId,
          kind: "split-set",
          module: "door-hardware",
          node: splitSets[setId].join("+"),
          nodes: splitSets[setId],
          triangles: splitSets[setId].reduce((t, n) => t + (nodes[n] ? triCount(nodes[n]) : 0), 0),
          note: "un componente del spec, dos conjuntos fisicos: cada mitad rota con su hoja"
        }))
      ],
      unnamedMeshes,
      integralMeshes,
      splitSets,
      asserts
    });
    RT.rigType = "action-ready-static-rig";
    RT.rootMotionNode = root;
    RT.parts = parts;
    RT.containers = containers;
    RT.splitSets = splitSets;
    RT.doorPivots = doorPivots;
    RT.doorAngles = doorAngles;
    RT.setDoorAngle = setDoorAngle;
    RT.getDoorAngle = (side) => doorAngles[side];
    RT.setExplode = setExplode;
    RT.getExplode = () => explodeAmount;
    RT.resolvePart = resolvePart;
    RT.pickables = pickables;
    RT.layoutRadius = layoutRadius;
    RT.manifest = manifest;
    RT.anchors = {
      sockets,
      hingeAxis: { left: [PIN.x, 0, -PIN.z], right: [PIN.x, 0, PIN.z] },
      modelCenter: [MODEL_CENTER.x, MODEL_CENTER.y, MODEL_CENTER.z]
    };
    RT.destruction = { policy: { defaultBreakable: false, fractureGroupNaming: "Use stable semantic names such as body-shell, left-hinge, glass-panel, branch-segment.", debrisStrategy: "Prefer detachable component groups and a small number of procedural fragments over random mesh explosion." }, groups: destruction };
    RT.explodeModel = {
      mode: "layout-scale-about-center",
      k: EXPLODE_K,
      clearance: EXPLODE_CLEARANCE,
      center: [MODEL_CENTER.x, MODEL_CENTER.y, MODEL_CENTER.z],
      note: "escala la distancia de cada parte al centro; NO es una traslacion uniforme"
    };
    notes.push("cam-keeper: leva y keeper estan fusionados en una sola geometria desde form-refinement; al viajar con la hoja el keeper (que fisicamente va soldado al header/sill) viaja de mas.");
    notes.push("hinge-set viaja con la hoja: el barril es concentrico con el pivot, asi que el pasador queda invariante y solo gira la pala — comportamiento real de una bisagra de pala.");
    RT.approximationNotes = notes;
    RT.asserts = asserts;
    root.userData.actionReadiness = {
      ...root.userData.actionReadiness ?? {},
      rigType: RT.rigType,
      parts: parts.length,
      containers: containers.length,
      sockets: Object.keys(sockets).length,
      colliders: Object.keys(colliders).length,
      destructionGroups: destruction.length,
      splitSets,
      api: ["setDoorAngle(side, deg)", "setExplode(0..1)", "resolvePart(object3D)", "manifest()"]
    };
  }
  {
    const RTO = root.userData.sculptRuntime;
    const perfAsserts = {};
    const mergeTranslated = (items) => {
      const names = Object.keys(items[0].geo.attributes).sort();
      let vtxTotal = 0;
      let idxTotal = 0;
      for (const it of items) {
        vtxTotal += it.geo.attributes.position.count;
        idxTotal += it.geo.index.count;
      }
      const out = new THREE.BufferGeometry;
      for (const name of names) {
        const itemSize = items[0].geo.attributes[name].itemSize;
        const arr = new Float32Array(vtxTotal * itemSize);
        const isPos = name === "position";
        let w = 0;
        for (const it of items) {
          const src = it.geo.attributes[name];
          for (let i = 0;i < src.count; i += 1) {
            for (let k = 0;k < itemSize; k += 1)
              arr[w + k] = src.array[i * itemSize + k];
            if (isPos) {
              arr[w] += it.off.x;
              arr[w + 1] += it.off.y;
              arr[w + 2] += it.off.z;
            }
            w += itemSize;
          }
        }
        out.setAttribute(name, new THREE.BufferAttribute(arr, itemSize));
      }
      const idx = vtxTotal > 65535 ? new Uint32Array(idxTotal) : new Uint16Array(idxTotal);
      let io = 0;
      let vo = 0;
      for (const it of items) {
        const src = it.geo.index;
        for (let i = 0;i < src.count; i += 1)
          idx[io + i] = src.array[i] + vo;
        io += src.count;
        vo += it.geo.attributes.position.count;
      }
      out.setIndex(new THREE.BufferAttribute(idx, 1));
      out.computeBoundingBox();
      out.computeBoundingSphere();
      return out;
    };
    const EPS_ROT = 0.000001;
    const EPS_SCALE = 0.000001;
    const mergeLog = [];
    const partNodes = (RTO.parts ?? []).map((p) => p.node);
    for (const node of partNodes) {
      const byMat = new Map;
      for (const child of node.children) {
        const m = child;
        if (!m.isMesh || m.isInstancedMesh)
          continue;
        if (!m.visible)
          continue;
        if (Array.isArray(m.material))
          continue;
        const mat = m.material;
        if (!mat || mat.transparent)
          continue;
        if (m.userData.explodeWithParent !== true)
          continue;
        if (!m.geometry || !m.geometry.index)
          continue;
        if (Math.abs(m.rotation.x) > EPS_ROT || Math.abs(m.rotation.y) > EPS_ROT || Math.abs(m.rotation.z) > EPS_ROT)
          continue;
        if (Math.abs(m.scale.x - 1) > EPS_SCALE || Math.abs(m.scale.y - 1) > EPS_SCALE || Math.abs(m.scale.z - 1) > EPS_SCALE)
          continue;
        const key = mat.uuid;
        if (!byMat.has(key))
          byMat.set(key, []);
        byMat.get(key).push(m);
      }
      for (const [matUuid, group] of byMat) {
        if (group.length < 2)
          continue;
        group.sort((x, y) => x.name < y.name ? -1 : x.name > y.name ? 1 : 0);
        const sig = Object.keys(group[0].geometry.attributes).sort().join(",");
        if (!group.every((m) => Object.keys(m.geometry.attributes).sort().join(",") === sig))
          continue;
        const merged = mergeTranslated(group.map((m) => ({ geo: m.geometry, off: m.position.clone() })));
        const host = new THREE.Mesh(merged, group[0].material);
        host.name = `${node.name}-merged-static`;
        host.castShadow = group[0].castShadow;
        host.receiveShadow = group[0].receiveShadow;
        host.renderOrder = group[0].renderOrder;
        host.frustumCulled = true;
        host.userData.explodeWithParent = true;
        host.userData.mergedFrom = group.map((m) => m.name);
        host.userData.mergedBy = "optimization-pass";
        host.userData.partIdHint = node.userData.__partId ?? node.name;
        for (const m of group)
          node.remove(m);
        node.add(host);
        mergeLog.push({
          part: node.userData.__partId ?? node.name,
          material: matUuid,
          from: host.userData.mergedFrom,
          into: host.name,
          drawCallsSaved: group.length - 1,
          triangles: merged.index.count / 3
        });
      }
    }
    root.updateMatrixWorld(true);
    perfAsserts.mergedGroups = mergeLog.length;
    perfAsserts.drawCallsSavedByMerge = mergeLog.reduce((s, m) => s + m.drawCallsSaved, 0);
    {
      let bad = 0;
      for (const m of mergeLog) {
        const host = root.getObjectByName(m.into);
        const resolved = host ? RTO.resolvePart(host) : null;
        if (!resolved || resolved.id !== m.part)
          bad += 1;
      }
      perfAsserts.mergedResolveMismatch = bad;
      if (bad > 0)
        throw new Error(`optimization-pass: ${bad} mesh(es) fusionado(s) no resuelven a su parte`);
    }
    let frustumOff = 0;
    let instanced = 0;
    let instancedMissingBounds = 0;
    let meshCount = 0;
    let triangles = 0;
    const anisos = new Set;
    const texSeen = new Set;
    const texInventory = [];
    const MAP_SLOTS = [
      "map",
      "normalMap",
      "roughnessMap",
      "metalnessMap",
      "aoMap",
      "bumpMap",
      "displacementMap",
      "emissiveMap",
      "alphaMap",
      "lightMap",
      "clearcoatMap",
      "clearcoatNormalMap",
      "clearcoatRoughnessMap",
      "sheenColorMap",
      "specularIntensityMap"
    ];
    root.traverse((o) => {
      const m = o;
      if (!m.isMesh)
        return;
      meshCount += 1;
      if (!o.frustumCulled)
        frustumOff += 1;
      const im = o;
      const count = im.isInstancedMesh ? im.count : 1;
      if (im.isInstancedMesh) {
        instanced += 1;
        if (!im.boundingSphere || !im.boundingBox)
          instancedMissingBounds += 1;
      }
      const g = m.geometry;
      if (g && o.visible) {
        const n = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0;
        triangles += Math.floor(n / 3) * count;
      }
      for (const mat of [].concat(m.material)) {
        if (!mat)
          continue;
        for (const slot of MAP_SLOTS) {
          const t = mat[slot];
          if (!t || !t.isTexture || texSeen.has(t.uuid))
            continue;
          texSeen.add(t.uuid);
          anisos.add(t.anisotropy);
          texInventory.push({
            slot,
            texture: t,
            width: null,
            height: null,
            bytesLevel0: null,
            mipmaps: t.generateMipmaps,
            anisotropy: t.anisotropy,
            colorSpace: t.colorSpace
          });
        }
      }
    });
    perfAsserts.frustumCulledDisabled = frustumOff;
    perfAsserts.instancedMeshes = instanced;
    perfAsserts.instancedMissingExplicitBounds = instancedMissingBounds;
    if (frustumOff > 0)
      throw new Error(`optimization-pass: ${frustumOff} objeto(s) con frustumCulled=false`);
    if (instancedMissingBounds > 0)
      throw new Error(`optimization-pass: ${instancedMissingBounds} InstancedMesh sin bounds explicitas`);
    perfAsserts.meshes = meshCount;
    perfAsserts.trianglesVisible = triangles;
    perfAsserts.textureAnisotropyValues = [...anisos].sort((x, y) => x - y);
    const refreshTextureInventory = () => {
      let bytes = 0;
      let bytesMips = 0;
      let maxSide = 0;
      let pending = 0;
      for (const rec of texInventory) {
        const img = rec.texture.image;
        const w = img ? img.width ?? img.naturalWidth ?? 0 : 0;
        const h = img ? img.height ?? img.naturalHeight ?? 0 : 0;
        if (!(w > 0 && h > 0)) {
          pending += 1;
          continue;
        }
        rec.width = w;
        rec.height = h;
        rec.bytesLevel0 = w * h * 4;
        bytes += rec.bytesLevel0;
        bytesMips += Math.round(rec.bytesLevel0 * (rec.mipmaps ? 4 / 3 : 1));
        maxSide = Math.max(maxSide, w, h);
      }
      const out = {
        uniqueTextures: texInventory.length,
        pendingLoad: pending,
        textureBytesLevel0: bytes,
        textureMiBLevel0: +(bytes / 1048576).toFixed(3),
        textureBytesWithMipmaps: bytesMips,
        textureMiBWithMipmaps: +(bytesMips / 1048576).toFixed(3),
        maxTextureSide: maxSide
      };
      Object.assign(RTO.performance.runtime, out);
      return out;
    };
    RTO.performance = {
      pass: "optimization-pass",
      runtime: {
        meshes: meshCount,
        instancedMeshes: instanced,
        trianglesVisible: triangles,
        uniqueTextures: texInventory.length,
        pendingLoad: texInventory.length,
        textureBytesLevel0: null,
        textureMiBLevel0: null,
        textureBytesWithMipmaps: null,
        textureMiBWithMipmaps: null,
        maxTextureSide: null,
        textures: texInventory,
        note: "ancho/alto/bytes se llenan llamando sculptRuntime.performance.refreshTextureInventory() DESPUES de que el LoadingManager termino; antes de eso son null a proposito."
      },
      refreshTextureInventory,
      measured: { environment: { caveat: "El browser headless corre sobre SwiftShader (rasterizador POR SOFTWARE), no sobre una GPU. Los milisegundos por frame NO son un proxy de hardware y NO estan capeados a vsync: estan limitados por fill rate de CPU. De este entorno NO se puede sacar un numero de FPS de hardware; lo que si es valido y hardware-independiente son los conteos de draw calls / triangulos / programas / texturas, que son los que el presupuesto del spec mide.", devicePixelRatio: 1, drawingBuffer: [1760, 960], gpu: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)", maxAnisotropy: 16, maxTextureSize: 8192, softwareRasterizer: true, vendor: "Google Inc. (Google)", vsyncCapped: false, webgl: "WebGL 2.0 (OpenGL ES 3.0 Chromium)" }, fillRateModel: { fixedCostMsPerFrame: 70.5, interpretation: "A resolucion plena (1.69 MPx) el frame se parte en ~70 ms de costo fijo (scene graph + vertex + setup, software) y ~567 ms de rasterizado (89% del frame). O sea el cuello es fill rate de CPU, no la geometria ni los draw calls del modelo.", perPixelUs: 0.3358, samples: [{ avgMs: 637.75, frames: 2, px: 1689600, res: "1760x960", usPerPx: 0.3775 }, { avgMs: 288.22, frames: 5, px: 422400, res: "880x480", usPerPx: 0.6823 }, { avgMs: 139.47, frames: 10, px: 105600, res: "440x240", usPerPx: 1.3207 }, { avgMs: 79.32, frames: 18, px: 26400, res: "220x120", usPerPx: 3.0045 }] }, frameTimes: { fixedViewPresentMsAvg: 632.375, fixedViewPresentMsP95: 636.8, jsSubmitMsAvgFixed: 1.975, jsSubmitMsAvgOrbit: 1.62, jsSubmitNote: "`jsSubmit*` es solo el tiempo de `renderer.render()` en JS (encolar comandos), sin gl.finish(): NO incluye el trabajo del rasterizador. Se reporta porque es la unica parte del frame que se traslada tal cual a una GPU real: ~2 ms de CPU por frame.", note: "Validos SOLO como caracterizacion del rasterizador por software. Ver environment.caveat.", orbitDegPerSec: 60, orbitViewPresentMsAvg: 528.58, orbitViewPresentMsP95: 577 }, harness: "harness/measure_perf.js sobre http://127.0.0.1:8378/harness/index.html (vista match az=50 el=2.5 dist=9.2 roll=-4)", measuredAt: "optimization-pass", pixelDiffVsPass7: { bbox: [1617, 561, 1618, 562], candidate: "passes/optimization-pass/render.webp", differingPixels: 1, maxChannelDelta: 3, percent: 0.000059, reference: "passes/interaction-pass/render.webp", size: [1760, 960], totalPixels: 1689600, verdict: "Equivalente. 1 pixel de 1.69 M con delta 3/255 en el borde del herraje de puerta fusionado: es el ultimo ulp de float32 al pasar la traslacion del modelMatrix a la posicion del vertice. No hay cambio de forma, color ni sombreado." }, rendererInfo: { after: { drawCalls: 42, geometries: 31, programs: 5, texturesOnGpu: 27, triangles: 13416 }, before: { drawCalls: 51, geometries: 40, programs: 5, texturesOnGpu: 27, triangles: 13416 }, delta: { drawCalls: -9, geometries: -9, triangles: 0 }, note: "`triangles` es lo dibujado en el frame de la camara match (post frustum culling). El modelo declara 13412 triangulos visibles medidos por traversal en sculptRuntime.performance.runtime.trianglesVisible; la diferencia de +4 contra renderer.info son el plano de sombra de contacto (2 tris, vive en la escena y no en el modelo) y el redondeo de indices por objeto." }, textures: { bytesLevel0: 140473600, countsNote: "Tres numeros distintos y los tres correctos: 41 = imagenes que pasaron por el LoadingManager (TEXTURES_ASSERT del harness); 31 = objetos THREE.Texture unicos alcanzables desde materiales + environment; 27 = texturas subidas a GPU al momento de medir (las no subidas pertenecen a materiales aun no rasterizados en esa vista).", loadedImagesAssert: 41, maxSide: 4096, miBLevel0: 133.966, miBWithMipmaps: 178.406, onGpuAtMeasure: 27, over2048: [{ h: 922, w: 4096, where: "paint-body-navy+ssb-decal-right.map" }, { h: 922, w: 4096, where: "paint-body-navy+ssb-decal-left.map" }], top: [{ h: 922, miB: 14.406, w: 4096, where: "paint-body-navy+ssb-decal-right.map" }, { h: 922, miB: 14.406, w: 4096, where: "paint-body-navy+ssb-decal-left.map" }, { h: 1024, miB: 4, w: 1024, where: "7aa1ac03-6842-4498-844d-cfb1a19905cd.map" }, { h: 1024, miB: 4, w: 1024, where: "7aa1ac03-6842-4498-844d-cfb1a19905cd.normalMap" }, { h: 1024, miB: 4, w: 1024, where: "7aa1ac03-6842-4498-844d-cfb1a19905cd.roughnessMap" }, { h: 1024, miB: 4, w: 1024, where: "7aa1ac03-6842-4498-844d-cfb1a19905cd.aoMap" }], uniqueReachable: 31 } },
      budget: { fpsTarget: 60, maxDrawCalls: 60, optimizationPolicy: "Pantalla de apertura del CRM: 60fps desktop y touch fluido. Instancing para castings/bisagras/levas/brackets; perfil extruido monolitico por panel corrugado; merge de estaticos que no rompa part-picking.", qualityPriority: "reference-fidelity", targetTriangles: 180000, textureSize: 2048 },
      fpsTarget: 60,
      merges: mergeLog,
      lodPlan: [{ tier: "LOD0", minDistanceM: 0, maxDistanceM: 25, content: "arbol de componentes completo + todas las capas de material", estimatedTriangles: null, estimatedDrawCalls: null, rationale: "vista de producto y de inspeccion: es la pasada 1-7 tal cual, sin degradar." }, { tier: "LOD1", minDistanceM: 25, maxDistanceM: 60, content: "sin herraje fino: se ocultan hinge-set-*, cam-keeper-set-*, rod-guide-brackets-*, handle-set-*, gasket-frames-* y los lock rods. Se conservan corrugado, esquineros ISO 1161, rails y todas las marcas.", estimatedTriangles: null, estimatedDrawCalls: null, rationale: "a >25 m el barril de bisagra (0.11 m) mide <4 px: cuesta draw calls sin aportar silueta. Los esquineros SI se conservan porque definen la esquina del contenedor a cualquier distancia.", implementationHint: "no requiere geometria nueva: es `visible = false` sobre los nodos de parte listados, reversible y compatible con el part-picking (una parte invisible simplemente no se puede clickear)." }, { tier: "LOD2", minDistanceM: 60, maxDistanceM: null, content: "caja + decal: un box de 12.192 x 2.896 x 2.438 con los composites laterales ya horneados como map, sin corrugado ni herraje.", estimatedTriangles: 12, estimatedDrawCalls: 1, rationale: "a >60 m el corrugado (paso 0.283 m) cae bajo 1 px y el mipmap del composite ya lo resuelve mejor que la geometria. Las marcas siguen legibles porque viven en la textura, no en la malla.", implementationHint: "requiere construir la caja (geometria nueva) y un THREE.LOD como padre. NO implementado: ver `lodDecision`." }],
      lodDecision: "NO IMPLEMENTADO a proposito. El modelo mide 13.4k triangulos contra un presupuesto de 180k (7.5%) y 42 draw calls contra 60 (70%): no hay problema de performance que un LOD resuelva hoy, y un THREE.LOD introduce popping y una segunda copia de la geometria que habria que mantener sincronizada con las 7 pasadas de fidelidad. Se implementa cuando la escena del CRM ponga N contenedores a la vez: el disparador concreto es N x 42 draw calls acercandose al presupuesto, o sea N >= 2 ya obliga a revisar. LOD1 es la primera palanca porque no necesita geometria nueva.",
      availableNotApplied: [{ id: "instance-corner-castings", saves: "7 draw calls (8 meshes -> 1 InstancedMesh de 8 instancias)", costTriangles: 0, reason: 'ROMPE EL PART-PICKING. Los 8 esquineros ISO 1161 son 8 partes clickeables independientes desde interaction-pass (`explodeWithParent = false`). `RT.resolvePart()` resuelve objeto -> parte subiendo por el arbol; con un InstancedMesh los 8 esquineros pasan a ser UN objeto y la parte solo se puede distinguir por `intersection.instanceId`. Eso obliga a cambiar el contrato de picking (resolvePart tendria que aceptar un instanceId) y a reescribir el explode, que hoy mueve cada esquinero por separado. El spec autoriza instancing de castings, pero autoriza tambien "merge de estaticos QUE NO ROMPA part-picking": la segunda clausula manda.', blockedBy: "part-picking contract + per-casting explode" }, { id: "drop-bumpmap-where-normalmap-exists", saves: "~19.2 MiB de VRAM (4 bumpMaps de 1024x1024 con mipmaps) y 1 fetch de textura por fragmento en 4 materiales", reason: "CAMBIA EL SOMBREADO. Los 4 materiales PBR llevan normalMap Y bumpMap a la vez; Three.js aplica los dos y el relieve se suma. Sacar el bumpMap es la optimizacion de textura mas grande disponible, pero mueve pixeles: el micro-relieve de la pintura y de los valles del corrugado cambia de intensidad. Es una decision de look-dev, no de performance, y las pasadas 4/5/6 ya firmaron ese sombreado (material 0.82, surface 0.84, lighting 0.85). Requiere re-review visual de esas tres pasadas.", blockedBy: "look-dev sign-off (pasadas 4/5/6)" }, { id: "halve-pbr-detail-sets", saves: "~72 MiB de VRAM (24 mapas de 1024x1024 -> 512x512)", reason: "CAMBIA EL SOMBREADO. Los sets de detalle PBR (map/normal/roughness/ao/bump a 1024x1024 en 4 materiales + la placa CSC) son 96 MiB de los 134 MiB totales: el 72% del costo de textura. A 512x512 el grano de pintura y el ruido de roughness pierden frecuencia. Mismo bloqueo que el anterior: es look-dev.", blockedBy: "look-dev sign-off (pasadas 4/5/6)" }, { id: "downscale-side-composites-to-2048", saves: "~19.2 MiB de VRAM (2 composites de 4096x922 -> 2048x461)", reason: "DESTRUYE LA LEGIBILIDAD DE LAS MARCAS — ver `textureSizeTradeoff`. Es la unica optimizacion que tocaria el punto en tension con el presupuesto, y es justamente la que no hay que hacer a ciegas.", blockedBy: "legibilidad ISO 6346 (feature critica fictitious-markings 0.92)" }, { id: "lod1-hide-fine-hardware", saves: "10 draw calls y ~2.5k triangulos a >25 m", reason: "NO HACE FALTA. Ver `lodDecision`: 42/60 draw calls y 13.4k/180k triangulos. Se activa cuando el CRM ponga mas de un contenedor en escena.", blockedBy: "sin disparador de presupuesto" }, { id: "merge-across-parts", saves: "hasta 30 draw calls mas (todo el bastidor + rails en una sola geometria)", reason: 'ROMPE EL PART-PICKING Y EL EXPLODE. Es exactamente lo que la optimizationPolicy del spec prohibe ("merge de estaticos QUE NO ROMPA part-picking"). Fusionar largueros, rails y paneles cruzando partes deja 40 partes -> ~10 y hace inclickeable la mayoria del modelo, que es el entregable central del CRM.', blockedBy: "optimizationPolicy del spec (clausula explicita)" }],
      textureSizeTradeoff: { budgetField: "performanceBudget.textureSize = 2048", actual: "4096x922 en los 2 composites laterales (paint-body-navy+ssb-decal-left/right)", violatesIfReadAs: "lado maximo (4096 > 2048)", compliesIfReadAs: "presupuesto de texels: 4096x922 = 3,776,512 px contra 2048x2048 = 4,194,304 px. El composite usa el 90.0% de los texels de una cuadrada de 2048, y ocupa MENOS memoria: 14.41 MiB contra 16.00 MiB.", whyNotSquare: "la pared mide 12.192 x 2.896 m (aspect 4.21). Una textura cuadrada sobre una pared de aspect 4.21 desperdicia el 76% de los texels en estiramiento vertical. El composite sigue el aspect de la pared.", legibilityNumbers: { markingCapHeightM: 0.085, pxPerMeterAt4096: 336, pxPerMeterAt2048: 168, capHeightPxAt4096: 28.6, capHeightPxAt2048: 14.3, strokeWidthPxAt4096: 4.43, strokeWidthPxAt2048: 2.21, verdict: "a 2048 el trazo del stencil cae a 2.21 px. Por debajo de ~3 px un trazo de stencil con mipmap + anisotropia se funde con el fondo navy en cuanto la pared se ve en escorzo (que es la vista match: az 50 grados), y los contra-formas de los glifos ISO 6346 se cierran. La feature critica fictitious-markings puntuo 0.92 con 4.43 px de trazo." }, decision: 'NO SE BAJA. Se reporta la tension para review del principal. Si la lectura canonica del presupuesto es "lado maximo 2048", el spec y la feature critica fictitious-markings estan en conflicto directo y lo tiene que resolver el principal: o se sube textureSize a 4096 en el spec, o se acepta perder legibilidad de marcas. Contexto de hardware: WebGL2 garantiza MAX_TEXTURE_SIZE >= 2048, pero el minimo real del parque desktop/movil actual es 4096 y el harness mide 8192 incluso sobre SwiftShader.', alternativeIfForcedTo2048: "partir el composite en 2 mitades de 2048x922 (proa/popa) con 2 materiales: conserva los 336 px/m EXACTOS y respeta el lado maximo de 2048, al costo de +1 draw call por pared (+2 total, 42 -> 44) y de una costura en el medio de la pared que hay que hacer caer en un valle del corrugado. Es la salida sin perdida de legibilidad si el presupuesto se lee como lado maximo." },
      asserts: perfAsserts
    };
    root.userData.actionReadiness = {
      ...root.userData.actionReadiness ?? {},
      optimization: {
        mergedGroups: mergeLog.length,
        drawCallsSavedByMerge: perfAsserts.drawCallsSavedByMerge,
        trianglesVisible: triangles,
        lodImplemented: false
      }
    };
  }
  return root;
}
var SSB40FT_HIGH_CUBE_CONTAINER_RIG = {
  reference: { hemi: 3.56, key: 5.18, fill: 1.62, keyPos: [-10, 8, 4], fillPos: [10, 4, -6], env: 0.25 },
  neutral: { hemi: 5.18, key: 3.1, fill: 1.87, keyPos: [-6, 10, 8], fillPos: [8, 5, -6], env: 0.37 },
  grazing: { hemi: 0.65, key: 7.92, fill: 0.25, keyPos: [-12, 1.7, 3], fillPos: [9, 2, -5], env: 0.06 }
};
function createSSB40ftHighCubeContainerLookDevLights(mode = "neutral") {
  const rig = SSB40FT_HIGH_CUBE_CONTAINER_RIG[mode] ?? SSB40FT_HIGH_CUBE_CONTAINER_RIG.neutral;
  const lights = new THREE.Group;
  lights.name = "SSB 40ft High Cube Container look-dev lights";
  const fillAmbient = new THREE.HemisphereLight(16054008, 13225170, rig.hemi);
  fillAmbient.name = "fill-hemisphere";
  lights.add(fillAmbient);
  const key = new THREE.DirectionalLight(16777215, rig.key);
  key.name = "key";
  key.position.set(rig.keyPos[0], rig.keyPos[1], rig.keyPos[2]);
  key.castShadow = false;
  lights.add(key);
  const fill = new THREE.DirectionalLight(16054008, rig.fill);
  fill.name = "fill";
  fill.position.set(rig.fillPos[0], rig.fillPos[1], rig.fillPos[2]);
  lights.add(fill);
  lights.userData.reviewMode = mode;
  lights.userData.environmentIntensity = rig.env;
  lights.userData.toneMappingExposure = 1;
  lights.userData.background = "#FFFFFF";
  lights.userData.lightingFromPhoto = [{ type: "key", direction: "superior-izquierda suave (estudio)", color: "#FFFFFF", intensity: "media-alta, difusa" }, { type: "fill", direction: "ambiente envolvente alto", color: "#F4F6F8", intensity: "alta (high-key, casi sin sombra)" }, { type: "environment", direction: "uniforme", color: "#FFFFFF", intensity: "studio product-shot; sombra de contacto casi nula en la ref — la escena de apertura usara sombra de contacto suave para asentar el objeto" }, { type: "render-intent", direction: "n/a", color: "#FFFFFF", intensity: "exposure 1.0, ACESFilmic tone mapping; contact shadow suave bajo el contenedor (ground shadow con blur, opacidad ~0.35) + ambient occlusion en valles y rebajes — la escena de apertura asienta el objeto aunque la ref sea casi shadowless" }];
  lights.userData.lookDevTargets = { qualityPriority: "reference-fidelity", materialPass: { albedoPaletteRequired: true, roughnessVariationRequired: true, normalOrBumpRequired: true, localOverridesRequired: true, minimumTextureResolution: 1024, preferredTextureResolution: 2048, independentMapChannels: ["albedo", "roughness", "height", "normal", "ambient-occlusion"], requiredSurfaceFrequencyBands: ["macro", "meso", "micro"], geometryReliefRequiredWhenSilhouetteAffected: true, referencePbrExtraction: { requiredWhenSourceImagePresent: true, targetThreshold: 0.7, stopOnLowConfidence: true, script: "forge/stage1_intake/extract_pbr_evidence.py", acceptedLimitation: "single-image extraction is reference-derived inference, not exact photogrammetry" }, mustAvoid: ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"] }, lightingPass: { requiredTerms: ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], mustAvoid: ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"] }, screenshotReview: ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."] };
  return lights;
}
function createSSB40ftHighCubeContainerEnvironment(renderer, options = {}) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  if (options.room) {
    const texture2 = pmrem.fromScene(new RoomEnvironment, 0.04).texture;
    pmrem.dispose();
    return texture2;
  }
  const W = options.size ?? 256;
  const H = W >> 1;
  const kd = options.keyDirection ?? SSB40FT_HIGH_CUBE_CONTAINER_RIG.reference.keyPos;
  const kl = Math.hypot(kd[0], kd[1], kd[2]) || 1;
  const kx = kd[0] / kl, ky = kd[1] / kl, kz = kd[2] / kl;
  const CEIL = 1;
  const FLOOR = 0.62;
  const BOX_GAIN = 0.55;
  const BOX_COS = Math.cos(52 * Math.PI / 180);
  const data = new Uint16Array(W * H * 4);
  for (let j = 0;j < H; j++) {
    const v = (j + 0.5) / H;
    const y = Math.sin((v - 0.5) * Math.PI);
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const t = (y + 1) * 0.5;
    const sm = t * t * (3 - 2 * t);
    const base = FLOOR + (CEIL - FLOOR) * sm;
    for (let i = 0;i < W; i++) {
      const u = (i + 0.5) / W;
      const a = (u - 0.5) * Math.PI * 2;
      const x = -r * Math.cos(a);
      const z = r * Math.sin(a);
      const c = x * kx + y * ky + z * kz;
      let L = base;
      if (c > BOX_COS) {
        const s = (c - BOX_COS) / (1 - BOX_COS);
        L += BOX_GAIN * s * s * (3 - 2 * s);
      }
      const o = (j * W + i) * 4;
      const h = THREE.DataUtils.toHalfFloat(L);
      data[o] = h;
      data[o + 1] = h;
      data[o + 2] = h;
      data[o + 3] = THREE.DataUtils.toHalfFloat(1);
    }
  }
  const equirect = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  equirect.mapping = THREE.EquirectangularReflectionMapping;
  equirect.minFilter = THREE.LinearFilter;
  equirect.magFilter = THREE.LinearFilter;
  equirect.needsUpdate = true;
  const texture = pmrem.fromEquirectangular(equirect).texture;
  pmrem.dispose();
  equirect.dispose();
  texture.userData.studioEnvironment = {
    ceiling: CEIL,
    floor: FLOOR,
    softbox: BOX_GAIN,
    color: "#FFFFFF"
  };
  return texture;
}
function frameSSB40ftHighCubeContainerCamera(camera, object, options = {}) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty())
    return;
  const size = box.getSize(new THREE.Vector3);
  const center = box.getCenter(new THREE.Vector3);
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = camera.fov * Math.PI / 180;
  const distance = maxDim / 2 / Math.tan(fov / 2);
  const az = (options.azimuthDeg ?? 0) * Math.PI / 180;
  const el = (options.elevationDeg ?? 0) * Math.PI / 180;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}
function createSSB40ftHighCubeContainerPresentationComposer(renderer, scene, camera, options = {}) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2;
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}
function configureSSB40ftHighCubeContainerRenderer(renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMappingExposure = 1;
}
function createSSB40ftHighCubeContainerInspectControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1;
  controls.maxDistance = 8;
  controls.autoRotate = false;
  return controls;
}
function createSSB40ftHighCubeContainerContactShadow(options = {}) {
  const opacity = options.opacity ?? 0.35;
  const soft = options.softness ?? 0.95;
  const N = options.resolution ?? 512;
  const inset = 0.1;
  const margin = 1.05;
  const halfX = 12.192 / 2 - inset;
  const halfZ = 2.438 / 2 - inset;
  const planeX = 12.192 + margin * 2;
  const planeZ = 2.438 + margin * 2;
  const M = Math.max(8, Math.round(N * planeZ / planeX));
  const data = new Uint8Array(N * M * 4);
  for (let j = 0;j < M; j++) {
    const wz = ((j + 0.5) / M - 0.5) * planeZ;
    const dz = Math.max(0, Math.abs(wz) - halfZ);
    for (let i = 0;i < N; i++) {
      const wx = ((i + 0.5) / N - 0.5) * planeX;
      const dx = Math.max(0, Math.abs(wx) - halfX);
      const d = Math.hypot(dx, dz);
      let a = 1 - d / soft;
      a = a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a);
      const v = Math.round(a * 255);
      const o = (j * N + i) * 4;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
      data[o + 3] = v;
    }
  }
  const tex = new THREE.DataTexture(data, N, M, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeX, planeZ), new THREE.MeshBasicMaterial({
    color: 0,
    transparent: true,
    opacity,
    alphaMap: tex,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide
  }));
  mesh.name = "SSB 40ft High Cube Container contact shadow";
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = options.y ?? -0.002;
  mesh.renderOrder = -1;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  mesh.userData.measurementExempt = true;
  mesh.userData.renderIntent = "contact-shadow";
  return mesh;
}
function applySSB40ftHighCubeContainerLighting(renderer, scene, options = {}) {
  const mode = options.mode ?? "reference";
  configureSSB40ftHighCubeContainerRenderer(renderer);
  const lights = createSSB40ftHighCubeContainerLookDevLights(mode);
  scene.add(lights);
  let environment = null;
  const envIntensity = lights.userData.environmentIntensity;
  if (options.environment !== false) {
    environment = createSSB40ftHighCubeContainerEnvironment(renderer, {
      room: options.roomEnvironment === true,
      keyDirection: SSB40FT_HIGH_CUBE_CONTAINER_RIG[mode].keyPos
    });
    scene.environment = environment;
    scene.environmentIntensity = envIntensity;
  }
  if (options.background !== undefined && options.background !== null) {
    scene.background = options.background instanceof THREE.Color ? options.background : new THREE.Color(options.background);
  }
  let contactShadow = null;
  if (options.contactShadow !== false) {
    contactShadow = createSSB40ftHighCubeContainerContactShadow();
    scene.add(contactShadow);
  }
  return { mode, lights, environment, environmentIntensity: envIntensity, contactShadow };
}
function createContainerModel(options = {}) {
  return createSSB40ftHighCubeContainerModel(options);
}
var applyContainerLighting = applySSB40ftHighCubeContainerLighting;
var configureContainerRenderer = configureSSB40ftHighCubeContainerRenderer;
var createContainerLookDevLights = createSSB40ftHighCubeContainerLookDevLights;
var createContainerEnvironment = createSSB40ftHighCubeContainerEnvironment;
var createContainerContactShadow = createSSB40ftHighCubeContainerContactShadow;
var frameContainerCamera = frameSSB40ftHighCubeContainerCamera;
var createContainerPresentationComposer = createSSB40ftHighCubeContainerPresentationComposer;
var createContainerInspectControls = createSSB40ftHighCubeContainerInspectControls;
var CONTAINER_RIG = SSB40FT_HIGH_CUBE_CONTAINER_RIG;
export {
  frameSSB40ftHighCubeContainerCamera,
  frameContainerCamera,
  createSSB40ftHighCubeContainerPresentationComposer,
  createSSB40ftHighCubeContainerModel,
  createSSB40ftHighCubeContainerLookDevLights,
  createSSB40ftHighCubeContainerInspectControls,
  createSSB40ftHighCubeContainerEnvironment,
  createSSB40ftHighCubeContainerContactShadow,
  createContainerPresentationComposer,
  createContainerModel,
  createContainerLookDevLights,
  createContainerInspectControls,
  createContainerEnvironment,
  createContainerContactShadow,
  configureSSB40ftHighCubeContainerRenderer,
  configureContainerRenderer,
  applySSB40ftHighCubeContainerLighting,
  applyContainerLighting,
  SSB40FT_HIGH_CUBE_CONTAINER_RIG,
  CONTAINER_RIG
};
