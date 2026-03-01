import { NextResponse } from 'next/server';
import { assertAppId } from '@citadel/core';
import { dbExec, dbQuery } from '@citadel/core';
import { storageReadText, storageWriteText } from '@citadel/core';
import { audit } from '@citadel/core';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ appId: string }> }) {
  const { appId } = await ctx.params;
  assertAppId(appId);

  dbExec(appId, `CREATE TABLE IF NOT EXISTS selftest (id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT, created_at TEXT)`);
  dbExec(appId, `INSERT INTO selftest (note, created_at) VALUES (?, ?)`, [`hello from ${appId}`, new Date().toISOString()]);
  const rows = dbQuery<{ id: number; note: string; created_at: string }>(
    appId,
    `SELECT id, note, created_at FROM selftest ORDER BY id DESC LIMIT 5`
  );

  const p = 'selftest.txt';
  const content = `citadel selftest (${appId}) @ ${new Date().toISOString()}\n`;
  await storageWriteText(appId, p, content);
  const readBack = await storageReadText(appId, p);

  audit(appId, 'selftest', { rows: rows.length, wrotePath: p });

  return NextResponse.json({ ok: true, appId, db: { recent: rows }, storage: { path: p, readBack } });
}
