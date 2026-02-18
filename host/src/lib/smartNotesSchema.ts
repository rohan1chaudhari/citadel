import { dbExec, dbQuery } from '@/lib/db';

const APP_ID = 'smart-notes';

export function ensureSmartNotesSchema() {
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      body TEXT,
      created_at TEXT NOT NULL
    )`
  );

  const cols = new Set(
    dbQuery<{ name: string }>(APP_ID, `SELECT name FROM pragma_table_info('notes')`).map((c) => c.name)
  );

  if (!cols.has('updated_at')) dbExec(APP_ID, `ALTER TABLE notes ADD COLUMN updated_at TEXT`);
  if (!cols.has('deleted_at')) dbExec(APP_ID, `ALTER TABLE notes ADD COLUMN deleted_at TEXT`);
  if (!cols.has('pinned')) dbExec(APP_ID, `ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
  if (!cols.has('tags')) dbExec(APP_ID, `ALTER TABLE notes ADD COLUMN tags TEXT`);

  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(pinned)`);
}
