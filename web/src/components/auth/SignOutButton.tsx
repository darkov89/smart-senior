"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function SignOutButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut({ scope: "global" });
    } finally {
      window.location.assign("/logowanie");
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        void signOut();
      }}
      className={
        className ??
        "text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-60"
      }
    >
      {busy ? "Wylogowujemy…" : "Wyloguj się"}
    </button>
  );
}
