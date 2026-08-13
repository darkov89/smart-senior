---
status: ACTIVE
created: 2026-08-13
updated: 2026-08-13
source: SECURITY.md / secure-by-design / human decision (wariant B)
supersedes: null
superseded_by: null
confidence: HIGH
---

# ADR-005: PII hashing vs clinical content (no hash / no CLE yet)

| Pole | Wartość |
|------|---------|
| **Status** | ACTIVE |
| **Data** | 2026-08-13 |
| **Autor** | Head of Ops + Agent |

## Kontekst

Pojawiła się propozycja „hashowania wszystkich danych PII i medycznych”. Haszowanie treści opieki (`raw_data` / `processed_data`) uniemożliwiłoby pracę personelu i Peace Letter. Jednocześnie PESEL w plaintext byłby nieakceptowalny.

## Decyzja (wariant B)

1. **Identyfikatory** (PESEL i podobne): wyłącznie **SHA-256 + salt** (np. `pesel_hash`); nigdy plaintext w DB/UI/logach/promptach.  
2. **Absolutny zakaz** hashowania treści medycznej i notatek (`raw_data`, `processed_data`, narracja opieki).  
3. Ochrona treści: **RLS**, minimalizacja na froncie, domyślne **at-rest + in-transit** Supabase.  
4. **Brak** application-level column encryption (CLE) na tym etapie.

## Konsekwencje

- Agenci nie proponują „hash notes for security”.  
- Schema nadal trzyma czytelne notatki pod RLS.  
- CLE / field-level encryption = osobna decyzja ADR w przyszłości, jeśli DPIA/wymagania klienta to wymuszą.  
- Polityka: `SECURITY.md` § Critical 11–13; egzekucja agentów: `secure-by-design.mdc` §3.
