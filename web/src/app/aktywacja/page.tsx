"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isPublicSupabaseConfigured } from "@/lib/config";
import { humanAuthError } from "@/lib/copy/human-errors";
import { fieldClass, labelClass, primaryButtonClass } from "@/lib/styles";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

interface RedeemResponse {
  ok?: boolean;
  email?: string;
  error?: string;
}

function ActivationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isPublicSupabaseConfigured()) {
    return (
      <ErrorPanel description="Aplikacja nie jest jeszcze podłączona. Skontaktuj się z placówką." />
    );
  }

  if (!token) {
    return (
      <ErrorPanel
        title="Brak zaproszenia"
        description="Skontaktuj się z placówką — potrzebny jest świeży link aktywacyjny."
      />
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { data, error: invokeError } = await supabase.functions.invoke(
      "redeem-family-invitation",
      {
        body: {
          token,
          password,
          full_name: fullName.trim(),
          consent_family_portal: consent,
        },
      },
    );
    const payload = data as RedeemResponse | null;
    if (invokeError || !payload?.ok || !payload.email) {
      const code = payload?.error ?? invokeError?.message ?? "";
      if (code === "expired" || code === "revoked" || code === "invalid") {
        setError("To zaproszenie wygasło albo zostało cofnięte. Skontaktuj się z placówką.");
      } else {
        setError("Nie udało się aktywować konta. Sprawdź dane i spróbuj ponownie.");
      }
      setBusy(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password,
    });
    if (signInError) {
      setError(humanAuthError(signInError.message));
      setBusy(false);
      return;
    }
    router.replace("/rodzina");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Aktywuj konto</h1>
        <p className="mt-2 text-base leading-relaxed text-slate-600">
          Ustaw hasło i potwierdź zgodę, żeby zobaczyć relację z dnia bliskiej
          osoby.
        </p>
      </div>
      <label className={labelClass}>
        Twoje imię i nazwisko
        <input
          className={fieldClass}
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </label>
      <label className={labelClass}>
        Hasło
        <input
          className={fieldClass}
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          required
        />
        Wyrażam zgodę na przetwarzanie moich danych, żeby oglądać relację z dnia
        bliskiej osoby w Pakiecie Spokoju.
      </label>
      {error ? <ErrorPanel description={error} /> : null}
      <button type="submit" className={primaryButtonClass} disabled={busy}>
        {busy ? "Aktywujemy konto…" : "Aktywuj i wejdź"}
      </button>
    </form>
  );
}

export default function ActivationPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
          Pakiet Spokoju
        </p>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
        <Suspense fallback={<PageSkeleton />}>
          <ActivationForm />
        </Suspense>
      </main>
    </div>
  );
}
