import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
const APP_ID = 'gym-tracker';
const CATEGORIES = ['push', 'cardio', 'pull', 'leg'] as const;

function ensureSchema() {
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      exercise TEXT NOT NULL,
      exercise_id INTEGER,
      category TEXT,
      sets INTEGER,
      session_id TEXT,
      reps INTEGER,
      weight REAL,
      rpe REAL,
      rest_seconds INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )`
  );
  try { dbExec(APP_ID, `ALTER TABLE entries ADD COLUMN category TEXT`); } catch {}
  try { dbExec(APP_ID, `ALTER TABLE entries ADD COLUMN session_id TEXT`); } catch {}
  try { dbExec(APP_ID, `ALTER TABLE entries ADD COLUMN exercise_id INTEGER`); } catch {}
  
  // Ensure exercises table exists
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      normalized_name TEXT NOT NULL,
      category TEXT,
      created_at TEXT NOT NULL,
      usage_count INTEGER DEFAULT 1
    )`
  );
}

function getOrCreateExercise(exerciseName: string): { id: number; name: string } | null {
  if (!exerciseName) return null;
  
  const existing = dbQuery<{ id: number; name: string }>(
    APP_ID,
    `SELECT id, name FROM exercises WHERE LOWER(name) = LOWER(?)`,
    [exerciseName]
  );
  
  if (existing.length > 0) {
    dbExec(APP_ID, `UPDATE exercises SET usage_count = usage_count + 1 WHERE id = ?`, [existing[0].id]);
    return existing[0];
  }
  
  const normalized = exerciseName
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  
  const now = new Date().toISOString();
  dbExec(
    APP_ID,
    `INSERT INTO exercises (name, normalized_name, created_at, usage_count) VALUES (?, ?, ?, 1)`,
    [normalized, normalized.toLowerCase(), now]
  );
  
  const idRow = dbQuery<{ id: number }>(APP_ID, `SELECT last_insert_rowid() as id`)[0];
  return { id: idRow?.id, name: normalized };
}

function toNullableNumber(v: unknown) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toNullableText(v: unknown, max = 4000) {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
}

function normalizeCategory(v: unknown): string | null {
  const c = String(v ?? '').trim().toLowerCase();
  if (!c) return null;
  return (CATEGORIES as readonly string[]).includes(c) ? c : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  ensureSchema();
  const id = Number((await params).id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const date = toNullableText(body?.date, 32);
  const rawExercise = toNullableText(body?.exercise, 120);
  const category = normalizeCategory(body?.category);
  const sets = toNullableNumber(body?.sets);
  const reps = toNullableNumber(body?.reps);
  const weight = toNullableNumber(body?.weight);
  const rpe = toNullableNumber(body?.rpe);
  const restSeconds = toNullableNumber(body?.rest_seconds ?? body?.restSeconds);
  const notes = toNullableText(body?.notes, 4000);
  const sessionId = toNullableText(body?.session_id ?? body?.sessionId, 80);

  if (!rawExercise) return NextResponse.json({ ok: false, error: 'exercise required' }, { status: 400 });

  // Get or create exercise enum
  const exerciseEnum = getOrCreateExercise(rawExercise);
  const exerciseId = exerciseEnum?.id ?? null;
  const exerciseName = exerciseEnum?.name ?? rawExercise;

  dbExec(
    APP_ID,
    `UPDATE entries
     SET date = ?, category = ?, exercise = ?, exercise_id = ?, sets = ?, reps = ?, weight = ?, rpe = ?, rest_seconds = ?, notes = ?, session_id = ?, updated_at = ?
     WHERE id = ?`,
    [date, category, exerciseName, exerciseId, sets, reps, weight, rpe, restSeconds, notes, sessionId, new Date().toISOString(), id]
  );

  audit(APP_ID, 'entries.update', { id, exercise: exerciseName, exerciseId, category });
  return NextResponse.json({ ok: true, exercise: exerciseName });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  ensureSchema();
  const id = Number((await params).id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 });

  dbExec(APP_ID, `DELETE FROM entries WHERE id = ?`, [id]);
  audit(APP_ID, 'entries.delete', { id });
  return NextResponse.json({ ok: true });
}
