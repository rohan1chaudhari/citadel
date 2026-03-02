import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import { appsDir, repoRoot } from './paths.js';
import { dbExec, dbQuery } from './db.js';
import type { PermissionScopes } from './permissions.js';
import type { AppManifest, AppManifestV0, ManifestValidationError, EntryConfig, HealthConfig, EndpointConfig } from './manifest-schema.js';

export type { PermissionScopes };
export type { AppManifest, AppManifestV0, EntryConfig, HealthConfig, EndpointConfig };

// Manifest schema validation
const REQUIRED_FIELDS = ['id', 'name', 'version', 'permissions'] as const;
const REQUIRED_FIELDS_V0 = ['id', 'name', 'version', 'entry', 'health', 'permissions'] as const;
const SUPPORTED_MANIFEST_VERSIONS = ['1.0', '0.1.0'] as const;

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
  
  // Determine manifest version
  const manifestVersion = (obj.manifest_version as string) ?? '1.0';
  const isV0 = manifestVersion === '0.1.0';

  // Check required fields based on version
  const requiredFields = isV0 ? REQUIRED_FIELDS_V0 : REQUIRED_FIELDS;
  for (const field of requiredFields) {
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

  if ('widget' in obj && obj.widget !== undefined && typeof obj.widget !== 'boolean') {
    errors.push({ field: 'widget', message: 'Field "widget" must be a boolean' });
  }

  if ('manifest_version' in obj && obj.manifest_version !== undefined && typeof obj.manifest_version !== 'string') {
    errors.push({ field: 'manifest_version', message: 'Field "manifest_version" must be a string' });
  }
  
  // Validate v0-specific fields
  if (isV0) {
    // Validate entry field
    if ('entry' in obj && obj.entry !== undefined) {
      if (typeof obj.entry !== 'object' || obj.entry === null) {
        errors.push({ field: 'entry', message: 'Field "entry" must be an object' });
      } else {
        const entry = obj.entry as Record<string, unknown>;
        if (typeof entry.type !== 'string') {
          errors.push({ field: 'entry.type', message: 'Entry type is required' });
        } else {
          const validTypes = ['nextjs', 'docker', 'binary', 'node', 'python', 'custom'];
          if (!validTypes.includes(entry.type)) {
            errors.push({ field: 'entry.type', message: `Invalid entry type: ${entry.type}` });
          }
          // Check type-specific required fields
          if (['binary', 'node', 'python', 'custom'].includes(entry.type) && !entry.command) {
            errors.push({ field: 'entry.command', message: `Entry type "${entry.type}" requires a "command" field` });
          }
          if (entry.type === 'docker' && !entry.image) {
            errors.push({ field: 'entry.image', message: 'Entry type "docker" requires an "image" field' });
          }
        }
      }
    }
    
    // Validate health field
    if ('health' in obj && obj.health !== undefined) {
      if (typeof obj.health !== 'object' || obj.health === null) {
        errors.push({ field: 'health', message: 'Field "health" must be an object' });
      } else {
        const health = obj.health as Record<string, unknown>;
        if (health.endpoint !== '/healthz') {
          errors.push({ field: 'health.endpoint', message: 'Health endpoint must be "/healthz"' });
        }
      }
    }
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
  const isV0 = obj.manifest_version === '0.1.0';

  // Additional validation: id and name must be non-empty
  if (!obj.id.trim()) {
    throw new Error(`Invalid manifest: ${manifestPath}\n  - id: Cannot be empty`);
  }
  if (!obj.name.trim()) {
    throw new Error(`Invalid manifest: ${manifestPath}\n  - name: Cannot be empty`);
  }

  // Base manifest fields
  const baseManifest = {
    id: obj.id,
    name: obj.name,
    description: obj.description,
    version: obj.version,
    manifest_version: obj.manifest_version ?? '1.0',
    permissions: obj.permissions,
    hidden: obj.hidden,
    author: obj.author,
    homepage: obj.homepage,
    icon: obj.icon,
    dependencies: obj.dependencies,
  };

  // For v0 manifests, include entry, health, and endpoints
  if (isV0) {
    const v0Obj = obj as AppManifestV0;
    return {
      ...baseManifest,
      entry: v0Obj.entry,
      health: v0Obj.health,
      endpoints: v0Obj.endpoints,
    } as AppManifestV0;
  }

  return baseManifest;
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
  const hiddenIds = new Set(getHiddenApps());
  const appsPath = appsDir();
  const entries = await fs.readdir(appsPath, { withFileTypes: true });
  const manifests: AppManifest[] = [];

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const manifestPath = path.join(appsPath, e.name, 'app.yaml');
    try {
      const m = await readManifest(manifestPath);
      if (!m) continue;
      // Hidden if either marked in manifest or hidden via user action in DB
      if (m.hidden || hiddenIds.has(m.id)) manifests.push(m);
    } catch {
      // ignore bad/missing manifests in hidden listing
    }
  }

  manifests.sort((a, b) => a.id.localeCompare(b.id));
  return manifests;
}

// ============================================================================
// App Contract v0 Helpers
// ============================================================================

/**
 * Check if a manifest follows the v0 contract (standalone/containerized app)
 * @param manifest - The manifest to check
 * @returns true if the manifest is a v0 contract
 */
export function isV0Manifest(manifest: AppManifest): manifest is AppManifestV0 {
  return manifest.manifest_version === '0.1.0' && 'entry' in manifest && 'health' in manifest;
}

/**
 * Get the entry configuration for a v0 manifest
 * @param manifest - The app manifest
 * @returns EntryConfig or null if not a v0 manifest
 */
export function getEntryConfig(manifest: AppManifest): EntryConfig | null {
  if (!isV0Manifest(manifest)) return null;
  return manifest.entry;
}

/**
 * Get the health configuration for a v0 manifest
 * @param manifest - The app manifest
 * @returns HealthConfig or null if not a v0 manifest
 */
export function getHealthConfig(manifest: AppManifest): HealthConfig | null {
  if (!isV0Manifest(manifest)) return null;
  return manifest.health;
}

/**
 * Get the optional endpoints configuration for a v0 manifest
 * @param manifest - The app manifest
 * @returns EndpointConfig or null if not a v0 manifest or no endpoints defined
 */
export function getEndpointConfig(manifest: AppManifest): EndpointConfig | null {
  if (!isV0Manifest(manifest)) return null;
  return manifest.endpoints ?? null;
}

/**
 * Check if a v0 app has a specific optional endpoint
 * @param manifest - The app manifest
 * @param endpoint - The endpoint to check (meta, events, agent/callback)
 * @returns true if the endpoint is defined
 */
export function hasEndpoint(
  manifest: AppManifest,
  endpoint: 'meta' | 'events' | 'agent/callback'
): boolean {
  if (!isV0Manifest(manifest) || !manifest.endpoints) return false;
  
  switch (endpoint) {
    case 'meta':
      return !!manifest.endpoints.meta;
    case 'events':
      return !!manifest.endpoints.events;
    case 'agent/callback':
      return !!manifest.endpoints.agent?.callback;
    default:
      return false;
  }
}
