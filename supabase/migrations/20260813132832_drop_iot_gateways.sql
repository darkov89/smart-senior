-- Silver Care MVP v2 / ADR-007: retire BLE gateway ingest.
-- Historical files 20260812081000_iot_gateways.sql and JWT RLS on this table
-- stay in git (already applied). Do not delete them.
-- telemetry_logs is kept until Polar schema (Phase 3).

DROP TABLE IF EXISTS public.iot_gateways CASCADE;
