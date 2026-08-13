/**
 * Publiczna konfiguracja frontendu (Cloudflare Pages — brak bundlera).
 *
 * Przeglądarka NIE czyta pliku `.env`. Tutaj trafiają wyłącznie wartości
 * publishable / anon (SUPABASE_URL, SUPABASE_ANON_KEY).
 * Nigdy: service_role, DATABASE_URL, SUPABASE_ACCESS_TOKEN, OpenAI.
 *
 * Nadpisanie runtime (opcjonalnie, np. preview): window.__SENIORSMART_CONFIG__
 */

const runtimeOverride =
  typeof window !== 'undefined' && window.__SENIORSMART_CONFIG__
    ? window.__SENIORSMART_CONFIG__
    : {};

export const config = Object.freeze({
  supabaseUrl:
    runtimeOverride.supabaseUrl ||
    'https://bmughdoqdsjfstxnnjks.supabase.co',
  supabaseAnonKey:
    runtimeOverride.supabaseAnonKey ||
    'sb_publishable_5iMxe0-L9uW41DZ4bJzx9g_wJgsp8Q1',
});
