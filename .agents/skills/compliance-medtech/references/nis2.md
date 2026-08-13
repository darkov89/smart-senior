# NIS2 — key obligations (Pakiet Spokoju)

Source framing: Directive (EU) 2022/2555 (NIS2) and national transposition. Focus: **cybersecurity risk-management measures** and **incident reporting** that affect how we build and operate this SaaS.

Whether Dragonfly / a given care home is formally an **essential** or **important** entity is a **legal classification** (size, sector — health, digital providers, etc.). Regardless of formal status, treat the technical measures below as **mandatory engineering baseline** for this product.

Load for incident readiness, supply-chain/vendor risk, secure SDLC, resilience, or “NIS2 gap” questions.

---

## 1. Governance & accountability (Arts. 20–21)

| Expectation | Product / ops | Engineering |
|-------------|-----------------|-------------|
| Management approves cybersecurity measures | Org process | Agent flags when a change weakens controls “for speed” |
| Risk-management measures proportionate to risk | Risk register (process) | Prefer stronger controls for health data & multi-tenant isolation |
| Training / awareness | Org | Follow `SECURITY.md`; no secrets in chat/logs |

---

## 2. Risk-management measures (Art. 21) — core list

NIS2 expects policies and measures including at least:

### 2.1 Risk analysis & information system security policies

- Maintain `SECURITY.md` + architecture in `MASTER_CONTEXT.md`.
- Re-assess risk when adding: new Edge AI flows, IoT ingest, family exports, new subprocessors.

### 2.2 Incident handling

| Capability | Requirement | Repo support |
|------------|-------------|--------------|
| Detect | Unusual access, failed auth spikes, policy bypass attempts | `audit_logs`; platform logs (Supabase/CF) |
| Respond | Contain, eradicate, recover | Disable keys/roles; rotate secrets; rollback deploy |
| Report | National CSIRT / authority timelines (see §3) | Runbook (process) — agent must not invent fake “we notified” |
| Learn | Post-incident review | Update SECURITY / MASTER_CONTEXT |

### 2.3 Business continuity & crisis management

- Backups and restore tested (Supabase).
- Deploy rollback: previous Pages deployment; DB migration discipline (forward-fix preferred; document risky downs).
- Dependency on OpenAI: define degraded mode (e.g. staff text notes without AI) — product decision.

### 2.4 Supply-chain security

| Supplier | Risk focus | Control |
|----------|------------|---------|
| Supabase | Data store, Auth, RLS | Correct project-ref; RLS never off in prod; DPA |
| Cloudflare Pages | Static hosting / CDN | Project `smart-senior` only; no secret env in public bundle |
| OpenAI | Health-related content in prompts | Keys only in Edge secrets; minimize prompt data; contract/DPA |
| npm / CDN (Tailwind, Alpine, supabase-js) | Supply-chain compromise | Pin versions where possible; prefer known CDNs; review new deps |
| GitHub | Source integrity | Protected `main`; no force-push of secrets |

**Hard rule:** never deploy this app to DFCMS Cloudflare/Supabase projects — cross-product blast radius.

### 2.5 Security in network & information systems acquisition, development, maintenance

Secure SDLC for this repo:

1. Design: tenant + role model first.
2. Implement: RLS in same migration as table; Edge verifies JWT.
3. Review: `secure-by-design` + this skill on security-relevant PRs.
4. Test: verify family cannot `SELECT raw_data`; IoT cannot read clinical tables.
5. Release: check `project-ref` / Pages project name before push/deploy.
6. Maintain: patch vulns; rotate leaked tokens immediately.

### 2.6 Policies & procedures to assess effectiveness

- Periodic review of RLS policies and Edge auth.
- After incidents or near-misses, update checklists.

### 2.7 Basic cyber hygiene & cybersecurity training

- No production secrets in `.env` committed to git.
- Phishing-resistant habits for admin accounts (ops; MFA recommended for `org_admin` / `superadmin`).

### 2.8 Cryptography & encryption (where appropriate)

- TLS everywhere (platform).
- Secrets in vaults (Supabase Secrets / CF encrypted env).
- `pesel_hash` rather than clear PESEL.
- No plaintext credentials in repos or Pages.

### 2.9 Human resources security

- Offboarding removes Auth users / roles (ops).
- Least privilege on GitHub and cloud consoles.

### 2.10 Access control & asset management

- `app_role` + RLS + `organization_id`.
- Inventory: production projects, Edge functions, API keys (ops register).

### 2.11 Multi-factor authentication / continuous authentication (where appropriate)

- Prefer MFA for privileged human accounts (Supabase Auth / IdP) — product/ops backlog if not enabled.
- Devices (`iot_device`): dedicated rotated tokens, not shared user passwords.

### 2.12 Secured communication & emergency communication (as applicable)

- Incident contact in `SECURITY.md`.
- Avoid discussing exploit details publicly before fix.

---

## 3. Incident reporting (Art. 23) — timelines to know

Exact national forms vary; typical NIS2 pattern:

| Report | Timing (indicative) | Content |
|--------|---------------------|---------|
| **Early warning** | **≤ 24 hours** after becoming aware of significant incident | Nature, severity, indicators |
| **Incident notification** | **≤ 72 hours** | Update + assessment |
| **Final report** | **≤ 1 month** (or when handled) | Root cause, mitigations |

**Significant incident** examples for this product: cross-tenant data exposure, mass credential leak, ransomware on admin, prolonged loss of care-reporting service, unauthorized exfiltration of `raw_data`.

**Agent behaviour:** on discovering a likely vulnerability or exposure in-repo, prioritize **containment guidance** (rotate keys, patch RLS, revoke tokens) and point to `SECURITY.md` reporting — do not publish exploit PoCs.

---

## 4. Registration & supervision (entity-level)

If classified under NIS2, entities must register with competent authority and may face supervision/fines. **Out of scope for code agents** except: do not weaken technical measures that management relies on for compliance evidence.

---

## 5. Repo map — NIS2 → artefacts

| Measure | Artefact |
|---------|----------|
| Policies | `SECURITY.md`, this skill, MASTER_CONTEXT |
| Access control | RLS, roles, Edge JWT |
| Cryptography / secrets | Env hygiene, Secrets stores |
| Secure development | No FE medical logic; migration+RLS; reviews |
| Supply chain | Pinned deploy targets; vendor isolation from DFCMS |
| Incident / logging | `audit_logs`; security reporting email |
| Continuity | Supabase backups; Pages rollback (ops) |

---

## 6. NIS2 review checklist (copy)

```
NIS2:
- [ ] Change does not weaken tenant isolation, auth, or audit
- [ ] New dependency / vendor assessed (supply chain)
- [ ] Secrets & deploy targets correct (smart-senior / bmughdoqdsjfstxnnjks)
- [ ] Secure SDLC steps followed (RLS with schema, Edge auth)
- [ ] Logging/monitoring still sufficient to detect abuse
- [ ] Continuity: rollback / degraded mode considered if AI or auth path changes
- [ ] Incident reporting path still valid (SECURITY.md)
- [ ] Privileged access: MFA / token rotation considered for new admin paths
- [ ] Process gaps explicitly listed (registration, runbooks, training)
```

---

## 7. Overlap cheat-sheet

| Topic | NIS2 | ISO 27001 | GDPR | EU AI Act |
|-------|------|-----------|------|-----------|
| Access control | Art. 21 | A.5.15 / A.8.x | Art. 32 | Cybersecurity of AI systems |
| Logging / detect | Incident handling | A.8.15–16 | Accountability / breach detect | High-risk logging; AI ops trace |
| Secure development | Art. 21 SDLC | A.8.25–29 | Art. 25 privacy by design | Robustness + Guardrails SDLC |
| Suppliers | Supply chain | A.5.19–23 | Art. 28 processors | GPAI provider + deployer duties |
| Incidents | Art. 23 reports | A.5.24–27 | Art. 33–34 (72h authority) | Serious AI incidents (if high-risk) |
| Human oversight | — | — | Art. 22 (automated decisions) | Oversight + Art. 50 transparency |
