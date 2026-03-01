import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@citadel/core';

export const runtime = 'nodejs';
const APP_ID = '{{app_id}}';

// Ensure the schema exists
function ensureSchema() {
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS greetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`
  );
}

// GET /api/apps/{{app_id}}/hello
export async function GET() {
  ensureSchema();

  const greetings = dbQuery<{ id: number; message: string; created_at: string }>(
    APP_ID,
    'SELECT id, message, created_at FROM greetings ORDER BY created_at DESC LIMIT 10'
  );

  return NextResponse.json({ ok: true, greetings });
}

// POST /api/apps/{{app_id}}/hello
export async function POST(req: Request) {
  ensureSchema();

  const body = await req.json().catch(() => ({}));
  const message = String(body?.message ?? '').trim();

  if (!message) {
    return NextResponse.json(
      { ok: false, error: 'Message is required' },
      { status: 400 }
    );
  }

  const result = dbExec(
    APP_ID,
    'INSERT INTO greetings (message, created_at) VALUES (?, ?)',
    [message, new Date().toISOString()]
  );

  return NextResponse.json({
    ok: true,
    id: result.lastInsertRowid,
    message
  });
}
