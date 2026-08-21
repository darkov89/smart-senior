---
status: ACTIVE
created: 2026-08-19
updated: 2026-08-21
source: HLD D.2 / NFR-SEC / SECURITY.md
supersedes: null
superseded_by: null
confidence: HIGH
---

# ADR-011: MFA (AAL2) for privileged staff on sensitive tables

| Pole | Wartość |
|------|---------|
| **Status** | ACTIVE |
| **Data** | 2026-08-19 |
| **Autor** | Architekt Systemu + Agent |

## Kontekst

Kradzież tabletu personelu przy samym haśle (`aal1`) daje SELECT na kartach pensjonariuszy, Peace Letter i `staff_internal_notes`. ISO 27001 A.8.5 / NIS2 oczekują drugiego składnika dla ról uprzywilejowanych. Supabase Auth koduje pewność sesji w JWT `aal` (`aal1` | `aal2`).

## Decyzja

1. TOTP (Authenticator App) włączone lokalnie (`supabase/config.toml` `[auth.mfa.totp]`). Remote: te same flagi w Dashboard (plan Pro).
2. RLS **restrictive** na `patients`, `daily_reports`, `daily_logs`, `voice_draft_notes` (kolumna `staff_internal_notes`) oraz `family_invitations`: helper `jwt_privileged_aal2_ok()` wymaga `(auth.jwt() ->> 'aal') = 'aal2'` dla `superadmin` / `org_admin` / `nurse`.
3. Rola `family` i `iot_device` nie są cięte tym helperem (kanał rodziny zostaje na `aal1`). `service_role` omija RLS (Edge cron / przyszły ingest Fazy 3).
4. Brak roli `admin` — tylko enum `app_role` (ADR-006).
5. Pozostałe `voice_conversations` / `voice_conversation_turns` bez AAL2 (follow-up).

## Konsekwencje

- Personel bez zapisanego TOTP i challenge w sesji **nie odczyta** kart, raportów ani szkiców głosowych z klienta JWT.
- Edge wołane z JWT pielęgniarki (nie `service_role`) też wymaga `aal2`.
- UI musi mieć enrollment + challenge TOTP zanim personel wejdzie w opiekę.
- Remote Auth MFA nie włącza się samą migracją SQL — Dashboard.

## Supersession (opcjonalnie)

- Zastępuje: —
- Zastąpione przez: —
