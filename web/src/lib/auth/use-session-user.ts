"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  resolveAppRole,
  resolveOrganizationId,
  type AppRole,
} from "@/lib/auth/roles";
import { isPublicSupabaseConfigured } from "@/lib/config";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function useSessionUser() {
  const configured = isPublicSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) {
      return;
    }
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setUser(data.session?.user ?? null);
        setAccessToken(data.session?.access_token ?? null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAccessToken(session?.access_token ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [configured]);

  const role: AppRole | null = resolveAppRole(user, accessToken);
  const organizationId = resolveOrganizationId(user, accessToken);

  return { user, role, organizationId, loading };
}
