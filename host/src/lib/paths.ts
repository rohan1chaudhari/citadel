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
