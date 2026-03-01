import fs from 'node:fs/promises';
import path from 'node:path';
import { Card, LinkA, Shell } from '@/components/Shell';
import { listApps } from '@/lib/registry';
import { appDbPath, appDataRoot } from '@/lib/paths';
import { dbQuery } from '@/lib/db';

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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimeAgo(ts: string | null): string {
  if (!ts) return 'No activity';
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
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

  return (
    <Shell title="System Status" subtitle="Health checks and app metrics">
      <div className="grid gap-4">
        {/* App Health Dashboard */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900">App Health Dashboard</h2>
            <span className="text-xs text-zinc-500">
              {appHealthData.length} app{appHealthData.length !== 1 ? 's' : ''} installed
            </span>
          </div>
          
          <div className="grid gap-3">
            {appHealthData.map((app) => (
              <div
                key={app.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-zinc-200 bg-white"
              >
                <div className="mb-3 sm:mb-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900">{app.name}</span>
                    <span className="text-xs text-zinc-500 font-mono">{app.id}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Last activity: {formatTimeAgo(app.lastActivity)}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-right sm:text-left">
                  <div className="text-right">
                    <div className={`text-xs ${app.dbWarning ? 'text-amber-600 font-medium' : 'text-zinc-500'}`}>
                      DB Size
                      {app.dbWarning && ' ⚠️'}
                    </div>
                    <div className="text-sm font-medium text-zinc-900">{formatBytes(app.dbSize)}</div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-xs ${app.storageWarning ? 'text-amber-600 font-medium' : 'text-zinc-500'}`}>
                      Storage
                      {app.storageWarning && ' ⚠️'}
                    </div>
                    <div className="text-sm font-medium text-zinc-900">{formatBytes(app.storageSize)}</div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">API Calls (24h)</div>
                    <div className="text-sm font-medium text-zinc-900">{app.auditCount.toLocaleString()}</div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">Actions</div>
                    <a
                      href={`/api/apps/citadel/export/${app.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      title={`Export ${app.name} data as zip`}
                    >
                      Export ↓
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {(appHealthData.some(a => a.dbWarning || a.storageWarning)) && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-800">
                <span className="font-medium">⚠️ Storage warnings:</span> Apps marked with ⚠️ have exceeded recommended size limits 
                (DB &gt; {formatBytes(WARNING_DB_SIZE)} or Storage &gt; {formatBytes(WARNING_STORAGE_SIZE)}).
              </p>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">API Health Checks</h2>
          <div className="grid gap-2">
            {apps.map((app) => (
              <a
                key={app.id}
                href={`/api/apps/${app.id}/health`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
              >
                <span className="text-sm font-medium text-zinc-900">{app.name}</span>
                <span className="text-xs text-zinc-500">/api/apps/{app.id}/health →</span>
              </a>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Diagnostics</h2>
          <div className="flex flex-wrap gap-3">
            <LinkA href="/api/health" target="_blank" rel="noreferrer">
              Host Health
            </LinkA>
            <LinkA href="/api/apps/scrum-board/health" target="_blank" rel="noreferrer">
              Scrum Board API
            </LinkA>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
