import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { ensureSmartNotesSchema } from '@/lib/smartNotesSchema';

export const runtime = 'nodejs';
const APP_ID = 'smart-notes';

function ensureSchema() {
  ensureSmartNotesSchema();
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
