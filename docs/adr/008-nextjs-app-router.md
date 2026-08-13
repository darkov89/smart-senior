---
status: ACTIVE
created: 2026-08-13
updated: 2026-08-13
source: HLD 2.3.1 / Silver Care MVP v2
supersedes: HLD 2.2.x frontend Vanilla/Alpine PWA (decision only)
superseded_by: null
confidence: HIGH
---

# ADR-008: Next.js (App Router) zamiast Vanilla JS / Alpine

| Pole | Wartość |
|------|---------|
| **Status** | ACTIVE |
| **Data** | 2026-08-13 |
| **Autor** | Architekt Systemu + Agent |

## Kontekst

Front MVP (HTML + Tailwind CDN + Alpine ESM, Cloudflare Pages bez bundlera) nie uniesie dwóch portali (rodzina mobile-first + admin Big Picture) ani asystenta głosowego. Silver Care MVP v2: **Next.js App Router + React + Tailwind + TypeScript**.

## Decyzja

1. Aplikacja UI żyje w katalogu **`/web`** — `supabase/`, `docs/`, `.cursor/` zostają w korzeniu repo.
2. Do Fazy 2: `index.html` + `src/js/**` to **legacy** — nie rozszerzać; usunięcie razem ze scaffoldem Next.js.
3. Guardrails / treść medyczna **nadal tylko Edge** — przeglądarka nie filtruje kliniki (Secure by Design).
4. Hosting Next.js: **wyłącznie Cloudflare** (`@opennextjs/cloudflare` → Workers Assets). **Zakaz Vercel.** Stary adapter `@cloudflare/next-on-pages` nie wchodzi do stosu. Legacy Pages project `smart-senior` (static Vanilla) zostaje do cutoveru.
5. NFR „offline-first PWA” (HLD A.3 / REQ-NFR-004) do przebudowy przy Next.js — nie udawaj SW w Alpine.
6. Dane medyczne nie są źródłem prawdy na Cloudflare — UI + JWT; Postgres/Auth = Supabase Stockholm (RODO).

## Konsekwencje

- Soczewka `frontend-js.mdc` = legacy (glob `index.html` / `src/js`).
- Soczewka `frontend-next.mdc` = kanon dla `web/**`.
- Faza 2: App Router w `/web` + OpenNext. Deploy: `opennextjs-cloudflare` / `wrangler deploy` z katalogu `web/` — **nie** `wrangler pages deploy` dla Next.js.
- Worker name: `smart-senior-web` (żeby nie kolidować z legacy Pages `smart-senior` do cutoveru).
