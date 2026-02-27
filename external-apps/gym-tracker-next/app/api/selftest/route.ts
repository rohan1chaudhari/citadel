import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
export const runtime = 'nodejs';
const APP_ID = 'gym-tracker';
export async function GET() {
  dbExec(APP_ID, 'CREATE TABLE IF NOT EXISTS selftest (id INTEGER PRIMARY KEY, ts TEXT NOT NULL)');
  dbExec(APP_ID, 'INSERT INTO selftest (ts) VALUES (?)', [new Date().toISOString()]);
  const rows = dbQuery<{ n:number }>(APP_ID, 'SELECT COUNT(*) as n FROM selftest');
  return NextResponse.json({ ok: true, rows: rows[0]?.n ?? 0 });
}
