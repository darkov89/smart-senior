/**
 * Publishable frontend config only. Never put service_role or LLM keys here.
 */
export function getPublicSupabaseConfig(): {
  supabaseUrl: string;
  supabaseAnonKey: string;
} {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}

export function isPublicSupabaseConfigured(): boolean {
  const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseConfig();
  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
}
