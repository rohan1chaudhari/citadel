# Contributing to Citadel

Thanks for helping improve Citadel.

## Setup

```bash
git clone https://github.com/rohan1chaudhari/citadel.git
cd citadel
npm install
cd host && npm run dev   # http://localhost:3000
```

## Codebase

```
host/       — Next.js host shell (routing, permissions, audit)
core/       — @citadel/core shared library (db, storage, audit, permissions, migrations)
apps/       — App packages (manifest + migrations)
templates/  — App starter templates (blank, crud, ai, dashboard)
scripts/    — citadel-app CLI
docs/       — VitePress documentation site
```

- **Platform changes** go in `host/` or `core/`.
- **App changes** go in `apps/<app-id>/` and `host/src/app/apps/<app-id>/`.
- **New apps** should be created via `node scripts/citadel-app.mjs create <app-id>`.

## Dev workflow

- Create a branch per change.
- Keep changes scoped and commit in small chunks.
- Run `npm test` in `host/` before submitting.
- Add/update docs for user-facing changes.

## PR checklist

- [ ] App/feature works locally (`npm run dev`)
- [ ] `npm run build` passes in `host/`
- [ ] Tests pass (`npm test` in `host/`)
- [ ] No secrets committed (check `.env*` files)
- [ ] README/docs updated if needed

## Security

- Never commit API keys or secrets.
- Prefer local-first storage.
- Treat permission enforcement as required, not optional.
- See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.
