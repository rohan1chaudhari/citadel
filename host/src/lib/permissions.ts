import { dbExec, dbQuery } from '@/lib/db';

const CITADEL_APP_ID = 'citadel';

export type PermissionScopes = {
  db?: { read?: boolean; write?: boolean };
  storage?: { read?: boolean; write?: boolean };
  ai?: boolean;
  network?: string[];
};

export type AppPermissions = {
  appId: string;
  scopes: PermissionScopes;
  grantedAt: string;
  updatedAt: string;
};

function ensurePermissionsTable() {
  dbExec(CITADEL_APP_ID, `
    CREATE TABLE IF NOT EXISTS app_permissions (
      app_id TEXT PRIMARY KEY,
      scopes TEXT NOT NULL,
      granted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

export function getAppPermissions(appId: string): AppPermissions | null {
  ensurePermissionsTable();
  const row = dbQuery<{ app_id: string; scopes: string; granted_at: string; updated_at: string }>(
    CITADEL_APP_ID,
    'SELECT app_id, scopes, granted_at, updated_at FROM app_permissions WHERE app_id = ? LIMIT 1',
    [appId]
  )[0];
  
  if (!row) return null;
  
  try {
    return {
      appId: row.app_id,
      scopes: JSON.parse(row.scopes),
      grantedAt: row.granted_at,
      updatedAt: row.updated_at,
    };
  } catch {
    return null;
  }
}

export function getAllAppPermissions(): AppPermissions[] {
  ensurePermissionsTable();
  const rows = dbQuery<{ app_id: string; scopes: string; granted_at: string; updated_at: string }>(
    CITADEL_APP_ID,
    'SELECT app_id, scopes, granted_at, updated_at FROM app_permissions ORDER BY app_id'
  );
  
  return rows
    .map((row) => {
      try {
        return {
          appId: row.app_id,
          scopes: JSON.parse(row.scopes),
          grantedAt: row.granted_at,
          updatedAt: row.updated_at,
        };
      } catch {
        return null;
      }
    })
    .filter((p): p is AppPermissions => p !== null);
}

export function setAppPermissions(appId: string, scopes: PermissionScopes): void {
  ensurePermissionsTable();
  const now = new Date().toISOString();
  const scopesJson = JSON.stringify(scopes);
  
  dbExec(
    CITADEL_APP_ID,
    `INSERT INTO app_permissions (app_id, scopes, granted_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(app_id) DO UPDATE SET
       scopes = excluded.scopes,
       updated_at = excluded.updated_at`,
    [appId, scopesJson, now, now]
  );
}

export function revokeAppPermissions(appId: string): void {
  ensurePermissionsTable();
  dbExec(CITADEL_APP_ID, 'DELETE FROM app_permissions WHERE app_id = ?', [appId]);
}

export function hasDbPermission(appId: string, operation: 'read' | 'write'): boolean {
  const perms = getAppPermissions(appId);
  if (!perms) return false;
  return perms.scopes.db?.[operation] === true;
}

export function hasStoragePermission(appId: string, operation: 'read' | 'write'): boolean {
  const perms = getAppPermissions(appId);
  if (!perms) return false;
  return perms.scopes.storage?.[operation] === true;
}

export function hasAiPermission(appId: string): boolean {
  const perms = getAppPermissions(appId);
  if (!perms) return false;
  return perms.scopes.ai === true;
}

export function hasNetworkPermission(appId: string, domain: string): boolean {
  const perms = getAppPermissions(appId);
  if (!perms) return false;
  const allowed = perms.scopes.network;
  if (!allowed || !Array.isArray(allowed)) return false;
  // Support wildcards like *.example.com
  return allowed.some((pattern) => {
    if (pattern === domain) return true;
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1);
      return domain.endsWith(suffix);
    }
    return false;
  });
}

export function needsPermissionConsent(appId: string, requested: PermissionScopes): boolean {
  const granted = getAppPermissions(appId);
  if (!granted) return true;
  
  // Check if any requested permission is not granted
  if (requested.db?.read && !granted.scopes.db?.read) return true;
  if (requested.db?.write && !granted.scopes.db?.write) return true;
  if (requested.storage?.read && !granted.scopes.storage?.read) return true;
  if (requested.storage?.write && !granted.scopes.storage?.write) return true;
  if (requested.ai && !granted.scopes.ai) return true;
  
  // For network, check if all requested domains are allowed
  if (requested.network && requested.network.length > 0) {
    for (const domain of requested.network) {
      if (!hasNetworkPermission(appId, domain)) return true;
    }
  }
  
  return false;
}
