"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { encodeSession, SESSION_COOKIE } from "@/lib/session";
import type { Rol } from "@/lib/types";

interface UsuarioRow {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  planta_asignada_id: string | null;
  password: string;
  planta: { nombre: string } | null;
}

export async function login(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Ingresá email y contraseña." };

  let rows: UsuarioRow[];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios?select=id,email,nombre,rol,planta_asignada_id,password,planta:plantas(nombre)&email=eq.${encodeURIComponent(email)}&activo=eq.true`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return { error: `Error de conexión (${res.status}). Probá de nuevo.` };
    rows = await res.json();
  } catch {
    return { error: "No se pudo conectar con la base. Probá de nuevo." };
  }

  const user = rows[0];
  // Auth liviana de demo (prototipo interno, seguridad OFF por diseño)
  if (!user || user.password !== password) {
    return { error: "Email o contraseña incorrectos." };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession({
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    plantaId: user.planta_asignada_id,
    plantaNombre: user.planta?.nombre ?? null,
  }), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });

  redirect("/inicio");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
