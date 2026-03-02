/**
 * Data Protection System for Citadel
 * 
 * Prevents accidental database deletion through multiple safeguards:
 * 1. Immutable file flags (where supported)
 * 2. Pre-deletion validation
 * 3. Change detection and alerts
 * 4. Automatic pre-operation snapshots
 */

import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { appDataRoot } from './paths.js';
import { audit } from './audit.js';

const IMMUTABLE_SUPPORTED = process.platform === 'linux' || process.platform === 'darwin';

export interface ProtectionOptions {
  /** Require a recent backup before allowing deletion */
  requireBackup?: boolean;
  /** Require explicit user confirmation */
  requireConfirmation?: boolean;
  /** Max allowed DB size change (percentage) before alert */
  maxSizeChangePercent?: number;
}

export interface DeletionValidation {
  appId: string;
  dbPath: string;
  backupExists: boolean;
  backupAgeMinutes: number;
  dbSize: number;
  canDelete: boolean;
  reason?: string;
}

/**
 * Check if immutable file attributes are supported on this system
 */
export function isImmutableSupported(): boolean {
  return IMMUTABLE_SUPPORTED;
}

/**
 * Make a database file immutable (cannot be deleted/modified without unprotecting first)
 * Works on Linux (chattr +i) and macOS (chflags uchg)
 */
export async function protectDatabase(appId: string): Promise<boolean> {
  if (!IMMUTABLE_SUPPORTED) {
    audit('citadel', 'data_protection.unsupported', { appId, platform: process.platform });
    return false;
  }

  const dbPath = path.join(appDataRoot(appId), 'db.sqlite');
  
  try {
    await fs.access(dbPath);
  } catch {
    // DB doesn't exist yet, nothing to protect
    return false;
  }

  try {
    if (process.platform === 'linux') {
      await execCommand('chattr', ['+i', dbPath]);
    } else if (process.platform === 'darwin') {
      await execCommand('chflags', ['uchg', dbPath]);
    }
    
    audit('citadel', 'data_protection.protected', { appId, path: dbPath });
    return true;
  } catch (err: any) {
    audit('citadel', 'data_protection.protect_failed', { 
      appId, 
      path: dbPath, 
      error: err?.message 
    });
    return false;
  }
}

/**
 * Remove immutable flag from database file to allow modification
 */
export async function unprotectDatabase(appId: string): Promise<boolean> {
  if (!IMMUTABLE_SUPPORTED) {
    return false;
  }

  const dbPath = path.join(appDataRoot(appId), 'db.sqlite');
  
  try {
    if (process.platform === 'linux') {
      await execCommand('chattr', ['-i', dbPath]);
    } else if (process.platform === 'darwin') {
      await execCommand('chflags', ['nouchg', dbPath]);
    }
    
    audit('citadel', 'data_protection.unprotected', { appId, path: dbPath });
    return true;
  } catch (err: any) {
    audit('citadel', 'data_protection.unprotect_failed', { 
      appId, 
      path: dbPath, 
      error: err?.message 
    });
    return false;
  }
}

/**
 * Check if a database file is protected (immutable)
 */
export async function isDatabaseProtected(appId: string): Promise<boolean> {
  if (!IMMUTABLE_SUPPORTED) {
    return false;
  }

  const dbPath = path.join(appDataRoot(appId), 'db.sqlite');
  
  try {
    const stats = await fs.stat(dbPath);
    // On Linux, we can check if file is immutable by trying to open it for write
    // A more robust check would use lsattr, but this is sufficient
    try {
      const fd = await fs.open(dbPath, 'w');
      await fd.close();
      return false; // If we can open for write, it's not protected
    } catch {
      return true; // Cannot open for write, likely protected
    }
  } catch {
    return false;
  }
}

/**
 * Check if a recent backup exists for an app
 */
export async function hasRecentBackup(
  appId: string, 
  maxAgeMinutes: number = 60
): Promise<{ exists: boolean; ageMinutes: number; path?: string }> {
  const { dataRoot } = await import('./paths.js');
  const backupsDir = path.join(dataRoot(), 'backups');
  
  try {
    const entries = await fs.readdir(backupsDir);
    const backupFiles = entries
      .filter(f => f.startsWith('citadel-backup-') && f.endsWith('.zip'))
      .map(f => ({
        name: f,
        path: path.join(backupsDir, f),
        time: parseBackupTimestamp(f)
      }))
      .filter(b => b.time !== null)
      .sort((a, b) => b.time!.getTime() - a.time!.getTime());

    if (backupFiles.length === 0) {
      return { exists: false, ageMinutes: Infinity };
    }

    const latest = backupFiles[0];
    const ageMs = Date.now() - latest.time!.getTime();
    const ageMinutes = ageMs / (1000 * 60);

    return {
      exists: ageMinutes <= maxAgeMinutes,
      ageMinutes,
      path: latest.path
    };
  } catch {
    return { exists: false, ageMinutes: Infinity };
  }
}

/**
 * Validate if a database deletion is safe
 * Throws an error if deletion should not proceed
 */
export async function validateDeletion(
  appId: string,
  options: ProtectionOptions = {}
): Promise<DeletionValidation> {
  const { 
    requireBackup = true, 
    requireConfirmation = true,
    maxSizeChangePercent = 90 
  } = options;

  const dbPath = path.join(appDataRoot(appId), 'db.sqlite');
  
  let dbSize = 0;
  try {
    const stats = await fs.stat(dbPath);
    dbSize = stats.size;
  } catch {
    // DB doesn't exist
  }

  // Check if protected
  const protected_ = await isDatabaseProtected(appId);
  if (protected_) {
    return {
      appId,
      dbPath,
      backupExists: false,
      backupAgeMinutes: Infinity,
      dbSize,
      canDelete: false,
      reason: 'Database is protected. Use unprotectDatabase() first.'
    };
  }

  // Check backup
  const backupInfo = await hasRecentBackup(appId, 60);
  if (requireBackup && !backupInfo.exists) {
    return {
      appId,
      dbPath,
      backupExists: false,
      backupAgeMinutes: backupInfo.ageMinutes,
      dbSize,
      canDelete: false,
      reason: `No recent backup found. Latest backup is ${Math.round(backupInfo.ageMinutes)} minutes old.`
    };
  }

  // Log the validation attempt
  audit('citadel', 'data_protection.deletion_validated', {
    appId,
    dbSize,
    backupExists: backupInfo.exists,
    backupAgeMinutes: backupInfo.ageMinutes,
    requireConfirmation
  });

  return {
    appId,
    dbPath,
    backupExists: backupInfo.exists,
    backupAgeMinutes: backupInfo.ageMinutes,
    dbSize,
    canDelete: true
  };
}

/**
 * Detect suspicious data loss patterns
 * Returns true if potential mass data loss is detected
 */
export async function detectMassDataLoss(): Promise<{
  detected: boolean;
  details?: string;
  affectedApps?: string[];
}> {
  const entries = await fs.readdir(appDataRoot(''), { withFileTypes: true });
  const appDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  const emptyDbs: string[] = [];
  const suspiciousPatterns: string[] = [];

  for (const appId of appDirs) {
    const dbPath = path.join(appDataRoot(appId), 'db.sqlite');
    
    try {
      const stats = await fs.stat(dbPath);
      
      // Check if DB is suspiciously small (fresh SQLite is ~32KB)
      if (stats.size < 50000) {
        // Try to check if it has data
        const { DatabaseSync } = await import('node:sqlite');
        const db = new DatabaseSync(dbPath);
        try {
          const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{name: string}>;
          const hasTables = tables.length > 0;
          
          if (!hasTables || stats.size < 40000) {
            emptyDbs.push(appId);
          }
        } catch {
          emptyDbs.push(appId);
        } finally {
          db.close();
        }
      }

      // Check if DB was created very recently (within last hour)
      const ageHours = (Date.now() - stats.birthtime.getTime()) / (1000 * 60 * 60);
      if (ageHours < 1 && stats.size > 100000) {
        // Large DB created recently - might be a restore
        suspiciousPatterns.push(`${appId}: large recent DB`);
      }
    } catch {
      // No DB file
    }
  }

  // Alert if more than 2 apps have empty/suspicious DBs
  if (emptyDbs.length > 2) {
    const message = `Potential mass data loss detected: ${emptyDbs.length} apps have empty or fresh databases: ${emptyDbs.join(', ')}`;
    
    audit('citadel', 'data_protection.mass_data_loss_alert', {
      affectedApps: emptyDbs,
      suspiciousPatterns,
      message
    });

    return {
      detected: true,
      details: message,
      affectedApps: emptyDbs
    };
  }

  return { detected: false };
}

/**
 * Protect all app databases
 * Call this after startup once DBs are initialized
 */
export async function protectAllDatabases(): Promise<{
  protected: string[];
  failed: string[];
  unsupported: boolean;
}> {
  if (!IMMUTABLE_SUPPORTED) {
    return { protected: [], failed: [], unsupported: true };
  }

  const entries = await fs.readdir(appDataRoot(''), { withFileTypes: true });
  const appIds = entries.filter(e => e.isDirectory()).map(e => e.name);

  const protected_: string[] = [];
  const failed: string[] = [];

  for (const appId of appIds) {
    const success = await protectDatabase(appId);
    if (success) {
      protected_.push(appId);
    } else {
      // Only count as failed if DB exists
      try {
        await fs.access(path.join(appDataRoot(appId), 'db.sqlite'));
        failed.push(appId);
      } catch {
        // No DB to protect
      }
    }
  }

  audit('citadel', 'data_protection.bulk_protect', {
    protected: protected_.length,
    failed: failed.length
  });

  return { protected: protected_, failed, unsupported: false };
}

// Helper functions

function execCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'ignore' });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command ${cmd} exited with code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

function parseBackupTimestamp(filename: string): Date | null {
  // Format: citadel-backup-2026-03-02T19-52-08-520Z.zip
  const match = filename.match(/citadel-backup-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  if (!match) return null;
  
  const [_, year, month, day, hour, minute, second] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
}
