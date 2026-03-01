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

// Run migrations for an app
async function runMigrations(appId) {
  const appDir = path.join(APPS_DIR, appId);
  const migrationsDir = path.join(appDir, 'migrations');
  const appDataDir = path.join(DATA_DIR, 'apps', appId);

  // Check if migrations directory exists
  try {
    await fs.access(migrationsDir);
  } catch {
    info('No migrations to run');
    return;
  }

  // Get list of migration files
  const files = await fs.readdir(migrationsDir);
  const migrationFiles = files
    .filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    info('No migrations to run');
    return;
  }

  // Ensure migrations table exists
  const citadelDbPath = path.join(DATA_DIR, 'citadel.sqlite');
  const { DatabaseSync } = await import('node:sqlite');
  
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

    // Apply pending migrations
    for (const file of migrationFiles) {
      if (applied.has(file)) {
        info(`Migration already applied: ${file}`);
        continue;
      }

      const migrationPath = path.join(migrationsDir, file);
      const sql = await fs.readFile(migrationPath, 'utf8');

      // Apply to app DB
      const appDbPath = path.join(appDataDir, 'db.sqlite');
      const appDb = new DatabaseSync(appDbPath);
      try {
        appDb.exec(sql);
        success(`Applied migration: ${file}`);
      } finally {
        appDb.close();
      }

      // Record in citadel migrations table
      const insertStmt = citadelDb.prepare(`
        INSERT INTO migrations (app_id, migration_name, applied_at) VALUES (?, ?, ?)
      `);
      insertStmt.run(appId, file, new Date().toISOString());
    }
  } finally {
    citadelDb.close();
  }
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

  // Ensure apps directory exists
  await fs.mkdir(APPS_DIR, { recursive: true });
  await fs.mkdir(DATA_DIR, { recursive: true });

  switch (command) {
    case 'install':
      await installCommand(arg);
      break;
    case 'uninstall':
      log('Uninstall command not yet implemented. Use: citadel-app uninstall <app-id>', 'yellow');
      break;
    case 'update':
      log('Update command not yet implemented. Use: citadel-app update <app-id>', 'yellow');
      break;
    case 'create':
      log('Create command not yet implemented. Use: citadel-app create <app-id>', 'yellow');
      break;
    case 'migrate':
      log('Migrate command not yet implemented. Use: citadel-app migrate <app-id>', 'yellow');
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
  update <app-id>               Update an installed app
  create <app-id>               Create a new app from template
  migrate <app-id>              Run migrations for an app

Environment:
  CITADEL_APPS_DIR    Apps directory (default: ../apps)
  CITADEL_DATA_ROOT   Data directory (default: ../data)

Examples:
  citadel-app install https://github.com/user/my-citadel-app.git
  citadel-app install ./path/to/local-app
      `);
  }
}

main().catch(err => {
  error(err.message);
});
