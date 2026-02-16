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
  const form = await req.formData();
  const title = String(form.get('title') ?? '').slice(0, 200);
  const body = String(form.get('body') ?? '');

  dbExec(APP_ID, `INSERT INTO notes (title, body, created_at) VALUES (?, ?, ?)`, [title, body, new Date().toISOString()]);
  audit(APP_ID, 'notes.create', { titleLen: title.length, bodyLen: body.length });

  return NextResponse.redirect(new URL('/apps/smart-notes', req.url));
}
