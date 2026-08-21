# Pakiet Spokoju (SeniorSmart) — MASTER CONTEXT

> **Źródło prawdy technicznego stanu aplikacji** (co jest zbudowane, jak deployować, schema/RLS).  
> **Decyzje HLD / NFR / roadmapa:** [`HLD.md`](HLD.md) — nie duplikuj tu ekonomiki ani pełnego HLD.  
> Security policy: [`SECURITY.md`](../SECURITY.md). Strażnik: reguła `architectural-guardian`.

**Ostatnia aktualizacja treści:** 2026-08-21 — Next.js na Pages `smart-senior.pages.dev`; Worker `smart-senior-web` usunięty

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
| **Hosting frontu** | Cloudflare Pages **`smart-senior`** → `https://smart-senior.pages.dev` (OpenNext `_worker.js`). **Zakaz Vercel.** Nie projekt `dfcms`. | izolacja od DFCMS |
| **Backend / DB** | Supabase (PostgreSQL, Auth, RLS) | `supabase/migrations/`, projekt **SeniorSmart** |
| **Logika serwerowa** | Supabase Edge Functions (Deno) | `onboard-organization`, `hash-pesel` (JWT), `redeem-family-invitation` (token publiczny). Głos/merge/notify jeszcze nie. Polar Edge usunięty (ADR-012). |
| **AI** | OpenAI — Whisper (transkrypcja), GPT-4o (kategoryzacja + podsumowania + System Prompt / Guardrails) | tylko Edge / backend |

### Struktura frontendu

```
web/src/app/               → Next.js App Router (ADR-008)
  logowanie/               → e-mail/hasło + TOTP AAL2 (`/logowanie/klucz`)
  aktywacja/               → redeem zaproszenia rodziny
  (family)/rodzina/        → Peace Letter + plan dnia + hydrant
  (staff)/placowka/        → tablica, karta podopiecznego, zatwierdzenia, plan dnia
index.html                 → LEGACY Alpine — nie rozszerzaj
src/js/                    → LEGACY — do cutoveru
```

Konfiguracja Next: `web/.env.local` (`NEXT_PUBLIC_SUPABASE_*` only). Legacy: `src/js/config.js`.

**Nie mylić z DFCMS:** ten repozytorium i Pages project są niezależne od `dfopscms` / `dfcms.pl`.

---

## 4. Środowiska

| Obszar | Stan obecny (MVP) |
|--------|-------------------|
| **Git** | `https://github.com/darkov89/smart-senior` — gałąź `main` (`9c04c2a`). 113 plików tracked, max `web/package-lock.json` ~420 KB; brak `node_modules` / sekrety. |
| **Cloudflare Pages** | projekt **`smart-senior` LIVE** → `https://smart-senior.pages.dev` (Next.js OpenNext). Vanilla zastąpiony 2026-08-21. Osobny od **`dfcms`**. |
| **Cloudflare Next.js** | Ten sam projekt Pages (nie Worker `smart-senior-web`; skrypt usunięty 2026-08-21). Cutover DNS własnej domeny nie. |
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
| `organizations` | Domy opieki (`name`, `address`, `resident_limit`, `settings_json`); INSERT tylko JWT `superadmin` |
| `profiles` | Rozszerzenie `auth.users` — `organization_id`, `role`, `full_name`, `phone` (SMS) |
| `patients` | Pensjonariusze — minimalizacja (`first_name`, `last_name_initial`, `pesel_hash` UNIQUE per org, `room`); opcjonalnie `archived_at` / `archived_reason` |
| `daily_logs` | Notatki / sensory / raporty AI — `raw_data`, `processed_data` (tor personelu; **nie** kanał rodziny) |
| `daily_reports` | Raport dzienny / Peace Letter; family SELECT tylko `status=published` |
| `notification_preferences` | Opt-in SMS/e-mail rodziny per pensjonariusz |
| `notification_deliveries` | Wysyłki; zapis `service_role`; personel SELECT |
| `voice_conversations` | Stan rozmowy (jeden otwarty wątek / pacjent / `local_date`); `missing_contexts voice_missing_context[]` |
| `voice_conversation_turns` | Tury: transkrypcja personelu lub pytanie asystenta |
| `voice_draft_notes` | Surowe głosówki przed wieczornym merge — `transcript`, `staff_internal_notes`, `family_safe_partial`; cleanup 30 dni po merge/discard |
| `daily_agenda` | Plan dnia (posiłek / aktywność / wizyta); communal XOR `patient_id` |
| `daily_agenda_templates` | Szablony dnia placówki; tylko personel |
| `consent_ledger` | Zgody RODO; purpose `wearable_family_access` (hak Fazy 3) oraz `family_portal_access` przy aktywacji zaproszenia |
| `family_connections` | Powiązanie profilu rodziny ↔ pensjonariusz (`relationship`, `is_primary_contact`, `status`) |
| `family_invitations` | Zaproszenia rodziny: token 7 dni, `org_admin` swojej org; family DENY |
| `family_messages` | Hydrant asynchroniczny rodziny → personel; nie Peace Letter, nie czat na żywo |
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
Family hydrant + relacje: `20260818190805_family_connections_chat_and_consents.sql` — `db push` OK. Typy: `web/src/types/database.ts`.  
MFA + zaproszenia: `20260819054459_sec_mfa_idempotency_invitations.sql`. ADR-011.  
Polar DROP + plan dnia: `20260821160210_drop_polar_and_telemetry.sql` + `20260821160211_daily_agenda_pesel_aal2.sql` (ADR-012). Typy: `web/src/types/database.ts`.  
Onboarding placówki: `20260821174403_task_infra_02_onboarding.sql` — `address` / `resident_limit`; INSERT `organizations` tylko `superadmin`.

### Widok rodzinny

`family_daily_reports` — `daily_reports.content` przy `status=published` (security_invoker); bez `daily_logs`.  
**Brak** `family_wearable_comfort` (ADR-012). Portal: empty-state komfortu. `consent_ledger` zostaje bez DTO opaski.

### Retencja (live)

- `patients.archived_at` / `archived_reason` — miękka archiwizacja (`deceased` \| `left_facility` \| `gdpr_request`). Rodzina: brak SELECT (helper `family_can_access_patient` + widoki). Personel: SELECT historii OK; INSERT/UPDATE opieki tylko gdy `patient_is_active`. Twarde usunięcie = `DELETE patients` (CASCADE; `audit_logs.old_data` na DELETE opieki = `[REDACTED DUE TO GDPR]`).
- `cleanup_old_voice_drafts()` — surowe `voice_*` merged/discarded (rozmowy: merged/abandoned) starsze niż 30 dni. `pg_cron` job `cleanup-old-voice-drafts` o 03:00 Europe/Warsaw; `GRANT EXECUTE` dla `postgres` + `service_role`. Peace Letter (`daily_logs`) bez zmian.
- Pozostałe okresy retencji (`daily_logs`, consent, audit, access logs, otwarte transkrypty) — **REQUIRES_POLICY_DECISION**.

---

## 6. RBAC i RLS

**Każda tabela ma `ENABLE ROW LEVEL SECURITY`.**

| Rola | Dostęp |
|------|--------|
| `superadmin` | Pełny dostęp systemowy |
| `org_admin` / `nurse` | R/W wyłącznie w swoim `organization_id` |
| `family` | `family_daily_reports` (published); `daily_agenda` SELECT (wspólne org + przypisani pensjonariusze); `family_messages` INSERT/SELECT przy aktywnym `family_connections`; preferencje powiadomień własne; nigdy `raw_data`, nigdy tabele `voice_*`, nigdy `notification_deliveries` |
| `iot_device` | Martwa w MVP. Faza 3: tylko **INSERT** do `daily_logs` (`typ_logu = hardware_sensor`) w swojej org |

**`consent_ledger`:** superadmin ALL; `org_admin` R/W swojej org (rodzina nie self-grant); family SELECT własnych wierszy tylko przy `family_can_access_patient` (status `active`); bez INSERT/UPDATE/DELETE. Brak DTO opaski w MVP.

**`family_connections`:** `relationship` (kody EN), jeden `is_primary_contact` na aktywnego pensjonariusza, `status` `active` \| `pending` \| `revoked`. Helper `family_can_access_patient` wymaga `status = 'active'`.

**`family_messages`:** family INSERT (nadawca = `auth.uid()`, aktywne przypisanie) + SELECT wątku pensjonariusza; personel org SELECT + UPDATE statusu odczytu (treść niemutowalna); superadmin ALL. Rate limit — WAF, nie Postgres.

**`voice_conversations` / `voice_conversation_turns` / `voice_draft_notes` (ADR-010):** superadmin ALL; `org_admin` / `nurse` R/W w swojej org; **family — brak SELECT**. Transkryptów nie haszować (ADR-005). Peace Letter = `daily_reports` po merge + HITL + `published`.

**Zero-Guessing Entity Resolution (HLD 2.4.5):** nagrywanie wyłącznie z karty konkretnego seniora. POST do Edge `voice-assistant` **musi** zawierać `patient_id`. LLM dostaje sam transkrypt (bez imienia / UUID). Zapis `voice_*` wiąże wiersz z `patient_id` z żądania — nigdy z zgadywania „dla Jana”.

**Integralność tenanta (2026-08-14):** UNIQUE `(id, organization_id)` na `patients` / `profiles` / `voice_conversations`; composite FK `(patient_id, organization_id)` na tabelach opieki, głos, consent, family, assignments, `daily_agenda`. Istniejące pojedyncze FK zachowane.

**`patient_staff_assignments`:** org_admin R/W (aktywny pensjonariusz, org z JWT); nurse SELECT swojej org. **Nie podłączać jeszcze do RLS `patients`/`daily_logs`** — obecny model personelu jest org-wide.

**`security_access_logs`:** authenticated bez INSERT/UPDATE/DELETE. org_admin SELECT swojej org; superadmin SELECT; family DENY. `log_security_access()` ustawia `actor_id` z `auth.uid()`.

**`daily_agenda`:** personel R/W swojej org (zapis indywidualny tylko gdy `patient_is_active`); family SELECT pozycji wspólnych org oraz indywidualnych przy aktywnym przypisaniu. Szablony — tylko personel.

**`family_invitations`:** superadmin ALL; `org_admin` R/W swojej org (INSERT: `invited_by_user_id = auth.uid()`, aktywny pensjonariusz); family / nurse DENY. Token 7 dni. Relacje jak `family_connections`.

**MFA (ADR-011):** polityki **restrictive** `*_privileged_require_aal2` na `patients`, `daily_reports`, `daily_logs`, `voice_draft_notes`, `family_invitations`. `superadmin` / `org_admin` / `nurse` wymagają JWT `aal=aal2`. Rodzina i `iot_device` bez tego wymogu.

**`daily_reports`:** superadmin ALL; `org_admin` / `nurse` R/W w swojej org (zapis tylko gdy `patient_is_active`); family SELECT wyłącznie `status=published` + `family_can_access_patient`. Widok `family_daily_reports` = ten sam filtr (`security_invoker`).

**Powiadomienia:** `notification_preferences` — family CRUD własne (`profile_id = auth.uid()`); personel SELECT org. `notification_deliveries` — authenticated tylko SELECT (staff/superadmin); INSERT/UPDATE przez `service_role`. UNIQUE `(profile_id, daily_report_id, channel)`.

**Autoryzacja RLS (ADR-006):** w 100% z **Custom JWT Claims** (`app_metadata.role`, `app_metadata.organization_id`) wstrzykiwanych przez Auth Hook `custom_access_token_hook`. Polityki porównują `(auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid` z kolumną tenanta — bez lookupu `profiles` na wiersz.

Helpery SECURITY DEFINER **pozostawione:** `family_can_access_patient(uuid)`. Trigger audytu: `audit_row_change()`.

**Onboarding B2B (TASK-INFRA-02):** Edge `onboard-organization` — wywołanie z JWT `superadmin` (nie lookup `profiles`, nie Database Webhook). INSERT `organizations` (`id` = `gen_random_uuid()`, opcjonalnie `address` / `resident_limit`) + `inviteUserByEmail` + `app_metadata` `{ role: org_admin, organization_id }` + profil `org_admin`. Limit podopiecznych chroniony triggerem (zmiana tylko `superadmin` / `service_role`). RLS INSERT: `organizations_superadmin_insert`. Enum roli = `superadmin` (nie `super_admin`).

**PESEL:** Edge `hash-pesel` (personel JWT) — SHA-256 + `PESEL_HASH_SALT`; front nigdy nie haszuje. **Zaproszenie rodziny:** Edge `redeem-family-invitation` (`verify_jwt=false`, token w body) — konto `family` + `family_connections` + zgoda `family_portal_access`. Family nie ma SELECT na `family_invitations`.

**Auth Hook:** aktywować w Dashboard (Authentication → Hooks → Custom Access Token). Po zmianie roli/org — refresh sesji.

### Zasady kodowania (Cursor / agenci)

1. Nowa tabela SQL → zawsze RLS + polityki.
2. Edge Functions (TS) → zawsze weryfikacja JWT Supabase Auth przed akcją.
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

**Telemetria → Peace Letter:** poza MVP (ADR-012). Skill `telemetry-context-provider` = DEFERRED. Peace Letter = wyłącznie głos + Guardrails.

---

## 7a. Telemetria (ADR-012 — poza MVP)

| Element | Opis |
|---------|------|
| MVP | **Brak ingestu.** DROP `polar_*`, `telemetry_logs`, `family_wearable_comfort` |
| Edge | Funkcje `polar-oauth` / `polar-webhook` usunięte z repo |
| Hak | `consent_ledger.wearable_family_access`; rola `iot_device` martwa |
| Faza 3 | Własne bramki w placówce — nowy ADR, nie Polar AccessLink |
| UI rodziny | Empty-state: „Funkcja inteligentnych wskaźników komfortu jest w przygotowaniu” |
| Non-MD / MDR | Gdy ingest wróci: komfort, zero diagnozy, zero alarmów z opaski |

### User Stories v2.4 — AC bez Polar (MVP)

| Story | Zmiana vs spec z Polar |
|-------|------------------------|
| SC-ADM-05 AC3 | Brak ingestu w MVP. Faza 3: zarchiwizowany `patient_id` odrzuca paczki. |
| SC-FAM-03 AC3 | Usunięte (`polar_connections.last_successful_sync_at`). AC4 empty-state komfortu zostaje. |
| SC-FAM-03 14:00 | Wczorajszy Peace Letter + oczekiwanie na wieczorny triage; bez syncu opaski. |
| SC-FAM-05 AC2 | Odświeża `family_daily_reports` + `daily_agenda`; bez `family_wearable_comfort`. |
| TASK-LEGAL-01 AC1 | DPA z aktualnymi podprocesorami (Supabase, OpenAI, Cloudflare, SMSAPI/Resend). Polar Electro Oy poza MVP. |
| TASK-INFRA-01 AC2 | Dostęp do karty → `security_access_logs`; **nie** pgAudit session-read treści opieki. |

---

## 8. Deploy

| Co | Jak |
|----|-----|
| **Front Next.js** | `cd web && npm run deploy` → Pages **`smart-senior`** (`https://smart-senior.pages.dev`). **Nie** `opennextjs-cloudflare deploy` (Worker na `*.dfcms.workers.dev`). Publiczne `NEXT_PUBLIC_SUPABASE_*` w `web/.env.production` przed buildem. **Nie Vercel.** |
| **DB** | `npx supabase db push` (po sprawdzeniu `project-ref`) |
| **Edge Functions** | `npx supabase functions deploy <name>` — `onboard-organization`, `hash-pesel`, `redeem-family-invitation` |
| **Git** | `git push origin main` **nie** deployuje Supabase. Podpięty Cloudflare Git z root `repo/` wgrywa `workerd` (144 MiB) — Root directory musi być `web/`. |

---

## 9. Diagram (skrót)

```
Pielęgniarka / Rodzina
    → Front: Next.js `/web` na Cloudflare OpenNext (legacy Pages Alpine do cutoveru)
    → Supabase Auth (JWT)
    → PostgREST + RLS (tenant)
    → Edge Functions (AI Guardrails, Whisper, GPT) — wrażliwe dane
    → PostgreSQL (organizations … voice_* … daily_agenda … audit_logs)
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
| 2026-08-18 | Migracja `20260818190805_family_connections_chat_and_consents`: relacja/primary/status na `family_connections`; hydrant `family_messages`; family SELECT zgód tylko przy aktywnym przypisaniu. HLD 2.4.7. `db push` OK na `bmughdoqdsjfstxnnjks`. Typy: `web/src/types/database.ts`. |
| 2026-08-20 | Faza 4 ingest: mapper AccessLink (`polarAccesslinkMapper.ts`); `polar-oauth` register user; `polar-webhook` idempotencja + GET activity/sleep/nightly-recharge → UPSERT `polar_*`. Testy Deno mapper (10). Brak UI sparowania i crona; brak żywego E2E Polar. |
| 2026-08-21 | Higiena agent docs: kanał rodziny w rules/skills/ADR-010 = `daily_reports` (nie `processed_data`). Przywrócony `AGENT_WORKFLOW_README.md`. Raport hardening oznaczony jako snapshot 2026-08-14. |
| 2026-08-21 | ADR-012: Polar i ingest poza MVP. DROP `polar_*` / `telemetry_logs` / `family_wearable_comfort`; usunięte Edge polar-*. `daily_agenda` + szablony; UNIQUE `pesel_hash` per org; AAL2 na `daily_logs`. HLD 2.4.9. Faza 3 = własne bramki. `db push` OK na `bmughdoqdsjfstxnnjks`. Katalogi product/enterprise: polar tables absent, agenda + pesel unique + 4× AAL2. Undeploy `polar-oauth` / `polar-webhook`. |
| 2026-08-21 | UI MVP pętla produktu (User Stories v2.4): `@supabase/ssr` + middleware ról/MFA; admin karta/PESEL/zaproszenia; tablica + dyktafon IndexedDB + ręczny szkic `daily_reports` + zatwierdzenie + plan dnia; portal rodziny (aktywacja, Peace Letter, hydrant 3/h, switcher). Edge `hash-pesel` + `redeem-family-invitation` ACTIVE. Secret `PESEL_HASH_SALT`. `voice-assistant` nadal brak. |
| 2026-08-21 | Deploy Next Worker `smart-senior-web` v `a529508b-e252-4655-b535-a948508f643f` → `https://smart-senior-web.dfcms.workers.dev`. Build z `NEXT_PUBLIC_SUPABASE_*`. Smoke HTTP: `/` i `/logowanie` 200; `/placowka` i `/rodzina` 307 → `/logowanie`; Edge `hash-pesel` 401 bez JWT. |
| 2026-08-21 | Cutover: Next.js na Pages `smart-senior` (`https://smart-senior.pages.dev`). Usunięty Worker `smart-senior-web`. Vanilla na tym projekcie zastąpiony. `cd web && npm run deploy` = OpenNext + `wrangler pages deploy`. Projekt Pages `dfcms` nietknięty. |
| 2026-08-21 | TASK-INFRA-02: onboarding placówki. Migracja `20260821174403_task_infra_02_onboarding` (`address`, `resident_limit`, RLS INSERT tylko `superadmin`, trigger limitu). Edge `onboard-organization` — JWT `app_metadata`, Admin invite + `app_metadata` `org_admin`, rollback. Brak Database Webhook. **db push / functions deploy jeszcze nie.** |
