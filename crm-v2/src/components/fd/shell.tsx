"use client";

// Shell Flight Deck (plan 1.4): rail izquierdo fijo 60px (desktop ≥900px) con íconos
// Tabler + tooltip + ítem activo cyan; bottom-nav en móvil. Header 58px: título
// contextual, búsqueda global (placeholder — wiring M5), campana con badge
// (placeholder — wiring M6), "?" contextual (contenido M10), reloj mono y menú de
// usuario con sesión real (M2): nombre/correo/rol + logout. La solapa Admin solo
// aparece para rol administrador (§8) — RLS sigue siendo la compuerta real.
// En móvil el header colapsa a título + campana + menú (búsqueda y "?" van al menú).

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { interpolarAyuda, type AyudaValores } from "@/lib/ayuda";
import { isRouteBuilt } from "@/lib/nav";
import { ROL_LABELS, useSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";
import { CommandPalette } from "./command-palette";
import { Dropdown, Popover } from "./dropdown";
import { HelpPanel } from "./help-panel";
import { Markdown } from "./markdown";

// Solapas §8 — Admin se filtra por rol (abajo, en FdShell). El estado "construida"
// NO vive acá: sale de ROUTE_BUILT (lib/nav.ts), fuente de verdad única. Las no
// construidas (M3+) se renderizan deshabilitadas — sin <Link>, así Next no las
// prefetchea (evita 404 en red) ni navega al click (evita 404 en pantalla).
const TABS = [
  { href: "/inicio", label: "Inicio", icon: "ti-layout-dashboard" },
  { href: "/ingreso", label: "Ingreso", icon: "ti-login-2" },
  { href: "/egreso", label: "Egreso", icon: "ti-logout-2" },
  { href: "/contenedores", label: "Contenedores", icon: "ti-list-details" },
  { href: "/alertas", label: "Alertas", icon: "ti-bell" },
  { href: "/incidencias", label: "Incidencias", icon: "ti-alert-triangle" },
  { href: "/admin", label: "Admin", icon: "ti-settings" },
  { href: "/ayuda", label: "Ayuda", icon: "ti-help-circle" },
];

const SOON_TIP = "Próximamente (M3)";

// Fallback del panel "?" cuando la solapa no tiene sección mapeada, o cuando la ayuda no
// está disponible (024 sin aplicar / sin contenido publicado). Nunca deja el panel vacío.
const HELP_FALLBACK = `La ayuda de esta solapa todavía no está disponible.

Abrí el **banco completo de consultas** desde el enlace de abajo. El contenido se edita desde **Admin → Ayuda**.`;

// Solapa → sección de crm.ayuda_contenido (inicio→dashboard; el resto coincide con el
// nombre de la solapa). /ayuda no se mapea: su "?" cae al fallback + link al banco.
const TAB_SECCION: Record<string, string> = {
  "/inicio": "dashboard",
  "/ingreso": "ingreso",
  "/egreso": "egreso",
  "/contenedores": "contenedores",
  "/alertas": "alertas",
  "/incidencias": "incidencias",
  "/admin": "admin",
};

type SeccionRow = { titulo: string; contenido_md: string; orden: number };

// Caches a nivel módulo: el copy por sección + los valores (naviera null) se leen una vez
// por sesión, sin importar cuántas veces se abra el panel.
const seccionCache = new Map<string, Promise<SeccionRow[] | null>>();
let valoresPromise: Promise<AyudaValores | null> | null = null;

function fetchSeccion(seccion: string): Promise<SeccionRow[] | null> {
  let p = seccionCache.get(seccion);
  if (!p) {
    p = (async () => {
      try {
        const { data, error } = await getSupabase()
          .from("ayuda_contenido")
          .select("titulo, contenido_md, orden")
          .eq("nivel", "seccion")
          .eq("seccion", seccion)
          .eq("publicado", true)
          .order("orden", { ascending: true });
        if (error) return null;
        return (data as SeccionRow[]) ?? [];
      } catch {
        return null; // 024 sin aplicar / red → fallback, nunca crashea
      }
    })();
    seccionCache.set(seccion, p);
  }
  return p;
}

function fetchValoresNull(): Promise<AyudaValores | null> {
  if (!valoresPromise) {
    valoresPromise = (async () => {
      try {
        const { data, error } = await getSupabase().rpc("crm_ayuda_valores", {});
        if (error) return null;
        return (data as AyudaValores | null) ?? null;
      } catch {
        return null;
      }
    })();
  }
  return valoresPromise;
}

/** Contenido del panel "?" para la sección de la solapa activa. Solo monta cuando el
 * panel está abierto (HelpPanel devuelve null si !open), así lee recién al abrirse. */
function HelpPanelContent({ seccion }: { seccion: string | null }) {
  // undefined = cargando · null = sin sección / sin contenido · array = poblado
  const [rows, setRows] = useState<SeccionRow[] | null | undefined>(seccion ? undefined : null);
  const [valores, setValores] = useState<AyudaValores | null>(null);

  // Reset al cambiar de solapa: ajuste DURANTE el render (patrón "adjusting state on prop
  // change"), no un efecto — evita el setState síncrono en efecto (regla set-state-in-effect).
  const [lastSeccion, setLastSeccion] = useState(seccion);
  if (seccion !== lastSeccion) {
    setLastSeccion(seccion);
    setRows(seccion ? undefined : null);
  }

  useEffect(() => {
    if (!seccion) return;
    let alive = true;
    void (async () => {
      const [r, v] = await Promise.all([fetchSeccion(seccion), fetchValoresNull()]);
      if (!alive) return;
      setRows(r);
      setValores(v);
    })();
    return () => {
      alive = false;
    };
  }, [seccion]);

  if (rows === undefined) {
    return (
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-text-muted)" }}>Cargando…</p>
    );
  }
  if (rows === null || rows.length === 0) {
    return <Markdown source={HELP_FALLBACK} />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {rows.map((r, i) => (
        <section key={i}>
          <div
            className="fd-display fd-display-sm"
            style={{ color: "var(--color-text-secondary)", marginBottom: 6 }}
          >
            {r.titulo}
          </div>
          <Markdown source={interpolarAyuda(r.contenido_md, valores)} />
        </section>
      ))}
    </div>
  );
}

/** Reloj en hora AR (mono). Client-only: renderiza placeholder hasta el mount. */
function ClockAR() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="fd-clock mono" suppressHydrationWarning>
      {time ?? "--:--:--"}
    </span>
  );
}

/** Espejo de crm.get_pendientes() — jsonb de CONTADORES, ya scopeado por rol en la DB
 * (reforzados_pendientes solo sup+, solicitudes_acceso solo admin: si la clave no
 * viene, esa línea no se muestra — no hace falta repetir el gate acá). */
type Pendientes = {
  pendientes_ingreso: number;
  pendientes_devolucion: number;
  alertas: { amarillo: number; rojo: number };
  reforzados_pendientes?: number;
  solicitudes_acceso?: number;
};

const BELL_LINE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  width: "100%",
  minHeight: 0,
  textAlign: "left",
  padding: "8px 14px",
  border: "none",
  borderRadius: 0,
  background: "transparent",
  fontSize: 12.5,
  color: "var(--color-text-secondary)",
};

/** Una categoría de pendientes: ícono + label + contador + navegación al click. */
function BellLine({
  icon,
  label,
  count,
  tone = "neutro",
  onClick,
}: {
  icon: string;
  label: string;
  count: number;
  tone?: "rojo" | "amarillo" | "neutro";
  onClick: () => void;
}) {
  const dotColor =
    tone === "rojo" ? "var(--color-status-red)" : tone === "amarillo" ? "var(--color-status-amber)" : "var(--color-text-muted)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:[background:var(--color-surface-2)!important]"
      style={{ ...BELL_LINE, cursor: "pointer", opacity: count === 0 ? 0.6 : 1 }}
    >
      <i className={`ti ${icon}`} aria-hidden style={{ fontSize: 15, color: dotColor, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{label}</span>
      <span className="mono" style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
        {count}
      </span>
    </button>
  );
}

/** Campana de notificaciones (M6): get_pendientes() refresca al montar, al recuperar
 * foco/visibilidad y cada 60s SOLO si la pestaña está visible. El badge del ícono
 * es SOLO alertas.rojo (decisión de producto — los amarillos son línea informativa
 * dentro del popover, sin badge). Si la RPC falla: sin badge, en silencio (ningún
 * toast ni error visible; el popover cerrado no muestra nada raro). */
function NotificationBell() {
  const router = useRouter();
  const { perfil } = useSession();
  const [data, setData] = useState<Pendientes | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data: d, error } = await getSupabase().rpc("get_pendientes");
    if (error) {
      // en silencio: sin toast, sin FormAlert — solo se cae a "sin datos"
      setData(null);
      setLoaded(true);
      return;
    }
    setData(d as Pendientes);
    setLoaded(true);
  }, []);

  useEffect(() => {
    // IIFE async: los setState de load() quedan detrás del await (set-state-in-effect)
    void (async () => {
      await load();
    })();
  }, [load]);

  // refresh: foco de ventana + visibilitychange→visible (cubre volver de otra pestaña
  // sin pasar por focus, ej. atajo de teclado del OS)
  useEffect(() => {
    const onFocus = () => void load();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  // intervalo 60s SOLO con la pestaña visible (se limpia siempre al desmontar)
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const rojo = data?.alertas.rojo ?? 0;
  const badgeLabel = rojo > 9 ? "9+" : String(rojo);
  const canSupAdmin = perfil?.rol === "supervisor" || perfil?.rol === "administrador";
  const isAdmin = perfil?.rol === "administrador";

  return (
    <Popover
      align="right"
      width={300}
      trigger={(p) => (
        <button
          type="button"
          className="fd-iconbtn"
          title="Notificaciones"
          aria-label={rojo > 0 ? `notificaciones — ${rojo} alerta${rojo === 1 ? "" : "s"} vencida${rojo === 1 ? "" : "s"}` : "notificaciones"}
          onClick={p.toggle}
          aria-expanded={p["aria-expanded"]}
          aria-controls={p["aria-controls"]}
        >
          <i className="ti ti-bell" aria-hidden />
          {rojo > 0 && <span className="fd-badge-count">{badgeLabel}</span>}
        </button>
      )}
    >
      {(close) => (
        <div style={{ padding: "6px 0" }}>
          <div className="fd-label" style={{ padding: "8px 14px 6px" }}>
            Notificaciones
          </div>
          {!loaded ? (
            <p style={{ margin: 0, padding: "6px 14px 12px", fontSize: 12, color: "var(--color-text-muted)" }}>
              Cargando…
            </p>
          ) : data === null ? (
            <p style={{ margin: 0, padding: "6px 14px 12px", fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              No se pudieron cargar los pendientes por ahora.
            </p>
          ) : (
            <>
              <BellLine
                icon="ti-login-2"
                label="pendientes de ingreso"
                count={data.pendientes_ingreso}
                onClick={() => {
                  close();
                  router.push("/ingreso");
                }}
              />
              <BellLine
                icon="ti-logout-2"
                label="pendientes de devolución"
                count={data.pendientes_devolucion}
                onClick={() => {
                  close();
                  router.push("/egreso");
                }}
              />
              <BellLine
                icon="ti-bell"
                label="alertas vencidas"
                count={data.alertas.rojo}
                tone="rojo"
                onClick={() => {
                  close();
                  router.push("/alertas?semaforo=rojo");
                }}
              />
              {data.alertas.amarillo > 0 && (
                <div style={{ padding: "2px 14px 8px", fontSize: 11, color: "var(--color-status-amber)" }}>
                  <i className="ti ti-alert-triangle" aria-hidden /> {data.alertas.amarillo} por vencer (amarillo) — ver
                  en la solapa Alertas
                </div>
              )}
              {canSupAdmin && data.reforzados_pendientes !== undefined && (
                <BellLine
                  icon="ti-shield-check"
                  label="reforzados por validar"
                  count={data.reforzados_pendientes}
                  onClick={() => {
                    close();
                    router.push("/contenedores");
                  }}
                />
              )}
              {isAdmin && data.solicitudes_acceso !== undefined && (
                <BellLine
                  icon="ti-user-question"
                  label="solicitudes de acceso"
                  count={data.solicitudes_acceso}
                  onClick={() => {
                    close();
                    router.push("/admin/solicitudes");
                  }}
                />
              )}
            </>
          )}
        </div>
      )}
    </Popover>
  );
}

/** Iniciales para el avatar (display): 2 letras del nombre, fallback correo. */
function initialsOf(name: string | null, email: string | null): string {
  const source = (name ?? "").trim() || email || "";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase() || "—";
}

export function FdShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { displayName, email, perfil, signOut } = useSession();
  const [helpOpen, setHelpOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // §8: Admin solo para administradores (el rol viene de perfil(), no de metadata)
  const tabs = TABS.filter((t) => t.href !== "/admin" || perfil?.rol === "administrador");

  const activeTab = tabs.find((t) => pathname.startsWith(t.href));
  const title = activeTab?.label ?? "SSB·DETENTION";
  const activeSeccion = activeTab ? (TAB_SECCION[activeTab.href] ?? null) : null;

  const openSearch = () => window.dispatchEvent(new CustomEvent("fd-palette"));

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    router.replace("/login");
  };

  return (
    <div className="fd-shell">
      <CommandPalette />
      <HelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={title}
        footer={
          isRouteBuilt("/ayuda") ? (
            <Link
              href={activeSeccion ? `/ayuda?seccion=${activeSeccion}` : "/ayuda"}
              onClick={() => setHelpOpen(false)}
            >
              Ver el banco completo de consultas →
            </Link>
          ) : (
            <span style={{ color: "var(--color-text-faint)" }}>Banco de consultas — {SOON_TIP}</span>
          )
        }
      >
        <HelpPanelContent seccion={activeSeccion} />
      </HelpPanel>

      {/* rail desktop */}
      <aside className="fd-rail">
        <span className="dot-logo fd-rail-logo" title="SSB · DETENTION">
          S
        </span>
        {tabs.map((t) =>
          isRouteBuilt(t.href) ? (
            <Link key={t.href} href={t.href} className={pathname.startsWith(t.href) ? "active" : ""} aria-label={t.label}>
              <i className={`ti ${t.icon}`} aria-hidden />
              <span className="fd-tip">{t.label}</span>
            </Link>
          ) : (
            <span key={t.href} className="fd-soon" aria-disabled="true" aria-label={`${t.label} — ${SOON_TIP}`}>
              <i className={`ti ${t.icon}`} aria-hidden />
              <span className="fd-tip">
                {t.label} · {SOON_TIP}
              </span>
            </span>
          ),
        )}
        <span className="fd-rail-spacer" />
      </aside>

      <div className="fd-main">
        <header className="fd-header">
          <span className="fd-title fd-display">{title}</span>
          {pathname.startsWith("/inicio") && (
            <span className="fd-live hide-md">
              <i aria-hidden /> EN VIVO
            </span>
          )}
          <span style={{ flex: 1 }} />

          {/* búsqueda global — desktop (móvil: dentro del menú) */}
          <button type="button" className="fd-kbd hide-md" title="Buscar (⌘K)" onClick={openSearch}>
            <i className="ti ti-search" aria-hidden />
            <kbd
              className="mono"
              style={{
                fontSize: 10.5,
                color: "var(--color-text-muted)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: 4,
                padding: "1px 5px",
              }}
            >
              ⌘K
            </kbd>
          </button>

          <NotificationBell />

          {/* "?" contextual — desktop (móvil: dentro del menú) */}
          <button
            type="button"
            className="fd-iconbtn hide-md"
            title="Ayuda de esta solapa"
            aria-label="ayuda de esta solapa"
            onClick={() => setHelpOpen(true)}
          >
            <i className="ti ti-help-circle" aria-hidden />
          </button>

          <ClockAR />

          {/* menú de usuario — sesión real (M2): identidad de perfil() + logout */}
          <Dropdown
            align="right"
            width={230}
            header={
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-text-primary)" }}>
                  {displayName ?? "—"}
                </div>
                {email && (
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--color-text-faint)", marginTop: 2 }}>
                    {email}
                  </div>
                )}
                {perfil?.rol && (
                  <div style={{ fontSize: 11, color: "var(--color-accent-500)", marginTop: 4 }}>
                    {ROL_LABELS[perfil.rol]}
                  </div>
                )}
              </div>
            }
            items={[
              { id: "buscar", label: "Buscar (⌘K)", icon: "ti-search", onSelect: openSearch },
              { id: "ayuda", label: "Ayuda de esta solapa", icon: "ti-help-circle", onSelect: () => setHelpOpen(true) },
              {
                id: "logout",
                label: signingOut ? "Cerrando sesión…" : "Cerrar sesión",
                icon: "ti-logout",
                danger: true,
                disabled: signingOut,
                divider: true,
                onSelect: () => void handleSignOut(),
              },
            ]}
            trigger={(p) => (
              <button
                type="button"
                title="Menú de usuario"
                aria-label="menú de usuario"
                onClick={p.toggle}
                aria-expanded={p["aria-expanded"]}
                aria-controls={p["aria-controls"]}
                style={{ border: "none", background: "transparent", padding: 0, minHeight: 0, display: "inline-flex" }}
              >
                <span className="fd-avatar">{initialsOf(displayName, email)}</span>
              </button>
            )}
          />
        </header>

        {/* re-key por ruta: view transition 250ms sin cortes secos */}
        <main key={pathname} className="fd-content fd-view">
          {children}
        </main>
      </div>

      {/* bottom-nav móvil: una línea con scroll horizontal, touch ≥44px */}
      <nav className="fd-bottombar">
        {tabs.map((t) =>
          isRouteBuilt(t.href) ? (
            <Link key={t.href} href={t.href} className={pathname.startsWith(t.href) ? "active" : ""}>
              <i className={`ti ${t.icon}`} aria-hidden />
              {t.label}
            </Link>
          ) : (
            <span key={t.href} className="fd-soon" aria-disabled="true" title={SOON_TIP}>
              <i className={`ti ${t.icon}`} aria-hidden />
              {t.label}
            </span>
          ),
        )}
      </nav>
    </div>
  );
}
