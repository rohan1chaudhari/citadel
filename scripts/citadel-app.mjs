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

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
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

// CREATE COMMAND
async function createCommand(appId) {
  if (!appId) {
    error('Usage: citadel-app create <app-id>');
  }

  const idCheck = validateAppId(appId);
  if (!idCheck.valid) {
    error(idCheck.error);
  }

  const targetDir = path.join(APPS_DIR, appId);
  try {
    await fs.access(targetDir);
    error(`App directory already exists: ${targetDir}`);
  } catch {
    // expected: does not exist
  }

  log(`Creating app scaffold: ${appId}`, 'blue');
  await fs.mkdir(path.join(targetDir, 'migrations'), { recursive: true });
  await fs.mkdir(path.join(targetDir, 'api'), { recursive: true });

  const title = appId
    .split('-')
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ');

  const appYaml = `id: ${appId}\nname: ${title}\nversion: 0.1.0\nmanifest_version: "1.0"\npermissions:\n  db:\n    read: true\n    write: true\n  storage:\n    read: false\n    write: false\nconnectors: []\n`;

  const migrationSql = `CREATE TABLE IF NOT EXISTS entries (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  title TEXT NOT NULL,\n  created_at TEXT NOT NULL\n);\n`;

  const pageTsx = `import { Shell, Card } from '@/components/Shell';\n\nexport const runtime = 'nodejs';\n\nexport default function ${title.replace(/[^A-Za-z0-9]/g, '') || 'NewApp'}Page() {\n  return (\n    <Shell title=\"${title}\" subtitle=\"Generated by citadel-app create\">\n      <Card>\n        <p>Welcome to ${title}.</p>\n      </Card>\n    </Shell>\n  );\n}\n`;

  const apiRoute = `import { NextResponse } from 'next/server';\n\nexport const runtime = 'nodejs';\n\nexport async function GET() {\n  return NextResponse.json({ ok: true, appId: '${appId}' });\n}\n`;

  const readme = `# ${title}\n\nGenerated with:\n\n\`\`\`bash\ncitadel-app create ${appId}\n\`\`\`\n\n## Files\n- \`app.yaml\` manifest\n- \`migrations/001_initial.sql\` initial DB schema\n- \`page.tsx\` host page scaffold\n- \`api/route.ts\` sample API route\n`;

  await fs.writeFile(path.join(targetDir, 'app.yaml'), appYaml, 'utf8');
  await fs.writeFile(path.join(targetDir, 'migrations', '001_initial.sql'), migrationSql, 'utf8');
  await fs.writeFile(path.join(targetDir, 'page.tsx'), pageTsx, 'utf8');
  await fs.writeFile(path.join(targetDir, 'api', 'route.ts'), apiRoute, 'utf8');
  await fs.writeFile(path.join(targetDir, 'README.md'), readme, 'utf8');

  success(`Created app scaffold at ${targetDir}`);
  info('Next steps:');
  info(`1) Review ${path.join(targetDir, 'app.yaml')}`);
  info(`2) Start host and open /apps/${appId}`);
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
    case 'create':
      await createCommand(arg);
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
  create <app-id>               Create a new app from template

Options:
  --delete-data                 Delete app data when uninstalling
  --force                       Skip confirmation prompts
  --all                         Update all apps (with update command)

Environment:
  CITADEL_APPS_DIR    Apps directory (default: ../apps)
  CITADEL_DATA_ROOT   Data directory (default: ../data)

Examples:
  citadel-app install https://github.com/user/my-citadel-app.git
  citadel-app install ./path/to/local-app
  citadel-app uninstall my-app
  citadel-app uninstall my-app --delete-data
  citadel-app update my-app
  citadel-app update --all
  citadel-app migrate my-app
  citadel-app migrate --all
      `);
  }
}

main().catch(err => {
  error(err.message);
});
