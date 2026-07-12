// FormAlert (design system): caja de aviso de formulario — tonal, inline.
// Extraída del objeto de estilos inline repetido en login, registro, recuperar y
// auth/actualizar-password (consolidación #11). Los errores transitorios de mutación
// van por Toast; esto es el aviso inline de un formulario.
// `tone` (M4): "error" (default, role=alert) para errores bloqueantes; "warning"/"info"
// (role=status) para avisos no bloqueantes (ej: pegado inverso del egreso §6.3.7).

export type FormAlertTone = "error" | "warning" | "info";

const TONES: Record<FormAlertTone, { color: string; bg: string; border: string }> = {
  error: {
    color: "var(--color-status-red)",
    bg: "var(--color-red-tint)",
    border: "var(--color-red-line)",
  },
  warning: {
    color: "var(--color-status-amber)",
    bg: "var(--color-amber-tint)",
    border: "var(--color-amber-line)",
  },
  info: {
    color: "var(--color-accent-500)",
    bg: "var(--color-accent-tint)",
    border: "var(--color-accent-line)",
  },
};

export function FormAlert({
  tone = "error",
  children,
}: {
  tone?: FormAlertTone;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        fontSize: 12,
        color: t.color,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: "var(--radius-input)",
        padding: "8px 12px",
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
