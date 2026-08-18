-- Enterprise hardening: tenant composite FKs, staff assignments, Polar sync,
-- OAuth grant lockdown, consent/AI provenance, append-only security logs.
-- Preflight (remote 2026-08-14): 0 business rows; 0 cross-tenant mismatches.
-- Does NOT wire nurse access to assignments (would break current org-wide staff RLS).
-- Does NOT invent retention periods.

-- ---------------------------------------------------------------------------
-- 0. Auth hook search_path (advisor: mutable search_path)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_id uuid;
  profile_role text;
  profile_org uuid;
BEGIN
  user_id := NULLIF(COALESCE(event->>'user_id', event->>'id'), '')::uuid;
  claims := COALESCE(event->'claims', '{}'::jsonb);

  IF user_id IS NULL THEN
    RETURN event;
  END IF;

  SELECT p.role::text, p.organization_id
    INTO profile_role, profile_org
  FROM public.profiles p
  WHERE p.id = user_id;

  IF NOT FOUND THEN
    RETURN event;
  END IF;

  claims := jsonb_set(claims, '{app_metadata}', COALESCE(claims->'app_metadata', '{}'::jsonb), true);
  claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(profile_role), true);

  IF profile_org IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata,organization_id}', 'null'::jsonb, true);
  ELSE
    claims := jsonb_set(claims, '{app_metadata,organization_id}', to_jsonb(profile_org::text), true);
  END IF;

  event := jsonb_set(event, '{claims}', claims, true);
  RETURN event;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- 1. Tenant uniqueness for composite FKs (single-column PKs kept)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS patients_id_organization_id_uidx
  ON public.patients (id, organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_id_organization_id_uidx
  ON public.profiles (id, organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS polar_connections_id_organization_id_uidx
  ON public.polar_connections (id, organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS voice_conversations_id_organization_id_uidx
  ON public.voice_conversations (id, organization_id);

-- ---------------------------------------------------------------------------
-- Composite (patient_id, organization_id) FKs — keep existing single FKs
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT *
    FROM (VALUES
      ('daily_logs_patient_org_fkey', 'daily_logs'),
      ('consent_ledger_patient_org_fkey', 'consent_ledger'),
      ('family_connections_patient_org_fkey', 'family_connections'),
      ('polar_connections_patient_org_fkey', 'polar_connections'),
      ('polar_daily_activity_patient_org_fkey', 'polar_daily_activity'),
      ('polar_sleep_nights_patient_org_fkey', 'polar_sleep_nights'),
      ('polar_heart_rate_daily_patient_org_fkey', 'polar_heart_rate_daily'),
      ('polar_hrv_nights_patient_org_fkey', 'polar_hrv_nights'),
      ('voice_conversations_patient_org_fkey', 'voice_conversations'),
      ('voice_draft_notes_patient_org_fkey', 'voice_draft_notes'),
      ('telemetry_logs_patient_org_fkey', 'telemetry_logs')
    ) AS t(conname, relname)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = rec.conname
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I
           FOREIGN KEY (patient_id, organization_id)
           REFERENCES public.patients (id, organization_id)
           ON DELETE CASCADE',
        rec.relname,
        rec.conname
      );
    END IF;
  END LOOP;
END $$;

-- Turns: tenant match to parent conversation (no patient_id on the table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'voice_conversation_turns_conv_org_fkey'
  ) THEN
    ALTER TABLE public.voice_conversation_turns
      ADD CONSTRAINT voice_conversation_turns_conv_org_fkey
      FOREIGN KEY (conversation_id, organization_id)
      REFERENCES public.voice_conversations (id, organization_id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Profile+org composite FKs only where the profile MUST share tenant
-- (family / consent). Skip created_by / author_id / approved_by / granted_by:
-- superadmin may have organization_id NULL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'family_connections_profile_org_fkey'
  ) THEN
    ALTER TABLE public.family_connections
      ADD CONSTRAINT family_connections_profile_org_fkey
      FOREIGN KEY (profile_id, organization_id)
      REFERENCES public.profiles (id, organization_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'consent_ledger_profile_org_fkey'
  ) THEN
    ALTER TABLE public.consent_ledger
      ADD CONSTRAINT consent_ledger_profile_org_fkey
      FOREIGN KEY (profile_id, organization_id)
      REFERENCES public.profiles (id, organization_id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. patient_staff_assignments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  assigned_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT patient_staff_assignments_role_chk
    CHECK (assigned_role IN ('org_admin', 'nurse')),
  CONSTRAINT patient_staff_assignments_profile_patient_uidx UNIQUE (profile_id, patient_id),
  CONSTRAINT patient_staff_assignments_patient_org_fkey
    FOREIGN KEY (patient_id, organization_id)
    REFERENCES public.patients (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT patient_staff_assignments_profile_org_fkey
    FOREIGN KEY (profile_id, organization_id)
    REFERENCES public.profiles (id, organization_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS patient_staff_assignments_org_patient_idx
  ON public.patient_staff_assignments (organization_id, patient_id);

CREATE INDEX IF NOT EXISTS patient_staff_assignments_org_profile_idx
  ON public.patient_staff_assignments (organization_id, profile_id);

COMMENT ON TABLE public.patient_staff_assignments IS
  'Przypisanie personelu do pensjonariusza. Tabela gotowa; istniejące RLS personelu nadal jest org-wide (nie zawężamy bez cutover).';

ALTER TABLE public.patient_staff_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_staff_assignments_superadmin_all ON public.patient_staff_assignments;
DROP POLICY IF EXISTS patient_staff_assignments_staff_select_org ON public.patient_staff_assignments;
DROP POLICY IF EXISTS patient_staff_assignments_org_admin_insert ON public.patient_staff_assignments;
DROP POLICY IF EXISTS patient_staff_assignments_org_admin_update ON public.patient_staff_assignments;
DROP POLICY IF EXISTS patient_staff_assignments_org_admin_delete ON public.patient_staff_assignments;

CREATE POLICY patient_staff_assignments_superadmin_all
  ON public.patient_staff_assignments
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY patient_staff_assignments_staff_select_org
  ON public.patient_staff_assignments
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY patient_staff_assignments_org_admin_insert
  ON public.patient_staff_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY patient_staff_assignments_org_admin_update
  ON public.patient_staff_assignments
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

CREATE POLICY patient_staff_assignments_org_admin_delete
  ON public.patient_staff_assignments
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_staff_assignments TO authenticated;
REVOKE ALL ON public.patient_staff_assignments FROM anon;

CREATE TRIGGER audit_patient_staff_assignments_upd_del
  AFTER UPDATE OR DELETE ON public.patient_staff_assignments
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ---------------------------------------------------------------------------
-- 3. Polar connection status + sync runs
-- ---------------------------------------------------------------------------
ALTER TABLE public.polar_connections
  ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_successful_sync_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'polar_connections_status_chk'
  ) THEN
    ALTER TABLE public.polar_connections
      ADD CONSTRAINT polar_connections_status_chk
      CHECK (connection_status IN ('active', 'revoked'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.polar_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  polar_connection_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  status text NOT NULL,
  records_fetched integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT polar_sync_runs_records_chk CHECK (records_fetched >= 0),
  CONSTRAINT polar_sync_runs_status_chk CHECK (status IN ('running', 'succeeded', 'failed')),
  CONSTRAINT polar_sync_runs_connection_org_fkey
    FOREIGN KEY (polar_connection_id, organization_id)
    REFERENCES public.polar_connections (id, organization_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS polar_sync_runs_connection_started_idx
  ON public.polar_sync_runs (polar_connection_id, started_at DESC);

CREATE INDEX IF NOT EXISTS polar_sync_runs_org_started_idx
  ON public.polar_sync_runs (organization_id, started_at DESC);

COMMENT ON TABLE public.polar_sync_runs IS
  'Przebiegi sync Polar. error_message: zakaz tokenów/sekretów — sanitizacja w Edge.';
COMMENT ON COLUMN public.polar_sync_runs.error_message IS
  'Tylko komunikat operacyjny. Nigdy access_token, refresh_token, JWT, PII.';

ALTER TABLE public.polar_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS polar_sync_runs_superadmin_select ON public.polar_sync_runs;
DROP POLICY IF EXISTS polar_sync_runs_org_admin_select ON public.polar_sync_runs;

CREATE POLICY polar_sync_runs_superadmin_select
  ON public.polar_sync_runs
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY polar_sync_runs_org_admin_select
  ON public.polar_sync_runs
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

REVOKE ALL ON public.polar_sync_runs FROM anon;
GRANT SELECT ON public.polar_sync_runs TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.polar_sync_runs FROM authenticated, anon;

-- ---------------------------------------------------------------------------
-- 4. OAuth secrets — revoke client GRANTs (RLS had no policies; GRANT was still ALL)
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.polar_oauth_secrets FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.polar_oauth_secrets TO postgres, service_role;

-- ---------------------------------------------------------------------------
-- 5. Consent provenance columns (defaults for existing + new rows)
-- ---------------------------------------------------------------------------
ALTER TABLE public.consent_ledger
  ADD COLUMN IF NOT EXISTS consent_version text NOT NULL DEFAULT 'v1.0',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'family_portal';

COMMENT ON COLUMN public.consent_ledger.source IS
  'Domyślnie family_portal (kontrakt kolumny). Faktyczny zapis zgody: org_admin. Nowe wartości source = REQUIRES_POLICY_DECISION.';

-- ---------------------------------------------------------------------------
-- 6. AI provenance on daily_logs (nullable; CHECKs safe — 0 AI rows in preflight)
-- ---------------------------------------------------------------------------
ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS ai_model text,
  ADD COLUMN IF NOT EXISTS ai_prompt_version text,
  ADD COLUMN IF NOT EXISTS ai_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_logs_ai_model_required_chk'
  ) THEN
    ALTER TABLE public.daily_logs
      ADD CONSTRAINT daily_logs_ai_model_required_chk
      CHECK (is_ai_generated = false OR ai_model IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_logs_approved_pair_chk'
  ) THEN
    ALTER TABLE public.daily_logs
      ADD CONSTRAINT daily_logs_approved_pair_chk
      CHECK (approved_at IS NULL OR approved_by_user_id IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_logs_non_ai_fields_null_chk'
  ) THEN
    ALTER TABLE public.daily_logs
      ADD CONSTRAINT daily_logs_non_ai_fields_null_chk
      CHECK (
        is_ai_generated = true
        OR (ai_model IS NULL AND ai_prompt_version IS NULL AND ai_generated_at IS NULL)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. security_access_logs (append-only; actor from JWT, not client payload)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  patient_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT security_access_logs_patient_org_fkey
    FOREIGN KEY (patient_id, organization_id)
    REFERENCES public.patients (id, organization_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS security_access_logs_org_accessed_idx
  ON public.security_access_logs (organization_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS security_access_logs_patient_accessed_idx
  ON public.security_access_logs (patient_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS security_access_logs_actor_accessed_idx
  ON public.security_access_logs (actor_id, accessed_at DESC);

COMMENT ON TABLE public.security_access_logs IS
  'Dziennik dostępu (VIEW i podobne). Append-only. INSERT tylko przez log_security_access() / service_role.';

ALTER TABLE public.security_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_access_logs_superadmin_select ON public.security_access_logs;
DROP POLICY IF EXISTS security_access_logs_org_admin_select ON public.security_access_logs;

CREATE POLICY security_access_logs_superadmin_select
  ON public.security_access_logs
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY security_access_logs_org_admin_select
  ON public.security_access_logs
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

REVOKE ALL ON public.security_access_logs FROM anon;
GRANT SELECT ON public.security_access_logs TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.security_access_logs FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS security_access_logs_append_only ON public.security_access_logs;
CREATE TRIGGER security_access_logs_append_only
  BEFORE UPDATE OR DELETE ON public.security_access_logs
  FOR EACH ROW EXECUTE FUNCTION public.reject_append_only_mutation();

CREATE OR REPLACE FUNCTION public.log_security_access(
  p_patient_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org uuid;
  v_role text;
  v_id uuid;
BEGIN
  v_role := auth.jwt() -> 'app_metadata' ->> 'role';
  v_org := NULLIF(auth.jwt() -> 'app_metadata' ->> 'organization_id', '')::uuid;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_role IS NULL OR v_role NOT IN ('org_admin', 'nurse', 'superadmin') THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF v_role <> 'superadmin' THEN
    IF v_org IS NULL THEN
      RAISE EXCEPTION 'missing organization';
    END IF;
  ELSIF v_org IS NULL AND p_patient_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.patients WHERE id = p_patient_id;
  END IF;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'missing organization';
  END IF;

  IF p_patient_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = p_patient_id AND p.organization_id = v_org
    ) THEN
      RAISE EXCEPTION 'patient/org mismatch';
    END IF;
  END IF;

  INSERT INTO public.security_access_logs (
    organization_id, actor_id, patient_id, action, resource_type, resource_id
  ) VALUES (
    v_org, v_actor, p_patient_id, p_action, p_resource_type, p_resource_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_security_access(uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_security_access(uuid, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_security_access(uuid, text, text, uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reject_append_only_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_append_only_mutation() FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. audit_logs append-only + no client writes
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM authenticated, anon;

DROP TRIGGER IF EXISTS audit_logs_append_only ON public.audit_logs;
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.reject_append_only_mutation();

-- ---------------------------------------------------------------------------
-- 9. Indexes (skip duplicates of existing single-column indexes)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS patients_organization_archived_idx
  ON public.patients (organization_id, archived_at);

CREATE INDEX IF NOT EXISTS daily_logs_org_patient_created_idx
  ON public.daily_logs (organization_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS family_connections_org_patient_idx
  ON public.family_connections (organization_id, patient_id);

CREATE INDEX IF NOT EXISTS family_connections_org_profile_idx
  ON public.family_connections (organization_id, profile_id);

CREATE INDEX IF NOT EXISTS polar_daily_activity_org_patient_date_idx
  ON public.polar_daily_activity (organization_id, patient_id, local_date DESC);

CREATE INDEX IF NOT EXISTS polar_sleep_nights_org_patient_date_idx
  ON public.polar_sleep_nights (organization_id, patient_id, local_date DESC);

CREATE INDEX IF NOT EXISTS polar_heart_rate_daily_org_patient_date_idx
  ON public.polar_heart_rate_daily (organization_id, patient_id, local_date DESC);

CREATE INDEX IF NOT EXISTS polar_hrv_nights_org_patient_date_idx
  ON public.polar_hrv_nights (organization_id, patient_id, local_date DESC);

CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx
  ON public.audit_logs (organization_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 10. Tighten SECURITY DEFINER EXECUTE (keep authenticated for RLS helpers)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.family_can_access_patient(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.family_has_wearable_consent(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.patient_is_active(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.conversation_patient_is_active(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_voice_drafts() FROM anon, authenticated, PUBLIC;

GRANT EXECUTE ON FUNCTION public.family_can_access_patient(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.family_has_wearable_consent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.patient_is_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conversation_patient_is_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_voice_drafts() TO postgres, service_role;
