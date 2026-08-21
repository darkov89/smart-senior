"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  decodeJwtAal,
  homePathForRole,
  roleFromUser,
  staffNeedsAal2,
} from "@/lib/auth/roles";
import { isPublicSupabaseConfigured } from "@/lib/config";
import { humanAuthError } from "@/lib/copy/human-errors";
import { fieldClass, labelClass, primaryButtonClass } from "@/lib/styles";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ErrorPanel } from "@/components/ui/ErrorPanel";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isPublicSupabaseConfigured()) {
    return (
      <ErrorPanel description="Aplikacja nie jest jeszcze podłączona. Skontaktuj się z administratorem placówki." />
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError || !data.user) {
      setError(humanAuthError(signInError?.message));
      setBusy(false);
      return;
    }

    const role = roleFromUser(data.user);
    const aal = decodeJwtAal(data.session.access_token);
    if (staffNeedsAal2(role) && aal !== "aal2") {
      router.replace("/logowanie/klucz");
      router.refresh();
      return;
    }

    router.replace(homePathForRole(role));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Zaloguj się</h1>
        <p className="mt-2 text-base leading-relaxed text-slate-600">
          Wejdź do Pakietu Spokoju — osobno dla personelu i dla bliskich.
        </p>
      </div>

      <label className={labelClass}>
        E-mail
        <input
          className={fieldClass}
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label className={labelClass}>
        Hasło
        <input
          className={fieldClass}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      {error ? <ErrorPanel description={error} /> : null}

      <button type="submit" className={primaryButtonClass} disabled={busy}>
        {busy ? "Chwila, sprawdzamy logowanie…" : "Zaloguj się"}
      </button>

      <p className="text-sm leading-relaxed text-slate-600">
        Masz zaproszenie od placówki?{" "}
        <Link href="/aktywacja" className="font-medium text-brand-800 underline">
          Aktywuj konto
        </Link>
      </p>
    </form>
  );
}
