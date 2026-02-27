# Contributing to Citadel

Thanks for helping improve Citadel.

## Setup
1. Clone repo
2. Install deps:
   - root: `npm install`
   - host: `cd host && npm install`
3. Run host:
   - `cd host && npm run dev`

## Dev workflow
- Create a branch per change.
- Keep changes scoped and commit in small chunks.
- Add/update docs for user-facing changes.
- For extraction work, follow `EXTRACTION_PLAYBOOK.md`.

## External app workflow
Use CLI:
- `npm run citadel-app -- create "My App" --port 4020`
- `npm run citadel-app -- dev external-apps/my-app`
- `npm run citadel-app -- install external-apps/my-app --url http://localhost:4020`

## PR checklist
- [ ] App/feature works locally
- [ ] No secrets committed
- [ ] README/docs updated if needed
- [ ] Health endpoints respond for new external apps
- [ ] Proxy path tested (`/apps/<id>`)

## Security
- Never commit API keys/secrets.
- Prefer local-first storage.
- Treat permission enforcement as required, not optional.
