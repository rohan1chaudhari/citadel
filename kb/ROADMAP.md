# Citadel Platform Roadmap

**Vision:** A local-first, self-hosted app platform where anyone can install, fork, and share personal apps.

**This roadmap covers the platform only.** App-specific backlogs live in each app's folder (`apps/<app-id>/ROADMAP.md`).

---

## Phase 1 — Platform Foundations ✅ COMPLETE (v0.5)

Make the host runtime solid, secure, and observable.

> **Auth note:** Network-level auth is handled by Tailscale. No application-layer auth needed until the host is exposed publicly (Phase 3).

### Permissions & Isolation

#### P1-01: Permission approval UI
**Description:** When an app's `app.yaml` declares permissions (db read/write, storage read/write, network, ai), show the user an approval prompt on first launch. Store granted permissions in the host DB. Block app API calls that exceed granted permissions.
**Acceptance Criteria:**
- [x] First visit to an app shows a permission consent screen listing requested scopes
- [x] User can approve or deny each scope individually
- [x] Granted permissions stored in `citadel` DB (`app_permissions` table)
- [x] `dbQuery`/`dbExec` check granted permissions before executing
- [x] `storageWriteBuffer`/`storageReadText` check granted permissions
- [x] Denied permission returns 403 with clear error message
- [x] "Manage permissions" page in host settings to revoke/grant per app

#### P1-02: Network and AI API permission enforcement
**Description:** Extend the permission system beyond DB/storage. Apps that want to call external APIs (e.g., OpenAI, ElevenLabs) must declare `ai: true` or `network: [domains]` in their manifest. The host must proxy or gate these calls.
**Acceptance Criteria:**
- [x] `app.yaml` schema supports `ai: true/false` and `network: [list of allowed domains]`
- [x] Apps without `ai: true` cannot call AI API routes
- [x] Apps without `network` permission get blocked outbound (enforced at API route level in MVP)
- [x] Permission violations logged via audit

#### P1-03: CSP headers and app sandboxing
**Description:** Add Content-Security-Policy headers to app pages to prevent XSS and limit what app code can do in the browser. Each app's pages should have restrictive CSP that only allows loading resources from the host origin.
**Acceptance Criteria:**
- [x] Next.js middleware sets CSP headers on all `/apps/*` responses
- [x] `script-src 'self'` — no inline scripts except nonce-based
- [x] `connect-src 'self'` — apps can only fetch from the host
- [x] `frame-ancestors 'none'` — prevents clickjacking
- [x] CSP violations reported to a host endpoint for logging

#### P1-04: Per-app rate limiting
**Description:** Prevent a misbehaving app (or runaway autopilot) from hammering the host. Add a simple in-memory rate limiter (token bucket) keyed by app ID that limits API requests per minute.
**Acceptance Criteria:**
- [x] Rate limiter middleware applied to all `/api/apps/*` routes
- [x] Default limit: 120 requests/minute per app (configurable)
- [x] Returns 429 with `Retry-After` header when exceeded
- [x] Rate limit state resets on host restart (in-memory is fine for MVP)
- [x] Scrum-board/autopilot exempt or has higher limit

---

### Audit & Observability

#### P1-05: Persist audit logs to DB
**Description:** Currently `audit()` logs JSON to stdout. Add a second sink that writes to an `audit_log` table in the `citadel` DB. Keep stdout logging as-is for dev/debugging. Include retention — auto-delete logs older than 90 days.
**Acceptance Criteria:**
- [x] `audit_log` table in `citadel` DB with columns: id, ts, app_id, event, payload (JSON), created_at
- [x] `audit()` function writes to both stdout and DB
- [x] Index on (app_id, ts) for efficient querying
- [x] Auto-cleanup: logs older than 90 days deleted on host startup
- [x] No performance regression on hot paths (batch inserts or async write)

#### P1-06: Audit log viewer UI
**Description:** Add a host-level page at `/audit` that displays audit logs with filtering by app, event type, and time range. Paginated, most recent first.
**Acceptance Criteria:**
- [x] Page at `/audit` accessible from host nav
- [x] Filter by app_id (dropdown of installed apps)
- [x] Filter by event type (db.query, db.exec, storage.write, etc.)
- [x] Filter by date range
- [x] Paginated results (50 per page)
- [x] Each log entry shows timestamp, app, event, and expandable payload

#### P1-07: App health dashboard
**Description:** Add a host-level page at `/status` (enhance existing) that shows per-app health metrics: SQLite DB file size, storage directory size, total API calls (from audit), and last activity timestamp.
**Acceptance Criteria:**
- [x] `/status` page shows a card per installed app
- [x] Each card displays: DB file size (bytes), storage dir size, total audit events (last 24h), last activity time
- [x] Refreshes on page load (server-rendered, no polling needed for MVP)
- [x] Warning indicators for apps with large DB (>100MB) or storage (>1GB)

---

### Data & Backup

#### P1-08: Per-app data export
**Description:** Add an API endpoint and UI button to export a single app's data as a zip archive containing its SQLite DB file and storage directory. Useful for backup and portability.
**Acceptance Criteria:**
- [x] `GET /api/apps/{appId}/export` returns a zip file
- [x] Zip contains `db.sqlite` and all files under the app's storage root
- [x] Export button visible on each app's settings or the host status page
- [x] Filename includes app ID and ISO timestamp: `smart-notes-2026-03-01T12-00-00.zip`
- [x] Streams the zip (doesn't buffer entire archive in memory)

#### P1-09: Per-app data import
**Description:** Add an API endpoint and UI to restore an app's data from a previously exported zip. Overwrites existing DB and storage. Requires confirmation.
**Acceptance Criteria:**
- [x] `POST /api/apps/{appId}/import` accepts a zip upload
- [x] Validates zip structure (must contain `db.sqlite` at minimum)
- [x] Backs up current data before overwriting (moves to `data/backups/{appId}/{timestamp}/`)
- [x] Confirmation dialog warns that current data will be replaced
- [x] App's cached DB connection is invalidated after import

#### P1-10: Scheduled local backups
**Description:** On host startup and then every 24 hours, snapshot all app data directories into a timestamped zip under `data/backups/`. Keep the last 7 backups, delete older ones.
**Acceptance Criteria:**
- [x] Backup runs on host startup and every 24h (setInterval or cron-like)
- [x] Creates `data/backups/citadel-backup-{ISO-timestamp}.zip`
- [x] Includes all `data/apps/*/` directories
- [x] Retains last 7 backups, deletes oldest when limit exceeded
- [x] Backup status visible on `/status` page (last backup time, size)

---

### Platform UX

#### P1-11: Responsive host shell
**Description:** Make the home grid, navigation drawer, and root layout responsive for mobile screens. The nav drawer should collapse to a hamburger menu on small screens. App grid should reflow from multi-column to single-column.
**Acceptance Criteria:**
- [x] Home grid: 1 column on mobile (<640px), 2 on tablet, 3 on desktop
- [x] Nav drawer: collapses to hamburger menu on mobile, slide-out overlay
- [x] Root layout: removes excess padding on mobile, uses full width
- [x] Touch targets are at least 44x44px
- [x] Tested on iPhone SE (375px) and iPad (768px) viewports

#### P1-12: PWA manifest and service worker
**Description:** Add a web app manifest and basic service worker so Citadel can be "installed" to the home screen on iOS and Android. Cache the app shell for fast loads.
**Acceptance Criteria:**
- [x] `manifest.json` with name, icons (192px, 512px), theme color, display: standalone
- [x] Service worker caches the Next.js app shell (HTML, CSS, JS bundles)
- [x] "Add to Home Screen" works on iOS Safari and Android Chrome
- [x] App launches in standalone mode (no browser chrome)
- [x] Offline: shows cached shell with "you're offline" message if network unavailable

#### P1-13: Dark mode
**Description:** Add a dark mode toggle to the host shell. Use Tailwind's `dark:` variant. Store preference in localStorage. Provide a theme context that apps can read to match the host theme.
**Acceptance Criteria:**
- [x] Toggle in nav drawer or host header (sun/moon icon)
- [x] Preference persisted in localStorage, defaults to system preference
- [x] Host shell (nav, home grid, status pages) fully styled for dark mode
- [x] `ThemeContext` exported from host so apps can read `isDark`
- [x] No flash of wrong theme on page load (script in `<head>` sets class early)

#### P1-14: Global search
**Description:** Add a search bar to the home page that searches across all apps. Each app can register a search provider (a function that takes a query and returns results). MVP: search app names from the registry. Later: apps provide full-text search endpoints.
**Acceptance Criteria:**
- [x] Search input on home page (with keyboard shortcut Cmd/Ctrl+K)
- [x] Searches app names and descriptions from registry (instant, client-side)
- [x] Results link to the matching app
- [x] Extensible: apps can register a `/api/apps/{appId}/search?q=` endpoint
- [x] If an app has a search endpoint, results from that app appear in global search

---

### Tech Debt

#### P1-15: Extract core packages from host/src/lib
**Description:** Move the shared platform primitives (`db.ts`, `audit.ts`, `storage.ts`, `sqlGuardrails.ts`, `paths.ts`, `appIds.ts`, `registry.ts`) into the `core/` directory as proper npm workspace packages. Apps and host import from `@citadel/core` instead of relative paths.
**Acceptance Criteria:**
- [x] `core/` is an npm workspace package with `package.json` (`@citadel/core`)
- [x] All shared primitives moved from `host/src/lib/` to `core/src/`
- [x] Host imports from `@citadel/core` via workspace resolution
- [x] All existing functionality unchanged (no regressions)
- [x] `npm run build` passes in both `core/` and `host/`

#### P1-16: Replace hand-rolled YAML parser
**Description:** The registry uses a regex-based YAML parser that only handles scalar values. Replace it with a proper YAML library (e.g., `yaml` npm package) or switch `app.yaml` to `app.json` for zero-dependency parsing.
**Acceptance Criteria:**
- [x] App manifests are parsed correctly including nested objects, arrays, and multi-line strings
- [x] All existing `app.yaml` files parse without changes
- [x] Manifest schema validated at parse time (required fields: id, name, version, permissions)
- [x] Invalid manifests produce clear error messages with file path and line number

#### P1-17: Evaluate node:sqlite stability
**Description:** Research whether `node:sqlite` has stabilized in the current Node.js version. If still experimental, evaluate migrating to `better-sqlite3`. Document the decision and rationale.
**Acceptance Criteria:**
- [x] Written assessment in `kb/DECISIONS.md` covering: current stability status, breaking change risk, performance comparison, migration effort
- [x] If migrating: `better-sqlite3` replaces `node:sqlite` in `db.ts`, all tests pass
- [x] If staying: document why and what Node.js version stabilizes the API
- [x] No runtime warnings about experimental APIs (either suppressed intentionally or eliminated)

#### P1-18: Integration tests for host APIs and isolation
**Description:** Add a test suite that validates the host's core guarantees: per-app DB isolation, storage path traversal protection, SQL guardrails, and permission enforcement. Use Node.js test runner or vitest.
**Acceptance Criteria:**
- [x] Test: app A cannot read app B's database
- [x] Test: storage path traversal (`../`) is blocked
- [x] Test: SQL guardrails block `ATTACH`, `DETACH`, `PRAGMA`, `VACUUM`, multi-statement
- [x] Test: `assertAppId` rejects invalid app IDs
- [x] Test: audit events are emitted for DB and storage operations
- [x] Tests run via `npm test` in `host/`
- [x] CI-ready (no external dependencies, no running server needed)

---

## Phase 2 — App Separation ✅ COMPLETE (v0.8)

Decouple apps from the monorepo so they're independently installable packages.

### App Package Format

#### P2-01: Define the app package spec
**Description:** Design and document the canonical structure of a Citadel app package. This is the contract between app developers and the host. It defines what files an app must/can contain and how the host discovers and loads them.
**Acceptance Criteria:**
- [x] Spec document at `docs/app-spec.md` covering: manifest format, directory structure, migration convention, UI entry point, API route convention, asset handling
- [x] Manifest schema formally defined (JSON Schema or TypeScript type)
- [x] Required fields: `id`, `name`, `version`, `permissions`
- [x] Optional fields: `description`, `icon`, `author`, `homepage`, `dependencies`
- [x] Example app package in `docs/examples/` that conforms to the spec

#### P2-02: Dynamic app loading from external directories
**Description:** Currently apps are hardcoded as subdirectories under `host/src/app/apps/`. Modify the host to discover and load apps from an external `apps/` directory (or configurable path). App UI and API routes are dynamically registered at startup.
**Acceptance Criteria:**
- [x] Host reads app directories from a configurable path (`$CITADEL_APPS_DIR` or `../apps/`)
- [x] App UI pages are served under `/apps/{appId}/*`
- [x] App API routes are served under `/api/apps/{appId}/*`
- [x] Adding a new app directory and restarting the host registers it automatically
- [x] Removing an app directory deregisters it (data preserved in `data/apps/`)
- [x] Existing monorepo apps continue to work during migration

#### P2-03: Versioned app manifests with schema validation
**Description:** Add a `manifest_version` field to `app.yaml`/`app.json` and validate all manifests against their declared schema version at registration time. This allows evolving the manifest format without breaking older apps.
**Acceptance Criteria:**
- [x] `manifest_version: 1` added to all existing app manifests
- [x] Validation function checks manifest against schema for its declared version
- [x] Unknown manifest versions produce a clear error (not silently ignored)
- [x] Schema versions are documented with changelogs

---

### Install / Uninstall / Update

#### P2-04: `citadel-app install`
**Description:** CLI command that installs an app from a git repo URL or local path. Clones the repo (or copies the directory), validates the manifest, registers the app in the host, and runs any migrations.
**Acceptance Criteria:**
- [x] `citadel-app install <git-url>` clones repo into apps directory
- [x] `citadel-app install <local-path>` copies or symlinks app directory
- [x] Validates manifest (id, name, version, permissions) before registering
- [x] Rejects if app ID conflicts with an existing app
- [x] Runs app migrations (if any) after install
- [x] Prints success message with app URL

#### P2-05: `citadel-app uninstall`
**Description:** CLI command that removes an installed app. Deregisters it from the host. Optionally deletes the app's data directory (with confirmation).
**Acceptance Criteria:**
- [x] `citadel-app uninstall <app-id>` removes app from apps directory
- [x] Prompts "Delete app data? (y/N)" — default keeps data
- [x] `--delete-data` flag skips the prompt and deletes data
- [x] Cannot uninstall `citadel` (the host itself) or `scrum-board` (meta-app)
- [x] Prints confirmation of what was removed

#### P2-06: `citadel-app update`
**Description:** CLI command that updates an installed app to the latest version. Pulls latest from git (if git-installed), validates manifest, runs new migrations.
**Acceptance Criteria:**
- [x] `citadel-app update <app-id>` runs `git pull` in the app directory
- [x] Validates updated manifest
- [x] Runs any new migrations (compares current version vs new version)
- [x] Rolls back on migration failure (restores previous app directory)
- [x] `citadel-app update --all` updates all git-installed apps

---

### Migration System

#### P2-07: Formal migration runner
**Description:** Replace the current ad-hoc schema initialization (`ensureSmartNotesSchema`, etc.) with a proper migration system. Each app has a `migrations/` directory with numbered SQL files. The host tracks which migrations have run per app in a `migrations` table in the host DB.
**Acceptance Criteria:**
- [x] Apps place migration files in `migrations/001_initial.sql`, `migrations/002_add_tags.sql`, etc.
- [x] Host `citadel` DB has a `migrations` table: app_id, migration_name, applied_at
- [x] On app startup, host runs any unapplied migrations in order
- [x] Each migration runs in a transaction (rolls back on error)
- [x] Existing apps migrated to use this system (initial schema becomes `001_initial.sql`)
- [x] `citadel-app migrate <app-id>` CLI command to manually trigger migrations

#### P2-08: Migration rollback support
**Description:** Each migration can have an optional `down` file (e.g., `001_initial.down.sql`). The host can roll back the last N migrations for an app.
**Acceptance Criteria:**
- [x] Down migrations stored alongside up migrations: `001_initial.down.sql`
- [x] `citadel-app migrate:rollback <app-id>` rolls back the last applied migration
- [x] `citadel-app migrate:rollback <app-id> --steps=3` rolls back N migrations
- [x] Rollback updates the `migrations` table (removes rolled-back entries)
- [x] Rollback runs in a transaction

---

### Developer Experience

#### P2-09: `citadel-app create` scaffolding
**Description:** CLI command that creates a new app from a template. Generates the directory structure, manifest, initial migration, and placeholder UI/API files. Gets a developer from zero to a running app in one command.
**Acceptance Criteria:**
- [x] `citadel-app create <app-id>` generates a complete app directory
- [x] Generated files: `app.yaml`, `migrations/001_initial.sql`, `page.tsx`, `route.ts`, `README.md`
- [x] `--template=<name>` flag selects a template (default: `blank`)
- [x] App ID validated (lowercase, alphanumeric + hyphens, 1-64 chars)
- [x] Created app is immediately usable: install + start host → see the app

#### P2-10: App templates
**Description:** Provide a set of starter templates for common app types. Templates are directories under `templates/` in the Citadel repo (or fetched from a registry later).
**Acceptance Criteria:**
- [x] `blank` template: empty app with manifest, one page, one API route
- [x] `crud` template: list/create/edit/delete with SQLite table
- [x] `ai` template: app with AI API integration (chat or structured output)
- [x] `dashboard` template: read-only data display with charts placeholder
- [x] Each template includes a README explaining the structure

#### P2-11: Local dev mode
**Description:** Allow developers to work on an app with hot-reload against a running host. The app directory is symlinked or watched, and changes are reflected without restarting the host.
**Acceptance Criteria:**
- [x] `citadel-app dev <path-to-app>` starts watching the app directory
- [x] File changes in the app trigger a Next.js hot-reload
- [x] App's API routes hot-reload without host restart
- [x] Dev mode shows clear error overlay for app-level errors
- [x] Works with `npm run dev` in the host (standard Next.js dev server)

#### P2-12: App development tutorial
**Description:** Write a step-by-step tutorial in the VitePress docs site that walks a developer through building a complete app from scratch — from `citadel-app create` to a working CRUD app with DB, API, and UI.
**Acceptance Criteria:**
- [x] Tutorial at `docs/how-to/build-an-app.md`
- [x] Covers: create app, define manifest, write migration, build API route, build UI page
- [x] Includes code snippets that can be copy-pasted
- [x] Links to API reference for host primitives
- [x] Tested: following the tutorial produces a working app

---

### Decouple from openclaw

#### P2-13: Pluggable agent runner
**Description:** Replace the hard dependency on `openclaw` CLI for autopilot with an abstraction layer. The host should define an `AgentRunner` interface, and `openclaw` becomes one implementation. Users can swap in other runners (e.g., Claude Code, custom scripts).
**Acceptance Criteria:**
- [x] `AgentRunner` interface defined: `spawn(task, config) → session`
- [x] OpenClaw runner implements the interface (preserves current behavior)
- [x] Config in host settings: `agent_runner: "openclaw" | "claude-code" | "script"`
- [x] `triggerAutopilot.ts` uses the runner interface, not `openclaw` directly
- [x] Documentation for implementing a custom runner

#### P2-14: Multi-provider LLM support for autopilot
**Description:** The autopilot's AI features (task generation, vision suggest) currently hardcode OpenAI models. Make the LLM provider configurable so users can use Anthropic, local models (Ollama), or other providers.
**Acceptance Criteria:**
- [x] Host settings include `llm_provider` and `llm_model` configuration
- [x] AI-generate and vision-suggest routes use the configured provider
- [x] Supported providers: OpenAI, Anthropic (MVP)
- [x] Provider API keys stored securely (env vars or encrypted in host DB)
- [x] Clear error if provider is not configured

---

## Phase 3 — Open Source Ready 🚧 NEXT (v0.8 → v1.0)

Ship something others can clone, self-host, and build on.

### Documentation

#### P3-01: Architecture and security model document
**Description:** Write a single `docs/architecture.md` that explains how Citadel works end-to-end: the host runtime model, isolation boundaries, permission enforcement, audit pipeline, and the app lifecycle (install → migrate → serve → uninstall). Include a threat model section that explains what Citadel defends against (cross-app data access, path traversal, SQL injection, XSS) and what it doesn't (OS-level isolation, network-level auth).
**Acceptance Criteria:**
- [ ] `docs/architecture.md` published in VitePress sidebar
- [ ] Covers: host runtime, isolation model (db/storage/network), permission system, audit pipeline, CSP/rate limiting
- [ ] Threat model section: what's protected, what's not, what requires Tailscale or container isolation
- [ ] Diagram showing request flow: browser → middleware → API route → core primitives → SQLite
- [ ] Links to relevant code files for each subsystem

#### P3-02: API reference for host primitives
**Description:** Write a reference doc covering every function in `@citadel/core` that an app developer would use: `dbQuery`, `dbExec`, `storageWriteBuffer`, `storageReadText`, `audit`, `assertAppId`, `runMigrationsForApp`. Each function gets signature, parameters, return type, example, and error cases. This exists alongside the tutorial — the tutorial teaches, this is the lookup table.
**Acceptance Criteria:**
- [ ] `docs/api-reference.md` published in VitePress sidebar
- [ ] Every exported function from `@citadel/core` documented
- [ ] Each entry includes: TypeScript signature, parameter descriptions, return type, usage example
- [ ] Error cases listed (what throws, what returns null)
- [ ] Cross-linked from the build-an-app tutorial

#### P3-03: Deployment guide
**Description:** Write a guide covering three deployment scenarios: Docker (primary), bare metal (for advanced users), and Raspberry Pi (popular self-hosting target). Docker is the recommended path. Include Tailscale setup for remote access.
**Acceptance Criteria:**
- [ ] `docs/how-to/deploy.md` published in VitePress sidebar
- [ ] Docker section: `docker-compose up` one-liner, volume mapping for `data/`, env vars, port config
- [ ] Bare metal section: Node.js version requirement, `npm install`, systemd service file, reverse proxy (Caddy/nginx)
- [ ] Raspberry Pi section: tested Node.js ARM build, performance notes, recommended Pi model
- [ ] Tailscale section: how to expose Citadel over tailnet (2-3 commands)
- [ ] Troubleshooting: common issues (port conflicts, permissions, node:sqlite on older Node)

#### P3-04: Contributing guide
**Description:** Write `CONTRIBUTING.md` at the repo root. Cover: how to set up the dev environment, how the codebase is organized, how to submit a PR, coding conventions (Tailwind, no external auth, app.yaml manifest), and how to add an app vs modify the platform.
**Acceptance Criteria:**
- [ ] `CONTRIBUTING.md` at repo root
- [ ] Dev setup: clone, `npm install`, `npm run dev`, run tests
- [ ] Codebase tour: host/ vs core/ vs apps/ vs templates/ vs scripts/
- [ ] PR process: branch naming, commit style, what to include in description
- [ ] Coding conventions: Tailwind for styling, TypeScript strict, no external auth dependencies
- [ ] "Add an app" vs "modify the platform" decision tree

---

### Deployment & Distribution

#### P3-05: Dockerfile and docker-compose
**Description:** Create a production Dockerfile for the host and a `docker-compose.yml` that runs Citadel with a single command. The Docker image should build the Next.js app, include the `citadel-app` CLI, and mount `data/` as a volume for persistence. Multi-stage build to keep the image small.
**Acceptance Criteria:**
- [ ] `Dockerfile` at repo root — multi-stage build (build stage + production stage)
- [ ] `docker-compose.yml` at repo root with volume for `data/` and configurable port
- [ ] `docker compose up` starts Citadel on port 3000 (configurable via env)
- [ ] Image size < 500MB
- [ ] `data/` directory persists across container restarts
- [ ] Apps directory is mountable for external app installation
- [ ] Health check defined in compose file (`/api/health`)

#### P3-06: Environment variable configuration
**Description:** Consolidate all configurable values behind environment variables with sensible defaults. Document every env var. Existing vars (`CITADEL_APPS_DIR`, `CITADEL_DATA_ROOT`) plus new ones for port, host URL, LLM keys, backup settings.
**Acceptance Criteria:**
- [ ] `docs/configuration.md` lists every env var with description, type, and default
- [ ] `CITADEL_PORT` — server port (default: 3000)
- [ ] `CITADEL_DATA_ROOT` — data directory (default: `../data`)
- [ ] `CITADEL_APPS_DIR` — apps directory (default: `../apps`)
- [ ] `CITADEL_BACKUP_RETENTION` — number of backups to keep (default: 7)
- [ ] `CITADEL_BACKUP_INTERVAL_HOURS` — hours between backups (default: 24)
- [ ] `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — LLM provider keys
- [ ] `.env.example` file at repo root with all vars commented out
- [ ] Docker compose references `.env` file

#### P3-07: GitHub release workflow
**Description:** Add a GitHub Actions workflow that creates a tagged release when a version tag is pushed. The release includes a changelog (auto-generated from commits since last tag), the Docker image pushed to GitHub Container Registry (ghcr.io), and a zip of the source.
**Acceptance Criteria:**
- [ ] `.github/workflows/release.yml` triggers on `v*` tag push
- [ ] Auto-generates changelog from conventional commits since last tag
- [ ] Builds and pushes Docker image to `ghcr.io/rohan1chaudhari/citadel:<tag>`
- [ ] Creates GitHub Release with changelog and source archive
- [ ] Smoke test: build passes before creating release
- [ ] `package.json` version matches the tag

#### P3-08: README demo content
**Description:** Add visual content to the README so people can understand Citadel at a glance without cloning it. Include screenshots of the home grid, an app (Smart Notes), the audit viewer, and the permission consent screen. Add an architecture diagram.
**Acceptance Criteria:**
- [ ] 3-4 screenshots in `docs/images/` (home grid, app view, audit viewer, permissions)
- [ ] Screenshots embedded in README under a "Screenshots" section
- [ ] Architecture diagram (text-based mermaid or image) showing host → apps → SQLite isolation
- [ ] Short GIF or video link showing `citadel-app create` → app running (optional but nice)

#### P3-09: LICENSE and governance
**Description:** Add MIT license file and basic governance docs. Citadel is MIT-licensed. Add a `CODE_OF_CONDUCT.md` (Contributor Covenant) and a `SECURITY.md` (how to report vulnerabilities).
**Acceptance Criteria:**
- [ ] `LICENSE` file at repo root (MIT, copyright Rohan Chaudhari)
- [ ] `CODE_OF_CONDUCT.md` at repo root (Contributor Covenant v2.1)
- [ ] `SECURITY.md` at repo root (email for private vulnerability reports, expected response time)
- [ ] LICENSE referenced in README footer

---

### Polish

#### P3-10: Error handling and error pages
**Description:** Add user-facing error pages for common HTTP errors (404, 500) and an error boundary for React component crashes. API routes should return consistent JSON error format. Currently errors are raw Next.js default pages.
**Acceptance Criteria:**
- [ ] Custom `not-found.tsx` at app root — styled 404 page with link to home
- [ ] Custom `error.tsx` at app root — styled 500 page with "try again" button
- [ ] API routes return consistent `{ ok: false, error: string, code: number }` format
- [ ] React error boundary catches component crashes and shows recovery UI
- [ ] Errors logged via audit with stack trace (in dev mode only)

#### P3-11: First-run setup wizard
**Description:** When Citadel starts with no `data/` directory (fresh install), show a setup wizard instead of the home grid. The wizard walks through: welcome, data directory confirmation, optional LLM API key entry, and done. Stores a `setup_complete` flag in the host DB.
**Acceptance Criteria:**
- [ ] Setup wizard at `/setup` shown on first visit when no `setup_complete` flag exists
- [ ] Step 1: Welcome — explains what Citadel is
- [ ] Step 2: Data directory — shows configured path, lets user confirm
- [ ] Step 3: API keys (optional) — OpenAI and/or Anthropic key input, saved to host settings
- [ ] Step 4: Done — redirects to home grid
- [ ] `setup_complete` flag in `citadel` DB prevents wizard from showing again
- [ ] Skippable via env var `CITADEL_SKIP_SETUP=true` (for Docker/automation)

#### P3-12: Host-level migration system
**Description:** The host itself needs a migration system (separate from per-app migrations) to handle schema changes to the `citadel` DB across version upgrades. When Citadel starts, it should check and run any pending host migrations before serving requests.
**Acceptance Criteria:**
- [ ] `host/migrations/` directory with numbered SQL files for the `citadel` DB
- [ ] `host_migrations` table in `citadel` DB tracks applied migrations
- [ ] Migrations run on startup before the Next.js server accepts requests
- [ ] Existing `citadel` DB tables (hidden_apps, app_permissions, audit_log, migrations) captured in `001_initial.sql`
- [ ] Future schema changes go in `002_xxx.sql`, `003_xxx.sql`, etc.
- [ ] Migration errors prevent startup with a clear error message

#### P3-13: Optional auth layer for public exposure
**Description:** Add an optional authentication layer that activates when `CITADEL_AUTH_ENABLED=true`. Uses passphrase-based login with session cookies. Disabled by default (Tailscale handles auth for local use). This unblocks exposing Citadel over the public internet without Tailscale.
**Acceptance Criteria:**
- [ ] `CITADEL_AUTH_ENABLED=true` env var activates auth (default: false)
- [ ] Login page at `/login` — passphrase input
- [ ] Passphrase hash (argon2) stored in `citadel` DB on first setup
- [ ] Session cookie (httpOnly, SameSite=Strict) issued on login
- [ ] Middleware redirects unauthenticated requests to `/login` (except `/api/health`)
- [ ] When disabled (default), all requests pass through — zero overhead
- [ ] Logout button in nav drawer when auth is enabled

---

## Phase 4 — App Marketplace 🔮 FUTURE (v1.0+)

Enable a community ecosystem. Only possible because Phase 2 separated apps.

### Registry

#### P4-01: GitHub-based app registry
**Description:** Create a public GitHub repo (`citadel-registry`) that serves as the app registry. It's a JSON index file listing available apps with metadata (name, description, repo URL, author, tags, version). The registry is fetched by the CLI and host UI. No custom server needed — GitHub raw content serves the index.
**Acceptance Criteria:**
- [ ] `citadel-registry` repo with `registry.json` containing app entries
- [ ] Each entry: `id`, `name`, `description`, `repo_url`, `author`, `tags`, `version`, `manifest_version`
- [ ] Submission via PR — add your app's entry to `registry.json`
- [ ] Validation CI: PR bot checks that `repo_url` is reachable and `app.yaml` exists
- [ ] README with submission instructions and listing criteria

#### P4-02: `citadel-app search` CLI command
**Description:** Add a `search` subcommand to the CLI that queries the registry index and displays matching apps. Fetches the registry JSON from GitHub, filters by query string, and displays results in a table.
**Acceptance Criteria:**
- [ ] `citadel-app search <query>` fetches registry and filters by name/description/tags
- [ ] Results displayed as a table: name, description, author, version
- [ ] `citadel-app search --tag=<tag>` filters by tag
- [ ] `citadel-app search` (no query) lists all available apps
- [ ] Registry URL configurable via `CITADEL_REGISTRY_URL` env var
- [ ] Graceful error if registry is unreachable (offline message, not crash)

#### P4-03: App detail and install from registry
**Description:** Add a `citadel-app info <app-id>` command that shows full details from the registry, and extend `citadel-app install` to accept a registry app ID (not just a URL). The host UI also gets a "Browse Apps" page that shows the registry with install buttons.
**Acceptance Criteria:**
- [ ] `citadel-app info <app-id>` shows: name, description, author, repo URL, version, permissions, README excerpt
- [ ] `citadel-app install <app-id>` (without URL) looks up the registry and clones the repo
- [ ] Host UI: `/browse` page fetches registry and displays app cards
- [ ] Each card has an "Install" button that triggers install via API
- [ ] Installed apps are marked as such in the browse view

#### P4-04: Showcase gallery on docs site
**Description:** Add a "Showcase" page to the VitePress docs site that displays community-built apps with screenshots, descriptions, and install commands. Pulls data from the registry JSON.
**Acceptance Criteria:**
- [ ] `docs/showcase.md` page in VitePress sidebar
- [ ] Displays app cards from registry with: name, description, author, screenshot (if provided)
- [ ] Each card has a copy-pasteable install command
- [ ] Auto-updated from registry (or manually curated for quality)

---

### Isolation v2

#### P4-05: Per-app storage quotas
**Description:** Add configurable storage quotas per app. The host tracks each app's DB file size and storage directory size. When an app exceeds its quota, write operations are blocked. Quotas are configured in the host settings or per-app overrides.
**Acceptance Criteria:**
- [ ] Default storage quota: 500MB per app (configurable via `CITADEL_DEFAULT_QUOTA_MB`)
- [ ] Per-app override in `citadel` DB (`app_quotas` table: app_id, quota_mb)
- [ ] `storageWriteBuffer` checks quota before writing — returns 507 if exceeded
- [ ] `dbExec` checks DB file size before mutation — returns 507 if exceeded
- [ ] Quota usage visible on `/status` health dashboard (used / limit bar)
- [ ] `citadel-app quota <app-id> [--set=<mb>]` CLI command to view/set quotas

#### P4-06: Container-based isolation for untrusted apps
**Description:** Add an optional Docker-based isolation mode for apps that run untrusted code. When enabled for an app, the host spawns the app's API routes in a separate Docker container with limited resources. The host proxies requests to the container. Trusted (built-in) apps continue running in-process.
**Acceptance Criteria:**
- [ ] `app.yaml` supports `isolation: "container"` field (default: `"process"` for in-process)
- [ ] Container mode: host builds a Docker image from the app's package
- [ ] Container has read-only filesystem except for its mounted `data/apps/<appId>/` volume
- [ ] Resource limits: CPU (0.5 core), memory (256MB), no network by default
- [ ] Host proxies `/api/apps/<appId>/*` to the container's internal port
- [ ] `citadel-app start/stop <app-id>` manages the container lifecycle
- [ ] Falls back to in-process if Docker is not available (with warning)

#### P4-07: Network policy per app
**Description:** Allow apps to declare specific outbound network access in their manifest. The host enforces this — in container mode via Docker network policy, in process mode via an HTTP proxy that allowlists domains.
**Acceptance Criteria:**
- [ ] `app.yaml` `network` field accepts a list of allowed domains: `network: ["api.openai.com", "api.elevenlabs.io"]`
- [ ] In-process mode: `fetch` wrapper checks against allowlist before request
- [ ] Container mode: Docker network policy restricts outbound to allowlisted domains
- [ ] Wildcard support: `*.openai.com` matches subdomains
- [ ] Blocked requests logged via audit with app_id and target domain
- [ ] Empty `network: []` or omitted = no outbound access (deny-by-default)

---

### Cross-App Capabilities

#### P4-08: App intents system
**Description:** Add a lightweight intent system that lets apps declare actions they can handle and lets other apps invoke those actions with user consent. Similar to Android intents. Example: gym-tracker declares it can "log an exercise"; smart-notes can trigger that intent when a note mentions a workout.
**Acceptance Criteria:**
- [ ] `app.yaml` supports `intents.provides` (list of action URIs the app handles)
- [ ] `app.yaml` supports `intents.uses` (list of action URIs the app wants to invoke)
- [ ] Host intent router at `POST /api/intents/invoke` — takes action URI + payload
- [ ] User consent prompt before first cross-app intent (stored in permissions table)
- [ ] Intent resolution: host finds the app that provides the action, forwards the payload
- [ ] Built-in intents: `citadel.search`, `citadel.share-text`, `citadel.create-note`

#### P4-09: Home screen widgets
**Description:** Allow apps to register a small widget component that appears on the Citadel home page. Widgets show at-a-glance data (e.g., today's mood score, last workout, unread notes count). Loaded via a standardized widget API.
**Acceptance Criteria:**
- [ ] `app.yaml` supports `widget: true` flag
- [ ] Widget endpoint: `GET /api/apps/<appId>/widget` returns JSON with title + data
- [ ] Home page renders widgets below the app grid (compact card per app)
- [ ] Widgets refresh on page load (server-rendered)
- [ ] Max widget size: 1-2 lines of text or a single number + label
- [ ] Apps without a widget endpoint are skipped (no error)

---

### Community

#### P4-10: App submission and review process
**Description:** Define the process for submitting an app to the registry. Authors open a PR to `citadel-registry` adding their app entry. A CI bot validates the manifest, checks the repo is accessible, and runs basic security checks (no `ATTACH` in migrations, manifest_version valid). A maintainer reviews and merges.
**Acceptance Criteria:**
- [ ] Submission template in `citadel-registry` repo (PR template with checklist)
- [ ] CI validation: manifest exists, required fields present, repo reachable, migrations don't use blocked SQL
- [ ] Review checklist documented: security, quality, description accuracy
- [ ] Approved apps get a "verified" badge in the registry
- [ ] Rejection reasons are documented (what gets rejected and why)

#### P4-11: Fork-and-customize workflow
**Description:** Make it easy for users to fork an existing app, customize it, and install their version. The CLI supports forking: it clones the app repo, changes the app ID in the manifest, and registers it as a new app.
**Acceptance Criteria:**
- [ ] `citadel-app fork <source-app-id> <new-app-id>` CLI command
- [ ] Clones the source app's repo (from registry or local)
- [ ] Updates `app.yaml` with new app ID, preserves everything else
- [ ] Creates a new git repo for the fork (or just a directory for local forks)
- [ ] Runs migrations for the new app ID (fresh DB)
- [ ] Documentation in `docs/how-to/fork-an-app.md`

#### P4-12: Community app templates
**Description:** Extend the template system to support community-submitted templates. Templates can be fetched from the registry (or a templates section of it). Users can create apps from community templates via `citadel-app create --template=<name>`.
**Acceptance Criteria:**
- [ ] Registry supports a `templates` section in `registry.json`
- [ ] `citadel-app create --template=<name>` checks local templates first, then registry
- [ ] Remote templates are downloaded (git clone) to a cache directory
- [ ] Template validation: must include `app.yaml`, `page.tsx`, `README.md` at minimum
- [ ] `citadel-app templates` lists all available templates (local + remote)

---

## Non-Goals (for now)
- Multi-tenant SaaS hosting (self-hosted by design)
- Real-time collaboration / multiplayer
- Native mobile apps (PWA is the path)
- Complex RBAC / multi-user permissions (single-user first)

---

## Guiding Principle

Platform first, apps second. Build the runtime that makes every app safe, installable, and deletable — then let the apps flourish.
