---
status: ACTIVE
created: 2026-08-13
updated: 2026-08-13
source: HLD 2.3.2 / Silver Care MVP v2 Faza 3
supersedes: null
superseded_by: null
confidence: HIGH
---

# ADR-009: Polar schema + zgoda rodziny (consent_ledger)

| Pole | Wartość |
|------|---------|
| **Status** | ACTIVE |
| **Data** | 2026-08-13 |
| **Autor** | Architekt Systemu + Agent |

## Kontekst

Faza 3 wymaga znormalizowanych agregatów Polar 360 oraz rygorystycznego RLS: dostęp klienta tylko dla rodziny / opiekuna z **aktywną zgodą**. `consent_ledger` był planowany w HLD i stał się blockerem tej ścieżki.

Personel (`org_admin` / `nurse`) ma SELECT metryk Polar w swojej org (Big Picture). `consent_ledger` obowiązuje **tylko rodzinę**. Enrichment Peace Letter i OAuth tokeny: Edge `service_role`.

## Decyzja

1. `consent_ledger` — na start purpose `wearable_family_access`. Wpisuje `org_admin`; rodzina **nie** self-grant. SELECT własnych zgód.
2. `polar_connections` — link pensjonariusz ↔ Polar user id. **Bez** tokenów OAuth (Faza 4, tylko Edge). RLS: superadmin + org_admin. Family: brak.
3. Agregaty dzienne (nie stream): `polar_daily_activity`, `polar_sleep_nights`, `polar_heart_rate_daily`, `polar_hrv_nights`.
4. Client SELECT na metrykach Polar:
   - **family** + assignment + `family_has_wearable_consent` + ten sam tenant;
   - **org_admin / nurse** tej samej org (Big Picture) — **bez** wymogu `consent_ledger`;
   - superadmin ALL. Zapisy: service_role.
5. Widok `family_wearable_comfort` (`security_invoker`): kroki / sen / sleep_score — **bez** BPM i HRV. To preferowany DTO portalu rodziny.
6. `telemetry_logs` zostaje (legacy); family nadal bez SELECT na tej tabeli.
7. Non-MD: sen, HRV, tętno = komfort. UI i Peace Letter bez „puls 112” i bez języka klinicznego.

## Konsekwencje

- Brak zgody = puste tabele Polar dla JWT family (Fail Secure).
- Tokeny AccessLink wyłącznie w `polar_oauth_secrets` (brak GRANT dla authenticated).
- REQ-IOT-002: IMPLEMENTED, nie VERIFIED (brak testów E2E RLS).
