# EU AI Act — key obligations (Pakiet Spokoju)

Source framing: Regulation (EU) **2024/1689** (AI Act). Focus: **risk classification, deployer vs provider duties, transparency, human oversight, GPAI**, mapped to voice → Whisper → GPT Guardrails → Peace Letter.

**Not legal advice.** Classification of a live product needs legal/DPO sign-off. Agent must **flag** when a feature may change risk class (e.g. clinical decision support, autonomous alerts to emergency services, emotion inference).

Load for AI pipeline changes, Guardrails, new model vendors, automated family messages, or “AI Act / high-risk AI” questions.

---

## 1. Roles (critical for contracts)

| Role | Who typically | Duties (simplified) |
|------|---------------|---------------------|
| **Provider** | Places an AI system on the market / puts into service under own name | Conformity, documentation, CE (if high-risk), post-market monitoring |
| **Deployer** | Uses an AI system under its authority | Instructions for use, human oversight, logging, inform workers/affected persons where required |
| **Distributor / importer** | Supply chain | Check conformity marks / docs |

**Pakiet Spokoju reality check:**

| Component | Likely role |
|-----------|-------------|
| OpenAI Whisper / GPT (API) | **Provider** of GPAI / AI models; you are **deployer** (and possibly **provider** of a system that integrates them under your brand) |
| Edge Guardrails + product UX | If you put a branded “AI care reporting system” into service for care homes → often **provider of an AI system** that embeds third-party models |
| Care home staff | **Deployers** of your system in day-to-day use (contract should allocate duties) |

When unsure: treat Dragonfly as **provider of the integrated AI system** + **deployer of OpenAI models**, and keep contracts + technical controls accordingly.

---

## 2. Risk pyramid — where this product sits

```
Prohibited (Art. 5)     → must never ship
High-risk (Art. 6 + Annex III / medical device rules) → full Ch. III duties
Limited / transparency (Art. 50) → inform humans; mark synthetic content
Minimal risk            → voluntary codes; still apply Secure by Design
```

### 2.1 Current intended use (HLD baseline)

| Capability | Intended use | Working assumption* |
|------------|--------------|---------------------|
| Whisper transcription | Speech → text of nurse note | Not high-risk *if* only documentation aid |
| GPT Guardrails + summary | Empathetic **Peace Letter** / staff draft from note | Limited-risk transparency + strong GDPR; **not** autonomous medical diagnosis |
| Human-in-the-loop | Staff reviews / sends family message | Required design control — do not remove |
| IoT sensors → logs | Telemetry into logs | Reclassify if used for clinical monitoring / alerting without human |

\*Assumption holds only while AI **does not**: diagnose, triage urgency as sole decision, prescribe, deny care, score residents socially, or trigger emergency response without a qualified human.

### 2.2 Feature changes that **raise** risk class (stop & escalate)

Treat as **potential high-risk or prohibited** until legal review:

- AI that **autonomously** classifies clinical urgency / calls ambulance / changes care plan
- Emotion recognition of residents or staff for evaluation
- Biometric categorisation / real-time remote biometric ID beyond documented necessity
- Social scoring of residents or families
- AI used as **safety component of a medical device** or for diagnosis/treatment decisions
- Fully automated Peace Letters to families **without** staff review (especially if clinical content could leak)

**Agent rule:** refuse to implement “auto-send clinical AI output to family” or “AI decides care priority alone” without explicit product+legal decision recorded in HLD / MASTER_CONTEXT.

---

## 3. Prohibited practices (Art. 5) — never implement

| Ban (simplified) | Product implication |
|------------------|---------------------|
| Subliminal / manipulative AI causing harm | No dark-pattern “nudge” families with deceptive AI |
| Social scoring by public authorities (and related misuse) | No resident “risk score” league tables for social worth |
| Untargeted scraping of facial images for DBs | No face DB from cameras without lawful high-bar basis |
| Emotion recognition in workplace / education (with exceptions) | Do not infer nurse/resident emotions for HR or evaluation |
| Biometric categorisation of sensitive attributes | Do not infer race/religion/health from biometrics for profiling |
| Real-time remote biometric ID in public spaces (narrow exceptions) | Out of scope — do not add |

---

## 4. High-risk AI (Art. 6, Annex III) — if classified

If legal classifies the system (or a module) as high-risk, Ch. III applies. Engineering must support:

| Duty area | Expectation | Repo / product map |
|-----------|-------------|-------------------|
| **Risk management** | Continuous risk process | HLD risk table; update on each AI feature |
| **Data governance** | Training/validation data quality (if you train/fine-tune) | Prefer API inference only; if fine-tuning — dataset docs + bias checks |
| **Technical docs** | System description, capabilities, limits | HLD §B Guardrails flow + model cards / internal AI sheet |
| **Logging / record-keeping** | Traceability of operation | `audit_logs` + Edge request IDs; store model/version used for each `daily_logs` AI write |
| **Transparency to deployers** | Instructions for use | Admin/care-home docs: what AI does / does not do |
| **Human oversight** | Effective oversight measures | Staff must confirm before family sees AI text; UI must not hide “AI-assisted” |
| **Accuracy, robustness, cybersecurity** | Fit for purpose; secure | Guardrails tests (≥100 cases in HLD); Edge-only processing; RLS |
| **Quality management** | QMS for high-risk providers | Process — flag if claiming CE/high-risk without QMS |
| **Conformity assessment / CE** | Before placing on market | Legal/process — out of agent scope except “don’t ship high-risk features casually” |
| **Post-market monitoring / incidents** | Serious incident reporting | Align with SECURITY.md + NIS2 incident path |

---

## 5. Transparency — limited risk (Art. 50)

Applies broadly even when **not** high-risk:

| Obligation | Pakiet Spokoju |
|------------|----------------|
| People know they interact with AI (unless obvious) | Staff UI: copy that summary is AI-assisted; family-facing: honest wording (no fake “handwritten by nurse” deception) |
| Synthetic audio/text/image marked where required | Peace Letters / AI text: retain provenance (`ai_report` / metadata); do not strip “machine-generated” markers if law requires |
| Deepfake-style content | N/A unless you add generative media of persons |

**Forbidden UX:** presenting AI clinical-sounding content as unverified human medical advice.

---

## 6. GPAI / foundation models (OpenAI etc.)

When using general-purpose AI (Whisper/GPT class):

| Topic | Deployer (you) | Provider (model vendor) |
|-------|----------------|-------------------------|
| Copyright / training transparency | Prefer vendors with EU-compliant terms | Their GPAI obligations |
| Systemic-risk GPAI | Follow vendor instructions & rate limits | Extra duties if designated |
| Your integration | System prompt Guardrails, logging, no training on customer data without basis | Zero-Data Retention / Enterprise DPA when required (HLD) |

**Engineering:**

- [ ] API keys only in Edge secrets
- [ ] Minimize health data in prompts; never send full tenant DB
- [ ] Pin / record **model name + version** used per generation
- [ ] Do not use customer `raw_data` to train your own models without legal basis + DPIA + AI Act reassessment

---

## 7. Human oversight — non-negotiable design

Aligned with HLD §B.2:

```
Nurse voice → Edge Whisper → Edge GPT + Guardrails → voice_draft_notes
    → evening merge → daily_reports (ready) → human staff review → published family channel
```

| Do | Don’t |
|----|-------|
| Staff can edit or reject AI draft | Auto-publish AI text to family by default |
| Show that content was AI-assisted | Hide AI involvement to “look more human” |
| Keep `raw_data` off family clients | Let browser run Guardrails |
| Log who approved send (when messaging exists) | Silent overwrite of nurse text without audit |

---

## 8. Overlap with GDPR / NIS2 / ISO

| Topic | AI Act | Also |
|-------|--------|------|
| Health data in prompts | Data governance + cybersecurity | GDPR Art. 9 / 32 |
| Logging of AI ops | High-risk logging; good practice always | ISO A.8.15; NIS2 detect |
| Incident (harmful AI output / leak) | Serious incident (if high-risk) | GDPR breach; NIS2 |
| Vendor OpenAI | GPAI + supply chain | GDPR Art. 28; NIS2 supply chain |
| Privacy by design | Complements | GDPR Art. 25; Secure by Design |

---

## 9. Repo map — AI Act → artefacts

| Obligation | Artefact |
|------------|----------|
| No clinical AI in browser | Edge-only Guardrails; Next.js `/web` = UI (legacy Alpine not extended) |
| Human oversight | Staff review before `daily_reports.published` / send |
| Transparency | UI copy; `log_type` `ai_report`; metadata model/version (implement when Edge lands) |
| Traceability | `audit_logs`; Edge logs without secret leakage |
| Robustness / misuse | Guardrails regression set (HLD); prompt-injection tests |
| Cybersecurity of AI pipeline | JWT on Edge; secrets hygiene; tenant RLS |
| Risk reclassification gate | HLD + MASTER_CONTEXT update before shipping new AI behaviours |
| Degraded mode | Queue notes when OpenAI down (HLD §E) — continuity ≠ unsupervised AI |

---

## 10. EU AI Act review checklist (copy)

```
EU AI Act:
- [ ] Intended use still documentation / Peace Letter aid — not diagnosis/triage/autonomy
- [ ] No Art. 5 prohibited pattern introduced
- [ ] Risk class reconsidered if feature changes (escalate if unsure)
- [ ] Human-in-the-loop preserved for family-facing AI text
- [ ] Users can tell content is AI-assisted (Art. 50)
- [ ] Guardrails + processing only on Edge; no FE medical AI
- [ ] Model/vendor documented; DPA / ZDR as per HLD
- [ ] Prompt minimization; no illicit training on customer data
- [ ] Logging: who/what/when for AI writes; model id recorded or ticketed
- [ ] Serious-incident / rollback path known (SECURITY + degraded mode)
- [ ] Process gaps listed: instructions for care homes, QMS/CE only if high-risk
```
