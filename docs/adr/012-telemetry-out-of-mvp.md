---
status: ACTIVE
created: 2026-08-21
updated: 2026-08-21
source: HLD 2.4.9 / User Stories v2.4
supersedes: ADR-007, ADR-009 (Polar schema and AccessLink ingest)
superseded_by: null
confidence: HIGH
---

# ADR-012: Telemetria poza MVP — Polar wycofany; później własne bramki

| Pole | Wartość |
|------|---------|
| **Status** | ACTIVE |
| **Data** | 2026-08-21 |
| **Autor** | Architekt Systemu + Agent |

## Kontekst

Polar AccessLink (ADR-007/009) i ingest IoT nie wchodzą do pilotażu MVP. Kanon produktowy (User Stories v2.4) opiera MVP na głosie, Peace Letter, rodzinie i planie dnia. Integracja opasek wróci **później i inaczej**: własne bramki w placówce, nie cloud-to-cloud Polar. Nie projektujemy teraz `ble_devices` / `gateway_keys` / `comfort_metrics`.

## Decyzja

1. **MVP bez ingestu.** DROP tabel `polar_*`, `telemetry_logs`, widoku `family_wearable_comfort`, helpera `family_has_wearable_consent`. Usunięcie Edge `polar-oauth` / `polar-webhook`.
2. **Nie odtwarzamy** `iot_gateways` ani Polar AccessLink. Faza 3 (ekosystem) = własne bramki — nowy ADR wtedy, nie powrót do ADR-007.
3. **`consent_ledger` zostaje** (purpose `wearable_family_access`) jako hak na [SC-FAM-02]; bez UI IoT i bez DTO komfortu. Wpisuje `org_admin`; rodzina nie self-grant.
4. Rola `iot_device` zostaje w enumie (least privilege na przyszłość); w MVP nieużywana.
5. Peace Letter w MVP = wyłącznie głos + Guardrails (ADR-010). Brak enrichment z opaski.
6. Portal rodziny: empty-state karty komfortu („w przygotowaniu”) — rezerwacja miejsca, zero alarmów z metryk.
7. DPA Polar Electro Oy **nie** jest w zakresie MVP (TASK-LEGAL-01: aktualni podprocesorzy).

## Konsekwencje

- REQ-IOT-002 / REQ-IOT-003 / REQ-AI-006 (ścieżka Polar) → SUPERSEDED. REQ-IOT-004 = brak ingestu w MVP.
- Skill `telemetry-context-provider` = DEFERRED do Fazy 3.
- Non-MD Guardrails (zakaz języka klinicznego z opaski) zostają w `ai-prompt-guardrails` na przyszłość.
- Historyczne migracje Polar zostają w git (już zaaplikowane); nowa migracja DROP CASCADE.

## Supersession

- Zastępuje: [ADR-007](007-polar-accesslink.md) (AccessLink), [ADR-009](009-polar-schema-family-consent.md) (schema Polar; `consent_ledger` jako tabela pozostaje).
- Zastąpione przez: —
