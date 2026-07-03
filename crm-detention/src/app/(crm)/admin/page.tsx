"use client";

// Admin: tarifas de free time versionadas, usuarios, configuración y navieras (solo administradores)

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/session-context";
import { Cargando, Vacio, ErrorMsg } from "@/components/ui";
import { hoyAR } from "@/lib/format";
import type { FreetimeOrigin, Naviera, Planta, Rol, Usuario } from "@/lib/types";

// fmtFecha parsea ISO con Date(); para columnas date 'YYYY-MM-DD' eso corre un día en AR (UTC-3).
// Formateo manual sin Date para evitar el off-by-one.
function fmtFechaDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  if (!y || !m || !dd) return d;
  return `${dd}/${m}/${y.slice(2)}`;
}

interface UsuarioRow extends Usuario {
  plantas?: { nombre: string } | null;
}

type TipoFreetime = "Detention" | "Demurrage" | "Combined";

interface FormVersion {
  naviera_id: string;
  navieraNombre: string;
  dias: string;
  tarifa: string;
  tipo: TipoFreetime;
  peligrosa: boolean;
  desde: string;
}

const ROLES: Rol[] = ["operador", "supervisor", "administrador"];

export default function AdminPage() {
  const session = useSession();

  // ── tarifas de free time ──────────────────────────────────────────────
  const [tarifas, setTarifas] = useState<FreetimeOrigin[]>([]);
  const [tarifasLoading, setTarifasLoading] = useState(true);
  const [tarifasError, setTarifasError] = useState<string | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const [formVersion, setFormVersion] = useState<FormVersion | null>(null);
  const [versionGuardando, setVersionGuardando] = useState(false);
  const [versionMsg, setVersionMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);

  const cargarTarifas = useCallback(async () => {
    setTarifasLoading(true);
    setTarifasError(null);
    try {
      const { data, error } = await supabase
        .from("freetime_origin")
        .select("*, navieras(nombre)")
        .order("vigente_desde", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as FreetimeOrigin[];
      // orden: naviera asc, luego vigente_desde desc (PostgREST no ordena el padre por columna embebida)
      rows.sort((a, b) => {
        const na = a.navieras?.nombre ?? "";
        const nb = b.navieras?.nombre ?? "";
        if (na !== nb) return na.localeCompare(nb);
        return b.vigente_desde.localeCompare(a.vigente_desde);
      });
      setTarifas(rows);
    } catch (e) {
      setTarifasError(e instanceof Error ? e.message : "error cargando tarifas");
    } finally {
      setTarifasLoading(false);
    }
  }, []);

  // ── usuarios ──────────────────────────────────────────────────────────
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(true);
  const [usuariosError, setUsuariosError] = useState<string | null>(null);
  const [usuariosMsg, setUsuariosMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);
  const [toggleandoId, setToggleandoId] = useState<string | null>(null);

  const [altaEmail, setAltaEmail] = useState("");
  const [altaNombre, setAltaNombre] = useState("");
  const [altaRol, setAltaRol] = useState<Rol>("operador");
  const [altaPlanta, setAltaPlanta] = useState("");
  const [altaPassword, setAltaPassword] = useState("");
  const [altaGuardando, setAltaGuardando] = useState(false);

  const cargarUsuarios = useCallback(async () => {
    setUsuariosLoading(true);
    setUsuariosError(null);
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, email, nombre, rol, planta_asignada_id, activo, plantas:planta_asignada_id(nombre)")
        .order("email");
      if (error) throw error;
      setUsuarios((data ?? []) as unknown as UsuarioRow[]);
    } catch (e) {
      setUsuariosError(e instanceof Error ? e.message : "error cargando usuarios");
    } finally {
      setUsuariosLoading(false);
    }
  }, []);

  // ── configuración ─────────────────────────────────────────────────────
  const [umbral, setUmbral] = useState("");
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configGuardando, setConfigGuardando] = useState(false);
  const [configMsg, setConfigMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);

  const cargarConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      const { data, error } = await supabase
        .from("configuracion")
        .select("valor")
        .eq("clave", "umbral_alerta_amarillo")
        .single();
      if (error) throw error;
      const dias = (data?.valor as { dias?: number } | null)?.dias;
      setUmbral(dias != null ? String(dias) : "");
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "error cargando configuración");
    } finally {
      setConfigLoading(false);
    }
  }, []);

  // ── plantas (read-only, y para el select de usuarios) ─────────────────
  const [plantas, setPlantas] = useState<Planta[]>([]);
  const [plantasLoading, setPlantasLoading] = useState(true);
  const [plantasError, setPlantasError] = useState<string | null>(null);

  const cargarPlantas = useCallback(async () => {
    setPlantasLoading(true);
    setPlantasError(null);
    try {
      const { data, error } = await supabase.from("plantas").select("*").order("nombre");
      if (error) throw error;
      setPlantas((data ?? []) as Planta[]);
    } catch (e) {
      setPlantasError(e instanceof Error ? e.message : "error cargando plantas");
    } finally {
      setPlantasLoading(false);
    }
  }, []);

  // ── navieras ──────────────────────────────────────────────────────────
  const [navieras, setNavieras] = useState<Naviera[]>([]);
  const [navierasLoading, setNavierasLoading] = useState(true);
  const [navierasError, setNavierasError] = useState<string | null>(null);
  const [nuevaNaviera, setNuevaNaviera] = useState("");
  const [navieraGuardando, setNavieraGuardando] = useState(false);
  const [navieraMsg, setNavieraMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);

  const cargarNavieras = useCallback(async () => {
    setNavierasLoading(true);
    setNavierasError(null);
    try {
      const { data, error } = await supabase.from("navieras").select("*").order("nombre");
      if (error) throw error;
      setNavieras((data ?? []) as Naviera[]);
    } catch (e) {
      setNavierasError(e instanceof Error ? e.message : "error cargando navieras");
    } finally {
      setNavierasLoading(false);
    }
  }, []);

  const esAdmin = session.rol === "administrador";

  useEffect(() => {
    if (!esAdmin) return;
    void cargarTarifas();
    void cargarUsuarios();
    void cargarConfig();
    void cargarPlantas();
    void cargarNavieras();
  }, [esAdmin, cargarTarifas, cargarUsuarios, cargarConfig, cargarPlantas, cargarNavieras]);

  if (!esAdmin) {
    return <div className="err">solo administradores</div>;
  }

  // ── acciones: tarifas ─────────────────────────────────────────────────
  function abrirNuevaVersion(t: FreetimeOrigin) {
    setVersionMsg(null);
    setFormVersion({
      naviera_id: t.naviera_id,
      navieraNombre: t.navieras?.nombre ?? "—",
      dias: String(t.dias_libres),
      tarifa: String(t.tarifa_usd_dia),
      tipo: t.tipo,
      peligrosa: t.aplica_carga_peligrosa,
      desde: hoyAR(),
    });
  }

  async function guardarNuevaVersion(e: React.FormEvent) {
    e.preventDefault();
    if (!formVersion) return;
    setVersionMsg(null);
    const dias = parseInt(formVersion.dias, 10);
    const tarifa = parseFloat(formVersion.tarifa);
    if (!Number.isFinite(dias) || dias < 0) {
      setVersionMsg({ tipo: "err", texto: "días libres inválidos" });
      return;
    }
    if (!Number.isFinite(tarifa) || tarifa < 0) {
      setVersionMsg({ tipo: "err", texto: "tarifa inválida" });
      return;
    }
    if (!formVersion.desde) {
      setVersionMsg({ tipo: "err", texto: "indicá la fecha de vigencia" });
      return;
    }
    setVersionGuardando(true);
    try {
      const { error } = await supabase.rpc("crm_nueva_version_freetime", {
        p_naviera: formVersion.naviera_id,
        p_dias: dias,
        p_peligrosa: formVersion.peligrosa,
        p_tipo: formVersion.tipo,
        p_tarifa: tarifa,
        p_desde: formVersion.desde,
      });
      if (error) throw error;
      setVersionMsg({ tipo: "ok", texto: "versión nueva insertada; la anterior quedó cerrada" });
      setFormVersion(null);
      await cargarTarifas();
    } catch (err) {
      setVersionMsg({
        tipo: "err",
        texto: err instanceof Error ? err.message : "error insertando la versión nueva",
      });
    } finally {
      setVersionGuardando(false);
    }
  }

  // ── acciones: usuarios ────────────────────────────────────────────────
  async function toggleActivo(u: UsuarioRow) {
    setUsuariosMsg(null);
    setToggleandoId(u.id);
    try {
      const { error } = await supabase.from("usuarios").update({ activo: !u.activo }).eq("id", u.id);
      if (error) throw error;
      setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, activo: !u.activo } : x)));
      setUsuariosMsg({
        tipo: "ok",
        texto: `usuario ${u.email} ${!u.activo ? "activado" : "desactivado"}`,
      });
    } catch (e) {
      setUsuariosMsg({
        tipo: "err",
        texto: e instanceof Error ? e.message : "error actualizando el usuario",
      });
    } finally {
      setToggleandoId(null);
    }
  }

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault();
    setUsuariosMsg(null);
    const email = altaEmail.trim().toLowerCase();
    const nombre = altaNombre.trim();
    if (!email || !nombre || !altaPassword) {
      setUsuariosMsg({ tipo: "err", texto: "email, nombre y password son obligatorios" });
      return;
    }
    if (usuarios.some((u) => u.email.toLowerCase() === email)) {
      setUsuariosMsg({ tipo: "err", texto: `ya existe un usuario con el email ${email}` });
      return;
    }
    setAltaGuardando(true);
    try {
      const { error } = await supabase.from("usuarios").insert({
        email,
        nombre,
        rol: altaRol,
        planta_asignada_id: altaPlanta || null,
        password: altaPassword,
        activo: true,
      });
      if (error) {
        if (error.code === "23505") {
          throw new Error(`ya existe un usuario con el email ${email}`);
        }
        throw error;
      }
      setUsuariosMsg({ tipo: "ok", texto: `usuario ${email} creado` });
      setAltaEmail("");
      setAltaNombre("");
      setAltaRol("operador");
      setAltaPlanta("");
      setAltaPassword("");
      await cargarUsuarios();
    } catch (err) {
      setUsuariosMsg({
        tipo: "err",
        texto: err instanceof Error ? err.message : "error creando el usuario",
      });
    } finally {
      setAltaGuardando(false);
    }
  }

  // ── acciones: configuración ───────────────────────────────────────────
  async function guardarUmbral(e: React.FormEvent) {
    e.preventDefault();
    setConfigMsg(null);
    const dias = parseInt(umbral, 10);
    if (!Number.isFinite(dias) || dias < 0) {
      setConfigMsg({ tipo: "err", texto: "umbral inválido: ingresá un número de días ≥ 0" });
      return;
    }
    setConfigGuardando(true);
    try {
      const { error } = await supabase
        .from("configuracion")
        .update({ valor: { dias } })
        .eq("clave", "umbral_alerta_amarillo");
      if (error) throw error;
      setConfigMsg({ tipo: "ok", texto: `umbral guardado: ${dias} días` });
    } catch (err) {
      setConfigMsg({
        tipo: "err",
        texto: err instanceof Error ? err.message : "error guardando la configuración",
      });
    } finally {
      setConfigGuardando(false);
    }
  }

  // ── acciones: navieras ────────────────────────────────────────────────
  async function agregarNaviera(e: React.FormEvent) {
    e.preventDefault();
    setNavieraMsg(null);
    const nombre = nuevaNaviera.trim().toUpperCase();
    if (!nombre) {
      setNavieraMsg({ tipo: "err", texto: "ingresá el nombre de la naviera" });
      return;
    }
    if (navieras.some((n) => n.nombre.toUpperCase() === nombre)) {
      setNavieraMsg({ tipo: "err", texto: `la naviera ${nombre} ya existe` });
      return;
    }
    setNavieraGuardando(true);
    try {
      const { error } = await supabase.from("navieras").insert({ nombre });
      if (error) {
        if (error.code === "23505") {
          throw new Error(`la naviera ${nombre} ya existe`);
        }
        throw error;
      }
      setNavieraMsg({ tipo: "ok", texto: `naviera ${nombre} agregada` });
      setNuevaNaviera("");
      await cargarNavieras();
    } catch (err) {
      setNavieraMsg({
        tipo: "err",
        texto: err instanceof Error ? err.message : "error agregando la naviera",
      });
    } finally {
      setNavieraGuardando(false);
    }
  }

  const tarifasVisibles = verHistorial ? tarifas : tarifas.filter((t) => t.vigente_hasta === null);

  return (
    <>
      {/* ── tarifas de free time ─────────────────────────────────────── */}
      <div className="crm-card">
        <h4>
          <i className="ti ti-clock-dollar" aria-hidden /> tarifas de free time (versionadas)
        </h4>

        <div className="filters">
          <label className="toggle">
            <input
              type="checkbox"
              checked={verHistorial}
              onChange={(e) => setVerHistorial(e.target.checked)}
            />
            ver historial completo
          </label>
        </div>

        {tarifasLoading ? (
          <Cargando />
        ) : tarifasError ? (
          <ErrorMsg msg={tarifasError} onRetry={() => void cargarTarifas()} />
        ) : tarifasVisibles.length === 0 ? (
          <Vacio msg="sin tarifas cargadas" />
        ) : (
          <div className="tblwrap">
            <table className="t">
              <thead>
                <tr>
                  <th>naviera</th>
                  <th>días libres</th>
                  <th>peligrosa</th>
                  <th>tipo</th>
                  <th>USD/día</th>
                  <th>vigencia</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tarifasVisibles.map((t) => {
                  const vigente = t.vigente_hasta === null;
                  return (
                    <tr key={t.id}>
                      <td>{t.navieras?.nombre ?? "—"}</td>
                      <td className="mono">{t.dias_libres}</td>
                      <td>{t.aplica_carga_peligrosa ? "sí" : "no"}</td>
                      <td>{t.tipo}</td>
                      <td className="mono">{t.tarifa_usd_dia}</td>
                      <td>
                        {vigente ? (
                          <>
                            {fmtFechaDate(t.vigente_desde)} ·{" "}
                            <span className="badge badge-success">vigente</span>
                          </>
                        ) : (
                          <>
                            {fmtFechaDate(t.vigente_desde)} – {fmtFechaDate(t.vigente_hasta)}
                          </>
                        )}
                      </td>
                      <td>
                        {vigente && (
                          <button type="button" onClick={() => abrirNuevaVersion(t)}>
                            <i className="ti ti-edit" aria-hidden /> nueva versión
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {formVersion && (
          <form onSubmit={guardarNuevaVersion} className="crm-card" style={{ marginTop: 10 }}>
            <h4>
              <i className="ti ti-versions" aria-hidden /> nueva versión — {formVersion.navieraNombre}
            </h4>
            <div className="grid">
              <div className="f">
                <label>días libres</label>
                <input
                  type="number"
                  min={0}
                  value={formVersion.dias}
                  onChange={(e) => setFormVersion({ ...formVersion, dias: e.target.value })}
                  required
                />
              </div>
              <div className="f">
                <label>tarifa USD/día</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formVersion.tarifa}
                  onChange={(e) => setFormVersion({ ...formVersion, tarifa: e.target.value })}
                  required
                />
              </div>
              <div className="f">
                <label>tipo</label>
                <select
                  value={formVersion.tipo}
                  onChange={(e) =>
                    setFormVersion({ ...formVersion, tipo: e.target.value as TipoFreetime })
                  }
                >
                  <option value="Detention">Detention</option>
                  <option value="Demurrage">Demurrage</option>
                  <option value="Combined">Combined</option>
                </select>
              </div>
              <div className="f">
                <label>vigente desde</label>
                <input
                  type="date"
                  value={formVersion.desde}
                  onChange={(e) => setFormVersion({ ...formVersion, desde: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="actbar">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={formVersion.peligrosa}
                  onChange={(e) => setFormVersion({ ...formVersion, peligrosa: e.target.checked })}
                />
                aplica carga peligrosa
              </label>
              <button type="submit" className="btn-primary" disabled={versionGuardando}>
                {versionGuardando ? "guardando…" : "insertar versión nueva"}
              </button>
              <button type="button" onClick={() => setFormVersion(null)} disabled={versionGuardando}>
                cancelar
              </button>
            </div>
          </form>
        )}

        {versionMsg && <div className={versionMsg.tipo}>{versionMsg.texto}</div>}

        <p className="note">
          editar inserta versión nueva y cierra la anterior con vigente_hasta — nunca UPDATE.
        </p>
      </div>

      <div className="twocol">
        {/* ── usuarios ──────────────────────────────────────────────── */}
        <div className="crm-card">
          <h4>
            <i className="ti ti-users" aria-hidden /> usuarios
          </h4>

          {usuariosLoading ? (
            <Cargando />
          ) : usuariosError ? (
            <ErrorMsg msg={usuariosError} onRetry={() => void cargarUsuarios()} />
          ) : usuarios.length === 0 ? (
            <Vacio msg="sin usuarios" />
          ) : (
            <div className="tblwrap">
              <table className="t">
                <thead>
                  <tr>
                    <th>email</th>
                    <th>nombre</th>
                    <th>rol</th>
                    <th>planta</th>
                    <th>activo</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <td className="mono">{u.email}</td>
                      <td>{u.nombre}</td>
                      <td>{u.rol}</td>
                      <td>{u.plantas?.nombre ?? "—"}</td>
                      <td>
                        <label className="toggle">
                          <input
                            type="checkbox"
                            checked={u.activo}
                            disabled={toggleandoId === u.id}
                            onChange={() => void toggleActivo(u)}
                          />
                          {u.activo ? "sí" : "no"}
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={crearUsuario}>
            <div className="grid" style={{ marginTop: 10 }}>
              <div className="f">
                <label>email</label>
                <input
                  type="email"
                  value={altaEmail}
                  onChange={(e) => setAltaEmail(e.target.value)}
                  placeholder="usuario@ssbint.com"
                  required
                />
              </div>
              <div className="f">
                <label>nombre</label>
                <input
                  type="text"
                  value={altaNombre}
                  onChange={(e) => setAltaNombre(e.target.value)}
                  required
                />
              </div>
              <div className="f">
                <label>rol</label>
                <select value={altaRol} onChange={(e) => setAltaRol(e.target.value as Rol)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="f">
                <label>planta (opcional)</label>
                <select value={altaPlanta} onChange={(e) => setAltaPlanta(e.target.value)}>
                  <option value="">— sin planta —</option>
                  {plantas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="f">
                <label>password</label>
                <input
                  type="text"
                  value={altaPassword}
                  onChange={(e) => setAltaPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="actbar">
              <button type="submit" className="btn-primary" disabled={altaGuardando}>
                {altaGuardando ? "creando…" : "crear usuario"}
              </button>
            </div>
          </form>

          {usuariosMsg && <div className={usuariosMsg.tipo}>{usuariosMsg.texto}</div>}
        </div>

        {/* ── configuración ─────────────────────────────────────────── */}
        <div className="crm-card">
          <h4>
            <i className="ti ti-settings" aria-hidden /> configuración
          </h4>

          {configLoading ? (
            <Cargando />
          ) : configError ? (
            <ErrorMsg msg={configError} onRetry={() => void cargarConfig()} />
          ) : (
            <form onSubmit={guardarUmbral}>
              <div className="grid">
                <div className="f">
                  <label>umbral de alerta (días antes del vencimiento → amarillo)</label>
                  <input
                    type="number"
                    min={0}
                    value={umbral}
                    onChange={(e) => setUmbral(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="actbar">
                <button type="submit" className="btn-primary" disabled={configGuardando}>
                  {configGuardando ? "guardando…" : "guardar"}
                </button>
              </div>
            </form>
          )}

          {configMsg && <div className={configMsg.tipo}>{configMsg.texto}</div>}

          <p className="note" style={{ marginTop: 14 }}>
            plantas
          </p>
          {plantasLoading ? (
            <Cargando />
          ) : plantasError ? (
            <ErrorMsg msg={plantasError} onRetry={() => void cargarPlantas()} />
          ) : plantas.length === 0 ? (
            <Vacio msg="sin plantas" />
          ) : (
            <div className="filters">
              {plantas.map((p) => (
                <span key={p.id} className="chip">
                  <i className="ti ti-building-factory-2" aria-hidden /> {p.nombre}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── navieras ─────────────────────────────────────────────────── */}
      <div className="crm-card">
        <h4>
          <i className="ti ti-ship" aria-hidden /> navieras
        </h4>

        {navierasLoading ? (
          <Cargando />
        ) : navierasError ? (
          <ErrorMsg msg={navierasError} onRetry={() => void cargarNavieras()} />
        ) : navieras.length === 0 ? (
          <Vacio msg="sin navieras" />
        ) : (
          <div className="filters">
            {navieras.map((n) => (
              <span key={n.id} className="chip">
                {n.nombre}
              </span>
            ))}
          </div>
        )}

        <form onSubmit={agregarNaviera}>
          <div className="actbar">
            <div className="f">
              <label>nueva naviera</label>
              <input
                type="text"
                value={nuevaNaviera}
                onChange={(e) => setNuevaNaviera(e.target.value)}
                placeholder="p. ej. MAERSK"
              />
            </div>
            <button type="submit" className="btn-primary" disabled={navieraGuardando}>
              {navieraGuardando ? "agregando…" : "agregar"}
            </button>
          </div>
        </form>

        {navieraMsg && <div className={navieraMsg.tipo}>{navieraMsg.texto}</div>}
      </div>
    </>
  );
}
