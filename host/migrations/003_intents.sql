-- Migration: Add intent consent table for cross-app intent system
-- Created: 2026-03-02

CREATE TABLE IF NOT EXISTS intent_consent (
  app_id TEXT NOT NULL,
  action_uri TEXT NOT NULL,
  target_app_id TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  PRIMARY KEY (app_id, action_uri)
);

-- Index for looking up consents by target app
CREATE INDEX IF NOT EXISTS idx_intent_consent_target ON intent_consent(target_app_id);
