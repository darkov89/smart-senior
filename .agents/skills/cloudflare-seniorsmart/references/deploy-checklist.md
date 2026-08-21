# Deploy checklist — SeniorSmart front

1. Working tree: no secrets in staged/public files (`.env` ignored).
2. Next.js: `cd web && npm run deploy` → Pages project **`smart-senior`** (`https://smart-senior.pages.dev`). **Nie Vercel.** **Nie** Worker `smart-senior-web`.
3. Smoke: open `https://smart-senior.pages.dev/logowanie`; `/placowka` bez sesji → `/logowanie`.
4. Confirm Pages project `dfcms` / `dfcms.pl` untouched.
