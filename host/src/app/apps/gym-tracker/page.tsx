import { Card, LinkA, Shell } from '@/components/Shell';
import { GymTrackerClient } from './GymTrackerClient';
import { dbExec, dbQuery } from '@/lib/db';

export const runtime = 'nodejs';
const APP_ID = 'gym-tracker';

type Entry = {
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

async function fetchEntries() {
  ensureSchema();
  const entries = dbQuery<Entry>(
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

  return { entries, recentExercises };
}

export default async function GymTrackerPage() {
  const data = await fetchEntries();

  return (
    <Shell title="Gym Tracker" subtitle="Fast logging with reusable defaults and inline edits.">
      <div className="flex items-center justify-between">
        <LinkA href="/">← home</LinkA>
        <div className="text-xs text-zinc-500">{data.entries.length} entries</div>
      </div>

      <GymTrackerClient initialEntries={data.entries} recentExercises={data.recentExercises} />

      <Card>
        <div className="text-sm text-zinc-600">
          <LinkA href="/api/apps/gym-tracker/health" target="_blank" rel="noreferrer">health</LinkA>
          {' · '}
          <LinkA href="/api/apps/gym-tracker/selftest" target="_blank" rel="noreferrer">selftest</LinkA>
        </div>
      </Card>
    </Shell>
  );
}
