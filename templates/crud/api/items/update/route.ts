import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@citadel/core';

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

// PATCH /api/apps/{{app_id}}/items/update
export async function PATCH(req: Request) {
  ensureSchema();

  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  const title = String(body?.title ?? '').trim();
  const description = body?.description ? String(body.description).trim() : null;
  const status = String(body?.status || 'active');

  if (!id || !title) {
    return NextResponse.json({ ok: false, error: 'ID and title are required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  dbExec(
    APP_ID,
    'UPDATE items SET title = ?, description = ?, status = ?, updated_at = ? WHERE id = ?',
    [title, description, status, now, id]
  );

  return NextResponse.json({ ok: true });
}

// DELETE /api/apps/{{app_id}}/items/update
export async function DELETE(req: Request) {
  ensureSchema();

  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);

  if (!id) {
    return NextResponse.json({ ok: false, error: 'ID is required' }, { status: 400 });
  }

  dbExec(APP_ID, 'DELETE FROM items WHERE id = ?', [id]);
  return NextResponse.json({ ok: true });
}
