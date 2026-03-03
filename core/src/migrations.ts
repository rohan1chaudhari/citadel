// Migration runner for Citadel apps
// Tracks applied migrations in the citadel host DB, runs each migration in a transaction

import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { assertAppId } from './appIds.js';
import { appsDir, appDataRoot, dataRoot } from './paths.js';
import { audit } from './audit.js';

const CITADEL_APP_ID = 'citadel';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
  failed?: { file: string; error: string };
}

/**
 * Ensure the migrations tracking table exists in the citadel DB
 */
function ensureMigrationsTable(citadelDb: DatabaseSync): void {
  citadelDb.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      app_id TEXT NOT NULL,
      migration_name TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      PRIMARY KEY (app_id, migration_name)
    )
  `);
}

/**
 * Get the list of already applied migrations for an app
 */
function getAppliedMigrations(citadelDb: DatabaseSync, appId: string): Set<string> {
  ensureMigrationsTable(citadelDb);
  const stmt = citadelDb.prepare('SELECT migration_name FROM migrations WHERE app_id = ?');
  const rows = stmt.all(appId) as Array<{ migration_name: string }>;
  return new Set(rows.map(r => r.migration_name));
}

/**
 * Record a migration as applied
 */
function recordMigration(citadelDb: DatabaseSync, appId: string, migrationName: string): void {
  const stmt = citadelDb.prepare(
    'INSERT INTO migrations (app_id, migration_name, applied_at) VALUES (?, ?, ?)'
  );
  stmt.run(appId, migrationName, new Date().toISOString());
}

/**
 * Get sorted list of migration files from an app's migrations directory
 */
async function getMigrationFiles(migrationsDir: string): Promise<string[]> {
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
 * Run migrations for a specific app
 * Each migration runs in a transaction on the app's DB
 */
export async function runMigrationsForApp(appId: string): Promise<MigrationResult> {
  assertAppId(appId);

  const appDir = path.join(appsDir(), appId);
  const migrationsDir = path.join(appDir, 'migrations');
  const dataDir = appDataRoot(appId);

  const result: MigrationResult = {
    applied: [],
    skipped: [],
  };

  // Get migration files
  const migrationFiles = await getMigrationFiles(migrationsDir);
  if (migrationFiles.length === 0) {
    return result; // No migrations to run
  }

  // Ensure app data directory exists
  await fs.mkdir(dataDir, { recursive: true });

  // Connect to citadel DB to track migrations
  const citadelDbPath = path.join(dataRoot(), 'citadel', 'app.db');
  const citadelDb = new DatabaseSync(citadelDbPath);

  try {
    // Get already applied migrations
    const applied = getAppliedMigrations(citadelDb, appId);

    // Connect to app DB
    const appDbPath = path.join(dataDir, 'db.sqlite');
    const appDb = new DatabaseSync(appDbPath);

    try {
      appDb.exec('PRAGMA journal_mode = WAL');
      appDb.exec('PRAGMA foreign_keys = ON');

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
          appDb.exec('BEGIN TRANSACTION');
          try {
            appDb.exec(sql);
            appDb.exec('COMMIT');
          } catch (e) {
            appDb.exec('ROLLBACK');
            throw e;
          }

          // Record as applied
          recordMigration(citadelDb, appId, file);
          result.applied.push(file);

          audit(appId, 'migration.applied', { migration: file });
        } catch (e: any) {
          const error = String(e?.message ?? e);
          audit(appId, 'migration.failed', { migration: file, error });
          result.failed = { file, error };
          return result; // Stop on first failure
        }
      }
    } finally {
      appDb.close();
    }
  } finally {
    citadelDb.close();
  }

  return result;
}

/**
 * Run migrations for all installed apps
 * Called on host startup
 */
export async function runAllMigrations(): Promise<Record<string, MigrationResult>> {
  const results: Record<string, MigrationResult> = {};

  const entries = await fs.readdir(appsDir(), { withFileTypes: true });
  const appIds = entries
    .filter(e => e.isDirectory())
    .map(e => e.name);

  for (const appId of appIds) {
    try {
      // Check if app has a valid manifest
      const manifestPath = path.join(appsDir(), appId, 'app.yaml');
      try {
        await fs.access(manifestPath);
      } catch {
        continue; // Skip directories without app.yaml
      }

      results[appId] = await runMigrationsForApp(appId);
    } catch (e: any) {
      results[appId] = {
        applied: [],
        skipped: [],
        failed: { file: 'init', error: String(e?.message ?? e) },
      };
    }
  }

  return results;
}

/**
 * Get migration status for an app
 */
export async function getMigrationStatus(appId: string): Promise<{
  applied: string[];
  pending: string[];
}> {
  assertAppId(appId);

  const migrationsDir = path.join(appsDir(), appId, 'migrations');
  const allMigrations = await getMigrationFiles(migrationsDir);

  const citadelDbPath = path.join(dataRoot(), 'citadel', 'app.db');
  const citadelDb = new DatabaseSync(citadelDbPath);

  try {
    const applied = getAppliedMigrations(citadelDb, appId);
    return {
      applied: allMigrations.filter(m => applied.has(m)),
      pending: allMigrations.filter(m => !applied.has(m)),
    };
  } finally {
    citadelDb.close();
  }
}

/**
 * Get the down migration file name for an up migration
 * e.g., 001_initial.sql -> 001_initial.down.sql
 */
function getDownMigrationName(upMigrationName: string): string {
  return upMigrationName.replace(/\.sql$/, '.down.sql');
}

/**
 * Remove a migration record from the tracking table
 */
function removeMigrationRecord(citadelDb: DatabaseSync, appId: string, migrationName: string): void {
  const stmt = citadelDb.prepare(
    'DELETE FROM migrations WHERE app_id = ? AND migration_name = ?'
  );
  stmt.run(appId, migrationName);
}

export interface RollbackResult {
  rolledBack: string[];
  skipped: string[];
  failed?: { file: string; error: string };
}

/**
 * Rollback the last N migrations for an app
 * Each rollback runs in a transaction on the app's DB
 */
export async function rollbackMigrationsForApp(appId: string, steps: number = 1): Promise<RollbackResult> {
  assertAppId(appId);

  if (steps < 1) {
    throw new Error('Steps must be at least 1');
  }

  const appDir = path.join(appsDir(), appId);
  const migrationsDir = path.join(appDir, 'migrations');
  const dataDir = appDataRoot(appId);

  const result: RollbackResult = {
    rolledBack: [],
    skipped: [],
  };

  // Get migration files
  const migrationFiles = await getMigrationFiles(migrationsDir);
  if (migrationFiles.length === 0) {
    return result; // No migrations to rollback
  }

  // Connect to citadel DB to track migrations
  const citadelDbPath = path.join(dataRoot(), 'citadel', 'app.db');
  const citadelDb = new DatabaseSync(citadelDbPath);

  try {
    // Get applied migrations, sorted
    const appliedSet = getAppliedMigrations(citadelDb, appId);
    const appliedMigrations = migrationFiles.filter(m => appliedSet.has(m));

    if (appliedMigrations.length === 0) {
      return result; // No applied migrations to rollback
    }

    // Get the last N migrations to rollback (in reverse order)
    const toRollback = appliedMigrations.slice(-steps).reverse();

    // Connect to app DB
    const appDbPath = path.join(dataDir, 'db.sqlite');
    const appDb = new DatabaseSync(appDbPath);

    try {
      appDb.exec('PRAGMA journal_mode = WAL');
      appDb.exec('PRAGMA foreign_keys = ON');

      // Rollback each migration
      for (const file of toRollback) {
        const downFile = getDownMigrationName(file);
        const downPath = path.join(migrationsDir, downFile);

        // Check if down migration exists
        let downSql: string | null = null;
        try {
          await fs.access(downPath);
          downSql = await fs.readFile(downPath, 'utf8');
        } catch {
          // No down migration file - skip this one
          result.skipped.push(file);
          audit(appId, 'migration.rollback_skipped', { migration: file, reason: 'no_down_file' });
          continue;
        }

        try {
          // Run rollback in a transaction
          appDb.exec('BEGIN TRANSACTION');
          try {
            appDb.exec(downSql!);
            appDb.exec('COMMIT');
          } catch (e) {
            appDb.exec('ROLLBACK');
            throw e;
          }

          // Remove from applied migrations
          removeMigrationRecord(citadelDb, appId, file);
          result.rolledBack.push(file);

          audit(appId, 'migration.rolled_back', { migration: file });
        } catch (e: any) {
          const error = String(e?.message ?? e);
          audit(appId, 'migration.rollback_failed', { migration: file, error });
          result.failed = { file, error };
          return result; // Stop on first failure
        }
      }
    } finally {
      appDb.close();
    }
  } finally {
    citadelDb.close();
  }

  return result;
}
