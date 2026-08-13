-- Conversational Voice AI (ADR-010 / HLD 2.4.0)
-- Staff drafts + conversation state BEFORE Peace Letter.
-- Family: no SELECT. Do not hash transcripts (ADR-005).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.voice_conversation_status AS ENUM (
  'active',
  'awaiting_staff',
  'ready_to_merge',
  'merged',
  'abandoned'
);

CREATE TYPE public.voice_turn_role AS ENUM (
  'staff',
  'assistant'
);

CREATE TYPE public.voice_draft_status AS ENUM (
  'open',
  'awaiting_staff',
  'ready_to_merge',
  'merged',
  'discarded'
);

CREATE TYPE public.voice_clinical_handling AS ENUM (
  'staff_internal',
  'redact'
);

-- ---------------------------------------------------------------------------
-- voice_conversations — one open thread per patient per care-day
-- ---------------------------------------------------------------------------
CREATE TABLE public.voice_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  local_date date NOT NULL,
  status public.voice_conversation_status NOT NULL DEFAULT 'active',
  missing_contexts text[] NOT NULL DEFAULT '{}'::text[],
  last_assistant_question text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voice_conversations_missing_contexts_chk CHECK (
    missing_contexts <@ ARRAY['mood', 'meal', 'sleep', 'activity']::text[]
  )
);

COMMENT ON TABLE public.voice_conversations IS
  'Stan rozmowy asystenta głosowego (ADR-010). Peace Letter dopiero po wieczornym merge + approved_by_user_id. Transkryptów nie haszować (ADR-005).';

COMMENT ON COLUMN public.voice_conversations.local_date IS
  'Dzień opieki (Europe/Warsaw) — grupowanie draftów do wieczornego merge.';

COMMENT ON COLUMN public.voice_conversations.missing_contexts IS
  'Brakujące konteksty: mood, meal, sleep, activity. Puste = gotowe do merge (o ile status ready_to_merge).';

CREATE UNIQUE INDEX voice_conversations_open_patient_day_uidx
  ON public.voice_conversations (patient_id, local_date)
  WHERE status IN ('active', 'awaiting_staff', 'ready_to_merge');

CREATE INDEX voice_conversations_organization_id_idx
  ON public.voice_conversations (organization_id);

CREATE INDEX voice_conversations_merge_idx
  ON public.voice_conversations (organization_id, local_date, status);

CREATE TRIGGER audit_voice_conversations_upd_del
  AFTER UPDATE OR DELETE ON public.voice_conversations
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

ALTER TABLE public.voice_conversations ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- voice_conversation_turns — staff transcripts + assistant follow-ups
-- ---------------------------------------------------------------------------
CREATE TABLE public.voice_conversation_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.voice_conversations (id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  role public.voice_turn_role NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.voice_conversation_turns IS
  'Tury rozmowy: staff = transkrypcja Whisper; assistant = krótkie pytanie uzupełniające. Nigdy kanał family. Nie haszować treści (ADR-005).';

CREATE INDEX voice_conversation_turns_conversation_id_idx
  ON public.voice_conversation_turns (conversation_id, created_at);

CREATE INDEX voice_conversation_turns_organization_id_idx
  ON public.voice_conversation_turns (organization_id);

CREATE TRIGGER audit_voice_conversation_turns_upd_del
  AFTER UPDATE OR DELETE ON public.voice_conversation_turns
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

ALTER TABLE public.voice_conversation_turns ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- voice_draft_notes — raw, unapproved clips before evening Peace Letter merge
-- ---------------------------------------------------------------------------
CREATE TABLE public.voice_draft_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  conversation_id uuid REFERENCES public.voice_conversations (id) ON DELETE SET NULL,
  turn_id uuid REFERENCES public.voice_conversation_turns (id) ON DELETE SET NULL,
  local_date date NOT NULL,
  transcript text NOT NULL,
  staff_internal_notes text NOT NULL DEFAULT '',
  family_safe_partial text,
  clinical_handling public.voice_clinical_handling NOT NULL DEFAULT 'staff_internal',
  status public.voice_draft_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.voice_draft_notes IS
  'Surowe, niezatwierdzone notatki głosowe przed wieczornym merge do Peace Letter (ADR-010). Family: brak SELECT. Żargonu klinicznego nie kopiować do family_safe_partial.';

COMMENT ON COLUMN public.voice_draft_notes.transcript IS
  'Surowa transkrypcja Whisper — tylko personel. Zakaz hashowania (ADR-005).';

COMMENT ON COLUMN public.voice_draft_notes.staff_internal_notes IS
  'Odseparowany żargon kliniczny (np. arytmia, furosemid). Nigdy Peace Letter. clinical_handling=redact → puste po redakcji org.';

COMMENT ON COLUMN public.voice_draft_notes.family_safe_partial IS
  'Kandydat rodzinny po Guardrails (godność + bez klinik). Nie jest Peace Letter — merge wieczorny + HITL.';

CREATE INDEX voice_draft_notes_organization_id_idx
  ON public.voice_draft_notes (organization_id);

CREATE INDEX voice_draft_notes_patient_day_idx
  ON public.voice_draft_notes (patient_id, local_date, status);

CREATE INDEX voice_draft_notes_merge_idx
  ON public.voice_draft_notes (organization_id, local_date, status);

CREATE TRIGGER audit_voice_draft_notes_upd_del
  AFTER UPDATE OR DELETE ON public.voice_draft_notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

ALTER TABLE public.voice_draft_notes ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS — JWT app_metadata (ADR-006). Family: zero dostępu.
-- ---------------------------------------------------------------------------
CREATE POLICY voice_conversations_superadmin_all
  ON public.voice_conversations
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY voice_conversations_staff_all_org
  ON public.voice_conversations
  FOR ALL
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY voice_conversation_turns_superadmin_all
  ON public.voice_conversation_turns
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY voice_conversation_turns_staff_all_org
  ON public.voice_conversation_turns
  FOR ALL
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY voice_draft_notes_superadmin_all
  ON public.voice_draft_notes
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY voice_draft_notes_staff_all_org
  ON public.voice_draft_notes
  FOR ALL
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_conversation_turns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_draft_notes TO authenticated;
