"use client";

// Caché de catálogos (optimización 2026-08-02): navieras/plantas/depositos/
// configuracion/prefijos_restringidos/paises se pedían desde cero en CADA
// navegación (20 sitios medidos, 0% cacheado). Estos datos cambian casi nunca:
// promise-cache a nivel módulo (mismo patrón probado de field-help.tsx) con
// TTL de 5 min + invalidación explícita para los flujos que los mutan (alta
// inline de depósito, CRUD de Admin). Staleness máxima acotada: 5 minutos.
import { getSupabase } from "@/lib/supabase";

type Entrada<T> = { promise: Promise<T>; expira: number };

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, Entrada<unknown>>();

function cached<T>(clave: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(clave) as Entrada<T> | undefined;
  if (hit && Date.now() < hit.expira) return hit.promise;
  const promise = fetcher().catch((e) => {
    // un fetch fallido no se "pega" al caché: el próximo intento vuelve a la red
    cache.delete(clave);
    throw e;
  });
  cache.set(clave, { promise, expira: Date.now() + TTL_MS });
  return promise;
}

/** Invalida un catálogo (o todos). Llamar tras cualquier write que los mute:
 * alta inline de depósito, CRUD de Admin (navieras/plantas/paises/prefijos),
 * edición de configuración. */
export function invalidarCatalogo(
  clave?: "navieras" | "plantas" | "depositos" | "prefijos" | "paises" | "configuracion",
) {
  if (!clave) {
    cache.clear();
    return;
  }
  for (const k of cache.keys()) {
    if (k === clave || k.startsWith(`${clave}:`)) cache.delete(k);
  }
}

export type NavieraCat = { id: string; nombre: string };
export type PlantaCat = { id: string; nombre: string; codigo: string | null };
export type DepositoCat = { id: string; nombre: string };
export type PrefijoCat = { prefijo: string; nota: string | null };
export type PaisCat = { id: string; nombre: string; region: string | null };

export function getNavieras(): Promise<NavieraCat[]> {
  return cached("navieras", async () => {
    const { data, error } = await getSupabase()
      .from("navieras")
      .select("id, nombre")
      .eq("activa", true)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return (data as NavieraCat[]) ?? [];
  });
}

export function getPlantas(): Promise<PlantaCat[]> {
  return cached("plantas", async () => {
    const { data, error } = await getSupabase()
      .from("plantas")
      .select("id, nombre, codigo")
      .eq("activa", true)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return (data as PlantaCat[]) ?? [];
  });
}

export function getDepositos(): Promise<DepositoCat[]> {
  return cached("depositos", async () => {
    const { data, error } = await getSupabase()
      .from("depositos")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return (data as DepositoCat[]) ?? [];
  });
}

export function getPrefijosRestringidos(): Promise<PrefijoCat[]> {
  return cached("prefijos", async () => {
    const { data, error } = await getSupabase()
      .from("prefijos_restringidos")
      .select("prefijo, nota")
      .eq("activo", true);
    if (error) throw error;
    return (data as PrefijoCat[]) ?? [];
  });
}

export function getPaises(): Promise<PaisCat[]> {
  return cached("paises", async () => {
    const { data, error } = await getSupabase()
      .from("paises")
      .select("id, nombre, region")
      .order("nombre", { ascending: true });
    if (error) throw error;
    return (data as PaisCat[]) ?? [];
  });
}

/** Valor de crm.configuracion por clave (ej. "umbral_alerta_amarillo"). */
export function getConfiguracion(clave: string): Promise<string | null> {
  return cached(`configuracion:${clave}`, async () => {
    const { data, error } = await getSupabase()
      .from("configuracion")
      .select("valor")
      .eq("clave", clave)
      .maybeSingle();
    if (error) throw error;
    return (data as { valor: string } | null)?.valor ?? null;
  });
}
