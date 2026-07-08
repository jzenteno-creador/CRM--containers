"use client";

// PhotoUpload (design system M0 — UI pura; el wiring a Storage llega en M9):
// picker múltiple + previews + estados de subida por foto. El padre es dueño del
// estado (items controlados); acá solo se pinta y se emiten onAdd/onRemove.

import { useRef } from "react";
import { ProgressBar } from "./freetime-meter";

export type PhotoEstado = "pendiente" | "subiendo" | "ok" | "error";

export type PhotoItem = {
  id: string;
  /** object URL o URL remota del preview. */
  url: string;
  nombre: string;
  estado: PhotoEstado;
  /** 0-100 mientras sube. */
  progreso?: number;
  error?: string;
};

const ESTADO_UI: Record<PhotoEstado, { icon: string; color: string } | null> = {
  pendiente: null,
  subiendo: null,
  ok: { icon: "ti-check", color: "var(--color-status-green)" },
  error: { icon: "ti-alert-triangle", color: "var(--color-status-red)" },
};

export function PhotoUpload({
  items,
  onAdd,
  onRemove,
  max = 6,
  disabled = false,
  className = "",
}: {
  items: PhotoItem[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  max?: number;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const llenó = items.length >= max;

  return (
    <div className={className} style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {items.map((it) => {
        const badge = ESTADO_UI[it.estado];
        return (
          <div
            key={it.id}
            style={{
              position: "relative",
              width: 84,
              height: 84,
              borderRadius: "var(--radius-input)",
              overflow: "hidden",
              border: `1px solid ${it.estado === "error" ? "var(--color-status-red)" : "var(--color-border-strong)"}`,
              background: "var(--color-surface-2)",
            }}
          >
            {/* preview */}
            {/* eslint-disable-next-line @next/next/no-img-element -- object URLs locales, next/image no aplica */}
            <img
              src={it.url}
              alt={it.nombre}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: it.estado === "subiendo" ? 0.55 : 1,
                display: "block",
              }}
            />
            {/* progreso de subida */}
            {it.estado === "subiendo" && (
              <div style={{ position: "absolute", left: 6, right: 6, bottom: 6 }}>
                <ProgressBar pct={it.progreso ?? 30} tone="ok" height={4} minWidth={0} ariaLabel={`subiendo ${it.nombre}`} />
              </div>
            )}
            {/* badge de estado */}
            {badge && (
              <span
                aria-label={it.estado === "ok" ? "subida" : `error: ${it.error ?? "falló la subida"}`}
                title={it.error}
                style={{
                  position: "absolute",
                  left: 5,
                  bottom: 5,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11,
                  color: "var(--color-accent-ink)",
                  background: badge.color,
                }}
              >
                <i className={`ti ${badge.icon}`} aria-hidden />
              </span>
            )}
            {/* quitar */}
            {!disabled && it.estado !== "subiendo" && (
              <button
                type="button"
                aria-label={`quitar ${it.nombre}`}
                onClick={() => onRemove(it.id)}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  minHeight: 0,
                  width: 20,
                  height: 20,
                  padding: 0,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "50%",
                  border: "1px solid var(--color-border-strong)",
                  background: "rgba(4,5,7,0.7)",
                  color: "var(--color-text-primary)",
                  fontSize: 11,
                  lineHeight: 1,
                }}
              >
                <i className="ti ti-x" aria-hidden />
              </button>
            )}
          </div>
        );
      })}

      {/* picker */}
      {!llenó && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="hover:[border-color:var(--color-accent-500)!important] hover:[color:var(--color-accent-500)!important]"
          style={{
            width: 84,
            height: 84,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            border: "1px dashed var(--color-border-strong)",
            borderRadius: "var(--radius-input)",
            background: "var(--color-surface-2)",
            color: "var(--color-text-muted)",
            fontSize: 10.5,
          }}
        >
          <i className="ti ti-camera-plus" aria-hidden style={{ fontSize: 20 }} />
          agregar
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, max - items.length);
          if (files.length > 0) onAdd(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
