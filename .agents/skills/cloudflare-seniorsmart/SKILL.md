---
name: cloudflare-seniorsmart
description: >-
  Cloudflare Pages deploy for Pakiet Spokoju / SeniorSmart — static HTML/Tailwind/Alpine
  hosting, Wrangler CLI deploy, project smart-senior isolation from DFCMS. Use when
  deploying front, editing Pages config, preview URLs, or diagnosing smart-senior.pages.dev.
---

# Cloudflare — SeniorSmart (Pakiet Spokoju)

## Before any change

1. Read **`docs/MASTER_CONTEXT.md`** (§3–4, §8 deploy) and **`SECURITY.md`**.
2. Confirm target project is **`smart-senior`** — **never** deploy this repo to `dfcms` / `dfopscms`.

## Deploy model

| Item | Value |
|------|--------|
| Pages project | `smart-senior` |
| Production URL | `https://smart-senior.pages.dev` |
| Preview | `https://<hash>.smart-senior.pages.dev` |
| Git Provider on CF | currently **No** — deploy via Wrangler CLI |
| Build | none (static) |

```bash
npm run deploy
# or:
npx wrangler pages deploy . --project-name=smart-senior --branch=main
```

Optional: `--commit-dirty=true` if Wrangler warns about uncommitted git changes.

## Hard rules

- **Do not** use `--project-name=dfcms` or `dfopscms`.
- **Do not** upload `.env` — ensure it stays gitignored; Wrangler uploads working tree files that are not ignored by Pages ignore rules. Prefer keeping secrets only in `.env` and never reference them in static assets.
- Frontend may only embed **publishable / anon** Supabase keys if needed later — never service role.

## Separation from DFCMS

| | DFCMS | SeniorSmart |
|--|-------|-------------|
| Pages | `dfcms` | `smart-senior` |
| Domains | `dfcms.pl`, … | `smart-senior.pages.dev` |
| Repo | `dfopscms` | `darkov89/smart-senior` |

## Verification

- Open latest preview URL after deploy.
- Confirm DFCMS URLs still serve DFCMS (unchanged).
- Update **`docs/MASTER_CONTEXT.md`** §10 if deploy model changes (e.g. Git-connected Pages).

## References

- Deploy checklist: [references/deploy-checklist.md](references/deploy-checklist.md)
