---
status: SUPERSEDED
created: 2026-08-12
updated: 2026-08-13
source: HLD 2.2.1 / implementacja ingest-telemetry v3
supersedes: null
superseded_by: docs/adr/007-polar-accesslink.md
confidence: HIGH
---

# ADR-002: IoT Gateway Security + EU AI Act columns

| Pole | Wartość |
|------|---------|
| **Status** | SUPERSEDED (IoT gateway) — AI Act columns remain in schema |
| **Data** | 2026-08-12 (amendment 2026-08-13: ADR-007) |
| **Autor** | Head of Ops / Architekt + Agent |

## Kontekst

Trzy luki względem HLD blokowały domknięcie Fazy 2 (telemetria) i compliance AI:

1. **EU AI Act / oversight** — Peace Letter i treści AI wymagały trwałego znakowania (`is_ai_generated`) oraz ścieżki human-in-the-loop (`approved_by_user_id`) w `daily_logs`, nie tylko w promptach.
2. **IoT security** — globalny `TELEMETRY_INGEST_TOKEN` w ENV Edge był jednym sekretem dla wszystkich placówek: wyciek = cross-tenant ingest; rotacja = downtime wszystkich bramek.
3. **TDD Guardrails** — macierz Deno była w fazie Red (`NOT_IMPLEMENTED`), więc Agent-Tester nie mógł bronić CI.

## Decyzja

1. Migracja `20260812080000_add_ai_compliance.sql`: kolumny `is_ai_generated` oraz `approved_by_user_id` na `daily_logs`.
2. Migracja `20260812081000_iot_gateways.sql`: tabela `iot_gateways` + RLS (superadmin ALL; org_admin tylko własna org).
3. `ingest-telemetry`: Bearer → `iot_gateways` → `organization_id`; 403 cross-tenant.
4. `guardrails.test.ts`: zaślepka heurystyczna — Green CI do czasu produkcyjnego Edge Guardrails.

## Konsekwencje

- Per-org token bramki; brak globalnego ENV ingest.
- Peace Letter: schema AI Act gotowa; egzekucja workflow nadal Edge/UI.
- Zaślepka TDD ≠ produkcyjny LLM.
- Seed `iot_gateways` per placówka przed ruchem produkcyjnym bramek.

## Supersession (2026-08-13)

IoT gateway (`iot_gateways`, `ingest-telemetry`) **zastąpione przez [ADR-007](007-polar-accesslink.md)** (Polar AccessLink), następnie **Polar wycofany z MVP** ([ADR-012](012-telemetry-out-of-mvp.md)).  
**Nie wycofujemy:** `daily_logs.is_ai_generated` + `approved_by_user_id` oraz TDD Guardrails.
