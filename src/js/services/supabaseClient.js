/**
 * Warstwa klienta Supabase — jedyne miejsce inicjalizacji SDK.
 * Frontend używa wyłącznie klucza anon / publishable; izolację danych zapewnia RLS.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { config } from '../config.js';

if (!config.supabaseUrl || !config.supabaseAnonKey) {
  throw new Error(
    'Brak konfiguracji Supabase (URL / anon key). Uzupełnij src/js/config.js.',
  );
}

/** @type {import('@supabase/supabase-js').SupabaseClient} */
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
