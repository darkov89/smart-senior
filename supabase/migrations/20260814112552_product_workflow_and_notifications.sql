-- Product workflow: daily_reports (family Peace Letter) + notification prefs/deliveries.
-- daily_logs remains the staff/raw ingest pipeline. No chat. No devices.
-- Pending db push — do not treat as live until applied.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.daily_report_status AS ENUM (
    'draft',
    'generating',
    'ready',
    'approved',
    'published',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_channel AS ENUM ('sms', 'email');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_delivery_status AS ENUM (
    'pending',
    'sent',
    'delivered',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 1. daily_reports — final family artifact (one per patient per local_date)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  local_date date NOT NULL,
  status public.daily_report_status NOT NULL DEFAULT 'draft',
  content text,
  source_log_count integer NOT NULL DEFAULT 0,
  ai_model text,
  ai_prompt_version text,
  generated_at timestamptz,
  approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_reports_patient_org_fkey
    FOREIGN KEY (patient_id, organization_id)
    REFERENCES public.patients (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT daily_reports_source_log_count_chk CHECK (source_log_count >= 0),
  CONSTRAINT daily_reports_patient_day_uidx UNIQUE (patient_id, local_date),
  CONSTRAINT daily_reports_approved_pair_chk CHECK (
    approved_at IS NULL OR approved_by IS NOT NULL
  ),
  CONSTRAINT daily_reports_approved_status_chk CHECK (
    status <> 'approved'
    OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  ),
  CONSTRAINT daily_reports_published_hitl_chk CHECK (
    status <> 'published'
    OR (
      content IS NOT NULL
      AND length(btrim(content)) > 0
      AND approved_by IS NOT NULL
      AND approved_at IS NOT NULL
      AND published_at IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS daily_reports_org_patient_date_idx
  ON public.daily_reports (organization_id, patient_id, local_date DESC);

CREATE INDEX IF NOT EXISTS daily_reports_org_status_idx
  ON public.daily_reports (organization_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS daily_reports_id_organization_id_uidx
  ON public.daily_reports (id, organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS daily_reports_id_patient_id_uidx
  ON public.daily_reports (id, patient_id);

COMMENT ON TABLE public.daily_reports IS
  'Raport dzienny (Peace Letter) dla rodziny. daily_logs = surowy tor personelu. Family widzi wyłącznie status=published.';
COMMENT ON COLUMN public.daily_reports.content IS
  'Tekst dla rodziny. Nie haszować (ADR-005). Publikacja wymaga HITL (approved_by + approved_at).';

CREATE OR REPLACE FUNCTION public.set_row_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS daily_reports_set_updated_at ON public.daily_reports;
CREATE TRIGGER daily_reports_set_updated_at
  BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

CREATE TRIGGER audit_daily_reports_upd_del
  AFTER UPDATE OR DELETE ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_reports_superadmin_all ON public.daily_reports;
DROP POLICY IF EXISTS daily_reports_staff_select_org ON public.daily_reports;
DROP POLICY IF EXISTS daily_reports_staff_insert_active ON public.daily_reports;
DROP POLICY IF EXISTS daily_reports_staff_update_active ON public.daily_reports;
DROP POLICY IF EXISTS daily_reports_staff_delete_org ON public.daily_reports;
DROP POLICY IF EXISTS daily_reports_family_select_published ON public.daily_reports;

CREATE POLICY daily_reports_superadmin_all
  ON public.daily_reports
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY daily_reports_staff_select_org
  ON public.daily_reports
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY daily_reports_staff_insert_active
  ON public.daily_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY daily_reports_staff_update_active
  ON public.daily_reports
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY daily_reports_staff_delete_org
  ON public.daily_reports
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY daily_reports_family_select_published
  ON public.daily_reports
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND status = 'published'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.family_can_access_patient(patient_id))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reports TO authenticated;
REVOKE ALL ON public.daily_reports FROM anon;

-- Family DTO: published reports only. security_invoker — family ma SELECT na tabeli.
DROP VIEW IF EXISTS public.family_daily_reports;
CREATE VIEW public.family_daily_reports
WITH (security_invoker = true)
AS
SELECT
  dr.id,
  dr.patient_id,
  dr.organization_id,
  dr.local_date,
  dr.content,
  dr.published_at,
  dr.created_at,
  (dr.ai_model IS NOT NULL) AS is_ai_generated
FROM public.daily_reports dr
INNER JOIN public.patients p ON p.id = dr.patient_id
WHERE dr.status = 'published'
  AND p.archived_at IS NULL;

COMMENT ON VIEW public.family_daily_reports IS
  'Kanał rodziny: wyłącznie daily_reports.status=published. Bez daily_logs.raw_data. RLS invoker.';

GRANT SELECT ON public.family_daily_reports TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Notifications
-- Contact: e-mail = auth.users.email. SMS = profiles.phone (family updates own row).
-- Edge copies into notification_deliveries.recipient at send time.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.profiles.phone IS
  'Numer do SMS (zalecany E.164, np. +48123456789). NULL = brak SMS. Family UPDATE własnego wiersza (org/rola bez zmian).';

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  channel public.notification_channel NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_preferences_patient_org_fkey
    FOREIGN KEY (patient_id, organization_id)
    REFERENCES public.patients (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT notification_preferences_profile_org_fkey
    FOREIGN KEY (profile_id, organization_id)
    REFERENCES public.profiles (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT notification_preferences_profile_patient_channel_uidx
    UNIQUE (profile_id, patient_id, channel)
);

CREATE INDEX IF NOT EXISTS notification_preferences_org_profile_idx
  ON public.notification_preferences (organization_id, profile_id);

CREATE INDEX IF NOT EXISTS notification_preferences_org_patient_idx
  ON public.notification_preferences (organization_id, patient_id);

COMMENT ON TABLE public.notification_preferences IS
  'Opt-in SMS/e-mail o raporcie dziennym. is_enabled domyślnie false. SMS → profiles.phone; e-mail → auth.users.email.';

CREATE TRIGGER audit_notification_preferences_upd_del
  AFTER UPDATE OR DELETE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_preferences_superadmin_all ON public.notification_preferences;
DROP POLICY IF EXISTS notification_preferences_staff_select_org ON public.notification_preferences;
DROP POLICY IF EXISTS notification_preferences_family_select_own ON public.notification_preferences;
DROP POLICY IF EXISTS notification_preferences_family_insert_own ON public.notification_preferences;
DROP POLICY IF EXISTS notification_preferences_family_update_own ON public.notification_preferences;
DROP POLICY IF EXISTS notification_preferences_family_delete_own ON public.notification_preferences;

CREATE POLICY notification_preferences_superadmin_all
  ON public.notification_preferences
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY notification_preferences_staff_select_org
  ON public.notification_preferences
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY notification_preferences_family_select_own
  ON public.notification_preferences
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND profile_id = (SELECT auth.uid())
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.family_can_access_patient(patient_id))
  );

CREATE POLICY notification_preferences_family_insert_own
  ON public.notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND profile_id = (SELECT auth.uid())
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.family_can_access_patient(patient_id))
  );

CREATE POLICY notification_preferences_family_update_own
  ON public.notification_preferences
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND profile_id = (SELECT auth.uid())
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND profile_id = (SELECT auth.uid())
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.family_can_access_patient(patient_id))
  );

CREATE POLICY notification_preferences_family_delete_own
  ON public.notification_preferences
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND profile_id = (SELECT auth.uid())
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
REVOKE ALL ON public.notification_preferences FROM anon;

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  daily_report_id uuid NOT NULL,
  channel public.notification_channel NOT NULL,
  recipient text NOT NULL,
  status public.notification_delivery_status NOT NULL DEFAULT 'pending',
  provider text,
  provider_message_id text,
  attempted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_deliveries_patient_org_fkey
    FOREIGN KEY (patient_id, organization_id)
    REFERENCES public.patients (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT notification_deliveries_profile_org_fkey
    FOREIGN KEY (profile_id, organization_id)
    REFERENCES public.profiles (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT notification_deliveries_report_org_fkey
    FOREIGN KEY (daily_report_id, organization_id)
    REFERENCES public.daily_reports (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT notification_deliveries_report_patient_fkey
    FOREIGN KEY (daily_report_id, patient_id)
    REFERENCES public.daily_reports (id, patient_id)
    ON DELETE CASCADE,
  CONSTRAINT notification_deliveries_profile_report_channel_uidx
    UNIQUE (profile_id, daily_report_id, channel)
);

CREATE INDEX IF NOT EXISTS notification_deliveries_org_created_idx
  ON public.notification_deliveries (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_deliveries_report_status_idx
  ON public.notification_deliveries (daily_report_id, status);

CREATE INDEX IF NOT EXISTS notification_deliveries_pending_idx
  ON public.notification_deliveries (status, created_at)
  WHERE status = 'pending';

COMMENT ON TABLE public.notification_deliveries IS
  'Wysyłki SMS/e-mail o raporcie. UNIQUE (profile, report, channel) = SMS i e-mail osobno, bez duplikatu kanału. Zapis: service_role.';
COMMENT ON COLUMN public.notification_deliveries.recipient IS
  'Snapshot telefonu/e-mail w chwili wysyłki. Family bez SELECT. Nie logować sekretów providera.';
COMMENT ON COLUMN public.notification_deliveries.provider IS
  'np. resend, smsapi — bez wymuszania vendor lock w enumie.';

CREATE TRIGGER audit_notification_deliveries_upd_del
  AFTER UPDATE OR DELETE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_deliveries_superadmin_select ON public.notification_deliveries;
DROP POLICY IF EXISTS notification_deliveries_staff_select_org ON public.notification_deliveries;

CREATE POLICY notification_deliveries_superadmin_select
  ON public.notification_deliveries
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY notification_deliveries_staff_select_org
  ON public.notification_deliveries
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

GRANT SELECT ON public.notification_deliveries TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.notification_deliveries FROM authenticated, anon;
REVOKE ALL ON public.notification_deliveries FROM anon;

-- ---------------------------------------------------------------------------
-- 3. Polar freshness on family_wearable_comfort
-- Family has no SELECT on polar_connections (polar_user_id). Helper returns
-- only timestamptz after assignment + wearable consent (or staff/superadmin).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.polar_last_successful_sync_at(p_patient_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pc.last_successful_sync_at
  FROM public.polar_connections pc
  INNER JOIN public.patients p ON p.id = pc.patient_id
  WHERE pc.patient_id = p_patient_id
    AND p.archived_at IS NULL
    AND pc.revoked_at IS NULL
    AND pc.connection_status = 'active'
    AND (
      (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
      OR (
        (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
        AND pc.organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
      )
      OR (
        (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
        AND (SELECT public.family_can_access_patient(p_patient_id))
        AND (SELECT public.family_has_wearable_consent(p_patient_id))
      )
    )
  ORDER BY pc.last_successful_sync_at DESC NULLS LAST
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.polar_last_successful_sync_at(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.polar_last_successful_sync_at(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.polar_last_successful_sync_at(uuid) TO authenticated;

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
  s.sleep_score,
  public.polar_last_successful_sync_at(COALESCE(a.patient_id, s.patient_id))
    AS last_successful_sync_at
FROM public.polar_daily_activity a
FULL OUTER JOIN public.polar_sleep_nights s
  ON a.patient_id = s.patient_id
 AND a.local_date = s.local_date
INNER JOIN public.patients p
  ON p.id = COALESCE(a.patient_id, s.patient_id)
 AND p.archived_at IS NULL;

GRANT SELECT ON public.family_wearable_comfort TO authenticated;

COMMENT ON VIEW public.family_wearable_comfort IS
  'Kanał rodzinny: kroki / sen / sleep_score + last_successful_sync_at. Bez BPM/HRV. Bez polar_user_id.';

REVOKE ALL ON FUNCTION public.set_row_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_row_updated_at() FROM anon, authenticated;
