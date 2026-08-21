"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OfflineBanner } from "@/components/staff/OfflineBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { displayResidentName } from "@/lib/copy/resident";
import { todayInWarsaw } from "@/lib/dates";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type DayStatus = "none" | "voice" | "ready" | "published";

interface BoardRow {
  id: string;
  first_name: string;
  last_name_initial: string;
  room: string | null;
  status: DayStatus;
}

const STATUS_LABEL: Record<DayStatus, string> = {
  none: "Brak wpisu",
  voice: "Szkic głosowy",
  ready: "Gotowy do zatwierdzenia",
  published: "Wysłany do rodziny",
};

export default function WardBoardPage() {
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const today = todayInWarsaw();

    async function load() {
      const [patientsRes, reportsRes, draftsRes] = await Promise.all([
        supabase
          .from("patients")
          .select("id, first_name, last_name_initial, room, archived_at")
          .is("archived_at", null)
          .order("first_name"),
        supabase
          .from("daily_reports")
          .select("patient_id, status")
          .eq("local_date", today),
        supabase
          .from("voice_draft_notes")
          .select("patient_id, status")
          .eq("local_date", today)
          .in("status", ["open", "awaiting_staff", "ready_to_merge"]),
      ]);

      if (patientsRes.error) {
        setError("Nie udało się wczytać tablicy oddziału.");
        return;
      }

      const reportByPatient = new Map(
        (reportsRes.data ?? []).map((row) => [row.patient_id, row.status]),
      );
      const draftPatients = new Set(
        (draftsRes.data ?? []).map((row) => row.patient_id),
      );

      setRows(
        (patientsRes.data ?? []).map((patient) => {
          const reportStatus = reportByPatient.get(patient.id);
          let status: DayStatus = "none";
          if (reportStatus === "published") status = "published";
          else if (reportStatus === "ready" || reportStatus === "approved")
            status = "ready";
          else if (draftPatients.has(patient.id)) status = "voice";
          return {
            id: patient.id,
            first_name: patient.first_name,
            last_name_initial: patient.last_name_initial,
            room: patient.room,
            status,
          };
        }),
      );
    }

    void load();
  }, []);

  if (error) return <ErrorPanel description={error} />;
  if (!rows) return <PageSkeleton />;

  return (
    <section className="flex flex-col gap-6">
      <OfflineBanner />
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Tablica oddziału</h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600">
          Kto ma już relację z dnia, a kto jeszcze czeka.
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="Brak podopiecznych na tablicy"
          description="Gdy administrator doda karty, pojawią się tutaj."
        />
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/placowka/podopieczny/${row.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 hover:border-brand-600"
              >
                <div>
                  <p className="text-lg font-semibold">
                    {displayResidentName(row.first_name, row.last_name_initial)}
                  </p>
                  <p className="text-sm text-slate-600">
                    {row.room ? `Pokój ${row.room}` : "Pokój nieustawiony"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-800">
                  {STATUS_LABEL[row.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
