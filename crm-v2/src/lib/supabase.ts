import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente Supabase v2 — ENV-ONLY (plan-m0-m1 §0): sin URL/key hardcodeadas.
// Schema `public` (Decisión 3: proyecto dedicado, sin convivencia).
// Lazy: en M0 no hay datasource; el cliente recién se instancia cuando un módulo lo usa,
// así el build no exige .env.local.

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — copiá .env.example a .env.local y completalo.",
    );
  }
  client = createClient(url, anonKey);
  return client;
}
