import path from 'node:path';

export function repoRoot() {
  return path.resolve(process.cwd(), '..');
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
