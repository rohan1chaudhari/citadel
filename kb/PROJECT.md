# Citadel — One-Pager

**Local-first personal app hub**: one Next.js host runs multiple isolated apps (Smart Notes, Gym Tracker, etc.) under a single deployment.

## Architecture
- **Single Next.js host** — control plane + runtime (UI routes + API routes)
- **Same-process runtime** — no containers yet
- **Deny-by-default** — apps declare permissions in `app.yaml`, user approves
- **Audit** — JSON logs to stdout

## Isolation (enforced by host)
| Resource | Rule |
|----------|------|
| Database | One SQLite file per app: `data/apps/<appId>/db.sqlite`. No cross-app queries. |
| Storage | Per-app root: `data/apps/<appId>/`. Traversal (`../`) blocked. |
| Network | No direct outbound calls (MVP). |
| SQL API | `db.query(appId, sql, params)` — host picks DB, parameterized only. Guardrails block `;`, `ATTACH`, `DETACH`, `PRAGMA`, `VACUUM`. |

## Repo Layout
```
host/          # Next.js app (routing, auth, permissions, audit)
apps/<id>/     # App packages (UI + server routes + migrations + app.yaml)
core/          # Shared libs (permissions, isolation, orchestration, audit)
data/          # Runtime data (gitignored)
kb/            # Knowledge base
```

## Apps + Host
| Name | Type | UI | API | State |
|------|------|----|-----|-------|
| smart-notes | App | `/apps/smart-notes` | `/api/apps/smart-notes/notes` | MVP |
| gym-tracker | App | `/apps/gym-tracker` | `/api/apps/gym-tracker/entries` | MVP 2 |
| scrum-board | App | `/apps/scrum-board` | — | Ready |
| soumil-mood-tracker | App | `/apps/soumil-mood-tracker` | — | Ready |
| promo-kit | App | `/apps/promo-kit` | — | Draft |
| citadel | Host | — | `/api/*` | Control plane (routing, auth, permissions, audit, registry) |

## Run Locally
```bash
cd host/
npm install
npm run dev   # http://localhost:3000
```

## Key Decisions
- One Next.js app (not separate per-module)
- SQLite per-app (not shared DB with schemas)
- Tailwind CSS for UI
- `node:sqlite` is experimental (expected warning)
