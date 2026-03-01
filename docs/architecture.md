# Citadel Architecture

This document explains how Citadel works end-to-end: the host runtime model, isolation boundaries, permission enforcement, audit pipeline, and the app lifecycle.

## Overview

Citadel is a local-first personal app hub. It consists of:

- **Host**: A Next.js application that serves as the platform runtime
- **Core**: A set of platform primitives (`@citadel/core`) for apps to use
- **Apps**: Self-contained packages with UI, API routes, and optional database

```
┌─────────────────────────────────────────────────────────────┐
│                      Citadel Host                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Next.js    │  │  @citadel/  │  │   SQLite (per-app)  │  │
│  │  App Router │  │    core     │  │                     │  │
│  │             │  │             │  │  • smart-notes.db   │  │
│  │ /apps/:id   │  │ • dbQuery   │  │  • gym-tracker.db   │  │
│  │ /api/apps   │  │ • dbExec    │  │  • citadel.db       │  │
│  │             │  │ • storage   │  │                     │  │
│  └─────────────┘  │ • audit     │  └─────────────────────┘  │
│                   │ • permissions│                          │
│  ┌─────────────┐  └─────────────┘  ┌─────────────────────┐  │
│  │  App        │                   │   File System       │  │
│  │  Packages   │                   │                     │  │
│  │             │                   │  data/apps/:id/     │  │
│  │ • app.yaml  │                   │  ├── db.sqlite      │  │
│  │ • page.tsx  │                   │  └── storage/       │  │
│  │ • api/      │                   │                     │  │
│  │ • migrations│                   │  data/backups/      │  │
│  └─────────────┘                   └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Request Flow

When a user accesses an app, the request flows through these layers:

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│ Browser  │────▶│   Next.js   │────▶│   Middleware │────▶│  API Route  │────▶│   @citadel   │
│          │     │   Router    │     │   (CSP/Rate) │     │  Handler    │     │    /core     │
└──────────┘     └─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
                                                                                         │
                                                                                         ▼
                                                                              ┌──────────────┐
                                                                              │   SQLite     │
                                                                              │  (per-app)   │
                                                                              └──────────────┘
```

1. **Browser**: User requests `/apps/smart-notes` or `/api/apps/smart-notes/notes`
2. **Next.js Router**: Routes to the appropriate page or API handler
3. **Middleware**: Applies CSP headers and rate limiting
4. **API Route**: App-defined handler that uses core primitives
5. **@citadel/core**: Enforces permissions and executes database/storage operations
6. **SQLite**: Each app has its own isolated database file

## Host Runtime Model

The host is a Next.js application with a Node.js runtime. Key characteristics:

- **Server-side rendering**: All database operations happen server-side
- **In-process SQLite**: Uses `node:sqlite` for zero-dependency database access
- **Dynamic app loading**: Discovers apps from the `apps/` directory at startup
- **Hot reload**: App code changes are reflected without host restart in dev mode

### Startup Sequence

1. Load app manifests from `apps/` directory
2. Run pending migrations for all apps
3. Clean up old audit logs (90-day retention)
4. Start backup scheduler (24-hour interval)
5. Begin accepting HTTP requests

**Source**: [`host/src/app/layout.tsx`](https://github.com/rohan1chaudhari/citadel/blob/main/host/src/app/layout.tsx)

## Isolation Boundaries

Citadel enforces isolation at multiple layers:

### Database Isolation

Each app has its own SQLite database file:

```
data/apps/
├── smart-notes/
│   └── db.sqlite      # Only smart-notes can access
├── gym-tracker/
│   └── db.sqlite      # Only gym-tracker can access
└── citadel/
    └── db.sqlite      # Host system database
```

- Apps use `dbQuery()` and `dbExec()` from `@citadel/core`
- Each app ID maps to a unique database file path
- Database connections are cached per app for performance
- WAL mode enabled for better concurrency

**Source**: [`core/src/db.ts`](https://github.com/rohan1chaudhari/citadel/blob/main/core/src/db.ts)

### Storage Isolation

Each app has an isolated storage directory:

```
data/apps/:appId/storage/
```

- Apps use `storageReadText()` and `storageWriteBuffer()` from `@citadel/core`
- Path traversal attacks (`../`) are blocked
- All storage operations are permission-checked

**Source**: [`core/src/storage.ts`](https://github.com/rohan1chaudhari/citadel/blob/main/core/src/storage.ts)

### SQL Guardrails

To prevent SQL injection and unsafe operations:

- Multi-statement SQL is blocked (no semicolons)
- Blocked keywords: `ATTACH`, `DETACH`, `PRAGMA`, `VACUUM`
- Each query is logged for audit purposes

**Source**: [`core/src/sqlGuardrails.ts`](https://github.com/rohan1chaudhari/citadel/blob/main/core/src/sqlGuardrails.ts)

### App ID Validation

App IDs must match strict format rules:

```typescript
/^[a-z][a-z0-9-]{0,63}$/
```

- Lowercase letters, numbers, and hyphens only
- Must start with a letter
- 1-64 characters
- Reserved IDs blocked: `citadel`, `host`, `api`

**Source**: [`core/src/appIds.ts`](https://github.com/rohan1chaudhari/citadel/blob/main/core/src/appIds.ts)

## Permission System

Apps declare required permissions in their `app.yaml` manifest:

```yaml
permissions:
  db:
    read: true
    write: true
  storage:
    read: true
    write: true
  ai: true
  network:
    - api.openai.com
```

### Permission Enforcement

1. **First Launch**: User sees consent screen with requested permissions
2. **Grant Storage**: Permissions stored in `citadel` database
3. **Runtime Checks**: Every database/storage/AI operation validates permissions
4. **Denial Logging**: Failed permission checks are audited

### Permission Checks

| Operation | Required Permission | Enforcement |
|-----------|---------------------|-------------|
| `dbQuery()` | `db.read` | Throws if not granted |
| `dbExec()` | `db.write` | Throws if not granted |
| `storageReadText()` | `storage.read` | Throws if not granted |
| `storageWriteBuffer()` | `storage.write` | Throws if not granted |
| AI API routes | `ai` | Returns 403 if not granted |
| External fetch | `network` domain | Proxy-level blocking |

**Source**: [`core/src/permissions.ts`](https://github.com/rohan1chaudhari/citadel/blob/main/core/src/permissions.ts)

## Audit Pipeline

All security-relevant operations are logged:

```typescript
audit(appId, event, payload);
```

### Logged Events

- Database operations: `db.query`, `db.exec`, `db.query.denied`
- Storage operations: `storage.read`, `storage.write`, `storage.write.denied`
- Migrations: `migration.applied`, `migration.failed`
- CSP violations: `csp.violation`
- Backups: `backup.created`, `backup.failed`

### Storage

Audit logs are written to:

1. **stdout**: JSON format for logging aggregation
2. **SQLite**: `audit_log` table in the `citadel` database

```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  app_id TEXT NOT NULL,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_audit_app_ts ON audit_log(app_id, ts);
```

### Retention

- Auto-cleanup of logs older than 90 days on startup
- Configurable via `RETENTION_DAYS` constant

**Source**: [`core/src/audit.ts`](https://github.com/rohan1chaudhari/citadel/blob/main/core/src/audit.ts)

## Rate Limiting

Per-app rate limiting prevents abuse:

- **Default limit**: 120 requests/minute per app
- **Burst capacity**: 120 requests
- **Special apps**: `scrum-board` and `autopilot` get 600 req/min

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 119
X-RateLimit-Reset: 60
```

When exceeded:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
```

**Source**: [`host/src/lib/rateLimiter.ts`](https://github.com/rohan1chaudhari/citadel/blob/main/host/src/lib/rateLimiter.ts)

## Content Security Policy

Citadel uses restrictive CSP headers to prevent XSS:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}';
  style-src 'self' 'unsafe-inline';
  connect-src 'self';
  img-src 'self' blob:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  report-uri /api/csp-violation;
```

### CSP Violation Reporting

Violations are reported to `/api/csp-violation` and logged via audit:

```typescript
audit('citadel', 'csp.violation', {
  blockedUri: '...',
  violatedDirective: '...',
  sourceFile: '...',
});
```

**Source**: [`host/src/app/api/csp-violation/route.ts`](https://github.com/rohan1chaudhari/citadel/blob/main/host/src/app/api/csp-violation/route.ts)

## Migration System

Apps define database migrations in `migrations/`:

```
migrations/
├── 001_initial.sql
├── 002_add_feature.sql
└── 003_add_indexes.sql
```

### Migration Rules

1. Executed in lexicographic order
2. Each migration runs in a transaction
3. Applied migrations tracked in `citadel.migrations` table
4. Supports rollback with `.down.sql` files

### CLI Commands

```bash
citadel-app migrate <app-id>           # Run pending migrations
citadel-app migrate:rollback <app-id>  # Rollback last migration
```

**Source**: [`core/src/migrations.ts`](https://github.com/rohan1chaudhari/citadel/blob/main/core/src/migrations.ts)

## Backup System

Automatic backups protect user data:

- **Schedule**: Every 24 hours + on startup
- **Format**: ZIP archive of `data/apps/`
- **Retention**: Last 7 backups
- **Location**: `data/backups/citadel-backup-{timestamp}.zip`

### Manual Backup

```bash
citadel-app backup create
citadel-app backup list
citadel-app backup restore <file>
```

**Source**: [`host/src/lib/backup.ts`](https://github.com/rohan1chaudhari/citadel/blob/main/host/src/lib/backup.ts)

## Threat Model

### What Citadel Defends Against

| Threat | Defense |
|--------|---------|
| Cross-app data access | Per-app SQLite files with path isolation |
| Path traversal | Storage operations validate resolved paths |
| SQL injection | Guardrails block multi-statement and dangerous keywords |
| XSS | CSP headers restrict script execution |
| Clickjacking | `frame-ancestors 'none'` |
| Runaway apps | Per-app rate limiting |
| Permission escalation | Runtime permission checks on every operation |
| Audit log tampering | Dual-write to stdout + SQLite |

### What Requires Additional Protection

| Concern | Recommendation |
|---------|----------------|
| Network-level access | Use Tailscale or VPN |
| Public internet exposure | Enable auth layer (`CITADEL_AUTH_ENABLED`) |
| OS-level isolation | Use containers for untrusted apps (future) |
| Physical device access | Full-disk encryption |
| Supply chain attacks | Review app code before installing |

## App Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Create  │───▶│ Install  │───▶│ Migrate  │───▶│  Launch  │───▶│   Run    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
 citadel-app    Copy to      Run SQL        Permission    User interacts
 create         apps/        migrations     consent       with app
```

### Create

```bash
citadel-app create my-app --template=crud
```

Generates app structure from template.

### Install

```bash
citadel-app install ./my-app
# or
citadel-app install https://github.com/user/my-app
```

Copies app to `apps/` directory and validates manifest.

### Migrate

Runs pending migrations from `migrations/` directory.

### Launch

First visit triggers permission consent screen. User approves requested scopes.

### Run

App operates within granted permissions. All actions are audited.

## Code Locations

| Component | Path |
|-----------|------|
| Core primitives | `core/src/` |
| Host application | `host/src/` |
| App packages | `apps/` |
| App templates | `templates/` |
| Documentation | `docs/` |
| CLI scripts | `scripts/citadel-app` |

## Related Documentation

- [App Specification](./app-spec.md) - Manifest format and app structure
- [Build an App](./how-to/build-an-app.md) - Step-by-step tutorial
- [CLI Reference](./cli.md) - Command reference
- [API Reference](./api-reference.md) - Core primitive functions
