"use client";

// ComboboxCreatable (design system — base reusable de los combobox del Bloque 4):
// input tipeable + lista filtrada por substring (client-side, sobre las opciones ya
// cargadas) + navegación de teclado ↑↓/Enter/Esc (mismo idioma que fd/command-palette).
// El <input> hereda el look de fd/Select (estilado global en globals.css: surface-2,
// border-strong → cyan en focus, radius-input); el panel de opciones reusa el mismo
// tratamiento visual que Popover/CommandPalette (surface-1, border-strong, shadow-palette).
//
// Si `onCreate` está definido y lo tipeado no matchea NINGUNA opción exacta (case/trim
// insensitive), aparece al final una fila "Crear «texto»". El componente NO crea nada
// por sí mismo — solo notifica vía onCreate(texto); la creación real (con su propio
// pre-check de similares, confirmación, etc.) es responsabilidad del consumidor.
//
// WAI-ARIA: patrón combobox 1.2 "list autocomplete" — input role=combobox +
// aria-expanded/aria-controls/aria-activedescendant, panel role=listbox, filas role=option.
// El foco NUNCA sale del input (las filas no son focusables); aria-activedescendant
// marca la fila "virtualmente" activa, igual que el resto de los popovers del sistema.

import { useId, useMemo, useState } from "react";

export type ComboboxOption = { id: string; label: string };

const ERROR_STYLE: React.CSSProperties = {
  borderColor: "var(--color-status-red)",
  boxShadow: "0 0 0 3px rgba(248,81,73,0.08)",
};

function rowStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    fontSize: 12.5,
    lineHeight: 1.3,
    cursor: "pointer",
    color: "var(--color-text-secondary)",
    background: active ? "var(--color-surface-selected)" : "transparent",
  };
}

export function ComboboxCreatable({
  options,
  value,
  onChange,
  onCreate,
  placeholder,
  error,
  id,
  disabled = false,
  emptyMessage = "sin resultados",
}: {
  options: ComboboxOption[];
  /** id de la opción seleccionada; "" = nada seleccionado (mismo contrato que <Select>). */
  value: string;
  onChange: (id: string) => void;
  /** Si viene, habilita la fila "Crear «texto»" cuando lo tipeado no matchea ninguna opción exacta. */
  onCreate?: (texto: string) => void;
  placeholder?: string;
  error?: string | null;
  id?: string;
  disabled?: boolean;
  /** Mensaje cuando el filtro no encuentra nada y no hay onCreate (o el texto está vacío). */
  emptyMessage?: string;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listboxId = `${inputId}-listbox`;

  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  // valor mostrado: abierto/editando muestra lo tipeado; cerrado, la opción elegida.
  // Sin efecto de sincronización: se deriva directamente de `value`/`options` en cada
  // render (regla react-hooks/set-state-in-effect — nunca sync de prop→state en efecto).
  const displayValue = open ? query : (selected?.label ?? "");

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    if (trimmed === "") return options;
    const q = trimmed.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, trimmed]);

  const exactMatch = useMemo(
    () => options.some((o) => o.label.trim().toLowerCase() === trimmed.toLowerCase()),
    [options, trimmed],
  );
  const showCreateRow = Boolean(onCreate) && trimmed !== "" && !exactMatch;
  const createIndex = filtered.length; // la fila "crear" siempre va última
  const totalRows = filtered.length + (showCreateRow ? 1 : 0);

  // abre el panel; solo resetea `query` si estaba cerrado (evita pisar lo que el
  // usuario está tipeando si el evento se dispara de nuevo — ej: click con foco ya puesto).
  const openList = () => {
    if (disabled || open) return;
    setQuery(selected?.label ?? "");
    setActiveIndex(0);
    setOpen(true);
  };

  const closeList = (revertQuery: boolean) => {
    setOpen(false);
    if (revertQuery) setQuery(selected?.label ?? "");
  };

  const pick = (idx: number) => {
    if (idx < filtered.length) {
      const opt = filtered[idx];
      onChange(opt.id);
      setQuery(opt.label);
      setOpen(false);
    } else if (showCreateRow && idx === createIndex) {
      onCreate?.(trimmed);
      setOpen(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeList(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(Math.max(totalRows - 1, 0), i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (totalRows > 0) pick(activeIndex);
    } else if (e.key === "Tab") {
      closeList(true);
    }
  };

  const activeId = open && totalRows > 0 ? `${listboxId}-opt-${activeIndex}` : undefined;

  return (
    <div style={{ position: "relative", opacity: disabled ? 0.6 : 1 }}>
      <input
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        aria-invalid={!!error || undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={displayValue}
        style={{ width: "100%", ...(error ? ERROR_STYLE : undefined) }}
        onFocus={openList}
        onClick={openList}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
          if (!open) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => closeList(true)}
      />
      {open && (
        <div
          role="listbox"
          id={listboxId}
          // preventDefault en mousedown: evita que el click en una fila dispare el
          // blur del input ANTES del onClick de la fila (mismo truco que fd/dropdown).
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 90,
            maxHeight: 240,
            overflowY: "auto",
            background: "var(--color-surface-1)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "var(--radius-input)",
            boxShadow: "var(--shadow-palette)",
            animation: "fd-palette-in 150ms var(--ease-out-expo)",
          }}
        >
          {filtered.length === 0 && !showCreateRow && (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--color-text-muted)" }}>{emptyMessage}</div>
          )}
          {filtered.map((o, i) => (
            <div
              key={o.id}
              id={`${listboxId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => pick(i)}
              style={rowStyle(i === activeIndex)}
            >
              {o.label}
            </div>
          ))}
          {showCreateRow && (
            <div
              id={`${listboxId}-opt-${createIndex}`}
              role="option"
              aria-selected={createIndex === activeIndex}
              onMouseEnter={() => setActiveIndex(createIndex)}
              onClick={() => pick(createIndex)}
              style={{
                ...rowStyle(createIndex === activeIndex),
                borderTop: filtered.length > 0 ? "1px solid var(--color-border-subtle)" : undefined,
                color: "var(--color-accent-500)",
                fontWeight: 600,
              }}
            >
              <i className="ti ti-plus" aria-hidden style={{ fontSize: 13, marginRight: 7, flexShrink: 0 }} />
              Crear «{trimmed}»
            </div>
          )}
        </div>
      )}
    </div>
  );
}
