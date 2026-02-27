import { NextResponse } from 'next/server';
import { dbExec, dbQuery } from '@/lib/db';
import { storageReadText, storageWriteText } from '@/lib/storage';

export const runtime = 'nodejs';

const APP_ID = 'gym-tracker';

export async function GET() {
  dbExec(APP_ID, `CREATE TABLE IF NOT EXISTS pings (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL)`);
  dbExec(APP_ID, `INSERT INTO pings (ts) VALUES (?)`, [new Date().toISOString()]);
  const rows = dbQuery(APP_ID, `SELECT id, ts FROM pings ORDER BY id DESC LIMIT 5`);

  await storageWriteText(APP_ID, 'ping.txt', `ping @ ${new Date().toISOString()}\n`);
  const readBack = await storageReadText(APP_ID, 'ping.txt');

  return NextResponse.json({ ok: true, appId: APP_ID, recent: rows, storage: { readBack } });
}
