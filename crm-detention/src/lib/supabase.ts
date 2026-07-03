import { createClient } from "@supabase/supabase-js";

// Prototipo interno de demo: credenciales committeadas a propósito (decisión del brief).
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://cctuowthpnstvdgjuomq.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjdHVvd3RocG5zdHZkZ2p1b21xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MjkyNTUsImV4cCI6MjA5MjQwNTI1NX0.7a0cw6R1-FRVdlA5in-IVvUu2KBEM3_I7GRy_5hbGBQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
