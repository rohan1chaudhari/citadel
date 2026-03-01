# Citadel App Package Specification

This document defines the canonical structure of a Citadel app package — the contract between app developers and the host.

## Overview

A Citadel app is a self-contained package that includes:
- A manifest file declaring metadata and permissions
- UI pages served under `/apps/{appId}`
- API routes served under `/api/apps/{appId}`
- Optional database migrations
- Optional static assets

## Directory Structure

```
my-app/
├── app.yaml              # Manifest (REQUIRED)
├── README.md             # Documentation (recommended)
├── migrations/           # Database migrations (optional)
│   ├── 001_initial.sql
│   └── 002_add_feature.sql
├── page.tsx              # Main UI page (host/src/app/apps/{appId}/)
└── api/                  # API routes (host/src/app/api/apps/{appId}/)
    └── route.ts
```

## Manifest Format (app.yaml)

The manifest is the entry point for app discovery and registration.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique app identifier. Must be lowercase alphanumeric with hyphens (1-64 chars). Cannot contain spaces or special characters. |
| `name` | string | Human-readable app name displayed in the UI. |
| `version` | string | Semantic version (e.g., `0.1.0`). |
| `permissions` | object | Declares required permissions (see below). |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Short description of the app's purpose. |
| `icon` | string | Path to app icon relative to package root. Defaults to `{appId}-logo.png` in host public folder. |
| `author` | string | Author name or organization. |
| `homepage` | string | URL to project homepage or documentation. |
| `dependencies` | array | List of required host features or other apps. |
| `hidden` | boolean | If true, app is hidden from home grid (useful for meta-apps). |

### Example Manifest

```yaml
id: my-app
name: My Application
description: Does something useful
version: 0.1.0
author: Jane Doe
homepage: https://example.com/my-app
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
    - *.example.com
```

## Permissions

Apps must declare all permissions they need. The host shows a consent screen on first launch.

### Database (`db`)

```yaml
permissions:
  db:
    read: true   # Can query the app's SQLite database
    write: true  # Can execute INSERT/UPDATE/DELETE
```

Each app gets its own isolated SQLite database file. Apps cannot access other apps' databases.

### Storage (`storage`)

```yaml
permissions:
  storage:
    read: true   # Can read files from app's storage directory
    write: true  # Can write files to app's storage directory
```

Each app has an isolated storage directory. Path traversal (`../`) is blocked.

### AI (`ai`)

```yaml
permissions:
  ai: true  # Can call AI API routes (requires OPENAI_API_KEY on host)
```

Allows access to host-provided AI endpoints like transcription and vision processing.

### Network (`network`)

```yaml
permissions:
  network:
    - api.example.com
    - *.openai.com
```

Lists allowed external domains. Wildcards (`*.`) are supported. If not specified, external network calls are blocked.

## UI Entry Point

The app's main page is served at `/apps/{appId}`. The host expects:

```typescript
// host/src/app/apps/{appId}/page.tsx
import { Shell } from '@/components/Shell';
import { dbQuery } from '@citadel/core';

export const runtime = 'nodejs';
const APP_ID = 'my-app';

export default async function MyAppPage() {
  // Your app logic here
  return (
    <Shell title="My App" subtitle="Welcome">
      {/* Your UI */}
    </Shell>
  );
}
```

### Guidelines

- Always use `export const runtime = 'nodejs'` for server-side SQLite access
- Import core primitives from `@citadel/core` (not relative paths)
- Use `<Shell>` component for consistent layout
- Handle permission consent with `requirePermissionConsent(APP_ID)`

## API Route Convention

API routes are served under `/api/apps/{appId}/*`. The host supports standard Next.js App Router conventions:

```typescript
// host/src/app/api/apps/{appId}/route.ts
import { NextResponse } from 'next/server';
import { dbQuery, dbExec } from '@citadel/core';

export const runtime = 'nodejs';
const APP_ID = 'my-app';

export async function GET(req: Request) {
  const data = dbQuery(APP_ID, 'SELECT * FROM items');
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  const body = await req.json();
  dbExec(APP_ID, 'INSERT INTO items (name) VALUES (?)', [body.name]);
  return NextResponse.json({ ok: true });
}
```

### Nested Routes

```
host/src/app/api/apps/{appId}/
├── route.ts           # GET /api/apps/{appId}
├── items/
│   └── route.ts       # GET/POST /api/apps/{appId}/items
└── items/[id]/
    └── route.ts       # GET/PUT/DELETE /api/apps/{appId}/items/123
```

## Migration Convention

Database migrations are SQL files in the app's `migrations/` directory:

```
migrations/
├── 001_initial.sql
├── 002_add_users.sql
└── 003_add_indexes.sql
```

### Migration File Format

Each file contains one or more SQL statements:

```sql
-- migrations/001_initial.sql
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  body TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);
```

### Migration Rules

1. Files are executed in lexicographic order (001, 002, 003...)
2. Each migration runs in a transaction (rolls back on error)
3. The host tracks applied migrations in the `citadel` database
4. Migrations are idempotent (use `IF NOT EXISTS` for CREATE statements)
5. Down migrations are optional: `001_initial.down.sql`

## Asset Handling

### App Icon

Place the app icon at:

```
host/public/app-logos/{appId}-logo.png
```

- Recommended size: 1024x1024 pixels
- Format: PNG with transparency
- Style: Modern flat design, consistent with platform

### Static Assets

Apps can serve static files from their storage directory:

```typescript
import { storageReadBuffer } from '@citadel/core';

const image = await storageReadBuffer(APP_ID, 'uploads/photo.jpg');
```

## App ID Validation

App IDs must follow these rules:

- Lowercase letters, numbers, and hyphens only: `^[a-z0-9-]+$`
- Must start with a letter
- 1-64 characters long
- Cannot be: `citadel`, `host`, `api`, `static`
- Cannot contain consecutive hyphens or end with a hyphen

Good: `smart-notes`, `gym-tracker`, `todo-app-v2`
Bad: `MyApp`, `my_app`, `my--app`, `api`, `-myapp`

## Security Model

### Isolation Guarantees

1. **Database isolation**: Each app has its own SQLite file
2. **Storage isolation**: Apps cannot read/write outside their directory
3. **Permission gating**: Host blocks unauthorized DB/storage/API calls
4. **CSP headers**: Apps run with restrictive Content-Security-Policy

### Permission Enforcement

The host validates all permission checks:

```typescript
// These will throw if permissions not granted
import { dbQuery, storageWriteBuffer } from '@citadel/core';

dbQuery('other-app', 'SELECT * FROM data'); // ❌ Blocked
storageWriteBuffer('other-app', 'path', data); // ❌ Blocked
```

## Schema Versions

The manifest format may evolve. The current version is **1.0**.

Future versions will be indicated with:

```yaml
manifest_version: "1.1"
```

If not specified, defaults to `1.0`.

## Example: Minimal App

```yaml
# app.yaml
id: hello-world
name: Hello World
version: 0.1.0
permissions:
  db:
    read: true
    write: true
```

```typescript
// host/src/app/apps/hello-world/page.tsx
import { Shell } from '@/components/Shell';
export const runtime = 'nodejs';
export default function Page() {
  return <Shell title="Hello">World!</Shell>;
}
```

```sql
-- migrations/001_initial.sql
CREATE TABLE IF NOT EXISTS greetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT
);
INSERT INTO greetings (message) VALUES ('Hello, Citadel!');
```

## See Also

- [Runtime API](./RUNTIME.md) - Host primitives reference
- [CLI Guide](./cli.md) - `citadel-app` commands
- Example App at `docs/examples/hello-world/` - Complete working example
