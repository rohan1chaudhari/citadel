import fs from 'node:fs/promises';
import path from 'node:path';
import { repoRoot } from '@/lib/paths';
import { dbExec, dbQuery } from '@/lib/db';
import { validateCitadelAppContract, type AppPermission, type CitadelAppContractV0 } from '@/lib/citadelAppContract';

export type AppManifest = {
  id: string;
  name: string;
  version?: string;
  entry?: string;
  health?: string;
  permissions?: AppPermission[];
  source: 'citadel.app.json' | 'app.yaml' | 'registry';
  upstream_base_url?: string;
  enabled?: boolean;
};

export type RegisterAppInput = {
  manifest: CitadelAppContractV0;
  upstreamBaseUrl: string;
  enabled?: boolean;
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
  const manifests: AppManifest[] = [];

  const appsDir = path.join(repoRoot(), 'apps');
  try {
    const entries = await fs.readdir(appsDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const m = await readManifest(path.join(appsDir, e.name));
      if (m) manifests.push(m);
    }
  } catch {
    // ignore missing apps dir
  }

  const byId = new Map<string, AppManifest>();
  for (const m of manifests) byId.set(m.id, m);

  // Registry-installed apps override file-discovered metadata for matching IDs.
  for (const m of listRegisteredApps()) byId.set(m.id, m);

  const merged = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));

  if (!includeHidden) {
    const hiddenApps = await getHiddenApps();
    const hiddenSet = new Set(hiddenApps);
    return merged.filter((m) => !hiddenSet.has(m.id));
  }

  return merged;
}

const CITADEL_APP_ID = 'citadel';

function assertHttpBaseUrl(v: string): string {
  const value = String(v ?? '').trim();
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new Error('upstreamBaseUrl must be a valid absolute URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('upstreamBaseUrl must use http or https');
  }
  // normalize trailing slash away for stable proxy joins later
  return value.replace(/\/$/, '');
}

function ensureHiddenTable() {
  dbExec(CITADEL_APP_ID, `
    CREATE TABLE IF NOT EXISTS hidden_apps (
      app_id TEXT PRIMARY KEY,
      hidden_at TEXT NOT NULL
    )
  `);
}

function ensureInstalledAppsTable() {
  dbExec(CITADEL_APP_ID, `
    CREATE TABLE IF NOT EXISTS installed_apps (
      app_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      entry_path TEXT NOT NULL,
      health_path TEXT NOT NULL,
      permissions_json TEXT NOT NULL,
      events_path TEXT,
      meta_path TEXT,
      agent_callback_path TEXT,
      upstream_base_url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      installed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

export function listRegisteredApps(): AppManifest[] {
  ensureInstalledAppsTable();
  const rows = dbQuery<{
    app_id: string;
    name: string;
    version: string;
    entry_path: string;
    health_path: string;
    permissions_json: string;
    upstream_base_url: string;
    enabled: number;
  }>(
    CITADEL_APP_ID,
    `SELECT app_id, name, version, entry_path, health_path, permissions_json, upstream_base_url, enabled
     FROM installed_apps
     ORDER BY app_id ASC`
  );

  return rows.map((r) => {
    let permissions: AppPermission[] = [];
    try {
      const parsed = JSON.parse(r.permissions_json);
      if (Array.isArray(parsed)) permissions = parsed as AppPermission[];
    } catch {
      // ignore malformed legacy rows
    }
    return {
      id: r.app_id,
      name: r.name,
      version: r.version,
      entry: r.entry_path,
      health: r.health_path,
      permissions,
      source: 'registry' as const,
      upstream_base_url: r.upstream_base_url,
      enabled: Boolean(r.enabled)
    };
  });
}

export function registerApp(input: RegisterAppInput) {
  ensureInstalledAppsTable();

  const upstreamBaseUrl = assertHttpBaseUrl(input.upstreamBaseUrl);
  const now = new Date().toISOString();
  const m = input.manifest;
  const enabled = input.enabled === false ? 0 : 1;

  dbExec(
    CITADEL_APP_ID,
    `INSERT INTO installed_apps (
      app_id, name, version, entry_path, health_path, permissions_json,
      events_path, meta_path, agent_callback_path, upstream_base_url,
      enabled, installed_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(app_id) DO UPDATE SET
      name = excluded.name,
      version = excluded.version,
      entry_path = excluded.entry_path,
      health_path = excluded.health_path,
      permissions_json = excluded.permissions_json,
      events_path = excluded.events_path,
      meta_path = excluded.meta_path,
      agent_callback_path = excluded.agent_callback_path,
      upstream_base_url = excluded.upstream_base_url,
      enabled = excluded.enabled,
      updated_at = excluded.updated_at`,
    [
      m.id,
      m.name,
      m.version,
      m.entry,
      m.health,
      JSON.stringify(m.permissions),
      m.events ?? null,
      m.meta ?? null,
      m.agentCallback ?? null,
      upstreamBaseUrl,
      enabled,
      now,
      now
    ]
  );

  return { appId: m.id, upstreamBaseUrl, enabled: Boolean(enabled) };
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
