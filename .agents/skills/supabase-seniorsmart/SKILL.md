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

# Supabase — SeniorSmart

## Before any change

1. [`MASTER_CONTEXT.md`](../../../docs/MASTER_CONTEXT.md) §4–6 + reguła `secure-by-design`.  
2. Reguła on-demand: [`.cursor/rules/supabase-seniorsmart.mdc`](../../../.cursor/rules/supabase-seniorsmart.mdc).  
3. Niepewność RLS/RBAC → HITL stop (`living-context`).  
4. Potwierdź project-ref:

```bash
cat supabase/.temp/project-ref
# expected: bmughdoqdsjfstxnnjks
```

| Env | `project-ref` | Name |
|-----|---------------|------|
| MVP | `bmughdoqdsjfstxnnjks` | SeniorSmart |

`git push` **nie** deployuje Supabase. Token: `SUPABASE_ACCESS_TOKEN` z lokalnego `.env`.

## Ops (substancja)

- Migracje: `supabase migration new <name>` — nie wymyślaj nazw plików.  
- Baseline: `supabase/migrations/20260717193117_init_multi_tenant_schema.sql`  
- Helpery RLS: JWT `app_metadata.role` / `organization_id` (ADR-006); `family_can_access_patient(uuid)` dla przypisań rodziny  
- Telemetria: **poza MVP** (ADR-012). Brak `polar_*` / `telemetry_logs`. Faza 3 = własne bramki (nowy ADR). `consent_ledger` zostaje jako hak. **brak** `iot_gateways`  
- Głos: ADR-010 `voice_*` — family bez SELECT; Peace Letter po merge + HITL; transkryptów nie haszować  
- Family: widok `family_daily_reports` — nigdy testuj safety przez `select *` z `daily_logs`

```bash
export SUPABASE_ACCESS_TOKEN=...   # from .env
npx supabase db push --yes
npx supabase functions deploy <function-name>
npx supabase migration list
```

Po zmianie schema/security → MASTER_CONTEXT §10.  
Mapa: [references/schema-seniorsmart.md](references/schema-seniorsmart.md)
