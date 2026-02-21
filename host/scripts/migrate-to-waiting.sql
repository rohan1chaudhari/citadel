-- Migration: Merge blocked and needs_input into waiting
-- Run this in the scrum-board database

-- First, check if we need to migrate
SELECT 'Checking current statuses...' as status;

-- Count tasks by status
SELECT status, COUNT(*) as count FROM tasks GROUP BY status;

-- Migrate blocked and needs_input to waiting
UPDATE tasks SET 
  status = 'waiting',
  updated_at = datetime('now'),
  -- Preserve the original reason in last_error if not set
  last_error = COALESCE(last_error, 'Migrated from ' || status)
WHERE status IN ('blocked', 'needs_input');

-- Verify migration
SELECT status, COUNT(*) as count FROM tasks GROUP BY status;
