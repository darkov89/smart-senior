"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isOrgAdminRole } from "@/lib/auth/roles";
import { useSessionUser } from "@/lib/auth/use-session-user";
import { displayResidentName } from "@/lib/copy/resident";
import { primaryButtonClass } from "@/lib/styles";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

interface ResidentRow {
  id: string;
  first_name: string;
  last_name_initial: string;
  room: string | null;
  archived_at: string | null;
}

export default function PermissionsPage() {
  const { role, loading: sessionLoading } = useSessionUser();
  const [rows, setRows] = useState<ResidentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    void supabase
      .from("patients")
      .select("id, first_name, last_name_initial, room, archived_at")
      .order("first_name")
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setError("Nie udało się wczytać listy podopiecznych.");
          return;
        }
        setRows(data ?? []);
      });
  }, []);

  if (sessionLoading || rows === null) return <PageSkeleton />;
  if (error) return <ErrorPanel description={error} />;

  const active = rows.filter((row) => !row.archived_at);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Podopieczni</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600">
            Karty, zaproszenia dla bliskich i kto ma dostęp.
          </p>
        </div>
        {isOrgAdminRole(role) ? (
          <Link href="/placowka/podopieczny/nowy" className={primaryButtonClass}>
            Dodaj podopiecznego
          </Link>
        ) : null}
      </div>

      {active.length === 0 ? (
        <EmptyState
          title="Brak kart podopiecznych"
          description="Gdy administrator doda pierwszą osobę, pojawi się tutaj."
        />
      ) : (
        <ul className="grid gap-3">
          {active.map((row) => (
            <li key={row.id}>
              <Link
                href={`/placowka/podopieczny/${row.id}`}
                className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 hover:border-brand-600"
              >
                <p className="text-lg font-semibold">
                  {displayResidentName(row.first_name, row.last_name_initial)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {row.room ? `Pokój ${row.room}` : "Pokój nieustawiony"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
