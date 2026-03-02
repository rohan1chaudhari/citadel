#!/usr/bin/env node
/**
 * Data Protection Preflight Check
 * 
 * Run this before any operation that touches data directories.
 * It detects potential data loss scenarios and blocks dangerous operations.
 * 
 * Usage:
 *   node scripts/preflight-check.mjs
 * 
 * Exit codes:
 *   0 - Safe to proceed
 *   1 - Data loss detected or unsafe condition
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

const CHECKS = {
  passed: 0,
  failed: 0,
  warnings: 0
};

async function checkFreshDatabases() {
  const dataDir = path.resolve(__dirname, '..', 'data', 'apps');
  const freshDbs = [];
  const totalDbs = [];

  try {
    const entries = await fs.readdir(dataDir, { withFileTypes: true });
    const appDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    for (const appId of appDirs) {
      const dbPath = path.join(dataDir, appId, 'db.sqlite');
      try {
        const stats = await fs.stat(dbPath);
        totalDbs.push(appId);
        
        // Check if DB was created in the last 24 hours
        const ageHours = (Date.now() - stats.birthtime.getTime()) / (1000 * 60 * 60);
        if (ageHours < 24) {
          freshDbs.push({ appId, ageHours: Math.round(ageHours), size: stats.size });
        }
      } catch {
        // No DB file
      }
    }

    if (freshDbs.length > 2) {
      log(`\n⚠️  WARNING: ${freshDbs.length} databases were created recently:`, 'yellow');
      for (const db of freshDbs) {
        const sizeStr = db.size < 50000 ? ' (appears empty)' : '';
        log(`   - ${db.appId}: ${db.ageHours} hours old${sizeStr}`, 'yellow');
      }
      log('\n   This may indicate recent data loss.', 'yellow');
      CHECKS.warnings++;
    } else if (freshDbs.length > 0) {
      log(`✓ Only ${freshDbs.length} recent database(s) found`, 'green');
      CHECKS.passed++;
    } else {
      log('✓ All databases appear established', 'green');
      CHECKS.passed++;
    }

    return { freshDbs, totalDbs: totalDbs.length };
  } catch (err) {
    log(`✗ Could not check databases: ${err.message}`, 'red');
    CHECKS.failed++;
    return { freshDbs: [], totalDbs: 0 };
  }
}

async function checkBackupHealth() {
  const backupDir = path.resolve(__dirname, '..', 'data', 'backups');
  
  try {
    const entries = await fs.readdir(backupDir);
    const zipFiles = entries.filter(f => f.endsWith('.zip') && f.startsWith('citadel-backup-'));
    
    if (zipFiles.length === 0) {
      log('\n⚠️  WARNING: No backups found!', 'yellow');
      CHECKS.warnings++;
      return;
    }

    // Check most recent backup
    const sorted = zipFiles.sort().reverse();
    const latest = sorted[0];
    
    // Parse timestamp
    const match = latest.match(/citadel-backup-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})/);
    if (match) {
      const [_, year, month, day, hour, minute] = match;
      const backupTime = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
      const ageHours = (Date.now() - backupTime.getTime()) / (1000 * 60 * 60);
      
      if (ageHours > 48) {
        log(`\n⚠️  WARNING: Latest backup is ${Math.round(ageHours)} hours old`, 'yellow');
        log(`   File: ${latest}`, 'yellow');
        CHECKS.warnings++;
      } else {
        log(`✓ Recent backup available: ${latest}`, 'green');
        CHECKS.passed++;
      }
    }

    // Count valid vs corrupted backups
    let valid = 0;
    let corrupted = 0;
    
    for (const file of sorted.slice(0, 5)) {
      const filePath = path.join(backupDir, file);
      try {
        // Try to read the central directory signature
        const fd = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(4);
        // Read from end of file where central directory should be
        const stats = await fs.stat(filePath);
        await fd.read(buffer, 0, 4, Math.max(0, stats.size - 22));
        await fd.close();
        
        // Central directory signature: 0x06054b50
        if (buffer.readUInt32LE(0) === 0x06054b50) {
          valid++;
        } else {
          corrupted++;
        }
      } catch {
        corrupted++;
      }
    }

    if (corrupted > 0) {
      log(`\n⚠️  WARNING: ${corrupted} recent backup(s) appear corrupted`, 'yellow');
      CHECKS.warnings++;
    } else {
      log(`✓ Recent backups are valid`, 'green');
      CHECKS.passed++;
    }

  } catch (err) {
    log(`\n⚠️  Could not check backups: ${err.message}`, 'yellow');
    CHECKS.warnings++;
  }
}

async function checkDataIntegrity() {
  const dataDir = path.resolve(__dirname, '..', 'data', 'apps');
  let checked = 0;
  let errors = 0;

  try {
    const entries = await fs.readdir(dataDir, { withFileTypes: true });
    const appDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    for (const appId of appDirs.slice(0, 5)) { // Check first 5 apps
      const dbPath = path.join(dataDir, appId, 'db.sqlite');
      try {
        const { DatabaseSync } = await import('node:sqlite');
        const db = new DatabaseSync(dbPath);
        
        try {
          // Try to query sqlite_master - will fail if DB is corrupted
          db.prepare("SELECT name FROM sqlite_master LIMIT 1").all();
          checked++;
        } catch (err) {
          log(`\n✗ Database for '${appId}' appears corrupted`, 'red');
          errors++;
        } finally {
          db.close();
        }
      } catch {
        // No DB or can't open - skip
      }
    }

    if (errors > 0) {
      log(`\n✗ Found ${errors} corrupted database(s)`, 'red');
      CHECKS.failed++;
    } else if (checked > 0) {
      log(`✓ Checked ${checked} databases, all valid`, 'green');
      CHECKS.passed++;
    }
  } catch (err) {
    log(`⚠️  Could not check data integrity: ${err.message}`, 'yellow');
    CHECKS.warnings++;
  }
}

async function main() {
  log('\n╔══════════════════════════════════════════════════════════╗');
  log('║       CITADEL DATA PROTECTION PREFLIGHT CHECK            ║');
  log('╚══════════════════════════════════════════════════════════╝\n');

  log('Checking for potential data loss scenarios...\n');

  await checkFreshDatabases();
  await checkBackupHealth();
  await checkDataIntegrity();

  log('\n' + '═'.repeat(58));
  log(`Results: ${CHECKS.passed} passed, ${CHECKS.warnings} warnings, ${CHECKS.failed} failed`);
  log('═'.repeat(58) + '\n');

  if (CHECKS.failed > 0) {
    log('❌ PREFLIGHT FAILED - Do not proceed with data operations', 'red');
    process.exit(1);
  }

  if (CHECKS.warnings > 0) {
    log('⚠️  PREFLIGHT PASSED WITH WARNINGS - Proceed with caution', 'yellow');
    process.exit(0);
  }

  log('✅ PREFLIGHT PASSED - Safe to proceed', 'green');
  process.exit(0);
}

main().catch(err => {
  console.error('Preflight check failed:', err);
  process.exit(1);
});
