-- TASK-INFRA-02: onboarding placówki (AC1–AC4)
-- Rola JWT = enum app_role `superadmin` (nie `super_admin`).
-- Auto-onboarding = Edge `onboard-organization` wywoływane przez Super Admina.
-- Brak Database Webhook / triggera HTTP: INSERT robi Edge (service_role),
-- webhook zapętliłby zaproszenie; e-mail admina nie jest kolumną org.

-- ---------------------------------------------------------------------------
-- AC2: adres i limit podopiecznych (typed columns, nie settings_json)
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS resident_limit integer;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_address_len_chk,
  DROP CONSTRAINT IF EXISTS organizations_resident_limit_chk;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_address_len_chk
    CHECK (address IS NULL OR char_length(btrim(address)) BETWEEN 1 AND 500),
  ADD CONSTRAINT organizations_resident_limit_chk
    CHECK (resident_limit IS NULL OR resident_limit BETWEEN 1 AND 10000);

COMMENT ON COLUMN public.organizations.address IS
  'Adres placówki (operacyjny). Brak PII pensjonariuszy.';
COMMENT ON COLUMN public.organizations.resident_limit IS
  'Limit podopiecznych z kontraktu B2B. Zmienia wyłącznie superadmin / service_role.';

-- ---------------------------------------------------------------------------
-- AC1: INSERT wyłącznie dla superadmin (JWT app_metadata.role)
-- FOR ALL zastąpione politykami per-komendę, żeby INSERT był audytowalny.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS organizations_superadmin_all ON public.organizations;
DROP POLICY IF EXISTS organizations_superadmin_select ON public.organizations;
DROP POLICY IF EXISTS organizations_superadmin_insert ON public.organizations;
DROP POLICY IF EXISTS organizations_superadmin_update ON public.organizations;
DROP POLICY IF EXISTS organizations_superadmin_delete ON public.organizations;

CREATE POLICY organizations_superadmin_select
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY organizations_superadmin_insert
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY organizations_superadmin_update
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY organizations_superadmin_delete
  ON public.organizations
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

-- ---------------------------------------------------------------------------
-- AC4: org_admin nie podbija własnego limitu kontraktowego
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_organization_resident_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.resident_limit IS NOT DISTINCT FROM OLD.resident_limit THEN
    RETURN NEW;
  END IF;

  IF auth.role() IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'resident_limit can only be changed by superadmin'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS organizations_protect_resident_limit ON public.organizations;

CREATE TRIGGER organizations_protect_resident_limit
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_organization_resident_limit();

REVOKE ALL ON FUNCTION public.protect_organization_resident_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_organization_resident_limit() FROM anon, authenticated;

COMMENT ON FUNCTION public.protect_organization_resident_limit() IS
  'Blokuje zmianę organizations.resident_limit poza superadmin JWT i service_role.';

COMMENT ON TABLE public.organizations IS
  'Tenant placówki. INSERT tylko superadmin (RLS). Provisioning org_admin: Edge onboard-organization.';
