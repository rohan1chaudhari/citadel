import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { storageWriteText } from '@/lib/storage';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
const APP_ID = 'gym-tracker';

type EntryRow = {
  id: number;
  date: string | null;
  category: string | null;
  exercise: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  rest_seconds: number | null;
  notes: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string | null;
};

function ensureSchema() {
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      exercise TEXT NOT NULL,
      category TEXT,
      sets INTEGER,
      reps INTEGER,
      weight REAL,
      rpe REAL,
      rest_seconds INTEGER,
      notes TEXT,
      session_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )`
  );
  try { dbExec(APP_ID, `ALTER TABLE entries ADD COLUMN rpe REAL`); } catch {}
  try { dbExec(APP_ID, `ALTER TABLE entries ADD COLUMN rest_seconds INTEGER`); } catch {}
  try { dbExec(APP_ID, `ALTER TABLE entries ADD COLUMN notes TEXT`); } catch {}
  try { dbExec(APP_ID, `ALTER TABLE entries ADD COLUMN updated_at TEXT`); } catch {}
  try { dbExec(APP_ID, `ALTER TABLE entries ADD COLUMN category TEXT`); } catch {}
  try { dbExec(APP_ID, `ALTER TABLE entries ADD COLUMN session_id TEXT`); } catch {}

  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_entries_exercise ON entries(exercise)`);
}

const CATEGORIES = ['push', 'cardio', 'pull', 'leg'] as const;

function normalizeCategory(v: unknown): string | null {
  const c = String(v ?? '').trim().toLowerCase();
  if (!c) return null;
  return (CATEGORIES as readonly string[]).includes(c) ? c : null;
}

function parseNum(v: unknown) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function sanitizePayload(input: any) {
  const date = String(input?.date ?? '').slice(0, 32) || null;
  const exercise = String(input?.exercise ?? '').trim().slice(0, 120);
  const category = normalizeCategory(input?.category);
  const sets = parseNum(input?.sets);
  const reps = parseNum(input?.reps);
  const weight = parseNum(input?.weight);
  const rpe = parseNum(input?.rpe);
  const restSeconds = parseNum(input?.rest_seconds ?? input?.restSeconds);
  const notes = String(input?.notes ?? '').trim().slice(0, 4000) || null;
  const sessionId = String(input?.session_id ?? input?.sessionId ?? '').trim().slice(0, 80) || null;

  return {
    date,
    exercise,
    category,
    sets,
    reps,
    weight,
    rpe,
    restSeconds,
    notes,
    sessionId
  };
}

export async function GET() {
  ensureSchema();
  const entries = dbQuery<EntryRow>(
    APP_ID,
    `SELECT id, date, category, exercise, sets, reps, weight, rpe, rest_seconds, notes, session_id, created_at, updated_at
     FROM entries
     ORDER BY id DESC
     LIMIT 200`
  );

  const recentExercises = dbQuery<{ exercise: string }>(
    APP_ID,
    `SELECT exercise FROM entries GROUP BY exercise ORDER BY MAX(id) DESC LIMIT 20`
  ).map((r) => r.exercise);

  return NextResponse.json({ ok: true, entries, recentExercises });
}

export async function POST(req: Request) {
  ensureSchema();

  const contentType = req.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await req.json().catch(() => ({}))
    : Object.fromEntries((await req.formData()).entries());

  const { date, exercise, category, sets, reps, weight, rpe, restSeconds, notes, sessionId } = sanitizePayload(payload);
  if (!exercise) return NextResponse.json({ ok: false, error: 'exercise required' }, { status: 400 });

  const now = new Date().toISOString();
  dbExec(
    APP_ID,
    `INSERT INTO entries (date, category, exercise, sets, reps, weight, rpe, rest_seconds, notes, session_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    [date, category, exercise, sets, reps, weight, rpe, restSeconds, notes, sessionId, now, now]
  );

  const idRow = dbQuery<{ id: number }>(APP_ID, `SELECT last_insert_rowid() as id`)[0];
  const id = idRow?.id;

  await storageWriteText(APP_ID, 'entries_last_write.txt', `last write @ ${now}\n`);
  audit(APP_ID, 'entries.create', { id, exercise, category, hasDate: Boolean(date) });

  if (contentType.includes('application/json')) {
    return NextResponse.json({ ok: true, id });
  }

  return NextResponse.redirect(new URL('/apps/gym-tracker', req.url));
}
