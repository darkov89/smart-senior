"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { useSessionUser } from "@/lib/auth/use-session-user";
import { agendaTypeLabel } from "@/lib/copy/agenda";
import { displayResidentName } from "@/lib/copy/resident";
import {
  formatPolishDate,
  formatTimeHm,
  todayInWarsaw,
  yesterdayInWarsaw,
} from "@/lib/dates";
import { fieldClass, primaryButtonClass } from "@/lib/styles";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface ConnectionOption {
  patient_id: string;
  first_name: string;
  last_name_initial: string;
}

interface ReportRow {
  content: string | null;
  local_date: string | null;
  published_at: string | null;
  is_ai_generated: boolean | null;
}

interface AgendaRow {
  id: string;
  start_time: string;
  title: string;
  type: string;
  is_communal: boolean;
}

const HOURLY_LIMIT = 3;

export default function FamilyHomePage() {
  const { showToast } = useToast();
  const { user, loading } = useSessionUser();
  const [connections, setConnections] = useState<ConnectionOption[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [report, setReport] = useState<ReportRow | null | undefined>(undefined);
  const [agenda, setAgenda] = useState<AgendaRow[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const today = todayInWarsaw();
  const yesterday = yesterdayInWarsaw();

  const selected = useMemo(
    () => connections?.find((row) => row.patient_id === selectedId) ?? null,
    [connections, selectedId],
  );

  const loadConnections = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data, error: queryError } = await supabase
      .from("family_connections")
      .select("patient_id, patients!family_connections_patient_id_fkey(first_name, last_name_initial, archived_at)")
      .eq("status", "active");
    if (queryError) {
      setError("Nie udało się wczytać listy bliskich.");
      return;
    }
    const options: ConnectionOption[] = (data ?? [])
      .map((row) => {
        const patient = row.patients as {
          first_name: string;
          last_name_initial: string;
          archived_at: string | null;
        } | null;
        if (!patient || patient.archived_at) return null;
        return {
          patient_id: row.patient_id,
          first_name: patient.first_name,
          last_name_initial: patient.last_name_initial,
        };
      })
      .filter((row): row is ConnectionOption => row !== null);
    setConnections(options);
    setSelectedId((current) => current || options[0]?.patient_id || "");
  }, []);

  const loadDashboard = useCallback(async (patientId: string) => {
    const supabase = createBrowserSupabaseClient();
    const [{ data: reports }, { data: agendaRows }] = await Promise.all([
      supabase
        .from("family_daily_reports")
        .select("content, local_date, published_at, is_ai_generated")
        .eq("patient_id", patientId)
        .order("local_date", { ascending: false })
        .limit(5),
      supabase
        .from("daily_agenda")
        .select("id, start_time, title, type, is_communal")
        .eq("local_date", today)
        .or(`is_communal.eq.true,patient_id.eq.${patientId}`)
        .order("start_time"),
    ]);

    const todayReport = (reports ?? []).find((row) => row.local_date === today);
    const yesterdayReport = (reports ?? []).find(
      (row) => row.local_date === yesterday,
    );
    setReport(todayReport ?? yesterdayReport ?? null);
    setAgenda(agendaRows ?? []);
  }, [today, yesterday]);

  useEffect(() => {
    if (!loading) void loadConnections();
  }, [loadConnections, loading]);

  useEffect(() => {
    if (selectedId) void loadDashboard(selectedId);
  }, [loadDashboard, selectedId]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !selected) return;
    const supabase = createBrowserSupabaseClient();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("family_messages")
      .select("id", { count: "exact", head: true })
      .eq("sender_profile_id", user.id)
      .gte("created_at", hourAgo);

    if ((count ?? 0) >= HOURLY_LIMIT) {
      showToast(
        "Wysłano maksymalną liczbę wiadomości w tej godzinie (max 3/h)",
        "error",
      );
      return;
    }

    const organizationId = user.app_metadata.organization_id;
    if (typeof organizationId !== "string") return;

    const { error: insertError } = await supabase.from("family_messages").insert({
      organization_id: organizationId,
      patient_id: selected.patient_id,
      sender_profile_id: user.id,
      content: message.trim(),
    });
    if (insertError) {
      showToast("Nie udało się wysłać wiadomości.", "error");
      return;
    }
    setMessage("");
    showToast("Wysłano wiadomość do personelu.");
  }

  if (loading || connections === null) return <PageSkeleton />;
  if (error) return <ErrorPanel description={error} />;
  if (connections.length === 0) {
    return (
      <EmptyState
        title="Brak podglądu"
        description="Skontaktuj się z placówką, żeby podpiąć Cię do bliskiej osoby."
      />
    );
  }

  const name = selected
    ? displayResidentName(selected.first_name, selected.last_name_initial)
    : "";
  const isMorningYesterday =
    report?.local_date === yesterday && report.local_date !== today;

  return (
    <section className="flex flex-1 flex-col gap-4">
      {connections.length > 1 ? (
        <label className="text-sm font-medium text-slate-800">
          Kogo oglądasz
          <select
            className={fieldClass}
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {connections.map((row) => (
              <option key={row.patient_id} value={row.patient_id}>
                {displayResidentName(row.first_name, row.last_name_initial)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-base text-slate-700">Podgląd: {name}</p>
      )}

      {report === undefined ? (
        <PageSkeleton lines={2} />
      ) : report === null ? (
        <EmptyState
          title={`To pierwszy dzień ${name}`}
          description="Pierwszy raport pojawi się dzisiaj wieczorem."
        />
      ) : (
        <article className="rounded-2xl border border-teal-100 bg-white px-4 py-5">
          <p className="text-sm font-medium text-brand-800">
            {isMorningYesterday
              ? `Wczorajszy list · ${formatPolishDate(report.local_date ?? "")}`
              : `Relacja z dnia · ${formatPolishDate(report.local_date ?? "")}`}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-slate-800">
            {report.content}
          </p>
          {report.is_ai_generated ? (
            <p className="mt-4 text-xs text-slate-500">
              Tekst przygotowany ze wsparciem AI i zatwierdzony przez personel.
            </p>
          ) : null}
        </article>
      )}

      <section className="rounded-2xl border border-teal-100 bg-white px-4 py-5">
        <h2 className="text-lg font-semibold">Plan dnia</h2>
        {agenda.length === 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Plan dnia na dziś jest w przygotowaniu…
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {agenda.map((item) => (
              <li key={item.id} className="text-sm text-slate-800">
                <span className="font-medium">{formatTimeHm(item.start_time)}</span>
                {" · "}
                {item.title}
                <span className="text-slate-500">
                  {" "}
                  ({agendaTypeLabel(item.type)}
                  {item.is_communal ? ", wspólne" : ""})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="rounded-2xl bg-slate-100 px-4 py-8 text-center">
        <p className="font-medium text-slate-900">
          Funkcja inteligentnych wskaźników komfortu jest w przygotowaniu
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Zostawiamy tu miejsce na przyszłe odczyty samopoczucia — bez alarmów
          i bez liczb z opaski.
        </p>
      </div>

      <form
        onSubmit={sendMessage}
        className="rounded-2xl border border-teal-100 bg-white px-4 py-5"
      >
        <h2 className="text-lg font-semibold">Wiadomość do personelu</h2>
        <p className="mt-1 text-sm text-slate-600">
          Krótka prośba, nie rozmowa na żywo. Do trzech wiadomości na godzinę.
        </p>
        <textarea
          className={`${fieldClass} min-h-24`}
          maxLength={2000}
          required
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button type="submit" className={`${primaryButtonClass} mt-3`}>
          Wyślij
        </button>
      </form>
    </section>
  );
}
