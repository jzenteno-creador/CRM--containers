// Política de privacidad (2026-08-02) — página PÚBLICA (fuera del gate de sesión).
// Requisito legal de la app Android: Ley 25.326 de Protección de Datos Personales
// (Argentina) y, si se publica en Google Play, URL obligatoria de la ficha.
// Contenido revisable por SSB — esto es un punto de partida serio, no asesoría legal.
export const metadata = { title: "Política de privacidad · CRM SSB" };

const S: React.CSSProperties = { marginTop: 28 };
const H: React.CSSProperties = { fontSize: 17, margin: "0 0 8px" };

export default function PrivacidadPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px", lineHeight: 1.65 }}>
      <h1 className="fd-display" style={{ fontSize: 26, marginBottom: 4 }}>
        Política de privacidad
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
        CRM Detention — SSB International S.A. · Última actualización: agosto de 2026
      </p>

      <section style={S}>
        <h2 style={H}>Qué es este sistema</h2>
        <p>
          El CRM Detention es una herramienta <b>interna de uso corporativo</b> de SSB
          International S.A. para el control operativo de contenedores (detention y
          demurrage). No es un servicio para el público general: el acceso requiere una
          cuenta aprobada por un administrador de SSB.
        </p>
      </section>

      <section style={S}>
        <h2 style={H}>Qué datos se tratan</h2>
        <ul>
          <li>
            <b>Datos de cuenta</b>: nombre, correo corporativo, rol y planta asignada de
            cada usuario autorizado.
          </li>
          <li>
            <b>Datos operativos</b>: números de contenedor, fechas de movimiento,
            bookings, tarifas e incidencias. Son datos logísticos, no datos personales.
          </li>
          <li>
            <b>Fotografías</b>: imágenes de contenedores tomadas por el personal como
            comprobante operativo (estado, siglas, averías). El sistema no está destinado
            a captar imágenes de personas.
          </li>
          <li>
            <b>Registro de auditoría</b>: quién realizó cada acción y cuándo — requisito
            de control interno sobre operaciones con impacto económico.
          </li>
        </ul>
      </section>

      <section style={S}>
        <h2 style={H}>Permisos de la aplicación</h2>
        <ul>
          <li>
            <b>Cámara</b>: se usa únicamente cuando el usuario abre las funciones de
            escaneo o carga de fotos, previa autorización del sistema operativo. Puede
            revocarse en cualquier momento desde la configuración del dispositivo.
          </li>
          <li>
            <b>Internet</b>: necesaria para operar; el sistema no muestra datos sin
            conexión.
          </li>
        </ul>
      </section>

      <section style={S}>
        <h2 style={H}>Dónde se almacenan y quién accede</h2>
        <p>
          Los datos se almacenan en infraestructura en la nube contratada por SSB
          (Supabase — base de datos y almacenamiento cifrados en tránsito). El acceso está
          restringido por cuenta, rol y planta mediante controles a nivel de base de
          datos. No se venden ni comparten datos con terceros; no hay publicidad ni
          rastreadores de terceros en la aplicación.
        </p>
      </section>

      <section style={S}>
        <h2 style={H}>Marco legal y derechos</h2>
        <p>
          El tratamiento se rige por la <b>Ley 25.326 de Protección de Datos Personales
          (República Argentina)</b> y su normativa complementaria. Los titulares de datos
          pueden ejercer los derechos de acceso, rectificación y supresión contactando a
          SSB International S.A. La Agencia de Acceso a la Información Pública, órgano de
          control de la Ley 25.326, tiene la atribución de atender denuncias y reclamos.
        </p>
      </section>

      <section style={S}>
        <h2 style={H}>Contacto</h2>
        <p>
          SSB International S.A. — <a href="mailto:jzenteno@ssbint.com">jzenteno@ssbint.com</a>
        </p>
      </section>
    </main>
  );
}
