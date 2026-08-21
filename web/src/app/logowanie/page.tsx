"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import {
  decodeJwtAal,
  destinationAfterAuth,
  resolveAppRole,
  roleFromUnknown,
} from "@/lib/auth/roles";
import { isPublicSupabaseConfigured } from "@/lib/config";
import { humanAuthError } from "@/lib/copy/human-errors";
import { fieldClass, labelClass, primaryButtonClass } from "@/lib/styles";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ErrorPanel } from "@/components/ui/ErrorPanel";

async function destinationForSignedInUser(
  supabase: ReturnType<typeof createBrowserSupabaseClient>,
  user: User,
  accessToken: string | undefined,
): Promise<string | null> {
  let token = accessToken;
  let role = resolveAppRole(user, token);
  if (!role) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = roleFromUnknown(profile?.role);
    if (role) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      token = refreshed.session?.access_token ?? token;
      role = resolveAppRole(refreshed.session?.user ?? user, token) ?? role;
    }
  }
  return destinationAfterAuth(role, decodeJwtAal(token));
}

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return (
    value === "signup" ||
    value === "invite" ||
    value === "magiclink" ||
    value === "recovery" ||
    value === "email_change" ||
    value === "email"
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAccess, setPendingAccess] = useState(false);

  useEffect(() => {
    if (!isPublicSupabaseConfigured()) return;
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;

    async function continueIfSignedIn() {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const otpType = params.get("type");
      if (tokenHash && isEmailOtpType(otpType)) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });
        if (cancelled) return;
        if (verifyError) {
          setError(humanAuthError(verifyError.message));
          return;
        }
      }

      await supabase.auth.refreshSession();
      const { data: userData } = await supabase.auth.getUser();
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled || !userData.user) return;

      const destination = await destinationForSignedInUser(
        supabase,
        userData.user,
        sessionData.session?.access_token,
      );
      if (destination) {
        router.replace(destination);
        router.refresh();
        return;
      }
      setPendingAccess(true);
    }

    void continueIfSignedIn();
    return () => {
      cancelled = true;
    };
  }, [router]);

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

    const destination = await destinationForSignedInUser(
      supabase,
      data.user,
      data.session.access_token,
    );
    if (destination) {
      router.replace(destination);
      router.refresh();
      return;
    }

    setPendingAccess(true);
    setBusy(false);
  }

  if (pendingAccess) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Konto czeka na dostęp
          </h1>
          <p className="mt-2 text-base leading-relaxed text-slate-600">
            Logowanie się udało, ale to konto nie ma jeszcze roli w Pakiecie
            Spokoju. Wyloguj się i poproś o ponowne nadanie dostępu.
          </p>
        </div>
        <SignOutButton className={primaryButtonClass} />
      </div>
    );
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
