"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { useSessionUser } from "@/lib/auth/use-session-user";
import { displayResidentName } from "@/lib/copy/resident";
import { formatPolishDate, todayInWarsaw } from "@/lib/dates";
import { primaryButtonClass } from "@/lib/styles";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface TriageRow {
  id: string;
  content: string | null;
  patient_id: string;
  first_name: string;
  last_name_initial: string;
}

export default function TriagePage() {
  const { showToast } = useToast();
  const { user, loading } = useSessionUser();
  const [rows, setRows] = useState<TriageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todayInWarsaw();

  const load = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data, error: queryError } = await supabase
      .from("daily_reports")
      .select("id, content, patient_id, patients!daily_reports_patient_org_fkey(first_name, last_name_initial)")
      .eq("local_date", today)
      .in("status", ["ready", "approved"])
      .order("updated_at");

    if (queryError) {
      setError("Nie udało się wczytać listy do zatwierdzenia.");
      return;
    }

    setRows(
      (data ?? []).map((row) => {
        const patient = row.patients as {
          first_name: string;
          last_name_initial: string;
        } | null;
        return {
          id: row.id,
          content: row.content,
          patient_id: row.patient_id,
          first_name: patient?.first_name ?? "Podopieczny",
          last_name_initial: patient?.last_name_initial ?? "",
        };
      }),
    );
  }, [today]);

  useEffect(() => {
    if (!loading) void load();
  }, [load, loading]);

  async function approve(id: string) {
    if (!user) return;
    const now = new Date().toISOString();
    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase
      .from("daily_reports")
      .update({
        status: "published",
        approved_by: user.id,
        approved_at: now,
        published_at: now,
      })
      .eq("id", id);
    if (updateError) {
      showToast("Nie udało się zatwierdzić. Sprawdź, czy szkic ma treść.", "error");
      return;
    }
    showToast("Zatwierdzono raport.");
    await load();
  }

  if (loading || rows === null) return <PageSkeleton />;
  if (error) return <ErrorPanel description={error} />;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Wieczorne zatwierdzenie
        </h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600">
          {formatPolishDate(today)} — po zatwierdzeniu bliscy zobaczą relację.
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="Nic nie czeka na zatwierdzenie"
          description="Gdy zapiszesz szkic z karty podopiecznego, pojawi się tutaj."
        />
      ) : (
        <ul className="grid gap-4">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <p className="font-semibold">
                {displayResidentName(row.first_name, row.last_name_initial)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {row.content}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => void approve(row.id)}
                >
                  Zatwierdź
                </button>
                <Link
                  href={`/placowka/podopieczny/${row.patient_id}`}
                  className="text-sm font-medium text-brand-800"
                >
                  Otwórz kartę
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
