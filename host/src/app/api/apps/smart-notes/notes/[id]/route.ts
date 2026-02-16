import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
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
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    ensureSchema();

    const { id } = await ctx.params;
    const noteId = Number(id);
    if (!Number.isFinite(noteId)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });

    const rows = dbQuery<any>(
      APP_ID,
      `SELECT id, title, body, created_at, updated_at, deleted_at FROM notes WHERE id = ? LIMIT 1`,
      [noteId]
    );
    const note = rows[0];
    if (!note) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
    if (note.deleted_at) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

    return NextResponse.json({ ok: true, note });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    ensureSchema();
    const { id } = await ctx.params;
    const noteId = Number(id);
    if (!Number.isFinite(noteId)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.slice(0, 200) : '';
    const text = typeof body.body === 'string' ? body.body : '';

    dbExec(APP_ID, `UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?`, [title, text, new Date().toISOString(), noteId]);
    audit(APP_ID, 'notes.update', { id: noteId, titleLen: title.length, bodyLen: text.length, mode: 'json' });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    ensureSchema();
    const { id } = await ctx.params;
    const noteId = Number(id);
    if (!Number.isFinite(noteId)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });

    dbExec(APP_ID, `UPDATE notes SET deleted_at = ? WHERE id = ?`, [new Date().toISOString(), noteId]);
    audit(APP_ID, 'notes.soft_delete', { id: noteId, mode: 'json' });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
