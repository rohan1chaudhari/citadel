-- Initial schema for gym-tracker app
-- Creates tables for workout entries and exercises

CREATE TABLE IF NOT EXISTS entries (
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
);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL,
  category TEXT,
  created_at TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at);
CREATE INDEX IF NOT EXISTS idx_entries_exercise ON entries(exercise);
CREATE INDEX IF NOT EXISTS idx_entries_exercise_id ON entries(exercise_id);
