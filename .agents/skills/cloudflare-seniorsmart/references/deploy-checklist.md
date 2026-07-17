# Deploy checklist — SeniorSmart front

1. Working tree: no secrets in staged/public files (`.env` ignored).
2. Target: `--project-name=smart-senior` only.
3. Run: `npm run deploy` or `wrangler pages deploy . --project-name=smart-senior`.
4. Smoke: open preview URL, check console for CSP/network errors.
5. Confirm `dfcms` / `dfcms.pl` untouched (`wrangler pages project list`).
