---
status: ACTIVE
created: 2026-08-13
updated: 2026-08-13
source: HLD 2.3.2 / Silver Care MVP v2
supersedes: ADR-002 (IoT gateway auth + BLE ingest only)
superseded_by: null
confidence: HIGH
---

# ADR-007: Polar AccessLink zamiast własnych bramek BLE

| Pole | Wartość |
|------|---------|
| **Status** | ACTIVE |
| **Data** | 2026-08-13 |
| **Autor** | Architekt Systemu + Agent |

## Kontekst

Własne bramki BLE (`iot_gateways` + Edge `ingest-telemetry`) były wąskim gardłem operacyjnym: token per placówka, ręczny ingest, brak oficjalnego API producenta. Silver Care MVP v2 przechodzi na **cloud-to-cloud Polar AccessLink** (opaski Polar 360).

## Decyzja

1. **Koniec** własnego ingestu bramek: DROP `iot_gateways`; Edge `ingest-telemetry` usunięty z repo.
2. **Zostaje** `telemetry_logs` (legacy BLE). Kanoniczne agregaty Polar: Faza 3 (ADR-009).
3. Integracja Polar (OAuth2 + webhook) — **Faza 4**; tokeny tylko Edge, nie w `polar_connections`.
4. **MDR / non-MD:** sen, HRV, tętno wyłącznie do opisu komfortu i samopoczucia. Zero diagnozy, triage, alarmów klinicznych z opaski.
5. **Nie wycofujemy** z ADR-002: kolumny `daily_logs.is_ai_generated` oraz `approved_by_user_id` (EU AI Act).
6. Dostęp rodziny do agregatów Polar: **ADR-009** — `consent_ledger` + assignment. `telemetry_logs` nadal bez SELECT dla family.

## Konsekwencje

- Token pilotażowy bramki unieważniony wraz z DROP tabeli.
- Historyczne migracje `20260812081000_*` zostają w git (już zaaplikowane).
- REQ-IOT-001 (auth bramki BLE) → SUPERSEDED.
- Skill `telemetry-context-provider` czyta nadal `telemetry_logs` (non-MD) do czasu schematu Polar.
