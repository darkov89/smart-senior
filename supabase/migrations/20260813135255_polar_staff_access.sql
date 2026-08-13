-- Option A (ADR-009 amendment): staff SELECT on Polar metrics for Big Picture.
-- Family still requires wearable consent. Do not edit 20260813134500_*.

CREATE POLICY polar_daily_activity_staff_select_org
  ON public.polar_daily_activity
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY polar_sleep_nights_staff_select_org
  ON public.polar_sleep_nights
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY polar_heart_rate_daily_staff_select_org
  ON public.polar_heart_rate_daily
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY polar_hrv_nights_staff_select_org
  ON public.polar_hrv_nights
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('org_admin', 'nurse')
    AND organization_id = (SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );
