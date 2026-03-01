# Citadel — One-Pager

**Local-first personal app hub**: one Next.js host runs multiple isolated apps (Smart Notes, Gym Tracker, etc.) under a single deployment. Apps are standalone installable packages with their own DB, storage, and permissions.

## Architecture

- **Single Next.js host** — control plane + runtime (UI routes + API routes)
- **Same-process runtime** — no containers (isolation is data-layer only)
- **Deny-by-default** — apps declare permissions in `app.yaml`, user approves on first launch
- **Audit** — JSON logs to stdout + queryable `audit_log` table in host DB
- **`@citadel/core`** — shared npm workspace package (db, storage, audit, permissions, migrations, registry)

## Isolation (enforced by host)

| Resource | Rule |
|----------|------|
| Database | One SQLite file per app: `data/apps/<appId>/db.sqlite`. No cross-app queries. |
| Storage | Per-app root: `data/apps/<appId>/`. Traversal (`../`) blocked. |
| Network | Apps must declare `network` or `ai` permission in manifest. Enforced at API route level. |
| SQL API | `dbQuery(appId, sql, params)` — host picks DB, parameterized only. Guardrails block `;`, `ATTACH`, `DETACH`, `PRAGMA`, `VACUUM`. |
| Permissions | Granted permissions stored in `citadel` DB. Enforced on every db/storage call. |

## Repo Layout

```
host/          # Next.js app (routing, auth, permissions, audit)
  src/
    app/       # Pages + API routes
    lib/       # Host-specific libs (backup, rateLimiter, theme, agentRunners, llmProvider)
    components/# Shared UI components
  middleware.ts# CSP headers, rate limiting, session (future auth)
apps/<id>/     # App packages (app.yaml + migrations/ — UI/API routes live in host/)
core/          # @citadel/core workspace package
  src/         # db, storage, audit, permissions, migrations, registry, paths, appIds, sqlGuardrails
templates/     # App starter templates (blank, crud, ai, dashboard)
scripts/       # citadel-app CLI (create, install, uninstall, update, migrate, dev)
data/          # Runtime data (gitignored)
docs/          # VitePress docs site
kb/            # Knowledge base
```

## Apps

| Name | Description | State |
|------|-------------|-------|
| smart-notes | Rich-text notes + voice/photo AI capture | Active |
| gym-tracker | Session-based workout logging + exercise library | Active |
| scrum-board | Task management + autopilot control surface | Active |
| french-translator | Voice FR→EN translation | Active |
| friend-tracker | Social meetup logger | Active |
| promo-kit | Social media post drafting | Active |
| soumil-mood-tracker | Daily mood tracker | Active |
| task-manager | Simple task manager (example app) | Active |

## Platform Features (completed)

- Permission approval UI + enforcement
- CSP headers + per-app rate limiting
- Audit log to DB + viewer UI
- App health dashboard
- Per-app export/import (zip)
- Scheduled local backups (7-day retention)
- Responsive shell + PWA + dark mode + global search (Cmd+K)
- `@citadel/core` npm workspace package
- Formal migration runner (numbered SQL files, transactions, rollback)
- `citadel-app` CLI: create, install, uninstall, update, migrate, dev
- App templates: blank, crud, ai, dashboard
- Pluggable agent runner (openclaw, claude-code, script)
- Multi-provider LLM (OpenAI, Anthropic)
- Integration test suite (vitest)

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
- `node:sqlite` — staying with built-in (release candidate, no native compilation needed)
- Tailscale for network auth (no application-layer auth)
- See `kb/DECISIONS.md` for full log
