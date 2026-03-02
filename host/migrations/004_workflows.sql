-- Migration: Add workflows table for cross-app automation
-- Created: 2026-03-02

-- Workflows table: stores automation rules
CREATE TABLE IF NOT EXISTS workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT 1,
  trigger_event TEXT NOT NULL,
  trigger_app_id TEXT,
  conditions TEXT NOT NULL DEFAULT '[]',
  actions TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TEXT,
  created_by TEXT
);

-- Index for enabled workflows lookup
CREATE INDEX IF NOT EXISTS idx_workflows_enabled ON workflows(enabled);

-- Index for trigger event matching
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows(trigger_event, trigger_app_id);

-- Workflow executions log table
CREATE TABLE IF NOT EXISTS workflow_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER NOT NULL,
  triggered_by TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  trigger_payload TEXT NOT NULL,
  actions_executed INTEGER NOT NULL DEFAULT 0,
  results TEXT NOT NULL DEFAULT '[]',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  success BOOLEAN NOT NULL DEFAULT 0,
  error TEXT,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Index for workflow execution history
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_time ON workflow_executions(started_at DESC);
