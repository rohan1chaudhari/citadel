-- Initial schema for task-manager app
-- Creates the tasks table with priority support

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TEXT NOT NULL,
  updated_at TEXT,
  completed_at TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
