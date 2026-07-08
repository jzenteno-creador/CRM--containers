import { createClient } from "@supabase/supabase-js";

// Cliente Supabase v2 — ENV-ONLY (plan-m0-m1 §0): sin URL/key hardcodeadas.
// Addendum §21 (2026-07-08): v2 vive en el schema `crm` del proyecto compartido
// cctuowthpnstvdgjuomq — `detention` (v1) y `public` (ssb-export-dashboard) son
// intocables, por eso el schema va fijo acá y NUNCA se sobreescribe por llamada.
// Lazy: en M0 no hay datasource; el cliente recién se instancia cuando un módulo
// lo usa, así el build no exige .env.local.

export const SUPABASE_SCHEMA = "crm";

function createCrmClient(url: string, anonKey: string) {
  return createClient(url, anonKey, {
    db: { schema: SUPABASE_SCHEMA },
  });
}

type CrmClient = ReturnType<typeof createCrmClient>;

let client: CrmClient | null = null;

export function getSupabase(): CrmClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — copiá .env.example a .env.local y completalo.",
    );
  }
  client = createCrmClient(url, anonKey);
  return client;
}
