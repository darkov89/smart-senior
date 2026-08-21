"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { useSessionUser } from "@/lib/auth/use-session-user";
import { AGENDA_TYPES, agendaTypeLabel, type AgendaType } from "@/lib/copy/agenda";
import { displayResidentName } from "@/lib/copy/resident";
import { formatTimeHm, todayInWarsaw } from "@/lib/dates";
import {
  dangerButtonClass,
  fieldClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/styles";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface AgendaRow {
  id: string;
  start_time: string;
  type: string;
  title: string;
  description: string | null;
  is_communal: boolean;
  patient_id: string | null;
}

interface TemplateRow {
  id: string;
  start_time: string;
  type: string;
  title: string;
  description: string | null;
  is_communal: boolean;
}

interface ResidentOption {
  id: string;
  first_name: string;
  last_name_initial: string;
}

export default function DailyPlanPage() {
  const { showToast } = useToast();
  const { organizationId, loading } = useSessionUser();
  const [items, setItems] = useState<AgendaRow[] | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [residents, setResidents] = useState<ResidentOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AgendaType>("meal");
  const [startTime, setStartTime] = useState("08:00");
  const [description, setDescription] = useState("");
  const [communal, setCommunal] = useState(true);
  const [patientId, setPatientId] = useState("");
  const today = todayInWarsaw();

  const load = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const [agendaRes, templateRes, residentRes] = await Promise.all([
      supabase
        .from("daily_agenda")
        .select("id, start_time, type, title, description, is_communal, patient_id")
        .eq("local_date", today)
        .order("start_time"),
      supabase
        .from("daily_agenda_templates")
        .select("id, start_time, type, title, description, is_communal")
        .order("start_time"),
      supabase
        .from("patients")
        .select("id, first_name, last_name_initial")
        .is("archived_at", null)
        .order("first_name"),
    ]);
    if (agendaRes.error) {
      setError("Nie udało się wczytać planu dnia.");
      return;
    }
    setItems(agendaRes.data ?? []);
    setTemplates(templateRes.data ?? []);
    setResidents(residentRes.data ?? []);
  }, [today]);

  useEffect(() => {
    if (!loading) void load();
  }, [load, loading]);

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    const supabase = createBrowserSupabaseClient();
    const { error: insertError } = await supabase.from("daily_agenda").insert({
      organization_id: organizationId,
      local_date: today,
      title: title.trim(),
      type,
      start_time: startTime,
      description: description.trim() || null,
      is_communal: communal,
      patient_id: communal ? null : patientId || null,
    });
    if (insertError) {
      showToast("Nie udało się dodać punktu planu.", "error");
      return;
    }
    setTitle("");
    setDescription("");
    showToast("Dodano punkt planu dnia.");
    await load();
  }

  async function removeItem(id: string) {
    const supabase = createBrowserSupabaseClient();
    const { error: deleteError } = await supabase
      .from("daily_agenda")
      .delete()
      .eq("id", id);
    if (deleteError) {
      showToast("Nie udało się usunąć punktu.", "error");
      return;
    }
    await load();
  }

  async function saveAsTemplate(item: AgendaRow) {
    if (!organizationId) return;
    const supabase = createBrowserSupabaseClient();
    const { error: insertError } = await supabase
      .from("daily_agenda_templates")
      .insert({
        organization_id: organizationId,
        title: item.title,
        type: item.type,
        start_time: item.start_time,
        description: item.description,
        is_communal: item.is_communal,
      });
    if (insertError) {
      showToast("Nie udało się zapisać szablonu.", "error");
      return;
    }
    showToast("Zapisano szablon.");
    await load();
  }

  async function applyTemplate(template: TemplateRow) {
    if (!organizationId) return;
    if (!template.is_communal) {
      showToast("Szablon indywidualny dodaj z karty podopiecznego.", "info");
      return;
    }
    const supabase = createBrowserSupabaseClient();
    const { error: insertError } = await supabase.from("daily_agenda").insert({
      organization_id: organizationId,
      local_date: today,
      title: template.title,
      type: template.type,
      start_time: template.start_time,
      description: template.description,
      is_communal: template.is_communal,
      patient_id: null,
    });
    if (insertError) {
      showToast("Szablon wspólny można wstawić bez przypisania osoby.", "error");
      return;
    }
    showToast("Wstawiono punkt z szablonu.");
    await load();
  }

  if (loading || items === null) return <PageSkeleton />;
  if (error) return <ErrorPanel description={error} />;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Plan dnia</h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600">
          Wspólne punkty dla całej placówki i indywidualne dla wybranej osoby.
        </p>
      </div>

      <form
        onSubmit={addItem}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2"
      >
        <label className={labelClass}>
          Tytuł
          <input
            className={fieldClass}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className={labelClass}>
          Godzina
          <input
            className={fieldClass}
            type="time"
            required
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>
        <label className={labelClass}>
          Rodzaj
          <select
            className={fieldClass}
            value={type}
            onChange={(event) => setType(event.target.value as AgendaType)}
          >
            {AGENDA_TYPES.map((code) => (
              <option key={code} value={code}>
                {agendaTypeLabel(code)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Dla kogo
          <select
            className={fieldClass}
            value={communal ? "communal" : patientId}
            onChange={(event) => {
              if (event.target.value === "communal") {
                setCommunal(true);
                setPatientId("");
              } else {
                setCommunal(false);
                setPatientId(event.target.value);
              }
            }}
          >
            <option value="communal">Cała placówka</option>
            {residents.map((resident) => (
              <option key={resident.id} value={resident.id}>
                {displayResidentName(resident.first_name, resident.last_name_initial)}
              </option>
            ))}
          </select>
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Opis (opcjonalnie)
          <input
            className={fieldClass}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <button type="submit" className={primaryButtonClass}>
          Dodaj punkt
        </button>
      </form>

      {templates.length > 0 ? (
        <section>
          <h3 className="text-lg font-semibold">Szablony</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {templates.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => void applyTemplate(template)}
                >
                  {formatTimeHm(template.start_time)} {template.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="Plan dnia jest pusty"
          description="Dodaj posiłek, aktywność albo wizytę — bliscy zobaczą to w podglądzie."
        />
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4"
            >
              <div>
                <p className="font-semibold">
                  {formatTimeHm(item.start_time)} · {item.title}
                </p>
                <p className="text-sm text-slate-600">
                  {agendaTypeLabel(item.type)}
                  {item.is_communal ? " · wspólne" : " · indywidualne"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => void saveAsTemplate(item)}
                >
                  Zapisz jako szablon
                </button>
                <button
                  type="button"
                  className={dangerButtonClass}
                  onClick={() => void removeItem(item.id)}
                >
                  Usuń
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
