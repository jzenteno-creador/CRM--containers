// CardIcon (design system): círculo 52px con ícono Tabler tonal (color/tint/line por
// estado), usado dentro de las gate-cards. Extraído del span repetido en espera-aprobacion,
// auth/callback, auth/actualizar-password y recuperar (consolidación #11).

export function CardIcon({
  icon,
  color,
  tint,
  line,
}: {
  icon: string;
  color: string;
  tint: string;
  line: string;
}) {
  return (
    <span
      aria-hidden
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        background: tint,
        border: `1px solid ${line}`,
        color,
        fontSize: 24,
      }}
    >
      <i className={`ti ${icon}`} />
    </span>
  );
}
