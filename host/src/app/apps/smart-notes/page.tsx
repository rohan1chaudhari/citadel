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
}

export default async function SmartNotesPage() {
  ensureSchema();
  const rows = dbQuery<any>(APP_ID, `SELECT id, title, body, created_at, updated_at FROM notes ORDER BY id DESC LIMIT 50`);

  // Client Components require plain JSON-serializable objects.
  // node:sqlite may return objects with non-standard prototypes.
  const notes = rows.map((r: any) => ({
    id: Number(r.id),
    title: r.title ?? null,
    body: r.body ?? null,
    created_at: String(r.created_at),
    updated_at: r.updated_at ?? null
  }));

  return (
    <Shell title="Smart Notes" subtitle="Markdown notes with autosave">
      <div className="flex items-center justify-between">
        <LinkA href="/">← home</LinkA>
        <div className="text-xs text-zinc-500">Local-first</div>
      </div>
      <SmartNotesClient initialNotes={notes} />
    </Shell>
  );
}
