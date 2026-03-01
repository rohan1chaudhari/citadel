import { NextResponse } from 'next/server';
import { dbExec } from '@citadel/core';
import { audit } from '@citadel/core';
import { ensureSmartNotesSchema } from '@/lib/smartNotesSchema';

export const runtime = 'nodejs';
const APP_ID = 'smart-notes';

function ensureSchema() {
  ensureSmartNotesSchema();
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  ensureSchema();
  const { id } = await ctx.params;
  const noteId = Number(id);
  if (!Number.isFinite(noteId)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });

  dbExec(APP_ID, `DELETE FROM notes WHERE id = ?`, [noteId]);
  audit(APP_ID, 'notes.purge', { id: noteId, mode: 'form' });

  return NextResponse.redirect(new URL('/apps/smart-notes/trash', req.url));
}
