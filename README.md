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
