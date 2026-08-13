-- IoT gateway security — per-org Bearer tokens (ADR-002); koniec globalnego TELEMETRY_INGEST_TOKEN

CREATE TABLE public.iot_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  gateway_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT iot_gateways_gateway_token_uidx UNIQUE (gateway_token)
);

CREATE INDEX iot_gateways_organization_id_idx
  ON public.iot_gateways (organization_id);

COMMENT ON TABLE public.iot_gateways IS
  'Bramki BLE placówki. Auth ingest-telemetry: Bearer = gateway_token → organization_id. Tokeny tylko dla org_admin/superadmin.';

CREATE TRIGGER audit_iot_gateways_upd_del
  AFTER UPDATE OR DELETE ON public.iot_gateways
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

ALTER TABLE public.iot_gateways ENABLE ROW LEVEL SECURITY;

-- superadmin: pełny dostęp
CREATE POLICY iot_gateways_superadmin_all
  ON public.iot_gateways
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_superadmin()))
  WITH CHECK ((SELECT public.is_superadmin()));

-- org_admin: wyłącznie własna placówka (tokeny nie dla nurse/family)
CREATE POLICY iot_gateways_org_admin_all_org
  ON public.iot_gateways
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.iot_gateways TO authenticated;
