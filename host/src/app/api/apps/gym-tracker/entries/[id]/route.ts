import { NextResponse } from 'next/server';
import { dbExec } from '@/lib/db';
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
      category TEXT,
      sets INTEGER,
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
  const exercise = toNullableText(body?.exercise, 120);
  const category = normalizeCategory(body?.category);
  const sets = toNullableNumber(body?.sets);
  const reps = toNullableNumber(body?.reps);
  const weight = toNullableNumber(body?.weight);
  const rpe = toNullableNumber(body?.rpe);
  const restSeconds = toNullableNumber(body?.rest_seconds ?? body?.restSeconds);
  const notes = toNullableText(body?.notes, 4000);

  if (!exercise) return NextResponse.json({ ok: false, error: 'exercise required' }, { status: 400 });

  dbExec(
    APP_ID,
    `UPDATE entries
     SET date = ?, category = ?, exercise = ?, sets = ?, reps = ?, weight = ?, rpe = ?, rest_seconds = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [date, category, exercise, sets, reps, weight, rpe, restSeconds, notes, new Date().toISOString(), id]
  );

  audit(APP_ID, 'entries.update', { id, exercise, category });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  ensureSchema();
  const id = Number((await params).id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 });

  dbExec(APP_ID, `DELETE FROM entries WHERE id = ?`, [id]);
  audit(APP_ID, 'entries.delete', { id });
  return NextResponse.json({ ok: true });
}
