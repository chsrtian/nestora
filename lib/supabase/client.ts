import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const configError =
  !supabaseUrl || !supabaseAnonKey
    ? "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    : null;

let cachedClient: SupabaseClient | null = null;

export const supabaseConfigError = configError;

export function getSupabaseClient(): SupabaseClient | null {
  if (configError) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return cachedClient;
}
