"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/config";
import type { Database } from "@/types/database";

export function createBrowserSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseConfig();
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
