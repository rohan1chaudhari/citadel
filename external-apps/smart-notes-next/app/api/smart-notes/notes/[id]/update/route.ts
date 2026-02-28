import { NextResponse } from 'next/server';
import { dbExec } from '@/lib/db';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
const APP_ID = 'smart-notes';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const noteId = Number(id);
  if (!Number.isFinite(noteId)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });

  const form = await req.formData();
  const title = String(form.get('title') ?? '').slice(0, 200);
  const body = String(form.get('body') ?? '');

  dbExec(APP_ID, `UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?`, [title, body, new Date().toISOString(), noteId]);
  audit(APP_ID, 'notes.update', { id: noteId, titleLen: title.length, bodyLen: body.length });

  return NextResponse.redirect(new URL('/apps/smart-notes', req.url));
}
