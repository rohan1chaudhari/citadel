// Example route.ts - copy to: host/src/app/api/apps/hello-world/route.ts
import { NextResponse } from 'next/server';
import { dbQuery, dbExec } from '@citadel/core';
import { audit } from '@citadel/core';

export const runtime = 'nodejs';
const APP_ID = 'hello-world';

export async function GET(req: Request) {
  const rows = dbQuery<{ id: number; message: string; created_at: string }>(
    APP_ID,
    'SELECT id, message, created_at FROM greetings ORDER BY created_at DESC'
  );

  return NextResponse.json({ ok: true, greetings: rows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!message) {
    return NextResponse.json(
      { ok: false, error: 'message is required' },
      { status: 400 }
    );
  }

  dbExec(
    APP_ID,
    'INSERT INTO greetings (message, created_at) VALUES (?, datetime("now"))',
    [message]
  );

  const idRow = dbQuery<{ id: number }>(
    APP_ID,
    'SELECT last_insert_rowid() as id'
  )[0];

  audit(APP_ID, 'greeting.created', { id: idRow?.id, messageLen: message.length });

  return NextResponse.json({ ok: true, id: idRow?.id });
}
