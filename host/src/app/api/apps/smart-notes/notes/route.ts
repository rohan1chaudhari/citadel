import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

const APP_ID = 'smart-notes';

function ensureSchema() {
  // Base table (older installs may already have notes without updated_at)
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      body TEXT,
      created_at TEXT NOT NULL
    )`
  );

  // Lightweight migration: add updated_at if missing.
  try {
    dbExec(APP_ID, `ALTER TABLE notes ADD COLUMN updated_at TEXT`);
  } catch {
    // ignore (likely "duplicate column name")
  }

  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at)`);
}

export async function GET(req: Request) {
  ensureSchema();
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();

  let notes: any[];
  if (q) {
    const like = `%${q}%`;
    notes = dbQuery(
      APP_ID,
      `SELECT id, title, body, created_at FROM notes
       WHERE (title LIKE ? OR body LIKE ?)
       ORDER BY id DESC
       LIMIT 50`,
      [like, like]
    );
  } else {
    notes = dbQuery(APP_ID, `SELECT id, title, body, created_at FROM notes ORDER BY id DESC LIMIT 50`);
  }

  return NextResponse.json({ ok: true, q, notes });
}

export async function POST(req: Request) {
  ensureSchema();

  const ct = req.headers.get('content-type') ?? '';
  let title = '';
  let body = '';

  if (ct.includes('application/json')) {
    const j = await req.json().catch(() => ({}));
    title = typeof j.title === 'string' ? j.title.slice(0, 200) : '';
    body = typeof j.body === 'string' ? j.body : '';
  } else {
    const form = await req.formData();
    title = String(form.get('title') ?? '').slice(0, 200);
    body = String(form.get('body') ?? '');
  }

  dbExec(APP_ID, `INSERT INTO notes (title, body, created_at) VALUES (?, ?, ?)`, [title, body, new Date().toISOString()]);
  const idRow = dbQuery<{ id: number }>(APP_ID, `SELECT last_insert_rowid() as id`)[0];
  const id = idRow?.id;

  audit(APP_ID, 'notes.create', { titleLen: title.length, bodyLen: body.length, mode: ct.includes('application/json') ? 'json' : 'form' });

  if (ct.includes('application/json')) {
    return NextResponse.json({ ok: true, id });
  }
  return NextResponse.redirect(new URL('/apps/smart-notes', req.url));
}
