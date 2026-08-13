-- Polar AccessLink OAuth tokens — Edge / service_role only (ADR-009).
-- Never GRANT to authenticated. Family/staff never read tokens via PostgREST.

CREATE TABLE public.polar_oauth_secrets (
  polar_connection_id uuid PRIMARY KEY
    REFERENCES public.polar_connections (id) ON DELETE CASCADE,
  access_token text NOT NULL,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.polar_oauth_secrets IS
  'AccessLink bearer tokens. Brak GRANT dla authenticated — tylko service_role (Edge polar-oauth / polar-webhook).';

ALTER TABLE public.polar_oauth_secrets ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated: Fail Secure. service_role bypasses RLS.
