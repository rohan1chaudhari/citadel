'use client';

import { useState, useRef } from 'react';
import { Card, LinkA, Shell } from '@/components/Shell';

interface AppHealth {
  id: string;
  name: string;
  dbSize: number;
  storageSize: number;
  auditCount: number;
  lastActivity: string | null;
  dbWarning: boolean;
  storageWarning: boolean;
}

interface BackupInfo {
  filename: string;
  timestamp: string;
  size: number;
  path: string;
}

interface StatusPageClientProps {
  apps: AppHealth[];
  backups: BackupInfo[];
  latestBackup: BackupInfo | null;
}

const WARNING_DB_SIZE = 100 * 1024 * 1024; // 100MB
const WARNING_STORAGE_SIZE = 1024 * 1024 * 1024; // 1GB

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

function formatBackupTime(isoTimestamp: string): string {
  // Convert filename timestamp (2026-03-01T02-51-00-000Z) to readable format
  try {
    const date = new Date(isoTimestamp);
    if (isNaN(date.getTime())) {
      // Try parsing the filename format
      const fixed = isoTimestamp.replace(/(\d{2})-(\d{2})-(\d{2})/, '$1:$2:$3');
      const d = new Date(fixed);
      if (!isNaN(d.getTime())) return formatTimeAgo(fixed);
    }
    return formatTimeAgo(isoTimestamp);
  } catch {
    return 'Unknown';
  }
}

export default function StatusPageClient({ apps, backups, latestBackup }: StatusPageClientProps) {
  const [importingApp, setImportingApp] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ appId: string; file: File } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = (appId: string) => {
    setImportingApp(appId);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (appId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file is a zip
    if (!file.name.endsWith('.zip')) {
      setImportStatus({ type: 'error', message: 'Please select a zip file' });
      return;
    }

    setPendingImport({ appId, file });
    setShowConfirm(true);

    // Reset file input so same file can be selected again
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;

    const { appId, file } = pendingImport;
    setShowConfirm(false);
    setPendingImport(null);

    try {
      const response = await fetch(`/api/apps/${appId}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/zip',
        },
        body: file,
      });

      const result = await response.json();

      if (response.ok) {
        setImportStatus({
          type: 'success',
          message: `Import successful! ${result.filesRestored} file(s) restored.${result.backupPath ? ` Backup saved to: ${result.backupPath}` : ''}`,
        });
        // Refresh page after successful import to show updated stats
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setImportStatus({
          type: 'error',
          message: result.error + (result.details ? `: ${result.details}` : ''),
        });
      }
    } catch (error: any) {
      setImportStatus({
        type: 'error',
        message: 'Import failed: ' + (error?.message || 'Unknown error'),
      });
    } finally {
      setImportingApp(null);
    }
  };

  const handleCancelImport = () => {
    setShowConfirm(false);
    setPendingImport(null);
    setImportingApp(null);
  };

  return (
    <>
      <Shell title="System Status" subtitle="Health checks and app metrics">
        <div className="grid gap-4">
          {/* Import Status Messages */}
          {importStatus && (
            <div
              className={`p-4 rounded-lg border ${
                importStatus.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <p className="text-sm font-medium">
                {importStatus.type === 'success' ? '✓' : '✗'} {importStatus.message}
              </p>
              <button
                onClick={() => setImportStatus(null)}
                className="text-xs mt-2 underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* App Health Dashboard */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-900">App Health Dashboard</h2>
              <span className="text-xs text-zinc-500">
                {apps.length} app{apps.length !== 1 ? 's' : ''} installed
              </span>
            </div>

            <div className="grid gap-3">
              {apps.map((app) => (
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

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-right sm:text-left">
                    <div className="text-right">
                      <div
                        className={`text-xs ${
                          app.dbWarning ? 'text-amber-600 font-medium' : 'text-zinc-500'
                        }`}
                      >
                        DB Size
                        {app.dbWarning && ' ⚠️'}
                      </div>
                      <div className="text-sm font-medium text-zinc-900">{formatBytes(app.dbSize)}</div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-xs ${
                          app.storageWarning ? 'text-amber-600 font-medium' : 'text-zinc-500'
                        }`}
                      >
                        Storage
                        {app.storageWarning && ' ⚠️'}
                      </div>
                      <div className="text-sm font-medium text-zinc-900">
                        {formatBytes(app.storageSize)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-zinc-500">API Calls (24h)</div>
                      <div className="text-sm font-medium text-zinc-900">
                        {app.auditCount.toLocaleString()}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-zinc-500">Export</div>
                      <a
                        href={`/api/apps/citadel/export/${app.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        title={`Export ${app.name} data as zip`}
                      >
                        Download ↓
                      </a>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-zinc-500">Import</div>
                      <button
                        onClick={() => handleImportClick(app.id)}
                        disabled={importingApp === app.id}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:text-zinc-400 disabled:cursor-not-allowed"
                        title={`Import data to ${app.name} from zip`}
                      >
                        {importingApp === app.id ? 'Importing...' : 'Upload ↑'}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip"
                        className="hidden"
                        onChange={(e) => handleFileSelect(app.id, e)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {apps.some((a) => a.dbWarning || a.storageWarning) && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-800">
                  <span className="font-medium">⚠️ Storage warnings:</span> Apps marked with ⚠️ have
                  exceeded recommended size limits (DB &gt; {formatBytes(WARNING_DB_SIZE)} or Storage
                  &gt; {formatBytes(WARNING_STORAGE_SIZE)}).
                </p>
              </div>
            )}
          </Card>

          {/* Backup Status */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-900">Backup Status</h2>
              <span className="text-xs text-zinc-500">
                {backups.length} backup{backups.length !== 1 ? 's' : ''} stored
              </span>
            </div>

            {latestBackup ? (
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 bg-white">
                  <div>
                    <div className="text-sm font-medium text-zinc-900">Latest Backup</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {formatBackupTime(latestBackup.timestamp)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">Size</div>
                    <div className="text-sm font-medium text-zinc-900">
                      {formatBytes(latestBackup.size)}
                    </div>
                  </div>
                </div>

                {backups.length > 1 && (
                  <details className="group">
                    <summary className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 bg-zinc-50 cursor-pointer hover:bg-zinc-100 transition-colors">
                      <span className="text-xs font-medium text-zinc-700">
                        Show all {backups.length} backups
                      </span>
                      <span className="text-xs text-zinc-400 group-open:rotate-180 transition-transform">
                        ▼
                      </span>
                    </summary>
                    <div className="mt-2 grid gap-2">
                      {backups.slice(1).map((backup) => (
                        <div
                          key={backup.filename}
                          className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 bg-white text-sm"
                        >
                          <span className="text-zinc-600 font-mono text-xs">
                            {backup.filename}
                          </span>
                          <span className="text-zinc-500">{formatBytes(backup.size)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <p className="text-xs text-zinc-500">
                  Backups run automatically on startup and every 24 hours.
                  The last 7 backups are retained.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-zinc-200 bg-zinc-50">
                <p className="text-sm text-zinc-600">
                  No backups yet. A backup will be created on the next host startup.
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

      {/* Confirmation Dialog */}
      {showConfirm && pendingImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">Confirm Import</h3>
            <p className="text-sm text-zinc-600 mb-4">
              You are about to import data from <strong>{pendingImport.file.name}</strong> into{' '}
              <strong>{apps.find((a) => a.id === pendingImport.appId)?.name}</strong>.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-amber-800">
                <span className="font-medium">⚠️ Warning:</span> This will overwrite all existing
                data for this app. A backup will be created automatically before importing.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelImport}
                className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Import Data
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
