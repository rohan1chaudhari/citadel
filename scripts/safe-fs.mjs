#!/usr/bin/env node
/**
 * Safe File Operations - Drop-in replacement for dangerous fs operations
 * 
 * Usage: Import this instead of direct fs operations for any file that 
 * touches data directories.
 * 
 * import { safeUnlink, safeRm } from './safe-fs';
 * 
 * // This will validate before deleting
 * await safeUnlink('data/apps/gym-tracker/db.sqlite');
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { 
  validateDeletion, 
  unprotectDatabase, 
  protectDatabase,
  detectMassDataLoss 
} from '@citadel/core';

const DANGEROUS_PATHS = [
  'data/apps',
  'data/citadel',
  'data/backups'
];

/**
 * Check if a path is in a protected directory
 */
function isProtectedPath(targetPath: string): boolean {
  const normalized = path.normalize(targetPath);
  return DANGEROUS_PATHS.some(p => 
    normalized.includes(path.normalize(p))
  );
}

/**
 * Extract appId from a database path
 */
function getAppIdFromPath(targetPath: string): string | null {
  const normalized = path.normalize(targetPath);
  const match = normalized.match(/data[/\\]apps[/\\]([^/\\]+)/);
  return match ? match[1] : null;
}

/**
 * Safe unlink - validates before deleting database files
 */
export async function safeUnlink(targetPath: string): Promise<void> {
  // Check if this is a protected path
  if (!isProtectedPath(targetPath)) {
    // Not a protected path, proceed normally
    await fs.unlink(targetPath);
    return;
  }

  // Check if it's a database file
  if (targetPath.endsWith('db.sqlite') || targetPath.endsWith('.db')) {
    const appId = getAppIdFromPath(targetPath);
    if (appId) {
      console.error(`\n🛑 BLOCKED: Attempt to delete database for '${appId}'`);
      console.error(`   Path: ${targetPath}`);
      console.error(`\n   To delete this database, use the protected deletion API:`);
      console.error(`   - Create a backup first`);
      console.error(`   - Use unprotectDatabase('${appId}')`);
      console.error(`   - Or use: node scripts/safe-delete.mjs ${appId}\n`);
      
      throw new Error(
        `Database deletion blocked for '${appId}'. ` +
        `Use the data-protection API or safe-delete script.`
      );
    }
  }

  // For other protected files, just warn
  console.warn(`⚠️  Warning: Deleting protected path: ${targetPath}`);
  await fs.unlink(targetPath);
}

/**
 * Safe rm - validates before recursive deletion
 */
export async function safeRm(
  targetPath: string, 
  options: { recursive?: boolean; force?: boolean } = {}
): Promise<void> {
  const { recursive = false, force = false } = options;

  // Check if this touches protected paths
  if (isProtectedPath(targetPath)) {
    if (recursive) {
      console.error(`\n🛑 BLOCKED: Recursive deletion of protected path`);
      console.error(`   Path: ${targetPath}`);
      console.error(`\n   This operation could delete multiple databases.`);
      console.error(`   To proceed, delete apps individually using safe-delete.\n`);
      
      throw new Error(
        `Recursive deletion of protected path blocked: ${targetPath}`
      );
    }

    // Single file/directory in protected path
    const appId = getAppIdFromPath(targetPath);
    if (appId) {
      console.error(`\n🛑 BLOCKED: Deletion of app data directory`);
      console.error(`   App: ${appId}`);
      console.error(`   Use: node scripts/safe-delete.mjs ${appId}\n`);
      
      throw new Error(
        `App data deletion blocked for '${appId}'. Use safe-delete script.`
      );
    }
  }

  await fs.rm(targetPath, { recursive, force });
}

/**
 * Safe writeFile - warns before overwriting database files
 */
export async function safeWriteFile(
  targetPath: string, 
  data: string | Buffer
): Promise<void> {
  // Check if overwriting an existing database
  if (targetPath.endsWith('db.sqlite') || targetPath.endsWith('.db')) {
    try {
      await fs.access(targetPath);
      // File exists - this is an overwrite
      const appId = getAppIdFromPath(targetPath);
      if (appId) {
        console.error(`\n🛑 BLOCKED: Direct overwrite of database for '${appId}'`);
        console.error(`   Path: ${targetPath}`);
        console.error(`\n   Use the data-protection API instead:`);
        console.error(`   - unprotectDatabase('${appId}')`);
        console.error(`   - Then perform your operation`);
        console.error(`   - protectDatabase('${appId}')\n`);
        
        throw new Error(
          `Database overwrite blocked. Use data-protection API.`
        );
      }
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        throw err;
      }
      // File doesn't exist, OK to create
    }
  }

  await fs.writeFile(targetPath, data);
}

/**
 * Validate that an operation is safe to perform
 * Call this before bulk operations
 */
export async function validateSafeOperation(
  operation: string,
  targetPaths: string[]
): Promise<{ safe: boolean; reason?: string }> {
  // Check for mass data loss patterns
  const massLoss = await detectMassDataLoss();
  if (massLoss.detected) {
    return {
      safe: false,
      reason: `Mass data loss detected: ${massLoss.details}. Operation blocked.`
    };
  }

  // Count how many database files would be affected
  const dbPaths = targetPaths.filter(p => 
    p.endsWith('db.sqlite') || p.endsWith('.db')
  );

  if (dbPaths.length > 2) {
    return {
      safe: false,
      reason: `Operation would affect ${dbPaths.length} databases. Use individual operations.`
    };
  }

  // Check if any paths are protected
  const protectedPaths = targetPaths.filter(isProtectedPath);
  if (protectedPaths.length > 0) {
    return {
      safe: false,
      reason: `Operation affects protected paths: ${protectedPaths.join(', ')}`
    };
  }

  return { safe: true };
}
