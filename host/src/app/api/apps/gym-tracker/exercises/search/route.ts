import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';

export const runtime = 'nodejs';
const APP_ID = 'gym-tracker';

function ensureSchema() {
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
}

export async function GET(req: Request) {
  ensureSchema();
  
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim().toLowerCase() || '';
  const limit = Math.min(Number(url.searchParams.get('limit') || '10'), 20);
  
  if (!q) {
    // Return most popular exercises when no query
    const exercises = dbQuery<{ id: number; name: string; category: string | null }>(
      APP_ID,
      `SELECT id, name, category 
       FROM exercises 
       ORDER BY usage_count DESC, name ASC 
       LIMIT ?`,
      [limit]
    );
    return NextResponse.json({ ok: true, exercises, query: q });
  }
  
  // Search by name or alias with fuzzy matching
  const exercises = dbQuery<{ id: number; name: string; category: string | null; match_type: string }>(
    APP_ID,
    `SELECT DISTINCT e.id, e.name, e.category,
      CASE 
        WHEN LOWER(e.name) = ? THEN 'exact'
        WHEN LOWER(e.name) LIKE ? THEN 'starts_with'
        ELSE 'contains'
      END as match_type
     FROM exercises e
     LEFT JOIN exercise_aliases ea ON ea.exercise_id = e.id
     WHERE LOWER(e.name) LIKE ? OR LOWER(ea.alias) LIKE ?
     ORDER BY 
       CASE WHEN LOWER(e.name) = ? THEN 0 ELSE 1 END,
       e.usage_count DESC,
       e.name ASC
     LIMIT ?`,
    [q, `${q}%`, `%${q}%`, `%${q}%`, q, limit]
  );
  
  return NextResponse.json({ ok: true, exercises, query: q });
}