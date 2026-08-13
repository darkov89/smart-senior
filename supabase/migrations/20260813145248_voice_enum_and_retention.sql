-- Voice missing_contexts enum + patient archive + raw-voice retention (RODO Art. 5/17)
-- Also: archive RLS, GDPR-redacted DELETE audit, pg_cron 03:00 Europe/Warsaw.

-- ---------------------------------------------------------------------------
-- 1. voice_missing_context enum (replaces text[] + CHECK)
-- ---------------------------------------------------------------------------
CREATE TYPE public.voice_missing_context AS ENUM (
  'mood',
  'meal',
  'sleep',
  'activity'
);

ALTER TABLE public.voice_conversations
  DROP CONSTRAINT voice_conversations_missing_contexts_chk;

ALTER TABLE public.voice_conversations
  ALTER COLUMN missing_contexts DROP DEFAULT;

ALTER TABLE public.voice_conversations
  ALTER COLUMN missing_contexts TYPE public.voice_missing_context[]
  USING missing_contexts::public.voice_missing_context[];

ALTER TABLE public.voice_conversations
  ALTER COLUMN missing_contexts SET DEFAULT '{}'::public.voice_missing_context[];

COMMENT ON COLUMN public.voice_conversations.missing_contexts IS
  'Brakujące konteksty (enum voice_missing_context[]): mood, meal, sleep, activity. Puste = gotowe do merge (o ile status ready_to_merge).';

-- ---------------------------------------------------------------------------
-- 2. Patient archive flags (restriction / Art. 18 — not full Art. 17 wipe)
-- ---------------------------------------------------------------------------
ALTER TABLE public.patients
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN archived_reason text;

ALTER TABLE public.patients
  ADD CONSTRAINT patients_archived_reason_chk CHECK (
    archived_reason IS NULL
    OR archived_reason IN ('deceased', 'left_facility', 'gdpr_request')
  );

ALTER TABLE public.patients
  ADD CONSTRAINT patients_archived_pair_chk CHECK (
    (archived_at IS NULL AND archived_reason IS NULL)
    OR (archived_at IS NOT NULL AND archived_reason IS NOT NULL)
  );

COMMENT ON COLUMN public.patients.archived_at IS
  'Miękka archiwizacja. NULL = aktywny. Twarde Art. 17 = DELETE patients (CASCADE).';

COMMENT ON COLUMN public.patients.archived_reason IS
  'Powód archiwizacji: deceased | left_facility | gdpr_request.';

-- CASCADE already on patient_id FKs (verified, not recreated):
--   daily_logs, family_connections, telemetry_logs, consent_ledger,
--   polar_connections, polar_daily_activity, polar_sleep_nights,
--   polar_heart_rate_daily, polar_hrv_nights,
--   voice_conversations, voice_draft_notes
-- polar_oauth_secrets CASCADE from polar_connections.
-- voice_conversation_turns CASCADE from voice_conversations.

CREATE INDEX voice_conversations_patient_id_idx
  ON public.voice_conversations (patient_id);

CREATE INDEX polar_connections_patient_id_idx
  ON public.polar_connections (patient_id);

-- ---------------------------------------------------------------------------
-- 3. Helpers: active patient (archive gate)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.patient_is_active(p_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.id = p_patient_id
      AND p.archived_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.conversation_patient_is_active(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.voice_conversations c
    INNER JOIN public.patients p ON p.id = c.patient_id
    WHERE c.id = p_conversation_id
      AND p.archived_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.family_can_access_patient(p_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_connections fc
    INNER JOIN public.patients p ON p.id = fc.patient_id
    WHERE fc.profile_id = auth.uid()
      AND fc.patient_id = p_patient_id
      AND p.archived_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.patient_is_active(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.conversation_patient_is_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patient_is_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conversation_patient_is_active(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS: family cannot see archived; staff cannot write to archived
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS patients_staff_all_org ON public.patients;

CREATE POLICY patients_staff_select_org
  ON public.patients
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY patients_staff_insert_active
  ON public.patients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND archived_at IS NULL
  );

CREATE POLICY patients_nurse_update_active
  ON public.patients
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'nurse'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND archived_at IS NULL
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'nurse'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND archived_at IS NULL
  );

CREATE POLICY patients_org_admin_update_org
  ON public.patients
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY patients_org_admin_delete_org
  ON public.patients
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

DROP POLICY IF EXISTS daily_logs_staff_all_org ON public.daily_logs;
DROP POLICY IF EXISTS daily_logs_iot_insert ON public.daily_logs;

CREATE POLICY daily_logs_staff_select_org
  ON public.daily_logs
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY daily_logs_staff_write_active
  ON public.daily_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY daily_logs_staff_update_active
  ON public.daily_logs
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY daily_logs_staff_delete_active
  ON public.daily_logs
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY daily_logs_iot_insert
  ON public.daily_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'iot_device'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND typ_logu = 'hardware_sensor'
    AND (SELECT public.patient_is_active(patient_id))
  );

DROP POLICY IF EXISTS family_connections_staff_all_org ON public.family_connections;
DROP POLICY IF EXISTS family_connections_family_select_own ON public.family_connections;

CREATE POLICY family_connections_staff_select_org
  ON public.family_connections
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY family_connections_staff_write_active
  ON public.family_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY family_connections_staff_update_active
  ON public.family_connections
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY family_connections_staff_delete_org
  ON public.family_connections
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY family_connections_family_select_own
  ON public.family_connections
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND profile_id = (SELECT auth.uid())
    AND (SELECT public.patient_is_active(patient_id))
  );

DROP POLICY IF EXISTS voice_conversations_staff_all_org ON public.voice_conversations;

CREATE POLICY voice_conversations_staff_select_org
  ON public.voice_conversations
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY voice_conversations_staff_insert_active
  ON public.voice_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY voice_conversations_staff_update_active
  ON public.voice_conversations
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY voice_conversations_staff_delete_active
  ON public.voice_conversations
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

DROP POLICY IF EXISTS voice_conversation_turns_staff_all_org ON public.voice_conversation_turns;

CREATE POLICY voice_conversation_turns_staff_select_org
  ON public.voice_conversation_turns
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY voice_conversation_turns_staff_insert_active
  ON public.voice_conversation_turns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.conversation_patient_is_active(conversation_id))
  );

CREATE POLICY voice_conversation_turns_staff_update_active
  ON public.voice_conversation_turns
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.conversation_patient_is_active(conversation_id))
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.conversation_patient_is_active(conversation_id))
  );

CREATE POLICY voice_conversation_turns_staff_delete_active
  ON public.voice_conversation_turns
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.conversation_patient_is_active(conversation_id))
  );

DROP POLICY IF EXISTS voice_draft_notes_staff_all_org ON public.voice_draft_notes;

CREATE POLICY voice_draft_notes_staff_select_org
  ON public.voice_draft_notes
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY voice_draft_notes_staff_insert_active
  ON public.voice_draft_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY voice_draft_notes_staff_update_active
  ON public.voice_draft_notes
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY voice_draft_notes_staff_delete_active
  ON public.voice_draft_notes
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

DROP POLICY IF EXISTS consent_ledger_org_admin_all_org ON public.consent_ledger;
DROP POLICY IF EXISTS consent_ledger_family_select_own ON public.consent_ledger;

CREATE POLICY consent_ledger_org_admin_select_org
  ON public.consent_ledger
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY consent_ledger_org_admin_write_active
  ON public.consent_ledger
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY consent_ledger_org_admin_update_active
  ON public.consent_ledger
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY consent_ledger_org_admin_delete_org
  ON public.consent_ledger
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY consent_ledger_family_select_own
  ON public.consent_ledger
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND profile_id = (SELECT auth.uid())
    AND (SELECT public.patient_is_active(patient_id))
  );

DROP POLICY IF EXISTS polar_connections_org_admin_all_org ON public.polar_connections;

CREATE POLICY polar_connections_org_admin_select_org
  ON public.polar_connections
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY polar_connections_org_admin_insert_active
  ON public.polar_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY polar_connections_org_admin_update_active
  ON public.polar_connections
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY polar_connections_org_admin_delete_org
  ON public.polar_connections
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE OR REPLACE VIEW public.family_daily_reports AS
SELECT
  dl.id,
  dl.patient_id,
  dl.organization_id,
  dl.typ_logu,
  dl.processed_data,
  dl.created_at
FROM public.daily_logs dl
INNER JOIN public.patients p ON p.id = dl.patient_id
WHERE (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
  AND p.archived_at IS NULL
  AND (SELECT public.family_can_access_patient(dl.patient_id));

CREATE OR REPLACE VIEW public.family_wearable_comfort
WITH (security_invoker = true)
AS
SELECT
  COALESCE(a.patient_id, s.patient_id) AS patient_id,
  COALESCE(a.organization_id, s.organization_id) AS organization_id,
  COALESCE(a.local_date, s.local_date) AS local_date,
  a.steps,
  a.active_duration_seconds,
  s.duration_seconds AS sleep_duration_seconds,
  s.sleep_score
FROM public.polar_daily_activity a
FULL OUTER JOIN public.polar_sleep_nights s
  ON a.patient_id = s.patient_id
 AND a.local_date = s.local_date
INNER JOIN public.patients p
  ON p.id = COALESCE(a.patient_id, s.patient_id)
 AND p.archived_at IS NULL;

GRANT SELECT ON public.family_daily_reports TO authenticated;
GRANT SELECT ON public.family_wearable_comfort TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Audit: DELETE on sensitive tables stores redacted payload (Art. 17)
-- UPDATE still keeps full snapshots (ISO accountability).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_record_id uuid;
  v_ip text;
  v_old jsonb;
  v_new jsonb;
  v_redact_delete boolean;
BEGIN
  BEGIN
    v_ip := NULLIF(
      current_setting('request.headers', true)::json ->> 'x-forwarded-for',
      ''
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  v_redact_delete := TG_OP = 'DELETE' AND TG_TABLE_NAME IN (
    'patients',
    'daily_logs',
    'voice_conversations',
    'voice_conversation_turns',
    'voice_draft_notes',
    'telemetry_logs',
    'polar_daily_activity',
    'polar_sleep_nights',
    'polar_heart_rate_daily',
    'polar_hrv_nights',
    'polar_connections',
    'consent_ledger',
    'family_connections'
  );

  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    IF TG_TABLE_NAME = 'organizations' THEN
      v_org := OLD.id;
    ELSE
      v_org := OLD.organization_id;
    END IF;

    IF v_redact_delete THEN
      v_old := jsonb_build_object('payload', '[REDACTED DUE TO GDPR]');
    ELSE
      v_old := to_jsonb(OLD);
    END IF;

    INSERT INTO public.audit_logs (
      organization_id, actor_id, table_name, record_id, action, old_data, new_data, ip_address
    ) VALUES (
      v_org, auth.uid(), TG_TABLE_NAME, v_record_id, 'DELETE', v_old, NULL, v_ip
    );
    RETURN OLD;
  END IF;

  v_record_id := NEW.id;
  IF TG_TABLE_NAME = 'organizations' THEN
    v_org := NEW.id;
  ELSE
    v_org := NEW.organization_id;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  INSERT INTO public.audit_logs (
    organization_id, actor_id, table_name, record_id, action, old_data, new_data, ip_address
  ) VALUES (
    v_org, auth.uid(), TG_TABLE_NAME, v_record_id, 'UPDATE', v_old, v_new, v_ip
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.audit_row_change() IS
  'ISO audit UPDATE/DELETE. DELETE na tabelach opieki/głosu/Polar: old_data = [REDACTED DUE TO GDPR] (Art. 17).';

-- ---------------------------------------------------------------------------
-- 6. Cleanup merged/discarded raw voice after 30 days
-- Conversations use 'abandoned' (no 'discarded' on voice_conversation_status).
-- Turns have no status — keyed off parent conversation.
-- Peace Letter in daily_logs is NOT deleted.
-- ---------------------------------------------------------------------------
CREATE INDEX voice_draft_notes_retention_idx
  ON public.voice_draft_notes (created_at)
  WHERE status IN ('merged', 'discarded');

CREATE INDEX voice_conversations_retention_idx
  ON public.voice_conversations (created_at)
  WHERE status IN ('merged', 'abandoned');

CREATE OR REPLACE FUNCTION public.cleanup_old_voice_drafts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_drafts integer;
  deleted_turns integer;
  deleted_conversations integer;
  cutoff timestamptz := now() - interval '30 days';
BEGIN
  DELETE FROM public.voice_draft_notes
  WHERE status IN ('merged', 'discarded')
    AND created_at < cutoff;
  GET DIAGNOSTICS deleted_drafts = ROW_COUNT;

  DELETE FROM public.voice_conversation_turns AS turn
  USING public.voice_conversations AS conversation
  WHERE turn.conversation_id = conversation.id
    AND conversation.status IN ('merged', 'abandoned')
    AND turn.created_at < cutoff;
  GET DIAGNOSTICS deleted_turns = ROW_COUNT;

  DELETE FROM public.voice_conversations
  WHERE status IN ('merged', 'abandoned')
    AND created_at < cutoff;
  GET DIAGNOSTICS deleted_conversations = ROW_COUNT;

  RETURN jsonb_build_object(
    'drafts', deleted_drafts,
    'turns', deleted_turns,
    'conversations', deleted_conversations
  );
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_voice_drafts() IS
  'Usuwa scalone/odrzucone surowe głosówki starsze niż 30 dni. pg_cron 03:00 Europe/Warsaw + service_role. Nie rusza daily_logs. DELETE audytu jest zredagowany.';

REVOKE ALL ON FUNCTION public.cleanup_old_voice_drafts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_old_voice_drafts() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_voice_drafts() TO postgres;
GRANT EXECUTE ON FUNCTION public.cleanup_old_voice_drafts() TO service_role;

-- ---------------------------------------------------------------------------
-- 7. pg_cron — 03:00 Europe/Warsaw
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

SELECT cron.schedule(
  'cleanup-old-voice-drafts',
  '0 3 * * *',
  'SELECT public.cleanup_old_voice_drafts();'
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'cron'
      AND table_name = 'job'
      AND column_name = 'timezone'
  ) THEN
    UPDATE cron.job
    SET timezone = 'Europe/Warsaw'
    WHERE jobname = 'cleanup-old-voice-drafts';
  END IF;
END $$;
