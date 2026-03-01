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
  dbExec(APP_ID, 'CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at)');
  dbExec(APP_ID, 'CREATE INDEX IF NOT EXISTS idx_items_status ON items(status)');
}

// GET /api/apps/{{app_id}}/items
export async function GET() {
  ensureSchema();
  const items = dbQuery<{
    id: number;
    title: string;
    description: string | null;
    status: string;
    created_at: string;
    updated_at: string | null;
  }>(
    APP_ID,
    'SELECT id, title, description, status, created_at, updated_at FROM items ORDER BY created_at DESC LIMIT 500'
  );
  return NextResponse.json({ ok: true, items });
}
