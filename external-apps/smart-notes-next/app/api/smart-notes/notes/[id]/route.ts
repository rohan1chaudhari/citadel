import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { audit } from '@/lib/audit';
import { ensureSmartNotesSchema } from '@/lib/smartNotesSchema';

export const runtime = 'nodejs';
const APP_ID = 'smart-notes';

function ensureSchema() {
  ensureSmartNotesSchema();
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    ensureSchema();

    const { id } = await ctx.params;
    const noteId = Number(id);
    if (!Number.isFinite(noteId)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });

    const rows = dbQuery<any>(
      APP_ID,
      `SELECT id, title, body, tags, created_at, updated_at, deleted_at, pinned FROM notes WHERE id = ? LIMIT 1`,
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

    const body = await req.json().catch(() => ({} as any));

    // Restore from trash
    if (body && body.restore === true) {
      dbExec(APP_ID, `UPDATE notes SET deleted_at = NULL, updated_at = ? WHERE id = ?`, [new Date().toISOString(), noteId]);
      audit(APP_ID, 'notes.restore', { id: noteId, mode: 'json' });
      return NextResponse.json({ ok: true });
    }

    const title = typeof body.title === 'string' ? body.title.slice(0, 200) : '';
    const text = typeof body.body === 'string' ? body.body : '';
    const tags = typeof body.tags === 'string' ? body.tags.slice(0, 400) : '';
    const pinned = typeof body.pinned === 'boolean' ? (body.pinned ? 1 : 0) : null;

    if (pinned === null) {
      dbExec(APP_ID, `UPDATE notes SET title = ?, body = ?, tags = ?, updated_at = ? WHERE id = ?`, [title, text, tags, new Date().toISOString(), noteId]);
    } else {
      dbExec(APP_ID, `UPDATE notes SET title = ?, body = ?, tags = ?, pinned = ?, updated_at = ? WHERE id = ?`, [
        title,
        text,
        tags,
        pinned,
        new Date().toISOString(),
        noteId
      ]);
    }

    audit(APP_ID, 'notes.update', { id: noteId, titleLen: title.length, bodyLen: text.length, tagsLen: tags.length, pinned, mode: 'json' });

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
