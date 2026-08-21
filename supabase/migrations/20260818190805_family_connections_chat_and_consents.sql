-- Family access metadata (relationship, primary contact, revoke status),
-- async family hydrant (family_messages), and consent_ledger family SELECT
-- bound to active family_connections. JWT claims = app_metadata (ADR-006).
-- No role `admin`. Rate limit for hydrant stays outside Postgres (WAF).

-- ---------------------------------------------------------------------------
-- 1. family_connections — relationship, primary contact, status
-- ---------------------------------------------------------------------------
ALTER TABLE public.family_connections
  ADD COLUMN IF NOT EXISTS relationship text,
  ADD COLUMN IF NOT EXISTS is_primary_contact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'family_connections_relationship_chk'
  ) THEN
    ALTER TABLE public.family_connections
      ADD CONSTRAINT family_connections_relationship_chk
      CHECK (
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
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'family_connections_status_chk'
  ) THEN
    ALTER TABLE public.family_connections
      ADD CONSTRAINT family_connections_status_chk
      CHECK (status IN ('active', 'revoked', 'pending'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'family_connections_revoked_pair_chk'
  ) THEN
    ALTER TABLE public.family_connections
      ADD CONSTRAINT family_connections_revoked_pair_chk
      CHECK (
        (status = 'revoked' AND revoked_at IS NOT NULL)
        OR (status <> 'revoked' AND revoked_at IS NULL)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.family_connections.relationship IS
  'Kod relacji (UI mapuje na polski). Nie używać słowa pacjent w copy.';
COMMENT ON COLUMN public.family_connections.is_primary_contact IS
  'Jeden aktywny kontakt główny na pensjonariusza (partial unique + trigger).';
COMMENT ON COLUMN public.family_connections.status IS
  'active = dostęp RLS; pending = zaproszenie; revoked = natychmiastowe odcięcie.';

UPDATE public.family_connections
SET status = 'active', revoked_at = NULL
WHERE status IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS family_connections_one_primary_active_uidx
  ON public.family_connections (patient_id)
  WHERE is_primary_contact = true AND status = 'active';

CREATE OR REPLACE FUNCTION public.family_connections_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'revoked' THEN
    NEW.is_primary_contact := false;
    NEW.revoked_at := COALESCE(NEW.revoked_at, now());
  ELSE
    NEW.revoked_at := NULL;
  END IF;

  IF NEW.is_primary_contact = true AND NEW.status IS DISTINCT FROM 'active' THEN
    NEW.is_primary_contact := false;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.family_connections_demote_other_primaries()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_primary_contact = true AND NEW.status = 'active' THEN
    UPDATE public.family_connections
    SET is_primary_contact = false
    WHERE patient_id = NEW.patient_id
      AND id IS DISTINCT FROM NEW.id
      AND is_primary_contact = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_connections_before_write ON public.family_connections;
CREATE TRIGGER family_connections_before_write
  BEFORE INSERT OR UPDATE ON public.family_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.family_connections_before_write();

DROP TRIGGER IF EXISTS family_connections_demote_other_primaries ON public.family_connections;
CREATE TRIGGER family_connections_demote_other_primaries
  AFTER INSERT OR UPDATE OF is_primary_contact, status ON public.family_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.family_connections_demote_other_primaries();

REVOKE ALL ON FUNCTION public.family_connections_before_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.family_connections_demote_other_primaries() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_connections_before_write() TO authenticated, postgres, service_role;
GRANT EXECUTE ON FUNCTION public.family_connections_demote_other_primaries() TO authenticated, postgres, service_role;

-- Access for family channel (reports, wearable, hydrant) requires status = active.
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
      AND fc.status = 'active'
      AND p.archived_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.family_can_access_patient(uuid) IS
  'RLS rodziny: aktywne family_connections + pensjonariusz nie zarchiwizowany.';

REVOKE ALL ON FUNCTION public.family_can_access_patient(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.family_can_access_patient(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.family_can_access_patient(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. family_messages — async hydrant (not a live chat, not daily_logs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  sender_profile_id uuid NOT NULL,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_messages_patient_org_fkey
    FOREIGN KEY (patient_id, organization_id)
    REFERENCES public.patients (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT family_messages_sender_org_fkey
    FOREIGN KEY (sender_profile_id, organization_id)
    REFERENCES public.profiles (id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT family_messages_content_chk
    CHECK (char_length(btrim(content)) > 0 AND char_length(content) <= 2000),
  CONSTRAINT family_messages_status_chk
    CHECK (status IN ('sent', 'read', 'archived')),
  CONSTRAINT family_messages_read_pair_chk
    CHECK (
      (status = 'sent' AND read_at IS NULL)
      OR (status = 'read' AND read_at IS NOT NULL)
      OR (status = 'archived')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS family_messages_id_organization_id_uidx
  ON public.family_messages (id, organization_id);

CREATE INDEX IF NOT EXISTS family_messages_patient_created_idx
  ON public.family_messages (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS family_messages_org_created_idx
  ON public.family_messages (organization_id, created_at DESC);

COMMENT ON TABLE public.family_messages IS
  'Asynchroniczny hydrant rodziny → personel. Osobno od daily_logs / Peace Letter. Nie czat na żywo.';

CREATE TRIGGER audit_family_messages_upd_del
  AFTER UPDATE OR DELETE ON public.family_messages
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- Staff/superadmin may only change read/archive metadata, not the body.
CREATE OR REPLACE FUNCTION public.family_messages_protect_body()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := (SELECT auth.jwt() -> 'app_metadata' ->> 'role');
  IF jwt_role = 'superadmin' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'read' AND NEW.read_at IS NULL THEN
    NEW.read_at := now();
  END IF;
  IF NEW.status = 'sent' THEN
    NEW.read_at := NULL;
  END IF;

  IF NEW.content IS DISTINCT FROM OLD.content
     OR NEW.sender_profile_id IS DISTINCT FROM OLD.sender_profile_id
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'family_messages: only status and read_at may be updated';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_messages_protect_body ON public.family_messages;
CREATE TRIGGER family_messages_protect_body
  BEFORE UPDATE ON public.family_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.family_messages_protect_body();

REVOKE ALL ON FUNCTION public.family_messages_protect_body() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_messages_protect_body() TO authenticated, postgres, service_role;

ALTER TABLE public.family_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_messages_superadmin_all ON public.family_messages;
DROP POLICY IF EXISTS family_messages_family_select ON public.family_messages;
DROP POLICY IF EXISTS family_messages_family_insert ON public.family_messages;
DROP POLICY IF EXISTS family_messages_staff_select ON public.family_messages;
DROP POLICY IF EXISTS family_messages_staff_update ON public.family_messages;

CREATE POLICY family_messages_superadmin_all
  ON public.family_messages
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

CREATE POLICY family_messages_family_select
  ON public.family_messages
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.family_can_access_patient(patient_id))
  );

CREATE POLICY family_messages_family_insert
  ON public.family_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND sender_profile_id = (SELECT auth.uid())
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND (SELECT public.family_can_access_patient(patient_id))
    AND (SELECT public.patient_is_active(patient_id))
  );

-- Staff SELECT/UPDATE by role — never org_id alone (family JWT also has organization_id).
CREATE POLICY family_messages_staff_select
  ON public.family_messages
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY family_messages_staff_update
  ON public.family_messages
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  )
  WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_messages TO authenticated;
REVOKE ALL ON public.family_messages FROM anon;

-- ---------------------------------------------------------------------------
-- 3. consent_ledger — org_admin writes (existing); family SELECT-only + active assignment
-- ---------------------------------------------------------------------------
-- Do not recreate FOR ALL with top-level jwt organization_id / user_role / role `admin`.
-- Live policies: consent_ledger_org_admin_{select_org,write_active,update_active,delete_org}
-- + consent_ledger_superadmin_all (ADR-006 / ADR-009).
DROP POLICY IF EXISTS consent_ledger_admin_all ON public.consent_ledger;
DROP POLICY IF EXISTS consent_ledger_family_read ON public.consent_ledger;
DROP POLICY IF EXISTS consent_ledger_family_select_own ON public.consent_ledger;

CREATE POLICY consent_ledger_family_select_own
  ON public.consent_ledger
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'family'
    AND profile_id = (SELECT auth.uid())
    AND (SELECT public.family_can_access_patient(patient_id))
  );
