-- Polar 360 normalized daily aggregates + consent_ledger (ADR-007 Phase 3)
-- Non-MD: comfort / wellbeing only — not a medical device.
-- Writes: Edge service_role (Phase 4). Clients: no INSERT on measurement tables.
-- Family SELECT: assignment + active wearable consent. Staff: no PostgREST SELECT on Polar metrics.

-- ---------------------------------------------------------------------------
-- consent_ledger — active grant for family wearable access (RODO Art. 9 path)
-- ---------------------------------------------------------------------------
CREATE TABLE public.consent_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('wearable_family_access')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_ledger_revoke_chk CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE UNIQUE INDEX consent_ledger_active_uidx
  ON public.consent_ledger (profile_id, patient_id, purpose)
  WHERE revoked_at IS NULL;

CREATE INDEX consent_ledger_organization_id_idx
  ON public.consent_ledger (organization_id);

CREATE INDEX consent_ledger_patient_id_idx
  ON public.consent_ledger (patient_id);

COMMENT ON TABLE public.consent_ledger IS
  'Zgody RODO. wearable_family_access: rodzina widzi agregaty Polar. Wpisuje org_admin; rodzina nie self-grant.';

CREATE TRIGGER audit_consent_ledger_upd_del
  AFTER UPDATE OR DELETE ON public.consent_ledger
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ---------------------------------------------------------------------------
-- polar_connections — AccessLink user link (no OAuth secrets here; Phase 4)
-- ---------------------------------------------------------------------------
CREATE TABLE public.polar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  polar_user_id text NOT NULL DEFAULT '',
  linked_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX polar_connections_active_patient_uidx
  ON public.polar_connections (patient_id)
  WHERE revoked_at IS NULL;

CREATE INDEX polar_connections_organization_id_idx
  ON public.polar_connections (organization_id);

COMMENT ON TABLE public.polar_connections IS
  'Powiązanie pensjonariusz ↔ Polar AccessLink. Tokeny OAuth NIE w tej tabeli (Faza 4, tylko Edge).';

CREATE TRIGGER audit_polar_connections_upd_del
  AFTER UPDATE OR DELETE ON public.polar_connections
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Measurement tables (daily aggregates, never raw sample streams)
-- ---------------------------------------------------------------------------
CREATE TABLE public.polar_daily_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  local_date date NOT NULL,
  steps integer NOT NULL DEFAULT 0 CHECK (steps >= 0),
  active_duration_seconds integer NOT NULL DEFAULT 0 CHECK (active_duration_seconds >= 0),
  calories integer NOT NULL DEFAULT 0 CHECK (calories >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT polar_daily_activity_patient_date_uidx UNIQUE (patient_id, local_date)
);

CREATE INDEX polar_daily_activity_organization_id_idx
  ON public.polar_daily_activity (organization_id);

CREATE INDEX polar_daily_activity_local_date_idx
  ON public.polar_daily_activity (local_date DESC);

COMMENT ON TABLE public.polar_daily_activity IS
  'Dzienna aktywność Polar 360 (kroki / czas ruchu). Non-MD: komfort, nie diagnoza.';

CREATE TABLE public.polar_sleep_nights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  local_date date NOT NULL,
  sleep_start timestamptz,
  sleep_end timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  sleep_score integer CHECK (sleep_score IS NULL OR (sleep_score >= 0 AND sleep_score <= 100)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT polar_sleep_nights_patient_date_uidx UNIQUE (patient_id, local_date)
);

CREATE INDEX polar_sleep_nights_organization_id_idx
  ON public.polar_sleep_nights (organization_id);

CREATE INDEX polar_sleep_nights_local_date_idx
  ON public.polar_sleep_nights (local_date DESC);

COMMENT ON TABLE public.polar_sleep_nights IS
  'Sen z Polar 360. sleep_score = wskaźnik komfortu / wypoczynku, nie badanie kliniczne.';

CREATE TABLE public.polar_heart_rate_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  local_date date NOT NULL,
  bpm_avg integer CHECK (bpm_avg IS NULL OR bpm_avg >= 0),
  bpm_min integer CHECK (bpm_min IS NULL OR bpm_min >= 0),
  bpm_max integer CHECK (bpm_max IS NULL OR bpm_max >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT polar_heart_rate_daily_patient_date_uidx UNIQUE (patient_id, local_date),
  CONSTRAINT polar_heart_rate_daily_range_chk CHECK (
    bpm_min IS NULL OR bpm_max IS NULL OR bpm_min <= bpm_max
  )
);

CREATE INDEX polar_heart_rate_daily_organization_id_idx
  ON public.polar_heart_rate_daily (organization_id);

COMMENT ON TABLE public.polar_heart_rate_daily IS
  'Dzienne tętno (agregat). Non-MD. UI/Peace Letter: bez surowych BPM i bez języka klinicznego.';

CREATE TABLE public.polar_hrv_nights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  local_date date NOT NULL,
  rmssd_ms numeric(8, 2) CHECK (rmssd_ms IS NULL OR rmssd_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT polar_hrv_nights_patient_date_uidx UNIQUE (patient_id, local_date)
);

CREATE INDEX polar_hrv_nights_organization_id_idx
  ON public.polar_hrv_nights (organization_id);

COMMENT ON TABLE public.polar_hrv_nights IS
  'Nocne HRV (RMSSD) z Polar. Magazyn pod Edge / komfort. Zakaz interpretacji klinicznej.';

CREATE TRIGGER audit_polar_daily_activity_upd_del
  AFTER UPDATE OR DELETE ON public.polar_daily_activity
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_polar_sleep_nights_upd_del
  AFTER UPDATE OR DELETE ON public.polar_sleep_nights
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_polar_heart_rate_daily_upd_del
  AFTER UPDATE OR DELETE ON public.polar_heart_rate_daily
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_polar_hrv_nights_upd_del
  AFTER UPDATE OR DELETE ON public.polar_hrv_nights
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Helper: family + assignment + active wearable consent (not in JWT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.family_has_wearable_consent(p_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.consent_ledger cl
    WHERE cl.profile_id = auth.uid()
      AND cl.patient_id = p_patient_id
      AND cl.purpose = 'wearable_family_access'
      AND cl.revoked_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.family_has_wearable_consent(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_has_wearable_consent(uuid) TO authenticated;

COMMENT ON FUNCTION public.family_has_wearable_consent(uuid) IS
  'RLS: aktywna zgoda wearable_family_access dla auth.uid() i pacjenta.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.consent_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polar_daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polar_sleep_nights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polar_heart_rate_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polar_hrv_nights ENABLE ROW LEVEL SECURITY;

-- consent_ledger
CREATE POLICY consent_ledger_superadmin_all
  ON public.consent_ledger
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY consent_ledger_org_admin_all_org
  ON public.consent_ledger
  FOR ALL
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
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
  );

-- polar_connections (staff link UI; never family — no Polar user ids in family client)
CREATE POLICY polar_connections_superadmin_all
  ON public.polar_connections
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY polar_connections_org_admin_all_org
  ON public.polar_connections
  FOR ALL
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

-- Measurement: superadmin ALL; family SELECT iff assignment + consent + tenant.
-- Nurse/org_admin: no client SELECT (not a clinical dashboard). Edge uses service_role.

CREATE POLICY polar_daily_activity_superadmin_all
  ON public.polar_daily_activity
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY polar_daily_activity_family_select_consented
  ON public.polar_daily_activity
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.family_can_access_patient(patient_id))
    AND (SELECT public.family_has_wearable_consent(patient_id))
  );

CREATE POLICY polar_sleep_nights_superadmin_all
  ON public.polar_sleep_nights
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY polar_sleep_nights_family_select_consented
  ON public.polar_sleep_nights
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.family_can_access_patient(patient_id))
    AND (SELECT public.family_has_wearable_consent(patient_id))
  );

CREATE POLICY polar_heart_rate_daily_superadmin_all
  ON public.polar_heart_rate_daily
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY polar_heart_rate_daily_family_select_consented
  ON public.polar_heart_rate_daily
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.family_can_access_patient(patient_id))
    AND (SELECT public.family_has_wearable_consent(patient_id))
  );

CREATE POLICY polar_hrv_nights_superadmin_all
  ON public.polar_hrv_nights
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY polar_hrv_nights_family_select_consented
  ON public.polar_hrv_nights
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.family_can_access_patient(patient_id))
    AND (SELECT public.family_has_wearable_consent(patient_id))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent_ledger TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polar_connections TO authenticated;
GRANT SELECT ON public.polar_daily_activity TO authenticated;
GRANT SELECT ON public.polar_sleep_nights TO authenticated;
GRANT SELECT ON public.polar_heart_rate_daily TO authenticated;
GRANT SELECT ON public.polar_hrv_nights TO authenticated;

-- Family DTO: activity + sleep comfort (no BPM / HRV). security_invoker = underlying RLS.
CREATE VIEW public.family_wearable_comfort
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
 AND a.local_date = s.local_date;

GRANT SELECT ON public.family_wearable_comfort TO authenticated;

COMMENT ON VIEW public.family_wearable_comfort IS
  'Kanał rodzinny: kroki / sen / sleep_score. Bez tętna i HRV. RLS z tabel źródłowych (security_invoker).';
