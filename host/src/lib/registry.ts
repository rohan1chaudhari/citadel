import fs from 'node:fs/promises';
import path from 'node:path';
import { repoRoot } from '@/lib/paths';
import { dbExec, dbQuery } from '@/lib/db';

export type PermissionScopes = {
  db?: { read?: boolean; write?: boolean };
  storage?: { read?: boolean; write?: boolean };
  ai?: boolean;
  network?: string[];
};

export type AppManifest = {
  id: string;
  name: string;
  version?: string;
  permissions?: PermissionScopes;
};

function parseYamlScalar(line: string): string | null {
  const idx = line.indexOf(':');
  if (idx === -1) return null;
  return line.slice(idx + 1).trim().replace(/^"|"$/g, '');
}

function parseYamlBoolean(line: string): boolean {
  const val = parseYamlScalar(line);
  return val === 'true' || val === 'yes';
}

function parseYamlArray(lines: string[], startIdx: number): { items: string[]; endIdx: number } {
  const items: string[] = [];
  let i = startIdx;
  
  // Find the base indentation level
  const baseIndent = lines[startIdx].search(/\S/);
  
  for (i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.search(/\S/);
    
    // Empty line or comment
    if (indent === -1 || line.trim().startsWith('#')) continue;
    
    // If indent is less than or equal to base indent, we've exited the array
    if (indent <= baseIndent) break;
    
    // Array item (starts with -)
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      items.push(trimmed.slice(2).trim().replace(/^"|"$/g, ''));
    }
  }
  
  return { items, endIdx: i - 1 };
}

function parsePermissions(lines: string[], startIdx: number): { permissions: PermissionScopes; endIdx: number } {
  const permissions: PermissionScopes = {};
  let i = startIdx;
  
  // Find the base indentation of 'permissions:'
  const baseIndent = lines[startIdx].search(/\S/);
  
  for (i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const indent = line.search(/\S/);
    
    // Empty line or comment
    if (indent === -1 || line.trim().startsWith('#')) continue;
    
    // If indent is less than or equal to base indent, we've exited the permissions block
    if (indent <= baseIndent) break;
    
    const trimmed = line.trim();
    
    // Parse db section
    if (trimmed.startsWith('db:')) {
      const dbIndent = indent;
      permissions.db = {};
      for (let j = i + 1; j < lines.length; j++) {
        const dbLine = lines[j];
        const dbLineIndent = dbLine.search(/\S/);
        if (dbLineIndent === -1 || dbLine.trim().startsWith('#')) continue;
        if (dbLineIndent <= dbIndent) break;
        
        if (dbLine.trim().startsWith('read:')) {
          permissions.db.read = parseYamlBoolean(dbLine.trim());
        }
        if (dbLine.trim().startsWith('write:')) {
          permissions.db.write = parseYamlBoolean(dbLine.trim());
        }
      }
    }
    
    // Parse storage section
    if (trimmed.startsWith('storage:')) {
      const storageIndent = indent;
      permissions.storage = {};
      for (let j = i + 1; j < lines.length; j++) {
        const storageLine = lines[j];
        const storageLineIndent = storageLine.search(/\S/);
        if (storageLineIndent === -1 || storageLine.trim().startsWith('#')) continue;
        if (storageLineIndent <= storageIndent) break;
        
        if (storageLine.trim().startsWith('read:')) {
          permissions.storage.read = parseYamlBoolean(storageLine.trim());
        }
        if (storageLine.trim().startsWith('write:')) {
          permissions.storage.write = parseYamlBoolean(storageLine.trim());
        }
      }
    }
    
    // Parse ai
    if (trimmed.startsWith('ai:')) {
      permissions.ai = parseYamlBoolean(trimmed);
    }
    
    // Parse network array
    if (trimmed.startsWith('network:')) {
      const networkResult = parseYamlArray(lines, i);
      permissions.network = networkResult.items;
      i = networkResult.endIdx;
    }
  }
  
  return { permissions, endIdx: i - 1 };
}

async function readManifest(manifestPath: string): Promise<AppManifest | null> {
  const raw = await fs.readFile(manifestPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  let id = '';
  let name = '';
  let version = '';
  let permissions: PermissionScopes | undefined;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (t.startsWith('id:')) id = parseYamlScalar(t) ?? id;
    if (t.startsWith('name:')) name = parseYamlScalar(t) ?? name;
    if (t.startsWith('version:')) version = parseYamlScalar(t) ?? version;
    if (t.startsWith('permissions:')) {
      const result = parsePermissions(lines, i);
      permissions = result.permissions;
      i = result.endIdx;
    }
  }
  
  if (!id || !name) return null;
  return { id, name, version: version || undefined, permissions };
}

export async function getAppManifest(appId: string): Promise<AppManifest | null> {
  const appsDir = path.join(repoRoot(), 'apps');
  const manifestPath = path.join(appsDir, appId, 'app.yaml');
  try {
    return await readManifest(manifestPath);
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
