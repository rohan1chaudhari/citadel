import fs from 'node:fs/promises';
import path from 'node:path';
import { listApps } from '@citadel/core';
import { appDbPath, appDataRoot } from '@citadel/core';
import { dbQuery } from '@citadel/core';
import { getQuota } from '@citadel/core';
import { listBackups, getLatestBackup } from '@/lib/backup';
import { statfs } from 'node:fs/promises';
import StatusPageClient from './StatusPageClient';

export const runtime = 'nodejs';

const WARNING_DB_SIZE = 100 * 1024 * 1024; // 100MB
const WARNING_STORAGE_SIZE = 1024 * 1024 * 1024; // 1GB

async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true, recursive: true });
    let totalSize = 0;

    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = path.join(entry.parentPath || dirPath, entry.name);
        totalSize += await getFileSize(filePath);
      }
    }

    return totalSize;
  } catch {
    return 0;
  }
}

function getAuditStats(appId: string): { count: number; lastActivity: string | null } {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const cutoff = oneDayAgo.toISOString();

  try {
    const result = dbQuery<{ count: number; lastTs: string | null }>(
      'citadel',
      `SELECT COUNT(*) as count, MAX(ts) as lastTs
       FROM audit_log
       WHERE app_id = ? AND ts > ?`,
      [appId, cutoff]
    )[0];

    return {
      count: result?.count ?? 0,
      lastActivity: result?.lastTs ?? null,
    };
  } catch {
    return { count: 0, lastActivity: null };
  }
}

async function getAppHealthStatus(appId: string): Promise<{ accessible: boolean; error?: string }> {
  try {
    const dbPath = appDbPath(appId);
    try {
      await fs.access(dbPath, fs.constants.R_OK);
      // Try a simple query to verify DB is accessible
      dbQuery(appId, 'SELECT 1');
      return { accessible: true };
    } catch (e) {
      // DB doesn't exist yet - check if directory is accessible
      const dataDir = appDataRoot(appId);
      try {
        await fs.access(dataDir, fs.constants.R_OK);
        return { accessible: true }; // No DB yet but directory is OK
      } catch {
        return { accessible: true }; // Will be created on first use
      }
    }
  } catch (e) {
    return { accessible: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function getDiskUsage() {
  try {
    const dataDir = process.env.CITADEL_DATA_ROOT || path.resolve(process.cwd(), '../data');
    const stats = await statfs(dataDir);
    const total = stats.blocks * stats.bsize;
    const available = stats.bavail * stats.bsize;
    const used = total - available;
    return {
      total,
      used,
      available,
      percentUsed: Math.round((used / total) * 100 * 100) / 100,
      path: dataDir,
    };
  } catch (e) {
    return null;
  }
}

function getRecentErrors(limit: number = 10) {
  try {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const cutoff = oneDayAgo.toISOString();

    const results = dbQuery<
      { id: number; ts: string; app_id: string; event: string; payload: string }
    >(
      'citadel',
      `SELECT id, ts, app_id, event, payload 
       FROM audit_log 
       WHERE (event LIKE '%error%' OR event LIKE '%failed%' OR event LIKE '%fail%' OR payload LIKE '%error%')
         AND ts > ?
       ORDER BY ts DESC
       LIMIT ?`,
      [cutoff, limit]
    );

    return results.map((r) => ({
      id: r.id,
      ts: r.ts,
      appId: r.app_id,
      event: r.event,
      payload: JSON.parse(r.payload || '{}'),
    }));
  } catch {
    return [];
  }
}

export default async function StatusPage() {
  const apps = await listApps(true);

  const appHealthData = await Promise.all(
    apps.map(async (app) => {
      const dbPath = appDbPath(app.id);
      const storagePath = appDataRoot(app.id);

      const [dbSize, storageSize, healthStatus] = await Promise.all([
        getFileSize(dbPath),
        getDirectorySize(storagePath),
        getAppHealthStatus(app.id),
      ]);

      const auditStats = getAuditStats(app.id);

      // Get quota info
      const quotaMb = getQuota(app.id);
      const quotaBytes = quotaMb * 1024 * 1024;
      const usedPercent = quotaBytes > 0 ? (storageSize / quotaBytes) * 100 : 0;

      return {
        ...app,
        dbSize,
        storageSize,
        auditCount: auditStats.count,
        lastActivity: auditStats.lastActivity,
        dbWarning: dbSize > WARNING_DB_SIZE,
        storageWarning: storageSize > WARNING_STORAGE_SIZE,
        quotaMb,
        quotaBytes,
        quotaUsedPercent: Math.round(usedPercent * 100) / 100,
        dbAccessible: healthStatus.accessible,
        dbError: healthStatus.error,
      };
    })
  );

  // Fetch backup information
  const [backups, latestBackup] = await Promise.all([
    listBackups(),
    getLatestBackup(),
  ]);

  // Fetch system metrics
  const diskUsage = await getDiskUsage();
  const recentErrors = getRecentErrors(10);

  // Memory usage
  const memUsage = process.memoryUsage();

  return (
    <StatusPageClient
      apps={appHealthData}
      backups={backups}
      latestBackup={latestBackup}
      diskUsage={diskUsage}
      memoryUsage={{
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
      }}
      nodeVersion={process.version}
      uptimeSec={Math.floor(process.uptime())}
      recentErrors={recentErrors}
    />
  );
}
