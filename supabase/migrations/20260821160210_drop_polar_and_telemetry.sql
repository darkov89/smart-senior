-- ADR-012: Polar AccessLink and telemetry ingest out of MVP.
-- Keep consent_ledger (wearable_family_access hook for Faza 3).
-- Do not recreate iot_gateways. Future hubs = new ADR, not Polar.

DROP VIEW IF EXISTS public.family_wearable_comfort;

DROP TABLE IF EXISTS public.polar_webhook_events CASCADE;
DROP TABLE IF EXISTS public.polar_oauth_secrets CASCADE;
DROP TABLE IF EXISTS public.polar_sync_runs CASCADE;
DROP TABLE IF EXISTS public.polar_daily_activity CASCADE;
DROP TABLE IF EXISTS public.polar_sleep_nights CASCADE;
DROP TABLE IF EXISTS public.polar_heart_rate_daily CASCADE;
DROP TABLE IF EXISTS public.polar_hrv_nights CASCADE;
DROP TABLE IF EXISTS public.polar_connections CASCADE;
DROP TABLE IF EXISTS public.telemetry_logs CASCADE;

DROP FUNCTION IF EXISTS public.polar_last_successful_sync_at(uuid);
DROP FUNCTION IF EXISTS public.family_has_wearable_consent(uuid);

COMMENT ON TABLE public.consent_ledger IS
  'Zgody RODO. purpose wearable_family_access = hak Fazy 3 (własne bramki). MVP: brak ingestu, brak DTO komfortu. Wpisuje org_admin; rodzina nie self-grant.';
