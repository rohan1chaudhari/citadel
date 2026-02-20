#!/usr/bin/env tsx
/**
 * Migration: Normalize existing gym-tracker exercise names to enum
 * 
 * This script:
 * 1. Creates exercise records for all unique exercise names in entries
 * 2. Uses LLM to normalize names (e.g., "Pull up" -> "Pull-up")
 * 3. Updates entries to link to the new exercise IDs
 * 
 * Usage: cd host && npx tsx scripts/migrate-exercises.ts
 */

import { dbExec, dbQuery } from '@/lib/db';

const APP_ID = 'gym-tracker';
const VALID_CATEGORIES = ['push', 'pull', 'legs', 'cardio', 'core', 'other'] as const;

interface RawEntry {
  exercise: string;
  category: string | null;
}

interface NormalizedExercise {
  original: string;
  normalized: string;
  category: string;
}

function ensureSchema() {
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
  
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name)`);
  dbExec(APP_ID, `CREATE INDEX IF NOT EXISTS idx_exercises_normalized ON exercises(normalized_name)`);
  
  // Ensure exercise_aliases table exists
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

function getUniqueExercises(): Map<string, string | null> {
  const rows = dbQuery<RawEntry>(
    APP_ID,
    `SELECT DISTINCT exercise, category FROM entries WHERE exercise_id IS NULL OR exercise_id = 0`
  );
  
  const map = new Map<string, string | null>();
  for (const row of rows) {
    if (!map.has(row.exercise)) {
      map.set(row.exercise, row.category);
    }
  }
  return map;
}

async function normalizeWithLLM(
  exercises: Map<string, string | null>
): Promise<NormalizedExercise[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    // Fallback: simple normalization
    return Array.from(exercises.entries()).map(([name, cat]) => ({
      original: name,
      normalized: name.replace(/\b\w/g, (c) => c.toUpperCase()).trim(),
      category: cat && VALID_CATEGORIES.includes(cat as any) ? cat : 'other',
    }));
  }

  const prompt = `Normalize these exercise names to standard fitness terminology.
Rules:
- Use proper capitalization (e.g., "Bench Press" not "bench press")
- Use hyphens for compound terms (e.g., "Pull-up" not "Pull up")
- Fix spelling errors
- Choose the most common/standard name for each exercise
- Assign ONE category: push, pull, legs, cardio, core, or other

Input exercises:
${Array.from(exercises.entries()).map(([name, cat], i) => `${i + 1}. "${name}" (was: ${cat || 'unknown'})`).join('\n')}

Respond ONLY with a JSON array in this exact format:
[
  {"original": "Pull up", "normalized": "Pull-up", "category": "pull"},
  ...
]`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      })
    });

    if (!res.ok) throw new Error(`LLM error: ${res.status}`);
    
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse LLM response');
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.warn('LLM normalization failed, using fallback:', err);
    // Fallback
    return Array.from(exercises.entries()).map(([name, cat]) => ({
      original: name,
      normalized: name.replace(/\b\w/g, (c) => c.toUpperCase()).trim(),
      category: cat && VALID_CATEGORIES.includes(cat as any) ? cat : 'other',
    }));
  }
}

function createExercises(normalized: NormalizedExercise[]): Map<string, number> {
  const idMap = new Map<string, number>();
  const now = new Date().toISOString();
  
  for (const ex of normalized) {
    // Check if exercise already exists (by normalized name)
    const existing = dbQuery<{ id: number }>(
      APP_ID,
      `SELECT id FROM exercises WHERE LOWER(normalized_name) = LOWER(?)`,
      [ex.normalized]
    );
    
    if (existing.length > 0) {
      idMap.set(ex.original, existing[0].id);
      continue;
    }
    
    // Insert new exercise
    const result = dbExec(
      APP_ID,
      `INSERT INTO exercises (name, normalized_name, category, created_at, usage_count)
       VALUES (?, ?, ?, ?, 0)`,
      [ex.normalized, ex.normalized.toLowerCase(), ex.category, now]
    );
    
    const id = Number(result.lastInsertRowid);
    idMap.set(ex.original, id);
    
    // Add alias for the original name
    dbExec(
      APP_ID,
      `INSERT INTO exercise_aliases (alias, exercise_id, created_at) VALUES (?, ?, ?)`,
      [ex.original.toLowerCase(), id, now]
    );
    
    console.log(`  Created: "${ex.original}" -> "${ex.normalized}" (${ex.category}, id: ${id})`);
  }
  
  return idMap;
}

function updateEntries(idMap: Map<string, number>): number {
  let updated = 0;
  
  for (const [originalName, exerciseId] of idMap) {
    const result = dbExec(
      APP_ID,
      `UPDATE entries SET exercise_id = ? WHERE exercise = ? AND (exercise_id IS NULL OR exercise_id = 0)`,
      [exerciseId, originalName]
    );
    updated += result.changes || 0;
  }
  
  return updated;
}

function updateUsageCounts(): void {
  dbExec(APP_ID, `
    UPDATE exercises 
    SET usage_count = COALESCE((
      SELECT COUNT(*) FROM entries WHERE entries.exercise_id = exercises.id
    ), 0)
  `);
}

async function main() {
  console.log('Starting gym-tracker exercise migration...\n');
  
  // Ensure schema exists
  ensureSchema();
  
  // 1. Get unique exercises from entries
  const uniqueExercises = getUniqueExercises();
  console.log(`Found ${uniqueExercises.size} unique exercises to migrate:`);
  for (const [name, cat] of uniqueExercises) {
    console.log(`  - "${name}" (${cat || 'no category'})`);
  }
  console.log();
  
  if (uniqueExercises.size === 0) {
    console.log('No exercises to migrate. Exiting.');
    return;
  }
  
  // 2. Normalize with LLM
  console.log('Normalizing exercise names...');
  const normalized = await normalizeWithLLM(uniqueExercises);
  console.log();
  
  // 3. Create exercise records
  console.log('Creating exercise records:');
  const idMap = createExercises(normalized);
  console.log();
  
  // 4. Update entries to link to exercises
  console.log('Updating entries with exercise IDs...');
  const updatedCount = updateEntries(idMap);
  console.log(`Updated ${updatedCount} entries\n`);
  
  // 5. Update usage counts
  console.log('Updating usage counts...');
  updateUsageCounts();
  console.log('Done!\n');
  
  // Summary
  console.log('=== Migration Summary ===');
  console.log(`Exercises created: ${idMap.size}`);
  console.log(`Entries updated: ${updatedCount}`);
  
  // Show final state
  const exercises = dbQuery<{ id: number; name: string; usage_count: number }>(
    APP_ID,
    `SELECT id, name, usage_count FROM exercises ORDER BY usage_count DESC`
  );
  console.log('\n=== Final Exercise List ===');
  for (const ex of exercises) {
    console.log(`  ${ex.name} (${ex.usage_count} entries)`);
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
