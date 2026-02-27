import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

function appRoot(appId: string) { return path.join(process.cwd(), 'data', appId); }
function appDbPath(appId: string) { return path.join(appRoot(appId), 'db.sqlite'); }

const dbs = new Map<string, DatabaseSync>();

function getDb(appId: string) {
  const hit = dbs.get(appId);
  if (hit) return hit;
  fs.mkdirSync(appRoot(appId), { recursive: true });
  const db = new DatabaseSync(appDbPath(appId));
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  dbs.set(appId, db);
  return db;
}

export function dbExec(appId: string, sql: string, params: unknown[] = []) {
  const stmt = getDb(appId).prepare(sql);
  return stmt.run(...(params as any[]));
}

export function dbQuery<T = unknown>(appId: string, sql: string, params: unknown[] = []): T[] {
  const stmt = getDb(appId).prepare(sql);
  return stmt.all(...(params as any[])) as T[];
}
