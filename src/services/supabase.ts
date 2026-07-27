import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly at boot rather than silently breaking every query later —
  // easier to diagnose than a wall of "supabase is not defined" errors.
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to your .env.local file."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
