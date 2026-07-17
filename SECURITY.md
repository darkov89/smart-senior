# Security Policy — Pakiet Spokoju (SeniorSmart)

## Reporting Security Issues

If you discover a vulnerability or security issue in Pakiet Spokoju / SeniorSmart, please report it privately by email:

**kontakt@dfops.eu**

Please include:

- affected URL or component,
- clear reproduction steps,
- expected impact,
- relevant logs, screenshots, or request examples if available.

Please do not publicly disclose the issue until Dragonfly Operations Sp. z o.o. has confirmed a fix or mitigation.

We aim to acknowledge serious reports within 72 hours.

---

## Secure by Design (engineering rules)

These rules are mandatory for anyone working on this codebase (including AI agents). Full product context: [`docs/MASTER_CONTEXT.md`](docs/MASTER_CONTEXT.md).

### Critical

1. **No medical / sensitive processing in the browser.** Do not parse, filter, classify, or “clean” clinical content in Alpine.js / frontend JS. That belongs in Supabase Edge Functions with Guardrails.
2. **RLS on every table.** New tables must ship with `ENABLE ROW LEVEL SECURITY` and explicit policies for `app_role`.
3. **Never expose `service_role` / secret keys** in static HTML/JS, Cloudflare Pages public assets, or git.
4. **Multi-tenant isolation.** Queries and policies must scope by `organization_id` (except intentional `superadmin` paths).
5. **Family data minimization.** Families must not receive `raw_data` from `daily_logs`. Use `family_daily_reports` (or equivalent Edge-shaped payloads) exposing only `processed_data`.
6. **IoT least privilege.** Device identities (`iot_device`) may only `INSERT` sensor logs — no SELECT/UPDATE/DELETE on clinical tables.
7. **Audit.** Prefer triggers / `audit_logs` for UPDATE/DELETE on tenant data (ISO 27001 trail).
8. **Auth on Edge.** Every Edge Function must verify the Supabase JWT (or a dedicated, rotated device token for IoT) before side effects.
9. **Secrets.** Store OpenAI / webhook / cron secrets in Supabase Secrets or Cloudflare encrypted env — never in `.env` committed to git. Keep `.env` gitignored; use `.env.example` as the template.
10. **Separate from DFCMS.** Do not deploy this app to Cloudflare project `dfcms` / `dfopscms` or to DFCMS Supabase projects.

### Compliance targets

- RODO / GDPR (data minimization, access control, auditability)
- ISO 27001 (access logging, least privilege)
- NIS2 (secure development & operations practices)

### Secrets hygiene checklist

- [ ] `.env` not in git (`git check-ignore -v .env`)
- [ ] Frontend only uses publishable / anon key
- [ ] `SUPABASE_ACCESS_TOKEN` and DB password never in client code
- [ ] After rotating tokens, revoke old ones in Supabase Dashboard
