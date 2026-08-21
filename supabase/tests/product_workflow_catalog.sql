-- Catalog assertions for product workflow (run after db push).
-- npx supabase db query --linked -o json --agent=yes -f supabase/tests/product_workflow_catalog.sql

SELECT jsonb_build_object(
  'has_daily_reports', EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'daily_reports'
  ),
  'has_notification_preferences', EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notification_preferences'
  ),
  'has_notification_deliveries', EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notification_deliveries'
  ),
  'has_family_messages', EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'family_messages'
  ),
  'no_live_chat_or_device_tables', NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('messages', 'chats', 'chat_threads', 'devices', 'iot_devices')
  ),
  'family_connections_has_status', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'family_connections'
      AND column_name = 'status'
  ),
  'family_can_access_requires_active', EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'family_can_access_patient'
      AND pg_get_functiondef(p.oid) ILIKE '%status%active%'
  ),
  'family_daily_reports_from_daily_reports', EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'family_daily_reports'
      AND definition ILIKE '%daily_reports%'
      AND definition NOT ILIKE '%daily_logs%'
  ),
  'no_family_wearable_comfort', NOT EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'family_wearable_comfort'
  ),
  'deliveries_client_write_policies', (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_deliveries'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  ),
  'daily_reports_rls', (
    SELECT c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'daily_reports'
  ),
  'has_family_invitations', EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'family_invitations'
  ),
  'has_daily_agenda', EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'daily_agenda'
  ),
  'has_daily_agenda_templates', EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'daily_agenda_templates'
  ),
  'no_polar_or_telemetry_tables', NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'polar_connections', 'polar_daily_activity', 'polar_sleep_nights',
        'polar_heart_rate_daily', 'polar_hrv_nights', 'polar_sync_runs',
        'polar_oauth_secrets', 'polar_webhook_events', 'telemetry_logs'
      )
  ),
  'staff_aal2_restrictive_policies', (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('patients', 'daily_reports', 'voice_draft_notes', 'daily_logs')
      AND policyname LIKE '%privileged_require_aal2%'
      AND permissive = 'RESTRICTIVE'
  ),
  'has_pesel_hash_org_unique', EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'patients_org_pesel_hash_uidx'
  ),
  'has_pgaudit_extension', EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pgaudit'
  ),
  'organizations_has_address_and_quota', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'address'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'resident_limit'
  ),
  'organizations_insert_policy_count', (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organizations'
      AND cmd = 'INSERT'
  ),
  'organizations_superadmin_insert', EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organizations'
      AND policyname = 'organizations_superadmin_insert'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%superadmin%'
      AND with_check NOT ILIKE '%org_admin%'
      AND with_check NOT ILIKE '%super_admin%'
  ),
  'organizations_resident_limit_trigger', EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.organizations'::regclass
      AND tgname = 'organizations_protect_resident_limit'
      AND tgenabled <> 'D'
  )
) AS result;
