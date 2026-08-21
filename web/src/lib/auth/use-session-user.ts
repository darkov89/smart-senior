"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  organizationIdFromUser,
  roleFromUser,
  type AppRole,
} from "@/lib/auth/roles";
import { isPublicSupabaseConfigured } from "@/lib/config";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function useSessionUser() {
  const configured = isPublicSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) {
      return;
    }
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;

    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setUser(data.user);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [configured]);

  const role: AppRole | null = roleFromUser(user);
  const organizationId = organizationIdFromUser(user);

  return { user, role, organizationId, loading };
}
