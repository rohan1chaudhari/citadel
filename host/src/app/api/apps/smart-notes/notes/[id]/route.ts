import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

export const runtime = 'nodejs';
const APP_ID = 'smart-notes';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const noteId = Number(id);
  if (!Number.isFinite(noteId)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });

  const rows = dbQuery<any>(
    APP_ID,
    `SELECT id, title, body, created_at, updated_at FROM notes WHERE id = ? LIMIT 1`,
    [noteId]
  );
  const note = rows[0];
  if (!note) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });

  return NextResponse.json({ ok: true, note });
}
