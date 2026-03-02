-- Initial schema for Citadel host database
-- This captures all tables that existed before the host migration system was introduced

-- Table: hidden_apps
-- Tracks which apps have been hidden from the home grid
CREATE TABLE IF NOT EXISTS hidden_apps (
  app_id TEXT PRIMARY KEY,
  hidden_at TEXT NOT NULL
);

-- Table: installed_apps
-- Registry of installed apps with their metadata and runtime configuration
CREATE TABLE IF NOT EXISTS installed_apps (
  app_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  entry_path TEXT NOT NULL,
  health_path TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  events_path TEXT,
  meta_path TEXT,
  agent_callback_path TEXT,
  upstream_base_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  installed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  runtime_json TEXT
);

-- Table: app_permission_overrides
-- Per-app permission overrides stored separately from the manifest
CREATE TABLE IF NOT EXISTS app_permission_overrides (
  app_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  granted INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (app_id, permission)
);

-- Table: app_permissions
-- User-granted permissions for each app
CREATE TABLE IF NOT EXISTS app_permissions (
  app_id TEXT PRIMARY KEY,
  scopes TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Table: audit_log
-- Audit trail of all app actions
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  app_id TEXT NOT NULL,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Index for efficient audit log queries by app and timestamp
CREATE INDEX IF NOT EXISTS idx_audit_app_ts ON audit_log(app_id, ts);

-- Table: migrations
-- Tracks which migrations have been applied for each app (app-level migrations)
CREATE TABLE IF NOT EXISTS migrations (
  app_id TEXT NOT NULL,
  migration_name TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  PRIMARY KEY (app_id, migration_name)
);

-- Table: host_settings
-- Host-level configuration and settings
CREATE TABLE IF NOT EXISTS host_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Table: host_migrations
-- Tracks which host-level migrations have been applied
CREATE TABLE IF NOT EXISTS host_migrations (
  migration_name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
