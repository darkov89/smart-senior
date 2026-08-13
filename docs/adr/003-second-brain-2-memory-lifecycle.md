---
status: ACTIVE
created: 2026-08-12
updated: 2026-08-12
source: AGENT_WORKFLOW / second-brain-librarian 2.0
supersedes: null
superseded_by: null
confidence: HIGH
---

# ADR-003: Second Brain 2.0 — Memory Lifecycle & Selective Retrieval

| Pole | Wartość |
|------|---------|
| **Status** | ACTIVE |
| **Data** | 2026-08-12 |
| **Autor** | Head of Ops + Agent |

## Kontekst

ADR-001 wprowadził Write-Back, ale agent nadal polegał na ogólniku „czy zmienił się kontekst?”. Brakowało: cyklu życia wpisów, deterministycznej checklisty, reguły *retrieve narrowly*, protokołu sprzeczności. Ryzyko: albo zero docs, albo ładowanie całego Second Brain do każdego taska UI.

## Decyzja

Rozszerzamy Second Brain (bez multi-agent, bez vector DB, bez nowego pliku „architektura”):

1. **Lifecycle** na ADR (i opcjonalnie LESSONS): `ACTIVE | PROPOSED | SUPERSEDED | DEPRECATED | ARCHIVED` + `confidence` + `source` / `supersedes`.
2. **Memory Check** w `second-brain-librarian.mdc` z checklistą triggerów → klasy A–E.
3. **Selective retrieval** w `AGENT_WORKFLOW.md` — tylko §/ADR/LESSON właściwe klasie taska.
4. **Contradiction Protocol** — sprzeczność widoczna; autorytet zdefiniowany; HITL na hard gate.
5. `living-context` wskazuje retrieval + checklist zamiast samego ogólnika Write-Back.

ADR-001 pozostaje **ACTIVE** (fundament); ten ADR go **uszczegóławia**, nie unieważnia.

## Konsekwencje

- Normalny task UI = brak Write-Back, mały footprint kontekstu.
- Schema/auth/IoT/AI = Memory Check obowiązkowy.
- Stale fakty mają status, nie znikają po cichu i nie sterują implementacją.
- Librarian nie „sprząta wszystkiego zawsze” — tylko triggery.
