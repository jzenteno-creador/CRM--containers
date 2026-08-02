# Google Play — Kit de publicación (copiar y pegar)

> Estado técnico: **todo listo**. El `.aab` firmado está en el release
> `app-android-v1.0.0` de GitHub. Este documento tiene los textos y respuestas
> exactas para completar la ficha de Play Console sin pensar.

## 0. Decisión previa: tipo de cuenta

| | Personal | Organización (SSB) |
|---|---|---|
| Verificación | DNI de John | Número D-U-N-S de SSB International S.A. (gratis, tarda días/semanas) |
| Producción pública | Exige prueba cerrada con **20 testers × 14 días** antes | Sin ese requisito |
| Nombre visible | "Jonathan Zenteno" | "SSB International SA" |

**Recomendado para uso interno**: cualquiera de las dos + canal de **prueba
cerrada** (invitación por mail, sin ficha pública). Eso evita el requisito de
20 testers y da actualizaciones automáticas vía Play.

Costo de la cuenta: USD 25 única vez → `play.google.com/console`.

## 1. Ficha de la app (Store listing)

| Campo | Valor |
|---|---|
| Nombre (máx 30) | `CRM Detention — SSB` |
| Descripción corta (máx 80) | `Control de detention y demurrage de contenedores. Uso interno de SSB.` |
| Categoría | Empresa (Business) |
| Email de contacto | `jzenteno@ssbint.com` |
| Política de privacidad | `https://crm-detention.vercel.app/privacidad` |
| Ícono 512×512 | usar `crm-v2/public/icons/icon-512.png` |
| Gráfico destacado 1024×500 | `android/play-feature-graphic.png` (ya generado) |
| Capturas (mín. 2, teléfono) | **Las toma John en el S25**: inicio con KPIs, alertas, escaneo |

**Descripción completa** (pegar tal cual):

```
CRM Detention es la herramienta interna de SSB International S.A. para el
control operativo de contenedores: detention, demurrage, free time por
naviera, alertas de vencimiento y costos por operación.

Funciones principales:
• Semáforo de alertas por contenedor (verde / amarillo / rojo)
• Registro de retiros, devoluciones e ingresos a planta
• Cálculo automático de días libres y excedentes según tarifario de cada naviera
• Escaneo de siglas de contenedor con la cámara
• Reportes y KPIs de costos para supervisión

Acceso restringido: requiere una cuenta corporativa aprobada por un
administrador de SSB International. No es un servicio para el público general.
```

## 2. Declaraciones de contenido (responder tal cual)

**Data Safety (Seguridad de los datos):**

| Pregunta | Respuesta |
|---|---|
| ¿Recopila datos? | Sí |
| Información personal | Nombre + Dirección de correo — obligatorios, para gestión de la cuenta. No se comparten |
| Fotos | Sí (fotos de contenedores que sube el usuario) — opcional, funcionalidad de la app. No se comparten |
| ¿Comparte datos con terceros? | No |
| ¿Datos cifrados en tránsito? | Sí |
| ¿El usuario puede pedir eliminación? | Sí (contacto: jzenteno@ssbint.com) |

**Clasificación de contenido (IARC):** app de utilidad/productividad; sin
violencia, sin apuestas, sin contenido sexual, sin compras, sin interacción
entre usuarios abierta → resultado esperado: **Apta para todos / PEGI 3**.

**Otras declaraciones:** Anuncios: **No** · App de noticias: **No** ·
Funciones financieras: **No** (muestra costos, no procesa pagos) ·
App gubernamental: **No** · Público objetivo: **18+**.

**App access (⚠️ importante):** como la app exige login, Google pide
credenciales de prueba para revisarla → John debe crear un **usuario de
revisión** (rol operador, planta demo) y cargarlo en "App access →
All or some functionality is restricted → Add instructions".

## 3. Subida y canal

1. Play Console → Crear app → completar §1 y §2.
2. **Prueba cerrada** → crear lista de emails (John, Omar, operadores) → subir
   `app-release-bundle.aab` (bajarlo del release `app-android-v1.0.0`).
3. Al subir, aceptar **Play App Signing** (Google re-firma con llave propia;
   nuestro keystore pasa a ser "upload key" — esto es lo normal y lo correcto).
4. Compartir el link de opt-in con los testers → instalan desde Play.
5. Países: Argentina (agregar Brasil si va a operar gente de allá).

## 4. Paso técnico post-subida (lo hace Claude — avisar)

Tras aceptar Play App Signing: Play Console → **Setup → App integrity → App
signing key certificate** → copiar el **SHA-256** de Google y pasárselo a
Claude. Se agrega como segunda huella en
`crm-v2/public/.well-known/assetlinks.json` y se redeploya — sin eso, la app
instalada desde Play abriría con barra de navegador (vínculo app↔dominio roto).

## 5. Actualizaciones futuras

El contenido de la app vive en la web → **casi nunca hay que resubir nada**.
Solo se resube un `.aab` nuevo (versionCode +1 en `twa-manifest.json` →
`bubblewrap build`) si cambia el empaquetado: ícono, nombre, permisos, dominio.
