# Pakiet Spokoju — front Next.js (`/web`)

App Router + Tailwind + TypeScript. Hosting: **Cloudflare** przez `@opennextjs/cloudflare` (ADR-008). **Nie Vercel.**

## Portale

| Ścieżka | Dla kogo |
|---------|----------|
| `/rodzina` | Rodzina — mobile-first |
| `/rodzina/podopieczny/[patientId]` | Relacja z dnia o bliskiej osobie |
| `/placowka` | Personel — podgląd dnia (Big Picture) |
| `/placowka/uprawnienia` | Kto ma dostęp |

Guardrails i treść kliniczna zostają na Supabase Edge — ten katalog to UI + JWT.

## Lokalnie

```bash
cp ../.env.example .env.local   # uzupełnij NEXT_PUBLIC_SUPABASE_*
npm run dev
```

Podgląd w runtime Cloudflare (`workerd`):

```bash
npm run preview
```

Deploy (gdy Ops potwierdzi cutover): `npm run deploy` → Worker `smart-senior-web`. Legacy Pages `smart-senior` (Vanilla) zostaje do wyłączenia.
