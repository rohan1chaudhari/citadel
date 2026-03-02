// Per-app storage quota management
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { dataRoot, appDataRoot, appDbPath } from './paths.js';
import { audit } from './audit.js';

const CITADEL_APP_ID = 'citadel';

// Default quota: 500MB (configurable via env)
const DEFAULT_QUOTA_MB = parseInt(process.env.CITADEL_DEFAULT_QUOTA_MB || '500', 10);

let citadelDb: DatabaseSync | null = null;

function getCitadelDb(): DatabaseSync {
  if (!citadelDb) {
    const citadelDbPath = path.join(dataRoot(), 'citadel.sqlite');
    citadelDb = new DatabaseSync(citadelDbPath);
    ensureQuotaTable(citadelDb);
  }
  return citadelDb;
}

function ensureQuotaTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_quotas (
      app_id TEXT PRIMARY KEY,
      quota_mb INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

/**
 * Get the quota for an app (in MB)
 * Returns default quota if no override is set
 */
export function getQuota(appId: string): number {
  try {
    const db = getCitadelDb();
    const stmt = db.prepare('SELECT quota_mb FROM app_quotas WHERE app_id = ?');
    const row = stmt.get(appId) as { quota_mb: number } | undefined;
    return row?.quota_mb ?? DEFAULT_QUOTA_MB;
  } catch (e: any) {
    audit(CITADEL_APP_ID, 'quota.get.error', { appId, error: String(e?.message ?? e) });
    return DEFAULT_QUOTA_MB;
  }
}

/**
 * Set a quota override for an app (in MB)
 */
export function setQuota(appId: string, quotaMb: number): void {
  if (quotaMb < 1) {
    throw new Error('Quota must be at least 1 MB');
  }
  
  try {
    const db = getCitadelDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO app_quotas (app_id, quota_mb, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(app_id) DO UPDATE SET
        quota_mb = excluded.quota_mb,
        updated_at = excluded.updated_at
    `);
    stmt.run(appId, quotaMb, now, now);
    audit(CITADEL_APP_ID, 'quota.set', { appId, quotaMb });
  } catch (e: any) {
    audit(CITADEL_APP_ID, 'quota.set.error', { appId, quotaMb, error: String(e?.message ?? e) });
    throw e;
  }
}

/**
 * Remove a quota override for an app (reverts to default)
 */
export function removeQuota(appId: string): void {
  try {
    const db = getCitadelDb();
    const stmt = db.prepare('DELETE FROM app_quotas WHERE app_id = ?');
    stmt.run(appId);
    audit(CITADEL_APP_ID, 'quota.remove', { appId });
  } catch (e: any) {
    audit(CITADEL_APP_ID, 'quota.remove.error', { appId, error: String(e?.message ?? e) });
    throw e;
  }
}

/**
 * Get all app quotas (for admin/status)
 */
export function getAllQuotas(): Array<{ app_id: string; quota_mb: number; is_default: boolean }> {
  try {
    const db = getCitadelDb();
    const stmt = db.prepare('SELECT app_id, quota_mb FROM app_quotas');
    const rows = stmt.all() as Array<{ app_id: string; quota_mb: number }>;
    return rows.map(r => ({ ...r, is_default: false }));
  } catch (e: any) {
    audit(CITADEL_APP_ID, 'quota.getAll.error', { error: String(e?.message ?? e) });
    return [];
  }
}

/**
 * Calculate storage usage for an app (in bytes)
 * Includes DB file + all files in app data directory
 */
export function getAppStorageUsage(appId: string): number {
  try {
    const appDir = appDataRoot(appId);
    
    // Check if directory exists
    if (!fs.existsSync(appDir)) {
      return 0;
    }
    
    let totalBytes = 0;
    
    // Helper to recursively calculate size
    function calculateDirSize(dirPath: string): void {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          calculateDirSize(fullPath);
        } else if (entry.isFile()) {
          const stats = fs.statSync(fullPath);
          totalBytes += stats.size;
        }
      }
    }
    
    calculateDirSize(appDir);
    return totalBytes;
  } catch (e: any) {
    audit(CITADEL_APP_ID, 'quota.getUsage.error', { appId, error: String(e?.message ?? e) });
    return 0;
  }
}

/**
 * Check if an app has exceeded its quota
 * Returns { exceeded: boolean, usedBytes: number, quotaBytes: number }
 */
export function checkQuota(appId: string): { exceeded: boolean; usedBytes: number; quotaBytes: number } {
  const usedBytes = getAppStorageUsage(appId);
  const quotaMb = getQuota(appId);
  const quotaBytes = quotaMb * 1024 * 1024;
  
  return {
    exceeded: usedBytes >= quotaBytes,
    usedBytes,
    quotaBytes
  };
}

/**
 * Check if a write operation would exceed quota
 * Returns { allowed: boolean, usedBytes: number; quotaBytes: number, wouldUseBytes: number }
 */
export function checkWriteQuota(appId: string, bytesToWrite: number): { 
  allowed: boolean; 
  usedBytes: number; 
  quotaBytes: number; 
  wouldUseBytes: number;
} {
  const usedBytes = getAppStorageUsage(appId);
  const quotaMb = getQuota(appId);
  const quotaBytes = quotaMb * 1024 * 1024;
  const wouldUseBytes = usedBytes + bytesToWrite;
  
  return {
    allowed: wouldUseBytes <= quotaBytes,
    usedBytes,
    quotaBytes,
    wouldUseBytes
  };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Get quota status for status dashboard
 */
export function getQuotaStatus(): Array<{
  app_id: string;
  used_bytes: number;
  quota_mb: number;
  quota_bytes: number;
  used_percent: number;
  is_default: boolean;
}> {
  const appsDir = path.join(dataRoot(), 'apps');
  
  // Get all app IDs from data directory
  let appIds: string[] = [];
  try {
    appIds = fs.readdirSync(appsDir).filter(name => {
      const fullPath = path.join(appsDir, name);
      return fs.statSync(fullPath).isDirectory();
    });
  } catch {
    // Directory doesn't exist yet
    return [];
  }
  
  const quotaOverrides = new Map<string, number>();
  try {
    const db = getCitadelDb();
    const stmt = db.prepare('SELECT app_id, quota_mb FROM app_quotas');
    const rows = stmt.all() as Array<{ app_id: string; quota_mb: number }>;
    for (const row of rows) {
      quotaOverrides.set(row.app_id, row.quota_mb);
    }
  } catch {
    // Table may not exist
  }
  
  return appIds.map(appId => {
    const usedBytes = getAppStorageUsage(appId);
    const quotaMb = quotaOverrides.get(appId) ?? DEFAULT_QUOTA_MB;
    const quotaBytes = quotaMb * 1024 * 1024;
    const usedPercent = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;
    
    return {
      app_id: appId,
      used_bytes: usedBytes,
      quota_mb: quotaMb,
      quota_bytes: quotaBytes,
      used_percent: Math.round(usedPercent * 100) / 100,
      is_default: !quotaOverrides.has(appId)
    };
  }).sort((a, b) => b.used_percent - a.used_percent);
}
