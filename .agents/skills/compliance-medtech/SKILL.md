---
name: compliance-medtech
description: >-
  Compliance review for Pakiet Spokoju against GDPR/RODO, ISO 27001, NIS2, and
  EU AI Act — key obligations mapped to RLS, audit_logs, Edge Guardrails,
  human-in-the-loop, data minimization, secrets, incident readiness, and secure
  SDLC. Use when the user asks about RODO, GDPR, ISO 27001, NIS2, AI Act,
  high-risk AI, GPAI, compliance, DPIA, audit readiness, gap analysis, privacy
  by design, or when reviewing a change for regulatory fit.
---

# Compliance MedTech — GDPR / ISO 27001 / NIS2 / EU AI Act

**Not legal advice.** **Głębia SoT norm** (references). Bramka: [`.cursor/rules/compliance-medtech.mdc`](../../../.cursor/rules/compliance-medtech.mdc).  
Router + HITL: [`.cursor/rules/living-context.mdc`](../../../.cursor/rules/living-context.mdc) · Decision graph: [`docs/AGENT_WORKFLOW.md`](../../../docs/AGENT_WORKFLOW.md).

**Fail Secure:** przy niepewności RODO/ISO/NIS2/AI Act lub RLS/RBAC — nie koduj;  
`🛑 COMPLIANCE / ARCH CHECK REQUIRED - Czekam na decyzję człowieka`

## Always apply

1. [`SECURITY.md`](../../../SECURITY.md) + reguła `secure-by-design`  
2. [`MASTER_CONTEXT.md`](../../../docs/MASTER_CONTEXT.md) §2, §5–6; HLD §D–I przy DPA/degraded; HLD §B przy AI/Guardrails  
3. **Ładuj references tylko gdy potrzeba** (nie na każdy commit):
   - [GDPR / RODO](references/gdpr-rodo.md)
   - [ISO 27001](references/iso-27001.md)
   - [NIS2](references/nis2.md)
   - [EU AI Act](references/eu-ai-act.md)

| Need | Use |
|------|-----|
| Implementacja Auth/RLS/Edge | `secure-by-design` |
| Gap analysis / audyt | ten skill → odpowiednie reference |
| Tylko privacy / family | `gdpr-rodo.md` |
| Tylko logging / access | `iso-27001.md` |
| Tylko incident / supply chain | `nis2.md` |
| Tylko AI / Guardrails / Peace Letter / model vendor | `eu-ai-act.md` |

## Review workflow

```
- [ ] Scope (tables / Edge / UI / AI / deploy / vendors)
- [ ] GDPR — Art. 9, minimalizacja, prawa (gdpr-rodo.md)
- [ ] ISO 27001 — access, crypto, logging, SDLC (iso-27001.md)
- [ ] NIS2 — risk, incident, supply chain (nis2.md)
- [ ] EU AI Act — risk class, Art. 5 bans, oversight, Art. 50 (eu-ai-act.md)
- [ ] Gaps: code | process | vendor
- [ ] Update SECURITY / HLD / MASTER gdy decyzja się zmienia
```

### Output

```markdown
## Verdict
pass | pass-with-gaps | fail

## By framework
- GDPR: …
- ISO 27001: …
- NIS2: …
- EU AI Act: …

## Findings
| Severity | Framework | Finding | Fix |
|----------|-----------|---------|-----|
| critical / high / medium / low | … | … | code / process |

## Follow-ups outside code
(DPA, DPIA, retention, incident runbook, AI instructions for deployers, vendor …)
```

## Severity

| | Znaczenie |
|--|-----------|
| **critical** | Cross-tenant, secrets, brak auth na write, Art. 5 ban, bezprawne przetwarzanie |
| **high** | Family → `raw_data`, brak audit, AI bez human-in-the-loop na treść dla rodziny, ukrywanie AI |
| **medium** | Retention/incydent/vendor/AI docs niepełne; brak model version w logach |
| **low** | Docs / process polish bez natychmiastowego ryzyka danych |
