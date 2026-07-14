"use client";

// Controles de formulario Flight Deck: surface-2, border strong → cyan en focus,
// radius 9. Cada control acepta `error` (borde rojo) y se envuelve en <Field>
// (label micro + slot de error inline). React 19: ref es prop normal, sin forwardRef.

import { useId } from "react";

/* ---------- wrapper: label micro + slot de error ---------- */

export function Field({
  label,
  error,
  hint,
  htmlFor,
  help,
  children,
  className = "",
}: {
  label?: string;
  error?: string | null;
  hint?: string;
  htmlFor?: string;
  /** Slot junto al label — típicamente un <FieldHelp> (tooltip on-hover del campo, M4). */
  help?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      {(label || help) && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {label && (
            <label className="fd-label" htmlFor={htmlFor}>
              {label}
            </label>
          )}
          {help}
        </div>
      )}
      {children}
      {error ? (
        <span role="alert" style={{ fontSize: 11, color: "var(--color-status-red)" }}>
          {error}
        </span>
      ) : (
        hint && <span style={{ fontSize: 11, color: "var(--color-text-faint)" }}>{hint}</span>
      )}
    </div>
  );
}

const ERROR_STYLE: React.CSSProperties = {
  borderColor: "var(--color-status-red)",
  boxShadow: "0 0 0 3px rgba(248,81,73,0.08)",
};

/* ---------- controles ---------- */

type WithError = { error?: string | null };

export function Input({
  error,
  style,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & WithError & { ref?: React.Ref<HTMLInputElement> }) {
  return <input aria-invalid={!!error || undefined} style={error ? { ...ERROR_STYLE, ...style } : style} {...rest} />;
}

export function Textarea({
  error,
  style,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & WithError & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return (
    <textarea aria-invalid={!!error || undefined} style={error ? { ...ERROR_STYLE, ...style } : style} {...rest} />
  );
}

export function Select({
  error,
  style,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & WithError & { ref?: React.Ref<HTMLSelectElement> }) {
  return (
    <select aria-invalid={!!error || undefined} style={error ? { ...ERROR_STYLE, ...style } : style} {...rest}>
      {children}
    </select>
  );
}

/** Fecha nativa con valor en mono tabular (color-scheme dark ya estila el picker). */
export function DateField({
  error,
  style,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & WithError & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <input
      type="date"
      aria-invalid={!!error || undefined}
      className="mono"
      style={error ? { ...ERROR_STYLE, ...style } : style}
      {...rest}
    />
  );
}

/** Hora nativa 'HH:mm' (M5 B2/Importación — retiros escalonados: mismo día, distinto
 * horario). Mismo tratamiento visual que DateField (mono, color-scheme dark). */
export function TimeField({
  error,
  style,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & WithError & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <input
      type="time"
      aria-invalid={!!error || undefined}
      className="mono"
      style={error ? { ...ERROR_STYLE, ...style } : style}
      {...rest}
    />
  );
}

/** Checkbox con label clickeable (accent cyan nativo). */
export function Checkbox({
  label,
  error,
  style,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & WithError & { label?: React.ReactNode }) {
  const id = useId();
  return (
    <label
      htmlFor={rest.id ?? id}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12.5,
        color: "var(--color-text-secondary)",
        cursor: rest.disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      <input type="checkbox" id={rest.id ?? id} aria-invalid={!!error || undefined} {...rest} />
      {label}
    </label>
  );
}

/** Toggle (switch) — estado controlado, track cyan cuando está activo. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  id?: string;
}) {
  const autoId = useId();
  const switchId = id ?? autoId;
  return (
    <label
      htmlFor={switchId}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        fontSize: 12.5,
        color: "var(--color-text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <button
        type="button"
        role="switch"
        id={switchId}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: 36,
          height: 20,
          minHeight: 0,
          padding: 2,
          borderRadius: 999,
          border: `1px solid ${checked ? "var(--color-accent-muted)" : "var(--color-border-strong)"}`,
          background: checked ? "var(--color-accent-tint)" : "var(--color-surface-2)",
          display: "inline-flex",
          justifyContent: checked ? "flex-end" : "flex-start",
          transition: "background 150ms var(--ease-out-expo), border-color 150ms var(--ease-out-expo)",
          flexShrink: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: checked ? "var(--color-accent-500)" : "var(--color-text-faint)",
            transition: "background 150ms var(--ease-out-expo)",
          }}
        />
      </button>
      {label}
    </label>
  );
}
