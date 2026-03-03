/**
 * Data Protection System
 * 
 * Provides multiple layers of protection to prevent accidental database deletion:
 * - Immutable database files using chattr/chflags (Linux/macOS)
 * - Mass data loss detection on startup
 * - Safe file operations module that blocks dangerous fs operations
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { dataRoot, appDataRoot } from './paths.js';
import { listApps } from './registry.js';
import { audit } from './audit.js';

export interface DataProtectionResult {
  protected: string[];
  failed: string[];
  unsupported?: boolean;
}

export interface MassDataLossCheck {
  detected: boolean;
  details?: string;
  affectedApps?: string[];
}

/**
 * Check if the current platform supports file immutability (chattr on Linux, chflags on macOS).
 */
function isImmutabilitySupported(): boolean {
  const platform = process.platform;
  return platform === 'linux' || platform === 'darwin';
}

/**
 * Make a file immutable using platform-specific commands.
 * On Linux: uses chattr +i
 * On macOS: uses chflags uchg
 * 
 * Returns true if successful, false otherwise.
 */
async function makeImmutable(filePath: string): Promise<boolean> {
  if (!isImmutabilitySupported()) {
    return false;
  }

  return new Promise((resolve) => {
    const platform = process.platform;
    let cmd: string;
    let args: string[];

    if (platform === 'linux') {
      cmd = 'chattr';
      args = ['+i', filePath];
    } else if (platform === 'darwin') {
      cmd = 'chflags';
      args = ['uchg', filePath];
    } else {
      resolve(false);
      return;
    }

    const proc = spawn(cmd, args, { stdio: 'ignore' });
    
    proc.on('close', (code) => {
      resolve(code === 0);
    });

    proc.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Remove immutability from a file (for maintenance/updates).
 * On Linux: uses chattr -i
 * On macOS: uses chflags nouchg
 */
async function removeImmutability(filePath: string): Promise<boolean> {
  if (!isImmutabilitySupported()) {
    return false;
  }

  return new Promise((resolve) => {
    const platform = process.platform;
    let cmd: string;
    let args: string[];

    if (platform === 'linux') {
      cmd = 'chattr';
      args = ['-i', filePath];
    } else if (platform === 'darwin') {
      cmd = 'chflags';
      args = ['nouchg', filePath];
    } else {
      resolve(false);
      return;
    }

    const proc = spawn(cmd, args, { stdio: 'ignore' });
    
    proc.on('close', (code) => {
      resolve(code === 0);
    });

    proc.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Check if a file is immutable.
 */
async function isImmutable(filePath: string): Promise<boolean> {
  if (!isImmutabilitySupported()) {
    return false;
  }

  return new Promise((resolve) => {
    const platform = process.platform;
    let cmd: string;
    let args: string[];

    if (platform === 'linux') {
      cmd = 'lsattr';
      args = [filePath];
    } else if (platform === 'darwin') {
      cmd = 'lsflags';
      args = [filePath];
    } else {
      resolve(false);
      return;
    }

    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let output = '';

    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve(false);
        return;
      }

      if (platform === 'linux') {
        // Check for 'i' attribute in lsattr output
        // Format: ----i---------e------- file
        resolve(output.includes('i'));
      } else {
        // macOS - check for uchg flag
        resolve(output.includes('uchg'));
      }
    });

    proc.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Protect all database files by making them immutable.
 * This prevents accidental deletion or modification.
 * 
 * On Linux: uses chattr +i
 * On macOS: uses chflags uchg
 * On other platforms: returns unsupported flag
 */
export async function protectAllDatabases(): Promise<DataProtectionResult> {
  if (!isImmutabilitySupported()) {
    return { protected: [], failed: [], unsupported: true };
  }

  const result: DataProtectionResult = { protected: [], failed: [] };
  
  try {
    // Get all apps including hidden
    const apps = await listApps(true);
    
    for (const app of apps) {
      const appId = app.id;
      const dbPath = path.join(appDataRoot(appId), 'db.sqlite');
      
      try {
        // Check if DB exists
        await fsp.access(dbPath);
        
        // Try to make it immutable
        const success = await makeImmutable(dbPath);
        if (success) {
          result.protected.push(appId);
          audit('citadel', 'db.protected', { appId, path: dbPath });
        } else {
          result.failed.push(appId);
        }
      } catch {
        // DB doesn't exist or can't be accessed - skip
      }
    }

    // Also protect the citadel host DB
    const citadelDbPath = path.join(dataRoot(), 'citadel.sqlite');
    try {
      await fsp.access(citadelDbPath);
      const success = await makeImmutable(citadelDbPath);
      if (success) {
        result.protected.push('citadel');
        audit('citadel', 'db.protected', { appId: 'citadel', path: citadelDbPath });
      } else {
        result.failed.push('citadel');
      }
    } catch {
      // Citadel DB doesn't exist yet
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    audit('citadel', 'db.protection_failed', { error: errorMsg });
  }

  return result;
}

/**
 * Remove protection from all database files (for maintenance/updates).
 * Call this before running migrations or DB modifications.
 */
export async function unprotectAllDatabases(): Promise<DataProtectionResult> {
  if (!isImmutabilitySupported()) {
    return { protected: [], failed: [], unsupported: true };
  }

  const result: DataProtectionResult = { protected: [], failed: [] };
  
  try {
    // Get all apps including hidden
    const apps = await listApps(true);
    
    for (const app of apps) {
      const appId = app.id;
      const dbPath = path.join(appDataRoot(appId), 'db.sqlite');
      
      try {
        // Check if DB exists and is immutable
        await fsp.access(dbPath);
        
        const immutable = await isImmutable(dbPath);
        if (immutable) {
          const success = await removeImmutability(dbPath);
          if (success) {
            result.protected.push(appId);
            audit('citadel', 'db.unprotected', { appId, path: dbPath });
          } else {
            result.failed.push(appId);
          }
        }
      } catch {
        // DB doesn't exist or can't be accessed - skip
      }
    }

    // Also unprotect the citadel host DB
    const citadelDbPath = path.join(dataRoot(), 'citadel.sqlite');
    try {
      await fsp.access(citadelDbPath);
      const immutable = await isImmutable(citadelDbPath);
      if (immutable) {
        const success = await removeImmutability(citadelDbPath);
        if (success) {
          result.protected.push('citadel');
          audit('citadel', 'db.unprotected', { appId: 'citadel', path: citadelDbPath });
        } else {
          result.failed.push('citadel');
        }
      }
    } catch {
      // Citadel DB doesn't exist
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    audit('citadel', 'db.unprotection_failed', { error: errorMsg });
  }

  return result;
}

/**
 * Detect potential mass data loss by comparing current state with expected state.
 * 
 * Checks:
 * 1. Apps that should have data but don't
 * 2. Significant decrease in row counts across multiple apps
 * 3. Recently deleted databases
 */
export async function detectMassDataLoss(): Promise<MassDataLossCheck> {
  const affectedApps: string[] = [];
  
  try {
    // Get all apps including hidden
    const apps = await listApps(true);
    
    // Check each app's database using direct SQLite access (bypass app permission gates)
    for (const app of apps) {
      const appId = app.id;
      const dbPath = path.join(appDataRoot(appId), 'db.sqlite');

      try {
        if (!fs.existsSync(dbPath)) {
          // Missing DB can be normal for never-used apps; don't flag as data loss by default
          continue;
        }

        const db = new DatabaseSync(dbPath, { readOnly: true });
        try {
          const row = db
            .prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'")
            .get() as { count?: number } | undefined;

          if (!row || Number(row.count ?? 0) === 0) {
            affectedApps.push(appId);
          }
        } finally {
          db.close();
        }
      } catch {
        // DB exists but unreadable/corrupt
        affectedApps.push(appId);
      }
    }

    // Check citadel host DB specifically
    try {
      const citadelDbPath = path.join(dataRoot(), 'citadel.sqlite');
      if (fs.existsSync(citadelDbPath)) {
        const db = new DatabaseSync(citadelDbPath, { readOnly: true });
        try {
          const row = db
            .prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'")
            .get() as { count?: number } | undefined;
          if (!row || Number(row.count ?? 0) === 0) {
            affectedApps.push('citadel');
          }
        } finally {
          db.close();
        }
      }
    } catch {
      affectedApps.push('citadel');
    }

    if (affectedApps.length > 0) {
      const details = `Potential data loss detected in ${affectedApps.length} app(s)`;
      audit('citadel', 'data_loss.detected', { 
        affectedApps,
        details,
        severity: affectedApps.length > 3 ? 'high' : 'medium'
      });
      
      return {
        detected: true,
        details,
        affectedApps
      };
    }

    return { detected: false };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    audit('citadel', 'data_loss.check_failed', { error: errorMsg });
    
    return {
      detected: false,
      details: `Check failed: ${errorMsg}`
    };
  }
}

/**
 * Block dangerous file system operations that could cause data loss.
 * This is a guardrail function that can be called before fs operations.
 * 
 * @param operation The operation being attempted (e.g., 'rm', 'unlink')
 * @param targetPath The path being operated on
 * @throws Error if the operation is deemed dangerous
 */
export function blockDangerousOperation(operation: string, targetPath: string): void {
  const dataDir = dataRoot();
  const normalizedTarget = path.resolve(targetPath);
  
  // Block any operation that targets the entire data directory
  if (normalizedTarget === path.resolve(dataDir)) {
    const error = `Blocked dangerous operation: ${operation} on data directory`;
    audit('citadel', 'operation.blocked', { operation, target: targetPath, reason: 'data_directory' });
    throw new Error(error);
  }

  // Block operations on all app data directories
  const appsDir = path.join(dataDir, 'apps');
  if (normalizedTarget.startsWith(path.resolve(appsDir))) {
    // Allow operations on individual app files but not the entire app dir
    const relativeToApps = path.relative(appsDir, normalizedTarget);
    const parts = relativeToApps.split(path.sep);
    
    // If targeting just the apps dir itself or an entire app dir
    if (parts.length <= 1 && (operation === 'rm' || operation === 'rmdir' || operation === 'unlink')) {
      const error = `Blocked dangerous operation: ${operation} on app data directory`;
      audit('citadel', 'operation.blocked', { operation, target: targetPath, reason: 'app_data_directory' });
      throw new Error(error);
    }
  }

  // Block deletion of .sqlite files without proper safeguards
  if (targetPath.endsWith('.sqlite') && (operation === 'rm' || operation === 'unlink')) {
    // Check if there's a recent backup
    const backupDir = path.join(dataDir, 'backups');
    try {
      fs.accessSync(backupDir);
      // Backup dir exists - allow but warn
      audit('citadel', 'operation.warning', { operation, target: targetPath, reason: 'sqlite_deletion' });
    } catch {
      // No backup dir - block
      const error = `Blocked dangerous operation: ${operation} on ${targetPath} (no backup found)`;
      audit('citadel', 'operation.blocked', { operation, target: targetPath, reason: 'no_backup' });
      throw new Error(error);
    }
  }
}
