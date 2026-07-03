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

export function Semaforo({ estado }: { estado: "verde" | "amarillo" | "rojo" | "neutro" }) {
  return <span className={`dot dot-${estado}`} title={estado === "neutro" ? "sin cargo de origen aplicable" : estado} />;
}

/** Ícono de contenedor (guía de diseño): marcador de unidad en conteos y KPIs. */
export function ContainerIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      className="cont-ico"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <rect x="2" y="7" width="20" height="10" rx="1" />
      <line x1="6" y1="7" x2="6" y2="17" />
      <line x1="10" y1="7" x2="10" y2="17" />
      <line x1="14" y1="7" x2="14" y2="17" />
      <line x1="18" y1="7" x2="18" y2="17" />
    </svg>
  );
}

/** Medidor de freetime (firma de la guía): barra que se llena verde→ámbar→rojo según el semáforo. */
export function FreetimeMeter({
  estadia,
  libres,
  semaforo,
}: {
  estadia: number;
  libres: number | null;
  semaforo: "verde" | "amarillo" | "rojo" | "neutro";
}) {
  if (libres == null || libres <= 0) {
    return (
      <div className="ft-meter" title="sin freetime aplicable">
        <i className="neutro" style={{ width: "25%" }} />
      </div>
    );
  }
  const pct = Math.max(4, Math.min(100, Math.round((estadia / libres) * 100)));
  const cls =
    semaforo === "rojo" ? "over" : semaforo === "amarillo" ? "warn" : semaforo === "neutro" ? "neutro" : "ok";
  return (
    <div className="ft-meter" title={`${estadia} de ${libres} días libres`}>
      <i className={cls} style={{ width: `${pct}%` }} />
    </div>
  );
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
