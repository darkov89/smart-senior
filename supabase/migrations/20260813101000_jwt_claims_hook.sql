-- JWT Custom Claims (Auth Hook) + RLS O(1) — ADR-006
-- Role/org z tokenu zamiast SECURITY DEFINER lookup na profiles przy każdym wierszu.
-- Enum app_role: superadmin | org_admin | nurse | family | iot_device
-- (nie ma wartości 'staff' — personel liniowy = nurse).

-- ---------------------------------------------------------------------------
-- Auth Hook: inject role + organization_id into JWT app_metadata
-- Payload Auth Hook: event->>'user_id' (oficjalne); fallback event->>'id'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
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

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON TABLE public.profiles TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Family view: JWT role zamiast is_family(); assignment nadal family_can_access_patient
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.family_daily_reports AS
SELECT
  dl.id,
  dl.patient_id,
  dl.organization_id,
  dl.typ_logu,
  dl.processed_data,
  dl.created_at
FROM public.daily_logs dl
WHERE (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
  AND (SELECT public.family_can_access_patient(dl.patient_id));

-- ---------------------------------------------------------------------------
-- DROP existing RLS policies (recreate on JWT claims)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS organizations_superadmin_all ON public.organizations;
DROP POLICY IF EXISTS organizations_staff_select ON public.organizations;
DROP POLICY IF EXISTS organizations_org_admin_update ON public.organizations;
DROP POLICY IF EXISTS organizations_family_select ON public.organizations;

DROP POLICY IF EXISTS profiles_superadmin_all ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_staff_select_org ON public.profiles;
DROP POLICY IF EXISTS profiles_org_admin_write_org ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own_name ON public.profiles;

DROP POLICY IF EXISTS patients_superadmin_all ON public.patients;
DROP POLICY IF EXISTS patients_staff_all_org ON public.patients;
DROP POLICY IF EXISTS patients_family_select_assigned ON public.patients;

DROP POLICY IF EXISTS daily_logs_superadmin_all ON public.daily_logs;
DROP POLICY IF EXISTS daily_logs_staff_all_org ON public.daily_logs;
DROP POLICY IF EXISTS daily_logs_iot_insert ON public.daily_logs;

DROP POLICY IF EXISTS family_connections_superadmin_all ON public.family_connections;
DROP POLICY IF EXISTS family_connections_staff_all_org ON public.family_connections;
DROP POLICY IF EXISTS family_connections_family_select_own ON public.family_connections;

DROP POLICY IF EXISTS audit_logs_superadmin_select ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_org_admin_select ON public.audit_logs;

DROP POLICY IF EXISTS telemetry_logs_superadmin_all ON public.telemetry_logs;
DROP POLICY IF EXISTS telemetry_logs_staff_select_org ON public.telemetry_logs;

DROP POLICY IF EXISTS iot_gateways_superadmin_all ON public.iot_gateways;
DROP POLICY IF EXISTS iot_gateways_org_admin_all_org ON public.iot_gateways;

-- ---------------------------------------------------------------------------
-- RLS: organizations
-- ---------------------------------------------------------------------------
CREATE POLICY organizations_superadmin_all
  ON public.organizations
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY organizations_staff_select
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY organizations_org_admin_update
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY organizations_family_select
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

-- ---------------------------------------------------------------------------
-- RLS: profiles
-- ---------------------------------------------------------------------------
CREATE POLICY profiles_superadmin_all
  ON public.profiles
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

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
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY profiles_org_admin_write_org
  ON public.profiles
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

CREATE POLICY profiles_update_own_name
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND organization_id IS NOT DISTINCT FROM
      (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND role::text = (SELECT auth.jwt() -> 'app_metadata' ->> 'role')
  );

-- ---------------------------------------------------------------------------
-- RLS: patients
-- ---------------------------------------------------------------------------
CREATE POLICY patients_superadmin_all
  ON public.patients
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY patients_staff_all_org
  ON public.patients
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

CREATE POLICY patients_family_select_assigned
  ON public.patients
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND (SELECT public.family_can_access_patient(id))
  );

-- ---------------------------------------------------------------------------
-- RLS: daily_logs
-- ---------------------------------------------------------------------------
CREATE POLICY daily_logs_superadmin_all
  ON public.daily_logs
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY daily_logs_staff_all_org
  ON public.daily_logs
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

CREATE POLICY daily_logs_iot_insert
  ON public.daily_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'iot_device'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND typ_logu = 'hardware_sensor'
  );

-- ---------------------------------------------------------------------------
-- RLS: family_connections
-- ---------------------------------------------------------------------------
CREATE POLICY family_connections_superadmin_all
  ON public.family_connections
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY family_connections_staff_all_org
  ON public.family_connections
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

CREATE POLICY family_connections_family_select_own
  ON public.family_connections
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND profile_id = (SELECT auth.uid())
  );

-- ---------------------------------------------------------------------------
-- RLS: audit_logs
-- ---------------------------------------------------------------------------
CREATE POLICY audit_logs_superadmin_select
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY audit_logs_org_admin_select
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'org_admin'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

-- ---------------------------------------------------------------------------
-- RLS: telemetry_logs
-- ---------------------------------------------------------------------------
CREATE POLICY telemetry_logs_superadmin_all
  ON public.telemetry_logs
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY telemetry_logs_staff_select_org
  ON public.telemetry_logs
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

-- ---------------------------------------------------------------------------
-- RLS: iot_gateways
-- ---------------------------------------------------------------------------
CREATE POLICY iot_gateways_superadmin_all
  ON public.iot_gateways
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY iot_gateways_org_admin_all_org
  ON public.iot_gateways
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

-- ---------------------------------------------------------------------------
-- Drop RLS-only SECURITY DEFINER helpers (no longer referenced)
-- KEEP: family_can_access_patient (assignment lookup — nie mieści się w JWT)
-- KEEP: audit_row_change (trigger, nie RLS)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.current_profile_role();
DROP FUNCTION IF EXISTS public.current_organization_id();
DROP FUNCTION IF EXISTS public.is_superadmin();
DROP FUNCTION IF EXISTS public.is_org_staff();
DROP FUNCTION IF EXISTS public.is_family();
DROP FUNCTION IF EXISTS public.is_iot_device();

GRANT SELECT ON public.family_daily_reports TO authenticated;

-- ---------------------------------------------------------------------------
-- OPERACJA WYMAGANA W DASHBOARD (Auth → Hooks):
-- Włącz Custom Access Token Hook i wskaż public.custom_access_token_hook.
-- Bez tego JWT nie będzie miał app_metadata.role / organization_id i RLS
-- odetnie personel (Fail Secure). Po zmianie roli/org użytkownik musi
-- odświeżyć sesję (refresh token), aby claims były aktualne.
-- Dashboard: Authentication → Hooks (Custom Access Token).
-- ---------------------------------------------------------------------------
COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
  'Auth Hook: wstrzykuje profiles.role + organization_id do JWT app_metadata. AKTYWUJ w Dashboard: Auth → Hooks → Custom Access Token.';
