"use client";

// Piezas compartidas para estados de carga/vacío/error + paginación (spec §11: en TODOS los listados)

export function Cargando({ msg = "cargando…" }: { msg?: string }) {
  return <p className="empty">{msg}</p>;
}

export function Vacio({ msg = "sin resultados" }: { msg?: string }) {
  return <p className="empty">{msg}</p>;
}

export function ErrorMsg({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return (
    <div className="err" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span>{msg}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} style={{ padding: "3px 9px" }}>
          reintentar
        </button>
      )}
    </div>
  );
}

export function Semaforo({ estado }: { estado: "verde" | "amarillo" | "rojo" }) {
  return <span className={`dot dot-${estado}`} title={estado} />;
}

export function Paginacion({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number; // 0-based
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="actbar" style={{ justifyContent: "flex-end", alignItems: "center" }}>
      <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)}>
        ‹ anterior
      </button>
      <span className="pill">
        {page + 1} / {pages} · {total} filas
      </span>
      <button type="button" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
        siguiente ›
      </button>
    </div>
  );
}
