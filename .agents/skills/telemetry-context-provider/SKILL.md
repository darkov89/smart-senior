---
name: telemetry-context-provider
description: >-
  DEFERRED (ADR-012). Wearable telemetry is out of MVP. Do not enrich Peace
  Letter from Polar or telemetry_logs. Future ingest = facility-owned hubs
  (new ADR), not Polar AccessLink. Keep non-MD Guardrails if Faza 3 returns.
---

# Telemetry Context Provider — DEFERRED (ADR-012)

**Status:** poza MVP. Polar AccessLink, tabele `polar_*`, `telemetry_logs` i Edge `polar-*` **usunięte**.

Nie ładuj tego skilla przy głosie / Peace Letter w MVP. Peace Letter = wyłącznie transkrypt personelu + Guardrails (`ai-prompt-guardrails`).

Gdy Faza 3 (własne bramki) wystartuje: nowy ADR, nowy model danych — **nie** wracaj do ADR-007. Non-MD: sen/aktywność = komfort; zakaz diagnozy, triage, alarmów z opaski, zakaz „puls 112” w kanale rodziny.

Hak na zgody: `consent_ledger.wearable_family_access` (wpisuje `org_admin`). UI MVP: empty-state „Funkcja inteligentnych wskaźników komfortu jest w przygotowaniu”.
