import fs from 'node:fs/promises';
import path from 'node:path';
import { repoRoot } from '@/lib/paths';

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

export async function listApps(): Promise<AppManifest[]> {
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
  return manifests;
}
