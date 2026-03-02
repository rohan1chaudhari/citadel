// Host-level migration system for Citadel
// Tracks applied migrations in the citadel DB and runs each migration in a transaction

import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { dataRoot, repoRoot } from './paths.js';
import { audit } from './audit.js';

export interface HostMigrationResult {
  applied: string[];
  skipped: string[];
  failed?: { file: string; error: string };
}

/**
 * Get the path to the host migrations directory
 */
function getHostMigrationsDir(): string {
  // Host migrations are in host/migrations/ relative to repo root
  return path.join(repoRoot(), 'host', 'migrations');
}

/**
 * Get the path to the citadel DB
 */
function getCitadelDbPath(): string {
  return path.join(dataRoot(), 'apps', 'citadel', 'db.sqlite');
}

/**
 * Ensure the host_migrations tracking table exists in the citadel DB
 */
function ensureHostMigrationsTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS host_migrations (
      migration_name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
}

/**
 * Get the list of already applied host migrations
 */
function getAppliedHostMigrations(db: DatabaseSync): Set<string> {
  ensureHostMigrationsTable(db);
  const stmt = db.prepare('SELECT migration_name FROM host_migrations');
  const rows = stmt.all() as Array<{ migration_name: string }>;
  return new Set(rows.map(r => r.migration_name));
}

/**
 * Record a host migration as applied
 */
function recordHostMigration(db: DatabaseSync, migrationName: string): void {
  const stmt = db.prepare(
    'INSERT INTO host_migrations (migration_name, applied_at) VALUES (?, ?)'
  );
  stmt.run(migrationName, new Date().toISOString());
}

/**
 * Get sorted list of migration files from the host migrations directory
 */
async function getHostMigrationFiles(migrationsDir: string): Promise<string[]> {
  try {
    await fs.access(migrationsDir);
  } catch {
    return []; // No migrations directory
  }

  const files = await fs.readdir(migrationsDir);
  return files
    .filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort(); // Natural sort: 001, 002, 003...
}

/**
 * Run host-level migrations
 * Each migration runs in a transaction on the citadel DB
 * 
 * @throws Error if a migration fails (to prevent startup with inconsistent state)
 */
export async function runHostMigrations(): Promise<HostMigrationResult> {
  const migrationsDir = getHostMigrationsDir();
  const citadelDbPath = getCitadelDbPath();

  const result: HostMigrationResult = {
    applied: [],
    skipped: [],
  };

  // Get migration files
  const migrationFiles = await getHostMigrationFiles(migrationsDir);
  if (migrationFiles.length === 0) {
    return result; // No migrations to run
  }

  // Ensure citadel data directory exists
  await fs.mkdir(path.dirname(citadelDbPath), { recursive: true });

  // Connect to citadel DB
  const db = new DatabaseSync(citadelDbPath);

  try {
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');

    // Get already applied migrations
    const applied = getAppliedHostMigrations(db);

    // Apply pending migrations
    for (const file of migrationFiles) {
      if (applied.has(file)) {
        result.skipped.push(file);
        continue;
      }

      const migrationPath = path.join(migrationsDir, file);
      const sql = await fs.readFile(migrationPath, 'utf8');

      try {
        // Run migration in a transaction
        db.exec('BEGIN TRANSACTION');
        try {
          db.exec(sql);
          db.exec('COMMIT');
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }

        // Record as applied
        recordHostMigration(db, file);
        result.applied.push(file);

        audit('citadel', 'host_migration.applied', { migration: file });
      } catch (e: any) {
        const error = String(e?.message ?? e);
        audit('citadel', 'host_migration.failed', { migration: file, error });
        result.failed = { file, error };
        
        // Throw to prevent startup with failed migration
        throw new Error(`Host migration failed: ${file} - ${error}`);
      }
    }
  } finally {
    db.close();
  }

  return result;
}

/**
 * Get host migration status
 */
export async function getHostMigrationStatus(): Promise<{
  applied: string[];
  pending: string[];
}> {
  const migrationsDir = getHostMigrationsDir();
  const citadelDbPath = getCitadelDbPath();

  const allMigrations = await getHostMigrationFiles(migrationsDir);

  // Ensure citadel data directory exists
  await fs.mkdir(path.dirname(citadelDbPath), { recursive: true });

  const db = new DatabaseSync(citadelDbPath);

  try {
    const applied = getAppliedHostMigrations(db);
    return {
      applied: allMigrations.filter(m => applied.has(m)),
      pending: allMigrations.filter(m => !applied.has(m)),
    };
  } finally {
    db.close();
  }
}

/**
 * Check if host migrations are up to date
 * Returns true if all migrations have been applied
 */
export async function areHostMigrationsCurrent(): Promise<boolean> {
  const status = await getHostMigrationStatus();
  return status.pending.length === 0;
}
