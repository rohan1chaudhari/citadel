# Citadel Platform Roadmap

**Vision:** A local-first, self-hosted app platform where anyone can install, fork, and share personal apps.

**This roadmap covers the platform only.** App-specific backlogs live in each app's folder (`apps/<app-id>/ROADMAP.md`).

---

## Phase 1 — Platform Foundations (Now → v0.5)

Make the host runtime solid, secure, and observable.

### Authentication & Identity

#### P1-01: Local passphrase authentication
**Description:** Add a passphrase-based auth system to the host. On first launch, prompt the user to set a passphrase. On subsequent visits, require it before accessing any app or API. Store a bcrypt/argon2 hash in the host's own SQLite DB (`citadel` app). No external auth providers — this is local-first.
**Acceptance Criteria:**
- [ ] First-run setup flow prompts for passphrase creation
- [ ] Login page at `/login` accepts passphrase
- [ ] All `/api/*` and `/apps/*` routes return 401 if no valid session
- [ ] Passphrase hash stored in `citadel` DB, never plaintext
- [ ] "Change passphrase" option in host settings

#### P1-02: Cookie-based session management
**Description:** After passphrase login, issue an httpOnly secure cookie with a session token. Store active sessions in the `citadel` DB with expiry. Add Next.js middleware that validates the session on every request and redirects to `/login` if invalid.
**Acceptance Criteria:**
- [ ] Session token issued as httpOnly, SameSite=Strict cookie
- [ ] Sessions table in `citadel` DB tracks token, created_at, expires_at, last_active_at
- [ ] Middleware in `host/src/middleware.ts` validates session on all protected routes
- [ ] Sessions expire after configurable duration (default 30 days)
- [ ] Logout endpoint clears cookie and deletes session row
- [ ] `/login` and `/api/health` are public (no session required)

#### P1-03: WebAuthn / passkey support (optional)
**Description:** Allow users to register a passkey (fingerprint, Face ID, hardware key) as an alternative to passphrase login. Uses the Web Authentication API. Falls back to passphrase if WebAuthn is unavailable.
**Acceptance Criteria:**
- [ ] "Add passkey" button in host settings triggers WebAuthn registration
- [ ] Login page offers passkey login when a credential is registered
- [ ] Passkey credentials stored in `citadel` DB
- [ ] Passphrase login remains available as fallback
- [ ] Works on Safari (iOS), Chrome, and Firefox

---

### Permissions & Isolation

#### P1-04: Permission approval UI
**Description:** When an app's `app.yaml` declares permissions (db read/write, storage read/write, network, ai), show the user an approval prompt on first launch. Store granted permissions in the host DB. Block app API calls that exceed granted permissions.
**Acceptance Criteria:**
- [ ] First visit to an app shows a permission consent screen listing requested scopes
- [ ] User can approve or deny each scope individually
- [ ] Granted permissions stored in `citadel` DB (`app_permissions` table)
- [ ] `dbQuery`/`dbExec` check granted permissions before executing
- [ ] `storageWriteBuffer`/`storageReadText` check granted permissions
- [ ] Denied permission returns 403 with clear error message
- [ ] "Manage permissions" page in host settings to revoke/grant per app

#### P1-05: Network and AI API permission enforcement
**Description:** Extend the permission system beyond DB/storage. Apps that want to call external APIs (e.g., OpenAI, ElevenLabs) must declare `ai: true` or `network: [domains]` in their manifest. The host must proxy or gate these calls.
**Acceptance Criteria:**
- [ ] `app.yaml` schema supports `ai: true/false` and `network: [list of allowed domains]`
- [ ] Apps without `ai: true` cannot call AI API routes
- [ ] Apps without `network` permission get blocked outbound (enforced at API route level in MVP)
- [ ] Permission violations logged via audit

#### P1-06: CSP headers and app sandboxing
**Description:** Add Content-Security-Policy headers to app pages to prevent XSS and limit what app code can do in the browser. Each app's pages should have restrictive CSP that only allows loading resources from the host origin.
**Acceptance Criteria:**
- [ ] Next.js middleware sets CSP headers on all `/apps/*` responses
- [ ] `script-src 'self'` — no inline scripts except nonce-based
- [ ] `connect-src 'self'` — apps can only fetch from the host
- [ ] `frame-ancestors 'none'` — prevents clickjacking
- [ ] CSP violations reported to a host endpoint for logging

#### P1-07: Per-app rate limiting
**Description:** Prevent a misbehaving app (or runaway autopilot) from hammering the host. Add a simple in-memory rate limiter (token bucket) keyed by app ID that limits API requests per minute.
**Acceptance Criteria:**
- [ ] Rate limiter middleware applied to all `/api/apps/*` routes
- [ ] Default limit: 120 requests/minute per app (configurable)
- [ ] Returns 429 with `Retry-After` header when exceeded
- [ ] Rate limit state resets on host restart (in-memory is fine for MVP)
- [ ] Scrum-board/autopilot exempt or has higher limit

---

### Audit & Observability

#### P1-08: Persist audit logs to DB
**Description:** Currently `audit()` logs JSON to stdout. Add a second sink that writes to an `audit_log` table in the `citadel` DB. Keep stdout logging as-is for dev/debugging. Include retention — auto-delete logs older than 90 days.
**Acceptance Criteria:**
- [ ] `audit_log` table in `citadel` DB with columns: id, ts, app_id, event, payload (JSON), created_at
- [ ] `audit()` function writes to both stdout and DB
- [ ] Index on (app_id, ts) for efficient querying
- [ ] Auto-cleanup: logs older than 90 days deleted on host startup
- [ ] No performance regression on hot paths (batch inserts or async write)

#### P1-09: Audit log viewer UI
**Description:** Add a host-level page at `/audit` that displays audit logs with filtering by app, event type, and time range. Paginated, most recent first.
**Acceptance Criteria:**
- [ ] Page at `/audit` accessible from host nav
- [ ] Filter by app_id (dropdown of installed apps)
- [ ] Filter by event type (db.query, db.exec, storage.write, etc.)
- [ ] Filter by date range
- [ ] Paginated results (50 per page)
- [ ] Each log entry shows timestamp, app, event, and expandable payload

#### P1-10: App health dashboard
**Description:** Add a host-level page at `/status` (enhance existing) that shows per-app health metrics: SQLite DB file size, storage directory size, total API calls (from audit), and last activity timestamp.
**Acceptance Criteria:**
- [ ] `/status` page shows a card per installed app
- [ ] Each card displays: DB file size (bytes), storage dir size, total audit events (last 24h), last activity time
- [ ] Refreshes on page load (server-rendered, no polling needed for MVP)
- [ ] Warning indicators for apps with large DB (>100MB) or storage (>1GB)

---

### Data & Backup

#### P1-11: Per-app data export
**Description:** Add an API endpoint and UI button to export a single app's data as a zip archive containing its SQLite DB file and storage directory. Useful for backup and portability.
**Acceptance Criteria:**
- [ ] `GET /api/apps/{appId}/export` returns a zip file
- [ ] Zip contains `db.sqlite` and all files under the app's storage root
- [ ] Export button visible on each app's settings or the host status page
- [ ] Filename includes app ID and ISO timestamp: `smart-notes-2026-03-01T12-00-00.zip`
- [ ] Streams the zip (doesn't buffer entire archive in memory)

#### P1-12: Per-app data import
**Description:** Add an API endpoint and UI to restore an app's data from a previously exported zip. Overwrites existing DB and storage. Requires confirmation.
**Acceptance Criteria:**
- [ ] `POST /api/apps/{appId}/import` accepts a zip upload
- [ ] Validates zip structure (must contain `db.sqlite` at minimum)
- [ ] Backs up current data before overwriting (moves to `data/backups/{appId}/{timestamp}/`)
- [ ] Confirmation dialog warns that current data will be replaced
- [ ] App's cached DB connection is invalidated after import

#### P1-13: Scheduled local backups
**Description:** On host startup and then every 24 hours, snapshot all app data directories into a timestamped zip under `data/backups/`. Keep the last 7 backups, delete older ones.
**Acceptance Criteria:**
- [ ] Backup runs on host startup and every 24h (setInterval or cron-like)
- [ ] Creates `data/backups/citadel-backup-{ISO-timestamp}.zip`
- [ ] Includes all `data/apps/*/` directories
- [ ] Retains last 7 backups, deletes oldest when limit exceeded
- [ ] Backup status visible on `/status` page (last backup time, size)

---

### Platform UX

#### P1-14: Responsive host shell
**Description:** Make the home grid, navigation drawer, and root layout responsive for mobile screens. The nav drawer should collapse to a hamburger menu on small screens. App grid should reflow from multi-column to single-column.
**Acceptance Criteria:**
- [ ] Home grid: 1 column on mobile (<640px), 2 on tablet, 3 on desktop
- [ ] Nav drawer: collapses to hamburger menu on mobile, slide-out overlay
- [ ] Root layout: removes excess padding on mobile, uses full width
- [ ] Touch targets are at least 44x44px
- [ ] Tested on iPhone SE (375px) and iPad (768px) viewports

#### P1-15: PWA manifest and service worker
**Description:** Add a web app manifest and basic service worker so Citadel can be "installed" to the home screen on iOS and Android. Cache the app shell for fast loads.
**Acceptance Criteria:**
- [ ] `manifest.json` with name, icons (192px, 512px), theme color, display: standalone
- [ ] Service worker caches the Next.js app shell (HTML, CSS, JS bundles)
- [ ] "Add to Home Screen" works on iOS Safari and Android Chrome
- [ ] App launches in standalone mode (no browser chrome)
- [ ] Offline: shows cached shell with "you're offline" message if network unavailable

#### P1-16: Dark mode
**Description:** Add a dark mode toggle to the host shell. Use Tailwind's `dark:` variant. Store preference in localStorage. Provide a theme context that apps can read to match the host theme.
**Acceptance Criteria:**
- [ ] Toggle in nav drawer or host header (sun/moon icon)
- [ ] Preference persisted in localStorage, defaults to system preference
- [ ] Host shell (nav, home grid, status pages) fully styled for dark mode
- [ ] `ThemeContext` exported from host so apps can read `isDark`
- [ ] No flash of wrong theme on page load (script in `<head>` sets class early)

#### P1-17: Global search
**Description:** Add a search bar to the home page that searches across all apps. Each app can register a search provider (a function that takes a query and returns results). MVP: search app names from the registry. Later: apps provide full-text search endpoints.
**Acceptance Criteria:**
- [ ] Search input on home page (with keyboard shortcut Cmd/Ctrl+K)
- [ ] Searches app names and descriptions from registry (instant, client-side)
- [ ] Results link to the matching app
- [ ] Extensible: apps can register a `/api/apps/{appId}/search?q=` endpoint
- [ ] If an app has a search endpoint, results from that app appear in global search

---

### Tech Debt

#### P1-18: Extract core packages from host/src/lib
**Description:** Move the shared platform primitives (`db.ts`, `audit.ts`, `storage.ts`, `sqlGuardrails.ts`, `paths.ts`, `appIds.ts`, `registry.ts`) into the `core/` directory as proper npm workspace packages. Apps and host import from `@citadel/core` instead of relative paths.
**Acceptance Criteria:**
- [ ] `core/` is an npm workspace package with `package.json` (`@citadel/core`)
- [ ] All shared primitives moved from `host/src/lib/` to `core/src/`
- [ ] Host imports from `@citadel/core` via workspace resolution
- [ ] All existing functionality unchanged (no regressions)
- [ ] `npm run build` passes in both `core/` and `host/`

#### P1-19: Replace hand-rolled YAML parser
**Description:** The registry uses a regex-based YAML parser that only handles scalar values. Replace it with a proper YAML library (e.g., `yaml` npm package) or switch `app.yaml` to `app.json` for zero-dependency parsing.
**Acceptance Criteria:**
- [ ] App manifests are parsed correctly including nested objects, arrays, and multi-line strings
- [ ] All existing `app.yaml` files parse without changes
- [ ] Manifest schema validated at parse time (required fields: id, name, version, permissions)
- [ ] Invalid manifests produce clear error messages with file path and line number

#### P1-20: Evaluate node:sqlite stability
**Description:** Research whether `node:sqlite` has stabilized in the current Node.js version. If still experimental, evaluate migrating to `better-sqlite3`. Document the decision and rationale.
**Acceptance Criteria:**
- [ ] Written assessment in `kb/DECISIONS.md` covering: current stability status, breaking change risk, performance comparison, migration effort
- [ ] If migrating: `better-sqlite3` replaces `node:sqlite` in `db.ts`, all tests pass
- [ ] If staying: document why and what Node.js version stabilizes the API
- [ ] No runtime warnings about experimental APIs (either suppressed intentionally or eliminated)

#### P1-21: Integration tests for host APIs and isolation
**Description:** Add a test suite that validates the host's core guarantees: per-app DB isolation, storage path traversal protection, SQL guardrails, and permission enforcement. Use Node.js test runner or vitest.
**Acceptance Criteria:**
- [ ] Test: app A cannot read app B's database
- [ ] Test: storage path traversal (`../`) is blocked
- [ ] Test: SQL guardrails block `ATTACH`, `DETACH`, `PRAGMA`, `VACUUM`, multi-statement
- [ ] Test: `assertAppId` rejects invalid app IDs
- [ ] Test: audit events are emitted for DB and storage operations
- [ ] Tests run via `npm test` in `host/`
- [ ] CI-ready (no external dependencies, no running server needed)

---

## Phase 2 — App Separation (v0.5 → v0.8)

Decouple apps from the monorepo so they're independently installable packages.

### App Package Format

#### P2-01: Define the app package spec
**Description:** Design and document the canonical structure of a Citadel app package. This is the contract between app developers and the host. It defines what files an app must/can contain and how the host discovers and loads them.
**Acceptance Criteria:**
- [ ] Spec document at `docs/app-spec.md` covering: manifest format, directory structure, migration convention, UI entry point, API route convention, asset handling
- [ ] Manifest schema formally defined (JSON Schema or TypeScript type)
- [ ] Required fields: `id`, `name`, `version`, `permissions`
- [ ] Optional fields: `description`, `icon`, `author`, `homepage`, `dependencies`
- [ ] Example app package in `docs/examples/` that conforms to the spec

#### P2-02: Dynamic app loading from external directories
**Description:** Currently apps are hardcoded as subdirectories under `host/src/app/apps/`. Modify the host to discover and load apps from an external `apps/` directory (or configurable path). App UI and API routes are dynamically registered at startup.
**Acceptance Criteria:**
- [ ] Host reads app directories from a configurable path (`$CITADEL_APPS_DIR` or `../apps/`)
- [ ] App UI pages are served under `/apps/{appId}/*`
- [ ] App API routes are served under `/api/apps/{appId}/*`
- [ ] Adding a new app directory and restarting the host registers it automatically
- [ ] Removing an app directory deregisters it (data preserved in `data/apps/`)
- [ ] Existing monorepo apps continue to work during migration

#### P2-03: Versioned app manifests with schema validation
**Description:** Add a `manifest_version` field to `app.yaml`/`app.json` and validate all manifests against their declared schema version at registration time. This allows evolving the manifest format without breaking older apps.
**Acceptance Criteria:**
- [ ] `manifest_version: 1` added to all existing app manifests
- [ ] Validation function checks manifest against schema for its declared version
- [ ] Unknown manifest versions produce a clear error (not silently ignored)
- [ ] Schema versions are documented with changelogs

---

### Install / Uninstall / Update

#### P2-04: `citadel-app install`
**Description:** CLI command that installs an app from a git repo URL or local path. Clones the repo (or copies the directory), validates the manifest, registers the app in the host, and runs any migrations.
**Acceptance Criteria:**
- [ ] `citadel-app install <git-url>` clones repo into apps directory
- [ ] `citadel-app install <local-path>` copies or symlinks app directory
- [ ] Validates manifest (id, name, version, permissions) before registering
- [ ] Rejects if app ID conflicts with an existing app
- [ ] Runs app migrations (if any) after install
- [ ] Prints success message with app URL

#### P2-05: `citadel-app uninstall`
**Description:** CLI command that removes an installed app. Deregisters it from the host. Optionally deletes the app's data directory (with confirmation).
**Acceptance Criteria:**
- [ ] `citadel-app uninstall <app-id>` removes app from apps directory
- [ ] Prompts "Delete app data? (y/N)" — default keeps data
- [ ] `--delete-data` flag skips the prompt and deletes data
- [ ] Cannot uninstall `citadel` (the host itself) or `scrum-board` (meta-app)
- [ ] Prints confirmation of what was removed

#### P2-06: `citadel-app update`
**Description:** CLI command that updates an installed app to the latest version. Pulls latest from git (if git-installed), validates manifest, runs new migrations.
**Acceptance Criteria:**
- [ ] `citadel-app update <app-id>` runs `git pull` in the app directory
- [ ] Validates updated manifest
- [ ] Runs any new migrations (compares current version vs new version)
- [ ] Rolls back on migration failure (restores previous app directory)
- [ ] `citadel-app update --all` updates all git-installed apps

---

### Migration System

#### P2-07: Formal migration runner
**Description:** Replace the current ad-hoc schema initialization (`ensureSmartNotesSchema`, etc.) with a proper migration system. Each app has a `migrations/` directory with numbered SQL files. The host tracks which migrations have run per app in a `migrations` table in the host DB.
**Acceptance Criteria:**
- [ ] Apps place migration files in `migrations/001_initial.sql`, `migrations/002_add_tags.sql`, etc.
- [ ] Host `citadel` DB has a `migrations` table: app_id, migration_name, applied_at
- [ ] On app startup, host runs any unapplied migrations in order
- [ ] Each migration runs in a transaction (rolls back on error)
- [ ] Existing apps migrated to use this system (initial schema becomes `001_initial.sql`)
- [ ] `citadel-app migrate <app-id>` CLI command to manually trigger migrations

#### P2-08: Migration rollback support
**Description:** Each migration can have an optional `down` file (e.g., `001_initial.down.sql`). The host can roll back the last N migrations for an app.
**Acceptance Criteria:**
- [ ] Down migrations stored alongside up migrations: `001_initial.down.sql`
- [ ] `citadel-app migrate:rollback <app-id>` rolls back the last applied migration
- [ ] `citadel-app migrate:rollback <app-id> --steps=3` rolls back N migrations
- [ ] Rollback updates the `migrations` table (removes rolled-back entries)
- [ ] Rollback runs in a transaction

---

### Developer Experience

#### P2-09: `citadel-app create` scaffolding
**Description:** CLI command that creates a new app from a template. Generates the directory structure, manifest, initial migration, and placeholder UI/API files. Gets a developer from zero to a running app in one command.
**Acceptance Criteria:**
- [ ] `citadel-app create <app-id>` generates a complete app directory
- [ ] Generated files: `app.yaml`, `migrations/001_initial.sql`, `page.tsx`, `route.ts`, `README.md`
- [ ] `--template=<name>` flag selects a template (default: `blank`)
- [ ] App ID validated (lowercase, alphanumeric + hyphens, 1-64 chars)
- [ ] Created app is immediately usable: install + start host → see the app

#### P2-10: App templates
**Description:** Provide a set of starter templates for common app types. Templates are directories under `templates/` in the Citadel repo (or fetched from a registry later).
**Acceptance Criteria:**
- [ ] `blank` template: empty app with manifest, one page, one API route
- [ ] `crud` template: list/create/edit/delete with SQLite table
- [ ] `ai` template: app with AI API integration (chat or structured output)
- [ ] `dashboard` template: read-only data display with charts placeholder
- [ ] Each template includes a README explaining the structure

#### P2-11: Local dev mode
**Description:** Allow developers to work on an app with hot-reload against a running host. The app directory is symlinked or watched, and changes are reflected without restarting the host.
**Acceptance Criteria:**
- [ ] `citadel-app dev <path-to-app>` starts watching the app directory
- [ ] File changes in the app trigger a Next.js hot-reload
- [ ] App's API routes hot-reload without host restart
- [ ] Dev mode shows clear error overlay for app-level errors
- [ ] Works with `npm run dev` in the host (standard Next.js dev server)

#### P2-12: App development tutorial
**Description:** Write a step-by-step tutorial in the VitePress docs site that walks a developer through building a complete app from scratch — from `citadel-app create` to a working CRUD app with DB, API, and UI.
**Acceptance Criteria:**
- [ ] Tutorial at `docs/how-to/build-an-app.md`
- [ ] Covers: create app, define manifest, write migration, build API route, build UI page
- [ ] Includes code snippets that can be copy-pasted
- [ ] Links to API reference for host primitives
- [ ] Tested: following the tutorial produces a working app

---

### Decouple from openclaw

#### P2-13: Pluggable agent runner
**Description:** Replace the hard dependency on `openclaw` CLI for autopilot with an abstraction layer. The host should define an `AgentRunner` interface, and `openclaw` becomes one implementation. Users can swap in other runners (e.g., Claude Code, custom scripts).
**Acceptance Criteria:**
- [ ] `AgentRunner` interface defined: `spawn(task, config) → session`
- [ ] OpenClaw runner implements the interface (preserves current behavior)
- [ ] Config in host settings: `agent_runner: "openclaw" | "claude-code" | "script"`
- [ ] `triggerAutopilot.ts` uses the runner interface, not `openclaw` directly
- [ ] Documentation for implementing a custom runner

#### P2-14: Multi-provider LLM support for autopilot
**Description:** The autopilot's AI features (task generation, vision suggest) currently hardcode OpenAI models. Make the LLM provider configurable so users can use Anthropic, local models (Ollama), or other providers.
**Acceptance Criteria:**
- [ ] Host settings include `llm_provider` and `llm_model` configuration
- [ ] AI-generate and vision-suggest routes use the configured provider
- [ ] Supported providers: OpenAI, Anthropic (MVP)
- [ ] Provider API keys stored securely (env vars or encrypted in host DB)
- [ ] Clear error if provider is not configured

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
