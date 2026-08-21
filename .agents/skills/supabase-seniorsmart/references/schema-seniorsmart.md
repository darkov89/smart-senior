# Schema map — SeniorSmart

Słownik kolumn i RLS: poniżej. Decyzje: HLD §C / ADR-006–012. Stan live: `docs/MASTER_CONTEXT.md` §5–6.

## Jak działa i po co

Baza trzyma **jeden produkt, dwa kanały**. Personel domu opieki dyktuje dzień pensjonariusza. Rodzina dostaje wieczorem **Peace Letter** — spokojne podsumowanie bez żargonu klinicznego i bez surowych transkryptów. Multi-tenant: każdy dom to `organizations`; prawie każdy wiersz ma `organization_id`. PostgreSQL RLS odcina obce placówki na każdym zapytaniu z klienta. Logika medyczna i Guardrails żyją w Edge, nie w przeglądarce.

### Kto jest kim

Konto Auth (`auth.users`) ma profil w `profiles`: rola + placówka. Rola i `organization_id` trafiają do JWT (`app_metadata`) przez Auth Hook `custom_access_token_hook` — polityki RLS czytają token, nie robią lookupu `profiles` na każdy wiersz (ADR-006).

- **superadmin** — onboarding placówek, pełny dostęp systemowy.
- **org_admin** — administracja domu: personel, zgody, archiwizacja pensjonariusza.
- **nurse** — codzienna opieka: głosówki, notatki, plan dnia, podgląd pensjonariuszy swojej org.
- **family** — tylko przypisani pensjonariusze i tylko treść już przygotowana dla rodziny.
- **iot_device** — martwa w MVP; Faza 3: wąski INSERT do `daily_logs` (`hardware_sensor`).

Przypisanie rodziny do pensjonariusza to `family_connections` ze statusem `active`. Samo konto `family` nie wystarcza — bez aktywnego wiersza powiązania RLS nic nie pokaże.

### Pensjonariusz (minimalizacja)

`patients` nie jest kartoteką medyczną. Imię, inicjał nazwiska, pokój, opcjonalnie `pesel_hash` (SHA-256 + salt — nigdy PESEL w plaintext; UNIQUE w ramach `organization_id`). Treści klinicznej się **nie haszuje** (ADR-005): notatki mają zostać czytelne dla uprawnionego personelu.

`archived_at` / `archived_reason` to miękka blokada (zgon, wypis, wniosek RODO): rodzina traci SELECT, personel nie dopisuje opieki. Twarde usunięcie (Art. 17) = `DELETE` pacjenta — CASCADE znosi głos, plan dnia, notatki, zgody i powiązania rodziny.

### Dwie warstwy treści

`daily_logs` to surowy dziennik personelu. Artefakt dla rodziny to `daily_reports`:

- `raw_data` — surowe / wewnętrzne; **tylko personel**.
- `processed_data` — legacy na `daily_logs`; **nie** kanał rodziny.
- `daily_reports.content` — Peace Letter; rodzina tylko gdy `status=published`.
- `is_ai_generated` na widoku rodziny = `ai_model IS NOT NULL`.
- `approved_by` / `approved_at` / `published_at` — HITL przed publikacją.

Rodzina **nie ma** SELECT na `daily_logs`. Widok celowo nie wystawia `raw_data`, żeby PostgREST nie wyciekł transkryptu.

### Głos → szkic → Peace Letter (ADR-010)

Personel nie dyktuje od razu listu do rodziny. W ciągu dnia żyje osobny, personelowy tor:

1. `voice_conversations` — jeden otwarty wątek na `(pensjonariusz, dzień opieki)`. `missing_contexts` (`mood`, `meal`, `sleep`, `activity`) mówi asystentowi, czego jeszcze brakuje.
2. `voice_conversation_turns` — tury: transkrypcja Whisper albo krótkie pytanie uzupełniające.
3. `voice_draft_notes` — surowy szkic. `transcript` zostaje dla personelu. Żargon kliniczny idzie do `staff_internal_notes` (nigdy do rodziny). Kandydat rodzinny — `family_safe_partial` — to jeszcze nie Peace Letter.

Wieczorny merge (Edge CRON, plan) składa szkice dnia w kandydata Peace Letter i zapisuje go do `daily_reports` (`ready` → HITL → `published`). Tabele `voice_*` są niewidoczne dla family. Transkryptów nie haszujemy. Po merge/discard surowy głos znika po 30 dniach (`cleanup_old_voice_drafts`, cron 03:00 Europe/Warsaw).

### Plan dnia (SC-NUR-05 / SC-FAM-06)

`daily_agenda` — wpisy na datę: `type` (`meal` / `activity` / `visit`), `title`, `description`, `start_time`, `is_communal`. Wspólne = `patient_id` NULL. Indywidualne = konkretny pensjonariusz. Szablony (`daily_agenda_templates`) są tylko dla personelu. Rodzina SELECT: pozycje wspólne org + indywidualne przy aktywnym `family_connections`.

### Telemetria — poza MVP (ADR-012)

Brak ingestu. Tabele Polar / `telemetry_logs` / widok `family_wearable_comfort` usunięte. `consent_ledger` (purpose `wearable_family_access`) zostaje jako hak na Faza 3 (własne bramki, nie Polar). Portal rodziny: empty-state karty komfortu. `iot_gateways` historycznie DROP.

### Audyt

Trigger `audit_row_change` zapisuje UPDATE/DELETE (kto, kiedy, IP). Klienci tylko czytają `audit_logs` (append-only). Przy DELETE danych opieki `old_data` jest zredagowane (`[REDACTED DUE TO GDPR]`). UPDATE zostawia pełny snapshot. `security_access_logs` — dziennik VIEW; INSERT przez `log_security_access()` (`actor_id` z JWT).

---

## Enums

- `app_role`: `superadmin`, `org_admin`, `nurse`, `family`, `iot_device`
- `log_type`: `voice_note`, `hardware_sensor`, `ai_report`
- `voice_conversation_status`: `active`, `awaiting_staff`, `ready_to_merge`, `merged`, `abandoned`
- `voice_turn_role`: `staff`, `assistant`
- `voice_draft_status`: `open`, `awaiting_staff`, `ready_to_merge`, `merged`, `discarded`
- `voice_clinical_handling`: `staff_internal`, `redact`
- `voice_missing_context`: `mood`, `meal`, `sleep`, `activity`

## Tables (tenant key)

| Table | Tenant column | Notes |
|-------|---------------|--------|
| `organizations` | `id` | `settings_json` |
| `profiles` | `organization_id` | PK = `auth.users.id`; `phone` do SMS |
| `patients` | `organization_id` | `pesel_hash` UNIQUE per org; `last_name_initial`; `archived_at` / `archived_reason` |
| `daily_logs` | `organization_id` | surowy tor personelu; family bez SELECT; AAL2 personelu |
| `daily_reports` | `organization_id` | Peace Letter; UNIQUE `(patient_id, local_date)` |
| `daily_agenda` | `organization_id` | plan dnia; communal XOR `patient_id`; family SELECT |
| `daily_agenda_templates` | `organization_id` | szablony dnia; tylko personel |
| `notification_preferences` | `organization_id` | opt-in SMS/e-mail; UNIQUE `(profile_id, patient_id, channel)` |
| `notification_deliveries` | `organization_id` | service_role writes; UNIQUE `(profile_id, daily_report_id, channel)` |
| `voice_conversations` | `organization_id` | One open thread per `(patient_id, local_date)`; `missing_contexts voice_missing_context[]`; family: no SELECT |
| `voice_conversation_turns` | `organization_id` | Staff transcript or assistant follow-up |
| `voice_draft_notes` | `organization_id` | Raw clips before evening merge; `staff_internal_notes` never family |
| `consent_ledger` | `organization_id` | purpose `wearable_family_access` (hak Fazy 3); org_admin writes |
| `family_connections` | `organization_id` | unique `(profile_id, patient_id)`; `relationship`; jeden aktywny `is_primary_contact`; `status` active/pending/revoked |
| `family_invitations` | `organization_id` | token 7 dni; `org_admin` w swojej org; family DENY; bez PII pensjonariusza w linku |
| `family_messages` | `organization_id` | hydrant rodziny → personel; treść niemutowalna; family INSERT przy `status=active` |
| `patient_staff_assignments` | `organization_id` | unique `(profile_id, patient_id)`; not wired into nurse RLS |
| `audit_logs` | `organization_id` | append via trigger; clients SELECT only |
| `security_access_logs` | `organization_id` | append-only; `log_security_access()` |

**Dropped (ADR-012):** `polar_*`, `telemetry_logs`, `family_wearable_comfort`. **Dropped (ADR-007):** `iot_gateways`.

## Family-safe surface

- View `family_daily_reports` (`security_invoker`): `daily_reports` published only (no `daily_logs`).
- `daily_agenda` — family SELECT: pozycje wspólne org + indywidualne przy `family_can_access_patient`.
- `voice_*` — **nie** dla family (ADR-010).
- `family_messages` — family SELECT/INSERT przy aktywnym przypisaniu; personel org czyta i oznacza odczyt.
- Brak DTO opaski w MVP (empty-state UI).

## Audit

Trigger `audit_row_change` on UPDATE/DELETE including `consent_ledger`, `voice_*`, `daily_agenda`, `patient_staff_assignments`.
`security_access_logs` / `audit_logs`: BEFORE UPDATE/DELETE → reject.

## RLS (ADR-006 / ADR-012)

Tenant + role from JWT `app_metadata`.  
SECURITY DEFINER: `family_can_access_patient(uuid)`, `log_security_access(...)`.  
MFA: restrictive AAL2 for `superadmin` / `org_admin` / `nurse` on `patients`, `daily_reports`, `daily_logs`, `voice_draft_notes`, `family_invitations` (ADR-011). Family stays `aal1`.  
Voice drafts/turns: staff org R/W; family **no** SELECT (ADR-010). Transkryptów nie haszować (ADR-005).
Composite FKs `(patient_id, organization_id)` — `docs/ENTERPRISE_HARDENING_REPORT.md` (snapshot; Polar rows there are historical).

## Retention

- `patients.archived_at` / `archived_reason` (`deceased`, `left_facility`, `gdpr_request`).
- `cleanup_old_voice_drafts()` — 30 dni; `pg_cron` 03:00 Europe/Warsaw; EXECUTE `postgres` + `service_role`.
- DELETE `patients` CASCADE: voice + daily_logs + daily_agenda + consent + family_connections. `security_access_logs` **RESTRICT** (fizyczny DELETE zablokowany, gdy są logi dostępu).
- DELETE audytu na tabelach opieki: `old_data` zredagowane (`[REDACTED DUE TO GDPR]`).
- Zarchiwizowany pacjent: rodzina brak SELECT; personel bez INSERT/UPDATE opieki (`patient_is_active`).
- Inne retencje: REQUIRES_POLICY_DECISION — `docs/ENTERPRISE_HARDENING_REPORT.md`.

## Telemetry ingest

**Brak w MVP** (ADR-012). Faza 3: własne bramki — nowy ADR, nie Polar AccessLink. Skill `telemetry-context-provider` = DEFERRED.
