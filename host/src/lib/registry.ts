import fs from 'node:fs/promises';
import path from 'node:path';
import { repoRoot } from '@/lib/paths';
import { dbExec, dbQuery } from '@/lib/db';
import { validateCitadelAppContract, type AppPermission } from '@/lib/citadelAppContract';

export type AppManifest = {
  id: string;
  name: string;
  version?: string;
  entry?: string;
  health?: string;
  permissions?: AppPermission[];
  source: 'citadel.app.json' | 'app.yaml';
};

function parseYamlScalar(line: string): string | null {
  const idx = line.indexOf(':');
  if (idx === -1) return null;
  return line.slice(idx + 1).trim().replace(/^"|"$/g, '');
}

async function readYamlManifest(manifestPath: string): Promise<AppManifest | null> {
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
  return { id, name, version: version || undefined, source: 'app.yaml' };
}

async function readJsonManifest(manifestPath: string): Promise<AppManifest | null> {
  const raw = await fs.readFile(manifestPath, 'utf8');
  const parsed = JSON.parse(raw);
  const validated = validateCitadelAppContract(parsed);
  if (!validated.ok) return null;
  const m = validated.value;
  return {
    id: m.id,
    name: m.name,
    version: m.version,
    entry: m.entry,
    health: m.health,
    permissions: m.permissions,
    source: 'citadel.app.json'
  };
}

async function readManifest(appDir: string): Promise<AppManifest | null> {
  const jsonPath = path.join(appDir, 'citadel.app.json');
  try {
    const m = await readJsonManifest(jsonPath);
    if (m) return m;
  } catch {
    // fall back to legacy yaml format
  }

  const yamlPath = path.join(appDir, 'app.yaml');
  try {
    return await readYamlManifest(yamlPath);
  } catch {
    return null;
  }
}

export async function listApps(includeHidden = false): Promise<AppManifest[]> {
  const appsDir = path.join(repoRoot(), 'apps');
  const entries = await fs.readdir(appsDir, { withFileTypes: true });
  const manifests: AppManifest[] = [];

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const m = await readManifest(path.join(appsDir, e.name));
    if (m) manifests.push(m);
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
    const m = await readManifest(path.join(appsDir, id));
    if (m) manifests.push(m);
  }

  return manifests;
}
