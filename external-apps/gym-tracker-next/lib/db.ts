import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const APP_ID = 'gym-tracker';
const dbDir = path.join(process.cwd(), 'data', APP_ID);
const dbPath = path.join(dbDir, 'db.sqlite');
let db: DatabaseSync | null = null;

function getDb() {
  if (db) return db;
  fs.mkdirSync(dbDir, { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

export function dbExec(_appId: string, sql: string, params: unknown[] = []) {
  const stmt = getDb().prepare(sql);
  return stmt.run(...(params as any[]));
}

export function dbQuery<T = unknown>(_appId: string, sql: string, params: unknown[] = []): T[] {
  const stmt = getDb().prepare(sql);
  return stmt.all(...(params as any[])) as T[];
}
