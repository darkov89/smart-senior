# Enterprise Database Hardening Report

**Project:** Pakiet Spokoju / SeniorSmart (`bmughdoqdsjfstxnnjks`, Stockholm)  
**Date:** 2026-08-14 (**snapshot** — nie nadpisuje MASTER_CONTEXT)  
**Scope:** PostgreSQL / Supabase schema, RLS, grants, tenant integrity, Polar secrets, audit, AI provenance  
**Migrations:** `20260814103804_enterprise_hardening.sql`, `20260814104307_enterprise_hardening_followup.sql`  
**db push:** succeeded (both)  
**This report evaluates technical controls only.** It does not claim NIS2, ISO 27001, or EU AI Act legal compliance or certification.

> **Późniejsza zmiana (nie w tym raporcie):** migracja `20260814112552` przebudowała `family_daily_reports` na `security_invoker` z `daily_reports.content` (`status=published`). Zdanie w §2 o SECURITY DEFINER / `processed_data` jest historyczne. Live: MASTER_CONTEXT §5–6.  
> **2026-08-21 (ADR-012):** tabele Polar / `telemetry_logs` / widok `family_wearable_comfort` usunięte z MVP. Wiersze Polar w tym raporcie są historyczne.

---

## 1. Executive Summary

Hardening added **relational tenant integrity** (composite FKs), **OAuth grant lockdown**, **append-only access/audit mutation blocks**, **AI provenance columns**, **Polar sync observability**, and a **staff-assignment table** (not yet wired into nurse access).

**Risks removed**
- Client roles (`anon` / `authenticated`) no longer have table GRANT on `polar_oauth_secrets` (previously ALL + RLS with zero policies).
- Child rows cannot point at a patient in a different `organization_id` (composite FKs).
- Family can no longer SELECT `polar_heart_rate_daily` / `polar_hrv_nights` via PostgREST (family-safe path remains `family_wearable_comfort`).
- `audit_logs` / `security_access_logs` reject UPDATE/DELETE (including `service_role` UPDATE/DELETE/TRUNCATE).
- Auth hook `custom_access_token_hook` now has `SET search_path = public`.

**Risks remaining**
- No JWT-impersonation RLS E2E on production (catalog tests only).
- `patient_staff_assignments` exists but **does not** constrain nurse access (still org-wide).
- `org_admin` can still `DELETE patients` with CASCADE on care/voice/Polar history.
- Retention beyond 30-day voice draft cleanup is undefined (`REQUIRES_POLICY_DECISION`).
- Backup/PITR not verified from this repo (`REQ-NFR-005` UNKNOWN).
- `service_role` still bypasses RLS (intentional for Edge); Polar webhook can write archived patients.
- `family_daily_reports` remains SECURITY DEFINER (intentional family DTO).

---

## 2. Schema Inventory

| Table | Tenant | RLS | PK | FK | Sensitive Data | Notes |
|-------|--------|-----|----|----|----------------|-------|
| `organizations` | self (`id`) | ON | `id` | — | facility settings | |
| `profiles` | `organization_id` NULL for superadmin | ON | `id` = `auth.users` | org SET NULL | names, role | UNIQUE `(id, organization_id)` |
| `patients` | `organization_id` NOT NULL | ON | `id` | org CASCADE | `pesel_hash`, names | UNIQUE `(id, organization_id)`; `archived_*` |
| `daily_logs` | `organization_id` | ON | `id` | patient CASCADE + composite patient+org | `raw_data`, AI fields | family: no SELECT |
| `family_connections` | `organization_id` | ON | `id` | patient/profile + composite | assignment | UNIQUE `(profile_id, patient_id)` |
| `consent_ledger` | `organization_id` | ON | `id` | patient/profile + composite | Art. 9 consent | purpose `wearable_family_access` only |
| `patient_staff_assignments` | `organization_id` | ON | `id` | patient+org, profile+org | assignment | **not wired into nurse RLS** |
| `polar_connections` | `organization_id` | ON | `id` | patient+org | Polar user id | `connection_status`, sync timestamps |
| `polar_oauth_secrets` | via connection | ON, no client policies | `polar_connection_id` | connection CASCADE | **access tokens** | GRANT: postgres + service_role only |
| `polar_daily_activity` | `organization_id` | ON | `id` | patient+org | steps | family SELECT + consent |
| `polar_sleep_nights` | `organization_id` | ON | `id` | patient+org | sleep score | family SELECT + consent |
| `polar_heart_rate_daily` | `organization_id` | ON | `id` | patient+org | BPM | **family DENY** |
| `polar_hrv_nights` | `organization_id` | ON | `id` | patient+org | HRV | **family DENY** |
| `polar_sync_runs` | `organization_id` | ON | `id` | connection+org | operational errors | authenticated SELECT org_admin/superadmin; no client writes |
| `telemetry_logs` | `organization_id` | ON | `id` | patient+org | HR aggregates | legacy BLE; family DENY |
| `voice_conversations` | `organization_id` | ON | `id` | patient+org | conversation state | family DENY |
| `voice_conversation_turns` | `organization_id` | ON | `id` | conv+org | **transcripts** | family DENY |
| `voice_draft_notes` | `organization_id` | ON | `id` | patient+org | **transcripts** | family DENY |
| `audit_logs` | `organization_id` | ON | `id` | org SET NULL | snapshots / redacted DELETE | append-only trigger |
| `security_access_logs` | `organization_id` | ON | `id` | org RESTRICT; patient+org RESTRICT | access events | append-only; INSERT via `log_security_access` / service_role |

**Views:** `family_daily_reports` (SECURITY DEFINER, `processed_data` only); `family_wearable_comfort` (`security_invoker`, steps/sleep, no BPM/HRV).

**Enums:** `app_role`, `log_type`, `voice_*`, `voice_missing_context`. No new enums in this hardening.

---

## 3. Multi-Tenant Security

| Control | Status | Notes |
|---------|--------|-------|
| Tenant isolation (RLS + JWT org) | PASS | ADR-006; catalog confirms RLS ON for all public tables |
| Composite FKs `(patient_id, organization_id)` | PASS | All requested child tables + turns via conversation+org |
| Cross-tenant protection | PARTIAL | DB FK + RLS; **no live JWT role tests** (empty business data) |
| Profile isolation | PARTIAL | UNIQUE `(id, organization_id)`; composite FK only where profile must share tenant (family, consent, assignments). `approved_by` / `created_by` / `author_id` stay single-column because superadmin `organization_id` may be NULL |
| Patient assignment (staff) | PARTIAL | Table + RLS exist; **nurse still sees all org patients** |
| Family assignment | PASS (schema) | `family_connections` + `family_can_access_patient`; archived patients excluded |

Preflight (before constraints): 0 patients, 0 polar rows, 0 consent, 0 daily_logs, 0 cross-tenant mismatches. Constraints were data-safe; **no data rewritten**.

Existing single-column FKs **kept** (they own `ON DELETE CASCADE`). Composite FKs add tenant matching; dropping singles would be redundant-risk, not required.

---

## 4. RLS Matrix

| Table | superadmin | org_admin | nurse | family | iot_device |
|-------|------------|-----------|-------|--------|------------|
| `organizations` | ALL | SELECT + UPDATE own | SELECT own | SELECT own | DENY |
| `profiles` | ALL | R/W own org | SELECT org + own | own row | own row |
| `patients` | ALL | SELECT org; INSERT active; UPDATE; DELETE | SELECT org; INSERT/UPDATE active | SELECT assigned **and** not archived | DENY |
| `daily_logs` | ALL | SELECT org; write if patient active | same | **DENY table** (view only) | INSERT `hardware_sensor` only |
| `voice_*` | ALL | R/W org if patient active | same | **DENY** | DENY |
| `consent_ledger` | ALL | R/W org | DENY write | SELECT own rows, no INSERT | DENY |
| `family_connections` | ALL | R/W org (active patient) | same | SELECT own | DENY |
| `patient_staff_assignments` | ALL | R/W org (active patient) | SELECT org | DENY | DENY |
| `polar_connections` | ALL | R/W org (active patient) | DENY | DENY | DENY |
| Polar activity/sleep | ALL | SELECT org | SELECT org | SELECT if assignment **and** consent | DENY |
| Polar HR / HRV | ALL | SELECT org | SELECT org | **DENY** | DENY |
| `polar_sync_runs` | SELECT | SELECT own org | DENY | DENY | DENY |
| `polar_oauth_secrets` | DENY (no policy, no GRANT) | DENY | DENY | DENY | DENY |
| `telemetry_logs` | ALL | SELECT org | SELECT org | DENY | DENY |
| `audit_logs` | SELECT | SELECT own org | DENY | DENY | DENY |
| `security_access_logs` | SELECT | SELECT own org | DENY table INSERT; may call `log_security_access` | DENY | DENY |

`service_role` bypasses RLS by design (Edge Polar ingest, cron).

---

## 5. Secrets & Credentials

| Check | Result |
|-------|--------|
| `polar_oauth_secrets` GRANT anon/authenticated | **none** (revoked) |
| RLS policies for clients | none (fail-closed) |
| Views `SELECT *` including secrets | **none** |
| SECURITY DEFINER exposing tokens | **none** found |
| `service_role` / `postgres` | full table access (required for Edge) |

**Do not move secrets.** Current table is the right isolation boundary if Edge never uses the anon key.

Remaining: leaked `service_role` JWT = full token read. That is an ops/secret-management control, not a schema gap.

---

## 6. Audit & Observability

| Mechanism | Append-only | Client INSERT | Actor spoof | Notes |
|-----------|-------------|---------------|-------------|-------|
| `audit_logs` | YES (BEFORE UPDATE/DELETE trigger) | NO (GRANT SELECT only; no INSERT policy) | Trigger uses `auth.uid()` | DELETE payloads on care tables already redacted |
| `security_access_logs` | YES | NO on table | Function sets `actor_id = auth.uid()`, org from JWT | `service_role` can still INSERT directly (trusted Edge) |
| `polar_sync_runs` | no (Edge updates status) | NO for authenticated | N/A | `error_message` must be sanitized in Edge — **not enforced in SQL** |

`org_admin` DELETE of a patient that has `security_access_logs` rows will **fail** (`ON DELETE RESTRICT`). Archive (`archived_at`) remains the non-destructive path.

---

## 7. AI Governance

Columns on `daily_logs` (kept + added):

- Kept: `is_ai_generated`, `approved_by_user_id`
- Added: `ai_model`, `ai_prompt_version`, `ai_generated_at`, `approved_at`

CHECKs (0 violating rows at apply time):

1. `is_ai_generated = true` → `ai_model IS NOT NULL`
2. `approved_at IS NOT NULL` → `approved_by_user_id IS NOT NULL`
3. `is_ai_generated = false` → AI fields NULL

Approval is not defaulted. There is **no** immutability of Peace Letter after approval (staff can still UPDATE `daily_logs` when patient is active). Versioning of approved letters is **not** implemented.

Schema support ≠ EU AI Act conformity (no logging of model outputs to a regulatory file, no deployed Guardrails Edge, no UI marking verified).

---

## 8. Data Lifecycle & Retention

| Data | Current Retention | Mechanism | Status |
|------|-------------------|-----------|--------|
| `voice_*` merged/discarded/abandoned | 30 days | `cleanup_old_voice_drafts` + pg_cron `0 3 * * *` | implemented; job **not** run-verified |
| Active/open voice transcripts | none | — | **REQUIRES_POLICY_DECISION** |
| `daily_logs` / Peace Letter | HLD says ~12 months hot | no job | **REQUIRES_POLICY_DECISION** |
| `polar_*` metrics + connections | none | — | **REQUIRES_POLICY_DECISION** |
| `polar_sync_runs` | none | — | **REQUIRES_POLICY_DECISION** |
| `telemetry_logs` | none | — | **REQUIRES_POLICY_DECISION** |
| `consent_ledger` | keep history (revoke, don't overwrite) | no purge | **REQUIRES_POLICY_DECISION** (legal hold vs erasure) |
| `audit_logs` | none | — | **REQUIRES_POLICY_DECISION** |
| `security_access_logs` | none | — | **REQUIRES_POLICY_DECISION** |
| Patient hard delete | CASCADE care/voice/Polar | `org_admin` DELETE policy | **REQUIRES_POLICY_DECISION** (Art. 17 vs audit trail) |

No arbitrary DELETE jobs were added.

---

## 9. Scalability

Added indexes (skipped existing duplicates):

- `patients (organization_id, archived_at)`
- `daily_logs (organization_id, patient_id, created_at DESC)`
- `family_connections (organization_id, patient_id|profile_id)`
- Polar metrics `(organization_id, patient_id, local_date DESC)`
- `audit_logs (organization_id, created_at DESC)`
- `polar_sync_runs (polar_connection_id, started_at DESC)` and `(organization_id, started_at DESC)`
- `security_access_logs` on org/patient/actor + `accessed_at DESC`
- Unique `(id, organization_id)` on patients, profiles, polar_connections, voice_conversations

Growth risks: `security_access_logs` and Polar daily tables will dominate; partition/retention policy needed before many facilities. RLS predicates use JWT (O(1) per row vs profiles lookup). Advisor still flags DEFINER helpers as callable by `authenticated` (required for RLS/view).

---

## 10. Backup / Recovery / Disaster Recovery

| Item | Status |
|------|--------|
| Repo evidence of PITR enabled | **NOT VERIFIED** |
| Measured RTO 4 h / RPO 1 h (`REQ-NFR-005`) | **NOT VERIFIED** |
| Restore drill | **REQUIRES INFRA CHECK** |
| HLD states PITR UE | documentation only — **not evidence** |
| Region Stockholm | VERIFIED in project config / MASTER_CONTEXT |

Do not assume backup exists because Supabase markets PITR.

---

## 11. Security Test Results

**Catalog tests** (`supabase/tests/enterprise_hardening_catalog.sql`) — **PASS** on linked remote after both pushes:

| Assertion | Result |
|-----------|--------|
| Composite FKs present | PASS (0 missing) |
| OAuth client GRANTs | PASS (none) |
| RLS enabled on new + critical tables | PASS |
| New tables exist | PASS |
| AI CHECKs (3) | PASS |
| Append-only triggers | PASS |
| Family SELECT policies on `voice_*` | PASS (0) |
| Family SELECT policies on HR/HRV tables | PASS (0) |
| Anon EXECUTE on sensitive functions | PASS (empty) |
| Hook `search_path=public` | PASS |

**Not executed (unsafe on production / empty dataset):** live JWT impersonation for org A vs patient B, family vs unassigned, IoT vs voice INSERT. Those remain **policy/catalog-inferred**, not **VERIFIED**.

**Inferred from policies (not runtime):**

| Scenario | Expected | Evidence type |
|----------|----------|----------------|
| Org A → patient B | DENY | RLS JWT org + composite FK |
| Family assigned + not archived | ALLOW patients / family views | policies + helper |
| Family unassigned | DENY | `family_can_access_patient` |
| Family → `daily_logs` / `voice_*` | DENY | no family SELECT policy |
| Family → HR/HRV tables | DENY | policies dropped 20260814104307 |
| Family → comfort view + consent | ALLOW | remaining family SELECT on activity/sleep |
| Nurse org A / org B | ALLOW / DENY | JWT org |
| IoT → voice / arbitrary logs | DENY | INSERT only `hardware_sensor` |
| OAuth secrets via PostgREST | DENY | no GRANT + no policies |

---

## 12. Compliance Technical Controls

Not legal advice. Not a certification.

### NIS2

| Area | Technical control | Verdict |
|------|-------------------|---------|
| Access control / tenancy | RLS + JWT + composite FKs | PARTIAL |
| Logging | `audit_logs` + `security_access_logs` | PARTIAL (access logging not wired in app) |
| Incident / 24h notify | none in DB | REQUIRES ORGANIZATIONAL CONTROL |
| Supply chain (Polar, OpenAI, Cloudflare) | secrets isolation for Polar tokens | REQUIRES ORGANIZATIONAL CONTROL |
| Backup / continuity | undocumented PITR | REQUIRES INFRA CHECK |

**Overall NIS2:** REQUIRES ORGANIZATIONAL CONTROL + REQUIRES LEGAL/POLICY DECISION.

### ISO 27001

| Annex-style theme | Technical control | Verdict |
|-------------------|-------------------|---------|
| A.5/A.8 access | RLS, grants, OAuth lockdown | PARTIAL |
| Logging / monitoring | audit + access log table | PARTIAL (no SIEM, no app emit) |
| Crypto | platform at-rest/in-transit; PESEL hash | PARTIAL (ADR-005) |
| Secure SDLC | migrations, advisors | PARTIAL |
| Asset / retention | incomplete | REQUIRES LEGAL/POLICY DECISION |

**Overall ISO 27001:** PARTIAL technical; REQUIRES ORGANIZATIONAL CONTROL for ISMS.

### EU AI Act

| Theme | Technical control | Verdict |
|-------|-------------------|---------|
| Art. 50 marking | `is_ai_generated` + `ai_model` CHECK | PARTIAL (schema; UI/Edge not verified) |
| Human oversight | `approved_by_user_id` + `approved_at` pair CHECK | PARTIAL (no workflow) |
| Prompt version / provenance | nullable columns | PARTIAL |
| Prohibited practices / risk class | product decision, not DB | REQUIRES LEGAL/POLICY DECISION |
| GPAI provider logs | not in this DB | REQUIRES ORGANIZATIONAL CONTROL |

**Overall EU AI Act:** PARTIAL technical schema only. **Do not treat the database as Act-compliant.**

---

## 13. Remaining Risks

| Severity | Risk | Impact | Recommendation |
|----------|------|--------|----------------|
| HIGH | `org_admin` DELETE `patients` CASCADE wipes care/voice/Polar | Destroys history; conflicts with audit RESTRICT once access logs exist | Policy: archive-only vs Art. 17 procedure |
| HIGH | `service_role` bypasses RLS (Polar webhook can write archived patients) | Integrity of archive + ingest | Edge must check `archived_at`; do not rely on RLS |
| HIGH | No JWT RLS E2E | False confidence | Staging harness with test JWTs (not on prod) |
| MEDIUM | Nurse access org-wide; assignments unused | Over-broad staff access | Cutover after product decision |
| MEDIUM | `family_daily_reports` SECURITY DEFINER | Advisor ERROR; intentional DTO | Keep; document exception |
| MEDIUM | `log_security_access` callable by any authenticated (denied inside) | Noise / probing | Optional: hide from API schema |
| MEDIUM | `error_message` on sync runs can leak secrets if Edge dumps exceptions | Token leak in DB | Sanitize in `polar-webhook` |
| MEDIUM | Open voice transcripts retained forever | RODO storage limitation | REQUIRES_POLICY_DECISION |
| MEDIUM | `rls_auto_enable` executable by anon (platform) | Advisor WARN | Leave unless Supabase confirms safe revoke |
| MEDIUM | FORCE RLS off (owner bypass) | postgres/migrations bypass | expected; do not FORCE without testing triggers |
| LOW | `consent_ledger.source` default `family_portal` while writers are org_admin | Misleading provenance | REQUIRES_POLICY_DECISION on allowed `source` values |
| LOW | Approved Peace Letter still mutable | Weak HITL evidence | Optional immutability / version rows |
| LOW | Default privileges may re-GRANT new public tables to anon | Repeat of OAuth GRANT bug | `ALTER DEFAULT PRIVILEGES` — REQUIRES_REVIEW |

---

## 14. Recommended Next Steps

### P0 — before production

1. Enable and verify Auth Hook `custom_access_token_hook` in Dashboard (ADR-006) — JWT org/role must be present or RLS fails closed/open incorrectly.
2. Confirm PITR / backup + restore drill (`REQ-NFR-005`).
3. Wire Polar Edge to: never persist tokens in `error_message`; skip ingest for `archived_at IS NOT NULL`.
4. Decide patient **hard DELETE** vs archive-only (CASCADE vs Art. 17).
5. Do **not** ship family UI that queries HR/HRV tables (now denied).

### P1 — should fix soon

1. Staging RLS suite with real JWTs (cross-tenant, family, IoT).
2. Product decision: bind nurse SELECT to `patient_staff_assignments`.
3. Retention policies for `daily_logs`, Polar, consent, audit, access logs, open transcripts.
4. App emit to `log_security_access` on family/staff VIEW of patient records.
5. Consent `source` vocabulary vs org_admin-only grants.

### P2 — future hardening

1. Peace Letter versioning / immutability after approval.
2. Partition `security_access_logs` / Polar metrics.
3. `ALTER DEFAULT PRIVILEGES` so new tables are not GRANT ALL to `anon`.
4. Move DEFINER helpers out of exposed API schema (keep RLS callable).
5. Review `rls_auto_enable` with Supabase support.

---

## Preflight notes (Krok 0)

- Business tables were empty (except 3 `audit_logs` rows after later ops). No orphan/cross-tenant repair was performed or required.
- `profiles.organization_id` nullable for superadmin — composite FKs **not** applied to `approved_by_user_id` / `created_by` / `author_id`.
- Single-column FKs retained.
- `polar_oauth_secrets` has no `organization_id` (keyed by connection); tenant follows `polar_connections`.
