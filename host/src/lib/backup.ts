import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { dataRoot } from '@citadel/core';
import { audit } from '@citadel/core';

const execAsync = promisify(exec);
const RETENTION_COUNT = 7;
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface BackupInfo {
  filename: string;
  timestamp: string;
  size: number;
  path: string;
}

function getBackupsDir(): string {
  return path.join(dataRoot(), 'backups');
}

function getBackupFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `citadel-backup-${timestamp}.zip`;
}

export async function ensureBackupsDir(): Promise<string> {
  const backupsDir = getBackupsDir();
  await fs.mkdir(backupsDir, { recursive: true });
  return backupsDir;
}

export async function createBackup(): Promise<BackupInfo> {
  const backupsDir = await ensureBackupsDir();
  const filename = getBackupFilename();
  const backupPath = path.join(backupsDir, filename);
  const appsDir = path.join(dataRoot(), 'apps');

  // Check if apps directory exists
  try {
    await fs.access(appsDir);
  } catch {
    throw new Error('Apps directory not found');
  }

  // Use zip command to create backup (more efficient than Node.js streaming for large dirs)
  // Fallback to Node.js implementation if zip is not available
  try {
    const { stdout, stderr } = await execAsync(
      `cd "${dataRoot()}" && zip -r "${backupPath}" apps/`
    );
    
    if (stderr && !stderr.includes('adding:')) {
      console.warn('[backup] zip warning:', stderr);
    }
  } catch (error) {
    // Fallback: use Node.js to create a simple tar-like backup
    console.warn('[backup] zip command failed, using fallback:', error);
    await createFallbackBackup(backupPath, appsDir);
  }

  // Get backup stats
  const stats = await fs.stat(backupPath);
  const info: BackupInfo = {
    filename,
    timestamp: new Date().toISOString(),
    size: stats.size,
    path: backupPath,
  };

  audit('citadel', 'backup.created', {
    filename,
    size: stats.size,
    path: backupPath,
  });

  console.log(`[backup] Created: ${filename} (${formatBytes(stats.size)})`);
  
  return info;
}

async function createFallbackBackup(backupPath: string, appsDir: string): Promise<void> {
  // Simple fallback: copy apps directory to a temp location and note it
  // In production, you'd use a proper archiving library like archiver.js
  const tempDir = path.join(path.dirname(backupPath), '.temp-backup');
  
  try {
    await fs.mkdir(tempDir, { recursive: true });
    await fs.cp(appsDir, path.join(tempDir, 'apps'), { recursive: true });
    
    // Create a marker file since we can't create zip without external tools
    const markerPath = backupPath.replace('.zip', '.tar-backup');
    await fs.writeFile(
      markerPath,
      JSON.stringify({
        created: new Date().toISOString(),
        source: appsDir,
        note: 'Backup created without zip utility. Install zip for proper compression.',
      }, null, 2)
    );
    
    // Try to tar it
    try {
      await execAsync(`cd "${tempDir}" && tar -czf "${backupPath}" apps/`);
      await fs.rm(markerPath, { force: true });
    } catch {
      // If tar also fails, just leave the marker
      console.warn('[backup] tar also failed, leaving uncompressed backup info');
    }
  } finally {
    // Cleanup temp dir
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function cleanupOldBackups(): Promise<number> {
  const backupsDir = getBackupsDir();
  
  let files: string[];
  try {
    files = await fs.readdir(backupsDir);
  } catch {
    return 0;
  }

  // Filter backup files and get their stats
  const backups = await Promise.all(
    files
      .filter(f => f.startsWith('citadel-backup-'))
      .map(async (filename) => {
        const filePath = path.join(backupsDir, filename);
        try {
          const stats = await fs.stat(filePath);
          return { filename, path: filePath, mtime: stats.mtime, size: stats.size };
        } catch {
          return null;
        }
      })
  );

  // Sort by modification time (oldest first)
  const validBackups = backups
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

  // Delete oldest backups beyond retention count
  const toDelete = validBackups.slice(0, Math.max(0, validBackups.length - RETENTION_COUNT));
  
  for (const backup of toDelete) {
    try {
      await fs.unlink(backup.path);
      console.log(`[backup] Deleted old backup: ${backup.filename}`);
      audit('citadel', 'backup.deleted', { filename: backup.filename });
    } catch (e) {
      console.error(`[backup] Failed to delete ${backup.filename}:`, e);
    }
  }

  return toDelete.length;
}

export async function listBackups(): Promise<BackupInfo[]> {
  const backupsDir = getBackupsDir();
  
  let files: string[];
  try {
    files = await fs.readdir(backupsDir);
  } catch {
    return [];
  }

  const backups = await Promise.all(
    files
      .filter(f => f.startsWith('citadel-backup-'))
      .map(async (filename) => {
        const filePath = path.join(backupsDir, filename);
        try {
          const stats = await fs.stat(filePath);
          // Extract timestamp from filename: citadel-backup-2026-03-01T02-51-00-000Z.zip
          const match = filename.match(/citadel-backup-(.+)\.zip$/);
          const timestamp = match ? match[1].replace(/-/g, ':').replace(/T(\d{2}):(\d{2}):(\d{2})/, 'T$1:$2:$3') : stats.mtime.toISOString();
          
          return {
            filename,
            timestamp,
            size: stats.size,
            path: filePath,
          };
        } catch {
          return null;
        }
      })
  );

  return backups
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function getLatestBackup(): Promise<BackupInfo | null> {
  const backups = await listBackups();
  return backups[0] ?? null;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Global to track if scheduler is running
let schedulerInterval: NodeJS.Timeout | null = null;
let isRunningBackup = false;

export async function runBackupJob(): Promise<void> {
  if (isRunningBackup) {
    console.log('[backup] Backup already in progress, skipping');
    return;
  }

  isRunningBackup = true;
  try {
    const backup = await createBackup();
    await cleanupOldBackups();
    console.log(`[backup] Job complete: ${backup.filename}`);
  } catch (error) {
    console.error('[backup] Job failed:', error);
    audit('citadel', 'backup.failed', { error: String(error) });
  } finally {
    isRunningBackup = false;
  }
}

export function startBackupScheduler(): void {
  if (schedulerInterval) {
    console.log('[backup] Scheduler already running');
    return;
  }

  console.log('[backup] Starting scheduler (interval: 24h)');
  
  // Run immediately on startup
  runBackupJob();
  
  // Schedule recurring backups
  schedulerInterval = setInterval(runBackupJob, BACKUP_INTERVAL_MS);
  
  // Handle graceful shutdown
  process.on('SIGTERM', stopBackupScheduler);
  process.on('SIGINT', stopBackupScheduler);
}

export function stopBackupScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[backup] Scheduler stopped');
  }
}

// For serverless environments or manual triggering
export async function runBackupIfNeeded(): Promise<boolean> {
  const latest = await getLatestBackup();
  
  if (!latest) {
    console.log('[backup] No previous backup found, creating one now');
    await runBackupJob();
    return true;
  }
  
  const lastBackupTime = new Date(latest.timestamp).getTime();
  const now = Date.now();
  const hoursSinceLastBackup = (now - lastBackupTime) / (60 * 60 * 1000);
  
  if (hoursSinceLastBackup >= 24) {
    console.log(`[backup] Last backup was ${hoursSinceLastBackup.toFixed(1)} hours ago, creating new one`);
    await runBackupJob();
    return true;
  }
  
  console.log(`[backup] Last backup was ${hoursSinceLastBackup.toFixed(1)} hours ago, skipping`);
  return false;
}
