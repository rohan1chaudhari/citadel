# Status (living)

## Current version: v0.8 (Phase 1 + Phase 2 complete)

## Platform — Implemented

### Phase 1: Platform Foundations ✅
- Permission approval UI (consent screen on first app launch, per-scope toggle, enforcement in db/storage)
- Network + AI permission enforcement via `app.yaml` manifest
- CSP headers on all `/apps/*` responses (nonce-based, violation reporting endpoint)
- Per-app rate limiting (120 req/min default, scrum-board gets 600)
- Audit logs to DB (`audit_log` table, 90-day retention, dual stdout+DB sink)
- Audit log viewer at `/audit` (filter by app, event, date range; paginated)
- App health dashboard at `/status` (DB size, storage size, activity, warnings)
- Per-app data export (streamed zip via `GET /api/apps/citadel/export/{appId}`)
- Per-app data import (zip upload, backs up before overwriting)
- Scheduled local backups (every 24h on startup, 7-day retention)
- Responsive host shell (hamburger nav, 44px touch targets)
- PWA (manifest.json, service worker, offline page, installable on iOS/Android)
- Dark mode (ThemeContext, localStorage + system default, no-flash script)
- Global search at Cmd+K (app names from registry, extensible per-app search)
- `@citadel/core` npm workspace package (all shared primitives extracted)
- Real YAML parser (replaced hand-rolled regex parser)
- `node:sqlite` stability evaluated — staying with built-in (see DECISIONS.md)
- Vitest integration test suite (DB isolation, traversal, SQL guardrails, audit)

### Phase 2: App Separation ✅
- App package spec documented (`docs/app-spec.md`)
- Dynamic app loading via `CITADEL_APPS_DIR` env var
- Versioned manifests (`manifest_version: "1.0"`) with schema validation
- `citadel-app install <git-url|path>` — clone, validate, migrate
- `citadel-app uninstall <app-id>` — deregister + optional data deletion
- `citadel-app update <app-id>` — git pull, migrate, rollback on failure; `--all` flag
- Formal migration runner (numbered SQL files, `migrations` table, transactions)
- Migration rollback (`citadel-app migrate:rollback --steps=N`)
- `citadel-app create <app-id> --template=<name>` scaffolding
- App templates: blank, crud, ai, dashboard
- Dev mode (`citadel-app dev <path>`) via symlink + Next.js hot-reload
- Build-an-app tutorial (`docs/how-to/build-an-app.md`)
- Pluggable agent runner interface (openclaw, claude-code, script runners)
- Multi-provider LLM support (OpenAI, Anthropic; configurable via settings)

## Apps — Implemented
- Smart Notes: rich-text editor, voice capture (ElevenLabs), photo capture (GPT vision), trash, pin, tags
- Gym Tracker: session logging, exercise library + aliases, voice/photo capture, resume session
- Scrum Board: task management, AI task generation, Vision Suggest, autopilot trigger + live SSE
- French Translator: voice recording → Whisper → FR→EN translation
- Friend Tracker: meetup logging, photo upload, friend registry
- Promo Kit: social post drafting, generate-from-commits
- Soumil Mood Tracker: daily mood score + note
- Task Manager: simple CRUD task manager (example app)

## Known issues / notes
- `node:sqlite` is release candidate (1.2) — no warnings emitted, monitored for v26+ stability
- Autopilot depends on `openclaw` CLI (or configure claude-code/script runner via settings)
- French Translator history is in-memory (resets on page reload) — see app ROADMAP

## Next: Phase 3 — Open Source Ready
See `kb/ROADMAP.md` for details. Key items:
- Dockerfile + docker-compose
- Architecture docs, API reference, deployment guide, contributing guide
- Auth layer (when exposing publicly — Tailscale covers local use)
- First-run setup wizard
- GitHub release workflow + LICENSE
