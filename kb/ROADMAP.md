# Citadel Platform Roadmap

**Vision:** A local-first, self-hosted app platform where anyone can install, fork, and share personal apps.

**This roadmap covers the platform only.** App-specific backlogs live in each app's folder (`apps/<app-id>/ROADMAP.md`).

---

## Phase 1 — Platform Foundations (Now → v0.5)

Make the host runtime solid, secure, and observable.

### Authentication & Identity
- [ ] Local auth (passphrase or device pairing PIN)
- [ ] Session tokens / cookie-based auth for API routes
- [ ] Optional: WebAuthn / passkey support

### Permissions & Isolation
- [ ] Permission approval UI — prompt user when an app requests new scopes
- [ ] Runtime permission enforcement beyond DB/storage (network, AI API access)
- [ ] App sandboxing (CSP headers, iframe isolation for untrusted apps)
- [ ] Rate limiting per app

### Audit & Observability
- [ ] Persist audit logs to a queryable DB table (currently stdout-only)
- [ ] Audit log viewer in host UI
- [ ] App health dashboard (DB size, storage usage, error rates)

### Data & Backup
- [ ] Export/import per-app data (SQLite dump + storage archive)
- [ ] Scheduled local backups (zip snapshots of `data/`)
- [ ] Optional encrypted sync to cloud (S3, R2, etc.)

### Platform UX
- [ ] Responsive host shell (home grid, nav drawer, layout) for mobile
- [ ] PWA manifest + service worker (Add to Home Screen)
- [ ] Dark mode at the host level (theme context apps can inherit)
- [ ] Global search across apps from home screen

### Tech Debt
- [ ] Move shared logic from `host/src/lib/` into `core/` as proper packages
- [ ] Replace hand-rolled YAML parser with a real one (or switch manifests to JSON)
- [ ] Evaluate `node:sqlite` stability vs migrating to `better-sqlite3`
- [ ] Test coverage — integration tests for host APIs and isolation primitives

---

## Phase 2 — App Separation (v0.5 → v0.8)

Decouple apps from the monorepo so they're independently installable packages.

### App Package Format
- [ ] Define app package spec (manifest, migrations, UI entry point, API routes, assets)
- [ ] Apps ship as standalone repos/packages, not subdirectories of this monorepo
- [ ] Versioned app manifests with schema validation

### Install / Uninstall / Update
- [ ] `citadel-app install <repo-url|path>` — clone, validate manifest, register, run migrations
- [ ] `citadel-app uninstall <app-id>` — deregister + optionally delete data
- [ ] `citadel-app update <app-id>` — pull latest, run migrations, rebuild

### Migration System
- [ ] Formal migration runner (numbered migrations per app, tracked in host DB)
- [ ] Rollback support for failed migrations

### Developer Experience
- [ ] `citadel-app create` scaffolds a fully working app in one command
- [ ] App templates (blank, CRUD, AI-powered, dashboard)
- [ ] Local dev mode — develop an app against a running host with hot-reload
- [ ] App dev documentation (tutorial: build an app from scratch)

### Decouple from openclaw
- [ ] Replace `openclaw` dependency for autopilot with a built-in agent runner (or make it pluggable)
- [ ] Autopilot should work with any LLM provider (OpenAI, Anthropic, local)

---

## Phase 3 — Open Source Ready (v0.8 → v1.0)

Ship something others can clone, self-host, and build on.

### Documentation
- [ ] Architecture overview + security model docs
- [ ] API reference for host primitives (`db`, `storage`, `audit`, `permissions`)
- [ ] Deployment guide (Docker, bare metal, Raspberry Pi)
- [ ] Contributing guide

### Deployment & Distribution
- [ ] Dockerfile + docker-compose for one-command self-hosting
- [ ] Environment variable configuration (ports, data dir, secrets)
- [ ] GitHub release workflow with versioned tags
- [ ] Demo screenshots/video for README
- [ ] LICENSE file + open-source governance

### Polish
- [ ] Error handling and user-facing error pages
- [ ] First-run setup wizard (create passphrase, choose data dir)
- [ ] Host upgrade path (host-level migrations between versions)

---

## Phase 4 — App Marketplace (v1.0+)

Enable a community ecosystem. Only possible because Phase 2 separated apps.

### Registry
- [ ] Public app registry (GitHub-based or hosted) — browse, search, rate
- [ ] `citadel-app search <query>` — discover apps from CLI
- [ ] App submission / review process
- [ ] Showcase gallery of community-built apps

### Isolation v2
- [ ] Optional container-based isolation (Docker per app) for untrusted third-party apps
- [ ] Resource limits (CPU, memory, storage quotas)
- [ ] Network policy per app (outbound allowlist)

### Cross-App Capabilities
- [ ] Secure inter-app communication (message bus / intents)
- [ ] Shared data with explicit user consent
- [ ] Plugin/extension points (home screen widgets, notification hooks)

### Community
- [ ] Fork-and-customize workflow (one-click fork → customize → install)
- [ ] App versioning + changelogs in registry
- [ ] Community templates and starter kits

---

## Non-Goals (for now)
- Multi-tenant SaaS hosting (self-hosted by design)
- Real-time collaboration / multiplayer
- Native mobile apps (PWA is the path)
- Complex RBAC / multi-user permissions (single-user first)

---

## Guiding Principle

Platform first, apps second. Build the runtime that makes every app safe, installable, and deletable — then let the apps flourish.
