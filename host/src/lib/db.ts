import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { assertAppId } from '@/lib/appIds';
import { appDbPath, appDataRoot } from '@/lib/paths';
import { assertSqlAllowed } from '@/lib/sqlGuardrails';
import { audit } from '@/lib/audit';

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

export function dbExec(appId: string, sql: string, params: unknown[] = []) {
  assertAppId(appId);
  assertSqlAllowed(sql);
  void ensureDbDir(appId);
  const db = getDb(appId);
  const t0 = Date.now();
  try {
    const stmt = db.prepare(sql);
    const info = stmt.run(params as any);
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
  void ensureDbDir(appId);
  const db = getDb(appId);
  const t0 = Date.now();
  try {
    const stmt = db.prepare(sql);
    const rows = stmt.all(params as any) as T[];
    audit(appId, 'db.query', { verb: verb(sql), ms: Date.now() - t0, rows: rows.length });
    return rows;
  } catch (e: any) {
    audit(appId, 'db.query.error', { verb: verb(sql), ms: Date.now() - t0, error: String(e?.message ?? e) });
    throw e;
  }
}
