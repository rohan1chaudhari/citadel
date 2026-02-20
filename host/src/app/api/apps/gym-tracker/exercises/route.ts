import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
const APP_ID = 'gym-tracker';

const VALID_CATEGORIES = ['push', 'pull', 'legs', 'cardio', 'core', 'other'] as const;

function ensureSchema() {
  // Create exercises table for enum storage
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
  
  // Create exercise_aliases table for fuzzy matching
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

async function normalizeWithLlm(rawName: string): Promise<{ name: string; category: string | null }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    // Fallback: just capitalize words
    const normalized = rawName
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
    return { name: normalized, category: null };
  }

  const prompt = `Normalize this exercise name to a standard format.
Rules:
- Use proper capitalization (e.g., "Bench Press", "Incline Dumbbell Fly")
- Remove extra spaces and punctuation
- Use standard exercise naming conventions
- Infer the category if possible (push, pull, legs, cardio, core, other)

Return JSON: {"name": "Normalized Name", "category": "push|pull|legs|cardio|core|other|null"}

Exercise: "${rawName}"`;

  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        input: prompt,
        text: {
          format: {
            type: 'json_schema',
            name: 'exercise_normalize',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                category: { type: ['string', 'null'] }
              },
              required: ['name', 'category'],
              additionalProperties: false
            }
          }
        }
      })
    });

    if (!res.ok) throw new Error(`LLM error: ${res.status}`);
    
    const data = await res.json();
    const text = data?.output?.[0]?.content?.[0]?.text ?? data?.output_text ?? '';
    const parsed = JSON.parse(text);
    
    const category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : null;
    return { name: parsed.name?.trim() || rawName.trim(), category };
  } catch {
    // Fallback
    return { 
      name: rawName.trim().replace(/\b\w/g, (c) => c.toUpperCase()), 
      category: null 
    };
  }
}

export async function GET() {
  ensureSchema();
  
  const exercises = dbQuery<{ 
    id: number; 
    name: string; 
    normalized_name: string;
    category: string | null;
    usage_count: number;
  }>(
    APP_ID,
    `SELECT id, name, normalized_name, category, usage_count 
     FROM exercises 
     ORDER BY usage_count DESC, name ASC`
  );
  
  return NextResponse.json({ ok: true, exercises });
}

export async function POST(req: Request) {
  ensureSchema();
  
  const body = await req.json().catch(() => ({}));
  const rawName = String(body?.name ?? '').trim();
  
  if (!rawName) {
    return NextResponse.json({ ok: false, error: 'name required' }, { status: 400 });
  }
  
  // Check if exercise already exists (case-insensitive)
  const existing = dbQuery<{ id: number; name: string }>(
    APP_ID,
    `SELECT id, name FROM exercises WHERE LOWER(name) = LOWER(?)`,
    [rawName]
  );
  
  if (existing.length > 0) {
    // Increment usage count
    dbExec(
      APP_ID,
      `UPDATE exercises SET usage_count = usage_count + 1 WHERE id = ?`,
      [existing[0].id]
    );
    
    return NextResponse.json({ 
      ok: true, 
      id: existing[0].id, 
      name: existing[0].name,
      isNew: false 
    });
  }
  
  // Normalize with LLM
  const normalized = await normalizeWithLlm(rawName);
  
  // Double-check normalized name doesn't exist
  const existingNormalized = dbQuery<{ id: number }>(
    APP_ID,
    `SELECT id FROM exercises WHERE LOWER(name) = LOWER(?) OR LOWER(normalized_name) = LOWER(?)`,
    [normalized.name, normalized.name]
  );
  
  if (existingNormalized.length > 0) {
    dbExec(
      APP_ID,
      `UPDATE exercises SET usage_count = usage_count + 1 WHERE id = ?`,
      [existingNormalized[0].id]
    );
    
    return NextResponse.json({ 
      ok: true, 
      id: existingNormalized[0].id, 
      name: normalized.name,
      isNew: false 
    });
  }
  
  // Create new exercise
  const now = new Date().toISOString();
  dbExec(
    APP_ID,
    `INSERT INTO exercises (name, normalized_name, category, created_at, usage_count) 
     VALUES (?, ?, ?, ?, 1)`,
    [normalized.name, normalized.name.toLowerCase(), normalized.category, now]
  );
  
  const idRow = dbQuery<{ id: number }>(APP_ID, `SELECT last_insert_rowid() as id`)[0];
  const id = idRow?.id;
  
  // Add alias for the raw input
  dbExec(
    APP_ID,
    `INSERT INTO exercise_aliases (alias, exercise_id, created_at) VALUES (?, ?, ?)`,
    [rawName.toLowerCase(), id, now]
  );
  
  audit(APP_ID, 'exercise.create', { id, name: normalized.name });
  
  return NextResponse.json({ 
    ok: true, 
    id, 
    name: normalized.name,
    category: normalized.category,
    isNew: true 
  });
}