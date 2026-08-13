-- Pakiet Spokoju / SeniorSmart — telemetry_logs (BLE gateway, aggregated windows)
-- Challenge HLD 2.2.0: telemetria opasek przez bramki BLE jako wzbogacenie notatek głosowych
-- (nie wyrób medyczny: tylko agregaty 15 min, zero diagnozy / raw stream).

-- ---------------------------------------------------------------------------
-- Table: aggregated wearable windows (never raw sample streams)
-- ---------------------------------------------------------------------------
CREATE TABLE public.telemetry_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  time_window_start timestamptz NOT NULL,
  hr_avg int NOT NULL CHECK (hr_avg >= 0),
  hr_min int NOT NULL CHECK (hr_min >= 0),
  hr_max int NOT NULL CHECK (hr_max >= 0),
  step_count_delta int NOT NULL DEFAULT 0 CHECK (step_count_delta >= 0),
  device_on_body boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telemetry_logs_hr_range_chk CHECK (hr_min <= hr_avg AND hr_avg <= hr_max),
  CONSTRAINT telemetry_logs_patient_window_uidx UNIQUE (patient_id, time_window_start)
);

CREATE INDEX telemetry_logs_patient_id_idx
  ON public.telemetry_logs (patient_id);

CREATE INDEX telemetry_logs_time_window_start_idx
  ON public.telemetry_logs (time_window_start DESC);

CREATE INDEX telemetry_logs_organization_id_idx
  ON public.telemetry_logs (organization_id);

COMMENT ON TABLE public.telemetry_logs IS
  'Zagregowane okna 15 min z bramek BLE (hr_*/steps). Brak surowych próbek. Nie do kanału family.';

-- ---------------------------------------------------------------------------
-- Audit (UPDATE / DELETE) — ISO / Secure by Design
-- ---------------------------------------------------------------------------
CREATE TRIGGER audit_telemetry_logs_upd_del
  AFTER UPDATE OR DELETE ON public.telemetry_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ---------------------------------------------------------------------------
-- RLS
-- service_role (Edge ingest) omija RLS — brak osobnej polityki INSERT dla klienta.
-- Odczyt: personel tej samej placówki + superadmin.
-- Family: BRAK SELECT (telemetria ≠ Peace Letter tylko przez Guardrails Edge).
-- ---------------------------------------------------------------------------
ALTER TABLE public.telemetry_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY telemetry_logs_superadmin_all
  ON public.telemetry_logs
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_superadmin()))
  WITH CHECK ((SELECT public.is_superadmin()));

CREATE POLICY telemetry_logs_staff_select_org
  ON public.telemetry_logs
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_org_staff())
    AND organization_id = (SELECT public.current_organization_id())
  );

-- ---------------------------------------------------------------------------
-- Grants (Data API) — authenticated: SELECT only; writes via Edge service_role
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.telemetry_logs TO authenticated;
