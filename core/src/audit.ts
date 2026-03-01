import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { appDbPath } from './paths.js';

const CITADEL_APP_ID = 'citadel';
const RETENTION_DAYS = 90;

let db: DatabaseSync | null = null;
let cleanupDone = false;

function getCitadelDbPath(): string {
  return appDbPath(CITADEL_APP_ID);
}

function getDb(): DatabaseSync {
  if (db) return db;
  const dbPath = getCitadelDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

function ensureAuditLogTable() {
  try {
    const database = getDb();
    database.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        app_id TEXT NOT NULL,
        event TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_app_ts ON audit_log(app_id, ts)
    `);
  } catch {
    // Table may already exist or DB not available
  }
}

export function cleanupOldAuditLogs(): void {
  if (cleanupDone) return;
  cleanupDone = true;
  
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffIso = cutoff.toISOString();
    
    const database = getDb();
    const stmt = database.prepare(`DELETE FROM audit_log WHERE ts < ?`);
    const result = stmt.run(cutoffIso);
    
    if (result.changes && result.changes > 0) {
      console.log(`[audit] Cleaned up ${result.changes} audit logs older than ${RETENTION_DAYS} days`);
    }
  } catch (e) {
    console.error('Audit cleanup failed:', e);
  }
}

export function audit(appId: string, event: string, payload: Record<string, unknown> = {}) {
  const ts = new Date().toISOString();
  const rec = { ts, appId, event, payload };
  
  // Always log to stdout
  console.log(JSON.stringify(rec));
  
  // Also persist to DB (using direct DB access to avoid recursion with dbExec)
  try {
    ensureAuditLogTable();
    const database = getDb();
    const stmt = database.prepare(
      `INSERT INTO audit_log (ts, app_id, event, payload, created_at) VALUES (?, ?, ?, ?, ?)`
    );
    stmt.run(ts, appId, event, JSON.stringify(payload), ts);
  } catch (e) {
    // Fail silently - don't break app functionality if audit logging fails
    console.error('Audit DB write failed:', e);
  }
}

// Test-only: clear DB cache to allow fresh connections
export function __clearAuditDb(): void {
  db = null;
  cleanupDone = false;
}
