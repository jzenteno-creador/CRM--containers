# CRM Detention — App Android · Guía de instalación

## Qué es

La app Android del CRM. Técnicamente es una **Trusted Web Activity**: el estándar de
Google para empaquetar una aplicación web como app nativa. Significa:

- Se instala como cualquier app: ícono propio, pantalla completa, sin barra de navegador.
- **Siempre muestra la última versión del sistema** — cada deploy del CRM llega solo,
  sin actualizar la app.
- La cámara (escaneo de siglas, fotos de incidencias) funciona con el permiso estándar
  de Android, revocable desde Ajustes.
- Requiere internet: el CRM muestra plata y alertas en vivo, jamás datos viejos.

## Instalar en un teléfono de la operación (sin Play Store)

1. Abrir en el teléfono el link del APK (lo comparte John — Drive, mail o GitHub).
2. Descargar `crm-ssb.apk` y tocarlo.
3. Android va a avisar "instalación de origen desconocido" → **Permitir esta vez**.
   (Es lo normal para apps corporativas distribuidas fuera de la tienda.)
4. Abrir "CRM SSB" e iniciar sesión con la cuenta de siempre.

> Requisito: Android 5.0+ y Chrome instalado (está en prácticamente todos los equipos).

## Publicar en Google Play (opcional, cuando John quiera)

Todo lo técnico ya está listo (paquete `.aab` en el release `app-android-v1.0.0`,
política de privacidad en `https://crm-detention.vercel.app/privacidad`, íconos,
gráfico destacado). **Guía completa con textos copy-paste: [`PLAY-STORE.md`](PLAY-STORE.md)**
— incluye la decisión cuenta personal vs organización, las respuestas exactas del
formulario Data Safety y el paso post-subida de Play App Signing (agregar la huella
de Google al assetlinks — lo hace Claude).

## Archivos de esta carpeta

| Archivo | Qué es |
|---|---|
| `crm-ssb.apk` | El instalable para repartir a los teléfonos |
| `app-release-bundle.aab` | El paquete para Play Store (solo si se publica) |
| `crm-ssb.keystore` | **LA LLAVE DE FIRMA — NO BORRAR, NO COMMITEAR.** Sin ella no se pueden publicar actualizaciones con la misma identidad. Guardar copia en Drive |
| `twa-manifest.json` | La configuración del empaquetado (versionada) |

## Seguridad

- La app no agrega ninguna superficie nueva: es el mismo CRM, con la misma sesión, la
  misma RLS y los mismos permisos por rol.
- El vínculo app↔sitio está verificado por **Digital Asset Links**
  (`/.well-known/assetlinks.json` con la huella del certificado de firma): Android
  solo abre en pantalla completa el dominio real del CRM.
