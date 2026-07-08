"use client";

// Login estático (plan 1.5, calidad de portada): panel de marca + form Flight Deck
// con validación visual en vivo. SIN lógica de auth — M2 conecta Supabase Auth,
// "olvidé mi contraseña" (reset) y "crear cuenta" (registro abierto §12.1).
// Logos reales SSB/Dow en el footer (.logo-slot) desde /public/logos/ (patrón v1).

import { useState } from "react";
import { Button } from "@/components/fd/button";
import { Field, Input } from "@/components/fd/fields";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [submitted, setSubmitted] = useState(false);

  const emailError =
    (touched.email || submitted) && email.trim() === ""
      ? "ingresá tu correo"
      : (touched.email || submitted) && !EMAIL_RE.test(email.trim())
        ? "correo inválido"
        : null;
  const passwordError = (touched.password || submitted) && password === "" ? "ingresá tu contraseña" : null;
  const valid = EMAIL_RE.test(email.trim()) && password !== "";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="login-grid">
      <div className="login-brand">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="dot-logo">S</span>
          <span className="wordmark">
            SSB<b>·</b>INTERNATIONAL
          </span>
        </div>
        <div style={{ maxWidth: 460 }}>
          <div className="login-eyebrow">Detention · Origen</div>
          <h1 className="login-h1">Control de contenedores en detention.</h1>
          <p className="login-blurb">
            Retiro, tránsito, carga y devolución de la exportación de polietileno desde Bahía Blanca — con el
            freetime de cada naviera bajo control.
          </p>
        </div>
        <div className="login-foot">
          <span>Operado por</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático de marca, sin optimización */}
          <img src="/logos/ssb-white.svg" alt="SSB International" className="logo-slot" />
          <span>·</span>
          <span>en asociación con</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- logo estático de marca */}
          <img src="/logos/dow.png" alt="Dow" className="logo-slot" />
        </div>
      </div>

      <div className="login-form">
        <div style={{ width: "100%", maxWidth: 340 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px", fontFamily: "var(--font-display)" }}>
            Ingresar
          </h2>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "0 0 24px" }}>
            Acceso operativo · SSB International
          </p>
          <form onSubmit={onSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="correo" htmlFor="email" error={emailError}>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                error={emailError}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              />
            </Field>
            <Field label="contraseña" htmlFor="password" error={passwordError}>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                error={passwordError}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              />
            </Field>
            {submitted && valid && (
              <div
                role="status"
                style={{
                  fontSize: 12,
                  color: "var(--color-accent-500)",
                  background: "var(--color-accent-tint)",
                  border: "1px solid var(--color-accent-line)",
                  borderRadius: "var(--radius-input)",
                  padding: "8px 12px",
                }}
              >
                La autenticación se conecta en M2 — esta pantalla es estática.
              </div>
            )}
            <Button type="submit" variant="primary" style={{ padding: 11, fontSize: 13 }}>
              Ingresar
            </Button>
          </form>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              marginTop: 18,
              fontSize: 12,
            }}
          >
            {/* sin lógica — M2 conecta reset de Supabase Auth y registro abierto */}
            <a href="#" onClick={(e) => e.preventDefault()} title="Se conecta en M2">
              ¿Olvidaste tu contraseña?
            </a>
            <a href="#" onClick={(e) => e.preventDefault()} title="Se conecta en M2">
              Crear cuenta
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
