import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import { appsDir, repoRoot } from './paths.js';
import { dbExec, dbQuery } from './db.js';
import type { PermissionScopes } from './permissions.js';
import type { AppManifest, ManifestValidationError } from './manifest-schema.js';

export type { PermissionScopes };
export type { AppManifest };

// Manifest schema validation
const REQUIRED_FIELDS = ['id', 'name', 'version', 'permissions'] as const;
const SUPPORTED_MANIFEST_VERSIONS = ['1.0'] as const;

function validateManifestVersion(version: unknown, filePath: string): { valid: true } | { valid: false; error: string } {
  // Default to "1.0" if not specified (backward compatibility)
  const manifestVersion = version ?? '1.0';
  
  if (typeof manifestVersion !== 'string') {
    return { 
      valid: false, 
      error: `Invalid manifest_version: must be a string, got ${typeof manifestVersion}` 
    };
  }
  
  if (!SUPPORTED_MANIFEST_VERSIONS.includes(manifestVersion as typeof SUPPORTED_MANIFEST_VERSIONS[number])) {
    return { 
      valid: false, 
      error: `Unsupported manifest_version: "${manifestVersion}". Supported versions: ${SUPPORTED_MANIFEST_VERSIONS.join(', ')}` 
    };
  }
  
  return { valid: true };
}

type ValidationError = ManifestValidationError;

function validateManifest(manifest: unknown, filePath: string): { valid: true } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (manifest === null || typeof manifest !== 'object') {
    return { valid: false, errors: [{ field: 'root', message: 'Manifest must be an object' }] };
  }

  const obj = manifest as Record<string, unknown>;

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
      errors.push({ field, message: `Missing required field: ${field}` });
    }
  }

  // Validate field types
  if ('id' in obj && obj.id !== undefined && typeof obj.id !== 'string') {
    errors.push({ field: 'id', message: 'Field "id" must be a string' });
  }

  if ('name' in obj && obj.name !== undefined && typeof obj.name !== 'string') {
    errors.push({ field: 'name', message: 'Field "name" must be a string' });
  }

  if ('version' in obj && obj.version !== undefined && typeof obj.version !== 'string') {
    errors.push({ field: 'version', message: 'Field "version" must be a string' });
  }

  // Validate manifest_version
  const versionCheck = validateManifestVersion(obj.manifest_version, filePath);
  if (!versionCheck.valid) {
    errors.push({ field: 'manifest_version', message: versionCheck.error });
  }

  if ('permissions' in obj && obj.permissions !== undefined) {
    if (typeof obj.permissions !== 'object' || obj.permissions === null) {
      errors.push({ field: 'permissions', message: 'Field "permissions" must be an object' });
    }
  }

  if ('hidden' in obj && obj.hidden !== undefined && typeof obj.hidden !== 'boolean') {
    errors.push({ field: 'hidden', message: 'Field "hidden" must be a boolean' });
  }

  if ('manifest_version' in obj && obj.manifest_version !== undefined && typeof obj.manifest_version !== 'string') {
    errors.push({ field: 'manifest_version', message: 'Field "manifest_version" must be a string' });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

function formatValidationErrors(filePath: string, errors: ValidationError[]): string {
  const lines = [`Invalid manifest: ${filePath}`, ''];
  for (const err of errors) {
    lines.push(`  - ${err.field}: ${err.message}`);
  }
  return lines.join('\n');
}

async function readManifest(manifestPath: string): Promise<AppManifest | null> {
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read manifest: ${manifestPath}\n  ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = yaml.parse(raw, {
      prettyErrors: true,
      strict: false, // Allow some flexibility in YAML syntax
    });
  } catch (err) {
    const yamlErr = err as Error & { line?: number; col?: number };
    const location = yamlErr.line !== undefined ? ` (line ${yamlErr.line}${yamlErr.col !== undefined ? `, col ${yamlErr.col}` : ''})` : '';
    throw new Error(`YAML parse error in ${manifestPath}${location}:\n  ${yamlErr.message}`);
  }

  const validation = validateManifest(parsed, manifestPath);
  if (!validation.valid) {
    throw new Error(formatValidationErrors(manifestPath, validation.errors));
  }

  const obj = parsed as AppManifest;

  // Additional validation: id and name must be non-empty
  if (!obj.id.trim()) {
    throw new Error(`Invalid manifest: ${manifestPath}\n  - id: Cannot be empty`);
  }
  if (!obj.name.trim()) {
    throw new Error(`Invalid manifest: ${manifestPath}\n  - name: Cannot be empty`);
  }

  return {
    id: obj.id,
    name: obj.name,
    description: obj.description,
    version: obj.version,
    manifest_version: obj.manifest_version ?? '1.0',
    permissions: obj.permissions,
    hidden: obj.hidden,
  };
}

export async function getAppManifest(appId: string): Promise<AppManifest | null> {
  const appsPath = appsDir();
  const manifestPath = path.join(appsPath, appId, 'app.yaml');
  try {
    return await readManifest(manifestPath);
  } catch (err) {
    // Return null for missing files, but re-throw parse errors
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

export async function listApps(includeHidden = false): Promise<AppManifest[]> {
  const appsPath = appsDir();
  const entries = await fs.readdir(appsPath, { withFileTypes: true });
  const manifests: AppManifest[] = [];
  const errors: string[] = [];

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const manifestPath = path.join(appsPath, e.name, 'app.yaml');
    try {
      const m = await readManifest(manifestPath);
      if (m) manifests.push(m);
    } catch (err) {
      // Collect errors but continue processing other apps
      errors.push((err as Error).message);
    }
  }

  // Throw aggregated errors if any manifests failed
  if (errors.length > 0) {
    throw new Error(`Failed to load some app manifests:\n\n${errors.join('\n\n')}`);
  }

  manifests.sort((a, b) => a.id.localeCompare(b.id));

  if (!includeHidden) {
    const hiddenApps = await getHiddenApps();
    const hiddenSet = new Set(hiddenApps);
    return manifests.filter((m) => !hiddenSet.has(m.id) && !m.hidden);
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

  const appsPath = appsDir();
  const manifests: AppManifest[] = [];

  for (const id of hiddenIds) {
    const manifestPath = path.join(appsPath, id, 'app.yaml');
    try {
      const m = await readManifest(manifestPath);
      if (m) manifests.push(m);
    } catch {
      // ignore
    }
  }

  return manifests;
}
