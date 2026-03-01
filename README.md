# Citadel

A local-first, self-hosted personal app hub. One Next.js host runs multiple isolated apps — each with its own SQLite DB, storage, and permissions.

## Layout

```
host/         — Next.js host shell (routing, permissions, audit, registry)
apps/         — Installed app packages (manifest + migrations + UI + API)
core/         — @citadel/core shared library (db, storage, audit, permissions, migrations, registry)
templates/    — App starter templates (blank, crud, ai, dashboard)
scripts/      — citadel-app CLI
data/         — Runtime data (gitignored)
docs/         — VitePress documentation site
kb/           — Knowledge base
```

## Core principles

- **Local-first** — all data stays on your machine
- **Deny-by-default permissions** — apps declare scopes in `app.yaml`, user approves on first launch
- **Isolation** — per-app SQLite DB + per-app storage root, no cross-app access
- **Installable apps** — apps are standalone packages; install, update, and remove via CLI

## Platform features

- Permission approval UI with per-scope consent
- Audit log (DB-backed, queryable, with viewer UI at `/audit`)
- App health dashboard at `/status` (DB size, storage, activity)
- Per-app data export/import (zip archives)
- Scheduled local backups (7-day retention)
- Responsive shell + PWA (installable on iOS/Android)
- Dark mode with ThemeContext for apps
- Global search (Cmd/Ctrl+K)
- CSP headers + per-app rate limiting
- Pluggable agent runner (openclaw, claude-code, custom script)
- Multi-provider LLM support (OpenAI, Anthropic)
- Autopilot — AI agent that picks up scrum-board tasks and implements them

## Apps

| App | Description |
|-----|-------------|
| smart-notes | Rich-text notes with voice + photo capture (ElevenLabs STT, GPT vision) |
| gym-tracker | Session-based workout logger with exercise library |
| scrum-board | Task management + autopilot control surface for all apps |
| french-translator | Real-time French → English voice translation |
| friend-tracker | Social meetup logger with friend registry |
| promo-kit | Social media post drafting (Twitter/LinkedIn) |
| soumil-mood-tracker | Daily mood score tracker |

## Quick start

```bash
cd host/
npm install
npm run dev   # http://localhost:3000
```

## CLI

```bash
# Create a new app from a template
node scripts/citadel-app.mjs create my-app --template=crud

# Install an app from a git repo
node scripts/citadel-app.mjs install https://github.com/you/my-app

# Develop an app with hot-reload
node scripts/citadel-app.mjs dev ./path/to/my-app

# Update an installed app
node scripts/citadel-app.mjs update my-app

# Run migrations for an app
node scripts/citadel-app.mjs migrate my-app
```

## Documentation

- **Docs site:** `docs/` (VitePress, deployed to GitHub Pages)
- **App spec:** `docs/app-spec.md`
- **Build an app tutorial:** `docs/how-to/build-an-app.md`
- **Agent runner guide:** `docs/agent-runner-guide.md`
- **Roadmap:** `kb/ROADMAP.md`
- **Knowledge base:** `kb/PROJECT.md`

```bash
npx vitepress dev docs    # local preview
npx vitepress build docs  # production build
```

## Network / Auth

Citadel is designed to run on a private network (Tailscale recommended). No application-layer auth is implemented — network access = trust.
