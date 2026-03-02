// Host settings management for Citadel
// Stores setup_complete flag, API keys, and other host-level configuration

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { dataRoot } from './paths.js';
import { audit } from './audit.js';

const CITADEL_APP_ID = 'citadel';

export interface HostSettings {
  setup_complete: boolean;
  openai_api_key?: string;
  anthropic_api_key?: string;
  data_directory?: string;
}

let citadelDb: DatabaseSync | null = null;

function getCitadelDb(): DatabaseSync {
  if (!citadelDb) {
    const citadelDbPath = path.join(dataRoot(), 'citadel.sqlite');
    citadelDb = new DatabaseSync(citadelDbPath);
    ensureSettingsTable(citadelDb);
  }
  return citadelDb;
}

function ensureSettingsTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS host_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

/**
 * Get a setting value by key
 */
export function getSetting(key: string): string | undefined {
  try {
    const db = getCitadelDb();
    const stmt = db.prepare('SELECT value FROM host_settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value;
  } catch (e: any) {
    audit(CITADEL_APP_ID, 'settings.get.error', { key, error: String(e?.message ?? e) });
    return undefined;
  }
}

/**
 * Set a setting value
 */
export function setSetting(key: string, value: string): void {
  try {
    const db = getCitadelDb();
    const stmt = db.prepare(`
      INSERT INTO host_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);
    stmt.run(key, value, new Date().toISOString());
    audit(CITADEL_APP_ID, 'settings.set', { key });
  } catch (e: any) {
    audit(CITADEL_APP_ID, 'settings.set.error', { key, error: String(e?.message ?? e) });
    throw e;
  }
}

/**
 * Check if setup has been completed
 */
export function isSetupComplete(): boolean {
  // Check env var first (for Docker/automation)
  if (process.env.CITADEL_SKIP_SETUP === 'true') {
    return true;
  }
  
  const value = getSetting('setup_complete');
  return value === 'true';
}

/**
 * Mark setup as complete
 */
export function completeSetup(): void {
  setSetting('setup_complete', 'true');
}

/**
 * Get all host settings
 */
export function getAllSettings(): HostSettings {
  return {
    setup_complete: isSetupComplete(),
    openai_api_key: getSetting('openai_api_key'),
    anthropic_api_key: getSetting('anthropic_api_key'),
    data_directory: dataRoot(),
  };
}

/**
 * Save API keys from setup
 */
export function saveApiKeys(openaiKey?: string, anthropicKey?: string): void {
  if (openaiKey && openaiKey.trim()) {
    setSetting('openai_api_key', openaiKey.trim());
  }
  if (anthropicKey && anthropicKey.trim()) {
    setSetting('anthropic_api_key', anthropicKey.trim());
  }
}
