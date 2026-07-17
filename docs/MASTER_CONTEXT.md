# Pakiet Spokoju (SeniorSmart) — MASTER CONTEXT

> **Źródło prawdy technicznego stanu aplikacji.** Aktualizuj **na koniec sesji**, gdy zmienia się zachowanie w produkcji, API, flow użytkownika lub architektura.  
> Security policy: [`SECURITY.md`](../SECURITY.md). Szybki start: [`README.md`](../README.md) (gdy powstanie).

**Ostatnia aktualizacja treści:** 2026-07-17 — init: multi-tenant schema + RLS, Cloudflare Pages `smart-senior`, repo GitHub

---

## 1. Wizja i KPI

Platforma **B2B SaaS dla domów opieki**:

- optymalizacja raportowania personelu (notatki głosowe zamiast pisania),
- proaktywna komunikacja z rodzinami pensjonariuszy („święty spokój” = mniej telefonów).

**KPI:** zaoszczędzony czas pielęgniarek; spadek zapytań telefonicznych od rodzin.

---

## 2. Architektura „Secure by Design”

Projekt celuje w zgodność z **RODO**, **ISO 27001**, **NIS2**.

### Zasada krytyczna

**Żadne wrażliwe dane medyczne nie mogą być przetwarzane, parsowane ani filtrowane po stronie frontendu (przeglądarki).**  
Cała logika biznesowa, autoryzacja oraz czyszczenie danych (Guardrails) odbywa się w **Supabase Edge Functions** (i ewentualnie innych środowiskach backendowych), nie w Alpine.js / HTML.

Frontend: UI, stany, wywołania API z tokenem użytkownika.  
Backend: Whisper / GPT, kategoryzacja, empatyczne podsumowania, walidacja JWT, zapis do DB.

---

## 3. Stos technologiczny

| Warstwa | Technologia | Artefakty |
|--------|-------------|-----------|
| **Frontend** | HTML5, Tailwind CDN, Alpine.js | `index.html`, `src/app.js` |
| **Hosting frontu** | Cloudflare Pages | projekt **`smart-senior`** (osobny od DFCMS / `dfcms`) |
| **Backend / DB** | Supabase (PostgreSQL, Auth, RLS) | `supabase/migrations/`, projekt **SeniorSmart** |
| **Logika serwerowa** | Supabase Edge Functions (Deno) | `supabase/functions/` *(planowane)* |
| **AI** | OpenAI — Whisper (transkrypcja), GPT-4o (kategoryzacja + podsumowania + System Prompt / Guardrails) | tylko Edge / backend |

**Nie mylić z DFCMS:** ten repozytorium i Pages project są niezależne od `dfopscms` / `dfcms.pl`.

---

## 4. Środowiska

| Obszar | Stan obecny (MVP) |
|--------|-------------------|
| **Git** | `https://github.com/darkov89/smart-senior` — gałąź `main` |
| **Cloudflare Pages** | projekt **`smart-senior`** → `https://smart-senior.pages.dev` (+ preview `*.smart-senior.pages.dev`) |
| **Supabase `project-ref`** | **`bmughdoqdsjfstxnnjks`** (nazwa: SeniorSmart, region: North EU / Stockholm) |
| **Org Supabase** | osobna od dfops (`fhjokrekpzahqcskjmul`) |
| **Lokalny front** | pliki statyczne; deploy: `npm run deploy` / `wrangler pages deploy . --project-name=smart-senior` |
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

### Enum `app_role`

`superadmin` | `org_admin` | `nurse` | `family` | `iot_device`

### Enum `log_type` (`typ_logu`)

`voice_note` | `hardware_sensor` | `ai_report`

### Tabele kluczowe

| Tabela | Rola |
|--------|------|
| `organizations` | Domy opieki (`name`, `settings_json`) |
| `profiles` | Rozszerzenie `auth.users` — `organization_id`, `role`, `full_name` |
| `patients` | Pensjonariusze — minimalizacja danych (`first_name`, `last_name_initial`, `pesel_hash`, `room`) |
| `daily_logs` | Notatki / sensory / raporty AI — `raw_data`, `processed_data` |
| `family_connections` | Powiązanie profilu rodziny ↔ pacjent |
| `audit_logs` | Audyt ISO — kto, kiedy, IP, UPDATE/DELETE |

Migracja bazowa: `supabase/migrations/20260717193117_init_multi_tenant_schema.sql`.

### Widok rodzinny

`family_daily_reports` — tylko bezpieczne kolumny (`processed_data`, bez `raw_data`), filtrowane po `family_connections`.

---

## 6. RBAC i RLS

**Każda tabela ma `ENABLE ROW LEVEL SECURITY`.**

| Rola | Dostęp |
|------|--------|
| `superadmin` | Pełny dostęp systemowy |
| `org_admin` / `nurse` | R/W wyłącznie w swoim `organization_id` |
| `family` | Odczyt wyselekcjonowanych raportów przez `family_daily_reports` (bez bezpośredniego SELECT `raw_data` z `daily_logs`) dla przypisanych pacjentów |
| `iot_device` | Tylko **INSERT** do `daily_logs` (`typ_logu = hardware_sensor`) w swojej org |

Helpery SQL (SECURITY DEFINER + `search_path = public`): `current_profile_role()`, `current_organization_id()`, `is_superadmin()`, `is_org_staff()`, `is_family()`, `is_iot_device()`, `family_can_access_patient(uuid)`.

Trigger audytu: `audit_row_change()` na UPDATE/DELETE (organizations, profiles, patients, daily_logs, family_connections).

### Zasady kodowania (Cursor / agenci)

1. Nowa tabela SQL → zawsze RLS + polityki.
2. Edge Functions (TS) → zawsze weryfikacja JWT Supabase Auth przed akcją.
3. Zapytania tenantowe → filtr `organization_id` aktualnego użytkownika (poza świadomym Service Role).
4. Frontend → proste stany Alpine; zero logiki medycznej / Guardrails w przeglądarce.
5. **Service role / secret keys** nigdy w statycznym froncie ani w Pages (public).

---

## 7. AI (planowane)

| Model | Użycie | Gdzie |
|-------|--------|-------|
| Whisper | Transkrypcja głosowa | Edge Function |
| GPT-4o | Kategoryzacja + empatyczne podsumowania + System Prompt / Guardrails | Edge Function |

`raw_data` może zawierać treść roboczą; rodziny i front publiczny widzą wyłącznie `processed_data` po pipeline AI.

---

## 8. Deploy

| Co | Jak |
|----|-----|
| **Front (Cloudflare)** | `npm run deploy` → Pages `smart-senior` (**nie** `dfcms` / `dfopscms`) |
| **DB** | `npx supabase db push` (po sprawdzeniu `project-ref`) |
| **Edge Functions** | `npx supabase functions deploy <name>` *(gdy powstaną)* |
| **Git** | `git push origin main` — **nie** deployuje automatycznie Supabase; Pages na razie przez Wrangler CLI (Git Provider: No) |

---

## 9. Diagram (skrót)

```
Pielęgniarka / Rodzina / IoT
    → Cloudflare Pages (HTML + Alpine) — tylko UI
    → Supabase Auth (JWT)
    → PostgREST + RLS (tenant)
    → Edge Functions (AI Guardrails, Whisper, GPT) — wrażliwe dane
    → PostgreSQL (organizations … audit_logs)
```

---

## 10. Dziennik transformacji

| Data | Zmiana |
|------|--------|
| 2026-07-17 | Init repo, migracja multi-tenant + RLS + audit, Pages `smart-senior`, GitHub `darkov89/smart-senior`, docs/skills/security jak w DFCMS |
