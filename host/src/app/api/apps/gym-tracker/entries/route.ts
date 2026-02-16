import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { storageWriteText } from '@/lib/storage';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
const APP_ID = 'gym-tracker';

function ensureSchema() {
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      exercise TEXT NOT NULL,
      sets INTEGER,
      reps INTEGER,
      weight REAL,
      created_at TEXT NOT NULL
    )`
  );
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_entries_exercise ON entries(exercise)`);
}

export async function GET() {
  ensureSchema();
  const entries = dbQuery(
    APP_ID,
    `SELECT id, date, exercise, sets, reps, weight, created_at
     FROM entries
     ORDER BY id DESC
     LIMIT 100`
  );
  return NextResponse.json({ ok: true, entries });
}

export async function POST(req: Request) {
  ensureSchema();
  const form = await req.formData();
  const date = String(form.get('date') ?? '').slice(0, 32);
  const exercise = String(form.get('exercise') ?? '').trim().slice(0, 120);
  const setsRaw = String(form.get('sets') ?? '').trim();
  const repsRaw = String(form.get('reps') ?? '').trim();
  const weightRaw = String(form.get('weight') ?? '').trim();

  if (!exercise) return NextResponse.json({ ok: false, error: 'exercise required' }, { status: 400 });

  const sets = setsRaw ? Number(setsRaw) : null;
  const reps = repsRaw ? Number(repsRaw) : null;
  const weight = weightRaw ? Number(weightRaw) : null;

  dbExec(
    APP_ID,
    `INSERT INTO entries (date, exercise, sets, reps, weight, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [date || null, exercise, Number.isFinite(sets as any) ? sets : null, Number.isFinite(reps as any) ? reps : null, Number.isFinite(weight as any) ? weight : null, new Date().toISOString()]
  );

  // Minimal storage interaction: append a log file.
  await storageWriteText(APP_ID, 'entries_last_write.txt', `last write @ ${new Date().toISOString()}\n`);
  audit(APP_ID, 'entries.create', { exercise, hasDate: Boolean(date) });

  return NextResponse.redirect(new URL('/apps/gym-tracker', req.url));
}
