// Eliminación de cuenta (2026-08-02) — página PÚBLICA (fuera del gate de sesión).
// Requisito de la política de Datos del Usuario de Google Play: toda app que permite
// crear cuentas debe ofrecer un recurso web para solicitar la eliminación, accesible
// también desde adentro de la app (menú de usuario → "Eliminar mi cuenta").
export const metadata = { title: "Eliminar cuenta · CRM SSB" };

const S: React.CSSProperties = { marginTop: 28 };
const H: React.CSSProperties = { fontSize: 17, margin: "0 0 8px" };

const MAILTO =
  "mailto:jzenteno@ssbint.com?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20cuenta%20CRM&body=Solicito%20la%20eliminaci%C3%B3n%20de%20mi%20cuenta%20del%20CRM%20Detention.%0ACorreo%20de%20la%20cuenta%3A%20";

export default function EliminarCuentaPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px", lineHeight: 1.65 }}>
      <h1 className="fd-display" style={{ fontSize: 26, marginBottom: 4 }}>
        Eliminación de cuenta
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
        CRM Detention — SSB International S.A.
      </p>

      <section style={S}>
        <h2 style={H}>Cómo solicitar la eliminación</h2>
        <p>
          El CRM Detention es una herramienta interna corporativa: las cuentas las
          aprueba y administra SSB International S.A. Para eliminar tu cuenta, enviá la
          solicitud desde el correo asociado a ella:
        </p>
        <p>
          <a href={MAILTO}>
            <b>Solicitar eliminación de cuenta →</b>
          </a>{" "}
          (jzenteno@ssbint.com)
        </p>
        <p>
          La solicitud se procesa dentro de los <b>30 días</b>. Vas a recibir
          confirmación por correo cuando esté completada.
        </p>
      </section>

      <section style={S}>
        <h2 style={H}>Qué se elimina y qué se conserva</h2>
        <ul>
          <li>
            <b>Se elimina</b>: el acceso de la cuenta y sus datos personales — nombre y
            correo se desvinculan/anonimizan.
          </li>
          <li>
            <b>Se conserva</b>: el registro de auditoría de operaciones ya realizadas
            (quién registró cada movimiento con impacto económico), en forma
            despersonalizada donde sea posible. Es un requisito de control interno sobre
            operaciones logísticas con efecto contable, amparado por la Ley 25.326 como
            conservación con fines de cumplimiento.
          </li>
        </ul>
      </section>

      <section style={S}>
        <h2 style={H}>Más información</h2>
        <p>
          El detalle del tratamiento de datos está en la{" "}
          <a href="/privacidad">política de privacidad</a>. Ante cualquier consulta:
          SSB International S.A. —{" "}
          <a href="mailto:jzenteno@ssbint.com">jzenteno@ssbint.com</a>.
        </p>
      </section>
    </main>
  );
}
