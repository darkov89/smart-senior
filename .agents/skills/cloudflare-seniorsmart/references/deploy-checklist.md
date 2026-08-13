# Deploy checklist — SeniorSmart front

1. Working tree: no secrets in staged/public files (`.env` ignored).
2. Next.js cutover: Worker `smart-senior-web` via `cd web && npm run deploy` (OpenNext). **Nie Vercel.**
3. Legacy Vanilla: `--project-name=smart-senior` only (`npm run deploy:legacy`).
4. Smoke: open preview URL, check console for CSP/network errors.
5. Confirm `dfcms` / `dfcms.pl` untouched.
