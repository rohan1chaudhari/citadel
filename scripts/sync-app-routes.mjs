#!/usr/bin/env node
/**
 * Citadel App Route Sync
 * 
 * Syncs app routes from apps/<appId>/ to host/src/app/apps/<appId>/
 * Uses symlinks so changes are reflected immediately in dev mode.
 * 
 * Usage:
 *   node scripts/sync-app-routes.mjs           # Sync all apps
 *   node scripts/sync-app-routes.mjs <app-id>  # Sync specific app
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const REPO_ROOT = path.resolve(__dirname, '..');
const APPS_DIR = path.join(REPO_ROOT, 'apps');
const HOST_APPS_DIR = path.join(REPO_ROOT, 'host', 'src', 'app', 'apps');
const HOST_API_DIR = path.join(REPO_ROOT, 'host', 'src', 'app', 'api', 'apps');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
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

function warn(msg) {
  log(`⚠ ${msg}`, 'yellow');
}

// Check if a directory exists
async function dirExists(dirPath) {
  try {
    const stat = await fs.lstat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

// Check if a path is a symlink
async function isSymlink(symlinkPath) {
  try {
    const stat = await fs.lstat(symlinkPath);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

// Remove a file or directory (handles symlinks correctly)
async function removePath(targetPath) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
  } catch {
    // Ignore errors
  }
}

// Sync a single app's UI routes
async function syncAppUiRoutes(appId) {
  const appDir = path.join(APPS_DIR, appId);
  const appPagePath = path.join(appDir, 'page.tsx');
  const hostAppDir = path.join(HOST_APPS_DIR, appId);

  // Check if app has its own page.tsx
  try {
    await fs.access(appPagePath);
  } catch {
    // No page.tsx in app directory - skip (will use catch-all route)
    return { synced: false, reason: 'no page.tsx' };
  }

  // Check if host directory exists and is not a symlink
  const hostExists = await dirExists(hostAppDir);
  const hostIsSymlink = await isSymlink(hostAppDir);

  if (hostExists && !hostIsSymlink) {
    // Host has a hardcoded directory - warn but don't replace
    return { synced: false, reason: 'hardcoded host directory exists' };
  }

  // Remove existing symlink if it points elsewhere
  if (hostIsSymlink) {
    const existingTarget = await fs.readlink(hostAppDir);
    if (existingTarget !== appDir) {
      await removePath(hostAppDir);
    } else {
      // Already correctly symlinked
      return { synced: true, reason: 'already synced' };
    }
  }

  // Create the symlink
  try {
    await fs.symlink(appDir, hostAppDir, 'dir');
    return { synced: true, reason: 'symlink created' };
  } catch (err) {
    return { synced: false, reason: `symlink failed: ${err.message}` };
  }
}

// Sync a single app's API routes
async function syncAppApiRoutes(appId) {
  const appDir = path.join(APPS_DIR, appId);
  const appApiDir = path.join(appDir, 'api');
  const hostApiDir = path.join(HOST_API_DIR, appId);

  // Check if app has its own api/ directory
  try {
    const apiStat = await fs.stat(appApiDir);
    if (!apiStat.isDirectory()) {
      return { synced: false, reason: 'api is not a directory' };
    }
  } catch {
    // No api/ in app directory - skip
    return { synced: false, reason: 'no api directory' };
  }

  // Check if host directory exists and is not a symlink
  const hostExists = await dirExists(hostApiDir);
  const hostIsSymlink = await isSymlink(hostApiDir);

  if (hostExists && !hostIsSymlink) {
    // Host has hardcoded API routes - warn but don't replace
    return { synced: false, reason: 'hardcoded host API directory exists' };
  }

  // Remove existing symlink if it points elsewhere
  if (hostIsSymlink) {
    const existingTarget = await fs.readlink(hostApiDir);
    if (existingTarget !== appApiDir) {
      await removePath(hostApiDir);
    } else {
      // Already correctly symlinked
      return { synced: true, reason: 'already synced' };
    }
  }

  // Create the symlink
  try {
    await fs.symlink(appApiDir, hostApiDir, 'dir');
    return { synced: true, reason: 'symlink created' };
  } catch (err) {
    return { synced: false, reason: `symlink failed: ${err.message}` };
  }
}

// Sync a single app
async function syncApp(appId) {
  const appDir = path.join(APPS_DIR, appId);
  
  // Verify app exists
  try {
    const appStat = await fs.stat(appDir);
    if (!appStat.isDirectory()) {
      return { appId, error: 'not a directory' };
    }
  } catch {
    return { appId, error: 'directory not found' };
  }

  // Check for app.yaml
  const manifestPath = path.join(appDir, 'app.yaml');
  try {
    await fs.access(manifestPath);
  } catch {
    return { appId, error: 'no app.yaml found' };
  }

  // Sync UI routes
  const uiResult = await syncAppUiRoutes(appId);
  
  // Sync API routes
  const apiResult = await syncAppApiRoutes(appId);

  return { appId, ui: uiResult, api: apiResult };
}

// Get all installed app IDs
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
    return ids.sort();
  } catch {
    return [];
  }
}

// Main sync function
async function syncAllApps() {
  log('Syncing app routes...', 'blue');
  
  // Ensure host directories exist
  await fs.mkdir(HOST_APPS_DIR, { recursive: true });
  await fs.mkdir(HOST_API_DIR, { recursive: true });

  const appIds = await getInstalledAppIds();
  
  if (appIds.length === 0) {
    warn('No apps found to sync');
    return;
  }

  info(`Found ${appIds.length} app(s)`);
  log('');

  const results = [];
  let syncedCount = 0;
  let skippedCount = 0;

  for (const appId of appIds) {
    const result = await syncApp(appId);
    results.push(result);

    if (result.error) {
      log(`  ${appId}: ${colors.red}error - ${result.error}${colors.reset}`);
      skippedCount++;
      continue;
    }

    const uiStatus = result.ui?.synced 
      ? `${colors.green}✓${colors.reset}` 
      : `${colors.dim}-${colors.reset}`;
    const apiStatus = result.api?.synced 
      ? `${colors.green}✓${colors.reset}` 
      : `${colors.dim}-${colors.reset}`;
    
    const hasRoutes = result.ui?.synced || result.api?.synced;
    if (hasRoutes) {
      syncedCount++;
      log(`  ${appId}: UI ${uiStatus} API ${apiStatus}`, 'cyan');
    } else {
      skippedCount++;
    }
  }

  log('');
  success(`Synced ${syncedCount} app(s) with routes`);
  if (skippedCount > 0) {
    info(`${skippedCount} app(s) without external routes (using built-in or catch-all)`);
  }
}

// Sync a specific app
async function syncSingleApp(appId) {
  log(`Syncing routes for: ${appId}`, 'blue');
  
  // Ensure host directories exist
  await fs.mkdir(HOST_APPS_DIR, { recursive: true });
  await fs.mkdir(HOST_API_DIR, { recursive: true });

  const result = await syncApp(appId);

  if (result.error) {
    error(result.error);
  }

  if (result.ui?.synced) {
    success(`UI routes: ${result.ui.reason}`);
  } else if (result.ui) {
    info(`UI routes: ${result.ui.reason}`);
  }

  if (result.api?.synced) {
    success(`API routes: ${result.api.reason}`);
  } else if (result.api) {
    info(`API routes: ${result.api.reason}`);
  }

  if (!result.ui?.synced && !result.api?.synced) {
    warn('No external routes to sync (using catch-all or built-in routes)');
  }
}

// Clean up stale symlinks (pointing to non-existent apps)
async function cleanupStaleSymlinks() {
  log('Cleaning up stale symlinks...', 'blue');
  
  let cleaned = 0;

  // Check UI symlinks
  try {
    const entries = await fs.readdir(HOST_APPS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isSymbolicLink()) continue;
      
      const symlinkPath = path.join(HOST_APPS_DIR, entry.name);
      const target = await fs.readlink(symlinkPath);
      
      // Check if target exists
      try {
        await fs.access(target);
      } catch {
        // Target doesn't exist - remove stale symlink
        await removePath(symlinkPath);
        info(`Removed stale UI symlink: ${entry.name}`);
        cleaned++;
      }
    }
  } catch {
    // Directory might not exist
  }

  // Check API symlinks
  try {
    const entries = await fs.readdir(HOST_API_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isSymbolicLink()) continue;
      
      const symlinkPath = path.join(HOST_API_DIR, entry.name);
      const target = await fs.readlink(symlinkPath);
      
      // Check if target exists
      try {
        await fs.access(target);
      } catch {
        // Target doesn't exist - remove stale symlink
        await removePath(symlinkPath);
        info(`Removed stale API symlink: ${entry.name}`);
        cleaned++;
      }
    }
  } catch {
    // Directory might not exist
  }

  if (cleaned === 0) {
    info('No stale symlinks found');
  } else {
    success(`Cleaned up ${cleaned} stale symlink(s)`);
  }
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  const appId = args[0];
  const shouldCleanup = args.includes('--cleanup');

  if (shouldCleanup) {
    await cleanupStaleSymlinks();
    log('');
  }

  if (appId && !appId.startsWith('--')) {
    await syncSingleApp(appId);
  } else {
    await syncAllApps();
  }
}

main().catch((err) => {
  error(err.message);
  process.exit(1);
});
