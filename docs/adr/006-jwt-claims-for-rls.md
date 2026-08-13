---
status: ACTIVE
created: 2026-08-13
updated: 2026-08-13
source: HLD / MASTER_CONTEXT §6 / implementacja custom_access_token_hook
supersedes: null
superseded_by: null
confidence: HIGH
---

# ADR-006: Custom JWT Claims for RLS (O(1) tenancy)

| Pole | Wartość |
|------|---------|
| **Status** | ACTIVE |
| **Data** | 2026-08-13 |
| **Autor** | Architekt Systemu + Agent |

## Kontekst

Polityki RLS wołały `SECURITY DEFINER` helpery (`current_organization_id()`, `is_org_staff()`, …). Każdy wiersz = lookup `profiles` — koszt rośnie z wolumenem logów (wąskie gardło CPU). Zespół odchodzi od tego modelu na rzecz **Custom JWT Claims** (Auth Hook), żeby filtrowanie tenanta było O(1) (odczyt zdekodowanego tokenu).

Numer pliku **006** (nie 003): ADR-003 jest zajęty przez Second Brain 2.0.

## Decyzja

1. Hook `public.custom_access_token_hook(event jsonb)` wstrzykuje `profiles.role` oraz `profiles.organization_id` do `event.claims.app_metadata`.
2. RLS na tabelach multi-tenant czyta `(auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid` oraz `app_metadata.role`.
3. Personel placówki = **`org_admin` | `nurse`** (enum nie ma `staff`).
4. Usunięto helpery RLS-only: `current_organization_id`, `current_profile_role`, `is_superadmin`, `is_org_staff`, `is_family`, `is_iot_device`.
5. **Zostaje** `family_can_access_patient(uuid)` — lista przypisań rodziny nie mieści się w claims; to nadal lookup `family_connections`.
6. **Zostaje** `audit_row_change` (trigger audytu, nie RLS).
7. Edge `onboard-organization`: superadmin tworzy org + `inviteUserByEmail` + profil `org_admin`.
8. Hook **musi** być włączony w Dashboard (Auth → Hooks). Bez tego JWT nie ma claims i RLS odcina dostęp (Fail Secure).

## Konsekwencje

- Skalowanie SELECT na `daily_logs` / `patients` bez N zapytań do `profiles` per wiersz.
- Po zmianie roli lub `organization_id` użytkownik musi **odświeżyć sesję** (stary JWT jest źródłem prawdy do wygaśnięcia).
- Operacja ręczna: aktywacja hooka w panelu — nie da się tego w pełni zautomatyzować samą migracją SQL.
- Brak testów E2E RLS — REQ-SEC-001 pozostaje IMPLEMENTED, nie VERIFIED.
