---
name: cloudflare-seniorsmart
description: >-
  Cloudflare hosting for Pakiet Spokoju: Next.js via OpenNext (Worker
  smart-senior-web) and legacy Pages project smart-senior. Never Vercel, never
  dfcms. Use when deploying /web, Wrangler, preview URLs, or Pages cutover.
---

# Cloudflare — SeniorSmart

## Before any change

[`MASTER_CONTEXT.md`](../../../docs/MASTER_CONTEXT.md) §3–4, §8.  
Reguła: [`.cursor/rules/cloudflare-seniorsmart.mdc`](../../../.cursor/rules/cloudflare-seniorsmart.mdc).  
**Zakaz Vercel.** Target Next: Worker **`smart-senior-web`**. Legacy static: Pages **`smart-senior`**. Nigdy `dfcms`.

## Ops (substancja)

| Item | Value |
|------|--------|
| Next.js | `/web` + `@opennextjs/cloudflare` |
| Worker | `smart-senior-web` |
| Legacy Pages | `smart-senior` → `https://smart-senior.pages.dev` |
| Git Provider CF | **No** — Wrangler CLI |
| Adapter | OpenNext — **nie** `@cloudflare/next-on-pages` |

```bash
npm run web:dev
# runtime Cloudflare (workerd):
npm run web:preview
# cutover (gdy Ops potwierdzi):
cd web && npm run deploy
# legacy Vanilla:
npm run deploy:legacy
```

Nie uploaduj `.env`. W kliencie tylko anon/publishable key.

| | DFCMS | SeniorSmart |
|--|-------|-------------|
| CF project | `dfcms` | `smart-senior` / `smart-senior-web` |
| Repo | `dfopscms` | `darkov89/smart-senior` |

Po zmianie modelu deploy → MASTER_CONTEXT §10.  
Checklist: [references/deploy-checklist.md](references/deploy-checklist.md)
