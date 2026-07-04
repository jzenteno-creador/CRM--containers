// components/ContainerNumber.tsx
// Display centralizado del numero_contenedor (ISO 6346). SOLO display — la validación vive en lib/iso6346.ts.
// API: value recibe el numero_contenedor ENTERO tal como está en la DB (campo único, ej. "MSKU4829103").
// El componente parte internamente; NUNCA partir el dato en la query ni armar adapters.
'use client';

type Props = { value: string; colorize?: boolean; className?: string };

export function ContainerNumber({ value, colorize = true, className = '' }: Props) {
  const clean = value.replace(/[\s-]/g, '').toUpperCase();
  // ISO 6346: 4 (owner+categoría) + 6 (serial) + 1 (check digit) = 11
  const prefix = clean.slice(0, 4);
  const serial = clean.slice(4, 10);
  const check = clean.slice(10, 11);

  if (!colorize) {
    return <span className={`font-mono tabular-nums select-all ${className}`}>{clean}</span>;
  }

  // <span> adyacentes SIN whitespace: en líneas distintas JSX elimina el newline
  // (renderiza "MSKU4829103"); si los separás con un espacio en la misma línea,
  // JSX inserta ese espacio y rompe el copy. NO metas separadores.
  return (
    <span className={`font-mono tabular-nums select-all ${className}`}>
      <span className="text-accent-500">{prefix}</span>
      <span className="text-text-primary">{serial}</span>
      <span className="text-text-faint">{check}</span>
    </span>
  );
}
