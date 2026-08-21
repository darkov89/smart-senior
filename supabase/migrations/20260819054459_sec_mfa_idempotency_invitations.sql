-- SEC: pgAudit (DDL/role), Polar webhook idempotency, family invitations,
-- MFA AAL2 for privileged staff on sensitive tables (ADR-011).
-- JWT claims = app_metadata (ADR-006). No role `admin`.
-- staff_internal_notes is a column on voice_draft_notes — MFA applies there.

-- ---------------------------------------------------------------------------
-- 1. Audit extension — DDL/role only (do not log care-note payloads)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgaudit;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Session read/write would copy INSERT/SELECT of raw_data / Peace Letter /
-- Polar payload into Postgres Logs (RODO / ADR-005). Row-level care audit
-- stays in public.audit_logs (redacted on DELETE).
DO $$
BEGIN
  EXECUTE $sql$ALTER ROLE postgres SET pgaudit.log TO 'ddl,role'$sql$;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pgaudit.log not applied on postgres (insufficient privilege)';
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Polar webhook idempotency (Edge polar-webhook / service_role only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.polar_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  polar_event_id text NOT NULL,
  event_type text,
  payload jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT polar_webhook_events_event_id_uidx UNIQUE (polar_event_id)
);

COMMENT ON TABLE public.polar_webhook_events IS
  'Idempotencja webhooków Polar AccessLink. Unikalny polar_event_id. Brak GRANT dla klienta — tylko service_role.';
COMMENT ON COLUMN public.polar_webhook_events.polar_event_id IS
  'Identyfikator zdarzenia z chmury Polar. Ponowiony pakiet (tętno/sen) = UNIQUE conflict → skip.';
COMMENT ON COLUMN public.polar_webhook_events.payload IS
  'Surowy payload producenta. Nie eksponować przez PostgREST. Nie haszować (ADR-005).';

ALTER TABLE public.polar_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.polar_webhook_events FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.polar_webhook_events TO postgres, service_role;

-- ---------------------------------------------------------------------------
-- 3. Family invitations — token signup without senior PII in the link
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  invited_by_user_id uuid NOT NULL REFERENCES public.profiles (id),
  email text NOT NULL,
  relationship text,
  invite_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_invitations_patient_org_fkey
    FOREIGN KEY (patient_id, organization_id)
    REFERENCES public.patients (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT family_invitations_relationship_chk CHECK (
    relationship IS NULL
    OR relationship IN (
      'daughter',
      'son',
      'spouse',
      'grandchild',
      'sibling',
      'legal_guardian',
      'caregiver',
      'other'
    )
  ),
  CONSTRAINT family_invitations_status_chk CHECK (
    status IN ('pending', 'accepted', 'expired', 'revoked')
  ),
  CONSTRAINT family_invitations_email_chk CHECK (
    email = lower(btrim(email))
    AND position('@' IN email) > 1
  )
);

COMMENT ON TABLE public.family_invitations IS
  'Zaproszenia rodziny: wygasający token, bez PESEL / nazwiska pensjonariusza w treści linku. Redeem w Edge.';
COMMENT ON COLUMN public.family_invitations.invite_token IS
  'Sekret rejestracyjny (64 hex). Nie pokazywać rodzinie cudzych tokenów. UI: zero żargonu.';
COMMENT ON COLUMN public.family_invitations.relationship IS
  'Kod relacji (UI mapuje na polski). Ten sam zbiór co family_connections.';
COMMENT ON COLUMN public.family_invitations.email IS
  'E-mail zapraszanego (PII). Zawsze lowercase. Nie jest to e-mail pensjonariusza.';

CREATE OR REPLACE FUNCTION public.family_invitations_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_invitations_before_write ON public.family_invitations;
CREATE TRIGGER family_invitations_before_write
  BEFORE INSERT OR UPDATE OF email ON public.family_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.family_invitations_before_write();

REVOKE ALL ON FUNCTION public.family_invitations_before_write() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_invitations_before_write() TO authenticated, postgres, service_role;

CREATE INDEX IF NOT EXISTS idx_family_invitations_token
  ON public.family_invitations (invite_token)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_family_invitations_org
  ON public.family_invitations (organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS family_invitations_pending_email_patient_uidx
  ON public.family_invitations (patient_id, email)
  WHERE status = 'pending';

CREATE TRIGGER audit_family_invitations_upd_del
  AFTER UPDATE OR DELETE ON public.family_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY family_invitations_superadmin_all
  ON public.family_invitations
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY family_invitations_org_admin_select
  ON public.family_invitations
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY family_invitations_org_admin_insert
  ON public.family_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND invited_by_user_id = (SELECT auth.uid())
    AND (SELECT public.patient_is_active(patient_id))
  );

CREATE POLICY family_invitations_org_admin_update
  ON public.family_invitations
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

CREATE POLICY family_invitations_org_admin_delete
  ON public.family_invitations
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_invitations TO authenticated;
REVOKE ALL ON public.family_invitations FROM anon;
REVOKE TRUNCATE ON public.family_invitations FROM authenticated;

-- ---------------------------------------------------------------------------
-- 4. MFA AAL2 — restrictive AND for privileged roles (Supabase Auth docs)
-- Family / iot_device stay on aal1. service_role bypasses RLS.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jwt_privileged_aal2_ok()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN (SELECT auth.jwt() -> 'app_metadata' ->> 'role')
         IN ('superadmin', 'org_admin', 'nurse')
    THEN COALESCE((SELECT auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    ELSE true
  END;
$$;

COMMENT ON FUNCTION public.jwt_privileged_aal2_ok() IS
  'RLS: superadmin/org_admin/nurse wymagają JWT aal=aal2 (TOTP). family/iot_device: true (inne polityki nadal tną wiersze).';

REVOKE ALL ON FUNCTION public.jwt_privileged_aal2_ok() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.jwt_privileged_aal2_ok() FROM anon;
GRANT EXECUTE ON FUNCTION public.jwt_privileged_aal2_ok() TO authenticated;

DROP POLICY IF EXISTS patients_privileged_require_aal2 ON public.patients;
CREATE POLICY patients_privileged_require_aal2
  ON public.patients
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.jwt_privileged_aal2_ok()))
  WITH CHECK ((SELECT public.jwt_privileged_aal2_ok()));

DROP POLICY IF EXISTS daily_reports_privileged_require_aal2 ON public.daily_reports;
CREATE POLICY daily_reports_privileged_require_aal2
  ON public.daily_reports
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.jwt_privileged_aal2_ok()))
  WITH CHECK ((SELECT public.jwt_privileged_aal2_ok()));

-- staff_internal_notes lives on voice_draft_notes (no standalone table).
DROP POLICY IF EXISTS voice_draft_notes_privileged_require_aal2 ON public.voice_draft_notes;
CREATE POLICY voice_draft_notes_privileged_require_aal2
  ON public.voice_draft_notes
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.jwt_privileged_aal2_ok()))
  WITH CHECK ((SELECT public.jwt_privileged_aal2_ok()));

DROP POLICY IF EXISTS family_invitations_privileged_require_aal2 ON public.family_invitations;
CREATE POLICY family_invitations_privileged_require_aal2
  ON public.family_invitations
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.jwt_privileged_aal2_ok()))
  WITH CHECK ((SELECT public.jwt_privileged_aal2_ok()));
