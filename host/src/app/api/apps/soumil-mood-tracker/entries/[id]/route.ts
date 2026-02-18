import { NextResponse } from 'next/server';
import { dbExec } from '@/lib/db';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
const APP_ID = 'soumil-mood-tracker';

function ensureSchema() {
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS mood_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      mood INTEGER NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )`
  );
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  ensureSchema();
  const id = Number((await params).id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 });
  }

  dbExec(APP_ID, `DELETE FROM mood_entries WHERE id = ?`, [id]);
  audit(APP_ID, 'mood_entries.delete', { id });
  return NextResponse.json({ ok: true });
}
