---
status: ACTIVE
created: 2026-08-13
updated: 2026-08-18
source: HLD 2.4.0 / Silver Care MVP v2 Faza 5 (brief Punkt 6)
supersedes: null
superseded_by: null
confidence: HIGH
---

# ADR-010: Conversational Voice AI + Guardrails (godność / klinika)

| Pole | Wartość |
|------|---------|
| **Status** | ACTIVE |
| **Data** | 2026-08-13 |
| **Autor** | Architekt Systemu + Agent |

## Kontekst

MVP Punkt 6 wymaga odejścia od jednorazowego dyktowania do **aktywnego asystenta**. Krótka transkrypcja nie może od razu stać się Peace Letter. Żargon kliniczny i detale naruszające godność nie mogą trafić do rodziny. Kilka głosówek z dnia trzeba scalić wieczorem.

## Decyzja

1. **Stan rozmowy w DB** — `voice_conversations` + `voice_conversation_turns` + `voice_draft_notes`. Peace Letter (`daily_logs.processed_data`) **dopiero** po wieczornym merge i `approved_by_user_id`.
2. **Interactive prompting** — jeśli brakuje kontekstu (mood / meal / sleep / activity) albo transkrypt jest zbyt krótki, LLM zwraca `mode: follow_up` i pytanie do personelu. Nie emituje końcowego raportu.
3. **Separacja kliniki** — żargon (np. arytmia, furosemid) → `staff_internal_notes` / `raw_data`. **Nigdy** Peace Letter ani `family_safe_partial`. Opcja org: `clinical_handling = redact` vs `staff_internal`.
4. **Godność** — detale drastyczne / inkontynencja generalizować do „dyskomfortu” lub „gorszego samopoczucia”. System Prompt cytuje obowiązek poszanowania godności (Ustawa o pomocy społecznej).
5. **Merge** — planowany Edge CRON `merge-daily-peace-letters` (wieczór, Europe/Warsaw): zbiera drafty `ready_to_merge` per `(patient_id, local_date)` → jeden Peace Letter + `is_ai_generated`.
6. **Family** — brak SELECT na draftach / turach / rozmowach. Transkryptów **nie haszować** (ADR-005).
7. Kontrakt JSON i System Prompt: `.cursor/rules/ai-prompt-guardrails.mdc`. Testy: `guardrails.test.ts`.
8. **Zero-Guessing Entity Resolution** — `patient_id` wyłącznie z POST (karta seniora w UI). LLM nie mapuje tożsamości z transkryptu. Edge wiąże INSERT z `patient_id` z żądania.

## Konsekwencje

- Whisper/GPT Edge nadal **nie** jest produkcyjnym pipeline — schema + kontrakt + stub TDD.
- REQ-FUNC-001 pozostaje NOT_IMPLEMENTED (brak Whisper/GPT). REQ-AI-007 / REQ-AI-008 / REQ-FUNC-002: schema IMPLEMENTED, nie VERIFIED.
- Wieczorny CRON nie jest w tej migracji — dokumentacja HLD §B.2 / MASTER §7.
