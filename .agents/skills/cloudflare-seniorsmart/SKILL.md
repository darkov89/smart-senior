---
name: cloudflare-seniorsmart
description: >-
  Cloudflare hosting for Pakiet Spokoju: Next.js via OpenNext on Pages project
  smart-senior (smart-senior.pages.dev). Never Vercel, never Pages project dfcms.
---

# Cloudflare — SeniorSmart

## Before any change

[`MASTER_CONTEXT.md`](../../../docs/MASTER_CONTEXT.md) §3–4, §8.  
Reguła: [`.cursor/rules/cloudflare-seniorsmart.mdc`](../../../.cursor/rules/cloudflare-seniorsmart.mdc).  
**Zakaz Vercel.** Target Next: Pages **`smart-senior`** → `https://smart-senior.pages.dev`. Nigdy projekt Pages `dfcms`.

## Ops (substancja)

| Item | Value |
|------|--------|
| Next.js | `/web` + `@opennextjs/cloudflare` → `_worker.js` |
| Production | Pages **`smart-senior`** → `https://smart-senior.pages.dev` |
| Git Provider CF | **No** — Wrangler CLI |
| Adapter | OpenNext — **nie** `@cloudflare/next-on-pages` |
| Wycofane | Worker `smart-senior-web` (`*.dfcms.workers.dev`) |

```bash
npm run web:dev
# runtime Cloudflare (workerd):
npm run web:preview
cd web && npm run deploy
```

Nie uploaduj `.env`. W kliencie tylko anon/publishable key. Nie wgrywaj Vanilla (`index.html`) na `smart-senior`.

| | DFCMS | SeniorSmart |
|--|-------|-------------|
| CF project | `dfcms` | `smart-senior` |
| URL | `dfcms.pl` | `https://smart-senior.pages.dev` |
| Repo | `dfopscms` | `darkov89/smart-senior` |

Po zmianie modelu deploy → MASTER_CONTEXT §10.  
Checklist: [references/deploy-checklist.md](references/deploy-checklist.md)
