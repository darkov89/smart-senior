---
name: supabase-seniorsmart
description: >-
  Supabase workflow for Pakiet Spokoju / SeniorSmart — single project multi-tenant
  schema, RLS/RBAC (app_role), migrations, Auth, Edge Functions (AI Guardrails),
  audit_logs, and CLI deploy. Use when touching supabase/, migrations, RLS,
  profiles/patients/daily_logs, db push, functions deploy, supabase link, Auth,
  or any backend task in this repo. Complements the generic Supabase skill with
  SeniorSmart project-ref and Secure by Design rules.
---

# Supabase — SeniorSmart (Pakiet Spokoju)

## Before any change

1. Read **`docs/MASTER_CONTEXT.md`** (§2 Secure by Design, §4 środowiska, §5–6 schema/RLS) and **`SECURITY.md`**.
2. Confirm **linked project** before `db push` / `functions deploy`:

```bash
cat supabase/.temp/project-ref
# expected: bmughdoqdsjfstxnnjks
```

| Environment | `project-ref` | Name |
|-------------|-----------------|------|
| **Current (MVP)** | `bmughdoqdsjfstxnnjks` | SeniorSmart |

**`git push` does not deploy Supabase.** DB/Edge need explicit CLI.

Token: export `SUPABASE_ACCESS_TOKEN` from local `.env` (never commit).

## Hard rules (this repo)

- **No medical processing in the browser** — Whisper/GPT/Guardrails only in Edge Functions.
- **Every table: RLS enabled** + policies for roles.
- **Family never SELECTs `raw_data`** — use `family_daily_reports` (or Edge response shaped the same way).
- **`iot_device`:** INSERT-only into `daily_logs` (`hardware_sensor`).
- **Service role** only in Edge / server — never in `index.html` / `src/app.js`.
- Prefer **`supabase migration new <name>`** then edit SQL — do not invent migration filenames.
- After schema/security changes: update **`docs/MASTER_CONTEXT.md`** §10.

## Baseline migration

`supabase/migrations/20260717193117_init_multi_tenant_schema.sql`

Tables: `organizations`, `profiles`, `patients`, `daily_logs`, `family_connections`, `audit_logs`  
Enums: `app_role`, `log_type`  
View: `family_daily_reports`

## Deploy

```bash
export SUPABASE_ACCESS_TOKEN=...   # from .env
npx supabase db push --yes
# later:
npx supabase functions deploy <function-name>
```

## Auth helpers (SQL)

Use existing helpers in policies: `is_superadmin()`, `is_org_staff()`, `is_family()`, `is_iot_device()`, `current_organization_id()`, `family_can_access_patient(uuid)`.

## Verification after changes

- `npx supabase migration list`
- Spot-check RLS with role-specific users (nurse vs family vs iot).
- Never test family access by querying `daily_logs` with `select *` expecting safety — column exposure is via view / Edge.

## References

- Schema & RLS map: [references/schema-seniorsmart.md](references/schema-seniorsmart.md)
