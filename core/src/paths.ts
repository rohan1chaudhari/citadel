import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

// Determine repo root by looking for package.json with workspaces (monorepo root)
function findRepoRoot(): string {
  // First check if CITADEL_REPO_ROOT is set
  if (process.env.CITADEL_REPO_ROOT) {
    return path.resolve(process.env.CITADEL_REPO_ROOT);
  }
  
  // Try to find repo root by looking for a specific marker
  // Start from current file location (core/src/paths.ts)
  let currentDir = path.dirname(fileURLToPath(import.meta.url));
  
  // Go up until we find the citadel root (has apps/ and host/ directories)
  for (let i = 0; i < 10; i++) {
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached filesystem root
    
    // Check if this looks like the citadel repo root
    try {
      const hasAppsDir = fs.existsSync(path.join(parentDir, 'apps'));
      const hasHostDir = fs.existsSync(path.join(parentDir, 'host'));
      if (hasAppsDir && hasHostDir) {
        return parentDir;
      }
    } catch {
      // Continue searching
    }
    currentDir = parentDir;
  }
  
  // Fallback: assume running from host/ directory (original behavior)
  return path.resolve(process.cwd(), '..');
}

const REPO_ROOT = findRepoRoot();

export function repoRoot() {
  return REPO_ROOT;
}

export function dataRoot() {
  return process.env.CITADEL_DATA_ROOT ? path.resolve(process.env.CITADEL_DATA_ROOT) : path.join(repoRoot(), 'data');
}

export function appDataRoot(appId: string) {
  return path.join(dataRoot(), 'apps', appId);
}

export function appDbPath(appId: string) {
  return path.join(appDataRoot(appId), 'db.sqlite');
}

/**
 * Get the configured apps directory path.
 * Uses CITADEL_APPS_DIR env var, or falls back to ../apps relative to repo root.
 */
export function appsDir() {
  if (process.env.CITADEL_APPS_DIR) {
    return path.resolve(process.env.CITADEL_APPS_DIR);
  }
  // Default: ../apps relative to repo root (monorepo structure)
  return path.join(repoRoot(), 'apps');
}
