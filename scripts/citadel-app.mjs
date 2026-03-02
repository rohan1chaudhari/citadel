#!/usr/bin/env node
/**
 * Citadel App CLI
 * 
 * Commands:
 *   citadel-app install <git-url|local-path>   Install an app from git or local path
 *   citadel-app uninstall <app-id>             Remove an installed app
 *   citadel-app update <app-id>                Update an installed app
 *   citadel-app create <app-id>                Create a new app from template
 *   citadel-app migrate <app-id>               Run migrations for an app
 *   citadel-app dev <path-to-app>              Start dev mode for local app development
 * 
 * Environment:
 *   CITADEL_APPS_DIR    - Apps directory (default: ../apps from script location)
 *   CITADEL_DATA_ROOT   - Data directory (default: ../data)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const SCRIPT_DIR = path.resolve(__dirname);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_APPS_DIR = path.join(REPO_ROOT, 'apps');
const APPS_DIR = process.env.CITADEL_APPS_DIR || DEFAULT_APPS_DIR;
const DATA_DIR = process.env.CITADEL_DATA_ROOT || path.join(REPO_ROOT, 'data');

// Registry configuration
const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/openclaw/citadel-registry/main/registry.json';
const REGISTRY_URL = process.env.CITADEL_REGISTRY_URL || DEFAULT_REGISTRY_URL;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function error(msg) {
  console.error(`${colors.red}Error: ${msg}${colors.reset}`);
  process.exit(1);
}

function success(msg) {
  log(`✓ ${msg}`, 'green');
}

function info(msg) {
  log(`  ${msg}`, 'cyan');
}

// App ID validation
const APP_ID_RE = /^[a-z][a-z0-9-]{0,63}$/;
const RESERVED_IDS = ['citadel', 'host', 'api', 'static', 'core', 'internal'];

function validateAppId(id) {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'App ID is required' };
  }
  if (id.length > 64) {
    return { valid: false, error: 'App ID must be at most 64 characters' };
  }
  if (!APP_ID_RE.test(id)) {
    return { valid: false, error: 'App ID must be lowercase alphanumeric with hyphens, starting with a letter' };
  }
  if (RESERVED_IDS.includes(id)) {
    return { valid: false, error: `App ID "${id}" is reserved` };
  }
  return { valid: true };
}

// Manifest validation
const REQUIRED_FIELDS = ['id', 'name', 'version', 'permissions'];

function validateManifest(manifest, filePath) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be an object'] };
  }

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in manifest) || manifest[field] === undefined || manifest[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate field types
  if (typeof manifest.id !== 'string') {
    errors.push('Field "id" must be a string');
  } else {
    const idCheck = validateAppId(manifest.id);
    if (!idCheck.valid) {
      errors.push(idCheck.error);
    }
  }

  if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
    errors.push('Field "name" must be a non-empty string');
  }

  if (typeof manifest.version !== 'string') {
    errors.push('Field "version" must be a string');
  }

  if (!manifest.permissions || typeof manifest.permissions !== 'object') {
    errors.push('Field "permissions" must be an object');
  }

  return { valid: errors.length === 0, errors };
}

async function readManifest(manifestPath) {
  const raw = await fs.readFile(manifestPath, 'utf8');
  return yaml.parse(raw);
}

async function getInstalledAppIds() {
  try {
    const entries = await fs.readdir(APPS_DIR, { withFileTypes: true });
    const ids = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(APPS_DIR, entry.name, 'app.yaml');
        try {
          await fs.access(manifestPath);
          ids.push(entry.name);
        } catch {
          // Not an app directory
        }
      }
    }
    return ids;
  } catch {
    return [];
  }
}

// Check if a path is a git URL
function isGitUrl(str) {
  return str.startsWith('git@') || 
         str.startsWith('https://') || 
         str.endsWith('.git') ||
         /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(str);
}

// Clone a git repository
async function gitClone(url, targetDir) {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', ['clone', url, targetDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data; });
    proc.stderr.on('data', (data) => { stderr += data; });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`git clone failed: ${stderr || stdout}`));
      }
    });
  });
}

// Copy directory recursively
async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// Import and use the core migration module
async function getMigrationModule() {
  // Use dynamic import to load the compiled core module
  const corePath = path.join(REPO_ROOT, 'core', 'dist', 'index.js');
  try {
    return await import(corePath);
  } catch {
    // Fallback: use inline implementation
    return null;
  }
}

// Run migrations for an app using the core module
async function runMigrations(appId) {
  const core = await getMigrationModule();
  
  if (core && core.runMigrationsForApp) {
    // Use the core module's migration runner
    const result = await core.runMigrationsForApp(appId);
    
    if (result.failed) {
      throw new Error(`Migration ${result.failed.file} failed: ${result.failed.error}`);
    }
    
    for (const file of result.skipped) {
      info(`Migration already applied: ${file}`);
    }
    
    for (const file of result.applied) {
      success(`Applied migration: ${file}`);
    }
    
    return result;
  }
  
  // Fallback: inline migration runner (simplified version)
  const { DatabaseSync } = await import('node:sqlite');
  const appDir = path.join(APPS_DIR, appId);
  const migrationsDir = path.join(appDir, 'migrations');
  const appDataDir = path.join(DATA_DIR, 'apps', appId);

  // Check if migrations directory exists
  try {
    await fs.access(migrationsDir);
  } catch {
    info('No migrations to run');
    return { applied: [], skipped: [] };
  }

  // Get list of migration files
  const files = await fs.readdir(migrationsDir);
  const migrationFiles = files
    .filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    info('No migrations to run');
    return { applied: [], skipped: [] };
  }

  // Ensure migrations table exists
  const citadelDbPath = path.join(DATA_DIR, 'citadel.sqlite');
  
  // Create app data directory
  await fs.mkdir(appDataDir, { recursive: true });

  // Track applied migrations in citadel DB
  const citadelDb = new DatabaseSync(citadelDbPath);
  try {
    citadelDb.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        app_id TEXT NOT NULL,
        migration_name TEXT NOT NULL,
        applied_at TEXT NOT NULL,
        PRIMARY KEY (app_id, migration_name)
      )
    `);

    // Get already applied migrations
    const appliedStmt = citadelDb.prepare('SELECT migration_name FROM migrations WHERE app_id = ?');
    const appliedRows = appliedStmt.all(appId);
    const applied = new Set(appliedRows.map(r => r.migration_name));

    const result = { applied: [], skipped: [] };
    
    // Apply pending migrations
    for (const file of migrationFiles) {
      if (applied.has(file)) {
        info(`Migration already applied: ${file}`);
        result.skipped.push(file);
        continue;
      }

      const migrationPath = path.join(migrationsDir, file);
      const sql = await fs.readFile(migrationPath, 'utf8');

      // Apply to app DB in a transaction
      const appDbPath = path.join(appDataDir, 'db.sqlite');
      const appDb = new DatabaseSync(appDbPath);
      try {
        appDb.exec('BEGIN TRANSACTION');
        try {
          appDb.exec(sql);
          appDb.exec('COMMIT');
        } catch (e) {
          appDb.exec('ROLLBACK');
          throw e;
        }
        success(`Applied migration: ${file}`);
        result.applied.push(file);
      } finally {
        appDb.close();
      }

      // Record in citadel migrations table
      const insertStmt = citadelDb.prepare(`
        INSERT INTO migrations (app_id, migration_name, applied_at) VALUES (?, ?, ?)
      `);
      insertStmt.run(appId, file, new Date().toISOString());
    }
    
    return result;
  } finally {
    citadelDb.close();
  }
}

// MIGRATE COMMAND
async function migrateCommand(appId, options = {}) {
  if (options.all) {
    // Run migrations for all apps
    log('Running migrations for all apps...', 'blue');
    const installedApps = await getInstalledAppIds();
    
    if (installedApps.length === 0) {
      log('No installed apps found', 'yellow');
      return;
    }

    let totalApplied = 0;
    let totalFailed = 0;
    
    for (const id of installedApps) {
      log(`\n--- ${id} ---`, 'blue');
      try {
        const result = await runMigrations(id);
        totalApplied += result.applied.length;
      } catch (err) {
        log(`Failed: ${err.message}`, 'red');
        totalFailed++;
      }
    }
    
    log(`\n${colors.green}Done!${colors.reset} Applied ${totalApplied} migrations across ${installedApps.length} apps.`);
    if (totalFailed > 0) {
      log(`${totalFailed} app(s) had failures.`, 'yellow');
      process.exit(1);
    }
    return;
  }

  if (!appId) {
    error('Usage: citadel-app migrate <app-id> | citadel-app migrate --all');
  }

  // Validate app ID
  const idCheck = validateAppId(appId);
  if (!idCheck.valid) {
    error(idCheck.error);
  }

  // Check if app is installed
  const appDir = path.join(APPS_DIR, appId);
  try {
    await fs.access(appDir);
  } catch {
    error(`App "${appId}" is not installed`);
  }

  log(`Running migrations for: ${appId}`, 'blue');

  try {
    const result = await runMigrations(appId);
    
    if (result.applied.length === 0 && result.skipped.length === 0) {
      info('No migrations found');
    } else if (result.applied.length === 0) {
      info('All migrations already up to date');
    } else {
      success(`${result.applied.length} migration(s) applied`);
    }
    
    log(`\nApp URL: http://localhost:3000/apps/${appId}`, 'green');
  } catch (err) {
    error(`Migration failed: ${err.message}`);
  }
}

// Rollback migrations for an app using the core module or inline fallback
async function rollbackMigrations(appId, steps = 1) {
  const core = await getMigrationModule();
  
  if (core && core.rollbackMigrationsForApp) {
    // Use the core module's rollback runner
    const result = await core.rollbackMigrationsForApp(appId, steps);
    
    if (result.failed) {
      throw new Error(`Rollback ${result.failed.file} failed: ${result.failed.error}`);
    }
    
    for (const file of result.skipped) {
      info(`Skipped (no down file): ${file}`);
    }
    
    for (const file of result.rolledBack) {
      success(`Rolled back: ${file}`);
    }
    
    return result;
  }
  
  // Fallback: inline rollback runner
  const { DatabaseSync } = await import('node:sqlite');
  const appDir = path.join(APPS_DIR, appId);
  const migrationsDir = path.join(appDir, 'migrations');
  const appDataDir = path.join(DATA_DIR, 'apps', appId);

  // Check if migrations directory exists
  try {
    await fs.access(migrationsDir);
  } catch {
    info('No migrations to rollback');
    return { rolledBack: [], skipped: [] };
  }

  // Get list of migration files (excluding down files)
  const files = await fs.readdir(migrationsDir);
  const migrationFiles = files
    .filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    info('No migrations to rollback');
    return { rolledBack: [], skipped: [] };
  }

  const citadelDbPath = path.join(DATA_DIR, 'citadel.sqlite');
  const citadelDb = new DatabaseSync(citadelDbPath);
  
  try {
    // Ensure migrations table exists
    citadelDb.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        app_id TEXT NOT NULL,
        migration_name TEXT NOT NULL,
        applied_at TEXT NOT NULL,
        PRIMARY KEY (app_id, migration_name)
      )
    `);

    // Get applied migrations
    const appliedStmt = citadelDb.prepare('SELECT migration_name FROM migrations WHERE app_id = ?');
    const appliedRows = appliedStmt.all(appId);
    const appliedSet = new Set(appliedRows.map(r => r.migration_name));
    const appliedMigrations = migrationFiles.filter(m => appliedSet.has(m));

    if (appliedMigrations.length === 0) {
      info('No applied migrations to rollback');
      return { rolledBack: [], skipped: [] };
    }

    // Get last N migrations to rollback (in reverse order)
    const toRollback = appliedMigrations.slice(-steps).reverse();
    const result = { rolledBack: [], skipped: [] };

    // Connect to app DB
    const appDbPath = path.join(appDataDir, 'db.sqlite');
    const appDb = new DatabaseSync(appDbPath);

    try {
      for (const file of toRollback) {
        const downFile = file.replace(/\.sql$/, '.down.sql');
        const downPath = path.join(migrationsDir, downFile);

        // Check if down migration exists
        let downSql;
        try {
          await fs.access(downPath);
          downSql = await fs.readFile(downPath, 'utf8');
        } catch {
          info(`Skipped (no down file): ${file}`);
          result.skipped.push(file);
          continue;
        }

        // Run rollback in a transaction
        appDb.exec('BEGIN TRANSACTION');
        try {
          appDb.exec(downSql);
          appDb.exec('COMMIT');
        } catch (e) {
          appDb.exec('ROLLBACK');
          throw e;
        }

        // Remove from migrations table
        const deleteStmt = citadelDb.prepare('DELETE FROM migrations WHERE app_id = ? AND migration_name = ?');
        deleteStmt.run(appId, file);

        success(`Rolled back: ${file}`);
        result.rolledBack.push(file);
      }
    } finally {
      appDb.close();
    }
    
    return result;
  } finally {
    citadelDb.close();
  }
}

// MIGRATE ROLLBACK COMMAND
async function migrateRollbackCommand(appId, options = {}) {
  if (!appId) {
    error('Usage: citadel-app migrate:rollback <app-id> [--steps=N]');
  }

  // Validate app ID
  const idCheck = validateAppId(appId);
  if (!idCheck.valid) {
    error(idCheck.error);
  }

  // Check if app is installed
  const appDir = path.join(APPS_DIR, appId);
  try {
    await fs.access(appDir);
  } catch {
    error(`App "${appId}" is not installed`);
  }

  const steps = options.steps || 1;
  log(`Rolling back ${steps} migration(s) for: ${appId}`, 'blue');

  try {
    const result = await rollbackMigrations(appId, steps);
    
    if (result.rolledBack.length === 0 && result.skipped.length === 0) {
      info('No migrations to rollback');
    } else if (result.rolledBack.length === 0) {
      info('No rollbacks performed (migrations may be missing down files)');
    } else {
      success(`${result.rolledBack.length} migration(s) rolled back`);
    }
  } catch (err) {
    error(`Rollback failed: ${err.message}`);
  }
}

// UPDATE COMMAND
async function updateCommand(appId, options = {}) {
  if (options.all) {
    // Update all git-installed apps
    log('Updating all git-installed apps...', 'blue');
    const installedApps = await getInstalledAppIds();
    const gitApps = [];

    for (const id of installedApps) {
      const appGitDir = path.join(APPS_DIR, id, '.git');
      try {
        await fs.access(appGitDir);
        gitApps.push(id);
      } catch {
        // Not a git repo, skip
      }
    }

    if (gitApps.length === 0) {
      log('No git-installed apps found', 'yellow');
      return;
    }

    log(`Found ${gitApps.length} git-installed apps: ${gitApps.join(', ')}`, 'cyan');

    for (const id of gitApps) {
      log(`\n--- Updating ${id} ---`, 'blue');
      try {
        await updateSingleApp(id);
      } catch (err) {
        log(`Failed to update ${id}: ${err.message}`, 'red');
      }
    }
    return;
  }

  if (!appId) {
    error('Usage: citadel-app update <app-id> | citadel-app update --all');
  }

  await updateSingleApp(appId);
}

async function updateSingleApp(appId) {
  // Validate app ID
  const idCheck = validateAppId(appId);
  if (!idCheck.valid) {
    error(idCheck.error);
  }

  // Check if app is installed
  const appDir = path.join(APPS_DIR, appId);
  try {
    await fs.access(appDir);
  } catch {
    error(`App "${appId}" is not installed`);
  }

  // Check if it's a git repo
  const gitDir = path.join(appDir, '.git');
  try {
    await fs.access(gitDir);
  } catch {
    error(`App "${appId}" was not installed from git. Cannot update.`);
  }

  log(`Updating app: ${appId}`, 'blue');

  // Read current manifest version for comparison
  const manifestPath = path.join(appDir, 'app.yaml');
  let currentManifest;
  try {
    currentManifest = await readManifest(manifestPath);
  } catch (err) {
    error(`Failed to read current manifest: ${err.message}`);
  }
  const oldVersion = currentManifest.version;
  info(`Current version: ${oldVersion}`);

  // Create backup
  const backupDir = path.join(DATA_DIR, 'backups', `${appId}-${Date.now()}`);
  info(`Creating backup at: ${backupDir}`);
  await fs.mkdir(backupDir, { recursive: true });

  // Copy current app to backup (excluding .git for speed)
  const entries = await fs.readdir(appDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const srcPath = path.join(appDir, entry.name);
    const destPath = path.join(backupDir, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }

  // Run git pull
  info('Pulling latest changes...');
  try {
    await gitPull(appDir);
  } catch (err) {
    // Restore from backup on failure
    log(`Git pull failed: ${err.message}`, 'red');
    info('Restoring from backup...');
    await restoreFromBackup(backupDir, appDir);
    error('Update failed. App restored to previous state.');
  }

  // Validate updated manifest
  info('Validating updated manifest...');
  let newManifest;
  try {
    newManifest = await readManifest(manifestPath);
  } catch (err) {
    // Restore from backup on failure
    log(`Invalid manifest: ${err.message}`, 'red');
    info('Restoring from backup...');
    await restoreFromBackup(backupDir, appDir);
    error('Update failed. App restored to previous state.');
  }

  const validation = validateManifest(newManifest, manifestPath);
  if (!validation.valid) {
    log(`Invalid manifest:\n  - ${validation.errors.join('\n  - ')}`, 'red');
    info('Restoring from backup...');
    await restoreFromBackup(backupDir, appDir);
    error('Update failed. App restored to previous state.');
  }

  // Check app ID hasn't changed
  if (newManifest.id !== appId) {
    log(`App ID changed from "${appId}" to "${newManifest.id}" - not allowed`, 'red');
    info('Restoring from backup...');
    await restoreFromBackup(backupDir, appDir);
    error('Update failed. App restored to previous state.');
  }

  info(`New version: ${newManifest.version}`);

  // Run migrations
  info('Running migrations...');
  try {
    await runMigrations(appId);
  } catch (err) {
    // Restore from backup on migration failure
    log(`Migration failed: ${err.message}`, 'red');
    info('Restoring from backup...');
    await restoreFromBackup(backupDir, appDir);
    error('Update failed. App restored to previous state.');
  }

  // Success - clean up backup
  info('Cleaning up backup...');
  await fs.rm(backupDir, { recursive: true, force: true });

  success(`App "${appId}" updated successfully!`);
  info(`${oldVersion} → ${newManifest.version}`);
  log(`\nApp URL: http://localhost:3000/apps/${appId}`, 'green');
}

// Run git pull in a directory
async function gitPull(repoDir) {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', ['pull'], {
      cwd: repoDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data; });
    proc.stderr.on('data', (data) => { stderr += data; });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`git pull failed: ${stderr || stdout}`));
      }
    });
  });
}

// Restore app directory from backup
async function restoreFromBackup(backupDir, appDir) {
  // Remove all files except .git
  const entries = await fs.readdir(appDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const fullPath = path.join(appDir, entry.name);
    await fs.rm(fullPath, { recursive: true, force: true });
  }

  // Copy backup files back
  const backupEntries = await fs.readdir(backupDir, { withFileTypes: true });
  for (const entry of backupEntries) {
    const srcPath = path.join(backupDir, entry.name);
    const destPath = path.join(appDir, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// UNINSTALL COMMAND
async function uninstallCommand(appId, options = {}) {
  if (!appId) {
    error('Usage: citadel-app uninstall <app-id> [--delete-data]');
  }

  // Validate app ID
  const idCheck = validateAppId(appId);
  if (!idCheck.valid) {
    error(idCheck.error);
  }

  // Cannot uninstall protected apps
  const PROTECTED_APPS = ['citadel', 'scrum-board'];
  if (PROTECTED_APPS.includes(appId)) {
    error(`Cannot uninstall protected app: ${appId}`);
  }

  // Check if app is installed
  const appDir = path.join(APPS_DIR, appId);
  try {
    await fs.access(appDir);
  } catch {
    error(`App "${appId}" is not installed`);
  }

  // Check if app data exists
  const appDataDir = path.join(DATA_DIR, 'apps', appId);
  let hasData = false;
  try {
    await fs.access(appDataDir);
    hasData = true;
  } catch {
    // No data directory
  }

  log(`Uninstalling app: ${appId}`, 'blue');

  // Determine if we should delete data
  let deleteData = options.deleteData || false;

  // Prompt if not using --delete-data flag and data exists
  if (!deleteData && hasData && !options.force) {
    // For non-interactive environments, default to keeping data
    // We'll use a simple approach: check if stdin is TTY
    if (process.stdin.isTTY) {
      const answer = await new Promise((resolve) => {
        process.stdout.write('Delete app data? (y/N) ');
        process.stdin.once('data', (data) => {
          const input = data.toString().trim().toLowerCase();
          resolve(input === 'y' || input === 'yes');
        });
      });
      deleteData = answer;
    } else {
      info('App has data. Use --delete-data to remove it, or --force to skip this check.');
    }
  }

  // Remove app directory
  info(`Removing app directory: ${appDir}`);
  await fs.rm(appDir, { recursive: true, force: true });

  // Remove data if requested
  if (deleteData && hasData) {
    info(`Removing app data: ${appDataDir}`);
    await fs.rm(appDataDir, { recursive: true, force: true });
  }

  // Clean up migrations record from citadel DB
  const citadelDbPath = path.join(DATA_DIR, 'citadel.sqlite');
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const citadelDb = new DatabaseSync(citadelDbPath);
    try {
      const deleteStmt = citadelDb.prepare('DELETE FROM migrations WHERE app_id = ?');
      deleteStmt.run(appId);
    } finally {
      citadelDb.close();
    }
  } catch {
    // Ignore errors - migrations table may not exist
  }

  // Success
  success(`App "${appId}" uninstalled successfully`);
  if (deleteData) {
    success('App data deleted');
  } else if (hasData) {
    info('App data preserved (use --delete-data to remove)');
  }
}

// Templates for app scaffolding
const TEMPLATES = {
  blank: {
    name: 'Blank',
    description: 'Minimal app with basic structure',
    migration: `CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);`,
    pageComponent: (appId, title, componentName) => `import { Shell, Card } from '@/components/Shell';

export const runtime = 'nodejs';

export default function ${componentName}Page() {
  return (
    <Shell title="${title}" subtitle="Generated by citadel-app create">
      <Card>
        <p>Welcome to ${title}.</p>
        <p className="text-sm text-zinc-500 mt-2">
          App ID: ${appId}
        </p>
      </Card>
    </Shell>
  );
}`,
    apiRoute: (appId) => `import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ ok: true, appId: '${appId}' });
}`,
  },
  crud: {
    name: 'CRUD',
    description: 'Full CRUD app with list, create, edit, and delete',
    migration: `CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);`,
    pageComponent: (appId, title, componentName) => `import { Shell, Card, LinkA } from '@/components/Shell';
import { dbQuery, dbExec } from '@citadel/core';
import { requirePermissionConsent } from '@/lib/requirePermissionConsent';
import Link from 'next/link';

export const runtime = 'nodejs';
const APP_ID = '${appId}';

type Item = {
  id: number;
  title: string;
  description: string | null;
  created_at: string;
};

function ensureSchema() {
  dbExec(APP_ID, \`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    )
  \`);
}

async function fetchItems(): Promise<Item[]> {
  ensureSchema();
  const rows = dbQuery<{ id: number; title: string; description: string | null; created_at: string }>(
    APP_ID,
    'SELECT id, title, description, created_at FROM items ORDER BY id DESC LIMIT 50'
  );
  return rows.map(r => ({
    id: Number(r.id),
    title: String(r.title),
    description: r.description,
    created_at: String(r.created_at)
  }));
}

export default async function ${componentName}Page() {
  await requirePermissionConsent(APP_ID);
  const items = await fetchItems();

  return (
    <Shell title="${title}" subtitle="Manage your items">
      <div className="flex items-center justify-between">
        <LinkA href="/">← home</LinkA>
        <Link
          href={\`/apps/\${APP_ID}/new\`}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          + New Item
        </Link>
      </div>

      <div className="grid gap-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={\`/apps/\${APP_ID}/\${item.id}\`}
            className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-400"
          >
            <h3 className="font-semibold text-zinc-900">{item.title}</h3>
            {item.description && (
              <p className="mt-1 text-sm text-zinc-500">{item.description}</p>
            )}
            <p className="mt-2 text-xs text-zinc-400">#{item.id}</p>
          </Link>
        ))}

        {items.length === 0 && (
          <Card>
            <p className="text-zinc-600">No items yet.</p>
            <Link
              href={\`/apps/\${APP_ID}/new\`}
              className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Create your first item
            </Link>
          </Card>
        )}
      </div>
    </Shell>
  );
}`,
    apiRoute: (appId) => `import { NextResponse } from 'next/server';
import { dbQuery, dbExec } from '@citadel/core';

export const runtime = 'nodejs';
const APP_ID = '${appId}';

export async function GET() {
  try {
    const items = dbQuery(
      APP_ID,
      'SELECT id, title, description, created_at FROM items ORDER BY id DESC LIMIT 100'
    );
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ ok: false, error: 'Title is required' }, { status: 400 });
    }

    dbExec(APP_ID, \`
      INSERT INTO items (title, description, created_at)
      VALUES (?, ?, datetime('now'))
    \`, [title, description || null]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}`,
  },
};

function listTemplates() {
  log('Available templates:', 'blue');
  for (const [key, tmpl] of Object.entries(TEMPLATES)) {
    info(`  ${key}: ${tmpl.name} - ${tmpl.description}`);
  }
}

// CREATE COMMAND
async function createCommand(appId, options = {}) {
  if (options.listTemplates) {
    listTemplates();
    return;
  }

  if (!appId) {
    error('Usage: citadel-app create <app-id> [--template=<name>] [--list-templates]');
  }

  const idCheck = validateAppId(appId);
  if (!idCheck.valid) {
    error(idCheck.error);
  }

  // Validate template
  const templateName = options.template || 'blank';
  const template = TEMPLATES[templateName];
  if (!template) {
    error(`Unknown template: "${templateName}". Use --list-templates to see available templates.`);
  }

  const targetDir = path.join(APPS_DIR, appId);
  const hostAppDir = path.join(REPO_ROOT, 'host', 'src', 'app', 'apps', appId);
  const hostApiDir = path.join(REPO_ROOT, 'host', 'src', 'app', 'api', 'apps', appId);

  // Check if app already exists
  try {
    await fs.access(targetDir);
    error(`App directory already exists: ${targetDir}`);
  } catch {
    // expected: does not exist
  }

  // Check if host page already exists
  try {
    await fs.access(hostAppDir);
    error(`Host app directory already exists: ${hostAppDir}`);
  } catch {
    // expected: does not exist
  }

  log(`Creating app scaffold: ${appId} (template: ${templateName})`, 'blue');

  // Create directories
  await fs.mkdir(path.join(targetDir, 'migrations'), { recursive: true });
  await fs.mkdir(hostAppDir, { recursive: true });
  await fs.mkdir(hostApiDir, { recursive: true });

  const title = appId
    .split('-')
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ');

  const componentName = title.replace(/[^A-Za-z0-9]/g, '') || 'NewApp';

  const appYaml = `id: ${appId}
name: ${title}
version: 0.1.0
manifest_version: "1.0"
permissions:
  db:
    read: true
    write: true
  storage:
    read: false
    write: false
connectors: []
`;

  const readme = `# ${title}

Generated with:

\`\`\`bash
citadel-app create ${appId} --template=${templateName}
\`\`\`

## Files
- \`app.yaml\` - App manifest
- \`migrations/001_initial.sql\` - Initial DB schema
- \`host/src/app/apps/${appId}/page.tsx\` - Main page component
- \`host/src/app/api/apps/${appId}/route.ts\` - API route

## Next Steps

1. Review and customize \`app.yaml\`
2. Edit the page at \`host/src/app/apps/${appId}/page.tsx\`
3. Add API endpoints in \`host/src/app/api/apps/${appId}/\`
4. Run migrations: \`npm run citadel-app migrate ${appId}\`
5. Start the host and visit http://localhost:3000/apps/${appId}
`;

  // Write app files
  await fs.writeFile(path.join(targetDir, 'app.yaml'), appYaml, 'utf8');
  await fs.writeFile(path.join(targetDir, 'migrations', '001_initial.sql'), template.migration, 'utf8');
  await fs.writeFile(path.join(targetDir, 'README.md'), readme, 'utf8');

  // Write host files
  await fs.writeFile(path.join(hostAppDir, 'page.tsx'), template.pageComponent(appId, title, componentName), 'utf8');
  await fs.writeFile(path.join(hostApiDir, 'route.ts'), template.apiRoute(appId), 'utf8');

  success(`Created app scaffold at ${targetDir}`);
  info('Files created:');
  info(`  - ${path.join(targetDir, 'app.yaml')}`);
  info(`  - ${path.join(targetDir, 'migrations', '001_initial.sql')}`);
  info(`  - ${path.join(hostAppDir, 'page.tsx')}`);
  info(`  - ${path.join(hostApiDir, 'route.ts')}`);
  info(`  - ${path.join(targetDir, 'README.md')}`);
  info('');
  info('Next steps:');
  info('1) Review the generated files');
  info(`2) Run: npm run citadel-app migrate ${appId}`);
  info(`3) Start host and open /apps/${appId}`);
}

// DEV COMMAND
async function devCommand(appPath, options = {}) {
  if (!appPath) {
    error('Usage: citadel-app dev <path-to-app>');
  }

  const resolvedPath = path.resolve(appPath);
  
  // Check if path exists
  try {
    await fs.access(resolvedPath);
  } catch {
    error(`Path does not exist: ${resolvedPath}`);
  }

  // Check if it's a directory
  const stats = await fs.stat(resolvedPath);
  if (!stats.isDirectory()) {
    error(`Path is not a directory: ${resolvedPath}`);
  }

  // Read and validate manifest
  const manifestPath = path.join(resolvedPath, 'app.yaml');
  try {
    await fs.access(manifestPath);
  } catch {
    error(`No app.yaml found in ${resolvedPath}`);
  }

  log(`Reading app manifest...`, 'blue');
  const manifest = await readManifest(manifestPath);
  const validation = validateManifest(manifest, manifestPath);
  
  if (!validation.valid) {
    error(`Invalid manifest:\n  - ${validation.errors.join('\n  - ')}`);
  }

  const appId = manifest.id;
  info(`App ID: ${appId}`);
  info(`Name: ${manifest.name}`);
  info(`Version: ${manifest.version}`);

  // Check if this app ID is already installed (not as a symlink)
  const targetLinkPath = path.join(APPS_DIR, appId);
  
  try {
    const existingStat = await fs.lstat(targetLinkPath);
    if (existingStat.isDirectory() && !existingStat.isSymbolicLink()) {
      // It's a regular directory - error unless --force
      if (!options.force) {
        error(`App "${appId}" is already installed as a regular directory. Use --force to replace with symlink, or uninstall first.`);
      }
      // Remove the existing directory
      log(`Removing existing app directory (forced)...`, 'yellow');
      await fs.rm(targetLinkPath, { recursive: true, force: true });
    } else if (existingStat.isSymbolicLink()) {
      // It's already a symlink - remove it to recreate
      const existingTarget = await fs.readlink(targetLinkPath);
      info(`Removing existing symlink (pointed to: ${existingTarget})`);
      await fs.unlink(targetLinkPath);
    }
  } catch {
    // Path doesn't exist - good to go
  }

  // Create the symlink
  log(`Creating symlink...`, 'blue');
  info(`From: ${targetLinkPath}`);
  info(`To: ${resolvedPath}`);
  
  try {
    await fs.symlink(resolvedPath, targetLinkPath, 'dir');
    success(`Symlink created successfully`);
  } catch (err) {
    error(`Failed to create symlink: ${err.message}`);
  }

  // Run migrations
  log(`Running migrations...`, 'blue');
  try {
    await runMigrations(appId);
  } catch (err) {
    log(`Migration warning: ${err.message}`, 'yellow');
    info('You may need to run migrations manually after fixing the issue');
  }

  // Success message
  log(`\n${colors.green}✓ Dev mode active for: ${manifest.name}${colors.reset}`, 'green');
  log(`\n${colors.cyan}App is now linked:${colors.reset}`);
  info(`${resolvedPath}`);
  info(`→ ${targetLinkPath}`);
  
  log(`\n${colors.cyan}Next steps:${colors.reset}`);
  info('1. Ensure the host is running: cd host && npm run dev');
  info(`2. Open the app: http://localhost:3000/apps/${appId}`);
  info('3. Edit files in your app directory - changes will hot-reload automatically');
  
  log(`\n${colors.yellow}Notes:${colors.reset}`);
  info('- The app is symlinked, so changes are reflected immediately');
  info('- API routes will hot-reload without restarting the host');
  info('- Run citadel-app migrate after changing DB schema');
  info(`- To unlink: citadel-app uninstall ${appId}`);
}

// INSTALL COMMAND
async function installCommand(source) {
  if (!source) {
    error('Usage: citadel-app install <git-url|local-path>');
  }

  log(`Installing from: ${source}`, 'blue');

  let tempDir = null;
  let appDir = null;

  try {
    if (isGitUrl(source)) {
      // Clone from git
      tempDir = path.join(DATA_DIR, 'temp', `install-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
      
      info('Cloning repository...');
      await gitClone(source, tempDir);
      appDir = tempDir;
    } else {
      // Local path
      const resolvedPath = path.resolve(source);
      try {
        await fs.access(resolvedPath);
      } catch {
        error(`Path does not exist: ${resolvedPath}`);
      }
      appDir = resolvedPath;
    }

    // Find app.yaml
    const manifestPath = path.join(appDir, 'app.yaml');
    try {
      await fs.access(manifestPath);
    } catch {
      error(`No app.yaml found in ${appDir}`);
    }

    // Read and validate manifest
    info('Reading manifest...');
    const manifest = await readManifest(manifestPath);
    const validation = validateManifest(manifest, manifestPath);
    
    if (!validation.valid) {
      error(`Invalid manifest:\n  - ${validation.errors.join('\n  - ')}`);
    }

    const appId = manifest.id;
    info(`App ID: ${appId}`);
    info(`Name: ${manifest.name}`);
    info(`Version: ${manifest.version}`);

    // Check for conflicts
    const installedApps = await getInstalledAppIds();
    if (installedApps.includes(appId)) {
      error(`App "${appId}" is already installed. Use 'citadel-app update ${appId}' to update.`);
    }

    // Copy to apps directory
    const targetDir = path.join(APPS_DIR, appId);
    info(`Installing to: ${targetDir}`);
    await fs.mkdir(targetDir, { recursive: true });

    // Copy all files from app directory
    const entries = await fs.readdir(appDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(appDir, entry.name);
      const destPath = path.join(targetDir, entry.name);

      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }

    // Clean up temp directory if used
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    // Run migrations
    info('Running migrations...');
    await runMigrations(appId);

    // Success
    success(`App "${manifest.name}" installed successfully!`);
    log(`\nApp URL: http://localhost:3000/apps/${appId}`, 'green');
    log(`\nNext steps:`, 'yellow');
    log(`  1. Start the host: cd host && npm run dev`, 'cyan');
    log(`  2. Open the app at: http://localhost:3000/apps/${appId}`, 'cyan');

  } catch (err) {
    // Clean up temp directory on error
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    throw err;
  }
}

// SEARCH COMMAND
async function searchCommand(query, options = {}) {
  log('Fetching registry...', 'blue');
  
  let registry;
  try {
    const response = await fetch(REGISTRY_URL);
    if (!response.ok) {
      throw new Error(`Registry returned ${response.status}: ${response.statusText}`);
    }
    registry = await response.json();
  } catch (err) {
    if (err.message.includes('fetch failed') || err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED')) {
      error(`Cannot reach registry. You appear to be offline.\nRegistry URL: ${REGISTRY_URL}`);
    } else {
      error(`Failed to fetch registry: ${err.message}`);
    }
  }

  if (!registry || !Array.isArray(registry.apps)) {
    error('Invalid registry format: expected { apps: [...] }');
  }

  let apps = registry.apps;

  // Filter by tag if specified
  if (options.tag) {
    const tag = options.tag.toLowerCase();
    apps = apps.filter(app => 
      app.tags && app.tags.some(t => t.toLowerCase() === tag)
    );
  }

  // Filter by query if specified
  if (query) {
    const q = query.toLowerCase();
    apps = apps.filter(app => 
      (app.name && app.name.toLowerCase().includes(q)) ||
      (app.description && app.description.toLowerCase().includes(q)) ||
      (app.tags && app.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  if (apps.length === 0) {
    log('No apps found matching your criteria.', 'yellow');
    return;
  }

  // Sort by name
  apps.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Display results
  log(`\n${colors.cyan}Found ${apps.length} app${apps.length === 1 ? '' : 's'}:${colors.reset}\n`);

  // Calculate column widths
  const nameWidth = Math.max(4, ...apps.map(a => (a.name || '').length));
  const versionWidth = Math.max(7, ...apps.map(a => (a.version || '').length));
  const authorWidth = Math.max(6, ...apps.map(a => (a.author || '').length));

  // Print header
  const header = `${colors.bold}${'Name'.padEnd(nameWidth)}  ${'Version'.padEnd(versionWidth)}  ${'Author'.padEnd(authorWidth)}  Description${colors.reset}`;
  log(header);
  log('-'.repeat(header.length - colors.bold.length - colors.reset.length));

  // Print each app
  for (const app of apps) {
    const name = (app.name || app.id || 'Unknown').padEnd(nameWidth);
    const version = (app.version || 'N/A').padEnd(versionWidth);
    const author = (app.author || 'Unknown').padEnd(authorWidth);
    const desc = (app.description || '').slice(0, 40) + ((app.description || '').length > 40 ? '...' : '');
    
    log(`${name}  ${version}  ${author}  ${desc}`);
  }

  // Print footer info
  log('');
  info(`Registry: ${REGISTRY_URL}`);
  info(`Total apps in registry: ${registry.apps.length}`);
  if (query || options.tag) {
    info(`Filters: ${query ? `query="${query}"` : ''} ${options.tag ? `tag="${options.tag}"` : ''}`);
  }
  log('');
  info('To install an app: citadel-app install <app-id>');
  info('To view details: citadel-app info <app-id>');
}

// MAIN
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const arg = args[1];

  // Parse flags
  const flags = {
    deleteData: args.includes('--delete-data'),
    force: args.includes('--force'),
    all: args.includes('--all'),
    steps: parseInt(args.find(a => a.startsWith('--steps='))?.split('=')[1] || '1', 10),
    template: args.find(a => a.startsWith('--template='))?.split('=')[1],
    listTemplates: args.includes('--list-templates'),
    tag: args.find(a => a.startsWith('--tag='))?.split('=')[1],
  };

  // Ensure apps directory exists
  await fs.mkdir(APPS_DIR, { recursive: true });
  await fs.mkdir(DATA_DIR, { recursive: true });

  switch (command) {
    case 'install':
      await installCommand(arg);
      break;
    case 'uninstall':
      await uninstallCommand(arg, flags);
      break;
    case 'update':
      await updateCommand(arg, flags);
      break;
    case 'migrate':
      await migrateCommand(arg, flags);
      break;
    case 'migrate:rollback':
      await migrateRollbackCommand(arg, flags);
      break;
    case 'create':
      await createCommand(arg, flags);
      break;
    case 'dev':
      await devCommand(arg, flags);
      break;
    case 'search':
      // For search, arg might be a flag like --tag=xyz, so handle it properly
      const searchArg = arg && !arg.startsWith('--') ? arg : null;
      await searchCommand(searchArg, flags);
      break;
    case 'help':
    case '--help':
    case '-h':
    default:
      console.log(`
${colors.cyan}Citadel App CLI${colors.reset}

Commands:
  install <git-url|local-path>  Install an app from git or local path
  uninstall <app-id>            Remove an installed app
  update <app-id>               Update an installed app (git pull)
  update --all                  Update all git-installed apps
  migrate <app-id>              Run migrations for an app
  migrate --all                 Run migrations for all apps
  migrate:rollback <app-id>     Rollback the last migration for an app
  migrate:rollback <app-id> --steps=N  Rollback N migrations
  create <app-id> [--template=<name>]  Create a new app from template (default: blank)
  create --list-templates       List available templates
  dev <path-to-app>             Start dev mode for local app development
  search [query]                Search for apps in the registry
  search --tag=<tag>            Filter apps by tag

Options:
  --delete-data                 Delete app data when uninstalling
  --force                       Skip confirmation prompts
  --all                         Update all apps (with update command)
  --steps=N                     Number of migrations to rollback
  --template=<name>             Template to use for create (blank, crud)
  --list-templates              List available templates
  --tag=<tag>                   Filter by tag (with search command)

Environment:
  CITADEL_APPS_DIR      Apps directory (default: ../apps)
  CITADEL_DATA_ROOT     Data directory (default: ../data)
  CITADEL_REGISTRY_URL  Registry URL (default: GitHub raw content)

Examples:
  citadel-app install https://github.com/user/my-citadel-app.git
  citadel-app install ./path/to/local-app
  citadel-app uninstall my-app
  citadel-app uninstall my-app --delete-data
  citadel-app update my-app
  citadel-app update --all
  citadel-app migrate my-app
  citadel-app migrate --all
  citadel-app migrate:rollback my-app
  citadel-app migrate:rollback my-app --steps=3
  citadel-app create my-app
  citadel-app create my-app --template=crud
  citadel-app create --list-templates
  citadel-app dev ./my-local-app
  citadel-app search                    List all apps
  citadel-app search notes              Search for "notes"
  citadel-app search --tag=productivity Filter by tag
      `);
  }
}

main().catch(err => {
  error(err.message);
});
