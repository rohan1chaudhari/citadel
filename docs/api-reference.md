# API Reference

Complete reference for the `@citadel/core` primitives that apps use to interact with the host platform.

## Overview

Citadel apps run in a sandboxed environment with explicit access to platform primitives. All data operations go through the host, which enforces isolation and permissions.

```typescript
import { dbQuery, dbExec, storageReadText, storageWriteBuffer, audit } from '@citadel/core';
```

---

## Database

### `dbQuery<T>(appId, sql, params?)`

Execute a read-only SQL query and return results.

**Signature:**
```typescript
function dbQuery<T = unknown>(
  appId: string,
  sql: string,
  params?: unknown[]
): T[]
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `appId` | `string` | Your app's unique identifier |
| `sql` | `string` | SELECT SQL statement |
| `params` | `unknown[]` | (Optional) Positional parameters for the query |

**Returns:** Array of rows typed as `T[]`

**Required Permission:** `db.read`

**Example:**
```typescript
import { dbQuery } from '@citadel/core';

// Simple query
const notes = dbQuery<{ id: number; title: string; content: string }>(
  'my-app',
  'SELECT id, title, content FROM notes ORDER BY created_at DESC'
);

// With parameters (use positional placeholders)
const note = dbQuery(
  'my-app',
  'SELECT * FROM notes WHERE id = ?',
  [42]
);
```

**Error Cases:**
- Throws if `appId` is invalid (must be lowercase alphanumeric + hyphens)
- Throws if SQL contains blocked operations (`ATTACH`, `DETACH`, `PRAGMA`, `VACUUM`, multi-statements)
- Throws if app lacks `db.read` permission

---

### `dbExec(appId, sql, params?)`

Execute a write SQL statement (INSERT, UPDATE, DELETE, CREATE TABLE, etc.).

**Signature:**
```typescript
function dbExec(
  appId: string,
  sql: string,
  params?: unknown[]
): { changes: number; lastInsertRowid: number | bigint }
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `appId` | `string` | Your app's unique identifier |
| `sql` | `string` | SQL statement to execute |
| `params` | `unknown[]` | (Optional) Positional parameters |

**Returns:** Object with `changes` (number of affected rows) and `lastInsertRowid`

**Required Permission:** `db.write` for mutations, `db.read` for CREATE TABLE

**Example:**
```typescript
import { dbExec } from '@citadel/core';

// Create table
 dbExec('my-app', `
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Insert
const result = dbExec(
  'my-app',
  'INSERT INTO notes (title, content) VALUES (?, ?)',
  ['My Note', 'This is the content']
);
console.log(`Created note ${result.lastInsertRowid}`);

// Update
const update = dbExec(
  'my-app',
  'UPDATE notes SET title = ? WHERE id = ?',
  ['Updated Title', 42]
);
console.log(`Updated ${update.changes} row(s)`);
```

**Error Cases:**
- Throws if `appId` is invalid
- Throws if SQL contains blocked operations
- Throws if app lacks required permission (`db.read` for read operations, `db.write` for mutations)
- Throws on SQL syntax errors or constraint violations

---

## Storage

### `storageReadText(appId, relPath)`

Read a text file from your app's storage directory.

**Signature:**
```typescript
async function storageReadText(
  appId: string,
  relPath: string
): Promise<string>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `appId` | `string` | Your app's unique identifier |
| `relPath` | `string` | Relative path within your app's storage root |

**Returns:** File contents as UTF-8 string

**Required Permission:** `storage.read`

**Example:**
```typescript
import { storageReadText } from '@citadel/core';

const config = await storageReadText('my-app', 'config/settings.json');
const settings = JSON.parse(config);
```

**Error Cases:**
- Throws if `appId` is invalid
- Throws if path escapes app storage root (`../` attacks are blocked)
- Throws if app lacks `storage.read` permission
- Throws if file does not exist

---

### `storageWriteText(appId, relPath, content)`

Write a text file to your app's storage directory.

**Signature:**
```typescript
async function storageWriteText(
  appId: string,
  relPath: string,
  content: string
): Promise<void>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `appId` | `string` | Your app's unique identifier |
| `relPath` | `string` | Relative path within your app's storage root |
| `content` | `string` | Text content to write |

**Required Permission:** `storage.write`

**Example:**
```typescript
import { storageWriteText } from '@citadel/core';

await storageWriteText(
  'my-app',
  'exports/backup-2024.json',
  JSON.stringify(data, null, 2)
);
```

**Error Cases:**
- Throws if `appId` is invalid
- Throws if path escapes app storage root
- Throws if app lacks `storage.write` permission

---

### `storageWriteBuffer(appId, relPath, buffer)`

Write binary data to your app's storage directory.

**Signature:**
```typescript
async function storageWriteBuffer(
  appId: string,
  relPath: string,
  buffer: Uint8Array
): Promise<void>
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `appId` | `string` | Your app's unique identifier |
| `relPath` | `string` | Relative path within your app's storage root |
| `buffer` | `Uint8Array` | Binary data to write |

**Required Permission:** `storage.write`

**Example:**
```typescript
import { storageWriteBuffer } from '@citadel/core';

// Save an uploaded image
await storageWriteBuffer(
  'my-app',
  `uploads/${fileName}`,
  new Uint8Array(await file.arrayBuffer())
);
```

**Error Cases:**
- Throws if `appId` is invalid
- Throws if path escapes app storage root
- Throws if app lacks `storage.write` permission

---

## Audit Logging

### `audit(appId, event, payload?)`

Emit an audit event that is logged to stdout and persisted to the Citadel audit log.

**Signature:**
```typescript
function audit(
  appId: string,
  event: string,
  payload?: Record<string, unknown>
): void
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `appId` | `string` | Your app's unique identifier |
| `event` | `string` | Event type/name (e.g., `note.created`, `user.login`) |
| `payload` | `object` | (Optional) Additional context data |

**Example:**
```typescript
import { audit } from '@citadel/core';

audit('my-app', 'note.created', { noteId: 42, title: 'Hello World' });
audit('my-app', 'user.action', { action: 'export', format: 'json' });
```

**Notes:**
- Events are written to stdout (for dev/debugging) and to the `audit_log` table
- Logs older than 90 days are automatically cleaned up
- Use for security-relevant events, not high-frequency metrics

---

## Validation

### `assertAppId(appId)`

Validate that an app ID conforms to Citadel's naming conventions.

**Signature:**
```typescript
function assertAppId(appId: string): asserts appId is string
```

**Valid Format:**
- Must start with a lowercase letter
- Can contain lowercase letters, numbers, and hyphens
- Length: 1-64 characters
- Regex: `/^[a-z][a-z0-9-]{0,63}$/`

**Example:**
```typescript
import { assertAppId } from '@citadel/core';

try {
  assertAppId('my-app');      // ✅ OK
  assertAppId('MyApp');       // ❌ Throws (uppercase)
  assertAppId('123-app');     // ❌ Throws (starts with number)
  assertAppId('my_app');      // ❌ Throws (underscore)
} catch (e) {
  console.error('Invalid app ID:', e.message);
}
```

---

## SQL Guardrails

### `assertSqlAllowed(sql)`

Check that SQL does not contain blocked operations.

**Signature:**
```typescript
function assertSqlAllowed(sql: string): void
```

**Blocked Operations:**
| Pattern | Reason Blocked |
|---------|---------------|
| `ATTACH` | Could access other apps' databases |
| `DETACH` | Could disrupt isolation |
| `PRAGMA` | Could modify unsafe settings |
| `VACUUM` | Resource-intensive, could lock DB |
| Multiple statements (`;`) | Prevents injection attacks |

**Example:**
```typescript
import { assertSqlAllowed } from '@citadel/core';

try {
  assertSqlAllowed('SELECT * FROM notes');           // ✅ OK
  assertSqlAllowed('ATTACH DATABASE "other.db"');    // ❌ Throws
} catch (e) {
  console.error('SQL not allowed:', e.message);
}
```

---

## Migrations

### `runMigrationsForApp(appId)`

Run pending migrations for an app from its `migrations/` directory.

**Signature:**
```typescript
async function runMigrationsForApp(
  appId: string
): Promise<{
  applied: string[];      // Migration files that ran
  skipped: string[];      // Already applied
  failed?: {              // First failure (if any)
    file: string;
    error: string;
  };
}>
```

**Migration Files:**
- Placed in `migrations/` directory alongside `app.yaml`
- Named sequentially: `001_initial.sql`, `002_add_tags.sql`, etc.
- Down migrations (optional): `001_initial.down.sql`

**Example:**
```typescript
import { runMigrationsForApp } from '@citadel/core';

const result = await runMigrationsForApp('my-app');
console.log(`Applied: ${result.applied.join(', ')}`);
console.log(`Skipped: ${result.skipped.join(', ')}`);
```

**Error Handling:**
- Migrations run in transactions — failures roll back
- Stops at first failure
- Audit events emitted for each applied/failed migration

---

### `rollbackMigrationsForApp(appId, steps?)`

Rollback the last N migrations for an app.

**Signature:**
```typescript
async function rollbackMigrationsForApp(
  appId: string,
  steps?: number  // default: 1
): Promise<{
  rolledBack: string[];
  skipped: string[];
  failed?: { file: string; error: string };
}>
```

**Requirements:**
- Down migration file must exist (e.g., `001_initial.down.sql`)
- Each rollback runs in a transaction

**Example:**
```typescript
import { rollbackMigrationsForApp } from '@citadel/core';

// Rollback the last migration
const result = await rollbackMigrationsForApp('my-app');

// Rollback the last 3 migrations
const result = await rollbackMigrationsForApp('my-app', 3);
```

---

## Registry

### `getAppManifest(appId)`

Read and parse an app's manifest (`app.yaml`).

**Signature:**
```typescript
async function getAppManifest(appId: string): Promise<AppManifest | null>
```

**Returns:** Parsed manifest or `null` if not found

**Example:**
```typescript
import { getAppManifest } from '@citadel/core';

const manifest = await getAppManifest('smart-notes');
console.log(manifest?.name);        // "Smart Notes"
console.log(manifest?.permissions); // { db: { read: true, write: true } }
```

---

### `listApps()`

List all installed apps.

**Signature:**
```typescript
async function listApps(): Promise<AppManifest[]>
```

**Example:**
```typescript
import { listApps } from '@citadel/core';

const apps = await listApps();
for (const app of apps) {
  console.log(`${app.name} (${app.id})`);
}
```

---

## Permissions

### `hasDbPermission(appId, operation)`

Check if an app has database permission.

**Signature:**
```typescript
function hasDbPermission(
  appId: string,
  operation: 'read' | 'write'
): boolean
```

**Example:**
```typescript
import { hasDbPermission } from '@citadel/core';

if (hasDbPermission('my-app', 'write')) {
  // Safe to perform writes
}
```

---

### `hasStoragePermission(appId, operation)`

Check if an app has storage permission.

**Signature:**
```typescript
function hasStoragePermission(
  appId: string,
  operation: 'read' | 'write'
): boolean
```

---

### `getAppPermissions(appId)`

Get granted permissions for an app.

**Signature:**
```typescript
function getAppPermissions(appId: string): AppPermissions | null
```

**Returns:** Permissions object or `null` if none granted

```typescript
interface AppPermissions {
  db?: { read?: boolean; write?: boolean };
  storage?: { read?: boolean; write?: boolean };
  ai?: boolean;
  network?: string[];
}
```

---

## Complete Example

Here's a complete example combining multiple primitives:

```typescript
// apps/my-notes/page.tsx
import { 
  dbQuery, 
  dbExec, 
  storageWriteText, 
  audit 
} from '@citadel/core';

// App ID (from app.yaml)
const APP_ID = 'my-notes';

// Query notes
export function getNotes() {
  return dbQuery<{ id: number; title: string }>(
    APP_ID,
    'SELECT id, title FROM notes ORDER BY created_at DESC'
  );
}

// Create a note
export function createNote(title: string, content: string) {
  const result = dbExec(
    APP_ID,
    'INSERT INTO notes (title, content) VALUES (?, ?)',
    [title, content]
  );
  
  audit(APP_ID, 'note.created', { 
    noteId: result.lastInsertRowid,
    title 
  });
  
  return result.lastInsertRowid;
}

// Export notes to file
export async function exportNotes() {
  const notes = dbQuery(APP_ID, 'SELECT * FROM notes');
  const json = JSON.stringify(notes, null, 2);
  
  const timestamp = new Date().toISOString().split('T')[0];
  await storageWriteText(APP_ID, `exports/notes-${timestamp}.json`, json);
  
  audit(APP_ID, 'notes.exported', { count: notes.length });
}
```

---

## Error Reference

Common errors and their meanings:

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid appId: ...` | App ID doesn't match regex | Use lowercase, start with letter, hyphens only |
| `Path escapes app storage root` | Path contains `../` | Use relative paths only, no traversal |
| `Permission denied: app '...' does not have db.read permission` | Missing permission | Declare in `app.yaml`, get user consent |
| `SQL contains blocked keyword: ...` | Blocked SQL operation | Rewrite query without ATTACH/PRAGMA/etc. |
| `SQLITE_CONSTRAINT_UNIQUE` | Duplicate key | Check for existing records before insert |

---

## See Also

- [App Spec](./app-spec.md) — Complete app manifest reference
- [Build an App](./how-to/build-an-app.md) — Step-by-step tutorial
- [Architecture](./architecture.md) — Platform design and threat model
