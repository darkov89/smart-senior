---
status: ACTIVE
created: 2026-08-11
updated: 2026-08-12
source: living-context / AGENT_WORKFLOW
supersedes: null
superseded_by: null
confidence: HIGH
---

# ADR-001: Second Brain (Write-Back Memory)

| Pole | Wartość |
|------|---------|
| **Status** | ACTIVE |
| **Data** | 2026-08-11 |
| **Autor** | Agent + Dariusz (operacyjny rygor agentów) |

## Kontekst

Agenci pisali kod, ale wiedza o decyzjach, stanie systemu i kosztownych debugach rozpraszała się po czatach. Pamięć robocza człowieka była przeciążona; HLD / MASTER_CONTEXT nie wystarczały jako dziennik decyzji punktowych ani „pamięć mięśniowa” incydentów.

## Decyzja

Wprowadzamy warstwę **Second Brain**:
1. `docs/adr/` — Architecture Decision Records (szablon `000-template.md`)
2. Reguła `second-brain-librarian.mdc` — Agent-Archiwista (synteza, nie kod)
3. Write-Back Policy w `living-context.mdc` — przed zamknięciem taska ocena docs + propozycja Librarian
4. `docs/LESSONS_LEARNED.md` — błędy > 15 min, czytane przed nowym dziwnym debugiem

Triada HLD / MASTER_CONTEXT / SECURITY pozostaje źródłem prawdy; ADR i Lessons Learned jej nie zastępują — uzupełniają.

**Rozszerzenie:** cykl życia pamięci, checklist triggerów i selective retrieval — **ADR-003** (Second Brain 2.0).

## Konsekwencje

- Większe taski kończą się syntezą docs, nie tylko diffem kodu
- Kluczowe trade-offy mają numerowany ADR zamiast „architektura-XYZ.md”
- Debug zaczyna się od `LESSONS_LEARNED.md` (mniej powtórzeń IPv6/RLS/Alpine)
- Ryzyko: szum dokumentacyjny — mitygacja: Librarian + lifecycle SUPERSEDED (ADR-003)
