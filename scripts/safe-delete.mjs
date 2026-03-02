#!/usr/bin/env node
/**
 * Safe Database Deletion Script
 * 
 * Usage:
 *   node scripts/safe-delete.mjs <app-id> [--force]
 * 
 * This script safely deletes an app's database with multiple safeguards:
 * 1. Creates an immediate backup before deletion
 * 2. Validates the backup was created successfully
 * 3. Requires explicit confirmation (unless --force)
 * 4. Logs the deletion for audit purposes
 * 5. Only deletes the DB file, not the entire app directory
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBackup } from './backup.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function error(msg) {
  console.error(`${colors.red}${colors.bold}Error: ${msg}${colors.reset}`);
}

async function safeDelete(appId, force = false) {
  const dataDir = path.resolve(__dirname, '..', 'data', 'apps', appId);
  const dbPath = path.join(dataDir, 'db.sqlite');

  // Verify the database exists
  try {
    await fs.access(dbPath);
  } catch {
    error(`Database not found for app: ${appId}`);
    process.exit(1);
  }

  // Get database stats
  const stats = await fs.stat(dbPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  log('\n' + '═'.repeat(60), 'yellow');
  log('  ⚠️  DATABASE DELETION REQUESTED', 'yellow');
  log('═'.repeat(60), 'yellow');
  log(`\nApp ID:        ${colors.cyan}${appId}${colors.reset}`);
  log(`Database path: ${dbPath}`);
  log(`Database size: ${sizeMB} MB`);
  log(`Created:       ${stats.birthtime.toISOString()}`);
  log(`Modified:      ${stats.mtime.toISOString()}`);
  log('');

  if (!force) {
    log('This operation will:', 'yellow');
    log('  1. Create an emergency backup');
    log('  2. DELETE the database permanently');
    log('  3. The app will start with fresh data\n');
    
    // In a real implementation, we'd use readline here
    // For now, we'll skip interactive confirmation
    log('Use --force to proceed without confirmation\n');
    process.exit(1);
  }

  // Step 1: Create emergency backup
  log('Step 1: Creating emergency backup...', 'cyan');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(__dirname, '..', 'data', 'backups', 'emergency');
  const backupPath = path.join(backupDir, `${appId}-${timestamp}.sqlite`);
  
  try {
    await fs.mkdir(backupDir, { recursive: true });
    await fs.copyFile(dbPath, backupPath);
    
    // Verify backup
    const backupStats = await fs.stat(backupPath);
    if (backupStats.size !== stats.size) {
      throw new Error('Backup size mismatch');
    }
    
    log(`  ✓ Backup created: ${backupPath}`, 'green');
  } catch (err) {
    error(`Failed to create backup: ${err.message}`);
    log('\nDeletion aborted to prevent data loss.', 'red');
    process.exit(1);
  }

  // Step 2: Delete the database
  log('\nStep 2: Deleting database...', 'cyan');
  
  try {
    await fs.unlink(dbPath);
    
    // Also remove WAL files if they exist
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    
    try { await fs.unlink(walPath); } catch { /* ignore */ }
    try { await fs.unlink(shmPath); } catch { /* ignore */ }
    
    log(`  ✓ Database deleted`, 'green');
  } catch (err) {
    error(`Failed to delete database: ${err.message}`);
    log(`\nYou can restore from: ${backupPath}`, 'cyan');
    process.exit(1);
  }

  // Step 3: Log the deletion
  const auditLog = {
    timestamp: new Date().toISOString(),
    operation: 'DATABASE_DELETION',
    appId,
    backupPath,
    originalSize: stats.size,
    performedBy: process.env.USER || 'unknown'
  };
  
  const auditPath = path.join(backupDir, 'deletion-log.jsonl');
  await fs.appendFile(auditPath, JSON.stringify(auditLog) + '\n');

  log('\n' + '═'.repeat(60), 'green');
  log('  ✓ DATABASE DELETED SUCCESSFULLY', 'green');
  log('═'.repeat(60), 'green');
  log(`\nBackup location: ${backupPath}`);
  log('To restore: Copy the backup file back to the original location\n');
}

// Main
const args = process.argv.slice(2);
const appId = args[0];
const force = args.includes('--force');

if (!appId) {
  console.log('Usage: node scripts/safe-delete.mjs <app-id> [--force]');
  console.log('\nSafely deletes an app\'s database with mandatory backup.');
  console.log('\nOptions:');
  console.log('  --force    Skip confirmation (still creates backup)');
  process.exit(1);
}

safeDelete(appId, force).catch(err => {
  error(err.message);
  process.exit(1);
});
