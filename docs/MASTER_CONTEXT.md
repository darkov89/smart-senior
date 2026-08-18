# Pakiet Spokoju (SeniorSmart) — MASTER CONTEXT

> **Źródło prawdy technicznego stanu aplikacji** (co jest zbudowane, jak deployować, schema/RLS).  
> **Decyzje HLD / NFR / roadmapa:** [`HLD.md`](HLD.md) — nie duplikuj tu ekonomiki ani pełnego HLD.  
> Security policy: [`SECURITY.md`](../SECURITY.md). Strażnik: reguła `architectural-guardian`.

**Ostatnia aktualizacja treści:** 2026-08-18 — Worker `smart-senior-web` usunięty z konta DFCMS; Pages `smart-senior` osobno

---

## 1. Wizja i KPI

Platforma **B2B SaaS dla domów opieki**:

- optymalizacja raportowania personelu (notatki głosowe zamiast pisania),
- proaktywna komunikacja z rodzinami pensjonariuszy („święty spokój” = mniej telefonów).

**KPI:** zaoszczędzony czas personelu; spadek zapytań telefonicznych od rodzin.

### Słownik Produktowy (MDR Guardrails)

System **nie jest wyrobem medycznym**. Polski UX, SMS i prompty LLM nigdy nie mogą brzmieć jak karta choroby. Tabele i zmienne angielskie (`patients`, `patient_id`) **zostają**.

| Zakaz w UI / SMS / Peace Letter / System Prompt | Dozwolone |
|-------------------------------------------------|-----------|
| pacjent, chory | Senior, Mieszkaniec, Pensjonariusz, Podopieczny, Bliski |
| diagnoza, leczenie, parametry życiowe | samopoczucie, wskaźniki komfortu, aktywność, regeneracja |

SoT promptów: [`.cursor/rules/ai-prompt-guardrails.mdc`](../.cursor/rules/ai-prompt-guardrails.mdc) §3.1. Copy UI: `product-ui-craft.mdc`.

---

## 2. Architektura „Secure by Design”

Projekt celuje w zgodność z **RODO**, **ISO 27001**, **NIS2**, **EU AI Act**.  
HLD (NFR, flow Guardrails, degraded mode, DPA, roadmapa): [`HLD.md`](HLD.md).  
Checklisty norma → kod: skill [`compliance-medtech`](../.agents/skills/compliance-medtech/SKILL.md); codziennie [`secure-by-design`](../.agents/skills/secure-by-design/SKILL.md); SDD: [`architectural-guardian`](../.agents/skills/architectural-guardian/SKILL.md).  
**Routing agenta:** [`AGENT_WORKFLOW.md`](AGENT_WORKFLOW.md) + reguła always-on `living-context` (Konstytucja → Skill Lenses → HITL).

### Zasada krytyczna

**Żadne wrażliwe dane medyczne nie mogą być przetwarzane, parsowane ani filtrowane po stronie frontendu (przeglądarki).**  
Cała logika biznesowa, autoryzacja oraz czyszczenie danych (Guardrails) odbywa się w **Supabase Edge Functions** (i ewentualnie innych środowiskach backendowych), nie w Alpine.js / HTML.

Frontend: UI, stany, wywołania API z tokenem użytkownika. Kanon = Next.js (`/web`); legacy Alpine nie rozszerzać.  
Backend: Whisper / GPT, kategoryzacja, empatyczne podsumowania, walidacja JWT, zapis do DB.

---

## 3. Stos technologiczny

| Warstwa | Technologia | Artefakty |
|--------|-------------|-----------|
| **Frontend** | Next.js App Router + Tailwind + TS (`/web`, ADR-008) | `web/src/app/**` |
| **Hosting frontu** | Cloudflare OpenNext — Worker **`smart-senior-web`**. Legacy Pages `smart-senior`. **Zakaz Vercel.** | izolacja od DFCMS |
| **Backend / DB** | Supabase (PostgreSQL, Auth, RLS) | `supabase/migrations/`, projekt **SeniorSmart** |
| **Logika serwerowa** | Supabase Edge Functions (Deno) | `supabase/functions/` *(planowane)* |
| **AI** | OpenAI — Whisper (transkrypcja), GPT-4o (kategoryzacja + podsumowania + System Prompt / Guardrails) | tylko Edge / backend |

### Struktura frontendu

```
web/src/app/               → Next.js App Router (Faza 2)
  (family)/rodzina/        → portal rodziny (mobile-first)
  (staff)/placowka/        → portal personelu (podgląd + uprawnienia)
index.html                 → LEGACY Alpine — nie rozszerzaj
src/js/                    → LEGACY — do cutoveru
```

Konfiguracja Next: `web/.env.local` (`NEXT_PUBLIC_SUPABASE_*` only). Legacy: `src/js/config.js`.

**Nie mylić z DFCMS:** ten repozytorium i Pages project są niezależne od `dfopscms` / `dfcms.pl`.

---

## 4. Środowiska

| Obszar | Stan obecny (MVP) |
|--------|-------------------|
| **Git** | `https://github.com/darkov89/smart-senior` — gałąź `main` |
| **Cloudflare Pages (legacy)** | projekt **`smart-senior`** → `https://smart-senior.pages.dev` (osobny od **`dfcms`**). Git z korzenia repo **nie** jest deployem Next — wgrywa `node_modules`/`workerd`. |
| **Cloudflare Next.js** | Worker **`smart-senior-web` usunięty** z konta DFCMS (nie mieszamy z `dfcms.pl`). Deploy OpenNext: `cd web && npm run deploy` na koncie Pakietu Spokoju, **bez** `account_id` DFCMS w `web/wrangler.jsonc`. Cutover DNS jeszcze nie. |
| **Supabase `project-ref`** | **`bmughdoqdsjfstxnnjks`** (nazwa: SeniorSmart, region: North EU / Stockholm) |
| **Org Supabase** | osobna od dfops (`fhjokrekpzahqcskjmul`) |
| **Lokalny front** | `npm run web:dev` (`web/`); legacy: `npm run deploy:legacy` |
| **Lokalny Supabase** | **bez** wymogu `supabase start` na start — link do remote + `supabase db push` |

Przed `db push` / `functions deploy` zawsze sprawdź:

```bash
cat supabase/.temp/project-ref
# oczekiwane: bmughdoqdsjfstxnnjks
```

Sekrety lokalne: `.env` (gitignored). Szablon: `.env.example`.

---

## 5. Multi-tenancy i model danych

Każdy dom opieki = wiersz w `organizations` (`organization_id` na rekordach tenantowych).  
Słowny opis „co jak działa i po co”: [`.agents/skills/supabase-seniorsmart/references/schema-seniorsmart.md`](../.agents/skills/supabase-seniorsmart/references/schema-seniorsmart.md).

### Enum `app_role`

`superadmin` | `org_admin` | `nurse` | `family` | `iot_device`

### Enum `log_type` (`typ_logu`)

`voice_note` | `hardware_sensor` | `ai_report`

### Enum `voice_missing_context`

`mood` | `meal` | `sleep` | `activity` — tablica na `voice_conversations.missing_contexts`

### Tabele kluczowe

| Tabela | Rola |
|--------|------|
| `organizations` | Domy opieki (`name`, `settings_json`) |
| `profiles` | Rozszerzenie `auth.users` — `organization_id`, `role`, `full_name`, `phone` (SMS) |
| `patients` | Pensjonariusze — minimalizacja (`first_name`, `last_name_initial`, `pesel_hash`, `room`); opcjonalnie `archived_at` / `archived_reason` |
| `daily_logs` | Notatki / sensory / raporty AI — `raw_data`, `processed_data` (tor personelu; **nie** kanał rodziny) |
| `daily_reports` | Raport dzienny / Peace Letter; family SELECT tylko `status=published` |
| `notification_preferences` | Opt-in SMS/e-mail rodziny per pensjonariusz |
| `notification_deliveries` | Wysyłki; zapis `service_role`; personel SELECT |
| `voice_conversations` | Stan rozmowy (jeden otwarty wątek / pacjent / `local_date`); `missing_contexts voice_missing_context[]` |
| `voice_conversation_turns` | Tury: transkrypcja personelu lub pytanie asystenta |
| `voice_draft_notes` | Surowe głosówki przed wieczornym merge — `transcript`, `staff_internal_notes`, `family_safe_partial`; cleanup 30 dni po merge/discard |
| `telemetry_logs` | Legacy agregaty BLE; family bez SELECT |
| `consent_ledger` | Zgody RODO; purpose `wearable_family_access` (ADR-009) |
| `polar_connections` | Link Polar user — bez tokenów OAuth; `connection_status`, `last_sync_at` |
| `polar_daily_activity` / `polar_sleep_nights` / `polar_heart_rate_daily` / `polar_hrv_nights` | Agregaty dobowe Polar 360 (non-MD) |
| `polar_sync_runs` | Przebiegi sync Polar; zapis tylko backend; family bez SELECT |
| `polar_oauth_secrets` | Tokeny AccessLink — GRANT tylko `postgres` / `service_role` |
| `family_connections` | Powiązanie profilu rodziny ↔ pacjent |
| `patient_staff_assignments` | Przypisanie personelu ↔ pensjonariusz; **nie zawęża jeszcze RLS nurse** |
| `audit_logs` | Audyt ISO — kto, kiedy, IP, UPDATE/DELETE; append-only |
| `security_access_logs` | Dziennik dostępu; append-only; INSERT przez `log_security_access()` |

Migracja bazowa: `supabase/migrations/20260717193117_init_multi_tenant_schema.sql`.  
Telemetria: `20260811185009_add_telemetry_logs.sql`.  
AI Act columns: `20260812080000_add_ai_compliance.sql`.  
Bramki IoT (historyczna): `20260812081000_iot_gateways.sql` — **DROP** `20260813132832_drop_iot_gateways.sql` (ADR-007).  
Polar + zgody: `20260813134500_polar_wearable_consent.sql` (ADR-009).  
Głos (ADR-010): `20260813135918_voice_conversation_drafts.sql`.  
Enum + retencja: `20260813145248_voice_enum_and_retention.sql` — `cleanup_old_voice_drafts()` tylko `service_role`.  
Enterprise hardening: `20260814103804_enterprise_hardening.sql` + `20260814104307_enterprise_hardening_followup.sql` — raport: [`ENTERPRISE_HARDENING_REPORT.md`](ENTERPRISE_HARDENING_REPORT.md).  
Product workflow: `20260814112552_product_workflow_and_notifications.sql` — `db push` OK.

### Widok rodzinny

`family_daily_reports` — `daily_reports.content` przy `status=published` (security_invoker); bez `daily_logs`.  
`family_wearable_comfort` — kroki / sen / sleep_score + `last_successful_sync_at`; **bez** BPM i HRV (`security_invoker`).  
**Family nie ma SELECT na `telemetry_logs`.** Metryki Polar: tylko z przypisaniem **i** aktywną zgodą `wearable_family_access`.

### Retencja (live)

- `patients.archived_at` / `archived_reason` — miękka archiwizacja (`deceased` \| `left_facility` \| `gdpr_request`). Rodzina: brak SELECT (helper `family_can_access_patient` + widoki). Personel: SELECT historii OK; INSERT/UPDATE opieki tylko gdy `patient_is_active`. Twarde usunięcie = `DELETE patients` (CASCADE; `audit_logs.old_data` na DELETE opieki = `[REDACTED DUE TO GDPR]`).
- `cleanup_old_voice_drafts()` — surowe `voice_*` merged/discarded (rozmowy: merged/abandoned) starsze niż 30 dni. `pg_cron` job `cleanup-old-voice-drafts` o 03:00 Europe/Warsaw; `GRANT EXECUTE` dla `postgres` + `service_role`. Peace Letter (`daily_logs`) bez zmian.
- Pozostałe okresy retencji (Polar, `daily_logs`, consent, audit, access logs, otwarte transkrypty) — **REQUIRES_POLICY_DECISION**.

---

## 6. RBAC i RLS

**Każda tabela ma `ENABLE ROW LEVEL SECURITY`.**

| Rola | Dostęp |
|------|--------|
| `superadmin` | Pełny dostęp systemowy |
| `org_admin` / `nurse` | R/W wyłącznie w swoim `organization_id` |
| `family` | `family_daily_reports` (published); Polar tylko z zgodą (`family_wearable_comfort`); preferencje powiadomień własne; nigdy `raw_data`, nigdy tabele `voice_*`, nigdy `notification_deliveries` |
| `iot_device` | Tylko **INSERT** do `daily_logs` (`typ_logu = hardware_sensor`) w swojej org |

**`telemetry_logs`:** SELECT dla `org_admin` / `nurse` + `superadmin`; family — brak SELECT.

**Polar metryki (ADR-009):**  
- family: SELECT + assignment + `family_has_wearable_consent` + tenant  
- `org_admin` / `nurse`: SELECT w swojej org (Big Picture) — bez zgody ledger  
- zapisy: Edge `service_role`  
- superadmin ALL

**`polar_connections`:** superadmin + `org_admin` (swoja org). Family — brak. Tokeny OAuth nie w tej tabeli.

**`consent_ledger`:** superadmin ALL; `org_admin` R/W swojej org; family SELECT własnych wierszy (bez INSERT).

**`voice_conversations` / `voice_conversation_turns` / `voice_draft_notes` (ADR-010):** superadmin ALL; `org_admin` / `nurse` R/W w swojej org; **family — brak SELECT**. Transkryptów nie haszować (ADR-005). Peace Letter = `daily_reports` po merge + HITL + `published`.

**Zero-Guessing Entity Resolution (HLD 2.4.5):** nagrywanie wyłącznie z karty konkretnego seniora. POST do Edge `voice-assistant` **musi** zawierać `patient_id`. LLM dostaje sam transkrypt (bez imienia / UUID). Zapis `voice_*` wiąże wiersz z `patient_id` z żądania — nigdy z zgadywania „dla Jana”.

**Integralność tenanta (2026-08-14):** UNIQUE `(id, organization_id)` na `patients` / `profiles` / `polar_connections` / `voice_conversations`; composite FK `(patient_id, organization_id)` na tabelach opieki, Polar, głos, telemetry, consent, family, assignments. Istniejące pojedyncze FK zachowane.

**`patient_staff_assignments`:** org_admin R/W (aktywny pensjonariusz, org z JWT); nurse SELECT swojej org. **Nie podłączać jeszcze do RLS `patients`/`daily_logs`** — obecny model personelu jest org-wide.

**`polar_sync_runs` / `security_access_logs`:** authenticated bez INSERT/UPDATE/DELETE. org_admin SELECT swojej org; superadmin SELECT; family DENY. `log_security_access()` ustawia `actor_id` z `auth.uid()`.

**Polar HR/HRV:** family **brak** SELECT na `polar_heart_rate_daily` / `polar_hrv_nights`. Kanał rodzinny = `family_wearable_comfort` (kroki/sen) + zgoda.

**`polar_oauth_secrets`:** brak GRANT dla `anon`/`authenticated`.

**`daily_reports`:** superadmin ALL; `org_admin` / `nurse` R/W w swojej org (zapis tylko gdy `patient_is_active`); family SELECT wyłącznie `status=published` + `family_can_access_patient`. Widok `family_daily_reports` = ten sam filtr (`security_invoker`).

**Powiadomienia:** `notification_preferences` — family CRUD własne (`profile_id = auth.uid()`); personel SELECT org. `notification_deliveries` — authenticated tylko SELECT (staff/superadmin); INSERT/UPDATE przez `service_role`. UNIQUE `(profile_id, daily_report_id, channel)`.

**Autoryzacja RLS (ADR-006):** w 100% z **Custom JWT Claims** (`app_metadata.role`, `app_metadata.organization_id`) wstrzykiwanych przez Auth Hook `custom_access_token_hook`. Polityki porównują `(auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid` z kolumną tenanta — bez lookupu `profiles` na wiersz.

Helpery SECURITY DEFINER **pozostawione:** `family_can_access_patient(uuid)`, `family_has_wearable_consent(uuid)`. Trigger audytu: `audit_row_change()`.

**Onboarding B2B:** Edge `onboard-organization` (tylko `superadmin`) — INSERT `organizations` + `auth.admin.inviteUserByEmail` + profil `org_admin`.

**Auth Hook:** aktywować w Dashboard (Authentication → Hooks → Custom Access Token). Po zmianie roli/org — refresh sesji.

### Zasady kodowania (Cursor / agenci)

1. Nowa tabela SQL → zawsze RLS + polityki.
2. Edge Functions (TS) → zawsze weryfikacja JWT Supabase Auth przed akcją (wyjątek Faza 4: webhook Polar z weryfikacją podpisu producenta — nie Bearer bramki).
3. Zapytania tenantowe → RLS z JWT `app_metadata.organization_id` (poza świadomym Service Role).
4. Frontend → Next.js w `/web`; zero logiki medycznej / Guardrails w przeglądarce. Legacy Alpine nie rozszerzaj.
5. **Service role / secret keys** nigdy w statycznym froncie ani w Pages (public).
6. **Czystość i skalowalność (obowiązkowe):** kod w najczystszej, skalowalnej formie — jedna odpowiedzialność, jawne nazwy, małe moduły, brak pomijanych błędów, konfiguracja poza logiką. Szczegóły: reguła Cursor `.cursor/rules/clean-scalable-code.mdc` + skill `.agents/skills/clean-scalable-code`.
7. **Zero-Guessing:** Edge głosowy odrzuca request bez `patient_id`. Zakaz inferencji tożsamości pensjonariusza z tekstu STT/LLM.

---

## 7. AI (planowane + kontrakt Fazy 5)

| Model | Użycie | Gdzie |
|-------|--------|-------|
| Whisper | Transkrypcja głosowa | Edge Function (jeszcze nie prod) |
| GPT-4o | Asystent konwersacyjny + Guardrails (klinika/godność) + wieczorny merge | Edge Function (jeszcze nie prod) |

**Przepływ (ADR-010 / Zero-Guessing):** karta seniora → POST `patient_id` + audio → Edge `voice-assistant` (RAM) → Whisper/GPT dostaje **tylko** transkrypt → JSON → `INSERT voice_*` z tym samym `patient_id` → CRON `merge-daily-peace-letters` → `daily_reports` → HITL `published`.  
Rodziny widzą wyłącznie opublikowany Peace Letter. Drafty / transkrypty — tylko personel.

**EU AI Act (schema):** `daily_reports.ai_model` + `approved_by` / `approved_at` przed `published`. Kolumny HITL na `daily_logs` zostają dla surowego toru personelu.  
**TDD Guardrails:** `supabase/functions/tests/guardrails.test.ts` — zaślepka heurystyczna (follow-up, żargon, godność, injection); produkcyjny LLM Edge nadal do podłączenia.  
**System Prompt:** `.cursor/rules/ai-prompt-guardrails.mdc` §7.

**Telemetria → Peace Letter:** skill `.agents/skills/telemetry-context-provider/` — `polar_*` (preferowane) / `telemetry_logs` (legacy); **non-MD**.

---

## 7a. Telemetria (ADR-007 — Polar; BLE ingest wycofany)

| Element | Opis |
|---------|------|
| Kierunek | Polar AccessLink cloud-to-cloud |
| OAuth | Edge `polar-oauth` (`verify_jwt=false`; start = JWT staff; callback = signed state) |
| Webhook | Edge `polar-webhook` — HMAC `Polar-Webhook-Signature`; UPSERT `polar_*` przez `service_role` |
| Tokeny | `polar_oauth_secrets` — brak GRANT dla authenticated |
| Wycofane | tabela `iot_gateways`, Edge `ingest-telemetry`, Bearer bramki |
| Magazyn | `polar_*` (kanon) + `telemetry_logs` (legacy) |
| Client SELECT Polar | family + zgoda + assignment; personel (`org_admin` / `nurse`) SELECT w swojej org (Big Picture); family **bez** HR/HRV tabel |
| Personel / PostgREST | SELECT metryk Polar w swojej org; family DTO = `family_wearable_comfort` |
| Cel | Wzbogacenie notatek głosowych — nie zastąpienie |
| Non-MD / MDR | Komfort i samopoczucie; Peace Letter bez surowych BPM |

---

## 8. Deploy

| Co | Jak |
|----|-----|
| **Front Next.js** | `cd web && npm run deploy` (OpenNext Worker `smart-senior-web`) — **nie** na koncie DFCMS, **nie** Git build z korzenia repo. Publiczne `NEXT_PUBLIC_SUPABASE_*` w Variables + `web/.env.production` przed buildem. **Nie Vercel.** |
| **Front legacy** | `npm run deploy:legacy` → Pages `smart-senior` (**nie** `dfcms`) |
| **DB** | `npx supabase db push` (po sprawdzeniu `project-ref`) |
| **Edge Functions** | `npx supabase functions deploy <name>` — m.in. `onboard-organization`, `polar-oauth`, `polar-webhook` |
| **Git** | `git push origin main` **nie** deployuje Supabase. Podpięty Cloudflare Git z root `repo/` wgrywa `workerd` (144 MiB) — Root directory musi być `web/`. |

---

## 9. Diagram (skrót)

```
Pielęgniarka / Rodzina / Polar AccessLink (Faza 4)
    → Front: Next.js `/web` na Cloudflare OpenNext (legacy Pages Alpine do cutoveru)
    → Supabase Auth (JWT)
    → PostgREST + RLS (tenant)
    → Edge Functions (AI Guardrails, Whisper, GPT, Polar) — wrażliwe dane
    → PostgreSQL (organizations … voice_* … polar_* … audit_logs)
```

---

## 10. Dziennik transformacji

| Data | Zmiana |
|------|--------|
| 2026-08-13 | Słowny opis schematu (co / jak / po co) w `schema-seniorsmart.md`; pointer w §5 |
| 2026-07-19 | Odchudzenie skilli → pointer + substancja (bez straty checklist/ops/copy map); compliance refs bez zmian |
| 2026-07-19 | Roster person (Architekt/Security/Compliance/Dev/UI/Platforma) w regule `living-context` |
| 2026-07-19 | HLD v2.1.0 (`docs/HLD.md`); Strażnik Architektury (reguła + skill); triada HLD / MASTER_CONTEXT / SECURITY; challenge: region Stockholm (nie Frankfurt), `consent_ledger` planowane |
| 2026-07-17 | Init repo, migracja multi-tenant + RLS + audit, Pages `smart-senior`, GitHub `darkov89/smart-senior`, docs/skills/security jak w DFCMS |
| 2026-07-17 | Reguła always-on `clean-scalable-code` + skill — obowiązkowe najlepsze praktyki czystości i skalowalności |
| 2026-07-17 | Fundament frontu: `src/js/{services,stores,utils}`, `authStore` (login/logout/onAuthStateChange + profil), shell `index.html` z formularzem logowania |
| 2026-07-17 | Reguła always-on `product-ui-craft` + skill — premium UI/UX, zero żargonu/placeholderów w UI, obowiązek proponowania lepszej wersji promptu |
| 2026-07-19 | Skill `compliance-medtech` — kluczowe obowiązki GDPR/RODO, ISO 27001 Annex A, NIS2 Art. 21/23 z mapą na RLS/audit/Edge/deploy |
| 2026-07-31 | `compliance-medtech`: reference EU AI Act (risk class, Art. 5, oversight, Art. 50, GPAI) z mapą na Guardrails / human-in-the-loop |
| 2026-07-31 | Agent Workflow: Single Developer + Skill Lenses — `living-context` router, HITL Fail Secure, on-demand rules (compliance, AI guardrails, supabase, cloudflare), `docs/AGENT_WORKFLOW.md` |
| 2026-07-31 | Dedup: always-on + AI skille = pointery; SoT w `.mdc`; compliance/supabase/cf skills = głębia; `AGENT_WORKFLOW` mermaid decision graph |
| 2026-08-10 | Izolacja FE/BE: `frontend-js.mdc` (Vanilla ESM+JSDoc), `backend-ts.mdc` (strict Deno TS); Red Team `guardrails-tester.mdc` + szkielet `supabase/functions/tests/guardrails.test.ts`; pointer w `clean-scalable-code`; roster w `AGENT_WORKFLOW` |
| 2026-08-11 | Telemetria BLE (HLD 2.2.0): migracja `telemetry_logs`, Edge `ingest-telemetry`, skill `telemetry-context-provider` (non-MD Guardrails); family bez SELECT HR |
| 2026-08-11 | Deploy: Edge `ingest-telemetry` ACTIVE na `bmughdoqdsjfstxnnjks` (`verify_jwt=false`, secret `TELEMETRY_INGEST_TOKEN`); migracja DB **zablokowana** — hasło Postgres w `.env` / Management API 28P01 (wymaga resetu DB password w Dashboard) |
| 2026-08-11 | Second Brain: `docs/adr/` + template, reguła `second-brain-librarian.mdc`, Write-Back w `living-context`, `docs/LESSONS_LEARNED.md`; roster w `AGENT_WORKFLOW` |
| 2026-08-12 | Domknięcie luk: `daily_logs.is_ai_generated` + `approved_by_user_id`; tabela `iot_gateways` + ingest per-token (ADR-002); Guardrails TDD Green (zaślepka); usunięto globalny `TELEMETRY_INGEST_TOKEN` |
| 2026-08-12 | `db push` OK na `bmughdoqdsjfstxnnjks`: `telemetry_logs`, AI Act columns, `iot_gateways` |
| 2026-08-12 | Redeploy `ingest-telemetry` v3 (auth via `iot_gateways`); unset `TELEMETRY_INGEST_TOKEN` z secrets + lokalnego `.env` |
| 2026-08-12 | `AGENT_WORKFLOW` v2026-08-12: pełny graf (Write-Back, FE/BE, Tester, LESSONS); audit plików — usunięty alias `telemetry-context-provider.md`; glob Tester + `tests/` |
| 2026-08-12 | Second Brain 2.0 (ADR-003): Memory Lifecycle, checklist Write-Back, selective retrieval, Contradiction Protocol; Librarian 2.0; living-context + AGENT_WORKFLOW |
| 2026-08-12 | Requirement Traceability (ADR-004): `docs/REQUIREMENTS_TRACEABILITY.md` seeded from HLD; Librarian klasa F; REQ retrieval + verification gate w AGENT_WORKFLOW |
| 2026-08-12 | `docs/AGENT_WORKFLOW_README.md` — przewodnik dla laika (jak działa model agentów / Second Brain) |
| 2026-08-13 | ADR-005: PESEL/ID → SHA-256+salt; zakaz hashowania `raw_data`/`processed_data`; brak CLE; at-rest/in-transit Supabase + RLS (`SECURITY.md`, `secure-by-design`) |
| 2026-08-13 | ADR-006: RLS z Custom JWT Claims (`custom_access_token_hook`); drop SECURITY DEFINER helperów RLS; Edge `onboard-organization`; **wymaga włączenia hooka w Dashboard** |
| 2026-08-13 | Deploy: `db push` `20260813101000_jwt_claims_hook`; Edge `onboard-organization` v1 ACTIVE. **Hook Auth jeszcze do włączenia ręcznie w Dashboard** |
| 2026-08-13 | Faza 1: ADR-007 Polar; DROP `iot_gateways`; undeploy `ingest-telemetry`; HLD 2.3.0 |
| 2026-08-13 | Faza 2: Next.js App Router w `/web` (portale `/rodzina`, `/placowka`); hosting Cloudflare OpenNext (`smart-senior-web`); zakaz Vercel; HLD 2.3.1 |
| 2026-08-13 | Faza 3: `db push` `20260813134500_polar_wearable_consent`; ADR-009; HLD 2.3.2 |
| 2026-08-13 | Faza 3 zamknięta: staff SELECT Polar (opcja A) `20260813135255_polar_staff_access`. Faza 4 szkielet: `polar-oauth`, `polar-webhook`, `polar_oauth_secrets`. |
| 2026-08-13 | Faza 5: ADR-010 Conversational Voice; `db push` `20260813135918_voice_conversation_drafts`; HLD 2.4.0; Guardrails stub 6/6. Whisper/GPT Edge i CRON `merge-daily-peace-letters` — jeszcze nie prod. |
| 2026-08-13 | Retencja RODO: enum `voice_missing_context`; `patients.archived_*` + RLS `patient_is_active`; audit DELETE zredagowany; `cleanup_old_voice_drafts()` + pg_cron 03:00 Warsaw; HLD 2.4.1. `db push` `20260813145248` OK. |
| 2026-08-14 | Enterprise hardening: composite FKs tenant; `patient_staff_assignments`; `polar_sync_runs`; `security_access_logs`; OAuth GRANT lockdown; family DENY HR/HRV tables; AI provenance CHECKs. `db push` `20260814103804` + `20260814104307` OK. Raport: `docs/ENTERPRISE_HARDENING_REPORT.md`. |
| 2026-08-14 | Product workflow: `db push` `20260814112552_product_workflow_and_notifications.sql` OK. `daily_reports` + powiadomienia + `profiles.phone`; HLD 2.4.3. Bez czatu/devices. |
| 2026-08-18 | Słownik produktowy MDR: zakaz „pacjent”/„chory” w UX, SMS i System Prompt; `patients` w kodzie bez zmian. HLD 2.4.4. |
| 2026-08-18 | Zero-Guessing Entity Resolution: `patient_id` z karty seniora w POST; LLM bez tożsamości. HLD 2.4.5. |
| 2026-08-18 | Deploy OpenNext Worker `smart-senior-web` (v `c59184d5-a3f2-4870-ab05-c7c9ff98dafd`) → `https://smart-senior-web.dfcms.workers.dev`. Wrangler OAuth. `NEXT_PUBLIC_SUPABASE_*` do dopisania w CF + rebuild. Cutover DNS nie. |
| 2026-08-18 | Pages project `smart-senior` utworzony (obok `dfcms`, nie wewnątrz). Worker `smart-senior-web` redeploy v `44175741-83c9-4d39-94f7-c3bd5878bac3`. Nadal jedno konto CF (`dfcms` workers.dev). |
| 2026-08-18 | Usunięto Worker `smart-senior-web` z konta DFCMS. Zdjęty `account_id` z `web/wrangler.jsonc`. Cloudflare Git z korzenia repo = błąd `workerd` 144 MiB; `.assetsignore` + Root directory `web/`. |
