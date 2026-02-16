import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';

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
  try { dbExec(APP_ID, `ALTER TABLE notes ADD COLUMN updated_at TEXT`); } catch {}
  try { dbExec(APP_ID, `ALTER TABLE notes ADD COLUMN deleted_at TEXT`); } catch {}
}

export async function GET() {
  ensureSchema();
  const notes = dbQuery<any>(
    APP_ID,
    `SELECT id, title, body, created_at, updated_at, deleted_at
     FROM notes
     WHERE deleted_at IS NOT NULL
     ORDER BY deleted_at DESC, id DESC
     LIMIT 200`
  );
  return NextResponse.json({ ok: true, notes });
}
