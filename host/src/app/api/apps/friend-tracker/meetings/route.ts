import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';

export const runtime = 'nodejs';
const APP_ID = 'friend-tracker';

function ensureSchema() {
  // Main meetings table
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      friend_names TEXT NOT NULL,
      location TEXT,
      image_path TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )`
  );
  
  // Friends table for autocomplete/tracking
  dbExec(
    APP_ID,
    `CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      meet_count INTEGER DEFAULT 1,
      last_met_at TEXT,
      created_at TEXT NOT NULL
    )`
  );
  
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_meetings_created ON meetings(created_at)`);
}

export async function GET() {
  ensureSchema();
  
  const meetings = dbQuery<{
    id: number;
    date: string;
    friend_names: string;
    location: string | null;
    image_path: string | null;
    notes: string | null;
    created_at: string;
  }>(
    APP_ID,
    `SELECT id, date, friend_names, location, image_path, notes, created_at 
     FROM meetings 
     ORDER BY date DESC, created_at DESC 
     LIMIT 200`
  );
  
  const friends = dbQuery<{
    id: number;
    name: string;
    meet_count: number;
    last_met_at: string | null;
  }>(
    APP_ID,
    `SELECT id, name, meet_count, last_met_at 
     FROM friends 
     ORDER BY meet_count DESC, last_met_at DESC`
  );
  
  return NextResponse.json({ ok: true, meetings, friends });
}

export async function POST(req: Request) {
  ensureSchema();
  
  const body = await req.json().catch(() => ({}));
  const date = String(body?.date ?? '').trim();
  const friendNames = String(body?.friendNames ?? '').trim();
  const location = body?.location ? String(body.location).trim() : null;
  const notes = body?.notes ? String(body.notes).trim() : null;
  const imagePath = body?.imagePath ? String(body.imagePath).trim() : null;
  
  if (!date || !friendNames) {
    return NextResponse.json({ ok: false, error: 'Date and friend names required' }, { status: 400 });
  }
  
  const now = new Date().toISOString();
  
  // Insert meeting
  const result = dbExec(
    APP_ID,
    `INSERT INTO meetings (date, friend_names, location, image_path, notes, created_at) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [date, friendNames, location, imagePath, notes, now]
  );
  
  // Update friends table
  const names = friendNames.split(',').map(n => n.trim()).filter(Boolean);
  for (const name of names) {
    const existing = dbQuery<{ id: number; meet_count: number }>(
      APP_ID,
      `SELECT id, meet_count FROM friends WHERE name = ?`,
      [name]
    );
    
    if (existing.length > 0) {
      dbExec(
        APP_ID,
        `UPDATE friends SET meet_count = ?, last_met_at = ? WHERE id = ?`,
        [existing[0].meet_count + 1, now, existing[0].id]
      );
    } else {
      dbExec(
        APP_ID,
        `INSERT INTO friends (name, meet_count, last_met_at, created_at) VALUES (?, 1, ?, ?)`,
        [name, now, now]
      );
    }
  }
  
  return NextResponse.json({ 
    ok: true, 
    id: result.lastInsertRowid,
    meeting: {
      id: result.lastInsertRowid,
      date,
      friend_names: friendNames,
      location,
      image_path: imagePath,
      notes,
      created_at: now
    }
  });
}
