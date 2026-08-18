-- Follow-up after 20260814103804:
-- 1) Family must not read HR/HRV tables (family-safe DTO = family_wearable_comfort).
-- 2) audit_logs: revoke leftover anon SELECT (RLS already fail-closed; defense in depth).
-- 3) Append-only tables: service_role may INSERT, must not UPDATE/DELETE/TRUNCATE.

DROP POLICY IF EXISTS polar_heart_rate_daily_family_select_consented
  ON public.polar_heart_rate_daily;

DROP POLICY IF EXISTS polar_hrv_nights_family_select_consented
  ON public.polar_hrv_nights;

REVOKE ALL ON TABLE public.audit_logs FROM anon;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs
  FROM authenticated, anon, service_role;

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.security_access_logs
  FROM authenticated, anon, service_role;
