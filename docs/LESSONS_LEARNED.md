# Lessons Learned (pamięć mięśniowa)

Ten plik to nasza pamięć mięśniowa. Zapisuj tu błędy, z którymi walczyliśmy dłużej niż 15 minut (np. specyficzne bugi Cloudflare, problemy z RLS w Supabase, ograniczenia Alpine.js). Zanim zaczniesz debugować nowy, dziwny problem, zawsze najpierw przeczytaj **aktywnie** wpisy (`status: ACTIVE`).

**Zasady wpisu:** data · symptom · przyczyna · fix · jak unikać. Bez sekretów.  
**Lifecycle (opcjonalny frontmatter lub pola):** `ACTIVE` | `SUPERSEDED` | `DEPRECATED` | `ARCHIVED`.  
**Pewność:** `HIGH` = potwierdzone w prod; `MEDIUM` = raz naprawione; `LOW` = hipoteza.  
Nie używaj LESSONS do nadpisywania HLD/ADR — to operacyjny quirk, nie decyzja architektury.

---

## 2026-08-11 — Deploy DB SeniorSmart: IPv6 + złe hasło Postgres

```yaml
status: ACTIVE
created: 2026-08-11
updated: 2026-08-12
source: LESSONS_LEARNED
supersedes: null
confidence: HIGH
```

| | |
|--|--|
| **Symptom** | `supabase db push` / Management API `database/query` → `28P01 password authentication failed` albo `dial tcp … no route to host` |
| **Przyczyna** | Host `db.<ref>.supabase.co` ma tylko rekord **AAAA** (IPv6); sieć lokalna bez trasy IPv6. Pooler IPv4 łączy się, ale `DATABASE_URL` w `.env` miał **nieaktualne** hasło. |
| **Co zadziałało mimo to** | `functions deploy` + `secrets set` na `SUPABASE_ACCESS_TOKEN` **bez** hasła DB. |
| **Fix** | Reset hasła DB w Dashboard → zaktualizuj `DATABASE_URL` / `SUPABASE_DB_PASSWORD` → `db push` (pooler IPv4 lub sieć z IPv6). |
| **Unikaj** | Zakładania, że Access Token wystarczy do migracji; starego hasła po rotacji; debugowania RLS przed TCP/auth. |

---

<!-- Kolejny wpis powyżej tej linii (najnowsze na górze sekcji wpisów). -->
