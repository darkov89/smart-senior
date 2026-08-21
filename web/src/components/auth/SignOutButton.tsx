"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/logowanie");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => {
        void signOut();
      }}
      className="text-sm font-medium text-slate-600 hover:text-slate-900"
    >
      Wyloguj się
    </button>
  );
}
