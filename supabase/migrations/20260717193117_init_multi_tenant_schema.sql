-- Pakiet Spokoju / SeniorSmart — multi-tenant schema, RLS, audit
-- Secure by Design: medical logic stays off the client; RLS enforces tenancy.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM (
  'superadmin',
  'org_admin',
  'nurse',
  'family',
  'iot_device'
);

CREATE TYPE public.log_type AS ENUM (
  'voice_note',
  'hardware_sensor',
  'ai_report'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  role public.app_role NOT NULL DEFAULT 'nurse',
  full_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_organization_id_idx ON public.profiles (organization_id);
CREATE INDEX profiles_role_idx ON public.profiles (role);

CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name_initial text NOT NULL CHECK (char_length(last_name_initial) = 1),
  pesel_hash text,
  room text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX patients_organization_id_idx ON public.patients (organization_id);

CREATE TABLE public.daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  typ_logu public.log_type NOT NULL,
  raw_data jsonb,
  processed_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX daily_logs_patient_id_idx ON public.daily_logs (patient_id);
CREATE INDEX daily_logs_organization_id_idx ON public.daily_logs (organization_id);
CREATE INDEX daily_logs_created_at_idx ON public.daily_logs (created_at DESC);

CREATE TABLE public.family_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, patient_id)
);

CREATE INDEX family_connections_profile_id_idx ON public.family_connections (profile_id);
CREATE INDEX family_connections_patient_id_idx ON public.family_connections (patient_id);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL CHECK (action IN ('UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_organization_id_idx ON public.audit_logs (organization_id);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at DESC);

-- ---------------------------------------------------------------------------
-- Auth / tenancy helpers (SECURITY DEFINER + fixed search_path)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('org_admin', 'nurse')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_family()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'family'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_iot_device()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'iot_device'
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
    WHERE fc.profile_id = auth.uid()
      AND fc.patient_id = p_patient_id
  );
$$;

REVOKE ALL ON FUNCTION public.current_profile_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_organization_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_superadmin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_family() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_iot_device() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.family_can_access_patient(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_iot_device() TO authenticated;
GRANT EXECUTE ON FUNCTION public.family_can_access_patient(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Audit trigger (UPDATE / DELETE)
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
BEGIN
  BEGIN
    v_ip := NULLIF(
      current_setting('request.headers', true)::json ->> 'x-forwarded-for',
      ''
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    IF TG_TABLE_NAME = 'organizations' THEN
      v_org := OLD.id;
    ELSE
      v_org := OLD.organization_id;
    END IF;

    INSERT INTO public.audit_logs (
      organization_id, actor_id, table_name, record_id, action, old_data, new_data, ip_address
    ) VALUES (
      v_org, auth.uid(), TG_TABLE_NAME, v_record_id, 'DELETE', to_jsonb(OLD), NULL, v_ip
    );
    RETURN OLD;
  END IF;

  v_record_id := NEW.id;
  IF TG_TABLE_NAME = 'organizations' THEN
    v_org := NEW.id;
  ELSE
    v_org := NEW.organization_id;
  END IF;

  INSERT INTO public.audit_logs (
    organization_id, actor_id, table_name, record_id, action, old_data, new_data, ip_address
  ) VALUES (
    v_org, auth.uid(), TG_TABLE_NAME, v_record_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_ip
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_organizations_upd_del
  AFTER UPDATE OR DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_profiles_upd_del
  AFTER UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_patients_upd_del
  AFTER UPDATE OR DELETE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_daily_logs_upd_del
  AFTER UPDATE OR DELETE ON public.daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_family_connections_upd_del
  AFTER UPDATE OR DELETE ON public.family_connections
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Family-safe view: processed_data only (no raw_data).
-- Runs with owner rights so family can read without a daily_logs SELECT policy
-- (which would otherwise expose raw_data via the Data API). Row filter uses
-- auth.uid() inside family_can_access_patient().
-- ---------------------------------------------------------------------------
CREATE VIEW public.family_daily_reports AS
SELECT
  dl.id,
  dl.patient_id,
  dl.organization_id,
  dl.typ_logu,
  dl.processed_data,
  dl.created_at
FROM public.daily_logs dl
WHERE (SELECT public.is_family())
  AND (SELECT public.family_can_access_patient(dl.patient_id));

-- ---------------------------------------------------------------------------
-- RLS enable
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS: organizations
-- ---------------------------------------------------------------------------
CREATE POLICY organizations_superadmin_all
  ON public.organizations
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_superadmin()))
  WITH CHECK ((SELECT public.is_superadmin()));

CREATE POLICY organizations_staff_select
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_org_staff())
    AND id = (SELECT public.current_organization_id())
  );

CREATE POLICY organizations_org_admin_update
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.current_profile_role()) = 'org_admin'
    AND id = (SELECT public.current_organization_id())
  )
  WITH CHECK (
    (SELECT public.current_profile_role()) = 'org_admin'
    AND id = (SELECT public.current_organization_id())
  );

CREATE POLICY organizations_family_select
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_family())
    AND id = (SELECT public.current_organization_id())
  );

-- ---------------------------------------------------------------------------
-- RLS: profiles
-- ---------------------------------------------------------------------------
CREATE POLICY profiles_superadmin_all
  ON public.profiles
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_superadmin()))
  WITH CHECK ((SELECT public.is_superadmin()));

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_staff_select_org
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_org_staff())
    AND organization_id = (SELECT public.current_organization_id())
  );

CREATE POLICY profiles_org_admin_write_org
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (
    (SELECT public.current_profile_role()) = 'org_admin'
    AND organization_id = (SELECT public.current_organization_id())
  )
  WITH CHECK (
    (SELECT public.current_profile_role()) = 'org_admin'
    AND organization_id = (SELECT public.current_organization_id())
  );

CREATE POLICY profiles_update_own_name
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND organization_id = (SELECT public.current_organization_id())
    AND role = (SELECT public.current_profile_role())
  );

-- ---------------------------------------------------------------------------
-- RLS: patients
-- ---------------------------------------------------------------------------
CREATE POLICY patients_superadmin_all
  ON public.patients
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_superadmin()))
  WITH CHECK ((SELECT public.is_superadmin()));

CREATE POLICY patients_staff_all_org
  ON public.patients
  FOR ALL
  TO authenticated
  USING (
    (SELECT public.is_org_staff())
    AND organization_id = (SELECT public.current_organization_id())
  )
  WITH CHECK (
    (SELECT public.is_org_staff())
    AND organization_id = (SELECT public.current_organization_id())
  );

CREATE POLICY patients_family_select_assigned
  ON public.patients
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_family())
    AND (SELECT public.family_can_access_patient(id))
  );

-- ---------------------------------------------------------------------------
-- RLS: daily_logs
-- Staff/superadmin: full row access in tenant.
-- Family: NO direct SELECT (use family_daily_reports view — processed_data only).
-- IoT: INSERT only into own organization.
-- ---------------------------------------------------------------------------
CREATE POLICY daily_logs_superadmin_all
  ON public.daily_logs
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_superadmin()))
  WITH CHECK ((SELECT public.is_superadmin()));

CREATE POLICY daily_logs_staff_all_org
  ON public.daily_logs
  FOR ALL
  TO authenticated
  USING (
    (SELECT public.is_org_staff())
    AND organization_id = (SELECT public.current_organization_id())
  )
  WITH CHECK (
    (SELECT public.is_org_staff())
    AND organization_id = (SELECT public.current_organization_id())
  );

CREATE POLICY daily_logs_iot_insert
  ON public.daily_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_iot_device())
    AND organization_id = (SELECT public.current_organization_id())
    AND typ_logu = 'hardware_sensor'
  );

-- ---------------------------------------------------------------------------
-- RLS: family_connections
-- ---------------------------------------------------------------------------
CREATE POLICY family_connections_superadmin_all
  ON public.family_connections
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_superadmin()))
  WITH CHECK ((SELECT public.is_superadmin()));

CREATE POLICY family_connections_staff_all_org
  ON public.family_connections
  FOR ALL
  TO authenticated
  USING (
    (SELECT public.is_org_staff())
    AND organization_id = (SELECT public.current_organization_id())
  )
  WITH CHECK (
    (SELECT public.is_org_staff())
    AND organization_id = (SELECT public.current_organization_id())
  );

CREATE POLICY family_connections_family_select_own
  ON public.family_connections
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_family())
    AND profile_id = (SELECT auth.uid())
  );

-- ---------------------------------------------------------------------------
-- RLS: audit_logs (read for superadmin / org_admin; writes via trigger only)
-- ---------------------------------------------------------------------------
CREATE POLICY audit_logs_superadmin_select
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_superadmin()));

CREATE POLICY audit_logs_org_admin_select
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.current_profile_role()) = 'org_admin'
    AND organization_id = (SELECT public.current_organization_id())
  );

-- Trigger inserts run as SECURITY DEFINER owner; no INSERT policy for clients.

-- ---------------------------------------------------------------------------
-- Grants (Data API)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_connections TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.family_daily_reports TO authenticated;
