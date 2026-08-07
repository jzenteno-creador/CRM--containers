"use client";

// Login con la portada 3D A4 (spec docs/superpowers/specs/2026-08-07-portada-3d-login-produccion-design.md).
// La escena es cosmética: el form es usable desde el primer paint (desktop) y el error
// de credenciales sale a los ~0,5 s como siempre. La secuencia (giro + puertas + fade,
// 3,30 s) SOLO corre con la credencial ya aceptada; al terminar, onSequenceEnd navega
// a /inicio ya prefetcheado. En mobile (≤767px) la card espera el posado del contenedor
// (decisión de John 2026-08-07: primero el contenedor, después el formulario).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import type { AuthError } from "@supabase/supabase-js";
import type { ContainerSceneHandle } from "@/components/auth/container-scene";
import { ContainerCanvas } from "@/components/auth/container-canvas";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import "./login3d.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Las 8 texturas que definen el dibujo (TEX_QUE_DEFINEN de la escena): precargarlas
// adelanta el reveal — mismo rol que los <link rel="preload"> del preview.
const PRELOAD_TEXTURES = [
  "/3d/assets/pbr/side-wall-right_albedo_ssb.webp",
  "/3d/assets/pbr/side-wall-left_albedo_ssb.webp",
  "/3d/assets/pbr/paint-body-navy_albedo_brand.webp",
  "/3d/assets/pbr/decal-white_albedo_brand.webp",
  "/3d/assets/pbr/paint-accent-orange_albedo_brand.webp",
  "/3d/assets/pbr/door-leaf-left_albedo_ssb.webp",
  "/3d/assets/pbr/door-leaf-right_albedo_ssb.webp",
  "/3d/assets/decal/csc-plate.webp",
];

function loginErrorMessage(error: AuthError): string {
  if (error.code === "invalid_credentials") return "Correo o contraseña incorrectos.";
  if (error.code === "email_not_confirmed") {
    return "Tu correo todavía no está confirmado. Buscá el mail de confirmación (revisá spam) y tocá el link antes de ingresar.";
  }
  if (error.code === "over_request_rate_limit") return "Demasiados intentos. Esperá un momento y volvé a probar.";
  if (/failed to fetch|networkerror|load failed/i.test(error.message)) {
    return "No hay conexión con el servidor. Verificá tu red y reintentá.";
  }
  return `No se pudo iniciar sesión: ${error.message}`;
}

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const sceneRef = useRef<ContainerSceneHandle | null>(null);
  const [sceneDown, setSceneDown] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  for (const href of PRELOAD_TEXTURES) preload(href, { as: "image", type: "image/webp" });

  // Ya logueado → afuera del login (el gate resuelve espera vs app); y /inicio se
  // precalienta para que la navegación al final del fade sea instantánea.
  // seqStartedRef: el login EXITOSO también flipea status a signedIn (onAuthStateChange)
  // — sin este guard, este efecto desmontaba la página en plena secuencia y las puertas
  // (1,15 s+) nunca se veían. Detectado por John en el smoke del 2026-08-07: "veo la
  // animación, no veo la apertura de puertas". Con la secuencia en vuelo navega
  // onSequenceEnd, no este efecto.
  const seqStartedRef = useRef(false);
  useEffect(() => {
    if (status === "signedIn" && !seqStartedRef.current) router.replace("/inicio");
  }, [status, router]);
  useEffect(() => {
    router.prefetch("/inicio");
  }, [router]);

  // form-ready: la clase .form-ready solo tiene efecto visual en ≤767px (la card
  // espera el posado); en desktop la card se ve siempre, así que no hace falta
  // detectar viewport. Red de seguridad: 22 s pase lo que pase — el peor camino
  // normal es reveal por timeout (15 s) + bajada completa (5,4 s) ≈ 20,4 s; esto
  // solo cubre un chunk de la escena que nunca llegó a disparar sus callbacks.
  useEffect(() => {
    const t = window.setTimeout(() => setFormReady(true), 22000);
    return () => window.clearTimeout(t);
  }, []);

  const goInicio = useCallback(() => router.replace("/inicio"), [router]);

  const emailError =
    (touched.email || submitted) && email.trim() === ""
      ? "Ingresá tu correo."
      : (touched.email || submitted) && !EMAIL_RE.test(email.trim())
        ? "Ingresá un correo con formato válido (debe incluir @)."
        : null;
  const passwordError = (touched.password || submitted) && password === "" ? "Ingresá tu contraseña." : null;
  const valid = EMAIL_RE.test(email.trim()) && password !== "";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid || submitting) return;
    setSubmitting(true);
    setAuthError(null);
    // El ref se levanta ANTES del await: el SIGNED_IN de Supabase puede emitirse en
    // cualquier orden respecto de esta continuación, y el guard tiene que estar puesto
    // cuando el efecto de arriba lo lea. Si el login falla, se baja.
    seqStartedRef.current = true;
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      seqStartedRef.current = false;
      setAuthError(loginErrorMessage(error));
      setSubmitting(false);
      return;
    }
    // Credencial aceptada: la secuencia ES la transición (giro + puertas + fade;
    // onSequenceEnd navega). submitting queda en true: bloquea el doble-submit.
    if (sceneRef.current && !sceneDown) {
      sceneRef.current.playLoginSequence();
    } else {
      goInicio(); // sin escena no hay show, pero el login jamás depende del show
    }
  };

  return (
    <div className={`login3d${formReady ? " form-ready" : ""}`}>
      {!sceneDown && (
        <ContainerCanvas
          onReady={(h) => {
            sceneRef.current = h;
          }}
          onFormReady={() => setFormReady(true)}
          onSequenceEnd={goInicio}
          onSceneError={() => {
            setSceneDown(true);
            setFormReady(true);
          }}
        />
      )}
      <div id="scrim" aria-hidden="true" />
      <main className="login-col" id="login-main">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático de marca, sin optimización */}
        <img className="logo" src="/logos/ssb-white.svg" alt="SSB International" height={40} />
        <h1 className="headline">Tus exportaciones, bajo control.</h1>
        <p className="sub">Plataforma interna de seguimiento de contenedores y documentación.</p>

        <form className="login-card" id="login-form" noValidate onSubmit={onSubmit}>
          <div className={`field${emailError ? " has-error" : ""}`}>
            <label htmlFor="email">Correo corporativo</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="nombre@ssbint.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => sceneRef.current?.setFocusZoom(true)}
              onBlur={() => {
                sceneRef.current?.setFocusZoom(false);
                setTouched((t) => ({ ...t, email: true }));
              }}
            />
            {emailError && <span className="error-text">{emailError}</span>}
          </div>
          <div className={`field${passwordError ? " has-error" : ""}`}>
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => sceneRef.current?.setFocusZoom(true)}
              onBlur={() => {
                sceneRef.current?.setFocusZoom(false);
                setTouched((t) => ({ ...t, password: true }));
              }}
            />
            {passwordError && <span className="error-text">{passwordError}</span>}
          </div>
          {authError && (
            <p className="form-error" role="alert">
              {authError}
            </p>
          )}
          <button
            type="submit"
            className={`btn-primary${submitting ? " loading" : ""}`}
            disabled={submitting}
            aria-busy={submitting}
          >
            <span className="btn-label">Ingresar</span>
            <span className="btn-spinner" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </button>
          <div className="card-links">
            <Link href="/recuperar" className="forgot-link">
              ¿Olvidaste tu contraseña?
            </Link>
            <Link href="/registro" className="forgot-link">
              Crear cuenta
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
