import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

const APP_ID = 'smart-notes';

function ensureSchema() {
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      body TEXT,
      created_at TEXT NOT NULL
    )`
  );
}

export async function GET() {
  ensureSchema();
  const notes = dbQuery(APP_ID, `SELECT id, title, body, created_at FROM notes ORDER BY id DESC LIMIT 50`);
  return NextResponse.json({ ok: true, notes });
}

export async function POST(req: Request) {
  ensureSchema();
  const form = await req.formData();
  const title = String(form.get('title') ?? '');
  const body = String(form.get('body') ?? '');
  dbExec(APP_ID, `INSERT INTO notes (title, body, created_at) VALUES (?, ?, ?)`, [title, body, new Date().toISOString()]);
  audit(APP_ID, 'notes.create', { titleLen: title.length, bodyLen: body.length });
  return NextResponse.redirect(new URL('/apps/smart-notes', req.url));
}
