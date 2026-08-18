# Requirements Traceability & Verification

**Cel:** odpowiedzieć: *co wymaga HLD → gdzie zaimplementowano → jak testowano → czy zweryfikowano → czy spełnione?*

**Zasady:**
- *Implementation is not verification.*
- **Nigdy** nie ustawiaj `VERIFIED` bez dowodu (`evidence`).
- Nie twierdź „requirement satisfied” gdy status ≠ `VERIFIED`.
- Warstwa należy do Second Brain (ADR-003/004) — nie osobny system pamięci.
- HLD = źródło wymagań; ten plik = rejestr śledzenia; MASTER = stan live; ADR = decyzje.

**Statusy:** `NOT_IMPLEMENTED` | `IMPLEMENTED` | `PARTIALLY_VERIFIED` | `VERIFIED` | `FAILED` | `BLOCKED` | `SUPERSEDED` | `UNKNOWN`

---

## Summary (ludzki widok)

| ID | Requirement | Source | Status | Evidence | Related ADR |
|----|-------------|--------|--------|----------|-------------|
| REQ-SEC-001 | Tenant isolation via RLS + `organization_id` | HLD A.3 / D.2 | IMPLEMENTED | catalog FKs/RLS 2026-08-14 — **no JWT RLS E2E** | ADR-006 |
| REQ-SEC-002 | Family never reads `raw_data` | HLD B.2 / C | IMPLEMENTED | `family_daily_reports` ← `daily_reports` published — catalog pending JWT E2E | — |
| REQ-SEC-003 | Audit trail on UPDATE/DELETE | HLD D / ISO posture | IMPLEMENTED | append-only trigger + catalog test — **no row-level audit E2E** | — |
| REQ-DATA-001 | Multi-tenant key = `organization_id` | HLD / MASTER | IMPLEMENTED | schema + helpers — **no isolation E2E** | — |
| REQ-DATA-002 | 30-day purge of merged/discarded raw voice | HLD C retencja | IMPLEMENTED | `cleanup_old_voice_drafts()` + pg_cron — **no job-run evidence** | — |
| REQ-AI-001 | No medical Guardrails in browser | HLD B.2 | IMPLEMENTED | architecture (Edge-only AI) — **no FE static check CI** | — |
| REQ-AI-002 | Urgency → pending clinical review | HLD B.2 | NOT_IMPLEMENTED | Edge AI pipeline not shipped; stub only in tests | ADR-002 |
| REQ-AI-003 | Human approval before Peace Letter | HLD D.3 | IMPLEMENTED | `approved_by_user_id` column — **workflow not verified** | ADR-002 |
| REQ-AI-004 | AI output marked (`is_ai_generated`) | HLD D.3 / Art. 50 | IMPLEMENTED | column on `daily_logs` — **UI/Edge path not verified** | ADR-002 |
| REQ-AI-005 | Guardrails regression suite | HLD F | PARTIALLY_VERIFIED | `guardrails.test.ts` (6 stub cases: follow-up, klinika, godność, injection; HLD target ≥100; not prod LLM) | ADR-002 / ADR-010 |
| REQ-AI-006 | Telemetry non-MD (no clinical HR language) | HLD B.3 / H.1 | IMPLEMENTED | skill + ADR + ingest aggregates — **no dedicated non-MD test** | ADR-002 |
| REQ-AI-007 | Conversational follow-up before Peace Letter | HLD B.2 / ADR-010 | IMPLEMENTED | schema `voice_*` + stub follow-up test — **no Whisper/GPT Edge** | ADR-010 |
| REQ-AI-008 | Clinical jargon + dignity never in family channel | HLD B.2 / D.3 | PARTIALLY_VERIFIED | stub cases jargon + dignity; not prod LLM | ADR-010 |
| REQ-IOT-001 | Per-org BLE gateway auth (`iot_gateways`) | HLD C / ADR-002 | SUPERSEDED | DROP `iot_gateways` + removed `ingest-telemetry` (2026-08-13); Polar = ADR-007 | ADR-007 |
| REQ-IOT-002 | Polar daily aggregates + family SELECT only with consent | HLD C / ADR-009 | IMPLEMENTED | family DENY HR/HRV tables; catalog 2026-08-14 — **no JWT E2E** | ADR-009 |
| REQ-NFR-001 | Availability ≥ 99.5% | HLD A.3 | NOT_IMPLEMENTED | no uptime measurement / SLO evidence | — |
| REQ-NFR-002 | Note save &lt; 60 s (p95) | HLD A.3 | NOT_IMPLEMENTED | no performance harness | — |
| REQ-NFR-003 | AI latency &lt; 15 s (p95) | HLD A.3 | NOT_IMPLEMENTED | AI Edge pipeline not shipped | — |
| REQ-NFR-004 | Offline-first PWA sync | HLD A.3 / E | NOT_IMPLEMENTED | no SW / IndexedDB queue in repo yet | — |
| REQ-NFR-005 | Backup RTO 4 h / RPO 1 h | HLD C | UNKNOWN | relies on Supabase PITR — **not project-verified here** | — |
| REQ-FUNC-001 | Voice note → Peace Letter path | HLD B.2 / MVP | NOT_IMPLEMENTED | Whisper/GPT Edge + merge CRON not deployed; schema ADR-010 ready | ADR-010 |
| REQ-FUNC-002 | Evening merge of same-day voice drafts | HLD B.2 / ADR-010 | NOT_IMPLEMENTED | table `voice_draft_notes`; Edge CRON `merge-daily-peace-letters` not shipped | ADR-010 |

---

## Requirement records

### REQ-SEC-001

```yaml
id: REQ-SEC-001
title: Tenant data isolation (RLS + organization_id)
source: HLD
source_section: "A.3 NFR / D.2 Threat model"
status: IMPLEMENTED
priority: CRITICAL
implementation:
  - supabase/migrations/20260717193117_init_multi_tenant_schema.sql
  - supabase/migrations/20260811185009_add_telemetry_logs.sql
  - supabase/migrations/20260812081000_iot_gateways.sql
  - supabase/migrations/20260813101000_jwt_claims_hook.sql
  - supabase/migrations/20260813132832_drop_iot_gateways.sql
  - supabase/migrations/20260814103804_enterprise_hardening.sql
  - supabase/migrations/20260814104307_enterprise_hardening_followup.sql
tests:
  - supabase/tests/enterprise_hardening_catalog.sql
related_decisions:
  - ADR-006
verification:
  status: IMPLEMENTED
  method: "catalog assertions on linked DB (composite FKs, RLS flags, oauth grants); no JWT impersonation E2E"
  evidence:
    - docs/ENTERPRISE_HARDENING_REPORT.md
    - supabase/tests/enterprise_hardening_catalog.sql
  last_verified: null
  verified_by: null
```

### REQ-SEC-002

```yaml
id: REQ-SEC-002
title: Family channel excludes raw_data
source: HLD
source_section: "B.2 / C family_daily_reports"
status: IMPLEMENTED
priority: CRITICAL
implementation:
  - supabase/migrations/20260717193117_init_multi_tenant_schema.sql
  - supabase/migrations/20260814112552_product_workflow_and_notifications.sql
tests:
  - supabase/tests/product_workflow_catalog.sql
related_decisions: []
verification:
  status: IMPLEMENTED
  method: null
  evidence: []
  last_verified: null
```

### REQ-SEC-003

```yaml
id: REQ-SEC-003
title: Audit log on sensitive UPDATE/DELETE
source: HLD
source_section: "D Secure by Design / ISO posture"
status: IMPLEMENTED
priority: HIGH
implementation:
  - supabase/migrations/20260717193117_init_multi_tenant_schema.sql
  - supabase/migrations/20260814112552_product_workflow_and_notifications.sql
tests:
  - supabase/tests/product_workflow_catalog.sql
related_decisions: []
verification:
  status: IMPLEMENTED
  evidence: []
  last_verified: null
```

### REQ-DATA-001

```yaml
id: REQ-DATA-001
title: Multi-tenant key organization_id
source: HLD
source_section: "C / MASTER_CONTEXT §5"
status: IMPLEMENTED
priority: CRITICAL
implementation:
  - docs/MASTER_CONTEXT.md
  - supabase/migrations/20260717193117_init_multi_tenant_schema.sql
tests: []
related_decisions: []
verification:
  status: IMPLEMENTED
  evidence: []
  last_verified: null
```

### REQ-DATA-002

```yaml
id: REQ-DATA-002
title: Purge merged/discarded raw voice after 30 days
source: HLD
source_section: "C Retencja i backup"
status: IMPLEMENTED
priority: HIGH
implementation:
  - supabase/migrations/20260813145248_voice_enum_and_retention.sql
tests: []
related_decisions: []
verification:
  status: IMPLEMENTED
  method: "function + pg_cron 03:00 Europe/Warsaw + GRANT postgres/service_role — no automated test of the job run"
  evidence: []
  last_verified: null
```

### REQ-AI-001

```yaml
id: REQ-AI-001
title: No medical content Guardrails in the browser
source: HLD
source_section: "B.2 critical rule"
status: IMPLEMENTED
priority: CRITICAL
implementation:
  - .cursor/rules/secure-by-design.mdc
  - .cursor/rules/ai-prompt-guardrails.mdc
tests: []
related_decisions: []
verification:
  status: IMPLEMENTED
  evidence: []
  last_verified: null
```

### REQ-AI-002

```yaml
id: REQ-AI-002
title: Urgency flag triggers pending clinical review
source: HLD
source_section: "B.2 Guardrails sequence"
status: NOT_IMPLEMENTED
priority: CRITICAL
implementation: []
tests:
  - supabase/functions/tests/guardrails.test.ts
related_decisions:
  - ADR-002
verification:
  status: NOT_IMPLEMENTED
  method: "stub Guardrails matrix only — production Edge urgency path missing"
  evidence: []
  last_verified: null
```

### REQ-AI-003

```yaml
id: REQ-AI-003
title: Human-in-the-loop before family Peace Letter
source: HLD
source_section: "D.3 EU AI Act"
status: IMPLEMENTED
priority: CRITICAL
implementation:
  - supabase/migrations/20260812080000_add_ai_compliance.sql
  - supabase/migrations/20260814103804_enterprise_hardening.sql
tests: []
related_decisions:
  - ADR-002
verification:
  status: IMPLEMENTED
  method: null
  evidence: []
  last_verified: null
```

### REQ-AI-004

```yaml
id: REQ-AI-004
title: AI-generated content marked (is_ai_generated)
source: HLD
source_section: "D.3 / Art. 50"
status: IMPLEMENTED
priority: HIGH
implementation:
  - supabase/migrations/20260812080000_add_ai_compliance.sql
  - supabase/migrations/20260814103804_enterprise_hardening.sql
tests: []
related_decisions:
  - ADR-002
verification:
  status: IMPLEMENTED
  evidence: []
  last_verified: null
```

### REQ-AI-005

```yaml
id: REQ-AI-005
title: Guardrails regression testing (prompt injection / clinical leak)
source: HLD
source_section: "F Testowalność"
status: PARTIALLY_VERIFIED
priority: CRITICAL
implementation:
  - supabase/functions/tests/guardrails.test.ts
tests:
  - supabase/functions/tests/guardrails.test.ts
related_decisions:
  - ADR-002
  - ADR-010
verification:
  status: PARTIALLY_VERIFIED
  method: "automated Deno stub matrix (6 cases: follow-up, jargon, dignity, injection, diagnosis, happy-path); not production LLM; HLD target ≥100"
  evidence:
    - supabase/functions/tests/guardrails.test.ts
  last_verified: 2026-08-13
  verified_by: agent (deno test)
```

### REQ-AI-006

```yaml
id: REQ-AI-006
title: Wearable telemetry must not produce clinical diagnoses
source: HLD
source_section: "B.3 / H.1 non-MD"
status: IMPLEMENTED
priority: CRITICAL
implementation:
  - .agents/skills/telemetry-context-provider/SKILL.md
  - supabase/migrations/20260811185009_add_telemetry_logs.sql
tests: []
related_decisions:
  - ADR-002
verification:
  status: IMPLEMENTED
  evidence: []
  last_verified: null
```

### REQ-AI-007

```yaml
id: REQ-AI-007
title: Incomplete voice notes must prompt staff instead of emitting Peace Letter
source: HLD
source_section: "B.2 Conversational Voice / ADR-010"
status: IMPLEMENTED
priority: CRITICAL
implementation:
  - supabase/migrations/20260813135918_voice_conversation_drafts.sql
  - .cursor/rules/ai-prompt-guardrails.mdc
  - docs/adr/010-conversational-voice-guardrails.md
tests:
  - supabase/functions/tests/guardrails.test.ts
related_decisions:
  - ADR-010
verification:
  status: IMPLEMENTED
  method: "schema + stub follow-up case; production conversational Edge not shipped"
  evidence:
    - supabase/functions/tests/guardrails.test.ts
  last_verified: null
```

### REQ-AI-008

```yaml
id: REQ-AI-008
title: Clinical jargon and dignity-violating detail never reach family Peace Letter
source: HLD
source_section: "B.2 / D.3 / ADR-010"
status: PARTIALLY_VERIFIED
priority: CRITICAL
implementation:
  - .cursor/rules/ai-prompt-guardrails.mdc
  - supabase/migrations/20260813135918_voice_conversation_drafts.sql
tests:
  - supabase/functions/tests/guardrails.test.ts
related_decisions:
  - ADR-010
verification:
  status: PARTIALLY_VERIFIED
  method: "Deno stub cases clinical-jargon-split + dignity-incontinence-generalize; not production LLM"
  evidence:
    - supabase/functions/tests/guardrails.test.ts
  last_verified: 2026-08-13
  verified_by: agent (deno test)
```

### REQ-IOT-001

```yaml
id: REQ-IOT-001
title: BLE ingest authenticated per organization gateway token
source: HLD
source_section: "C / ADR-002 → superseded by ADR-007"
status: SUPERSEDED
priority: CRITICAL
implementation:
  - supabase/migrations/20260812081000_iot_gateways.sql
  - supabase/migrations/20260813132832_drop_iot_gateways.sql
tests: []
related_decisions:
  - ADR-002
  - ADR-007
verification:
  status: SUPERSEDED
  method: "requirement retired with BLE gateway ingest"
  evidence:
    - "DROP TABLE iot_gateways (20260813132832); ingest-telemetry removed from repo"
  last_verified: 2026-08-13
  verified_by: agent session
  superseded_by: REQ-IOT-002 / ADR-007 / ADR-009

### REQ-IOT-002

```yaml
id: REQ-IOT-002
title: Polar 360 daily aggregates with family SELECT only when assignment + wearable consent
source: HLD
source_section: "C / ADR-009"
status: IMPLEMENTED
priority: CRITICAL
implementation:
  - supabase/migrations/20260813134500_polar_wearable_consent.sql
  - supabase/migrations/20260814104307_enterprise_hardening_followup.sql
tests:
  - supabase/tests/enterprise_hardening_catalog.sql
related_decisions:
  - ADR-007
  - ADR-009
verification:
  status: IMPLEMENTED
  method: "catalog: zero family SELECT policies on polar_heart_rate_daily / polar_hrv_nights; no JWT E2E"
  evidence:
    - docs/ENTERPRISE_HARDENING_REPORT.md
  last_verified: null
```


```

### REQ-NFR-001

```yaml
id: REQ-NFR-001
title: Availability ≥ 99.5% monthly uptime
source: HLD
source_section: "A.3"
status: NOT_IMPLEMENTED
priority: HIGH
implementation: []
tests: []
related_decisions: []
verification:
  status: NOT_IMPLEMENTED
  evidence: []
  last_verified: null
```

### REQ-NFR-002

```yaml
id: REQ-NFR-002
title: Note save latency < 60 seconds (p95)
source: HLD
source_section: "A.3"
status: NOT_IMPLEMENTED
priority: HIGH
implementation: []
tests: []
related_decisions: []
verification:
  status: NOT_IMPLEMENTED
  evidence: []
  last_verified: null
```

### REQ-NFR-003

```yaml
id: REQ-NFR-003
title: AI processing latency < 15 seconds (p95)
source: HLD
source_section: "A.3"
status: NOT_IMPLEMENTED
priority: HIGH
implementation: []
tests: []
related_decisions: []
verification:
  status: NOT_IMPLEMENTED
  evidence: []
  last_verified: null
```

### REQ-NFR-004

```yaml
id: REQ-NFR-004
title: Offline-first PWA — notes sync after reconnect
source: HLD
source_section: "A.3 / E Degraded mode"
status: NOT_IMPLEMENTED
priority: CRITICAL
implementation: []
tests: []
related_decisions: []
verification:
  status: NOT_IMPLEMENTED
  method: "no service worker / IndexedDB queue found in frontend"
  evidence: []
  last_verified: null
```

### REQ-NFR-005

```yaml
id: REQ-NFR-005
title: Backup RTO ≤ 4h and RPO ≤ 1h
source: HLD
source_section: "C Retencja i backup"
status: UNKNOWN
priority: HIGH
implementation: []
tests: []
related_decisions: []
verification:
  status: UNKNOWN
  method: "assumes Supabase PITR — not measured in this repo"
  evidence: []
  last_verified: null
```

### REQ-FUNC-001

```yaml
id: REQ-FUNC-001
title: Voice note pipeline to Peace Letter (MVP core)
source: HLD
source_section: "B.2 / H Roadmapa MVP"
status: NOT_IMPLEMENTED
priority: CRITICAL
implementation:
  - supabase/migrations/20260813135918_voice_conversation_drafts.sql
tests:
  - supabase/functions/tests/guardrails.test.ts
related_decisions:
  - ADR-010
verification:
  status: NOT_IMPLEMENTED
  method: "schema and Guardrails stub only — Whisper/GPT Edge and merge CRON missing"
  evidence: []
  last_verified: null
```

### REQ-FUNC-002

```yaml
id: REQ-FUNC-002
title: Evening merge of same-day voice drafts into one Peace Letter
source: HLD
source_section: "B.2 Merge / ADR-010"
status: NOT_IMPLEMENTED
priority: HIGH
implementation:
  - supabase/migrations/20260813135918_voice_conversation_drafts.sql
tests: []
related_decisions:
  - ADR-010
verification:
  status: NOT_IMPLEMENTED
  method: "voice_draft_notes ready; Edge CRON merge-daily-peace-letters not shipped"
  evidence: []
  last_verified: null
```

---

## Agent rules (short)

1. Przy tasku SEC/DATA/AI/IOT/NFR — retrieve matching `REQ-*` rows (nie cały rejestr).  
2. Krytyczne REQ ze statusem ≠ `VERIFIED` → mów: *implementation may exist; verification evidence missing/incomplete*.  
3. Nie awansuj do `VERIFIED` bez nowego, prawdziwego evidence.  
4. Test fail regresji → ustaw `FAILED` i zgłoś widocznie.  
5. Zmiana wymagania HLD → zaktualizuj ten plik + ewentualnie ADR; nie zmazuj historii statusów bez lifecycle.
