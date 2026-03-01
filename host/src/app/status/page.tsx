import fs from 'node:fs/promises';
import path from 'node:path';
import { listApps } from '@/lib/registry';
import { appDbPath, appDataRoot } from '@/lib/paths';
import { dbQuery } from '@/lib/db';
import { listBackups, getLatestBackup, formatBytes } from '@/lib/backup';
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

export default async function StatusPage() {
  const apps = await listApps(true);

  const appHealthData = await Promise.all(
    apps.map(async (app) => {
      const dbPath = appDbPath(app.id);
      const storagePath = appDataRoot(app.id);

      const [dbSize, storageSize] = await Promise.all([
        getFileSize(dbPath),
        getDirectorySize(storagePath),
      ]);

      const auditStats = getAuditStats(app.id);

      return {
        ...app,
        dbSize,
        storageSize,
        auditCount: auditStats.count,
        lastActivity: auditStats.lastActivity,
        dbWarning: dbSize > WARNING_DB_SIZE,
        storageWarning: storageSize > WARNING_STORAGE_SIZE,
      };
    })
  );

  // Fetch backup information
  const [backups, latestBackup] = await Promise.all([
    listBackups(),
    getLatestBackup(),
  ]);

  return (
    <StatusPageClient
      apps={appHealthData}
      backups={backups}
      latestBackup={latestBackup}
    />
  );
}
