// FormAlert (design system): caja de error de formulario — rojo tonal, role="alert".
// Extraída del objeto de estilos inline repetido en login, registro, recuperar y
// auth/actualizar-password (consolidación #11). Los errores transitorios de mutación
// van por Toast; esto es el error inline de un formulario.

export function FormAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      style={{
        fontSize: 12,
        color: "var(--color-status-red)",
        background: "var(--color-red-tint)",
        border: "1px solid var(--color-red-line)",
        borderRadius: "var(--radius-input)",
        padding: "8px 12px",
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
