# Contributing to Citadel

Thanks for helping improve Citadel! This guide will get you set up and oriented.

## Development Setup

### Prerequisites

- **Node.js >= 22** (required for `node:sqlite`)
- **Git**
- **npm** (comes with Node)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/rohan1chaudhari/citadel.git
cd citadel

# Install dependencies
npm install
cd host && npm install

# Run the development server
cd /home/rohanchaudhari/personal/citadel/host
npm run dev
# → http://localhost:3000
```

### Running Tests

```bash
cd /home/rohanchaudhari/personal/citadel/host
npm test
```

Tests use Vitest and validate core guarantees: per-app DB isolation, storage path traversal protection, SQL guardrails, and permission enforcement.

---

## Codebase Tour

Citadel is organized as a monorepo with distinct layers:

```
citadel/
├── host/           → Next.js control plane (routing, permissions, audit, UI shell)
├── core/           → @citadel/core platform primitives (db, storage, audit, permissions, migrations)
├── apps/           → App packages (manifest + migrations only)
├── templates/      → App starter templates (blank, crud, ai, dashboard)
├── scripts/        → citadel-app CLI
├── docs/           → VitePress documentation site
└── kb/             → Internal knowledge base (roadmap, decisions)
```

### host/ — The Control Plane

The Next.js application that serves as Citadel's host:

- `src/app/` — Next.js App Router pages
  - `(shell)/` — Host shell pages (home, status, audit, settings)
  - `apps/[appId]/` — Dynamic app page loading
  - `api/apps/[appId]/` — Dynamic API route loading
- `src/lib/` — Host-specific utilities (not shared with apps)
- `src/components/` — Reusable React components
- `middleware.ts` — CSP headers, rate limiting, auth
- `public/app-logos/` — App icons

### core/ — @citadel/core

The shared platform library that apps import:

| File | Purpose |
|------|---------|
| `db.ts` | `dbQuery()`, `dbExec()` — per-app SQLite with isolation |
| `storage.ts` | `storageWriteBuffer()`, `storageReadText()` — per-app file storage |
| `audit.ts` | `audit()` — structured logging to stdout + DB |
| `permissions.ts` | Permission checking and consent management |
| `registry.ts` | App manifest loading and discovery |
| `migrations.ts` | Migration runner for app schemas |
| `manifest-schema.ts` | JSON Schema for app.yaml validation |
| `sqlGuardrails.ts` | Blocks dangerous SQL (ATTACH, PRAGMA, etc.) |
| `paths.ts` | Path resolution for data, apps, storage |
| `appIds.ts` | App ID validation (kebab-case, 1-64 chars) |

Apps never import from `host/` — they only use `@citadel/core`.

### apps/ — App Packages

Each app is a directory with:

```
apps/smart-notes/
├── app.yaml          # Manifest (id, name, version, permissions)
├── README.md         # App documentation
├── ROADMAP.md        # (Optional) App-specific roadmap
└── migrations/       # SQL migrations
    ├── 001_initial.sql
    └── 002_add_tags.sql
```

App UI and API routes live in `host/src/app/apps/[appId]/` (for now — will move to standalone repos in Phase 3).

### templates/ — Starter Templates

Scaffolding for new apps:

- `blank/` — Minimal app with one page, one API route
- `crud/` — List/create/edit/delete with SQLite
- `ai/` — AI API integration (chat or structured output)
- `dashboard/` — Read-only data display

### scripts/ — citadel-app CLI

The developer CLI at `scripts/citadel-app.mjs`:

```bash
node scripts/citadel-app.mjs create my-app --template=crud
node scripts/citadel-app.mjs install <git-url>
node scripts/citadel-app.mjs migrate <app-id>
```

---

## "Add an App" vs "Modify the Platform"

Use this decision tree:

**Are you building a new capability for users?** → **Add an App**
- Create with `node scripts/citadel-app.mjs create <app-id>`
- Only touches `apps/<app-id>/` and `host/src/app/apps/<app-id>/`
- Uses existing platform primitives
- Example: A budget tracker, a habit tracker, a recipe book

**Are you changing how apps run, store data, or interact with the host?** → **Modify the Platform**
- Changes `host/` (routing, middleware, shell UI)
- Changes `core/` (primitives, permissions, isolation)
- Changes `scripts/` (CLI commands)
- Example: Adding new permission types, changing the migration system

**Not sure?** Open a discussion first. Platform changes affect all apps.

---

## Coding Conventions

### TypeScript

- **Strict mode enabled** — no implicit any
- Explicit return types on exported functions
- Use `type` over `interface` for object shapes

### Styling

- **Tailwind CSS** for all styling
- Use `className` utilities, avoid CSS modules
- Dark mode: use `dark:` variants (system follows host theme)
- Touch targets minimum 44x44px on mobile

### Security

- **No external auth dependencies** — Citadel is local-first, Tailscale handles auth
- Never commit API keys or secrets
- All app DB access goes through `@citadel/core` (isolation enforced)
- All storage paths are sandboxed (path traversal blocked)
- Permission enforcement is required, not optional

### App Manifest (app.yaml)

```yaml
id: my-app                    # Required: kebab-case, 1-64 chars
name: My App                  # Required: human-readable
version: 0.1.0               # Required: semver
manifest_version: "1.0"      # Required: schema version
permissions:                  # Required
  db:
    read: true
    write: true
  storage:
    read: true
    write: true
  ai: false                   # Optional: AI API access
  network: []                 # Optional: allowed domains
```

---

## PR Process

### Branch Naming

```
feat/<app-id>-<description>     # New feature
fix/<app-id>-<description>      # Bug fix
docs/<description>               # Documentation
refactor/<description>           # Code refactoring
```

Examples: `feat/smart-notes-voice-input`, `fix/core-db-timeout`

### Commit Style

- Use present tense: "Add feature" not "Added feature"
- Use imperative mood: "Move cursor to..." not "Moves cursor to..."
- Reference issues: "Fix #123" or "Closes #456"

Examples:
```
feat(smart-notes): add voice recording button

fix(core): handle db timeout in high-concurrency scenarios

docs: update app-spec with network permissions
```

### PR Description

Include:
1. **What** — What changed (high level)
2. **Why** — Why this change was needed
3. **How** — How it was implemented (key decisions)
4. **Testing** — How you verified it works

For app PRs: Include screenshots or screen recordings.

### PR Checklist

- [ ] App/feature works locally (`npm run dev`)
- [ ] `npm run build` passes in `host/`
- [ ] Tests pass (`npm test` in `host/`)
- [ ] No secrets committed (check `.env*` files)
- [ ] README/docs updated if user-facing
- [ ] App manifest valid (`app.yaml` passes schema)

---

## Testing Guidelines

### Unit Tests

Located in `host/src/__tests__/`:

```bash
cd host
npm test
```

Core tests validate:
- App A cannot read App B's database
- Path traversal (`../`) is blocked in storage
- SQL guardrails block `ATTACH`, `PRAGMA`, `VACUUM`
- Permission enforcement (403 on denied access)
- Audit events are emitted

### Manual Testing

For UI changes:
1. Test on desktop ( Chrome/Firefox)
2. Test on mobile viewport (iPhone SE 375px)
3. Test dark mode toggle

For app changes:
1. Fresh install: delete `data/apps/<app-id>/`, restart host
2. Migration test: check upgrade path from previous version

---

## Documentation

Update docs for user-facing changes:

- **App features** — Update the app's `README.md`
- **Platform features** — Update `docs/` (VitePress site)
- **API changes** — Update `docs/api-reference.md`
- **Breaking changes** — Update `docs/migration.md` (if exists)

---

## Security

See [SECURITY.md](SECURITY.md) for:
- Reporting vulnerabilities (private disclosure)
- Security model and threat assessment
- Responsible disclosure process

---

## Getting Help

- **General questions** — Open a GitHub Discussion
- **Bug reports** — Open an issue with reproduction steps
- **Feature requests** — Open an issue with use case
- **Security issues** — Email security@rohanchaudhari.dev (see SECURITY.md)

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
