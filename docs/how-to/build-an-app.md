# Tutorial: Build a Complete Citadel App

This tutorial walks you through building a complete Citadel app from scratch — a **Task Manager** with full CRUD functionality. By the end, you'll have a working app with database persistence, API routes, and a polished UI.

## What You'll Build

A task management app where you can:
- Create tasks with title, description, and priority
- View all tasks in a sortable list
- Edit existing tasks
- Delete tasks with confirmation
- Filter by status (active/completed)

## Prerequisites

- Citadel host running (`npm run dev` in `host/`)
- Node.js 20+ installed
- Basic familiarity with TypeScript and React

## Step 1: Create the App Structure

Use the CLI to scaffold a new app:

```bash
cd /home/rohanchaudhari/personal/citadel
npm run citadel-app -- create task-manager --template crud
```

This creates `apps/task-manager/` with the CRUD template files.

::: tip
The `--template crud` flag gives you a working CRUD foundation. You can also use `--template blank` for a minimal starting point.
:::

## Step 2: Define the App Manifest

The manifest declares your app's identity and permissions. Edit `apps/task-manager/app.yaml`:

```yaml
id: task-manager
name: Task Manager
description: A simple task management app with priorities and status tracking
version: 0.1.0
manifest_version: "1.0"
permissions:
  db:
    read: true
    write: true
  storage:
    read: false
    write: false
connectors: []
```

### Understanding the Manifest

| Field | Purpose |
|-------|---------|
| `id` | Unique identifier (lowercase, alphanumeric + hyphens) |
| `name` | Human-readable name shown in the UI |
| `permissions.db` | Request database read/write access |
| `manifest_version` | Schema version for future compatibility |

## Step 3: Write the Database Migration

Citadel uses SQL migrations for schema management. Edit `apps/task-manager/migrations/001_initial.sql`:

```sql
-- Initial schema for task-manager app
-- Creates the tasks table with priority support

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TEXT NOT NULL,
  updated_at TEXT,
  completed_at TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
```

### Migration Rules

1. **File naming**: Use `001_`, `002_`, etc. for ordering
2. **Idempotency**: Always use `IF NOT EXISTS`
3. **Transactions**: Each migration runs in a transaction automatically
4. **Down migrations**: Optional `001_initial.down.sql` for rollbacks

## Step 4: Build the API Routes

### 4.1 List Tasks Endpoint

Create `host/src/app/api/apps/task-manager/tasks/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { dbQuery } from '@citadel/core';

export const runtime = 'nodejs';
const APP_ID = 'task-manager';

// GET /api/apps/task-manager/tasks
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  
  let sql = `
    SELECT id, title, description, priority, status, 
           created_at, updated_at, completed_at 
    FROM tasks 
    WHERE 1=1
  `;
  const params: (string | null)[] = [];
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY 
    CASE priority 
      WHEN "high" THEN 1 
      WHEN "medium" THEN 2 
      ELSE 3 
    END, 
    created_at DESC 
    LIMIT 500';
  
  const tasks = dbQuery<{
    id: number;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    created_at: string;
    updated_at: string | null;
    completed_at: string | null;
  }>(APP_ID, sql, params);

  return NextResponse.json({ ok: true, tasks });
}
```

### 4.2 Create Task Endpoint

Create `host/src/app/api/apps/task-manager/tasks/create/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { dbExec } from '@citadel/core';

export const runtime = 'nodejs';
const APP_ID = 'task-manager';

// POST /api/apps/task-manager/tasks/create
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  
  const title = String(body?.title ?? '').trim();
  const description = body?.description ? String(body.description).trim() : null;
  const priority = ['low', 'medium', 'high'].includes(body?.priority) 
    ? body.priority 
    : 'medium';

  if (!title) {
    return NextResponse.json(
      { ok: false, error: 'Title is required' }, 
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  
  const result = dbExec(
    APP_ID,
    `INSERT INTO tasks (title, description, priority, status, created_at) 
     VALUES (?, ?, ?, ?, ?)`,
    [title, description, priority, 'active', now]
  );

  return NextResponse.json({
    ok: true,
    id: result.lastInsertRowid,
    task: { 
      id: result.lastInsertRowid, 
      title, 
      description, 
      priority, 
      status: 'active', 
      created_at: now, 
      updated_at: null,
      completed_at: null
    }
  });
}
```

### 4.3 Update/Delete Task Endpoint

Create `host/src/app/api/apps/task-manager/tasks/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@citadel/core';

export const runtime = 'nodejs';
const APP_ID = 'task-manager';

// GET /api/apps/task-manager/tasks/123
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const task = dbQuery<{
    id: number;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    created_at: string;
    updated_at: string | null;
    completed_at: string | null;
  }>(
    APP_ID,
    'SELECT * FROM tasks WHERE id = ?',
    [id]
  )[0];

  if (!task) {
    return NextResponse.json(
      { ok: false, error: 'Task not found' }, 
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, task });
}

// PUT /api/apps/task-manager/tasks/123
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  
  const title = String(body?.title ?? '').trim();
  const description = body?.description !== undefined 
    ? String(body.description).trim() || null 
    : null;
  const priority = ['low', 'medium', 'high'].includes(body?.priority) 
    ? body.priority 
    : null;
  const status = body?.status === 'completed' || body?.status === 'active'
    ? body.status 
    : null;

  if (!title) {
    return NextResponse.json(
      { ok: false, error: 'Title is required' }, 
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const completedAt = status === 'completed' ? now : null;

  dbExec(
    APP_ID,
    `UPDATE tasks 
     SET title = ?, description = ?, priority = COALESCE(?, priority), 
         status = COALESCE(?, status), updated_at = ?, completed_at = COALESCE(?, completed_at)
     WHERE id = ?`,
    [title, description, priority, status, now, completedAt, id]
  );

  return NextResponse.json({ ok: true });
}

// DELETE /api/apps/task-manager/tasks/123
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  dbExec(APP_ID, 'DELETE FROM tasks WHERE id = ?', [id]);
  
  return NextResponse.json({ ok: true });
}
```

::: info API Route Conventions

- Use `export const runtime = 'nodejs'` for server-side SQLite access
- Route files map to URL paths: `tasks/[id]/route.ts` → `/api/apps/task-manager/tasks/123`
- Import core primitives from `@citadel/core`, not relative paths

:::

## Step 5: Build the UI Pages

### 5.1 Main Task List Page

Create `host/src/app/apps/task-manager/page.tsx`:

```typescript
import { Shell, LinkA, Card } from '@/components/Shell';
import { dbQuery } from '@citadel/core';
import { requirePermissionConsent } from '@/lib/requirePermissionConsent';

export const runtime = 'nodejs';
const APP_ID = 'task-manager';

interface Task {
  id: number;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string | null;
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors = {
    high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${colors[priority as keyof typeof colors] || colors.medium}`}>
      {priority}
    </span>
  );
}

export default async function TaskManagerPage() {
  await requirePermissionConsent(APP_ID);

  const tasks = dbQuery<Task>(
    APP_ID,
    `SELECT id, title, description, priority, status, created_at, updated_at 
     FROM tasks 
     ORDER BY 
       CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       created_at DESC 
     LIMIT 500`
  );

  const activeCount = tasks.filter(t => t.status === 'active').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  // Serialize to handle BigInt
  const serializedTasks = JSON.parse(
    JSON.stringify(tasks, (k, v) => (typeof v === 'bigint' ? Number(v) : v))
  );

  return (
    <Shell title="Task Manager" subtitle="Organize your work">
      <div className="flex items-center justify-between mb-6">
        <LinkA href="/">← home</LinkA>
        <LinkA 
          href="/apps/task-manager/new"
          className="inline-flex items-center px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
        >
          + New Task
        </LinkA>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="text-center">
          <div className="text-2xl font-bold">{tasks.length}</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Total Tasks</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{activeCount}</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Active</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Completed</div>
        </Card>
      </div>

      <Card>
        {serializedTasks.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <p className="text-lg mb-2">No tasks yet</p>
            <p className="text-sm">Create your first task to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {serializedTasks.map((task: Task) => (
              <a
                key={task.id}
                href={`/apps/task-manager/${task.id}`}
                className="block p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-medium truncate ${task.status === 'completed' ? 'line-through text-zinc-500' : ''}`}>
                        {task.title}
                      </h3>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    {task.description && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
                        {task.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400 ml-4">
                    {new Date(task.created_at).toLocaleDateString()}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </Card>
    </Shell>
  );
}
```

### 5.2 Create Task Page

Create `host/src/app/apps/task-manager/new/page.tsx`:

```typescript
'use client';

import { Shell, LinkA, Card } from '@/components/Shell';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewTaskPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const res = await fetch('/api/apps/task-manager/tasks/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formData.get('title'),
        description: formData.get('description'),
        priority: formData.get('priority'),
      }),
    });

    const data = await res.json();
    
    if (data.ok) {
      router.push('/apps/task-manager');
      router.refresh();
    } else {
      setError(data.error || 'Failed to create task');
      setSaving(false);
    }
  }

  return (
    <Shell title="New Task" subtitle="Create a new task">
      <div className="mb-6">
        <LinkA href="/apps/task-manager">← back to tasks</LinkA>
      </div>

      <Card className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              type="text"
              required
              maxLength={200}
              className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
              placeholder="What needs to be done?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              name="description"
              rows={3}
              maxLength={2000}
              className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
              placeholder="Add details..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select
              name="priority"
              defaultValue="medium"
              className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Task'}
            </button>
            <a
              href="/apps/task-manager"
              className="px-4 py-2 border rounded-md font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </a>
          </div>
        </form>
      </Card>
    </Shell>
  );
}
```

### 5.3 Edit Task Page

Create `host/src/app/apps/task-manager/[id]/page.tsx`:

```typescript
'use client';

import { Shell, LinkA, Card } from '@/components/Shell';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Task {
  id: number;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  created_at: string;
}

export default function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/apps/task-manager/tasks/${id}`)
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            setTask(data.task);
          } else {
            setError('Task not found');
          }
          setLoading(false);
        });
    });
  }, [params]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!task) return;
    
    setSaving(true);
    setError('');

    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const res = await fetch(`/api/apps/task-manager/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formData.get('title'),
        description: formData.get('description'),
        priority: formData.get('priority'),
        status: formData.get('status'),
      }),
    });

    const data = await res.json();
    
    if (data.ok) {
      router.push('/apps/task-manager');
      router.refresh();
    } else {
      setError(data.error || 'Failed to update task');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task || !confirm('Delete this task?')) return;
    
    setDeleting(true);
    
    const res = await fetch(`/api/apps/task-manager/tasks/${task.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      router.push('/apps/task-manager');
      router.refresh();
    } else {
      setError('Failed to delete task');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <Shell title="Edit Task" subtitle="Loading...">
        <div className="text-center py-12">Loading...</div>
      </Shell>
    );
  }

  if (error || !task) {
    return (
      <Shell title="Error" subtitle="">
        <div className="text-center py-12 text-red-600">{error || 'Task not found'}</div>
      </Shell>
    );
  }

  return (
    <Shell title="Edit Task" subtitle={task.title}>
      <div className="mb-6">
        <LinkA href="/apps/task-manager">← back to tasks</LinkA>
      </div>

      <Card className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              type="text"
              required
              defaultValue={task.title}
              maxLength={200}
              className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={task.description || ''}
              className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select
              name="priority"
              defaultValue={task.priority}
              className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              name="status"
              defaultValue={task.status}
              className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <a
              href="/apps/task-manager"
              className="px-4 py-2 border rounded-md font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </a>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 disabled:opacity-50 ml-auto"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </form>
      </Card>
    </Shell>
  );
}
```

## Step 6: Run Migrations and Build

### 6.1 Run the Migration

The host automatically runs migrations on startup, but you can trigger them manually:

```bash
cd /home/rohanchaudhari/personal/citadel
npm run citadel-app -- migrate task-manager
```

### 6.2 Build the Host

```bash
cd host
npm run build
```

If the build succeeds, your app is ready!

## Step 7: Test the App

1. Open `http://localhost:3000` in your browser
2. You should see "Task Manager" in the app grid
3. Click it — you'll see a permission consent screen (first launch only)
4. Approve the database permissions
5. Try creating, editing, and deleting tasks

## Key Concepts Reference

### Host Primitives API

| Function | Purpose | Import |
|----------|---------|--------|
| `dbQuery(appId, sql, params?)` | Execute SELECT queries | `@citadel/core` |
| `dbExec(appId, sql, params?)` | Execute INSERT/UPDATE/DELETE | `@citadel/core` |
| `storageReadText(appId, path)` | Read a text file from app storage | `@citadel/core` |
| `storageWriteText(appId, path, content)` | Write a text file to app storage | `@citadel/core` |

See [API Reference](../api-reference.md) for complete documentation of all `@citadel/core` primitives, including signatures, parameters, return types, and error cases.

### UI Components

| Component | Purpose |
|-----------|---------|
| `<Shell>` | App container with title/subtitle |
| `<Card>` | Styled container with padding |
| `<LinkA>` | Styled anchor link |

### Permission Flow

1. App declares permissions in `app.yaml`
2. First launch shows consent screen
3. User approves/denies each scope
4. Approved permissions stored in host DB
5. All DB/storage calls are validated against granted permissions

## Troubleshooting

### "Permission denied" errors
- Check that the user approved permissions on first launch
- Visit the app's permission settings to re-grant

### Database errors
- Verify migrations ran: `npm run citadel-app -- migrate task-manager`
- Check migration syntax (missing semicolons, typos)

### Build errors
- Ensure all imports use `@citadel/core` (not relative paths to core)
- Verify `export const runtime = 'nodejs'` in all server files

### App not appearing
- Check `app.yaml` has valid `id` and `name`
- Verify host build completed successfully
- Restart the host dev server

## Next Steps

- Add search/filter functionality to the task list
- Implement drag-and-drop reordering
- Add due dates with calendar integration
- Create a dashboard template with charts

See the CRUD Template at `templates/crud/` for more advanced patterns.

## Complete File Reference

Your `apps/task-manager/` directory should contain:

```
task-manager/
├── app.yaml                    # Manifest
├── migrations/
│   └── 001_initial.sql         # Database schema
└── host/src/app/
    ├── apps/task-manager/
    │   ├── page.tsx            # Task list
    │   ├── new/
    │   │   └── page.tsx        # Create form
    │   └── [id]/
    │       └── page.tsx        # Edit form
    └── api/apps/task-manager/
        └── tasks/
            ├── route.ts        # List endpoint
            ├── create/
            │   └── route.ts    # Create endpoint
            └── [id]/
                └── route.ts    # Get/Update/Delete endpoint
```

Happy building! 🏰
