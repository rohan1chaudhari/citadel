import { Shell } from '@/components/Shell';
import { dbExec, dbQuery } from '@/lib/db';
import { SoumilMoodTrackerClient } from './SoumilMoodTrackerClient';

export const runtime = 'nodejs';
const APP_ID = 'soumil-mood-tracker';

type MoodEntry = {
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

async function fetchEntries() {
  ensureSchema();
  return dbQuery<MoodEntry>(
    APP_ID,
    `SELECT id, date, mood, note, created_at, updated_at
     FROM mood_entries
     ORDER BY date DESC, id DESC
     LIMIT 180`
  );
}

export default async function SoumilMoodTrackerPage() {
  const entries = await fetchEntries();

  return (
    <Shell title="Soumil Mood Tracker" hideBrand>
      <SoumilMoodTrackerClient initialEntries={entries} />
    </Shell>
  );
}
