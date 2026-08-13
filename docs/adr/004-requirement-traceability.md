---
status: ACTIVE
created: 2026-08-12
updated: 2026-08-12
source: HLD A.3–F / Second Brain 2.0
supersedes: null
superseded_by: null
confidence: HIGH
---

# ADR-004: Requirement Traceability & Verification

| Pole | Wartość |
|------|---------|
| **Status** | ACTIVE |
| **Data** | 2026-08-12 |
| **Autor** | Head of Ops + Agent |

## Kontekst

Second Brain 2.0 (ADR-003) śledzi decyzje, stan live i lekcje, ale nie odpowiada wprost: *które wymaganie HLD jest zaimplementowane i zweryfikowane?* Łatwo było pomylić „jest w migracji” z „jest VERIFIED”.

## Decyzja

Dodajemy lekką warstwę **Requirement Traceability** w Markdown:

1. Rejestr: `docs/REQUIREMENTS_TRACEABILITY.md` (ID `REQ-{DOMAIN}-NNN`, statusy, evidence).  
2. Integracja z Memory Check / Write-Back (klasa **F** + trigger „tracked requirement”).  
3. Retrieval wąski wg klasy taska (REQ-SEC przy RLS, REQ-AI przy Guardrails, …).  
4. Reguła: **Implementation ≠ verification**; brak fałszywego `VERIFIED`.  
5. Bez DB / vector / nowego agenta.

HLD pozostaje źródłem wymagań; rejestr tylko mapuje ślad.

## Konsekwencje

- Due diligence i agent widzą lukę testów (np. RLS bez E2E = IMPLEMENTED, nie VERIFIED).  
- Krytyczne REQ bez VERIFIED nie mogą być raportowane jako „spełnione”.  
- Seed początkowy jest konserwatywny — wiele NFR/FUNC = NOT_IMPLEMENTED.
