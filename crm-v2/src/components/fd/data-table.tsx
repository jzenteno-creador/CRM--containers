"use client";

// DataTable (design system M0 — consumida por M3 F1/F2, M4 F1/F2, M5, M6, M8):
// header sticky, columnas tipadas, sort con indicador cyan, números right tabular-nums,
// hover surface-2, dot semáforo (glow solo rojo) + border-left rojo crítico, paginación,
// selección múltiple controlada (checkbox + select-all + contador) y slot de validación
// por fila (badge + mensaje error/warning inline). El scroll-x vive SIEMPRE dentro del
// propio contenedor — nunca scroll horizontal de página.
// 4 estados: loading (skeleton misma grilla, nunca spinners) / vacío / error / poblado.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { SkeletonRowsTable } from "./skeleton-row";
import type { EstadoSemaforo } from "./status-badge";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  /** true = right-aligned + JetBrains Mono tabular-nums (obligatorio para números). */
  numeric?: boolean;
  align?: "left" | "right" | "center";
  width?: string;
  /** Presencia habilita el sort por esta columna. */
  sortValue?: (row: T) => string | number | null;
  /** Columna secundaria: se oculta en móvil (<640px). */
  hideOnMobile?: boolean;
};

export type RowValidation = { tipo: "ok" | "warning" | "error"; mensaje?: string };

type Seleccion = {
  ids: ReadonlySet<string>;
  onChange: (ids: Set<string>) => void;
  /** Deshabilita el checkbox de una fila (ej: ya procesada). */
  disabled?: (id: string) => boolean;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Dot semáforo en la primera columna + border-left rojo en filas críticas. */
  semaforo?: (row: T) => EstadoSemaforo | null;
  loading?: boolean;
  skeletonRows?: number;
  /** Estado vacío instructivo (§15.3) — render de <EmptyState>. */
  emptyState?: React.ReactNode;
  /** Estado de error de datos — render de <ErrorState> (mensaje + retry cyan). */
  errorState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  /** Habilita paginación interna. */
  pageSize?: number;
  /** Selección múltiple (estado controlado por el consumidor). */
  seleccion?: Seleccion;
  /** Slot de validación por fila: badge + mensaje inline (ej: ISO 6346 en la tanda). */
  validacion?: (row: T) => RowValidation | null;
  /** Alto máximo: activa scroll-y interno (el header sticky pega contra el contenedor). */
  maxHeight?: number | string;
  className?: string;
};

const VALIDACION_UI: Record<RowValidation["tipo"], { icon: string; color: string; bg: string; border: string }> = {
  ok: { icon: "ti-check", color: "var(--color-status-green)", bg: "var(--color-green-tint)", border: "var(--color-green-line)" },
  warning: { icon: "ti-alert-triangle", color: "var(--color-status-amber)", bg: "var(--color-amber-tint)", border: "var(--color-amber-line)" },
  error: { icon: "ti-x", color: "var(--color-status-red)", bg: "var(--color-red-tint)", border: "var(--color-red-line)" },
};

const DOT: Record<EstadoSemaforo, string> = {
  verde: "var(--color-status-green)",
  amarillo: "var(--color-status-amber)",
  rojo: "var(--color-status-red)",
  neutro: "var(--color-text-muted)",
};

const TH_BASE: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  background: "var(--color-table-head)",
  textAlign: "left",
  padding: "8px 12px",
  color: "var(--color-text-label)",
  fontWeight: 500,
  fontSize: 10,
  letterSpacing: "0.11em",
  textTransform: "uppercase",
  borderBottom: "1px solid var(--color-border-subtle)",
  whiteSpace: "nowrap",
};

const TD_BASE: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid var(--color-border-subtle)",
  color: "var(--color-text-secondary)",
  height: 40,
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  semaforo,
  loading = false,
  skeletonRows = 6,
  emptyState,
  errorState,
  onRowClick,
  defaultSort,
  pageSize,
  seleccion,
  validacion,
  maxHeight,
  className = "",
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(defaultSort ?? null);
  const [page, setPage] = useState(0);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = sv(a);
      const vb = sv(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // nulls al final
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "es") * dir;
    });
  }, [rows, sort, columns]);

  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const pageClamped = Math.min(page, pages - 1);
  const visibles = pageSize ? sorted.slice(pageClamped * pageSize, (pageClamped + 1) * pageSize) : sorted;

  // ids de la página visible (para el select-all)
  const idsVisibles = useMemo(() => visibles.map(rowKey), [visibles, rowKey]);
  const seleccionables = seleccion ? idsVisibles.filter((id) => !seleccion.disabled?.(id)) : [];
  const todosSeleccionados =
    seleccionables.length > 0 && seleccionables.every((id) => seleccion!.ids.has(id));
  const algunoSeleccionado = seleccionables.some((id) => seleccion?.ids.has(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = algunoSeleccionado && !todosSeleccionados;
    }
  }, [algunoSeleccionado, todosSeleccionados]);

  const toggleSort = (col: Column<T>) => {
    if (!col.sortValue) return;
    setSort((s) =>
      s?.key === col.key ? { key: col.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: col.key, dir: "asc" },
    );
    setPage(0);
  };

  const toggleTodos = () => {
    if (!seleccion) return;
    const next = new Set(seleccion.ids);
    if (todosSeleccionados) seleccionables.forEach((id) => next.delete(id));
    else seleccionables.forEach((id) => next.add(id));
    seleccion.onChange(next);
  };

  const toggleFila = (id: string) => {
    if (!seleccion) return;
    const next = new Set(seleccion.ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    seleccion.onChange(next);
  };

  const nCols = columns.length + (semaforo ? 1 : 0) + (seleccion ? 1 : 0) + (validacion ? 1 : 0);

  const alignOf = (c: Column<T>): React.CSSProperties["textAlign"] => c.align ?? (c.numeric ? "right" : "left");

  return (
    <div className={className}>
      {/* contador de seleccionados */}
      {seleccion && seleccion.ids.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            marginBottom: 8,
            fontSize: 12,
            color: "var(--color-accent-500)",
            background: "var(--color-accent-tint)",
            border: "1px solid var(--color-accent-line)",
            borderRadius: "var(--radius-chip)",
          }}
        >
          <i className="ti ti-checkbox" aria-hidden />
          <span className="mono">{seleccion.ids.size}</span>
          <span>seleccionado{seleccion.ids.size === 1 ? "" : "s"}</span>
          <button
            type="button"
            onClick={() => seleccion.onChange(new Set())}
            style={{
              minHeight: 0,
              marginLeft: "auto",
              padding: "2px 8px",
              fontSize: 11.5,
              border: "none",
              background: "transparent",
              color: "inherit",
              textDecoration: "underline",
            }}
          >
            limpiar
          </button>
        </div>
      )}

      {/* scroll-x SIEMPRE dentro de este contenedor (nunca scroll de página) */}
      <div
        style={{
          overflowX: "auto",
          overflowY: maxHeight ? "auto" : undefined,
          maxHeight,
          border: "1px solid var(--color-border-subtle)",
          borderRadius: "var(--radius-input)",
          background: "var(--color-surface-1)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12.5,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <thead>
            <tr>
              {seleccion && (
                <th style={{ ...TH_BASE, width: 34, padding: "8px 10px" }}>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    aria-label="seleccionar todo"
                    checked={todosSeleccionados}
                    onChange={toggleTodos}
                  />
                </th>
              )}
              {semaforo && <th style={{ ...TH_BASE, width: 26, padding: "8px 8px 8px 12px" }} aria-label="semáforo" />}
              {columns.map((c) => {
                const activa = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    className={c.hideOnMobile ? "hide-sm" : undefined}
                    style={{
                      ...TH_BASE,
                      width: c.width,
                      textAlign: alignOf(c),
                      cursor: c.sortValue ? "pointer" : undefined,
                      color: activa ? "var(--color-accent-500)" : TH_BASE.color,
                      userSelect: "none",
                    }}
                    aria-sort={activa ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                    onClick={() => toggleSort(c)}
                  >
                    {c.header}
                    {c.sortValue && (
                      <span aria-hidden style={{ marginLeft: 4, opacity: activa ? 1 : 0.35 }}>
                        {activa ? (sort!.dir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    )}
                  </th>
                );
              })}
              {validacion && <th style={{ ...TH_BASE, width: 40, textAlign: "center" }} aria-label="validación" />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRowsTable cols={nCols} rows={skeletonRows} />
            ) : errorState ? (
              <tr>
                <td colSpan={nCols} style={{ padding: 0 }}>
                  {errorState}
                </td>
              </tr>
            ) : visibles.length === 0 ? (
              <tr>
                <td colSpan={nCols} style={{ padding: 0 }}>
                  {emptyState ?? (
                    <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: 12, padding: 14, margin: 0 }}>
                      sin resultados
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              visibles.map((row, i) => {
                const id = rowKey(row);
                const sem = semaforo?.(row) ?? null;
                const val = validacion?.(row) ?? null;
                const critica = sem === "rojo";
                const seleccionada = seleccion?.ids.has(id) ?? false;
                const vUi = val ? VALIDACION_UI[val.tipo] : null;
                return (
                  <Fragment key={id}>
                    <tr
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={i < 10 ? "fd-reveal" : undefined}
                      style={{
                        cursor: onRowClick ? "pointer" : undefined,
                        background: seleccionada ? "var(--color-surface-selected)" : undefined,
                        animationDelay: i < 10 ? `${i * 40}ms` : undefined,
                        transition: "background 150ms var(--ease-out-expo)",
                      }}
                      onMouseEnter={(e) => {
                        if (!seleccionada) e.currentTarget.style.background = "var(--color-surface-2)";
                      }}
                      onMouseLeave={(e) => {
                        if (!seleccionada) e.currentTarget.style.background = "";
                      }}
                    >
                      {seleccion && (
                        <td style={{ ...TD_BASE, width: 34, padding: "8px 10px" }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`seleccionar fila ${id}`}
                            checked={seleccionada}
                            disabled={seleccion.disabled?.(id) ?? false}
                            onChange={() => toggleFila(id)}
                          />
                        </td>
                      )}
                      {semaforo && (
                        <td
                          style={{
                            ...TD_BASE,
                            width: 26,
                            padding: "8px 8px 8px 12px",
                            borderLeft: critica ? "2px solid var(--color-status-red)" : "2px solid transparent",
                          }}
                        >
                          {sem && (
                            <span
                              aria-label={`semáforo ${sem}`}
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                display: "inline-block",
                                background: DOT[sem],
                                boxShadow: critica ? "var(--shadow-glow-red-soft)" : undefined,
                              }}
                            />
                          )}
                        </td>
                      )}
                      {columns.map((c, ci) => (
                        <td
                          key={c.key}
                          className={`${c.numeric ? "mono " : ""}${c.hideOnMobile ? "hide-sm" : ""}`}
                          style={{
                            ...TD_BASE,
                            textAlign: alignOf(c),
                            borderLeft:
                              !semaforo && !seleccion && ci === 0 && critica
                                ? "2px solid var(--color-status-red)"
                                : undefined,
                          }}
                        >
                          {c.render(row)}
                        </td>
                      ))}
                      {validacion && (
                        <td style={{ ...TD_BASE, width: 40, textAlign: "center" }}>
                          {vUi && (
                            <span
                              title={val?.mensaje}
                              aria-label={`validación: ${val!.tipo}`}
                              style={{
                                display: "inline-grid",
                                placeItems: "center",
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                fontSize: 12,
                                color: vUi.color,
                                background: vUi.bg,
                                border: `1px solid ${vUi.border}`,
                              }}
                            >
                              <i className={`ti ${vUi.icon}`} aria-hidden />
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                    {val?.mensaje && (
                      <tr>
                        <td
                          colSpan={nCols}
                          style={{
                            padding: "5px 12px 7px 44px",
                            fontSize: 11.5,
                            color: vUi!.color,
                            background: vUi!.bg,
                            borderBottom: "1px solid var(--color-border-subtle)",
                            borderLeft: `2px solid ${vUi!.color}`,
                          }}
                        >
                          {val.mensaje}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* paginación */}
      {pageSize && !loading && !errorState && sorted.length > pageSize && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 4px 0",
            fontSize: 11.5,
            color: "var(--color-text-muted)",
          }}
        >
          <span className="mono">
            {pageClamped * pageSize + 1}–{Math.min((pageClamped + 1) * pageSize, sorted.length)} de {sorted.length}
          </span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => setPage(Math.max(0, pageClamped - 1))}
            disabled={pageClamped === 0}
            style={{ minHeight: 0, padding: "3px 10px", fontSize: 12 }}
          >
            ‹ anterior
          </button>
          <span className="mono">
            {pageClamped + 1}/{pages}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(pages - 1, pageClamped + 1))}
            disabled={pageClamped >= pages - 1}
            style={{ minHeight: 0, padding: "3px 10px", fontSize: 12 }}
          >
            siguiente ›
          </button>
        </div>
      )}
    </div>
  );
}
