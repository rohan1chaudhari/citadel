# citadel

Personal App Hub / App Host monorepo.

## Layout
- `host/` — Next.js “control plane” + app host (routing, auth, permissions, audit)
- `apps/<app_id>/` — app packages (UI + server routes + migrations + manifest)
- `core/` — shared libraries (permissions, isolation, orchestration, audit)
- `data/` — local runtime data (gitignored)

## Core principles
- Local-first: data owned by the user
- Deny-by-default permissions via app manifests
- Isolation: per-app DB schema + per-app storage root
- No direct outbound connectors from apps (MVP)

## Knowledge base
See `kb/PROJECT.md` for project overview + current state.

## Documentation site (VitePress)
- Source: `docs/`
- Local preview:
  ```bash
  npx vitepress dev docs
  ```
- Build:
  ```bash
  npx vitepress build docs
  ```
- Deploy: GitHub Pages via `.github/workflows/docs.yml`
