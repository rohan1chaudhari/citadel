import { NextResponse } from 'next/server';
import { dbExec } from '@/lib/db';
import { audit } from '@/lib/audit';

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

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  ensureSchema();
  const { id } = await ctx.params;
  const noteId = Number(id);
  if (!Number.isFinite(noteId)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });

  dbExec(APP_ID, `UPDATE notes SET deleted_at = NULL, updated_at = ? WHERE id = ?`, [new Date().toISOString(), noteId]);
  audit(APP_ID, 'notes.restore', { id: noteId, mode: 'form' });

  return NextResponse.redirect(new URL('/apps/smart-notes/trash', req.url));
}
