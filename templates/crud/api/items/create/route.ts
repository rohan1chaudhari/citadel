import { NextResponse } from 'next/server';
import { dbExec } from '@citadel/core';

export const runtime = 'nodejs';
const APP_ID = '{{app_id}}';

function ensureSchema() {
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT
    )`
  );
}

// POST /api/apps/{{app_id}}/items/create
export async function POST(req: Request) {
  ensureSchema();

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? '').trim();
  const description = body?.description ? String(body.description).trim() : null;
  const status = String(body?.status || 'active');

  if (!title) {
    return NextResponse.json({ ok: false, error: 'Title is required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const result = dbExec(
    APP_ID,
    'INSERT INTO items (title, description, status, created_at) VALUES (?, ?, ?, ?)',
    [title, description, status, now]
  );

  return NextResponse.json({
    ok: true,
    id: result.lastInsertRowid,
    item: { id: result.lastInsertRowid, title, description, status, created_at: now, updated_at: null }
  });
}
