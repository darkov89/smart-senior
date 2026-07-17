---
name: secure-by-design
description: >-
  Secure by Design checklist for Pakiet Spokoju — RODO/ISO 27001/NIS2, no medical
  logic on frontend, RLS/RBAC, family data minimization, Edge JWT verification,
  secrets hygiene. Use when implementing auth, RLS, Edge Functions, AI pipelines,
  family/nurse UI, IoT ingest, audits, or reviewing security of a change.
---

# Secure by Design — Pakiet Spokoju

## Always read first

- [`SECURITY.md`](../../../SECURITY.md)
- [`docs/MASTER_CONTEXT.md`](../../../docs/MASTER_CONTEXT.md) §2 and §6

## Checklist before merging / deploying

- [ ] No clinical parse/filter/Guardrails in `index.html` / `src/**`
- [ ] New tables have RLS + role policies
- [ ] Tenant queries filter `organization_id`
- [ ] Family path cannot read `raw_data`
- [ ] IoT limited to INSERT sensor logs
- [ ] Edge verifies JWT / device token
- [ ] No `service_role` / DB password / OpenAI key in client or git
- [ ] Audit trail for UPDATE/DELETE where required
- [ ] Deploy target is `smart-senior` + Supabase `bmughdoqdsjfstxnnjks`, not DFCMS

## Preferred patterns

| Need | Pattern |
|------|---------|
| Family reports | `family_daily_reports` or Edge DTO with `processed_data` only |
| Voice → text → summary | Edge: Whisper → GPT Guardrails → write `daily_logs` |
| Staff UI | Alpine UI + PostgREST under RLS; no local “AI cleanup” |
| Secrets | Supabase Secrets / CF encrypted env; `.env` local only |

## After security-relevant change

Update `docs/MASTER_CONTEXT.md` §10 and, if policy text changes, `SECURITY.md`.
