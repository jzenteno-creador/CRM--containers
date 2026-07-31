# Monitoreo por cámara en tiempo real para CRM-DETENTION: viabilidad técnica y roadmap

## TL;DR
- **Sí es viable armar el fin de semana una solapa en producción que abra la webcam y detecte objetos en vivo con cajas y etiquetas**, 100% client-side, sin servidor de visión. El camino más rápido y confiable para tu stack Next.js es **MediaPipe Tasks (EfficientDet-Lite0, ~33 FPS con GPU delegate reportado en demos oficiales) o TensorFlow.js + COCO-SSD (~15–25 FPS)**; cualquiera de los dos es la prueba de concepto ideal para el pitch.
- **Leer la sigla del contenedor (ISO 6346) en tiempo real NO es realista para el fin de semana como feature productivo.** Es un problema de dos etapas (detección + OCR) que en calidad de puerto lo resuelven productos comerciales (Vaxtor VaxOCR Container, más del 99% de precisión) o pipelines propios YOLO+PaddleOCR; lo factible en un finde es una demo de OCR sobre imagen fija/recortada usando un modelo de Roboflow Universe, no free-flow sobre video.
- **El despliegue productivo real (Camino B) es una cámara IP fija que manda RTSP a un edge device (NVIDIA Jetson) o mini-PC on-premise** corriendo Roboflow Inference/Ultralytics + Supervision (ByteTrack + line counting para distinguir ingreso vs egreso), que reporta a Supabase vía webhook/REST. Roboflow Supervision es la pieza de tracking/conteo, **NO** de OCR.

## Key Findings

1. **Camino A (browser, client-side) desbloquea el fin de semana.** Hay tres opciones maduras en 2026 que corren en el navegador sobre `getUserMedia`: TensorFlow.js + COCO-SSD, MediaPipe Tasks, y YOLO→ONNX vía onnxruntime-web. Las dos primeras son las más rápidas de integrar (una tarde).
2. **Performance real en laptop común es modesto pero suficiente para PoC.** MediaPipe EfficientDet-Lite0 con GPU delegate reporta menos de 30 ms/frame (~33 FPS) en demos oficiales; COCO-SSD en WebGL ~15–25 FPS; YOLOv8n en WASM puro ~220 ms/frame (~4.5 FPS) en un MacBook M3 Pro (PyImageSearch, jul 2025). WebGPU NO garantiza aceleración: hay casos documentados donde es más lento que WASM.
3. **OCR de contenedor = detección + reconocimiento, dos pasos separados.** Primero un detector localiza la región del código; luego un OCR lee los caracteres. El dígito verificador ISO 6346 permite autovalidar y descartar lecturas erróneas (algoritmo módulo 11).
4. **Existen soluciones comerciales y papers con precisión alta.** Vaxtor VaxOCR Container declara más del 99% de precisión y lectura ISO 6346 con dígito de control. Papers académicos reportan desde 93.7% (localización) hasta 99.76% de localización de región a 56.7 FPS.
5. **Roboflow Supervision es para tracking y conteo de línea/zona, no OCR.** ByteTrack + LineZone permiten contar cruces y determinar dirección (ingreso vs egreso) — clave para el negocio de John.
6. **El caso de negocio encaja perfecto con un dolor real del cliente.** En la reunión del 13-jul-2026 con O. Perez, el punto más doloroso es que "no hay ninguna manera de que la terminal te avise cuándo ingresó" un contenedor — justo lo que una cámara en portón/playa de tren automatizaría.

## Details

### 1. Camino A — Detección de objetos en tiempo real EN EL NAVEGADOR

El patrón común: `navigator.mediaDevices.getUserMedia({video:true})` → `<video>` → loop con `requestAnimationFrame` → modelo → dibujar cajas en un `<canvas>` superpuesto. Todo corre client-side; en Vercel serverless esto es ideal porque no necesitás backend de visión (la inferencia ocurre en la máquina del usuario, con ventaja de privacidad: el video nunca sale del dispositivo).

**(a) TensorFlow.js + COCO-SSD (recomendado para el finde)**
- Madurez: muy alta, es el "hola mundo" de la visión en browser. Paquetes: `@tensorflow/tfjs` + `@tensorflow-models/coco-ssd`.
- Modelo: COCO-SSD detecta 90 clases comunes (persona, auto, camión, etc.). Backbone por defecto `lite_mobilenet_v2` (<1 MB), input 300×300. NMS corre en CPU para evitar el costo de descargar texturas de la GPU.
- Integración Next.js/React: trivial. Hay repos listos con Next.js 14 + Tailwind + `react-webcam`. Se carga el modelo con `cocoSsd.load()` una vez y se llama `model.detect(video)` en loop.
- Performance: ~15–25 FPS end-to-end en laptop común con backend WebGL (nota: la cifra proviene en parte de fuentes de calidad editorial variable, pero es consistente con la experiencia práctica reportada en múltiples repos).
- Client-side: 100% sí. Licencia: Apache 2.0.
- Limitación: solo 90 clases COCO; no detecta "contenedor" como clase propia sin reentrenar. Para el PoC ("detectá cualquier objeto") es perfecto.

**(b) MediaPipe Tasks (object detector) — la mejor performance en browser**
- Madurez: alta, mantenido por Google. Paquete: `@mediapipe/tasks-vision`. Modelo EfficientDet-Lite0/Lite2 o SSD MobileNet V2 (.tflite). EfficientDet-Lite0 usa un backbone EfficientNet-Lite0 con input 320×320 y BiFPN, entrenado en COCO (80 clases); según la documentación de Google AI Edge "strikes a balance between latency and accuracy... both accurate and lightweight enough for many use cases".
- Integración: `ObjectDetector.createFromOptions()` con `delegate:"GPU"`, `runningMode:"VIDEO"`, y `detectForVideo()`. Hay codelab oficial y ejemplos React/Vite+Tailwind copiables.
- Performance: la mejor reportada en browser, menos de 30 ms/frame (~33 FPS) con GPU delegate en las demos oficiales. **Aviso de expectativas:** reportes de campo en Android (issue #432 de google-ai-edge/mediapipe-samples) muestran ~60–90 ms reales en lugar de los ~29 ms anunciados, con poca diferencia GPU vs CPU. Throttling automático: si el detector está ocupado, ignora frames nuevos.
- Client-side: sí. Licencia: Apache 2.0.

**(c) YOLO→ONNX vía onnxruntime-web (WASM/WebGPU)**
- Madurez: creciente pero con fricción. Se exporta YOLOv8n/YOLO11n desde Ultralytics (`model.export(format="onnx", opset=12, dynamic=True)`; opset=12 es obligatorio para WebGPU) y se corre con `onnxruntime-web` + OpenCV.js para preprocesado.
- Hay tutorial completo Next.js (PyImageSearch, jul 2025) y repos con webcam en vivo y selector WebGPU/WASM (nomi30701/yolo-object-detection-onnxruntime-web y su benchmark web, que permiten medir FPS en tu propio hardware).
- Performance: YOLOv8n en WASM ~220 ms/frame (~4.5 FPS) en M3 Pro; WebGPU puede acelerar en Chromium con GPU decente pero es inconsistente (hay un caso documentado en gpuweb Discussion #5292 donde WebGPU es ~14× más lento que WASM por operadores no soportados que hacen fallback a software).
- Licencia: **cuidado** — Ultralytics YOLO es AGPL-3.0 (copyleft fuerte; para uso comercial cerrado requiere licencia paga o abrir el código). RF-DETR de Roboflow es Apache 2.0 y es la alternativa comercial-friendly.
- Cuándo usarlo: cuando necesites detectar "contenedor" como clase custom entrenada. Más setup que (a)/(b); es sobre-ingeniería para un PoC de fin de semana.

**(d) Roboflow browser (inferencejs / roboflow.js)**
- Dos modos: `inferencejs` corre modelos en el browser con TensorFlow.js/WebGL (client-side), o vía WebRTC contra Roboflow Cloud. Requiere publishable key de Roboflow y modelo entrenado/forkeado.
- Útil si querés usar directamente un modelo de Roboflow Universe (ej. "container-ocr") sin exportarlo. La API hosted da ~4 FPS; on-device es más rápido.
- Licencia/costo: freemium con API key; el SDK `inference` es open source.

**(e) Veredicto:** para el objetivo "solapa que abre la webcam y detecta objetos con cajas y etiquetas este fin de semana", **COCO-SSD (más ejemplos Next.js copiables) o MediaPipe (mejor FPS)** son las apuestas ganadoras. onnxruntime-web/YOLO queda para cuando necesites clase custom.

### 2. Lectura de siglas ISO 6346 en tiempo real (la pieza del negocio)

**Por qué son dos pasos.** Detección ≠ OCR. Un detector (YOLO, RF-DETR, etc.) encuentra *dónde* está el contenedor y/o la región del código en el frame. Luego, sobre ese recorte, un motor de OCR lee *qué* dice (los 11 caracteres: 4 letras + 6 dígitos + 1 dígito verificador). Separar los pasos mejora precisión: aislás el texto del ruido de fondo antes de leer. Este es el patrón "detect → crop → read → validate" que usan los pipelines de matrículas y contenedores.

**El dígito verificador ISO 6346 (autovalidación).** El estándar es ISO 6346:2022 (4ª edición, abril 2022), y el registro de owner codes lo gestiona el Bureau International des Containers (BIC) en París. El check digit usa aritmética módulo 11: a cada letra se le asigna un valor (A=10, saltando múltiplos de 11), se multiplica cada carácter por 2^posición, se suma, se toma mod 11 (y si da 10 se usa 0). Ejemplo: MSKU388110 → dígito verificador 7 = MSKU3881107. Como resume la literatura del estándar, permite "detecting common errors such as single-digit substitutions or transpositions by leveraging a modulo-11 arithmetic check". Esto es oro para tu caso: convierte OCR ruidoso en dato confiable. Es ~15 líneas de TypeScript y podés correrlo client-side o en un Edge Function de Supabase.

**Validación por prefijo (owner code).** DA maneja una lista de "prefijos restringidos" (owner codes registrados en BIC) que se actualiza en julio/diciembre — validar el prefijo leído contra esa lista es otra capa de control que ya existe en el flujo manual de O. Perez. Como contexto, registrar un prefijo en BIC cuesta €2.000 iniciales más €475 de renovación anual (Pier2Pier), lo que da idea de por qué el universo de prefijos válidos es acotado y verificable.

**Opciones de OCR de contenedor:**
- **Comerciales (calidad puerto):** Vaxtor VaxOCR Container es el líder. Según la página de MOBOTIX Certified App, "recognizes cargo container codes according to ISO 6346 with an accuracy of over 99%... Recognition time of typically 900 ms/container... detected even when the container or camera is moving at speeds of up to 20km/h" (hasta 50 km/h en plataforma PC según Vaxtor). Reporta el dígito de control, lee códigos horizontales y verticales, modos triggered y free-flow, y corre on-camera en Axis/Mobotix o en PC Windows/Linux; licencia por cámara, pago único. Otras: Nestor TREX-CONTAINER, Docker Vision, Isarsoft, Supplai, Visive. Scanbot SDK es on-device pero orientado a smartphone/barcode (tarifa anual fija, offline).
- **Open source / entrenables:** PaddleOCR (Apache 2.0, muy fuerte en texto rotado/complejo, modelos server y mobile) y EasyOCR. El patrón probado (blog de Zichun Lin) es YOLOv8 para detectar el número + PaddleOCR (ABINet + CPPD en ensemble) para leer, desplegado en Jetson Orin Nano con TensorRT.
- **Roboflow Universe:** hay varios datasets/modelos pre-entrenados de "container OCR" (ej. `container-ocr-byxl7` con mAP@50 87.1%, clases container-number/iso-type/seal, actualizado may-2026; `container-character-codes`; `OCR-License-Plate-Container-ID` entrenado en 24k imágenes). Se prueban en el browser y se despliegan vía API o Workflows (detect → crop → OCR → validar, encadenable con un VLM o motor OCR).

**Qué corre dónde:** OCR de calidad en video en tiempo real realista corre en servidor/edge (GPU) o en cámara con software especializado. En el browser podés hacer una demo de OCR sobre imagen fija o recorte, pero NO free-flow productivo sobre video en vivo.

**Precisión y límites reales:** los contenedores están corrugados, oxidados, con pintura descascarada, códigos verticales u horizontales, ángulos y mala luz; la precisión cae fuerte si la cámara no está bien posicionada. Papers reportan 93.3%–97.3% end-to-end; comerciales declaran más del 99% en condiciones controladas.

**Factible en un finde vs integración seria:**
- **Finde:** demo OCR sobre una foto de contenedor (subida o recorte de webcam) llamando a un modelo de Roboflow Universe o a PaddleOCR en una Edge Function/servicio Python, + validación de check digit en TS. Prueba de concepto, no producción.
- **Serio:** pipeline detect→OCR sobre RTSP en edge, con reintentos multi-frame, validación de dígito, y reconciliación con el booking del CRM.

### 3. Camino B — Despliegue productivo con cámara IP fija (RTSP)

Arquitectura recomendada:
- **Cámara IP** (Dahua/Hikvision/Axis con RTSP) en portón de camiones y en playa de despacho de tren, bien posicionada para capturar el código.
- **Procesamiento en el borde:** un **NVIDIA Jetson Orin Nano** o un mini-PC on-premise con GPU. El Jetson es el estándar documentado para inferencia RTSP en tiempo real (Roboflow tiene guía con JetPack + Inference Pipeline). Alternativa: servidor con GPU si hay conectividad.
- **Frameworks:**
  - **Roboflow Inference (InferencePipeline)**: consume webcam/RTSP/video, corre el modelo y llama un "sink" custom. Drop-in para tiempo real.
  - **Ultralytics YOLO**: detección; ojo licencia AGPL-3.0.
  - **NVIDIA DeepStream**: máximo rendimiento multi-stream, más complejo.
  - **Frigate** (MIT): NVR open-source con detección en tiempo real, ideal como *referencia de arquitectura* — usa go2rtc para RTSP, Coral Edge TPU o GPU para inferencia, y publica eventos por MQTT. No hace OCR de contenedor pero muestra el patrón NVR+detección+eventos que podés replicar.
- **Tracking y dirección (Supervision):** `sv.ByteTrack()` para trackear, `sv.LineZone(start, end)` para contar cruces con `in_count`/`out_count`, y `sv.PolygonZone` para zonas. Esto es lo que distingue **ingreso vs egreso** según la dirección del cruce de línea. Rol correcto de Supervision: tracking + conteo de línea/zona + anotación, **NO OCR**.
- **Comunicación con la app/Supabase:** el sink del pipeline arma el evento (contenedor, sigla leída, dirección, timestamp, imagen) y lo manda por **webhook/REST a un Edge Function de Supabase** o inserta directo en Postgres vía el SDK de Supabase. Supabase Realtime propaga el evento a la app Next.js para actualizar el dashboard en vivo. El OCR + check digit puede correr en el edge o en la Edge Function.

Flujo end-to-end productivo: RTSP → detección de contenedor (YOLO/RF-DETR) → ByteTrack + LineZone (dirección) → crop del código → OCR (PaddleOCR/Vaxtor/Roboflow) → validación ISO 6346 → POST a Supabase → Realtime → dashboard CRM-DETENTION.

### 4. Casos de éxito / referencias (material para el pitch)

- **Vaxtor VaxOCR Container** (integrado por MOBOTIX y Axis): más del 99% de precisión ISO 6346, ~900 ms/contenedor, hasta 20 km/h on-camera y 50 km/h en PC; usado en puertos, fronteras y logística.
- **Papers académicos:**
  - Feng, X.; Wang, Z.; Liu, T., "Port Container Number Recognition System Based on Improved YOLO and CRNN Algorithm," Proc. Int. Conf. on Artificial Intelligence and Electromechanical Automation (AIEA 2020), pp. 72–77, DOI:10.1109/AIEA51086.2020.00022 — YOLOv3 liviano + CRNN mejorado con residuales invertidos MobileNetV2; mAP de localización 93.7%, reconocimiento 94.5%, ~29 FPS.
  - Zhang et al., "A Two-Stage Automatic Container Code Recognition Method Considering Environmental Interference," Applied Sciences (MDPI) 14(11):4779, 2024 — "C-YOLOv4 achieves a container region localization accuracy of 99.76% at a speed of 56.7 frames per second".
  - Método end-to-end con 97.3% (dataset ~6.000 imágenes de puerto local); framework adaptativo con 93.33%. Ignitarium reporta 99% en clasificación de caracteres con RetinaNet + CNN custom.
- **Pipeline reproducible open-source:** serie de Zichun Lin, YOLOv8 (detección de número y de caracteres) + PaddleOCR (ABINet + CPPD, ensemble) desplegado en Jetson Orin Nano con TensorRT, servido por Flask/Gunicorn en Docker, consumido por HTTP.
- **Productos de gate automation:** Docker Vision, Isarsoft, Nestor TREX-CONTAINER, Supplai, Visive — todos con ANPR + container OCR + validación de check digit e integración a TOS/YMS.

### 5. Contexto del CRM (por qué esto suma al pitch)

CRM-DETENTION reemplaza el control manual en Excel de vacíos/detention para DA/Celsur en Bahía Blanca y Abot. El sistema ya tiene dashboard de costos, ingreso/egreso, alertas y reportes. El dolor operativo central que expresó O. Perez: **la terminal no notifica el ingreso del contenedor** — el seguimiento depende de correos y de la buena voluntad del personal del tren, y "no hay ninguna manera de que la terminal te avise cuándo ingresó". Una cámara en el portón/playa de tren que detecte y lea la sigla automatiza justo ese eslabón faltante, corta la detention antes y elimina la transcripción manual. Ese es el ángulo de venta para la presentación del 24.

## Recommendations

**Fase 0 — Este fin de semana (PoC para el pitch):**
1. Crear una solapa nueva en CRM-DETENTION (ruta App Router, ej. `/vision`) que pida la webcam con `getUserMedia` y muestre `<video>` + `<canvas>` overlay.
2. Implementar detección con **COCO-SSD (TF.js)** — máxima cantidad de ejemplos Next.js copiables — o **MediaPipe Tasks** si querés mejor FPS. Cargar el modelo en `useEffect`, loop con `requestAnimationFrame`, dibujar cajas + etiquetas + score.
3. Cargar el componente con `dynamic(() => import(...), { ssr:false })` para evitar problemas de SSR en Vercel (el modelo y `getUserMedia` sólo existen en el cliente).
4. Mensaje para el pitch: "detección en vivo en el navegador, sin costo de servidor" + un mockup del roadmap a lectura de siglas. **Umbral de éxito:** la solapa detecta objetos con cajas a ≥10 FPS en tu laptop.

**Fase 1 — Semanas siguientes (validar OCR):**
5. Probar un modelo de Roboflow Universe de container OCR (`container-ocr-byxl7`) sobre fotos reales de contenedores de DA, o montar PaddleOCR en un servicio Python.
6. Implementar validación de check digit ISO 6346 en TypeScript (client-side o Edge Function) y validación de prefijo contra la lista de restringidos que ya usa O. Perez.
7. **Umbral que cambia la decisión:** si el OCR sobre fotos reales supera ~90% con validación de dígito, avanzar a video; si no, quedarse con captura de foto + confirmación humana asistida.

**Fase 2 — Piloto productivo (si DA aprueba el proyecto):**
8. Una cámara IP en un punto (portón de camiones), Jetson Orin Nano con Roboflow Inference + Supervision (ByteTrack + LineZone para ingreso/egreso), OCR en el edge, POST a Supabase Edge Function, Realtime al dashboard.
9. Evaluar comprar Vaxtor VaxOCR Container (licencia por cámara) vs pipeline propio YOLO/RF-DETR+PaddleOCR según presupuesto y volumen. **Benchmark:** precisión >95% en free-flow y latencia <2 s por contenedor.
10. Escalar a la playa de tren y a otros clientes futuros.

## Caveats
- **No prometer en el fin de semana:** lectura de siglas ISO 6346 en tiempo real sobre video en producción. Eso es Fase 2. Lo del finde es detección de objetos genérica en browser como PoC.
- **WebGPU es inconsistente** en onnxruntime-web (2025-2026): no asumir aceleración automática; tener fallback a WASM. Para PoC, WebGL (TF.js) o GPU delegate (MediaPipe) son más predecibles.
- **Licencia AGPL-3.0 de Ultralytics YOLO:** riesgo para uso comercial cerrado. Preferir RF-DETR (Apache 2.0) o COCO-SSD/MediaPipe (Apache 2.0) si el código no se va a abrir.
- **Sesgo de hardware en los benchmarks:** casi todas las cifras "buenas" de FPS provienen de Apple Silicon o GPUs NVIDIA, no de laptops con Intel integrada de gama baja. Medir en el hardware objetivo (los repos de nomi30701 permiten benchmark en vivo).
- **Condiciones de campo:** contenedores corrugados, óxido, mala luz, ángulos y códigos verticales degradan la precisión; la posición de cámara es determinante. Los más de 99% comerciales son en condiciones controladas.
- **Privacidad/red:** el browser (client-side) mantiene el video en la máquina del usuario; el despliegue con cámara IP requiere definir dónde se procesa y almacena el video (edge on-premise recomendado).
- Algunas cifras de FPS de detección en browser provienen de fuentes de calidad editorial variable o de demos oficiales con hardware no especificado; conviene validarlas en el hardware real antes de comprometerse a un número en la presentación.