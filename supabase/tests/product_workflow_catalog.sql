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
  'no_chat_tables', NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('messages', 'chats', 'chat_threads', 'devices', 'iot_devices')
  ),
  'family_daily_reports_from_daily_reports', EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'family_daily_reports'
      AND definition ILIKE '%daily_reports%'
      AND definition NOT ILIKE '%daily_logs%'
  ),
  'wearable_has_freshness', EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'family_wearable_comfort'
      AND definition ILIKE '%last_successful_sync_at%'
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
  )
) AS result;
