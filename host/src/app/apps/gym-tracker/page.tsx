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
  exercise_id: number | null;
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

type Exercise = {
  id: number;
  name: string;
  category: string | null;
};

function ensureSchema() {
  // Main entries table
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      exercise TEXT NOT NULL,
      exercise_id INTEGER,
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
  
  // Schema migrations
  try { dbExec(APP_ID, `ALTER TABLE entries ADD COLUMN rpe REAL`); } catch {}
  try { dbExec(APP_ID, `ALTER TABLE entries ADD COLUMN rest_seconds INTEGER`); } catch {}
  try { dbExec(APP_ID, `ALTER TABLE entries ADD COLUMN notes TEXT`); } catch {}
  try { dbExec(APP_ID, `ALTER TABLE entries ADD COLUMN updated_at TEXT`); } catch {}
  try { dbExec(APP_ID, `ALTER TABLE entries ADD COLUMN category TEXT`); } catch {}
  try { dbExec(APP_ID, `ALTER TABLE entries ADD COLUMN session_id TEXT`); } catch {}
  try { dbExec(APP_ID, `ALTER TABLE entries ADD COLUMN exercise_id INTEGER`); } catch {}

  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_entries_exercise ON entries(exercise)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_entries_exercise_id ON entries(exercise_id)`);

  // Exercises enum table
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
  
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_exercises_normalized ON exercises(normalized_name)`);
  
  // Aliases for fuzzy matching
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS exercise_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alias TEXT NOT NULL,
      exercise_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    )`
  );
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_aliases_alias ON exercise_aliases(alias)`);
}

async function fetchData() {
  ensureSchema();
  
  const entriesRaw = dbQuery<Entry>(
    APP_ID,
    `SELECT id, date, category, exercise, exercise_id, sets, reps, weight, rpe, rest_seconds, notes, session_id, created_at, updated_at
     FROM entries
     ORDER BY id DESC
     LIMIT 200`
  );
  
  // Serialize to plain objects to avoid prototype issues with node:sqlite
  const entries = entriesRaw.map(e => ({ 
    id: Number(e.id), date: e.date, category: e.category, exercise: String(e.exercise),
    exercise_id: e.exercise_id == null ? null : Number(e.exercise_id),
    sets: e.sets, reps: e.reps, weight: e.weight, rpe: e.rpe,
    rest_seconds: e.rest_seconds, notes: e.notes, session_id: e.session_id,
    created_at: String(e.created_at), updated_at: e.updated_at
  }));

  const recentExercises = dbQuery<{ exercise: string }>(
    APP_ID,
    `SELECT exercise FROM entries GROUP BY exercise ORDER BY MAX(id) DESC LIMIT 20`
  ).map((r) => String(r.exercise));

  const exercisesRaw = dbQuery<Exercise & { usage_count: number }>(
    APP_ID,
    `SELECT id, name, category, usage_count FROM exercises ORDER BY usage_count DESC, name ASC`
  );
  
  // Serialize to plain objects for client component
  const exercises = exercisesRaw.map(e => ({ id: Number(e.id), name: String(e.name), category: e.category }));

  return { entries, recentExercises, exercises };
}

export default async function GymTrackerPage() {
  const data = await fetchData();

  return (
    <Shell title="Gym Tracker" subtitle="Fast logging with reusable defaults and inline edits.">
      <div className="flex items-center justify-between">
        <LinkA href="/">← home</LinkA>
        <div className="text-xs text-zinc-500">{data.entries.length} entries</div>
      </div>

      <GymTrackerClient 
        initialEntries={data.entries} 
        recentExercises={data.recentExercises}
        initialExercises={data.exercises}
      />

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
