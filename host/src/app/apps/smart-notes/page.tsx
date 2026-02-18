import { LinkA, Shell } from '@/components/Shell';
import { dbExec, dbQuery } from '@/lib/db';
import { SmartNotesClient } from './SmartNotesClient';

export const runtime = 'nodejs';
const APP_ID = 'smart-notes';

function ensureSchema() {
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      body TEXT,
      created_at TEXT NOT NULL
    )`
  );
  try {
    dbExec(APP_ID, `ALTER TABLE notes ADD COLUMN updated_at TEXT`);
  } catch {
    // ignore
  }
  try {
    dbExec(APP_ID, `ALTER TABLE notes ADD COLUMN deleted_at TEXT`);
  } catch {
    // ignore
  }
  try {
    dbExec(APP_ID, `ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // ignore
  }
  try {
    dbExec(APP_ID, `ALTER TABLE notes ADD COLUMN tags TEXT`);
  } catch {
    // ignore
  }
}

export default async function SmartNotesPage() {
  ensureSchema();
  const rows = dbQuery<any>(
    APP_ID,
    `SELECT id, title, body, tags, created_at, updated_at, pinned
     FROM notes
     WHERE deleted_at IS NULL
     ORDER BY pinned DESC, COALESCE(updated_at, created_at) DESC, id DESC
     LIMIT 50`
  );

  // Client Components require plain JSON-serializable objects.
  // node:sqlite may return objects with non-standard prototypes.
  const notes = rows.map((r: any) => ({
    id: Number(r.id),
    title: r.title ?? null,
    body: r.body ?? null,
    tags: r.tags ?? null,
    created_at: String(r.created_at),
    updated_at: r.updated_at ?? null,
    pinned: Number(r.pinned ?? 0)
  }));

  return (
    <Shell title="Smart Notes" subtitle="Markdown notes with autosave">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-3">
          <LinkA href="/apps/smart-notes/trash">Trash</LinkA>
          <div className="text-xs text-zinc-500">Local-first</div>
        </div>
      </div>
      <SmartNotesClient initialNotes={notes} />
    </Shell>
  );
}
