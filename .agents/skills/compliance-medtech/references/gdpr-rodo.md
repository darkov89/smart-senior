# GDPR / RODO — key obligations (Pakiet Spokoju)

Source framing: Regulation (EU) 2016/679 + Polish RODO practice. Focus: **what engineers and product must satisfy** for a multi-tenant care-home SaaS processing health-related data.

Load this file for privacy reviews, DPIA-lite, family/patient data design, retention, or rights-request features.

---

## 1. Material scope

| Applies when | Example in this product |
|--------------|-------------------------|
| Personal data of identifiable natural persons | Patients, nurses, family members, org admins |
| Special category / health data (Art. 9) | Voice notes, AI summaries, sensor context tied to a patient |
| Processing by controller or processor | Dragonfly / house as controller; Supabase/OpenAI as processors (contracts required) |

**Identifiers to treat carefully:** names, room, `pesel_hash`, auth emails, voice/`raw_data`, `processed_data`, IP in `audit_logs`.

---

## 2. Principles (Art. 5) — checklist

| Principle | Meaning | Repo expectation |
|-----------|---------|------------------|
| **Lawfulness, fairness, transparency** | Valid legal basis; clear notices | Product/legal: privacy notice + contracts with care homes; code: no dark patterns in consent UI |
| **Purpose limitation** | Only stated care/reporting purposes | Do not reuse logs for unrelated analytics without basis |
| **Data minimization** | Adequate, relevant, limited | `patients`: name + initial + `pesel_hash` + room — not full PESEL in cleartext; family → `daily_reports.content` / `family_daily_reports` only (`published`) |
| **Accuracy** | Keep data correct | Allow staff correction paths; avoid silent AI overwrite without audit |
| **Storage limitation** | Retention limits | Define retention for `daily_logs`, audio, `audit_logs`; implement delete/anonymize jobs (process + code) |
| **Integrity & confidentiality** | Appropriate security | RLS, Edge auth, TLS (platform), no secrets in client — see `SECURITY.md` |
| **Accountability** | Demonstrate compliance | `audit_logs`, policies in git (`SECURITY.md`), DPIA docs outside repo |

---

## 3. Lawful basis (Art. 6) & health data (Art. 9)

Health / medical-context data needs **Art. 6 basis + Art. 9 exception**, typically:

- provision of health/social care (Art. 9(2)(h)) under national law, and/or
- explicit consent (Art. 9(2)(a)) where care-home contracts require it,
- employment / staff accounts under Art. 6 (separate from patient health data).

**Engineering implication:** do not invent a new processing purpose in code (e.g. training models on `raw_data`) without legal basis + DPIA.

---

## 4. Privacy by design & by default (Art. 25)

| Control | Pakiet Spokoju |
|---------|----------------|
| Default least privilege | RLS by `app_role`; `iot_device` INSERT-only |
| Minimize exposure | View `family_daily_reports` without `raw_data` |
| Process sensitive logic server-side | Whisper / GPT / Guardrails only in Edge Functions |
| Pseudonymisation where useful | `pesel_hash` instead of clear PESEL |
| Separate environments / tenants | `organization_id`; no shared DFCMS deploy |

**Forbidden:** parsing/filtering clinical content in Alpine / browser JS.

---

## 5. Data subject rights (Art. 12–22)

| Right | Engineering / product need |
|-------|----------------------------|
| **Access (15)** | Export path for profile + linked patient reports user is entitled to |
| **Rectification (16)** | Staff can correct patient/profile fields; audit UPDATE |
| **Erasure (17)** | Documented delete/anonymize for patient + logs (with legal exceptions for care/audit) |
| **Restriction (18)** | Flag / soft-lock processing if required by process |
| **Portability (20)** | Machine-readable export of data provided by the user where applicable |
| **Object (21)** | Especially marketing — N/A for core care logs; still document |
| **Automated decisions (22)** | AI summaries assist staff — avoid solely automated decisions with legal effects on patients without human oversight |

When building features: prefer **admin/staff tools + Edge** over ad-hoc SQL; never expose other tenants’ data via “export”.

---

## 6. Controllers, processors, transfers (Art. 28, Chapter V)

| Party | Typical role | Must have |
|-------|--------------|-----------|
| Care home (customer) | Often controller of resident data | Contract with platform; instructions |
| Platform operator | Controller and/or processor (depends on offering) | DPA (Art. 28), TOMs, subprocessors list |
| Supabase | Processor (hosting/DB/Auth) | DPA + region awareness (`bmughdoqdsjfstxnnjks` North EU) |
| OpenAI (Whisper/GPT) | Processor / subprocessor for AI | DPA; **no** API keys in frontend; prefer EU/data-handling settings per contract |
| Cloudflare Pages | Host of static UI (prefer no personal data in static assets) | Only publishable config in client |

**Transfers outside EEA:** only with SCC / adequacy / other Chapter V tool — track in vendor register (process).

---

## 7. Security of processing (Art. 32)

Aligns with ISO/NIS2. Minimum for this codebase:

- [ ] Encryption in transit (HTTPS) — platform default
- [ ] Access control — Auth + RLS + roles
- [ ] Resilience — backups via Supabase; restore tested (ops)
- [ ] Restore availability — RTO/RPO documented (ops)
- [ ] Testing/assessment — security review on auth/RLS/Edge changes
- [ ] Confidentiality of AI pipeline — Edge only; no `raw_data` to family clients

---

## 8. Breach notification (Art. 33–34)

| Step | Timing | Who |
|------|--------|-----|
| Detect & contain | Immediate | Engineering + on-call |
| Notify supervisory authority | **Without undue delay, ≤ 72h** where required | DPO / management |
| Notify data subjects | When high risk to rights/freedoms | Management + legal |

**Code support:** retain enough `audit_logs` and access logs to investigate; do not log secrets or full health payloads into third-party analytics.

---

## 9. DPIA (Art. 35) — when required

Likely **yes** for systematic processing of health data at scale in care homes.

DPIA (process doc) should cover: voice → AI → storage → family sharing. Agent should **flag** new high-risk processing (new biometrics, continuous sensors, cross-border model training) and refuse to silently expand scope in code.

---

## 10. Records & governance (Art. 30, 37–39)

| Artefact | Owner | Notes |
|----------|-------|-------|
| Record of processing activities | Controller | Outside repo; keep purposes in sync with features |
| DPO | If required | Contact path for rights requests |
| Privacy notice | Product/legal | Human language — UI must not contradict it |

---

## 11. Repo map — GDPR → artefacts

| Obligation | Artefact |
|------------|----------|
| Minimization | `patients` columns; `family_daily_reports`; no FE Guardrails |
| Confidentiality | RLS policies; Edge JWT; secrets hygiene |
| Accountability | `audit_logs` + triggers; `SECURITY.md` |
| Purpose / AI | Edge Functions only; Guardrails system prompt server-side |
| Tenant isolation | `organization_id` on all tenant tables |
| Special data handling | `raw_data` / `voice_*` staff-only; family = `daily_reports` published |

---

## 12. GDPR review checklist (copy)

```
GDPR / RODO:
- [ ] Legal basis / Art. 9 path known for this processing (process)
- [ ] Only necessary fields collected and stored
- [ ] Family / least-privilege roles cannot read raw clinical content
- [ ] No medical logic in browser
- [ ] Tenant isolation intact
- [ ] Audit on sensitive UPDATE/DELETE
- [ ] Retention / erasure path considered
- [ ] New vendors / subprocessors listed (process)
- [ ] Breach/detectability not reduced by the change
- [ ] UI copy matches privacy expectations (no oversharing)
```
