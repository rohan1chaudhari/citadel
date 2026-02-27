import { dbExec, dbQuery } from '@/lib/db';
import type { AppPermission } from '@/lib/citadelAppContract';

const APP_ID = 'citadel';

type OverrideRow = { app_id: string; permission: AppPermission; granted: number };

function ensureTable() {
  dbExec(APP_ID, `
    CREATE TABLE IF NOT EXISTS app_permission_overrides (
      app_id TEXT NOT NULL,
      permission TEXT NOT NULL,
      granted INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (app_id, permission)
    )
  `);
}

export function getPermissionOverrides(appId: string): Record<string, boolean> {
  ensureTable();
  const rows = dbQuery<OverrideRow>(
    APP_ID,
    `SELECT app_id, permission, granted FROM app_permission_overrides WHERE app_id = ?`,
    [appId]
  );
  const out: Record<string, boolean> = {};
  for (const r of rows) out[r.permission] = Boolean(r.granted);
  return out;
}

export function setPermissionOverride(appId: string, permission: AppPermission, granted: boolean) {
  ensureTable();
  const now = new Date().toISOString();
  dbExec(
    APP_ID,
    `INSERT INTO app_permission_overrides (app_id, permission, granted, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(app_id, permission) DO UPDATE SET
      granted = excluded.granted,
      updated_at = excluded.updated_at`,
    [appId, permission, granted ? 1 : 0, now]
  );
}

export function resolveEffectivePermissions(declared: AppPermission[], overrides: Record<string, boolean>) {
  return declared.map((p) => ({
    permission: p,
    declared: true,
    granted: overrides[p] !== false,
  }));
}

export function isPermissionGranted(
  declared: AppPermission[] | undefined,
  overrides: Record<string, boolean>,
  permission: AppPermission
): { allowed: boolean; reason?: string } {
  const d = declared ?? [];

  // Legacy apps with no declared permissions are allowed for compatibility.
  if (d.length === 0) return { allowed: true };

  if (!d.includes(permission)) {
    return { allowed: false, reason: `permission ${permission} not declared by app` };
  }

  if (overrides[permission] === false) {
    return { allowed: false, reason: `permission ${permission} denied by policy` };
  }

  return { allowed: true };
}
