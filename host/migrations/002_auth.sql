-- Add auth support: passphrase hash storage
-- Stores the argon2 hash of the admin passphrase when auth is enabled

CREATE TABLE IF NOT EXISTS auth_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Default: auth disabled (passphrase_hash is null/empty means auth disabled)
-- When CITADEL_AUTH_ENABLED=true and passphrase is set, auth is active
