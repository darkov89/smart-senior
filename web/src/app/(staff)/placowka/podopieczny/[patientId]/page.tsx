"use client";

import { FormEvent, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dictaphone } from "@/components/staff/Dictaphone";
import { OfflineBanner } from "@/components/staff/OfflineBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { isOrgAdminRole } from "@/lib/auth/roles";
import { useSessionUser } from "@/lib/auth/use-session-user";
import {
  RELATIONSHIP_CODES,
  relationshipLabel,
  type RelationshipCode,
} from "@/lib/copy/relationships";
import { displayResidentName } from "@/lib/copy/resident";
import { todayInWarsaw } from "@/lib/dates";
import {
  dangerButtonClass,
  fieldClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/styles";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface Resident {
  id: string;
  first_name: string;
  last_name_initial: string;
  room: string | null;
  archived_at: string | null;
  archived_reason: string | null;
}

interface ConnectionRow {
  id: string;
  relationship: string | null;
  is_primary_contact: boolean;
  status: string;
  revoked_at: string | null;
  profiles: { full_name: string } | null;
}

interface InvitationRow {
  id: string;
  email: string;
  relationship: string | null;
  status: string;
  expires_at: string;
  invite_token: string;
}

interface MessageRow {
  id: string;
  content: string;
  created_at: string;
  status: string;
}

function activationLink(token: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/aktywacja?token=${token}`;
}

export default function ResidentCardPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = use(params);
  const router = useRouter();
  const { showToast } = useToast();
  const { user, role, organizationId, loading: sessionLoading } =
    useSessionUser();
  const admin = isOrgAdminRole(role);
  const [resident, setResident] = useState<Resident | null>(null);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [reportContent, setReportContent] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRel, setInviteRel] = useState<RelationshipCode>("daughter");
  const [archiveReason, setArchiveReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const today = todayInWarsaw();
    const [{ data: patient, error: patientError }, connectionsRes, invitesRes, messagesRes, reportRes] =
      await Promise.all([
        supabase
          .from("patients")
          .select(
            "id, first_name, last_name_initial, room, archived_at, archived_reason",
          )
          .eq("id", patientId)
          .maybeSingle(),
        supabase
          .from("family_connections")
          .select("id, relationship, is_primary_contact, status, revoked_at, profiles!family_connections_profile_id_fkey(full_name)")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false }),
        supabase
          .from("family_invitations")
          .select("id, email, relationship, status, expires_at, invite_token")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false }),
        supabase
          .from("family_messages")
          .select("id, content, created_at, status")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("daily_reports")
          .select("id, content, status")
          .eq("patient_id", patientId)
          .eq("local_date", today)
          .maybeSingle(),
      ]);

    if (patientError || !patient) {
      setError("Nie znaleziono tej karty.");
      return;
    }
    setResident(patient);
    setConnections((connectionsRes.data ?? []) as ConnectionRow[]);
    setInvitations(invitesRes.data ?? []);
    setMessages(messagesRes.data ?? []);
    setReportId(reportRes.data?.id ?? null);
    setReportContent(reportRes.data?.content ?? "");
  }, [patientId]);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  if (sessionLoading || (!resident && !error)) return <PageSkeleton />;
  if (error || !resident) {
    return (
      <ErrorPanel description={error ?? "Nie znaleziono tej karty."} />
    );
  }

  const name = displayResidentName(
    resident.first_name,
    resident.last_name_initial,
  );

  async function saveSketch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !user) return;
    setBusy(true);
    const supabase = createBrowserSupabaseClient();
    const payload = {
      organization_id: organizationId,
      patient_id: patientId,
      local_date: todayInWarsaw(),
      content: reportContent.trim(),
      status: "ready" as const,
      source_log_count: 0,
      ai_model: null,
    };
    const query = reportId
      ? supabase.from("daily_reports").update(payload).eq("id", reportId)
      : supabase.from("daily_reports").insert(payload).select("id").single();
    const { data, error: saveError } = await query;
    setBusy(false);
    if (saveError) {
      showToast("Nie udało się zapisać szkicu.", "error");
      return;
    }
    if (data && "id" in data) setReportId(data.id);
    showToast("Zapisano szkic relacji.");
  }

  async function sendInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !organizationId) return;
    setBusy(true);
    const supabase = createBrowserSupabaseClient();
    const { data, error: inviteError } = await supabase
      .from("family_invitations")
      .insert({
        organization_id: organizationId,
        patient_id: patientId,
        invited_by_user_id: user.id,
        email: inviteEmail.trim().toLowerCase(),
        relationship: inviteRel,
      })
      .select("id, email, relationship, status, expires_at, invite_token")
      .single();
    setBusy(false);
    if (inviteError || !data) {
      showToast("Nie udało się przygotować zaproszenia.", "error");
      return;
    }
    setInvitations((current) => [data, ...current]);
    setInviteEmail("");
    showToast("Przygotowano zaproszenie. Skopiuj link i wyślij osobno.");
  }

  async function revokeInvitation(id: string) {
    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase
      .from("family_invitations")
      .update({ status: "revoked" })
      .eq("id", id);
    if (updateError) {
      showToast("Nie udało się cofnąć zaproszenia.", "error");
      return;
    }
    await load();
    showToast("Cofnięto zaproszenie.");
  }

  async function revokeConnection(id: string) {
    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase
      .from("family_connections")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) {
      showToast("Nie udało się cofnąć dostępu.", "error");
      return;
    }
    await load();
    showToast("Cofnięto dostęp.");
  }

  async function setPrimary(id: string) {
    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase
      .from("family_connections")
      .update({ is_primary_contact: true })
      .eq("id", id);
    if (updateError) {
      showToast("Nie udało się ustawić kontaktu głównego.", "error");
      return;
    }
    await load();
    showToast("Ustawiono kontakt główny.");
  }

  async function archiveCard() {
    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase
      .from("patients")
      .update({
        archived_at: new Date().toISOString(),
        archived_reason: archiveReason.trim() || "Zarchiwizowano w panelu",
      })
      .eq("id", patientId);
    if (updateError) {
      showToast("Nie udało się zarchiwizować karty.", "error");
      return;
    }
    showToast("Zarchiwizowano kartę. Bliscy nie zobaczą jej w podglądzie.");
    await load();
  }

  async function hardDelete() {
    const supabase = createBrowserSupabaseClient();
    const { error: deleteError } = await supabase
      .from("patients")
      .delete()
      .eq("id", patientId);
    if (deleteError) {
      showToast(
        "Nie można usunąć karty — w dzienniku dostępu są wpisy. Zarchiwizuj kartę.",
        "error",
      );
      return;
    }
    showToast("Usunięto kartę.");
    router.replace("/placowka/uprawnienia");
    router.refresh();
  }

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(activationLink(token));
    showToast("Skopiowano link aktywacyjny.");
  }

  return (
    <section className="flex flex-col gap-6">
      <OfflineBanner />
      <div>
        <Link
          href="/placowka/uprawnienia"
          className="text-sm font-medium text-brand-800"
        >
          Wróć do listy
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{name}</h2>
        <p className="mt-1 text-slate-600">
          {resident.room ? `Pokój ${resident.room}` : "Pokój nieustawiony"}
          {resident.archived_at ? " · karta zarchiwizowana" : ""}
        </p>
      </div>

      {!resident.archived_at ? <Dictaphone patientId={patientId} /> : null}

      {!resident.archived_at ? (
        <form
          onSubmit={saveSketch}
          className="rounded-2xl border border-slate-200 bg-white p-4"
        >
          <h3 className="text-lg font-semibold">Szkic relacji na dziś</h3>
          <p className="mt-1 text-sm text-slate-600">
            To ręczny tekst dla bliskich — bez automatycznego porządkowania.
            Wieczorem zatwierdzisz go na liście zatwierdzeń.
          </p>
          <textarea
            className={`${fieldClass} min-h-32`}
            value={reportContent}
            onChange={(event) => setReportContent(event.target.value)}
            required
          />
          <button type="submit" className={`${primaryButtonClass} mt-3`} disabled={busy}>
            Zapisz szkic
          </button>
        </form>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-lg font-semibold">Bliscy z dostępem</h3>
        {connections.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="Nikt jeszcze nie jest podpięty"
              description="Wyślij zaproszenie, aby bliska osoba mogła zobaczyć relację z dnia."
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {connections.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">
                    {row.profiles?.full_name || "Bliska osoba"}
                  </p>
                  <p className="text-sm text-slate-600">
                    {relationshipLabel(row.relationship)}
                    {row.is_primary_contact ? " · kontakt główny" : ""}
                    {row.status === "revoked" ? " · dostęp cofnięty" : ""}
                  </p>
                </div>
                {row.status === "active" && !resident.archived_at ? (
                  <div className="flex flex-wrap gap-2">
                    {!row.is_primary_contact ? (
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() => void setPrimary(row.id)}
                      >
                        Ustaw jako główny
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={dangerButtonClass}
                      onClick={() => void revokeConnection(row.id)}
                    >
                      Cofnij dostęp
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {admin && !resident.archived_at ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-lg font-semibold">Zaproszenie e-mail</h3>
          <p className="mt-1 text-sm text-slate-600">
            W wiadomości jest tylko wygasający link — bez imienia i bez numeru
            PESEL. Na razie skopiuj link z listy poniżej.
          </p>
          <form onSubmit={sendInvite} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              E-mail bliskiej osoby
              <input
                className={fieldClass}
                type="email"
                required
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
            </label>
            <label className={labelClass}>
              Relacja
              <select
                className={fieldClass}
                value={inviteRel}
                onChange={(event) =>
                  setInviteRel(event.target.value as RelationshipCode)
                }
              >
                {RELATIONSHIP_CODES.map((code) => (
                  <option key={code} value={code}>
                    {relationshipLabel(code)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={primaryButtonClass} disabled={busy}>
              Przygotuj zaproszenie
            </button>
          </form>
          {invitations.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">Brak zaproszeń.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {invitations.map((invite) => (
                <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{invite.email}</p>
                    <p className="text-sm text-slate-600">
                      {relationshipLabel(invite.relationship)} · {invite.status}
                    </p>
                  </div>
                  {invite.status === "pending" ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() => void copyLink(invite.invite_token)}
                      >
                        Kopiuj link
                      </button>
                      <button
                        type="button"
                        className={dangerButtonClass}
                        onClick={() => void revokeInvitation(invite.id)}
                      >
                        Cofnij
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-lg font-semibold">Wiadomości od bliskich</h3>
        {messages.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Na razie cisza.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {messages.map((message) => (
              <li key={message.id} className="rounded-xl bg-slate-50 px-3 py-3 text-sm">
                {message.content}
              </li>
            ))}
          </ul>
        )}
      </section>

      {admin ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-lg font-semibold">Archiwizacja</h3>
          <p className="mt-1 text-sm text-slate-600">
            Zarchiwizowana karta znika z podglądu rodziny. Twarde usunięcie jest
            możliwe tylko gdy dziennik dostępu na to pozwoli.
          </p>
          {!resident.archived_at ? (
            <>
              <label className={`${labelClass} mt-3`}>
                Powód (dla personelu)
                <input
                  className={fieldClass}
                  value={archiveReason}
                  onChange={(event) => setArchiveReason(event.target.value)}
                />
              </label>
              <button
                type="button"
                className={`${secondaryButtonClass} mt-3`}
                onClick={() => void archiveCard()}
              >
                Zarchiwizuj kartę
              </button>
            </>
          ) : null}
          <div className="mt-6 border-t border-slate-100 pt-4">
            {!confirmDelete ? (
              <button
                type="button"
                className={dangerButtonClass}
                onClick={() => setConfirmDelete(true)}
              >
                Usuń kartę na zawsze
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-red-800">
                  To nieodwracalne. Jeśli w dzienniku dostępu są wpisy, usunięcie
                  zostanie zablokowane — wtedy zostaw kartę zarchiwizowaną.
                </p>
                <button
                  type="button"
                  className={dangerButtonClass}
                  onClick={() => void hardDelete()}
                >
                  Tak, usuń na zawsze
                </button>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </section>
  );
}
