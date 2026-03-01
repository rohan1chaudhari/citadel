-- Initial schema for hello-world app
-- This migration runs automatically when the app is first loaded

-- Create a simple greetings table
CREATE TABLE IF NOT EXISTS greetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert sample data
INSERT INTO greetings (message, created_at) VALUES 
  ('Hello, Citadel!', datetime('now')),
  ('Welcome to app development!', datetime('now'));

-- Create an index for efficient querying
CREATE INDEX IF NOT EXISTS idx_greetings_created_at ON greetings(created_at);
