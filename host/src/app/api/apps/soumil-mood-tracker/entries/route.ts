import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { audit } from '@/lib/audit';
import { storageWriteText } from '@/lib/storage';

export const runtime = 'nodejs';
const APP_ID = 'soumil-mood-tracker';

type Entry = {
  id: number;
  date: string;
  mood: number;
  note: string | null;
  created_at: string;
  updated_at: string | null;
};

function ensureSchema() {
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS mood_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      mood INTEGER NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )`
  );

  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_mood_entries_date ON mood_entries(date)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_mood_entries_created_at ON mood_entries(created_at)`);
}

function normalizeDate(v: unknown) {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function normalizeMood(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const mood = Math.round(n);
  if (mood < 1 || mood > 5) return null;
  return mood;
}

function normalizeNote(v: unknown) {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, 2000) : null;
}

function normalizeImageUrl(v: unknown) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return s.slice(0, 2000);
  } catch {
    return null;
  }
}

function combineNoteAndImage(note: string | null, imageUrl: string | null) {
  if (!imageUrl) return note;
  const parts = [] as string[];
  if (note) parts.push(note);
  parts.push(`[image] ${imageUrl}`);
  return parts.join('\n\n');
}

export async function GET() {
  ensureSchema();
  const entries = dbQuery<Entry>(
    APP_ID,
    `SELECT id, date, mood, note, created_at, updated_at
     FROM mood_entries
     ORDER BY date DESC, id DESC
     LIMIT 180`
  );

  return NextResponse.json({ ok: true, entries });
}

export async function POST(req: Request) {
  ensureSchema();

  const body = await req.json().catch(() => ({}));
  const date = normalizeDate(body?.date);
  const mood = normalizeMood(body?.mood);
  const note = normalizeNote(body?.note);
  const imageUrl = normalizeImageUrl(body?.image_url);

  if (!date) return NextResponse.json({ ok: false, error: 'valid date required (YYYY-MM-DD)' }, { status: 400 });
  if (!mood) return NextResponse.json({ ok: false, error: 'mood must be between 1 and 5' }, { status: 400 });
  if (body?.image_url && !imageUrl) return NextResponse.json({ ok: false, error: 'image_url must be a valid http(s) URL' }, { status: 400 });

  const now = new Date().toISOString();
  dbExec(
    APP_ID,
    `INSERT INTO mood_entries (date, mood, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [date, mood, combineNoteAndImage(note, imageUrl), now, now]
  );

  const id = dbQuery<{ id: number }>(APP_ID, `SELECT last_insert_rowid() as id`)[0]?.id;
  audit(APP_ID, 'mood_entries.create', { id, date, mood, hasNote: Boolean(note), hasImage: Boolean(imageUrl) });
  await storageWriteText(APP_ID, 'entries_last_write.txt', `last write @ ${now}\n`);

  return NextResponse.json({ ok: true, id });
}
