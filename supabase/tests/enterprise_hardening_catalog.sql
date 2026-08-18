-- Catalog assertions for enterprise hardening (read-only, production-safe).
-- Run: npx supabase db query --linked -o json --agent=yes -f supabase/tests/enterprise_hardening_catalog.sql

WITH expected_fks AS (
  SELECT unnest(ARRAY[
    'daily_logs_patient_org_fkey',
    'consent_ledger_patient_org_fkey',
    'family_connections_patient_org_fkey',
    'polar_connections_patient_org_fkey',
    'polar_daily_activity_patient_org_fkey',
    'polar_sleep_nights_patient_org_fkey',
    'polar_heart_rate_daily_patient_org_fkey',
    'polar_hrv_nights_patient_org_fkey',
    'voice_conversations_patient_org_fkey',
    'voice_draft_notes_patient_org_fkey',
    'telemetry_logs_patient_org_fkey',
    'patient_staff_assignments_patient_org_fkey',
    'patient_staff_assignments_profile_org_fkey',
    'polar_sync_runs_connection_org_fkey',
    'security_access_logs_patient_org_fkey',
    'family_connections_profile_org_fkey',
    'consent_ledger_profile_org_fkey',
    'voice_conversation_turns_conv_org_fkey'
  ]) AS conname
),
fk_missing AS (
  SELECT e.conname
  FROM expected_fks e
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_constraint c WHERE c.conname = e.conname AND c.contype = 'f'
  )
),
oauth_grants AS (
  SELECT grantee, privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'polar_oauth_secrets'
    AND grantee IN ('anon', 'authenticated', 'PUBLIC')
),
rls_off AS (
  SELECT c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = false
    AND c.relname IN (
      'patient_staff_assignments', 'polar_sync_runs', 'security_access_logs',
      'polar_oauth_secrets', 'audit_logs', 'daily_logs', 'patients'
    )
)
SELECT jsonb_build_object(
  'missing_composite_fks', (SELECT coalesce(jsonb_agg(conname), '[]'::jsonb) FROM fk_missing),
  'oauth_client_grants', (SELECT coalesce(jsonb_agg(oauth_grants), '[]'::jsonb) FROM oauth_grants),
  'rls_disabled_tables', (SELECT coalesce(jsonb_agg(relname), '[]'::jsonb) FROM rls_off),
  'has_staff_assignments', EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'patient_staff_assignments'
  ),
  'has_polar_sync_runs', EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'polar_sync_runs'
  ),
  'has_security_access_logs', EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'security_access_logs'
  ),
  'daily_logs_ai_checks', (
    SELECT count(*) FROM pg_constraint
    WHERE conrelid = 'public.daily_logs'::regclass
      AND conname IN (
        'daily_logs_ai_model_required_chk',
        'daily_logs_approved_pair_chk',
        'daily_logs_non_ai_fields_null_chk'
      )
  ),
  'audit_append_only_trigger', EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.audit_logs'::regclass
      AND tgname = 'audit_logs_append_only'
      AND tgenabled <> 'D'
  ),
  'security_append_only_trigger', EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.security_access_logs'::regclass
      AND tgname = 'security_access_logs_append_only'
      AND tgenabled <> 'D'
  ),
  'family_voice_select_policies', (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('voice_conversations', 'voice_conversation_turns', 'voice_draft_notes')
      AND cmd = 'SELECT'
      AND (
        qual ILIKE '%family%'
        OR with_check ILIKE '%family%'
      )
  ),
  'family_hr_hrv_select_policies', (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('polar_heart_rate_daily', 'polar_hrv_nights')
      AND cmd = 'SELECT'
      AND policyname ILIKE '%family%'
  ),
  'hook_search_path', (
    SELECT proconfig FROM pg_proc
    WHERE proname = 'custom_access_token_hook'
      AND pronamespace = 'public'::regnamespace
  ),
  'anon_execute_sensitive', (
    SELECT coalesce(jsonb_agg(p.proname ORDER BY p.proname), '[]'::jsonb)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'audit_row_change',
        'cleanup_old_voice_drafts',
        'custom_access_token_hook',
        'family_can_access_patient',
        'family_has_wearable_consent',
        'patient_is_active',
        'conversation_patient_is_active',
        'log_security_access',
        'reject_append_only_mutation'
      )
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  )
) AS result;
