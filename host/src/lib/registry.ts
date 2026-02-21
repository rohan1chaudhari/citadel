import fs from 'node:fs/promises';
import path from 'node:path';
import { repoRoot } from '@/lib/paths';
import { dbExec, dbQuery } from '@/lib/db';

export type AppManifest = {
  id: string;
  name: string;
  version?: string;
};

function parseYamlScalar(line: string): string | null {
  const idx = line.indexOf(':');
  if (idx === -1) return null;
  return line.slice(idx + 1).trim().replace(/^"|"$/g, '');
}

async function readManifest(manifestPath: string): Promise<AppManifest | null> {
  const raw = await fs.readFile(manifestPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  let id = '';
  let name = '';
  let version = '';
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('id:')) id = parseYamlScalar(t) ?? id;
    if (t.startsWith('name:')) name = parseYamlScalar(t) ?? name;
    if (t.startsWith('version:')) version = parseYamlScalar(t) ?? version;
  }
  if (!id || !name) return null;
  return { id, name, version: version || undefined };
}

export async function listApps(includeHidden = false): Promise<AppManifest[]> {
  const appsDir = path.join(repoRoot(), 'apps');
  const entries = await fs.readdir(appsDir, { withFileTypes: true });
  const manifests: AppManifest[] = [];

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const manifestPath = path.join(appsDir, e.name, 'app.yaml');
    try {
      const m = await readManifest(manifestPath);
      if (m) manifests.push(m);
    } catch {
      // ignore
    }
  }

  manifests.sort((a, b) => a.id.localeCompare(b.id));

  if (!includeHidden) {
    const hiddenApps = await getHiddenApps();
    const hiddenSet = new Set(hiddenApps);
    return manifests.filter((m) => !hiddenSet.has(m.id));
  }

  return manifests;
}

const CITADEL_APP_ID = 'citadel';

function ensureHiddenTable() {
  dbExec(CITADEL_APP_ID, `
    CREATE TABLE IF NOT EXISTS hidden_apps (
      app_id TEXT PRIMARY KEY,
      hidden_at TEXT NOT NULL
    )
  `);
}

export function getHiddenApps(): string[] {
  try {
    ensureHiddenTable();
    const rows = dbQuery<{ app_id: string }>(
      CITADEL_APP_ID,
      'SELECT app_id FROM hidden_apps ORDER BY hidden_at DESC'
    );
    return rows.map((r) => r.app_id);
  } catch {
    return [];
  }
}

export async function listHiddenApps(): Promise<AppManifest[]> {
  const hiddenIds = getHiddenApps();
  if (hiddenIds.length === 0) return [];

  const appsDir = path.join(repoRoot(), 'apps');
  const manifests: AppManifest[] = [];

  for (const id of hiddenIds) {
    const manifestPath = path.join(appsDir, id, 'app.yaml');
    try {
      const m = await readManifest(manifestPath);
      if (m) manifests.push(m);
    } catch {
      // ignore
    }
  }

  return manifests;
}
