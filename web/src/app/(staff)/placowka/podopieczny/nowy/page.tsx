"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { isOrgAdminRole } from "@/lib/auth/roles";
import { useSessionUser } from "@/lib/auth/use-session-user";
import { isUniqueViolation } from "@/lib/copy/human-errors";
import { fieldClass, labelClass, primaryButtonClass } from "@/lib/styles";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useToast } from "@/components/ui/ToastProvider";

interface HashPeselResponse {
  ok?: boolean;
  pesel_hash?: string;
  error?: string;
}

export default function NewResidentPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { role, organizationId, loading } = useSessionUser();
  const [firstName, setFirstName] = useState("");
  const [lastInitial, setLastInitial] = useState("");
  const [room, setRoom] = useState("");
  const [pesel, setPesel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <PageSkeleton />;
  if (!isOrgAdminRole(role) || !organizationId) {
    return (
      <ErrorPanel description="Nową kartę podopiecznego zakłada administrator placówki." />
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const peselToHash = pesel;
    setPesel("");

    const { data: hashData, error: hashError } = await supabase.functions.invoke(
      "hash-pesel",
      { body: { pesel: peselToHash } },
    );
    const payload = hashData as HashPeselResponse | null;
    if (hashError || !payload?.ok || !payload.pesel_hash) {
      setError(
        "Nie udało się zapisać karty. Sprawdź numer i spróbuj ponownie.",
      );
      setBusy(false);
      return;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("patients")
      .insert({
        organization_id: organizationId,
        first_name: firstName.trim(),
        last_name_initial: lastInitial.trim().slice(0, 1).toUpperCase(),
        room: room.trim() || null,
        pesel_hash: payload.pesel_hash,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      setError(
        isUniqueViolation(insertError)
          ? "Ten numer jest już przypisany w tej placówce."
          : "Nie udało się zapisać karty. Spróbuj ponownie.",
      );
      setBusy(false);
      return;
    }

    showToast("Zapisano kartę podopiecznego.");
    router.replace(`/placowka/podopieczny/${inserted.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Nowy podopieczny</h2>
        <p className="mt-2 text-base leading-relaxed text-slate-600">
          Imię, inicjał i pokój. Numer PESEL zostaje poza ekranem — zapisujemy
          tylko bezpieczny odcisk.
        </p>
      </div>

      <label className={labelClass}>
        Imię
        <input
          className={fieldClass}
          required
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
      </label>
      <label className={labelClass}>
        Inicjał nazwiska
        <input
          className={fieldClass}
          required
          maxLength={1}
          value={lastInitial}
          onChange={(event) =>
            setLastInitial(event.target.value.replace(/[^a-ząćęłńóśźż]/gi, ""))
          }
        />
      </label>
      <label className={labelClass}>
        Pokój
        <input
          className={fieldClass}
          value={room}
          onChange={(event) => setRoom(event.target.value)}
        />
      </label>
      <label className={labelClass}>
        PESEL
        <input
          className={fieldClass}
          inputMode="numeric"
          autoComplete="off"
          required
          maxLength={11}
          value={pesel}
          onChange={(event) => setPesel(event.target.value.replace(/\D/g, ""))}
        />
      </label>

      {error ? <ErrorPanel description={error} /> : null}

      <button type="submit" className={primaryButtonClass} disabled={busy}>
        {busy ? "Zapisujemy kartę…" : "Zapisz kartę"}
      </button>
    </form>
  );
}
