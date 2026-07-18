"use client";

// /vision (PoC monitoreo por cámara): detección de objetos en vivo, 100% client-side.
// Wrapper client obligatorio: en Next 16 `ssr:false` solo es legal desde un client
// component, y acá es imprescindible — getUserMedia y TF.js no existen en el server,
// sin esto el build de Vercel intenta prerenderizar la solapa y revienta.
import dynamic from "next/dynamic";

const VisionClient = dynamic(() => import("./vision-client"), {
  ssr: false,
  loading: () => (
    <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-text-muted)" }}>
      Cargando módulo de visión…
    </p>
  ),
});

export default function VisionPage() {
  return <VisionClient />;
}
