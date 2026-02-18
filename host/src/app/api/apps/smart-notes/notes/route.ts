import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { audit } from '@/lib/audit';
import { ensureSmartNotesSchema } from '@/lib/smartNotesSchema';

export const runtime = 'nodejs';

const APP_ID = 'smart-notes';

function ensureSchema() {
  ensureSmartNotesSchema();
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
      `SELECT id, title, body, tags, created_at, updated_at, pinned FROM notes
       WHERE deleted_at IS NULL AND (title LIKE ? OR body LIKE ? OR tags LIKE ?)
       ORDER BY pinned DESC, COALESCE(updated_at, created_at) DESC, id DESC
       LIMIT 50`,
      [like, like, like]
    );
  } else {
    notes = dbQuery(
      APP_ID,
      `SELECT id, title, body, tags, created_at, updated_at, pinned FROM notes
       WHERE deleted_at IS NULL
       ORDER BY pinned DESC, COALESCE(updated_at, created_at) DESC, id DESC
       LIMIT 50`
    );
  }

  return NextResponse.json({ ok: true, q, notes });
}

export async function POST(req: Request) {
  ensureSchema();

  const ct = req.headers.get('content-type') ?? '';
  let title = '';
  let body = '';
  let tags = '';

  if (ct.includes('application/json')) {
    const j = await req.json().catch(() => ({}));
    title = typeof j.title === 'string' ? j.title.slice(0, 200) : '';
    body = typeof j.body === 'string' ? j.body : '';
    tags = typeof j.tags === 'string' ? j.tags.slice(0, 400) : '';
  } else {
    const form = await req.formData();
    title = String(form.get('title') ?? '').slice(0, 200);
    body = String(form.get('body') ?? '');
    tags = String(form.get('tags') ?? '').slice(0, 400);
  }

  dbExec(APP_ID, `INSERT INTO notes (title, body, tags, created_at) VALUES (?, ?, ?, ?)`, [title, body, tags, new Date().toISOString()]);
  const idRow = dbQuery<{ id: number }>(APP_ID, `SELECT last_insert_rowid() as id`)[0];
  const id = idRow?.id;

  audit(APP_ID, 'notes.create', {
    titleLen: title.length,
    bodyLen: body.length,
    tagsLen: tags.length,
    mode: ct.includes('application/json') ? 'json' : 'form'
  });

  if (ct.includes('application/json')) {
    return NextResponse.json({ ok: true, id });
  }
  return NextResponse.redirect(new URL('/apps/smart-notes', req.url));
}
