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

These rules are mandatory for anyone working on this codebase (including AI agents).  
Architecture / NFR: [`docs/HLD.md`](docs/HLD.md). Living implementation: [`docs/MASTER_CONTEXT.md`](docs/MASTER_CONTEXT.md).

### Critical

1. **No medical / sensitive processing in the browser.** Do not parse, filter, classify, or “clean” clinical content in Alpine.js / frontend JS. That belongs in Supabase Edge Functions with Guardrails.
2. **RLS on every table.** New tables must ship with `ENABLE ROW LEVEL SECURITY` and explicit policies for `app_role`.
3. **Never expose `service_role` / secret keys** in static HTML/JS, Cloudflare Pages public assets, or git.
4. **Multi-tenant isolation.** Queries and policies must scope by `organization_id` (except intentional `superadmin` paths).
5. **Family data minimization.** Families must not receive `raw_data` from `daily_logs`, nor any row from `voice_conversations` / `voice_conversation_turns` / `voice_draft_notes`. Use `family_daily_reports` exposing only `daily_reports.content` when `status=published` after human approval.
6. **IoT least privilege.** Device identities (`iot_device`) may only `INSERT` sensor logs — no SELECT/UPDATE/DELETE on clinical tables.
7. **Audit.** Prefer triggers / `audit_logs` for UPDATE/DELETE on tenant data (ISO 27001 trail).
8. **Auth on Edge.** Every Edge Function must verify the Supabase JWT (or a dedicated, rotated device token for IoT) before side effects.
9. **Secrets.** Store OpenAI / webhook / cron secrets in Supabase Secrets or Cloudflare encrypted env — never in `.env` committed to git. Keep `.env` gitignored; use `.env.example` as the template.
10. **Separate from DFCMS.** Do not deploy this app to Cloudflare project `dfcms` / `dfopscms` or to DFCMS Supabase projects.
11. **Identifying PII → hash only.** Stable identifiers such as PESEL are stored as `SHA-256 + salt` (e.g. `pesel_hash`). Never persist plaintext PESEL in DB, UI, logs, or LLM prompts.
12. **Never hash clinical / note content.** Absolute ban on hashing (or irreversible digesting) medical narrative fields such as `raw_data` and `processed_data`. Care text must remain readable for authorized staff under RLS. Do not propose application-level column encryption (CLE) at this stage.
13. **Platform crypto baseline.** Rely on Supabase **encryption at rest** and **TLS in transit**, plus RLS and frontend minimization — not on hashing clinical payloads.
14. **No clinical jargon or dignity-violating detail in the family channel.** Diagnoses, drug names, and graphic/incontinence detail stay in staff-internal logs (`staff_internal_notes` / `raw_data`). Family text may only generalize to comfort / mood (ADR-010). Never hash those narratives (rule 12).

### Cryptography posture (ADR-005)

| Data | Rule |
|------|------|
| PESEL / similar identifiers | `SHA-256 + salt` only; never plaintext |
| `raw_data` / `processed_data` / care notes / `voice_draft_notes.transcript` | **No hashing**; protect via RLS + minimization + platform at-rest / in-transit |
| Application-level CLE | **Out of scope** for current phase |

### Compliance targets

- RODO / GDPR (data minimization, access control, auditability)
- ISO 27001 (access logging, least privilege)
- NIS2 (secure development & operations practices)
- EU AI Act (risk class, human oversight, transparency, Guardrails on Edge only)

Agent routing: [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md) · always-on `living-context` + `secure-by-design` · on-demand [`.cursor/rules/compliance-medtech.mdc`](.cursor/rules/compliance-medtech.mdc) + skill [`.agents/skills/compliance-medtech/`](.agents/skills/compliance-medtech/SKILL.md).

**Human-in-the-Loop:** uncertainty on architecture/compliance/RLS → stop with  
`🛑 COMPLIANCE / ARCH CHECK REQUIRED - Czekam na decyzję człowieka` — do not guess.

### Secrets hygiene checklist

- [ ] `.env` not in git (`git check-ignore -v .env`)
- [ ] Frontend only uses publishable / anon key
- [ ] `SUPABASE_ACCESS_TOKEN` and DB password never in client code
- [ ] After rotating tokens, revoke old ones in Supabase Dashboard
