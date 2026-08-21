"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Factor } from "@supabase/supabase-js";
import { homePathForRole, roleFromUser } from "@/lib/auth/roles";
import { humanAuthError } from "@/lib/copy/human-errors";
import { fieldClass, labelClass, primaryButtonClass } from "@/lib/styles";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export default function TotpKeyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [needsEnroll, setNeedsEnroll] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;

    async function prepare() {
      const { data: factorData, error: listError } =
        await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (listError) {
        setError(humanAuthError(listError.message));
        setLoading(false);
        return;
      }

      const verified = factorData.totp.find(
        (factor: Factor) => factor.status === "verified",
      );
      if (verified) {
        setFactorId(verified.id);
        setNeedsEnroll(false);
        setLoading(false);
        return;
      }

      const unverified = factorData.totp.find(
        (factor: Factor) => factor.status === "unverified",
      );
      if (unverified) {
        await supabase.auth.mfa.unenroll({ factorId: unverified.id });
      }

      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Pakiet Spokoju",
      });
      if (cancelled) return;
      if (enrollError || !enrolled) {
        setError(humanAuthError(enrollError?.message));
        setLoading(false);
        return;
      }

      setFactorId(enrolled.id);
      setQrCode(enrolled.totp.qr_code);
      setNeedsEnroll(true);
      setLoading(false);
    }

    void prepare();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setError(humanAuthError(challengeError?.message));
      setBusy(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError(humanAuthError(verifyError.message));
      setBusy(false);
      return;
    }

    const { data } = await supabase.auth.getUser();
    router.replace(homePathForRole(roleFromUser(data.user)));
    router.refresh();
  }

  if (loading) {
    return <PageSkeleton lines={3} />;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Potwierdź logowanie kodem
        </h1>
        <p className="mt-2 text-base leading-relaxed text-slate-600">
          {needsEnroll
            ? "Zeskanuj kod aplikacją uwierzytelniającą, a potem wpisz sześć cyfr."
            : "Wpisz sześć cyfr z aplikacji uwierzytelniającej."}
        </p>
      </div>

      {qrCode ? (
        <div className="flex justify-center rounded-2xl bg-white p-4">
          {/* QR is an SVG data URL from Auth — not a resident identifier */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCode} alt="Kod do zeskanowania w aplikacji" className="h-48 w-48" />
        </div>
      ) : null}

      <label className={labelClass}>
        Kod z aplikacji
        <input
          className={fieldClass}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        />
      </label>

      {error ? <ErrorPanel description={error} /> : null}

      <button type="submit" className={primaryButtonClass} disabled={busy}>
        {busy ? "Sprawdzamy kod…" : "Potwierdź"}
      </button>
    </form>
  );
}
