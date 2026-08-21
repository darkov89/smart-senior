-- MVP schema gaps (User Stories v2.4 / ADR-012): plan dnia, unique pesel_hash, AAL2 on daily_logs.
-- JWT claims = app_metadata (ADR-006). No role `admin`.

-- ---------------------------------------------------------------------------
-- 1. UNIQUE pesel_hash per organization (SC-ADM-02 duplicate PESEL)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS patients_org_pesel_hash_uidx
  ON public.patients (organization_id, pesel_hash)
  WHERE pesel_hash IS NOT NULL;

COMMENT ON COLUMN public.patients.pesel_hash IS
  'SHA-256 + salt. Nigdy plaintext. Unikalny w ramach organization_id (NULL dozwolony wielokrotnie).';

-- ---------------------------------------------------------------------------
-- 2. MFA AAL2 on daily_logs (SC-ADM-07 AC3)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS daily_logs_privileged_require_aal2 ON public.daily_logs;
CREATE POLICY daily_logs_privileged_require_aal2
  ON public.daily_logs
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.jwt_privileged_aal2_ok()))
  WITH CHECK ((SELECT public.jwt_privileged_aal2_ok()));

-- ---------------------------------------------------------------------------
-- 3. daily_agenda + templates (SC-NUR-05 / SC-FAM-06)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_agenda_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  start_time time NOT NULL,
  is_communal boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_agenda_templates_type_chk CHECK (
    type IN ('meal', 'activity', 'visit')
  ),
  CONSTRAINT daily_agenda_templates_title_chk CHECK (char_length(btrim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS daily_agenda_templates_org_idx
  ON public.daily_agenda_templates (organization_id);

COMMENT ON TABLE public.daily_agenda_templates IS
  'Szablony planu dnia placówki (np. stały jadłospis). Personel kopiuje na konkretną datę do daily_agenda.';

CREATE TRIGGER audit_daily_agenda_templates_upd_del
  AFTER UPDATE OR DELETE ON public.daily_agenda_templates
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TABLE IF NOT EXISTS public.daily_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  patient_id uuid,
  local_date date NOT NULL,
  start_time time NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  is_communal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_agenda_type_chk CHECK (
    type IN ('meal', 'activity', 'visit')
  ),
  CONSTRAINT daily_agenda_title_chk CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT daily_agenda_communal_chk CHECK (
    (is_communal = true AND patient_id IS NULL)
    OR (is_communal = false AND patient_id IS NOT NULL)
  ),
  CONSTRAINT daily_agenda_patient_org_fkey
    FOREIGN KEY (patient_id, organization_id)
    REFERENCES public.patients (id, organization_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS daily_agenda_org_date_idx
  ON public.daily_agenda (organization_id, local_date, start_time);

CREATE INDEX IF NOT EXISTS daily_agenda_patient_date_idx
  ON public.daily_agenda (patient_id, local_date)
  WHERE patient_id IS NOT NULL;

COMMENT ON TABLE public.daily_agenda IS
  'Plan dnia: posiłek / aktywność / wizyta. is_communal = cała placówka; inaczej konkretny pensjonariusz.';

CREATE TRIGGER audit_daily_agenda_upd_del
  AFTER UPDATE OR DELETE ON public.daily_agenda
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

ALTER TABLE public.daily_agenda_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_agenda ENABLE ROW LEVEL SECURITY;

-- Templates: staff only (no family). Role-gated — family JWT also has organization_id.
DROP POLICY IF EXISTS daily_agenda_templates_superadmin_all ON public.daily_agenda_templates;
DROP POLICY IF EXISTS daily_agenda_templates_staff_all ON public.daily_agenda_templates;

CREATE POLICY daily_agenda_templates_superadmin_all
  ON public.daily_agenda_templates
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY daily_agenda_templates_staff_all
  ON public.daily_agenda_templates
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

-- Agenda rows
DROP POLICY IF EXISTS daily_agenda_superadmin_all ON public.daily_agenda;
DROP POLICY IF EXISTS daily_agenda_staff_select ON public.daily_agenda;
DROP POLICY IF EXISTS daily_agenda_staff_insert ON public.daily_agenda;
DROP POLICY IF EXISTS daily_agenda_staff_update ON public.daily_agenda;
DROP POLICY IF EXISTS daily_agenda_staff_delete ON public.daily_agenda;
DROP POLICY IF EXISTS daily_agenda_family_select ON public.daily_agenda;

CREATE POLICY daily_agenda_superadmin_all
  ON public.daily_agenda
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY daily_agenda_staff_select
  ON public.daily_agenda
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY daily_agenda_staff_insert
  ON public.daily_agenda
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (
      patient_id IS NULL
      OR (SELECT public.patient_is_active(patient_id))
    )
  );

CREATE POLICY daily_agenda_staff_update
  ON public.daily_agenda
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (
      patient_id IS NULL
      OR (SELECT public.patient_is_active(patient_id))
    )
  );

CREATE POLICY daily_agenda_staff_delete
  ON public.daily_agenda
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY daily_agenda_family_select
  ON public.daily_agenda
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (
      (is_communal = true AND patient_id IS NULL)
      OR (
        patient_id IS NOT NULL
        AND (SELECT public.family_can_access_patient(patient_id))
      )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_agenda_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_agenda TO authenticated;
REVOKE ALL ON public.daily_agenda_templates FROM anon;
REVOKE ALL ON public.daily_agenda FROM anon;
REVOKE TRUNCATE ON public.daily_agenda_templates FROM authenticated;
REVOKE TRUNCATE ON public.daily_agenda FROM authenticated;
