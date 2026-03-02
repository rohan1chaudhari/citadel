import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { assertAppId } from './appIds.js';
import { appDbPath, appDataRoot } from './paths.js';
import { assertSqlAllowed } from './sqlGuardrails.js';
import { audit } from './audit.js';
import { hasDbPermission } from './permissions.js';
import { checkWriteQuota, formatBytes, getAppStorageUsage } from './quota.js';

const dbs = new Map<string, DatabaseSync>();

async function ensureDbDir(appId: string) {
  await fsp.mkdir(appDataRoot(appId), { recursive: true });
}

function getDb(appId: string) {
  assertAppId(appId);
  const hit = dbs.get(appId);
  if (hit) return hit;
  fs.mkdirSync(appDataRoot(appId), { recursive: true });
  const db = new DatabaseSync(appDbPath(appId));
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  dbs.set(appId, db);
  return db;
}

function verb(sql: string) {
  return sql.trim().split(/\s+/)[0]?.toLowerCase() ?? 'unknown';
}

function isWriteOperation(sql: string): boolean {
  const writeVerbs = ['insert', 'update', 'delete', 'replace', 'create', 'alter', 'drop', 'truncate'];
  return writeVerbs.includes(verb(sql));
}

function checkDbQuotaBeforeWrite(appId: string, operation: string, sql: string) {
  // For DB operations, we check if the DB file has room to grow
  // SQLite DBs can grow significantly during writes due to WAL, journal, etc.
  // We use a conservative estimate: ensure at least 10MB headroom for growth
  const HEADROOM_BYTES = 10 * 1024 * 1024; // 10MB
  
  const quotaCheck = checkWriteQuota(appId, HEADROOM_BYTES);
  
  if (!quotaCheck.allowed) {
    const error = `Storage quota exceeded for app '${appId}': DB cannot grow. Used ${formatBytes(quotaCheck.usedBytes)} of ${formatBytes(quotaCheck.quotaBytes)}`;
    audit(appId, `db.${operation}.quota_exceeded`, { 
      verb: verb(sql),
      used: quotaCheck.usedBytes,
      quota: quotaCheck.quotaBytes
    });
    const err = new Error(error);
    (err as any).code = 'QUOTA_EXCEEDED';
    (err as any).statusCode = 507; // Insufficient Storage
    throw err;
  }
}

export function dbExec(appId: string, sql: string, params: unknown[] = []) {
  assertAppId(appId);
  assertSqlAllowed(sql);
  
  // Check permissions
  const isWrite = isWriteOperation(sql);
  const requiredPermission = isWrite ? 'write' : 'read';
  
  if (!hasDbPermission(appId, requiredPermission)) {
    const error = `Permission denied: app '${appId}' does not have db.${requiredPermission} permission`;
    audit(appId, 'db.exec.denied', { verb: verb(sql), error });
    throw new Error(error);
  }
  
  // Check quota before write operations
  if (isWrite) {
    checkDbQuotaBeforeWrite(appId, 'exec', sql);
  }
  
  void ensureDbDir(appId);
  const db = getDb(appId);
  const t0 = Date.now();
  try {
    const stmt = db.prepare(sql);
    // node:sqlite binds positional parameters via varargs, not an array.
    const info = stmt.run(...(params as any[]));
    audit(appId, 'db.exec', { verb: verb(sql), ms: Date.now() - t0, changes: info.changes });
    return info;
  } catch (e: any) {
    audit(appId, 'db.exec.error', { verb: verb(sql), ms: Date.now() - t0, error: String(e?.message ?? e) });
    throw e;
  }
}

export function dbQuery<T = unknown>(appId: string, sql: string, params: unknown[] = []): T[] {
  assertAppId(appId);
  assertSqlAllowed(sql);
  
  // Check permissions
  if (!hasDbPermission(appId, 'read')) {
    const error = `Permission denied: app '${appId}' does not have db.read permission`;
    audit(appId, 'db.query.denied', { verb: verb(sql), error });
    throw new Error(error);
  }
  
  void ensureDbDir(appId);
  const db = getDb(appId);
  const t0 = Date.now();
  try {
    const stmt = db.prepare(sql);
    // node:sqlite binds positional parameters via varargs, not an array.
    const rows = stmt.all(...(params as any[])) as T[];
    audit(appId, 'db.query', { verb: verb(sql), ms: Date.now() - t0, rows: rows.length });
    return rows;
  } catch (e: any) {
    audit(appId, 'db.query.error', { verb: verb(sql), ms: Date.now() - t0, error: String(e?.message ?? e) });
    throw e;
  }
}

// Test-only: clear DB cache to allow fresh connections
export function __clearDbCache(): void {
  dbs.clear();
}
